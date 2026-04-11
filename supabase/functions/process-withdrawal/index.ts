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

    // Verify admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Unauthorized');

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!adminProfile || !['admin', 'super_admin'].includes(adminProfile.role || '')) {
      throw new Error('Forbidden: admin only');
    }

    const { withdrawal_request_id, action, admin_note } = await req.json();
    if (!withdrawal_request_id || !action) throw new Error('Missing params');

    // Fetch withdrawal request
    const { data: request, error: fetchErr } = await supabase
      .from('withdrawal_requests')
      .select('*')
      .eq('id', withdrawal_request_id)
      .single();

    if (fetchErr || !request) throw new Error('Withdrawal request not found');
    if (request.status !== 'pending_review') throw new Error('Request already processed');

    if (action === 'reject') {
      await supabase
        .from('withdrawal_requests')
        .update({
          status: 'rejected',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          admin_note: admin_note || 'Rejected by admin',
        })
        .eq('id', withdrawal_request_id);

      // Send rejection email
      try {
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('user_id', request.user_id)
          .single();

        const resendKey = Deno.env.get('RESEND_API_KEY');
        if (resendKey && userProfile?.email) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'Jurist Mind <noreply@juristmind.com>',
              to: userProfile.email,
              subject: '⚠️ Your withdrawal request needs attention',
              html: `
                <p>Hi ${userProfile.full_name || 'there'},</p>
                <p>Your withdrawal request of <strong>₦${request.amount.toLocaleString()}</strong> could not be processed at this time.</p>
                <p><strong>Reason:</strong> ${admin_note || 'Please contact support for details.'}</p>
                <p>Please review your bank details and submit a new request.</p>
                <p>— Jurist Mind Team</p>
              `,
            }),
          });
        }
      } catch (e) { console.error('Rejection email error:', e); }

      return new Response(JSON.stringify({ success: true, status: 'rejected' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'approve') {
      // Verify cleared balance
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('referral_earnings_cleared, email, full_name, referral_code')
        .eq('user_id', request.user_id)
        .single();

      if (!userProfile || (userProfile.referral_earnings_cleared || 0) < request.amount) {
        throw new Error('Insufficient cleared balance');
      }

      const paystackKey = Deno.env.get('PAYSTACK_SECRET_KEY');

      let transferRef = 'manual_' + Date.now();

      if (paystackKey) {
        // Create transfer recipient
        const recipientRes = await fetch('https://api.paystack.co/transferrecipient', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${paystackKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'nuban',
            name: request.bank_account_name,
            account_number: request.bank_account_number,
            bank_code: request.bank_name, // bank_name stores the bank code
          }),
        });
        const recipientData = await recipientRes.json();

        if (recipientData.status && recipientData.data?.recipient_code) {
          // Initiate transfer
          const transferRes = await fetch('https://api.paystack.co/transfer', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${paystackKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              source: 'balance',
              amount: request.amount * 100,
              recipient: recipientData.data.recipient_code,
              reason: 'Jurist Mind Referral Commission Withdrawal',
            }),
          });
          const transferData = await transferRes.json();
          if (transferData.data?.transfer_code) {
            transferRef = transferData.data.transfer_code;
          }
        }
      }

      // Update withdrawal request
      await supabase
        .from('withdrawal_requests')
        .update({
          status: 'approved',
          paystack_transfer_reference: transferRef,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          paid_at: new Date().toISOString(),
        })
        .eq('id', withdrawal_request_id);

      // Deduct from profile
      await supabase
        .from('profiles')
        .update({
          referral_earnings_cleared: Math.max(0, (userProfile.referral_earnings_cleared || 0) - request.amount),
        })
        .eq('user_id', request.user_id);

      // Mark related commissions as withdrawn
      await supabase
        .from('referral_commissions')
        .update({ status: 'withdrawn' })
        .eq('referrer_id', request.user_id)
        .eq('status', 'cleared');

      // Send approval email
      try {
        const resendKey = Deno.env.get('RESEND_API_KEY');
        if (resendKey && userProfile.email) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'Jurist Mind <noreply@juristmind.com>',
              to: userProfile.email,
              subject: `✅ Your withdrawal of ₦${request.amount.toLocaleString()} has been processed!`,
              html: `
                <p>Hi ${userProfile.full_name || 'there'},</p>
                <p>Your referral commission withdrawal has been approved and the funds have been sent to your bank account.</p>
                <table style="margin:16px 0;border-collapse:collapse;">
                  <tr><td style="padding:4px 12px 4px 0;color:#666;">Amount:</td><td><strong>₦${request.amount.toLocaleString()}</strong></td></tr>
                  <tr><td style="padding:4px 12px 4px 0;color:#666;">Status:</td><td>Paid ✅</td></tr>
                  <tr><td style="padding:4px 12px 4px 0;color:#666;">Transfer Ref:</td><td>${transferRef}</td></tr>
                </table>
                <p>Funds typically arrive within 1-2 business days depending on your bank.</p>
                <p>— Jurist Mind Team</p>
              `,
            }),
          });
        }
      } catch (e) { console.error('Approval email error:', e); }

      return new Response(JSON.stringify({ success: true, status: 'approved' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Invalid action');
  } catch (error: any) {
    console.error('process-withdrawal error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
