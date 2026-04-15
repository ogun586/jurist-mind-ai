import { useState, useCallback, useEffect, useRef } from "react";
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut,
  Loader2, Download, Printer, X, Search, Menu, MoreVertical
} from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { useJuristLensStore } from "@/stores/juristLensStore";
import { cn } from "@/lib/utils";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

// ── Highlight Logic ───────────────────────────────────────────────────────────
function applyTextLayerHighlight(
  container: HTMLDivElement,
  selectedClause: { text: string; risk_level: string } | null,
  highlightRange: { startOffset: number; endOffset: number; matchQuality: string } | null
) {
  // Remove old highlights
  container.querySelectorAll(".jl-highlight").forEach((el) => el.remove());
  if (!selectedClause || !highlightRange) return;

  const textLayer = container.querySelector(".react-pdf__Page__textContent");
  if (!textLayer) return;

  const spans = textLayer.querySelectorAll("span");
  if (!spans.length) return;

  const riskColor =
    selectedClause.risk_level === "high"
      ? "rgba(239, 68, 68, 0.25)"
      : selectedClause.risk_level === "medium"
      ? "rgba(245, 158, 11, 0.25)"
      : "rgba(16, 185, 129, 0.20)";

  if (highlightRange.matchQuality === "page_only") return;

  // Strategy 1: offset-based highlighting
  if (highlightRange.startOffset > 0 && highlightRange.endOffset > 0) {
    let charCount = 0;
    let started = false;
    let firstHighlight: HTMLElement | null = null;

    spans.forEach((span) => {
      const text = span.textContent || "";
      const spanStart = charCount;
      const spanEnd = charCount + text.length;
      charCount = spanEnd;

      if (spanEnd > highlightRange.startOffset && spanStart < highlightRange.endOffset) {
        const el = span as HTMLElement;
        const highlight = document.createElement("div");
        highlight.className = "jl-highlight";
        Object.assign(highlight.style, {
          position: "absolute",
          left: `${el.offsetLeft}px`,
          top: `${el.offsetTop}px`,
          width: `${el.offsetWidth}px`,
          height: `${el.offsetHeight}px`,
          backgroundColor: riskColor,
          borderRadius: "2px",
          pointerEvents: "none",
          zIndex: "5",
          transition: "all 0.3s ease",
        });
        textLayer.appendChild(highlight);
        if (!firstHighlight) firstHighlight = highlight;
        started = true;
      }
    });

    if (started && firstHighlight) {
      (firstHighlight as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
  }

  // Strategy 2: fuzzy text matching fallback
  const searchText = selectedClause.text.slice(0, 60).toLowerCase().trim();
  let firstMatch: HTMLElement | null = null;

  spans.forEach((span) => {
    const spanText = (span.textContent || "").toLowerCase().trim();
    if (spanText.length < 3) return;

    const isMatch =
      spanText.includes(searchText.slice(0, 25)) ||
      searchText.includes(spanText.slice(0, 25));

    if (isMatch) {
      const el = span as HTMLElement;
      const highlight = document.createElement("div");
      highlight.className = "jl-highlight";
      Object.assign(highlight.style, {
        position: "absolute",
        left: `${el.offsetLeft}px`,
        top: `${el.offsetTop}px`,
        width: `${el.offsetWidth}px`,
        height: `${el.offsetHeight}px`,
        backgroundColor: riskColor,
        borderRadius: "2px",
        pointerEvents: "none",
        zIndex: "5",
        transition: "all 0.3s ease",
      });
      textLayer.appendChild(highlight);
      if (!firstMatch) firstMatch = highlight;
    }
  });

  if (firstMatch) {
    firstMatch.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function JLDocumentViewer() {
  const {
    currentDocument, selectedClause, highlightRange, viewerPage, viewerScale,
    viewerNumPages, navigateToPage, setViewerScale, setViewerNumPages,
    extractedClauses, clearSelectedClause,
  } = useJuristLensStore();

  const [loading, setLoading] = useState(true);
  const pageRef = useRef<HTMLDivElement>(null);

  const onDocumentLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    setViewerNumPages(n);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (pageRef.current) {
      pageRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [viewerPage]);

  const onPageRenderSuccess = useCallback(() => {
    if (!pageRef.current) return;
    applyTextLayerHighlight(pageRef.current, selectedClause, highlightRange);
  }, [selectedClause, highlightRange]);

  // Re-highlight on clause change
  useEffect(() => {
    if (!selectedClause || !pageRef.current) return;
    const timer = setTimeout(() => {
      if (pageRef.current) applyTextLayerHighlight(pageRef.current, selectedClause, highlightRange);
    }, 400);
    return () => clearTimeout(timer);
  }, [selectedClause, viewerPage, highlightRange]);

  const prevPage = () => navigateToPage(Math.max(1, viewerPage - 1));
  const nextPage = () => navigateToPage(Math.min(viewerNumPages, viewerPage + 1));

  const ZOOM_STEPS = [0.75, 1.0, 1.25, 1.5, 2.0];
  const zoomIn = () => {
    const idx = ZOOM_STEPS.findIndex((s) => s >= viewerScale);
    if (idx < ZOOM_STEPS.length - 1) setViewerScale(ZOOM_STEPS[idx + 1]);
  };
  const zoomOut = () => {
    const idx = ZOOM_STEPS.findIndex((s) => s >= viewerScale);
    if (idx > 0) setViewerScale(ZOOM_STEPS[idx - 1]);
  };

  const handleDownload = () => {
    if (currentDocument?.file_url) {
      window.open(currentDocument.file_url, "_blank");
    }
  };

  const handlePrint = () => {
    if (currentDocument?.file_url) {
      const win = window.open(currentDocument.file_url);
      win?.addEventListener("load", () => win.print());
    }
  };

  const _pageClauses = extractedClauses.filter((c) => c.page_number === viewerPage);

  if (!currentDocument) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-center bg-muted/10 rounded-xl">
        <span className="text-3xl">📄</span>
        <p className="text-sm text-muted-foreground">No document loaded</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[hsl(240,20%,3%)]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/30 bg-card/90 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button className="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors">
            <Menu className="w-4 h-4" />
          </button>
          <button className="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors">
            <Search className="w-4 h-4" />
          </button>
        </div>

        {/* Page nav */}
        <div className="flex items-center gap-1">
          <button onClick={prevPage} disabled={viewerPage <= 1} className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 transition-all">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <input
              type="number"
              value={viewerPage}
              onChange={(e) => {
                const v = parseInt(e.target.value);
                if (v >= 1 && v <= viewerNumPages) navigateToPage(v);
              }}
              className="w-8 text-center bg-transparent border border-border/50 rounded text-foreground text-xs py-0.5"
              min={1}
              max={viewerNumPages}
            />
            <span>/ {loading ? "—" : viewerNumPages}</span>
          </div>
          <button onClick={nextPage} disabled={viewerPage >= viewerNumPages} className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 transition-all">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom + actions */}
        <div className="flex items-center gap-1">
          <button onClick={zoomOut} className="p-1 rounded text-muted-foreground hover:text-foreground transition-all">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] text-muted-foreground min-w-[40px] text-center font-medium">{Math.round(viewerScale * 100)}%</span>
          <button onClick={zoomIn} className="p-1 rounded text-muted-foreground hover:text-foreground transition-all">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-border/30 mx-1" />
          <button onClick={handleDownload} className="p-1 rounded text-muted-foreground hover:text-foreground transition-all">
            <Download className="w-3.5 h-3.5" />
          </button>
          <button onClick={handlePrint} className="p-1 rounded text-muted-foreground hover:text-foreground transition-all">
            <Printer className="w-3.5 h-3.5" />
          </button>
          <button className="p-1 rounded text-muted-foreground hover:text-foreground transition-all">
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* PDF Content */}
      <div className="flex-1 overflow-auto flex justify-center py-4 px-2 relative">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <p className="text-xs text-muted-foreground">Loading document…</p>
          </div>
        )}

        <div ref={pageRef}>
          <Document
            file={currentDocument.file_url}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={() => setLoading(false)}
            loading=""
          >
            <Page
              pageNumber={viewerPage}
              scale={viewerScale}
              className="shadow-2xl rounded-lg overflow-hidden"
              renderTextLayer={true}
              renderAnnotationLayer={true}
              onRenderSuccess={onPageRenderSuccess}
            />
          </Document>
        </div>
      </div>

      {/* Page indicator */}
      <div className="flex-shrink-0 text-center py-2 text-xs text-muted-foreground/50">
        Page {viewerPage} of {viewerNumPages || "—"}
      </div>

      {/* Clause highlighted banner */}
      {selectedClause && (
        <div className={cn(
          "flex items-center gap-3 px-4 py-2.5 border-t flex-shrink-0 animate-fade-in-up",
          selectedClause.risk_level === "high" ? "bg-red-500/5 border-red-500/20" :
          selectedClause.risk_level === "medium" ? "bg-amber-500/5 border-amber-500/20" :
          "bg-emerald-500/5 border-emerald-500/20"
        )}>
          <span className="text-sm">⚠️</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground">Clause Highlighted</span>
              <span className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase",
                selectedClause.risk_level === "high" ? "bg-red-500/15 text-red-400" :
                selectedClause.risk_level === "medium" ? "bg-amber-500/15 text-amber-400" :
                "bg-emerald-500/15 text-emerald-400"
              )}>
                ⚡ {selectedClause.risk_level} Risk
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
              {selectedClause.title} – Page {selectedClause.page_number}
            </p>
            {highlightRange?.matchQuality === "page_only" && (
              <p className="text-[10px] text-amber-400/70 mt-0.5">Clause location approximate</p>
            )}
          </div>
          <button onClick={clearSelectedClause} className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
