import { useState, useRef, useEffect } from "react";
import {
  AlertTriangle, Shield, CheckCircle, Eye, MessageSquare,
  ChevronDown, ChevronUp, Copy, Check, Info, Filter,
  Bookmark, FileText
} from "lucide-react";
import { useJuristLensStore, JLClause } from "@/stores/juristLensStore";
import { cn } from "@/lib/utils";

function getRiskConfig(level: string) {
  switch (level) {
    case "high":
      return {
        icon: AlertTriangle,
        label: "High Risk",
        color: "text-red-400",
        bg: "bg-red-500/10",
        badge: "bg-red-500/15 text-red-400",
        accent: "border-l-red-500",
        cardBg: "bg-red-500/[0.03]",
      };
    case "medium":
      return {
        icon: Info,
        label: "Needs Review",
        color: "text-amber-400",
        bg: "bg-amber-500/10",
        badge: "bg-amber-500/15 text-amber-400",
        accent: "border-l-amber-500",
        cardBg: "bg-amber-500/[0.03]",
      };
    default:
      return {
        icon: CheckCircle,
        label: "Standard",
        color: "text-emerald-400",
        bg: "bg-emerald-500/10",
        badge: "bg-emerald-500/15 text-emerald-400",
        accent: "border-l-emerald-500",
        cardBg: "bg-emerald-500/[0.03]",
      };
  }
}

