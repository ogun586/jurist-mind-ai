import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "ogunseun7@gmail.com";
const FROM_EMAIL = "JuristMind <joy@auth.juristmind.com>";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { lawyer } = await req.json();
    if (!lawyer) {
      return new Response(JSON.stringify({ error: "lawyer payload required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminDashboardLink = `https://jurist-mind-ai.lovable.app/admin?tab=lawyers&lawyer=${lawyer.id ?? ""}`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #0A0A0F; color: #ffffff; padding: 32px; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-block; padding: 12px 20px; background: linear-gradient(135deg, #C9A84C, #b8932f); border-radius: 12px;">
            <span style="color: #0A0A0F; font-weight: 700; font-size: 18px; letter-spacing: 0.5px;">JURIST MIND</span>
          </div>
        </div>
        <h2 style="color: #C9A84C; margin: 0 0 8px 0;">New Lawyer Registration — Pending Approval</h2>
        <p style="color: #a0a0b0; margin: 0 0 24px 0;">A new legal professional has submitted their profile for verification.</p>

        <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(201,168,76,0.2); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
          <table style="width: 100%; color: #e0e0e8; font-size: 14px;">
            <tr><td style="padding: 6px 0; color: #8a8a9a;">Name</td><td style="padding: 6px 0; font-weight: 600;">${escape(lawyer.name)}</td></tr>
            ${lawyer.firm_name ? `<tr><td style="padding: 6px 0; color: #8a8a9a;">Firm</td><td style="padding: 6px 0;">${escape(lawyer.firm_name)}</td></tr>` : ""}
            <tr><td style="padding: 6px 0; color: #8a8a9a;">Email</td><td style="padding: 6px 0;">${escape(lawyer.email)}</td></tr>
            ${lawyer.phone ? `<tr><td style="padding: 6px 0; color: #8a8a9a;">Phone</td><td style="padding: 6px 0;">${escape(lawyer.phone)}</td></tr>` : ""}
            ${lawyer.country ? `<tr><td style="padding: 6px 0; color: #8a8a9a;">Country</td><td style="padding: 6px 0;">${escape(lawyer.country)}</td></tr>` : ""}
            ${lawyer.state ? `<tr><td style="padding: 6px 0; color: #8a8a9a;">Location</td><td style="padding: 6px 0;">${escape([lawyer.city, lawyer.state].filter(Boolean).join(", "))}</td></tr>` : ""}
            ${lawyer.bar_number ? `<tr><td style="padding: 6px 0; color: #8a8a9a;">Bar Number</td><td style="padding: 6px 0;">${escape(lawyer.bar_number)}</td></tr>` : ""}
            <tr><td style="padding: 6px 0; color: #8a8a9a;">Experience</td><td style="padding: 6px 0;">${lawyer.years_experience || 0} yrs</td></tr>
            ${Array.isArray(lawyer.specialization) && lawyer.specialization.length ? `<tr><td style="padding: 6px 0; color: #8a8a9a;">Practice Areas</td><td style="padding: 6px 0;">${escape(lawyer.specialization.join(", "))}</td></tr>` : ""}
          </table>
        </div>

        <div style="text-align: center; margin: 24px 0;">
          <a href="${adminDashboardLink}" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #C9A84C, #b8932f); color: #0A0A0F; text-decoration: none; font-weight: 700; border-radius: 10px;">
            Review in Admin Dashboard
          </a>
        </div>

        <p style="color: #6a6a7a; font-size: 12px; text-align: center; margin-top: 32px;">
          Submitted at ${new Date().toISOString()}<br/>
          JuristMind — AI-Powered Legal Network
        </p>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [ADMIN_EMAIL],
        subject: `New Lawyer Registration – ${lawyer.name}${lawyer.country ? ` (${lawyer.country})` : ""}`,
        html,
      }),
    });

    const body = await res.json();
    if (!res.ok) {
      console.error("Resend error", body);
      return new Response(JSON.stringify({ error: "Resend failed", details: body }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, id: body.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("notify-admin-lawyer-signup error", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function escape(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}