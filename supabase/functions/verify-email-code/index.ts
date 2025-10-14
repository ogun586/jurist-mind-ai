import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // If user data exists, create or update the Supabase Auth user
    if (verificationData.user_data) {
      const userData: UserData = JSON.parse(verificationData.user_data);
      
      // Check if user already exists
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === userData.email);

      if (existingUser) {
        console.log("User already exists, updating metadata:", existingUser.id);
        
        // Update existing user's metadata
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
    }

    // Mark code as verified AFTER successful user creation/update
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