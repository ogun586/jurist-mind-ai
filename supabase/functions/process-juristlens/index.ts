import { corsHeaders } from "https://deno.land/x/cors@v1.2.2/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No auth");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;

    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Unauthorized");

    const { document_id, action } = await req.json();

    if (action === "extract_clauses") {
      // 1. Get document
      const { data: doc, error: docErr } = await supabase
        .from("juristlens_documents")
        .select("*")
        .eq("id", document_id)
        .single();
      if (docErr || !doc) throw new Error("Document not found");

      // Update status to processing
      await supabase
        .from("juristlens_documents")
        .update({ status: "processing" })
        .eq("id", document_id);

      // 2. Send document to Render backend for text extraction
      const extractRes = await fetch("https://juristmind.onrender.com/api/juristlens/extract-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_url: doc.file_url, file_type: doc.file_type }),
      });

      let pages: { page_number: number; text: string }[] = [];
      
      if (extractRes.ok) {
        const extractData = await extractRes.json();
        pages = extractData.pages || [];
      }

      // If Render extraction fails or returns empty, use AI to process
      if (pages.length === 0) {
        // Fallback: send the document URL directly to AI for analysis
        pages = [{ page_number: 1, text: "Document at: " + doc.file_url }];
      }

      // 3. Store pages in DB
      if (pages.length > 0) {
        const pageRows = pages.map((p) => ({
          document_id,
          page_number: p.page_number,
          text_content: p.text,
        }));
        await supabase.from("juristlens_pages").insert(pageRows);
      }

      // Update page count
      await supabase
        .from("juristlens_documents")
        .update({ page_count: pages.length })
        .eq("id", document_id);

      // 4. Combine text for AI analysis (limit to ~50k chars)
      const combinedText = pages
        .map((p) => `--- PAGE ${p.page_number} ---\n${p.text}`)
        .join("\n\n")
        .slice(0, 50000);

      // 5. Call AI for clause extraction
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lovableKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are a legal document analyst. Analyze the following legal document and extract all important clauses.

For each clause, provide:
- title: A concise title for the clause
- text: The exact text from the document (quoted verbatim)
- clause_type: One of: termination, payment, liability, indemnity, confidentiality, non_compete, force_majeure, dispute_resolution, governing_law, warranty, intellectual_property, data_protection, assignment, amendment, notice, insurance, representations, obligations, rights, other
- risk_level: "high", "medium", or "low" based on legal risk
- explanation: Brief explanation of what this clause means and its implications
- recommendation: Actionable legal recommendation regarding this clause
- page_number: The page number where this clause appears (from the PAGE markers)
- start_offset: The approximate character offset where this clause starts on the page (0 if unsure)
- end_offset: The approximate character offset where this clause ends on the page (0 if unsure)

Return a JSON array of clause objects. Focus on the most legally significant clauses (aim for 8-20 clauses depending on document length). Prioritize high-risk clauses.

