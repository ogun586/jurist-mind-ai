import { useState } from "react";
import {
  AlertTriangle, Shield, CheckCircle, Eye, MessageSquare,
  ChevronDown, ChevronUp, Sparkles, Copy, Check, Info
} from "lucide-react";
import { useJuristLens, JuristLensClause } from "@/contexts/JuristLensContext";
import { cn } from "@/lib/utils";

function getRiskConfig(level: string) {
  switch (level) {
    case "high":
      return {
        icon: AlertTriangle,
        label: "High Risk",
        color: "text-red-400",
        bg: "bg-red-500/10",
        border: "border-red-500/30",
        badge: "bg-red-500/15 text-red-400",
        accent: "border-l-red-500",
      };
    case "medium":
      return {
        icon: Info,
        label: "Needs Review",
        color: "text-amber-400",
        bg: "bg-amber-500/10",
        border: "border-amber-500/30",
        badge: "bg-amber-500/15 text-amber-400",
        accent: "border-l-amber-500",
      };
    default:
      return {
        icon: CheckCircle,
        label: "Standard",
        color: "text-emerald-400",
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/30",
        badge: "bg-emerald-500/15 text-emerald-400",
        accent: "border-l-emerald-500",
      };
  }
}

interface ClauseCardProps {
  clause: JuristLensClause;
  isSelected: boolean;
}

function ClauseCard({ clause, isSelected }: ClauseCardProps) {
  const { selectClause, setActivePanel } = useJuristLens();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const risk = getRiskConfig(clause.risk_level);
  const RiskIcon = risk.icon;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(clause.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAskAI = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectClause(clause);
    setActivePanel("chat");
  };

  return (
    <div
      className={cn(
        "rounded-xl border-l-[3px] border bg-card transition-all cursor-pointer hover:shadow-md",
        risk.accent,
        isSelected
          ? "border-primary/50 ring-1 ring-primary/20 shadow-lg"
          : "border-border/50 hover:border-border"
      )}
      onClick={() => {
        selectClause(clause);
        setExpanded(!expanded);
      }}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider", risk.badge)}>
                <RiskIcon className="w-3 h-3" />
                {risk.label}
              </span>
              {clause.page_number > 0 && (
                <span className="text-[10px] text-muted-foreground font-medium">
                  Page {clause.page_number}
                </span>
              )}
            </div>
            <h4 className="text-sm font-semibold text-foreground leading-tight">
              {clause.title}
            </h4>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-all flex-shrink-0"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Clause text snippet */}
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed line-clamp-2 italic">
          "{clause.text.slice(0, 150)}{clause.text.length > 150 ? "..." : ""}"
        </p>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border/50">
          {/* Full clause text */}
          <div className="px-4 py-3">
            <p className="text-[10px] font-bold text-primary uppercase tracking-[0.15em] mb-1.5">
              Full Clause Text
            </p>
            <div
              className="rounded-lg p-3 text-xs leading-relaxed italic"
              style={{
                background: "hsla(42, 60%, 53%, 0.07)",
                borderLeft: "2px solid hsla(42, 60%, 53%, 0.4)",
                color: "hsl(42, 70%, 75%)",
              }}
            >
              "{clause.text}"
            </div>
          </div>

          {/* Explanation */}
          {clause.explanation && (
            <div className="px-4 py-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em] mb-1">
                Explanation
              </p>
              <p className="text-xs text-foreground/80 leading-relaxed">{clause.explanation}</p>
            </div>
          )}

          {/* Recommendation */}
          {clause.recommendation && (
            <div className="px-4 py-2">
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.15em] mb-1">
                Recommendation
              </p>
              <p className="text-xs text-foreground/80 leading-relaxed">{clause.recommendation}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 px-4 py-3 border-t border-border/30">
            <button
              onClick={(e) => {
                e.stopPropagation();
                selectClause(clause);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:opacity-90 transition-all"
            >
              <Eye className="w-3 h-3" />
              View in Document
            </button>
            <button
              onClick={handleAskAI}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-primary/30 text-primary hover:bg-primary/10 transition-all"
            >
              <MessageSquare className="w-3 h-3" />
              Ask JuristLens
            </button>
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-all ml-auto"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Risk Summary Bar ──────────────────────────────────────────────────────────
function RiskSummary({ clauses }: { clauses: JuristLensClause[] }) {
  const high = clauses.filter((c) => c.risk_level === "high").length;
  const medium = clauses.filter((c) => c.risk_level === "medium").length;
  const low = clauses.filter((c) => c.risk_level === "low").length;
  const total = clauses.length;

  return (
    <div className="rounded-xl border border-border bg-card/80 p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Shield className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Risk Assessment</h3>
        <span className="text-xs text-muted-foreground ml-auto">{total} clauses found</span>
      </div>

      {/* Risk bars */}
      <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-muted mb-3">
        {high > 0 && (
          <div className="bg-red-500 rounded-full" style={{ width: `${(high / total) * 100}%` }} />
        )}
        {medium > 0 && (
          <div className="bg-amber-500 rounded-full" style={{ width: `${(medium / total) * 100}%` }} />
        )}
        {low > 0 && (
          <div className="bg-emerald-500 rounded-full" style={{ width: `${(low / total) * 100}%` }} />
        )}
      </div>

      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-muted-foreground">High: <span className="text-foreground font-semibold">{high}</span></span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-muted-foreground">Medium: <span className="text-foreground font-semibold">{medium}</span></span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-muted-foreground">Low: <span className="text-foreground font-semibold">{low}</span></span>
        </div>
      </div>
    </div>
  );
}

// ── Filter Controls ───────────────────────────────────────────────────────────
type RiskFilter = "all" | "high" | "medium" | "low";

export default function InsightsPanel() {
  const { clauses, selectedClause, processingStatus } = useJuristLens();
  const [filter, setFilter] = useState<RiskFilter>("all");

  const filtered = filter === "all" ? clauses : clauses.filter((c) => c.risk_level === filter);

  // Sort: high first, then medium, then low
  const sorted = [...filtered].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return (order[a.risk_level] || 2) - (order[b.risk_level] || 2);
  });

  if (processingStatus === "processing") {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-primary animate-pulse" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">Analyzing Document...</p>
          <p className="text-xs text-muted-foreground mt-1">JuristLens is extracting clauses and assessing risks</p>
        </div>
        <div className="w-48 h-1 rounded-full overflow-hidden bg-muted">
          <div
            className="h-full rounded-full bg-primary"
            style={{ animation: "juristlens-bar 1.6s ease-in-out infinite", width: "40%" }}
          />
        </div>
      </div>
    );
  }

  if (clauses.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
        <Shield className="w-8 h-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Upload a document to see clause analysis</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <RiskSummary clauses={clauses} />

        {/* Filter tabs */}
        <div className="flex gap-1 p-1 rounded-lg bg-secondary/50 sticky top-0 z-10">
          {(["all", "high", "medium", "low"] as RiskFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "flex-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all capitalize",
                filter === f
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f === "all" ? `All (${clauses.length})` : `${f} (${clauses.filter((c) => c.risk_level === f).length})`}
            </button>
          ))}
        </div>

        {/* Clause cards */}
        {sorted.map((clause) => (
          <ClauseCard
            key={clause.id}
            clause={clause}
            isSelected={selectedClause?.id === clause.id}
          />
        ))}
      </div>
    </div>
  );
}
