import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyCodeRequest {
  email: string;
  code: string;
}

interface UserData {
  email: string;
  password: string;
  displayName?: string;
  phone?: string;
  userType?: string;
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

    const { email, code }: VerifyCodeRequest = await req.json();

    // Find the verification code
    const { data: verificationData, error: selectError } = await supabase
      .from('email_verification_codes')
      .select('*')
      .eq('email', email)
      .eq('code', code)
      .eq('verified', false)
      .single();

    if (selectError || !verificationData) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired verification code" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Check if code has expired
    const now = new Date();
    const expiresAt = new Date(verificationData.expires_at);
    
    if (now > expiresAt) {
      return new Response(
        JSON.stringify({ error: "Verification code has expired" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    let userName = '';

    // If user data exists, create or update the Supabase Auth user
    if (verificationData.user_data) {
      const userData: UserData = JSON.parse(verificationData.user_data);
      userName = userData.displayName || '';
      
      // Check if user already exists
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === userData.email);

      if (existingUser) {
        console.log("User already exists, updating metadata:", existingUser.id);
        
        const { error: updateUserError } = await supabase.auth.admin.updateUserById(
          existingUser.id,
          {
            user_metadata: {
              display_name: userData.displayName,
              phone: userData.phone,
              user_type: userData.userType,
            },
            email_confirm: true,
          }
        );

        if (updateUserError) {
          console.error("Error updating user:", updateUserError);
        }
      } else {
        // Create new user
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: userData.email,
          password: userData.password,
          user_metadata: {
            display_name: userData.displayName,
            phone: userData.phone,
            user_type: userData.userType,
          },
          email_confirm: true,
        });

        if (authError) {
          console.error("Error creating user:", authError);
          return new Response(
            JSON.stringify({ error: `Failed to create account: ${authError.message}` }),
            {
              status: 500,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            }
          );
        }

        console.log("User created successfully:", authData.user?.id);
      }

      // Send welcome email
      try {
        await resend.emails.send({
          from: "JuristMind <joy@auth.juristmind.com>",
          to: [userData.email],
          subject: "Welcome to JuristMind! 🎉",
          html: `
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px; font-family: Arial, sans-serif; color: #111; background-color: #ffffff;">
              <div style="text-align: center; margin-bottom: 32px;">
                <h1 style="font-size: 28px; font-weight: bold; color: #C9A84C; margin: 0; letter-spacing: 2px;">JURIST MIND</h1>
              </div>
              
              <h2 style="font-size: 22px; color: #333; margin-bottom: 16px;">
                Welcome${userName ? `, ${userName}` : ''}! 🎉
              </h2>
              
              <p style="font-size: 15px; color: #555; line-height: 1.6; margin-bottom: 16px;">
                Your email has been verified and your JuristMind account is now active. We're thrilled to have you on board!
              </p>
              
              <p style="font-size: 15px; color: #555; line-height: 1.6; margin-bottom: 24px;">
                JuristMind is your AI-powered legal research companion — designed to help lawyers, law students, and researchers navigate Nigerian law with precision and speed.
              </p>
              
              <div style="background-color: #faf8f3; padding: 20px; border-radius: 12px; margin-bottom: 24px; border-left: 4px solid #C9A84C;">
                <p style="font-size: 14px; color: #555; margin: 0 0 8px 0; font-weight: 600;">Here's what you can do:</p>
                <ul style="font-size: 14px; color: #555; line-height: 1.8; margin: 0; padding-left: 20px;">
                  <li>Ask legal questions and get well-sourced answers</li>
                  <li>Manage your cases and diary entries</li>
                  <li>Analyse legal documents with JuristLens</li>
                  <li>Access the lawyers' directory and marketplace</li>
                </ul>
              </div>

              <div style="text-align: center; margin: 32px 0;">
                <a href="https://chat.juristmind.com" 
                   style="background-color: #C9A84C; color: #fff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block;">
                  Get Started
                </a>
              </div>
              
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
              <p style="color: #999; font-size: 12px; text-align: center;">
                You're receiving this because you created a JuristMind account. If this wasn't you, please ignore this email.
              </p>
            </div>
          `,
        });
        console.log("Welcome email sent successfully to:", userData.email);
      } catch (emailError) {
        console.error("Failed to send welcome email:", emailError);
        // Don't fail the whole verification if welcome email fails
      }
    }

    // Mark code as verified
    const { error: updateError } = await supabase
      .from('email_verification_codes')
      .update({ verified: true })
      .eq('id', verificationData.id);

    if (updateError) {
      console.error("Error marking code as verified:", updateError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email verified successfully and account created" 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in verify-email-code function:", error);
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
