import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response(JSON.stringify({ error: "Token required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { data: share, error: shareError } = await supabase
      .from("shared_chats")
      .select("chat_session_id, created_at, expires_at, is_active, view_count")
      .eq("share_token", token).single();

    if (shareError || !share) {
      return new Response(JSON.stringify({ error: "Chat not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!share.is_active) {
      return new Response(JSON.stringify({ error: "This share has been disabled" }), {
        status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "This share has expired" }), {
        status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: messages, error: messagesError } = await supabase
      .from("chat_messages").select("id, content, sender, created_at")
      .eq("session_id", share.chat_session_id).order("created_at", { ascending: true });
    if (messagesError) throw messagesError;

    const { data: session } = await supabase
      .from("chat_sessions").select("title").eq("id", share.chat_session_id).single();

    await supabase.from("shared_chats")
      .update({ view_count: (share.view_count || 0) + 1 })
      .eq("share_token", token);

    return new Response(JSON.stringify({
      success: true,
      title: session?.title || "Shared Chat",
      created_at: share.created_at,
      messages: messages || [],
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
