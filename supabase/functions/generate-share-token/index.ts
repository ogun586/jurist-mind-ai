import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function generateToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 12; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { chat_session_id, expires_in_days } = await req.json();

    const { data: session, error: sessionError } = await supabase
      .from("chat_sessions").select("id, user_id").eq("id", chat_session_id).single();
    if (sessionError || !session || session.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Chat not found or not yours" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if share already exists for this session
    const { data: existingShare } = await supabase
      .from("shared_chats").select("share_token").eq("chat_session_id", chat_session_id)
      .eq("user_id", user.id).eq("is_active", true).maybeSingle();

    if (existingShare) {
      const shareUrl = `https://id-preview--0d70bb92-b01d-4689-9ded-f9bffa9b8aa3.lovable.app/share/${existingShare.share_token}`;
      return new Response(JSON.stringify({ success: true, share_token: existingShare.share_token, share_url: shareUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let shareToken = generateToken();
    for (let attempts = 0; attempts < 10; attempts++) {
      const { data: existing } = await supabase.from("shared_chats").select("id").eq("share_token", shareToken).maybeSingle();
      if (!existing) break;
      shareToken = generateToken();
    }

    const expiresAt = expires_in_days
      ? new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { data, error } = await supabase.from("shared_chats").insert({
      chat_session_id, user_id: user.id, share_token: shareToken, expires_at: expiresAt,
    }).select().single();
    if (error) throw error;

    await supabase.from("chat_sessions").update({ is_shared: true }).eq("id", chat_session_id);

    const shareUrl = `https://id-preview--0d70bb92-b01d-4689-9ded-f9bffa9b8aa3.lovable.app/share/${shareToken}`;
    return new Response(JSON.stringify({ success: true, share_token: shareToken, share_url: shareUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
