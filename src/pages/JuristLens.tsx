import { useState, useRef, useCallback } from "react";
import {
  Search, Upload, FileText, X, ChevronDown, ChevronUp,
  Copy, Check, Download, Eye, Plus, Loader2, AlertTriangle,
  BookOpen, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Navigate } from "react-router-dom";
import PDFViewerModal from "@/components/juristlens/PDFViewerModal";

// ── Types ────────────────────────────────────────────────────────────────────
interface UploadedDoc {
  file: File;
  name: string;
  url: string;
  included: boolean;
}

interface ClauseResult {
  document_name: string;
  answer: string;
  clause: string | null;
  page: number | null;
  confidence?: string;
}

interface QAEntry {
  question: string;
  results: ClauseResult[];
  loading: boolean;
  collapsed: boolean;
}

// ── Templates ────────────────────────────────────────────────────────────────
const TEMPLATES: Record<string, string> = {
  "Contract Review":
    "What are the termination conditions?\nWhat are the payment terms?\nAre there any penalty clauses?\nWhat are the governing law and jurisdiction clauses?",
  "Lease Agreement Review":
    "What is the lease duration and renewal terms?\nWhat are the rent escalation clauses?\nWhat are the tenant's obligations?\nAre there any early termination penalties?",
  "Employment Contract Review":
    "What is the notice period for resignation or termination?\nAre there non-compete or confidentiality clauses?\nWhat are the compensation and bonus terms?\nWhat are the grounds for immediate dismissal?",
  "Partnership Agreement Review":
    "How are profits and losses distributed?\nWhat are the exit provisions for partners?\nHow are disputes resolved?\nWhat are each partner's capital contribution obligations?",
  "Start from Scratch": "",
};

