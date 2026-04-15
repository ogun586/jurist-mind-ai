import { useEffect, useState } from "react";
import {
  Search, Plus, Home, MessageSquare, FileText,
  ChevronDown, Sparkles, CheckCircle, Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useJuristLensStore, JLDocument } from "@/stores/juristLensStore";
import { cn } from "@/lib/utils";

function StatusDot({ status }: { status: string }) {
  if (status === "completed") return <div className="w-2 h-2 rounded-full bg-emerald-400" />;
  if (status === "processing") return <Loader2 className="w-3 h-3 text-primary animate-spin" />;
  if (status === "failed") return <div className="w-2 h-2 rounded-full bg-red-400" />;
  return <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />;
}

export default function JLSidebar() {
  const { user } = useAuth();
  const {
    currentDocument, previousDocuments, setPreviousDocuments,
    setCurrentDocument, setExtractedClauses, setParsedPages,
    setProcessingStatus, resetState, setActiveTab,
  } = useJuristLensStore();
  const [sortBy, setSortBy] = useState<"recent" | "name">("recent");

  useEffect(() => {
    if (!user) return;
    const fetchDocs = async () => {
      const { data } = await supabase
        .from("juristlens_documents")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (data) setPreviousDocuments(data as JLDocument[]);
    };
    fetchDocs();
  }, [user, currentDocument]);

  const loadDocument = async (doc: JLDocument) => {
    resetState();
    setCurrentDocument(doc);
    setProcessingStatus(doc.status === "completed" ? "completed" : doc.status as any);

    if (doc.status === "completed") {
      const [clauseRes, pageRes] = await Promise.all([
        supabase.from("juristlens_clauses").select("*").eq("document_id", doc.id).order("page_number"),
        supabase.from("juristlens_pages").select("*").eq("document_id", doc.id).order("page_number"),
      ]);
      setExtractedClauses((clauseRes.data as any[]) || []);
      setParsedPages((pageRes.data as any[]) || []);
    }
  };

  const sorted = [...previousDocuments].sort((a, b) => {
    if (sortBy === "name") return a.file_name.localeCompare(b.file_name);
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return `${Math.floor(days / 7)}w ago`;
  };

  return (
    <div className="h-full flex flex-col bg-[hsl(240,18%,7%)] border-r border-border/30">
      {/* Header */}
      <div className="p-4 flex-shrink-0">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
            <Search className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="text-base font-bold text-foreground tracking-tight">JuristLens</span>
        </div>

        <button
          onClick={() => resetState()}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-sm font-semibold hover:opacity-90 transition-all shadow-md"
        >
          <Plus className="w-4 h-4" />
          New Review
        </button>
      </div>

      {/* Navigation */}
      <nav className="px-3 space-y-0.5 flex-shrink-0">
        {[
          { icon: Home, label: "Home", action: () => resetState() },
          { icon: Search, label: "Search", action: () => {} },
          { icon: MessageSquare, label: "Chat with JuristLens", action: () => { if (currentDocument) setActiveTab("chat"); } },
        ].map(({ icon: Icon, label, action }) => (
          <button
            key={label}
            onClick={action}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all"
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </nav>

      {/* My Reviews */}
      <div className="flex-1 overflow-hidden flex flex-col mt-4">
        <div className="flex items-center justify-between px-4 mb-2">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">My Reviews</span>
          <button
            onClick={() => setSortBy(sortBy === "recent" ? "name" : "recent")}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {sortBy === "recent" ? "Recent" : "Name"}
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
          {sorted.map((doc) => (
            <button
              key={doc.id}
              onClick={() => loadDocument(doc)}
              className={cn(
                "w-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all group",
                currentDocument?.id === doc.id
                  ? "bg-primary/10 border border-primary/20"
                  : "hover:bg-accent/50"
              )}
            >
              <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-xs font-medium truncate",
                  currentDocument?.id === doc.id ? "text-primary" : "text-foreground"
                )}>
                  {doc.file_name}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <StatusDot status={doc.status} />
                  <span className="text-[10px] text-muted-foreground">
                    {doc.status === "completed" ? "Reviewed" : doc.status === "processing" ? "Processing" : doc.status === "failed" ? "Failed" : "Pending"}{" "}
                    {timeAgo(doc.created_at)}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Upgrade card */}
      <div className="p-3 flex-shrink-0">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold text-primary">Upgrade to Pro</span>
          </div>
          <ul className="space-y-1.5 mb-3">
            {["Unlimited Reviews", "Advanced AI Models", "Custom Templates", "Priority Support"].map((f) => (
              <li key={f} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <CheckCircle className="w-3 h-3 text-primary/60" />
                {f}
              </li>
            ))}
          </ul>
          <button className="w-full py-2 rounded-lg bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-xs font-bold hover:opacity-90 transition-all">
            Upgrade Now
          </button>
        </div>
      </div>
    </div>
  );
}
