import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateCode(name: string): string {
  const prefix = name.replace(/\s/g, '').substring(0, 4).toUpperCase();
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${suffix}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { user_id } = await req.json();
    if (!user_id) throw new Error('user_id required');

    // Check if user already has a referral code
    const { data: profile } = await supabase
      .from('profiles')
      .select('referral_code, full_name')
      .eq('user_id', user_id)
      .single();

    if (profile?.referral_code) {
      return new Response(JSON.stringify({ code: profile.referral_code }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const name = profile?.full_name || 'USER';
    let code = generateCode(name);
    let attempts = 0;

    // Ensure uniqueness
    while (attempts < 10) {
      const { data: existing } = await supabase
        .from('profiles')
        .select('referral_code')
        .eq('referral_code', code)
        .maybeSingle();

      if (!existing) break;
      code = generateCode(name);
      attempts++;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ referral_code: code })
      .eq('user_id', user_id);

    if (error) throw error;

    return new Response(JSON.stringify({ code }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('generate-referral-code error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