IMPORTANT: Return ONLY valid JSON, no markdown formatting. Format: [{"title":"...","text":"...","clause_type":"...","risk_level":"...","explanation":"...","recommendation":"...","page_number":1,"start_offset":0,"end_offset":0}]`,
            },
            {
              role: "user",
              content: `Analyze this legal document and extract all important clauses:\n\n${combinedText}`,
            },
          ],
          temperature: 0.2,
          max_tokens: 8000,
        }),
      });

      if (!aiRes.ok) {
        const errText = await aiRes.text();
        console.error("AI error:", errText);
        await supabase
          .from("juristlens_documents")
          .update({ status: "failed" })
          .eq("id", document_id);
        throw new Error("AI extraction failed");
      }

      const aiData = await aiRes.json();
      let content = aiData.choices?.[0]?.message?.content || "[]";
      
      // Clean up potential markdown wrapping
      content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

      let clauses: any[] = [];
      try {
        clauses = JSON.parse(content);
      } catch (e) {
        console.error("Failed to parse AI response:", content);
        // Try to find JSON array in the response
        const match = content.match(/\[[\s\S]*\]/);
        if (match) {
          try { clauses = JSON.parse(match[0]); } catch {}
        }
      }

      // 6. Store clauses
      if (clauses.length > 0) {
        // Find actual offsets by searching page text
        const clauseRows = clauses.map((c: any) => {
          let pageNum = c.page_number || 1;
          let startOffset = c.start_offset || 0;
          let endOffset = c.end_offset || 0;

          // Try to find exact text position in page content
          const page = pages.find((p) => p.page_number === pageNum);
          if (page && c.text) {
            const searchText = c.text.slice(0, 80); // Use first 80 chars to find
            const idx = page.text.indexOf(searchText);
            if (idx >= 0) {
              startOffset = idx;
              endOffset = idx + c.text.length;
            }
          }

          return {
            document_id,
            title: c.title || "Untitled Clause",
            text: c.text || "",
            clause_type: c.clause_type || "other",
            risk_level: c.risk_level || "low",
            explanation: c.explanation || "",
            recommendation: c.recommendation || "",
            page_number: pageNum,
            start_offset: startOffset,
            end_offset: endOffset,
          };
        });

        await supabase.from("juristlens_clauses").insert(clauseRows);
      }

      // 7. Mark complete
      await supabase
        .from("juristlens_documents")
        .update({ status: "completed" })
        .eq("id", document_id);

      return new Response(
        JSON.stringify({ success: true, clause_count: clauses.length }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    if (action === "chat") {
      const { question, clause_ids, chat_history } = await req.json();

      // Get document and its clauses
      const { data: doc } = await supabase
        .from("juristlens_documents")
        .select("*")
        .eq("id", document_id)
        .single();

      const { data: clauses } = await supabase
        .from("juristlens_clauses")
        .select("*")
        .eq("document_id", document_id);

      // Build context from relevant clauses
      const relevantClauses = clause_ids?.length
        ? clauses?.filter((c: any) => clause_ids.includes(c.id))
        : clauses;

      const clauseContext = (relevantClauses || [])
        .map(
          (c: any, i: number) =>
            `[Clause ${i + 1}: "${c.title}" (${c.risk_level} risk, Page ${c.page_number})]\n${c.text}\nExplanation: ${c.explanation}`
        )
        .join("\n\n");

      const messages: any[] = [
        {
          role: "system",
          content: `You are JuristLens AI, an expert legal document analyst. You are analyzing the document "${doc?.file_name || "unknown"}".

Here are the extracted clauses from this document:

${clauseContext}

When answering questions:
1. Reference specific clauses by their title and ID when relevant
2. Format clause references as [[Clause: clause_title]] so they can be made clickable
3. Provide clear, actionable legal analysis
4. Highlight potential risks and recommendations
5. Be precise and cite specific text from the clauses when possible

Always respond in a professional, clear manner suitable for legal professionals.`,
        },
      ];

      // Add chat history
      if (chat_history?.length) {
        for (const msg of chat_history) {
          messages.push({ role: msg.role, content: msg.content });
        }
      }

      messages.push({ role: "user", content: question });

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lovableKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages,
          temperature: 0.3,
          max_tokens: 4000,
        }),
      });

      if (!aiRes.ok) throw new Error("AI chat failed");

      const aiData = await aiRes.json();
      const answer = aiData.choices?.[0]?.message?.content || "I couldn't generate a response.";

      // Extract clause references from the answer
      const clauseRefs: string[] = [];
      const refPattern = /\[\[Clause: ([^\]]+)\]\]/g;
      let match;
      while ((match = refPattern.exec(answer)) !== null) {
        clauseRefs.push(match[1]);
      }

      // Map references to clause IDs
      const referencedClauses = (clauses || [])
        .filter((c: any) => clauseRefs.some((ref) => c.title.includes(ref) || ref.includes(c.title)))
        .map((c: any) => ({ id: c.id, title: c.title, page_number: c.page_number }));

      return new Response(
        JSON.stringify({
          answer,
          referenced_clauses: referencedClauses,
        }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Invalid action");
  } catch (e: any) {
    console.error("Error:", e.message);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