// ── Clause Card ───────────────────────────────────────────────────────────────
function ClauseCard({ clause, isSelected }: { clause: JLClause; isSelected: boolean }) {
  const { setSelectedClause, injectClauseToChat } = useJuristLensStore();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const risk = getRiskConfig(clause.risk_level);
  const RiskIcon = risk.icon;

  useEffect(() => {
    if (isSelected && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isSelected]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(clause.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      ref={cardRef}
      className={cn(
        "rounded-xl border-l-[3px] border bg-card transition-all cursor-pointer hover:shadow-md",
        risk.accent,
        isSelected
          ? "border-primary/50 ring-1 ring-primary/20 shadow-lg"
          : "border-border/50 hover:border-border"
      )}
      onClick={() => { setSelectedClause(clause); setExpanded(!expanded); }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider", risk.badge)}>
                <RiskIcon className="w-3 h-3" />
                {risk.label}
              </span>
              {clause.clause_type && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground capitalize">
                  {clause.clause_type.replace(/_/g, " ")}
                </span>
              )}
              <span className="text-[10px] text-muted-foreground font-medium ml-auto">
                Page {clause.page_number}
              </span>
            </div>
            <h4 className="text-sm font-semibold text-foreground leading-tight">{clause.title}</h4>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-all flex-shrink-0"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        <p className="text-xs text-muted-foreground mt-2 leading-relaxed line-clamp-2 italic">
          "{clause.text.slice(0, 180)}{clause.text.length > 180 ? "..." : ""}"
        </p>

        {clause.explanation && !expanded && (
          <p className="text-xs text-foreground/60 mt-2 leading-relaxed line-clamp-1">
            <span className="font-semibold text-muted-foreground">Why it matters: </span>
            {clause.explanation}
          </p>
        )}
      </div>

      {expanded && (
        <div className="border-t border-border/50">
          {clause.explanation && (
            <div className="px-4 py-3">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em] mb-1">
                Why it matters
              </p>
              <p className="text-xs text-foreground/80 leading-relaxed">{clause.explanation}</p>
            </div>
          )}

          {clause.recommendation && (
            <div className="px-4 py-2">
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.15em] mb-1">
                Recommendation
              </p>
              <p className="text-xs text-foreground/80 leading-relaxed">{clause.recommendation}</p>
            </div>
          )}

          <div className="flex items-center gap-2 px-4 py-3 border-t border-border/30">
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedClause(clause); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:opacity-90 transition-all"
            >
              <Eye className="w-3 h-3" />
              View in Document
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); injectClauseToChat(clause); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-primary/30 text-primary hover:bg-primary/10 transition-all"
            >
              <MessageSquare className="w-3 h-3" />
              Ask JuristLens
            </button>
            <button onClick={handleCopy} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-all ml-auto">
              {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <Bookmark className="w-3.5 h-3.5 text-muted-foreground hover:text-primary cursor-pointer transition-colors" />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Risk Summary Cards ────────────────────────────────────────────────────────
function RiskSummaryCards({ clauses }: { clauses: JLClause[] }) {
  const high = clauses.filter((c) => c.risk_level === "high").length;
  const medium = clauses.filter((c) => c.risk_level === "medium").length;
  const low = clauses.filter((c) => c.risk_level === "low").length;

  return (
    <div className="grid grid-cols-4 gap-3 mb-4">
      {[
        { count: high, label: "High Risk", icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
        { count: medium, label: "Needs Review", icon: Info, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
        { count: low, label: "Standard", icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
        { count: clauses.length, label: "Total Clauses", icon: FileText, color: "text-foreground", bg: "bg-muted", border: "border-border/50" },
      ].map(({ count, label, icon: Icon, color, bg, border }) => (
        <div key={label} className={cn("rounded-xl border p-3 flex flex-col items-center gap-1", bg, border)}>
          <Icon className={cn("w-5 h-5", color)} />
          <span className={cn("text-xl font-bold", color)}>{count}</span>
          <span className="text-[10px] text-muted-foreground font-medium text-center">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────
type RiskFilter = "all" | "high" | "medium" | "low";
type SortOption = "risk" | "page";

export default function JLInsightsPanel() {
  const { extractedClauses, selectedClause, processingStatus } = useJuristLensStore();
  const [filter, setFilter] = useState<RiskFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("risk");
  const [showMore, setShowMore] = useState(false);

  const filtered = filter === "all" ? extractedClauses : extractedClauses.filter((c) => c.risk_level === filter);

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "risk") {
      const order = { high: 0, medium: 1, low: 2 };
      return (order[a.risk_level] || 2) - (order[b.risk_level] || 2);
    }
    return a.page_number - b.page_number;
  });

  const INITIAL_SHOW = 9;
  const displayed = showMore ? sorted : sorted.slice(0, INITIAL_SHOW);
  const hasMore = sorted.length > INITIAL_SHOW;

  if (processingStatus === "processing") {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Shield className="w-7 h-7 text-primary animate-pulse" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">Analyzing Document…</p>
          <p className="text-xs text-muted-foreground mt-1">Extracting clauses and assessing risks</p>
        </div>
        <div className="w-48 h-1.5 rounded-full overflow-hidden bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ animation: "juristlens-bar 1.6s ease-in-out infinite", width: "40%" }} />
        </div>
      </div>
    );
  }

  if (extractedClauses.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
        <Shield className="w-8 h-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Upload a document to see analysis</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">Review Summary</h2>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border/50 text-muted-foreground hover:text-foreground transition-all">
              <Filter className="w-3 h-3" />
              Filters
            </button>
          </div>
        </div>

        <RiskSummaryCards clauses={extractedClauses} />

        {/* Sort control */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground font-medium">Sort by:</span>
          <button
            onClick={() => setSortBy(sortBy === "risk" ? "page" : "risk")}
            className="flex items-center gap-1 text-[11px] font-semibold text-foreground hover:text-primary transition-colors"
          >
            {sortBy === "risk" ? "Risk Level" : "Page Number"}
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 p-1 rounded-lg bg-secondary/50 sticky top-0 z-10">
          {(["all", "high", "medium", "low"] as RiskFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "flex-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all capitalize",
                filter === f ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f === "all" ? `All (${extractedClauses.length})` : `${f} (${extractedClauses.filter((c) => c.risk_level === f).length})`}
            </button>
          ))}
        </div>

        {/* Clause cards */}
        {displayed.map((clause) => (
          <ClauseCard key={clause.id} clause={clause} isSelected={selectedClause?.id === clause.id} />
        ))}

        {hasMore && !showMore && (
          <button
            onClick={() => setShowMore(true)}
            className="w-full py-2.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            Show {sorted.length - INITIAL_SHOW} more clauses
          </button>
        )}
      </div>
    </div>
  );
}
