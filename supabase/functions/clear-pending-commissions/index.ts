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

    // Find commissions ready to clear
    const { data: pendingCommissions, error: fetchError } = await supabase
      .from('referral_commissions')
      .select('*')
      .eq('status', 'pending')
      .lte('clears_at', new Date().toISOString());

    if (fetchError) throw fetchError;

    if (!pendingCommissions || pendingCommissions.length === 0) {
      return new Response(JSON.stringify({ cleared: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let clearedCount = 0;

    for (const commission of pendingCommissions) {
      // Update commission status
      await supabase
        .from('referral_commissions')
        .update({ status: 'cleared', cleared_at: new Date().toISOString() })
        .eq('id', commission.id);

      // Update referrer profile earnings
      const { data: profile } = await supabase
        .from('profiles')
        .select('referral_earnings_pending, referral_earnings_cleared')
        .eq('user_id', commission.referrer_id)
        .single();

      if (profile) {
        await supabase
          .from('profiles')
          .update({
            referral_earnings_pending: Math.max(0, (profile.referral_earnings_pending || 0) - commission.commission_amount),
            referral_earnings_cleared: (profile.referral_earnings_cleared || 0) + commission.commission_amount,
          })
          .eq('user_id', commission.referrer_id);
      }

      // Check if all months for this referral are cleared
      const { data: allCommissions } = await supabase
        .from('referral_commissions')
        .select('status')
        .eq('referral_id', commission.referral_id);

      const allCleared = allCommissions?.every(c => c.status === 'cleared' || c.status === 'withdrawn');
      if (allCleared) {
        await supabase
          .from('referrals')
          .update({ status: 'commission_cleared' })
          .eq('id', commission.referral_id);
      }

      clearedCount++;
    }

    return new Response(JSON.stringify({ cleared: clearedCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('clear-pending-commissions error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
