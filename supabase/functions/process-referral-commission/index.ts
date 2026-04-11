import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { paying_user_id, payment_id, amount_paid } = await req.json();
    if (!paying_user_id || !amount_paid) {
      return new Response(JSON.stringify({ success: false, reason: 'missing_params' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if paying user was referred
    const { data: payerProfile } = await supabase
      .from('profiles')
      .select('referred_by, full_name, email')
      .eq('user_id', paying_user_id)
      .single();

    if (!payerProfile?.referred_by) {
      return new Response(JSON.stringify({ success: false, reason: 'not_referred' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get referral record
    const { data: referral } = await supabase
      .from('referrals')
      .select('*')
      .eq('referred_id', paying_user_id)
      .eq('referrer_id', payerProfile.referred_by)
      .maybeSingle();

    if (!referral) {
      return new Response(JSON.stringify({ success: false, reason: 'no_referral_record' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Commission cap: max 3 months
    if (referral.months_commissioned >= 3) {
      return new Response(JSON.stringify({ success: false, reason: 'commission_cap_reached' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate commission
    const commissionRate = 0.10;
    const commissionAmount = Math.round(amount_paid * commissionRate * 100) / 100;
    const clearsAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const monthNumber = referral.months_commissioned + 1;

    // Insert commission record
    const { error: commError } = await supabase
      .from('referral_commissions')
      .insert({
        referrer_id: payerProfile.referred_by,
        referred_id: paying_user_id,
        referral_id: referral.id,
        payment_id: payment_id || null,
        amount_paid,
        commission_rate: commissionRate,
        commission_amount: commissionAmount,
        status: 'pending',
        month_number: monthNumber,
        clears_at: clearsAt,
      });

    if (commError) throw commError;

    // Update referral record
    const updateData: any = {
      months_commissioned: monthNumber,
      status: 'commission_pending',
      total_commission_earned: (referral.total_commission_earned || 0) + commissionAmount,
    };
    if (!referral.paid_at) {
      updateData.paid_at = new Date().toISOString();
    }

    await supabase
      .from('referrals')
      .update(updateData)
      .eq('id', referral.id);

    // Update referrer's earnings
    const { data: referrerProfile } = await supabase
      .from('profiles')
      .select('referral_earnings_pending, referral_earnings_total, full_name, email, referral_code')
      .eq('user_id', payerProfile.referred_by)
      .single();

    if (referrerProfile) {
      await supabase
        .from('profiles')
        .update({
          referral_earnings_pending: (referrerProfile.referral_earnings_pending || 0) + commissionAmount,
          referral_earnings_total: (referrerProfile.referral_earnings_total || 0) + commissionAmount,
        })
        .eq('user_id', payerProfile.referred_by);

      // Send commission earned email
      try {
        const resendKey = Deno.env.get('RESEND_API_KEY');
        if (resendKey && referrerProfile.email) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'Jurist Mind <noreply@juristmind.com>',
              to: referrerProfile.email,
              subject: `💰 ${payerProfile.full_name || 'A referral'} just subscribed — you earned ₦${commissionAmount.toLocaleString()}!`,
              html: `
                <p>Hi ${referrerProfile.full_name || 'there'},</p>
                <p>Someone you referred just became a paying member.</p>
                <table style="margin:16px 0;border-collapse:collapse;">
                  <tr><td style="padding:4px 12px 4px 0;color:#666;">Referred user:</td><td><strong>${payerProfile.full_name || 'N/A'}</strong></td></tr>
                  <tr><td style="padding:4px 12px 4px 0;color:#666;">Commission:</td><td><strong>₦${commissionAmount.toLocaleString()}</strong></td></tr>
                  <tr><td style="padding:4px 12px 4px 0;color:#666;">Status:</td><td>Clearing in 48 hours</td></tr>
                  <tr><td style="padding:4px 12px 4px 0;color:#666;">Month:</td><td>${monthNumber} of 3</td></tr>
                </table>
                <p>You'll continue earning for ${3 - monthNumber} more month(s) from this subscription.</p>
                <p>— Jurist Mind Team</p>
              `,
            }),
          });
        }
      } catch (emailErr) {
        console.error('Commission email error:', emailErr);
      }
    }

    return new Response(JSON.stringify({ success: true, commission_amount: commissionAmount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('process-referral-commission error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
