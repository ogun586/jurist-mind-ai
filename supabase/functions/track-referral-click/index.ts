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

    const { referral_code, platform, ip_address, user_agent } = await req.json();
    if (!referral_code) throw new Error('referral_code required');

    // Look up referrer
    const { data: referrer } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('referral_code', referral_code)
      .maybeSingle();

    if (!referrer) {
      return new Response(JSON.stringify({ success: false, reason: 'invalid_code' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error } = await supabase
      .from('referral_clicks')
      .insert({
        referral_code,
        referrer_id: referrer.user_id,
        platform: platform || 'unknown',
        ip_address: ip_address || null,
        user_agent: user_agent || null,
        converted: false,
      });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('track-referral-click error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
