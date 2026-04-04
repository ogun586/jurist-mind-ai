import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if already seeded
    const { count } = await supabase.from("countries").select("*", { count: "exact", head: true });
    if (count && count > 50) {
      return new Response(JSON.stringify({ message: `Already seeded with ${count} countries` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch from REST Countries API
    const response = await fetch("https://restcountries.com/v3.1/all?fields=name,cca2");
    const data = await response.json();

    const countries = data
      .filter((c: any) => c.cca2)
      .map((c: any) => ({
        name: c.name.common,
        code: c.cca2,
      }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));

    // Insert in batches of 50
    let inserted = 0;
    for (let i = 0; i < countries.length; i += 50) {
      const batch = countries.slice(i, i + 50);
      const { error } = await supabase.from("countries").upsert(batch, { onConflict: "name" });
      if (error) {
        console.error("Batch error:", error);
      } else {
        inserted += batch.length;
      }
    }

    return new Response(JSON.stringify({ message: `Seeded ${inserted} countries` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