// ── Pulsing bar component ─────────────────────────────────────────────────────
function ProcessingBar({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="w-full h-0.5 rounded-full overflow-hidden bg-muted mb-4">
      <div
        className="h-full rounded-full bg-primary"
        style={{
          animation: "juristlens-bar 1.6s ease-in-out infinite",
          width: "40%",
        }}
      />
      <style>{`
        @keyframes juristlens-bar {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </div>
  );
}

// ── Doc Card ─────────────────────────────────────────────────────────────────
function DocCard({
  doc,
  compact = false,
  onRemove,
  onToggle,
}: {
  doc: UploadedDoc;
  compact?: boolean;
  onRemove: () => void;
  onToggle?: () => void;
}) {
  const ext = doc.name.split(".").pop()?.toLowerCase();
  const isPDF = ext === "pdf";

  return (
    <div
      className={`relative flex items-center gap-3 rounded-xl border transition-all ${
        compact ? "p-3 min-w-[180px]" : "p-4"
      } ${
        doc.included
          ? "border-primary/30 bg-card shadow-gold"
          : "border-border/50 bg-card/50 opacity-60"
      }`}
    >
      {/* Checkbox (multi mode) */}
      {onToggle && (
        <button
          onClick={onToggle}
          className={`absolute top-2 left-2 w-4 h-4 rounded border flex items-center justify-center transition-all ${
            doc.included
              ? "border-primary bg-primary"
              : "border-muted-foreground/40 bg-transparent"
          }`}
        >
          {doc.included && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
        </button>
      )}

      {/* File icon */}
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isPDF ? "bg-red-500/15 text-red-400" : "bg-blue-500/15 text-blue-400"
        }`}
      >
        <FileText className="w-5 h-5" />
      </div>

      {/* Meta */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{doc.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5 uppercase tracking-wider">{ext}</p>
      </div>

      {/* Remove */}
      <button
        onClick={onRemove}
        className="p-1 rounded-md text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent transition-all flex-shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Clause Card ───────────────────────────────────────────────────────────────
function ClauseCard({
  result,
  onViewInDoc,
}: {
  result: ClauseResult;
  onViewInDoc: (docName: string, page: number) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (result.clause) {
      navigator.clipboard.writeText(result.clause);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const hasClause = !!result.clause;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden animate-fade-in-up"
         style={{ borderLeft: "3px solid hsl(var(--primary))" }}>
      {/* Answer */}
      <div className="p-4">
        {result.document_name && (
          <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-2">
            {result.document_name}
          </p>
        )}
        <p className="text-sm text-foreground leading-relaxed">{result.answer}</p>
      </div>

      {hasClause && (
        <>
          <div className="mx-4 h-px bg-border/50" />

          {/* Source clause */}
          <div className="p-4">
            <p className="text-[10px] font-bold text-primary uppercase tracking-[0.15em] mb-2">
              Source Clause
            </p>
            <div
              className="rounded-lg p-3 text-sm leading-relaxed italic"
              style={{
                background: "hsla(42, 60%, 53%, 0.07)",
                borderLeft: "2px solid hsla(42, 60%, 53%, 0.4)",
                color: "hsl(42, 70%, 75%)",
              }}
            >
              "{result.clause}"
            </div>
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-muted-foreground">
                {result.page ? `Page ${result.page}` : ""}
                {result.confidence && (
                  <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary">
                    {result.confidence} confidence
                  </span>
                )}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
                  title="Copy clause"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                {result.page && (
                  <button
                    onClick={() => onViewInDoc(result.document_name, result.page!)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-primary text-primary-foreground btn-lift btn-press"
                  >
                    <Eye className="w-3 h-3" />
                    View in Document
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── QA Block ─────────────────────────────────────────────────────────────────
function QABlock({
  entry,
  docs,
  onViewInDoc,
  onToggleCollapse,
}: {
  entry: QAEntry;
  docs: UploadedDoc[];
  onViewInDoc: (docName: string, page: number) => void;
  onToggleCollapse: () => void;
}) {
  return (
    <div className="mb-6 animate-fade-in-up">
      {/* Question header */}
      <button
        onClick={onToggleCollapse}
        className="w-full flex items-center justify-between gap-3 mb-3 text-left group"
      >
        <div className="flex items-start gap-2">
          <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Search className="w-2.5 h-2.5 text-primary" />
          </div>
          <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
            {entry.question}
          </p>
        </div>
        {entry.collapsed
          ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          : <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
      </button>

      {!entry.collapsed && (
        entry.loading ? (
          <div className="flex items-center gap-3 py-6 px-4 rounded-xl border border-border bg-card/50">
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-primary"
                  style={{ animation: `typingDot 1.4s ease-in-out ${i * 0.2}s infinite` }}
                />
              ))}
            </div>
            <p className="text-sm text-muted-foreground">JuristLens is reading your document…</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entry.results.map((r, i) => (
              <ClauseCard key={i} result={r} onViewInDoc={onViewInDoc} />
            ))}
          </div>
        )
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function JuristLens() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [mode, setMode] = useState<"single" | "multi">("single");
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [question, setQuestion] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [qaEntries, setQaEntries] = useState<QAEntry[]>([]);
  const [processing, setProcessing] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [slowWarning, setSlowWarning] = useState(false);
  const [pdfViewer, setPdfViewer] = useState<{ url: string; page: number; name: string } | null>(null);
  const [exporting, setExporting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const slowTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Auth guard ──────────────────────────────────────────────────────────────
  if (authLoading) return (
    <div className="h-full flex items-center justify-center bg-background">
      <Loader2 className="w-6 h-6 text-primary animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/auth" replace />;

  // ── Upload handler ──────────────────────────────────────────────────────────
  const uploadFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (!arr.length) return;

    if (mode === "single" && arr.length > 1) {
      toast({ description: "Single mode accepts one file at a time.", variant: "destructive" });
      return;
    }

    setUploading(true);
    const newDocs: UploadedDoc[] = [];

    for (const file of arr) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!["pdf", "docx"].includes(ext || "")) {
        toast({ description: `${file.name}: unsupported format (PDF or DOCX only).`, variant: "destructive" });
        continue;
      }

      const path = `${user.id}/${Date.now()}_${file.name}`;
      const { data, error } = await supabase.storage
        .from("juristlens-documents")
        .upload(path, file, { upsert: true });

      if (error) {
        toast({ title: "Upload failed", description: file.name, variant: "destructive" });
        continue;
      }

      const { data: urlData } = supabase.storage
        .from("juristlens-documents")
        .getPublicUrl(data.path);

      newDocs.push({ file, name: file.name, url: urlData.publicUrl, included: true });
    }

    if (mode === "single") {
      setDocs(newDocs.slice(0, 1));
    } else {
      setDocs(prev => [...prev, ...newDocs]);
    }

    setUploading(false);
    setQaEntries([]);
    setSessionId(null);
  };

  // ── Drag & drop ─────────────────────────────────────────────────────────────
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    uploadFiles(e.dataTransfer.files);
  }, [mode, user]);

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  // ── Template select ─────────────────────────────────────────────────────────
  const handleTemplate = (name: string) => {
    setSelectedTemplate(name);
    setQuestion(TEMPLATES[name]);
  };

  // ── Ensure session ──────────────────────────────────────────────────────────
  const ensureSession = async (): Promise<string> => {
    if (sessionId) return sessionId;

    const includedDocs = docs.filter(d => d.included);
    const { data, error } = await supabase
      .from("juristlens_sessions")
      .insert({
        lawyer_id: user!.id,
        mode,
        document_urls: includedDocs.map(d => d.url),
        document_names: includedDocs.map(d => d.name),
        document_url: mode === "single" ? includedDocs[0]?.url : null,
        document_name: mode === "single" ? includedDocs[0]?.name : null,
      })
      .select("session_id")
      .single();

    if (error || !data) throw new Error("Failed to create session");
    setSessionId(data.session_id);
    return data.session_id;
  };

  // ── Ask ─────────────────────────────────────────────────────────────────────
  const handleAsk = async () => {
    const includedDocs = docs.filter(d => d.included);
    if (!includedDocs.length) {
      toast({ description: "Please upload a document first.", variant: "destructive" }); return;
    }
    if (!question.trim()) {
      toast({ description: "Please enter a question.", variant: "destructive" }); return;
    }

    const q = question.trim();
    const idx = qaEntries.length;

    setQaEntries(prev => [...prev, { question: q, results: [], loading: true, collapsed: false }]);
    setProcessing(true);
    setSlowWarning(false);

    slowTimerRef.current = setTimeout(() => setSlowWarning(true), 5000);

    try {
      const sid = await ensureSession();

      const body =
        mode === "single"
          ? {
              mode: "single",
              document_url: includedDocs[0].url,
              document_name: includedDocs[0].name,
              question: q,
              session_id: sid,
              lawyer_id: user!.id,
            }
          : {
              mode: "multi",
              documents: includedDocs.map(d => ({ document_url: d.url, document_name: d.name })),
              question: q,
              session_id: sid,
              lawyer_id: user!.id,
            };

      const res = await fetch("https://juristmind.onrender.com/api/juristlens/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Backend error");

      const data = await res.json();

      const results: ClauseResult[] =
        mode === "single"
          ? [{ document_name: includedDocs[0].name, answer: data.answer, clause: data.clause, page: data.page, confidence: data.confidence }]
          : (data.results as ClauseResult[]);

      // Save to DB
      await supabase.from("juristlens_messages").insert({
        session_id: sid,
        question: q,
        answer: results[0]?.answer || "",
        clause: results[0]?.clause || null,
        page_number: results[0]?.page || null,
        document_name: results[0]?.document_name || null,
        confidence: results[0]?.confidence || null,
      });

      setQaEntries(prev =>
        prev.map((e, i) => i === idx ? { ...e, loading: false, results } : e)
      );
    } catch {
      setQaEntries(prev =>
        prev.map((e, i) =>
          i === idx
            ? {
                ...e, loading: false,
                results: [{ document_name: "", answer: "JuristLens couldn't process this document. Please check the file and try again.", clause: null, page: null }],
              }
            : e
        )
      );
      toast({ title: "Error", description: "Failed to analyse document.", variant: "destructive" });
    } finally {
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
      setProcessing(false);
      setSlowWarning(false);
    }
  };

  // ── Export ──────────────────────────────────────────────────────────────────
  const handleExport = async (format: "pdf" | "docx") => {
    if (!sessionId) return;
    setExporting(true);
    try {
      const res = await fetch("https://juristmind.onrender.com/api/juristlens/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, format }),
      });
      if (!res.ok) throw new Error();
      const { download_url } = await res.json();
      window.open(download_url, "_blank");
    } catch {
      toast({ description: "Export failed. Please try again.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  // ── View in Document ─────────────────────────────────────────────────────────
  const handleViewInDoc = (docName: string, page: number) => {
    const doc = docs.find(d => d.name === docName) || docs[0];
    if (doc) setPdfViewer({ url: doc.url, page, name: doc.name });
  };

  const includedDocs = docs.filter(d => d.included);
  const hasResults = qaEntries.some(e => !e.loading && e.results.length > 0);

  return (
    <div className="h-full overflow-y-auto chat-bg">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* ── Top bar ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-gradient-primary flex items-center justify-center shadow-gold">
                <Search className="w-4 h-4 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">JuristLens</h1>
            </div>
            <p className="text-sm text-muted-foreground ml-10">
              Upload documents. Ask anything. Find every clause.
            </p>
          </div>

          {/* Export */}
          {hasResults && sessionId && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="relative group">
                <button
                  disabled={exporting}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-primary text-primary-foreground text-sm font-semibold btn-lift btn-press disabled:opacity-60"
                >
                  {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Export
                  <ChevronDown className="w-3 h-3" />
                </button>
                <div className="absolute right-0 top-full mt-1 w-36 rounded-xl border border-border bg-card shadow-lg overflow-hidden opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-20">
                  <button onClick={() => handleExport("pdf")} className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-accent transition-colors">Export as PDF</button>
                  <button onClick={() => handleExport("docx")} className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-accent transition-colors">Export as DOCX</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Mode toggle ── */}
        <div className="flex p-1 rounded-xl bg-secondary w-fit gap-1">
          {(["single", "multi"] as const).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setDocs([]); setQaEntries([]); setSessionId(null); }}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                mode === m
                  ? "bg-gradient-primary text-primary-foreground shadow-gold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "single" ? "Single Review" : "Multi Review"}
            </button>
          ))}
        </div>

        {/* ── Upload zone ── */}
        {docs.length === 0 ? (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            className="relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-primary/40 bg-card/50 cursor-pointer transition-all hover:border-primary/70 hover:bg-card min-h-[220px] group"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
              {uploading
                ? <Loader2 className="w-8 h-8 text-primary animate-spin" />
                : <div className="relative">
                    <FileText className="w-8 h-8 text-primary" />
                    <Search className="w-4 h-4 text-primary absolute -bottom-1 -right-1" />
                  </div>
              }
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-foreground">
                {mode === "single" ? "Drag your document here or click to upload" : "Drag multiple documents here or click to upload"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Accepted formats: PDF, DOCX</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx"
              multiple={mode === "multi"}
              className="hidden"
              onChange={e => e.target.files && uploadFiles(e.target.files)}
            />
          </div>
        ) : (
          <div>
            {mode === "single" ? (
              <DocCard
                doc={docs[0]}
                onRemove={() => { setDocs([]); setQaEntries([]); setSessionId(null); }}
              />
            ) : (
              <div>
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                  {docs.map((doc, i) => (
                    <DocCard
                      key={i}
                      doc={doc}
                      compact
                      onRemove={() => setDocs(prev => prev.filter((_, j) => j !== i))}
                      onToggle={() => setDocs(prev => prev.map((d, j) => j === i ? { ...d, included: !d.included } : d))}
                    />
                  ))}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-shrink-0 flex flex-col items-center justify-center gap-1 w-[100px] h-[80px] rounded-xl border-2 border-dashed border-primary/30 text-primary/60 hover:border-primary/60 hover:text-primary transition-all"
                  >
                    <Plus className="w-5 h-5" />
                    <span className="text-xs font-medium">Add More</span>
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx"
                  multiple
                  className="hidden"
                  onChange={e => e.target.files && uploadFiles(e.target.files)}
                />
                {includedDocs.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    <span className="text-primary font-semibold">{includedDocs.length}</span> document{includedDocs.length !== 1 ? "s" : ""} selected for review
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Template pills ── */}
        {docs.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.1em]">Review Templates</p>
            <div className="flex flex-wrap gap-2">
              {Object.keys(TEMPLATES).map(t => (
                <button
                  key={t}
                  onClick={() => handleTemplate(t)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    selectedTemplate === t
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Question input ── */}
        {docs.length > 0 && (
          <div className="space-y-3">
            <div className="chat-input-glass rounded-2xl overflow-hidden">
              <textarea
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey && !processing) {
                    e.preventDefault();
                    handleAsk();
                  }
                }}
                placeholder={
                  mode === "single"
                    ? "Ask anything about this document… e.g. What are the termination conditions?"
                    : "Ask across all selected documents… e.g. Which contracts have automatic renewal clauses?"
                }
                rows={3}
                className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 px-4 pt-3 pb-0 resize-none focus:outline-none leading-relaxed"
              />
              <div className="flex items-center justify-between px-4 py-3">
                <p className="text-xs text-muted-foreground/40">Press Enter to ask, Shift+Enter for new line</p>
                <button
                  onClick={handleAsk}
                  disabled={processing || !question.trim()}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-primary text-primary-foreground text-sm font-semibold btn-lift btn-press disabled:opacity-50 disabled:cursor-not-allowed shadow-gold"
                >
                  {processing ? (
                    <>
                      <div className="flex gap-1">
                        {[0, 1, 2].map(i => (
                          <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary-foreground"
                               style={{ animation: `typingDot 1.4s ease-in-out ${i * 0.2}s infinite` }} />
                        ))}
                      </div>
                      <span>JuristLens is reading…</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Ask JuristLens
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Slow warning */}
            {slowWarning && (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-400 text-xs animate-fade-in">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                Large document detected — this may take a moment…
              </div>
            )}
          </div>
        )}

        {/* ── Results ── */}
        {qaEntries.length > 0 && (
          <div className="space-y-1">
            <ProcessingBar show={processing} />
            {qaEntries.map((entry, i) => (
              <QABlock
                key={i}
                entry={entry}
                docs={docs}
                onViewInDoc={handleViewInDoc}
                onToggleCollapse={() =>
                  setQaEntries(prev =>
                    prev.map((e, j) => j === i ? { ...e, collapsed: !e.collapsed } : e)
                  )
                }
              />
            ))}
          </div>
        )}

        {/* ── Empty state when no docs ── */}
        {docs.length === 0 && qaEntries.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-primary/40" />
            </div>
            <p className="text-sm text-muted-foreground max-w-xs">
              Upload a legal document to get started. JuristLens will analyse every clause and answer your questions instantly.
            </p>
          </div>
        )}

      </div>

      {/* ── PDF Viewer Modal ── */}
      {pdfViewer && (
        <PDFViewerModal
          url={pdfViewer.url}
          page={pdfViewer.page}
          name={pdfViewer.name}
          onClose={() => setPdfViewer(null)}
        />
      )}
    </div>
  );
}
