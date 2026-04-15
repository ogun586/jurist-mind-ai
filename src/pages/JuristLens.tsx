import { useState, useRef, useCallback, useEffect } from "react";
import {
  Search, Upload, FileText, X, Loader2, Download,
  Eye, MessageSquare, Sparkles, BookOpen, Share2, MoreVertical, Pencil
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Navigate } from "react-router-dom";
import { useJuristLensStore, JLDocument, JLClause } from "@/stores/juristLensStore";
import JLSidebar from "@/components/juristlens/JLSidebar";
import JLInsightsPanel from "@/components/juristlens/JLInsightsPanel";
import JLChatPanel from "@/components/juristlens/JLChatPanel";
import JLDocumentViewer from "@/components/juristlens/JLDocumentViewer";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { cn } from "@/lib/utils";

// ── Upload Screen ─────────────────────────────────────────────────────────────
function UploadScreen() {
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    setCurrentDocument, setExtractedClauses, setParsedPages,
    setProcessingStatus, currentDocument,
  } = useJuristLensStore();

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    if (!user) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "docx"].includes(ext || "")) {
      toast({ description: "Only PDF and DOCX files are supported.", variant: "destructive" });
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast({ description: "File too large. Maximum size is 50MB.", variant: "destructive" });
      return;
    }

    setUploading(true);
    setProcessingStatus("uploading");

    try {
      const path = `${user.id}/${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from("juristlens-documents")
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from("juristlens-documents")
        .getPublicUrl(uploadData.path);

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

      setCurrentDocument(docData as JLDocument);
      setProcessingStatus("processing");

      // Subscribe to realtime for status updates
      const channel = supabase
        .channel(`doc-${docData.id}`)
        .on("postgres_changes", {
          event: "UPDATE",
          schema: "public",
          table: "juristlens_documents",
          filter: `id=eq.${docData.id}`,
        }, async (payload: any) => {
          const updated = payload.new;
          if (updated.status === "completed") {
            const [clauseRes, pageRes] = await Promise.all([
              supabase.from("juristlens_clauses").select("*").eq("document_id", docData.id).order("page_number"),
              supabase.from("juristlens_pages").select("*").eq("document_id", docData.id).order("page_number"),
            ]);
            setExtractedClauses((clauseRes.data as JLClause[]) || []);
            setParsedPages(pageRes.data || []);
            setCurrentDocument(updated as JLDocument);
            setProcessingStatus("completed");
            toast({ title: "Analysis Complete", description: `Found ${clauseRes.data?.length || 0} clauses.` });
            supabase.removeChannel(channel);
          } else if (updated.status === "failed") {
            setProcessingStatus("failed");
            toast({ description: updated.error_msg || "Analysis failed.", variant: "destructive" });
            supabase.removeChannel(channel);
          }
        })
        .subscribe();

      // Trigger processing
      const { error: extractErr } = await supabase.functions.invoke("process-juristlens", {
        body: { document_id: docData.id, action: "extract_clauses" },
      });

      if (extractErr) {
        console.error("Extraction error:", extractErr);
        // Don't immediately fail — the realtime subscription may still catch a result
        // But if the edge function itself failed, load fallback
        setTimeout(async () => {
          const { data: checkDoc } = await supabase
            .from("juristlens_documents")
            .select("status")
            .eq("id", docData.id)
            .single();

          if (checkDoc?.status === "completed") {
            const [clauseRes, pageRes] = await Promise.all([
              supabase.from("juristlens_clauses").select("*").eq("document_id", docData.id).order("page_number"),
              supabase.from("juristlens_pages").select("*").eq("document_id", docData.id).order("page_number"),
            ]);
            setExtractedClauses((clauseRes.data as JLClause[]) || []);
            setParsedPages(pageRes.data || []);
            setProcessingStatus("completed");
          } else if (checkDoc?.status !== "processing") {
            setProcessingStatus("failed");
            toast({ description: "Document analysis failed. Please try again.", variant: "destructive" });
          }
        }, 3000);
      }
    } catch (err: any) {
      console.error(err);
      setProcessingStatus("failed");
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }, [user]);

  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <div className="max-w-lg w-full space-y-8 text-center">
        <div>
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
              <Search className="w-5 h-5 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">JuristLens</h1>
          <p className="text-sm text-muted-foreground mt-1">Upload a legal document for AI-powered analysis</p>
        </div>

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

// ── Analysis View ─────────────────────────────────────────────────────────────
function AnalysisView() {
  const {
    activeTab, setActiveTab, currentDocument, extractedClauses,
    resetState,
  } = useJuristLensStore();
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);

  const high = extractedClauses.filter((c) => c.risk_level === "high").length;
  const wordCount = extractedClauses.reduce((acc, c) => acc + c.text.split(/\s+/).length, 0);

  const handleExport = async () => {
    if (!currentDocument) return;
    setExporting(true);
    try {
      const res = await supabase.functions.invoke("process-juristlens", {
        body: {
          document_id: currentDocument.id,
          action: "generate_report",
        },
      });
      if (res.error) throw res.error;

      // If we get a download URL
      if (res.data?.download_url) {
        window.open(res.data.download_url, "_blank");
      } else {
        toast({ description: "Report generation is processing. Please try again shortly." });
      }
    } catch {
      toast({ description: "Report generation failed.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50 bg-card/80 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-semibold text-foreground truncate max-w-[300px]">
            {currentDocument?.file_name}
          </span>
          <button className="p-1 text-muted-foreground hover:text-foreground transition-colors">
            <Pencil className="w-3 h-3" />
          </button>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Status badge */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold text-[10px]">
              Analysis Complete
            </span>
            <span>{extractedClauses.length} clauses</span>
            <span>·</span>
            <span>{high} high risk</span>
            <span>·</span>
            <span>{wordCount.toLocaleString()} words</span>
          </div>

          <div className="w-px h-5 bg-border/30" />

          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {exporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
            Download Report
          </button>

          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border/50 text-muted-foreground hover:text-foreground transition-all">
            <Share2 className="w-3 h-3" />
            Share
          </button>

          <button className="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Three-pane layout */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          {/* Center: Review/Chat */}
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="h-full flex flex-col">
              {/* Tab switcher */}
              <div className="flex items-center gap-1 px-3 py-2 border-b border-border/30 flex-shrink-0">
                {(["review", "insights", "chat"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "px-4 py-2 rounded-lg text-xs font-semibold transition-all capitalize",
                      activeTab === tab
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                  >
                    {tab === "review" ? "Review" : tab === "insights" ? "Insights" : "Chat"}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-hidden">
                {activeTab === "chat" ? <JLChatPanel /> : <JLInsightsPanel />}
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right: Document Viewer */}
          <ResizablePanel defaultSize={50} minSize={30}>
            <JLDocumentViewer />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function JuristLens() {
  const { user, loading: authLoading } = useAuth();
  const { currentDocument, processingStatus } = useJuristLensStore();

  if (authLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  const showAnalysis = currentDocument && (processingStatus === "completed" || processingStatus === "processing");

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      {/* Left sidebar */}
      <div className="w-[240px] flex-shrink-0">
        <JLSidebar />
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        {showAnalysis ? <AnalysisView /> : <UploadScreen />}
      </div>
    </div>
  );
}
