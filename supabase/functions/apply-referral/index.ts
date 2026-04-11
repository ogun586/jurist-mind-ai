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

    const { new_user_id, referral_code } = await req.json();
    if (!new_user_id || !referral_code) {
      return new Response(JSON.stringify({ success: false, reason: 'missing_params' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Look up referrer by code
    const { data: referrer } = await supabase
      .from('profiles')
      .select('user_id, phone')
      .eq('referral_code', referral_code)
      .maybeSingle();

    if (!referrer) {
      return new Response(JSON.stringify({ success: false, reason: 'invalid_code' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // No self-referral
    if (referrer.user_id === new_user_id) {
      return new Response(JSON.stringify({ success: false, reason: 'self_referral' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if new user already has referred_by
    const { data: newUserProfile } = await supabase
      .from('profiles')
      .select('referred_by, phone')
      .eq('user_id', new_user_id)
      .single();

    if (newUserProfile?.referred_by) {
      return new Response(JSON.stringify({ success: false, reason: 'already_referred' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Same phone check
    if (referrer.phone && newUserProfile?.phone && referrer.phone === newUserProfile.phone) {
      return new Response(JSON.stringify({ success: false, reason: 'same_phone' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Apply referral
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ referred_by: referrer.user_id })
      .eq('user_id', new_user_id);

    if (updateError) throw updateError;

    // Create referral record
    const { error: insertError } = await supabase
      .from('referrals')
      .insert({
        referrer_id: referrer.user_id,
        referred_id: new_user_id,
        referral_code,
        status: 'signed_up',
        signed_up_at: new Date().toISOString(),
      });

    if (insertError) throw insertError;

    // Mark clicks as converted
    await supabase
      .from('referral_clicks')
      .update({ converted: true })
      .eq('referral_code', referral_code)
      .eq('converted', false);

    // Send email notification to referrer
    try {
      const { data: newUser } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', new_user_id)
        .single();

      const { data: referrerProfile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('user_id', referrer.user_id)
        .single();

      if (referrerProfile?.email) {
        const resendKey = Deno.env.get('RESEND_API_KEY');
        if (resendKey) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'Jurist Mind <noreply@juristmind.com>',
              to: referrerProfile.email,
              subject: '👀 Someone just signed up using your Jurist Mind referral link!',
              html: `
                <p>Hi ${referrerProfile.full_name || 'there'},</p>
                <p><strong>${newUser?.full_name || 'Someone'}</strong> just created a Jurist Mind account using your referral link.</p>
                <p>They haven't subscribed yet — but when they do, you'll earn <strong>10% of their subscription price</strong>, credited instantly to your referral balance.</p>
                <p>Keep sharing — top referrers on Jurist Mind earn over ₦20,000 monthly.</p>
                <p>— Jurist Mind Team</p>
              `,
            }),
          });
        }
      }
    } catch (emailErr) {
      console.error('Email notification error:', emailErr);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('apply-referral error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
