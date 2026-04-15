import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RENDER_BASE = "https://juristmind.onrender.com/api/juristlens";
const MAX_RETRIES = 3;

// ── Retry helper ──────────────────────────────────────────────────────────────
async function fetchWithRetry(url: string, opts: RequestInit, retries = MAX_RETRIES): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000); // 2 min timeout
      const res = await fetch(url, { ...opts, signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok || res.status < 500) return res;
      console.error(`Attempt ${attempt}/${retries} failed: ${res.status}`);
    } catch (e: any) {
      console.error(`Attempt ${attempt}/${retries} error:`, e.message);
      if (attempt === retries) throw e;
    }
    // Exponential backoff: 2s, 4s, 8s
    await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
  }
  throw new Error("All retry attempts failed");
}

// ── Fuzzy offset mapping ──────────────────────────────────────────────────────
function mapClauseOffsets(
  clauseText: string,
  pageText: string
): { startOffset: number; endOffset: number; matchQuality: string } {
  if (!clauseText || !pageText) return { startOffset: 0, endOffset: 0, matchQuality: "page_only" };

  // Normalize
  const normalize = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
  const normClause = normalize(clauseText);
  const normPage = normalize(pageText);

  // 1. Exact match
  const exactIdx = normPage.indexOf(normClause);
  if (exactIdx >= 0) {
    return { startOffset: exactIdx, endOffset: exactIdx + normClause.length, matchQuality: "exact" };
  }

  // 2. Partial exact (first 80 chars)
  const partialNeedle = normClause.slice(0, 80);
  const partialIdx = normPage.indexOf(partialNeedle);
  if (partialIdx >= 0) {
    return {
      startOffset: partialIdx,
      endOffset: Math.min(partialIdx + normClause.length, normPage.length),
      matchQuality: "exact",
    };
  }

  // 3. Sliding window fuzzy match
  const windowSize = normClause.length;
  const tolerance = Math.floor(windowSize * 0.15);
  let bestScore = 0;
  let bestIdx = -1;

  for (let i = 0; i <= normPage.length - windowSize + tolerance; i++) {
    const window = normPage.slice(i, i + windowSize);
    // Token overlap score
    const clauseTokens = new Set(normClause.split(/\s+/));
    const windowTokens = window.split(/\s+/);
    let matches = 0;
    for (const t of windowTokens) {
      if (clauseTokens.has(t)) matches++;
    }
    const score = matches / clauseTokens.size;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  if (bestScore >= 0.82 && bestIdx >= 0) {
    return {
      startOffset: bestIdx,
      endOffset: bestIdx + windowSize,
      matchQuality: "approximate",
    };
  }

  console.warn(`[page_only] Could not map clause: "${clauseText.slice(0, 50)}..."`);
  return { startOffset: 0, endOffset: 0, matchQuality: "page_only" };
}

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

    const body = await req.json();
    const { document_id, action } = body;

    // ═══════════════════════════════════════════════════════════════════════════
    // EXTRACT CLAUSES
    // ═══════════════════════════════════════════════════════════════════════════
    if (action === "extract_clauses") {
      const startTime = Date.now();

      // 1. Get document
      const { data: doc, error: docErr } = await supabase
        .from("juristlens_documents")
        .select("*")
        .eq("id", document_id)
        .single();
      if (docErr || !doc) throw new Error("Document not found");

      // Idempotency: skip if already completed
      if (doc.status === "completed") {
        return new Response(
          JSON.stringify({ success: true, message: "Already processed", clause_count: 0 }),
          { headers: { ...CORS, "Content-Type": "application/json" } }
        );
      }

      // Update status
      await supabase.from("juristlens_documents").update({ status: "processing" }).eq("id", document_id);

      let pages: { page_number: number; text: string }[] = [];

      // 2. Try Render backend for text extraction (with retry)
      try {
        const extractRes = await fetchWithRetry(
          `${RENDER_BASE}/extract-pages`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": authHeader,
            },
            body: JSON.stringify({ document_url: doc.file_url, file_type: doc.file_type }),
          }
        );

        if (extractRes.ok) {
          const extractData = await extractRes.json();
          pages = extractData.pages || [];
        }
      } catch (e: any) {
        console.error("Render extraction failed, using AI fallback:", e.message);
      }

      // Fallback if Render fails
      if (pages.length === 0) {
        pages = [{ page_number: 1, text: `Document: ${doc.file_name}\nURL: ${doc.file_url}` }];
      }

      // 3. Store pages
      // Clear existing pages for idempotency (re-processing)
      await supabase.from("juristlens_pages").delete().eq("document_id", document_id);
      const pageRows = pages.map((p) => ({
        document_id,
        page_number: p.page_number,
        text_content: p.text,
      }));
      await supabase.from("juristlens_pages").insert(pageRows);

      // Calculate word count
      const totalWords = pages.reduce((acc, p) => acc + p.text.split(/\s+/).length, 0);
      await supabase.from("juristlens_documents").update({
        page_count: pages.length,
        word_count: totalWords,
      }).eq("id", document_id);

      // 4. Combine text for AI
      const combinedText = pages
        .map((p) => `--- PAGE ${p.page_number} ---\n${p.text}`)
        .join("\n\n")
        .slice(0, 50000);

      // 5. AI clause extraction (with retry)
      let aiContent = "[]";
      try {
        const aiRes = await fetchWithRetry(
          "https://ai.gateway.lovable.dev/v1/chat/completions",
          {
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
                  content: `You are a legal document analyst. Extract all important clauses from the following document.

For each clause, return:
- title: Concise clause title
- text: EXACT verbatim text from the document
- clause_type: One of: termination, payment, liability, indemnity, confidentiality, non_compete, force_majeure, dispute_resolution, governing_law, warranty, intellectual_property, data_protection, assignment, amendment, notice, insurance, representations, obligations, rights, other
- risk_level: "high", "medium", or "low"
- explanation: Brief explanation of implications
- recommendation: Actionable legal recommendation
- page_number: Page number (from PAGE markers)

Return ONLY valid JSON array. No markdown. Format: [{"title":"...","text":"...","clause_type":"...","risk_level":"...","explanation":"...","recommendation":"...","page_number":1}]

Extract 8-20 clauses. Prioritize high-risk clauses.`,
                },
                {
                  role: "user",
                  content: `Analyze this legal document:\n\n${combinedText}`,
                },
              ],
              temperature: 0.2,
              max_tokens: 8000,
            }),
          }
        );

        if (!aiRes.ok) throw new Error(`AI returned ${aiRes.status}`);
        const aiData = await aiRes.json();
        aiContent = aiData.choices?.[0]?.message?.content || "[]";
      } catch (e: any) {
        console.error("AI extraction failed:", e.message);
        await supabase.from("juristlens_documents").update({
          status: "failed",
          error_msg: `AI extraction failed: ${e.message}`,
        }).eq("id", document_id);
        throw new Error("AI extraction failed after retries");
      }

      // 6. Parse AI response
      aiContent = aiContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      let clauses: any[] = [];
      try {
        clauses = JSON.parse(aiContent);
      } catch {
        const match = aiContent.match(/\[[\s\S]*\]/);
        if (match) {
          try { clauses = JSON.parse(match[0]); } catch {}
        }
      }

      // 7. Map offsets and store clauses
      if (clauses.length > 0) {
        // Clear existing clauses for idempotency
        await supabase.from("juristlens_clauses").delete().eq("document_id", document_id);

        const clauseRows = clauses.map((c: any) => {
          const pageNum = c.page_number || 1;
          const page = pages.find((p) => p.page_number === pageNum);
          const offsets = page
            ? mapClauseOffsets(c.text || "", page.text)
            : { startOffset: 0, endOffset: 0, matchQuality: "page_only" };

          return {
            document_id,
            title: c.title || "Untitled Clause",
            text: c.text || "",
            clause_type: c.clause_type || "other",
            risk_level: c.risk_level || "low",
            explanation: c.explanation || "",
            recommendation: c.recommendation || "",
            page_number: pageNum,
            start_offset: offsets.startOffset,
            end_offset: offsets.endOffset,
            match_quality: offsets.matchQuality,
          };
        });

        await supabase.from("juristlens_clauses").insert(clauseRows);
      }

      // 8. Mark complete
      const processingTime = Date.now() - startTime;
      console.log(`[JuristLens] Document ${document_id} processed in ${processingTime}ms, ${clauses.length} clauses`);

      await supabase.from("juristlens_documents").update({
        status: "completed",
        error_msg: null,
      }).eq("id", document_id);

      return new Response(
        JSON.stringify({ success: true, clause_count: clauses.length, processing_time_ms: processingTime }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // RAG CHAT
    // ═══════════════════════════════════════════════════════════════════════════
    if (action === "chat") {
      const { question, clause_ids, chat_history } = body;

      const { data: doc } = await supabase
        .from("juristlens_documents")
        .select("*")
        .eq("id", document_id)
        .single();

      const { data: clauses } = await supabase
        .from("juristlens_clauses")
        .select("*")
        .eq("document_id", document_id);

      const relevantClauses = clause_ids?.length
        ? clauses?.filter((c: any) => clause_ids.includes(c.id))
        : clauses;

      const clauseContext = (relevantClauses || [])
        .map((c: any, i: number) =>
          `[Clause ${i + 1}: "${c.title}" (${c.risk_level} risk, Page ${c.page_number})]\n${c.text}\nExplanation: ${c.explanation}`
        )
        .join("\n\n");

      // Sliding window: limit context
      const recentHistory = (chat_history || []).slice(-10);

      const messages: any[] = [
        {
          role: "system",
          content: `You are JuristLens AI, an expert legal document analyst. You are analyzing "${doc?.file_name || "unknown"}".

Extracted clauses:

${clauseContext}

Instructions:
1. Reference specific clauses as [[Clause: clause_title]]
2. Be precise, cite specific text
3. Highlight risks and provide actionable recommendations
4. Be professional and suitable for legal professionals`,
        },
        ...recentHistory.map((m: any) => ({ role: m.role, content: m.content })),
        { role: "user", content: question },
      ];

      const aiRes = await fetchWithRetry(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
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
        }
      );

      if (!aiRes.ok) throw new Error("AI chat failed");

      const aiData = await aiRes.json();
      const answer = aiData.choices?.[0]?.message?.content || "No response generated.";

      // Extract clause references
      const clauseRefs: string[] = [];
      const refPattern = /\[\[Clause: ([^\]]+)\]\]/g;
      let match;
      while ((match = refPattern.exec(answer)) !== null) {
        clauseRefs.push(match[1]);
      }

      const referencedClauses = (clauses || [])
        .filter((c: any) => clauseRefs.some((ref) => c.title.includes(ref) || ref.includes(c.title)))
        .map((c: any) => ({ id: c.id, title: c.title, page_number: c.page_number }));

      return new Response(
        JSON.stringify({ answer, referenced_clauses: referencedClauses }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // GENERATE REPORT (proxy to Render)
    // ═══════════════════════════════════════════════════════════════════════════
    if (action === "generate_report") {
      const { data: doc } = await supabase
        .from("juristlens_documents")
        .select("*")
        .eq("id", document_id)
        .single();

      const { data: clauses } = await supabase
        .from("juristlens_clauses")
        .select("*")
        .eq("document_id", document_id)
        .order("page_number");

      try {
        const res = await fetchWithRetry(
          `${RENDER_BASE}/export`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": authHeader,
            },
            body: JSON.stringify({
              document_name: doc?.file_name,
              clauses: (clauses || []).map((c: any) => ({
                title: c.title,
                text: c.text,
                risk_level: c.risk_level,
                clause_type: c.clause_type,
                explanation: c.explanation,
                recommendation: c.recommendation,
                page_number: c.page_number,
              })),
              format: "pdf",
            }),
          }
        );

        if (!res.ok) throw new Error("Report generation failed");
        const data = await res.json();
        return new Response(JSON.stringify(data), { headers: { ...CORS, "Content-Type": "application/json" } });
      } catch {
        throw new Error("Report generation failed");
      }
    }

    throw new Error("Invalid action");
  } catch (e: any) {
    console.error("[JuristLens Error]:", e.message);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
