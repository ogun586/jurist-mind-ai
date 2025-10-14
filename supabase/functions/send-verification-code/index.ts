import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendCodeRequest {
  email: string;
  userData?: {
    email: string;
    password: string;
    displayName?: string;
    phone?: string;
    userType?: string;
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { email, userData }: SendCodeRequest = await req.json();

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Set expiry to 10 minutes from now
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Delete any existing codes for this email
    await supabase
      .from('email_verification_codes')
      .delete()
      .eq('email', email);

    // Insert new verification code with user data
    const { error: insertError } = await supabase
      .from('email_verification_codes')
      .insert({
        email,
        code,
        expires_at: expiresAt,
        user_data: userData ? JSON.stringify(userData) : null,
      });

    if (insertError) {
      throw insertError;
    }

    // Send email with verification code
    const emailResponse = await resend.emails.send({
      from: "JuristMind <joy@auth.juristmind.com>",
      to: [email],
      subject: "Your JuristMind Verification Code",
      html: `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif; color: #111;">
          <h2 style="color: #333; text-align: center;">Verify Your Email for JuristMind</h2>
          
          <p>Hello${userData?.displayName ? ` ${userData.displayName}` : ''},</p>
          
          <p>To complete your registration on chat.juristmind.com, use this verification code:</p>
          
          <div style="background-color: #f0f0f0; padding: 16px; text-align: center; margin: 20px 0; border-radius: 8px;">
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">${code}</div>
          </div>
          
          <p style="color: #666;">This code expires in 10 minutes. If you didn't request this, please ignore it.</p>
          
          <p>Best,<br><strong>JuristMind Team</strong></p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            This is an automated message from JuristMind. Please do not reply to this email.
          </p>
        </div>
      `,
    });

    console.log("Verification email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Verification code sent to your email"
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-verification-code function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);