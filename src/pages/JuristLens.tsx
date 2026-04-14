import { useState, useRef, useCallback } from "react";
import {
  Search, Upload, FileText, X, Loader2, Download,
  Eye, MessageSquare, Sparkles, BookOpen, ChevronDown
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Navigate } from "react-router-dom";
import {
  JuristLensProvider, useJuristLens,
  JuristLensDocument, JuristLensClause
} from "@/contexts/JuristLensContext";
import InsightsPanel from "@/components/juristlens/InsightsPanel";
import ChatPanel from "@/components/juristlens/ChatPanel";
import DocumentViewerPanel from "@/components/juristlens/DocumentViewerPanel";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { cn } from "@/lib/utils";

// ── Upload Screen ─────────────────────────────────────────────────────────────
function UploadScreen() {
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    setCurrentDocument, setClauses, setPages,
    setProcessingStatus, currentDocument,
  } = useJuristLens();

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    if (!user) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "docx"].includes(ext || "")) {
      toast({ description: "Unsupported format. Use PDF or DOCX.", variant: "destructive" });
      return;
    }

    setUploading(true);
    setProcessingStatus("uploading");

    try {
      // Upload to storage
      const path = `${user.id}/${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from("juristlens-documents")
        .upload(path, file, { upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from("juristlens-documents")
        .getPublicUrl(uploadData.path);

      // Create session
      const { data: sessionData, error: sessionErr } = await supabase
        .from("juristlens_sessions")
        .insert({
          lawyer_id: user.id,
          mode: "single",
          document_url: urlData.publicUrl,
          document_name: file.name,
        })
        .select("session_id")
        .single();

      if (sessionErr) throw sessionErr;

      // Create document record
      const { data: docData, error: docErr } = await supabase
        .from("juristlens_documents")
        .insert({
          user_id: user.id,
          session_id: sessionData.session_id,
          file_url: urlData.publicUrl,
          file_name: file.name,
          file_type: ext || "pdf",
          file_path: uploadData.path,
          status: "pending",
        })
        .select()
        .single();

      if (docErr) throw docErr;

      setCurrentDocument(docData as JuristLensDocument);
      setProcessingStatus("processing");

      // Trigger clause extraction
      const { data: extractResult, error: extractErr } = await supabase.functions.invoke(
        "process-juristlens",
        {
          body: { document_id: docData.id, action: "extract_clauses" },
        }
      );

      if (extractErr) {
        console.error("Extraction error:", extractErr);
        setProcessingStatus("failed");
        toast({ description: "Document analysis failed. Please try again.", variant: "destructive" });
        return;
      }

      // Fetch extracted clauses
      const { data: clauseData } = await supabase
        .from("juristlens_clauses")
        .select("*")
        .eq("document_id", docData.id)
        .order("page_number", { ascending: true });

      // Fetch pages
      const { data: pageData } = await supabase
        .from("juristlens_pages")
        .select("*")
        .eq("document_id", docData.id)
        .order("page_number", { ascending: true });

      setClauses((clauseData as JuristLensClause[]) || []);
      setPages(pageData || []);

      // Update document status
      const { data: updatedDoc } = await supabase
        .from("juristlens_documents")
        .select()
        .eq("id", docData.id)
        .single();

      if (updatedDoc) setCurrentDocument(updatedDoc as JuristLensDocument);
      setProcessingStatus("completed");

      toast({
        title: "Analysis Complete",
        description: `Found ${clauseData?.length || 0} clauses in your document.`,
      });
    } catch (err: any) {
      console.error(err);
      setProcessingStatus("failed");
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) uploadFile(file);
    },
    [user]
  );

  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <div className="max-w-lg w-full space-y-8 text-center">
        {/* Header */}
        <div>
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
              <Search className="w-5 h-5 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">JuristLens</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload a legal document for AI-powered clause analysis
          </p>
        </div>

        {/* Upload zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-primary/40 bg-card/50 cursor-pointer transition-all hover:border-primary/70 hover:bg-card min-h-[200px] group"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
            {uploading ? (
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            ) : (
              <div className="relative">
                <FileText className="w-8 h-8 text-primary" />
                <Search className="w-4 h-4 text-primary absolute -bottom-1 -right-1" />
              </div>
            )}
          </div>
          <div>
            <p className="text-base font-semibold text-foreground">
              {uploading ? "Uploading..." : "Drop your document here or click to upload"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">PDF or DOCX • Max 50MB</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])}
          />
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: Eye, label: "Clause Detection", desc: "AI extracts every important clause" },
            { icon: Sparkles, label: "Risk Assessment", desc: "High/Medium/Low risk scoring" },
            { icon: MessageSquare, label: "AI Chat", desc: "Ask questions about your document" },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-card/30 border border-border/30">
              <Icon className="w-5 h-5 text-primary" />
              <p className="text-xs font-semibold text-foreground">{label}</p>
              <p className="text-[10px] text-muted-foreground text-center">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Analysis View (Three-Pane) ────────────────────────────────────────────────
function AnalysisView() {
  const { activePanel, setActivePanel, currentDocument, resetState, clauses } = useJuristLens();
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!currentDocument) return;
    setExporting(true);
    try {
      // Use the existing Render backend for export
      const res = await fetch("https://juristmind.onrender.com/api/juristlens/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document_name: currentDocument.file_name,
          clauses: clauses.map((c) => ({
            title: c.title,
            text: c.text,
            risk_level: c.risk_level,
            explanation: c.explanation,
            recommendation: c.recommendation,
            page_number: c.page_number,
          })),
          format: "pdf",
        }),
      });
      if (res.ok) {
        const { download_url } = await res.json();
        window.open(download_url, "_blank");
      } else {
        throw new Error("Export failed");
      }
    } catch {
      toast({ description: "Export failed. Please try again.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50 bg-card/80 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={resetState}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
          >
            ← New Document
          </button>
          <div className="w-px h-5 bg-border/50" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <Search className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold text-foreground">JuristLens</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {clauses.length > 0 && (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {exporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
              Download Report
            </button>
          )}
        </div>
      </div>

      {/* Three-pane layout */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          {/* Center: Insights/Chat */}
          <ResizablePanel defaultSize={45} minSize={30}>
            <div className="h-full flex flex-col">
              {/* Tab switcher */}
              <div className="flex items-center gap-1 p-2 border-b border-border/30">
                <button
                  onClick={() => setActivePanel("insights")}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all",
                    activePanel === "insights"
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <Eye className="w-3.5 h-3.5" />
                  Review
                  {clauses.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/20 text-[10px]">
                      {clauses.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActivePanel("chat")}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all",
                    activePanel === "chat"
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Chat
                </button>
              </div>

              {/* Panel content */}
              <div className="flex-1 overflow-hidden">
                {activePanel === "insights" ? <InsightsPanel /> : <ChatPanel />}
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right: Document Viewer */}
          <ResizablePanel defaultSize={55} minSize={30}>
            <DocumentViewerPanel />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
function JuristLensInner() {
  const { user, loading: authLoading } = useAuth();
  const { currentDocument, processingStatus } = useJuristLens();

  if (authLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  // Show upload screen when no document or still uploading
  if (!currentDocument || processingStatus === "idle") {
    return <UploadScreen />;
  }

  return <AnalysisView />;
}

export default function JuristLens() {
  return (
    <JuristLensProvider>
      <JuristLensInner />
    </JuristLensProvider>
  );
}
