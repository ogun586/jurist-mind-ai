import { useState, useCallback, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, Loader2 } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { useJuristLens } from "@/contexts/JuristLensContext";
import { cn } from "@/lib/utils";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

export default function DocumentViewer() {
  const {
    currentDocument, selectedClause, viewerPage, navigateToPage,
    highlightClauseId, clauses,
  } = useJuristLens();

  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
  }, []);

  // Scroll to page when viewerPage changes
  useEffect(() => {
    if (pageRef.current) {
      pageRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [viewerPage]);

  // Highlight text in the text layer after page renders
  useEffect(() => {
    if (!selectedClause || !pageRef.current) return;

    // Small delay to wait for text layer to render
    const timer = setTimeout(() => {
      highlightClauseText();
    }, 500);

    return () => clearTimeout(timer);
  }, [selectedClause, viewerPage, loading]);

  const highlightClauseText = () => {
    if (!pageRef.current || !selectedClause) return;

    // Remove existing highlights
    const existing = pageRef.current.querySelectorAll(".juristlens-highlight");
    existing.forEach((el) => el.remove());

    // Find text layer spans
    const textLayer = pageRef.current.querySelector(".react-pdf__Page__textContent");
    if (!textLayer) return;

    const spans = textLayer.querySelectorAll("span");
    if (!spans.length) return;

    // Search for clause text in the text layer
    const searchText = selectedClause.text.slice(0, 60).toLowerCase();
    let found = false;

    spans.forEach((span) => {
      const spanText = span.textContent?.toLowerCase() || "";
      if (spanText.includes(searchText.slice(0, 20)) || searchText.includes(spanText.slice(0, 20))) {
        if (spanText.trim().length > 2) {
          // Create highlight overlay
          const rect = span.getBoundingClientRect();
          const containerRect = textLayer.getBoundingClientRect();
          
          const highlight = document.createElement("div");
          highlight.className = "juristlens-highlight";
          highlight.style.position = "absolute";
          highlight.style.left = `${span.offsetLeft}px`;
          highlight.style.top = `${span.offsetTop}px`;
          highlight.style.width = `${span.offsetWidth}px`;
          highlight.style.height = `${span.offsetHeight}px`;
          highlight.style.backgroundColor = selectedClause.risk_level === "high" 
            ? "rgba(239, 68, 68, 0.25)" 
            : selectedClause.risk_level === "medium"
            ? "rgba(245, 158, 11, 0.25)"
            : "rgba(16, 185, 129, 0.20)";
          highlight.style.borderRadius = "2px";
          highlight.style.pointerEvents = "none";
          highlight.style.zIndex = "5";
          highlight.style.transition = "all 0.3s ease";
          
          textLayer.appendChild(highlight);
          found = true;
        }
      }
    });
  };

  const prevPage = () => navigateToPage(Math.max(1, viewerPage - 1));
  const nextPage = () => navigateToPage(Math.min(numPages, viewerPage + 1));
  const zoomIn = () => setScale((s) => Math.min(2.5, s + 0.2));
  const zoomOut = () => setScale((s) => Math.max(0.5, s - 0.2));
  const resetZoom = () => setScale(1.0);

  if (!currentDocument) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-center bg-muted/20">
        <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
          <span className="text-2xl">📄</span>
        </div>
        <p className="text-sm text-muted-foreground">No document loaded</p>
        <p className="text-xs text-muted-foreground/60">Upload a document to view it here</p>
      </div>
    );
  }

  const isPDF = currentDocument.file_type === "pdf";

  return (
    <div className="h-full flex flex-col bg-muted/10">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-card/80 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded bg-red-500/15 flex items-center justify-center flex-shrink-0">
            <span className="text-[9px] font-bold text-red-400">PDF</span>
          </div>
          <span className="text-xs font-medium text-foreground truncate max-w-[150px]">
            {currentDocument.file_name}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Page nav */}
          <button onClick={prevPage} disabled={viewerPage <= 1}
            className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 transition-all">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-[10px] text-muted-foreground min-w-[50px] text-center">
            {loading ? "—" : `${viewerPage}/${numPages}`}
          </span>
          <button onClick={nextPage} disabled={viewerPage >= numPages}
            className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 transition-all">
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-border/50 mx-1" />

          {/* Zoom */}
          <button onClick={zoomOut} className="p-1 rounded text-muted-foreground hover:text-foreground transition-all">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] text-muted-foreground min-w-[35px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button onClick={zoomIn} className="p-1 rounded text-muted-foreground hover:text-foreground transition-all">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button onClick={resetZoom} className="p-1 rounded text-muted-foreground hover:text-foreground transition-all">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Selected clause indicator */}
      {selectedClause && (
        <div className={cn(
          "flex items-center gap-2 px-3 py-1.5 text-xs border-b border-border/30",
          selectedClause.risk_level === "high" ? "bg-red-500/5 text-red-400" :
          selectedClause.risk_level === "medium" ? "bg-amber-500/5 text-amber-400" :
          "bg-emerald-500/5 text-emerald-400"
        )}>
          <span className="font-semibold">Viewing:</span>
          <span className="truncate">{selectedClause.title}</span>
          <span className={cn(
            "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase",
            selectedClause.risk_level === "high" ? "bg-red-500/15" :
            selectedClause.risk_level === "medium" ? "bg-amber-500/15" :
            "bg-emerald-500/15"
          )}>
            {selectedClause.risk_level} risk
          </span>
        </div>
      )}

      {/* PDF Content */}
      <div ref={containerRef} className="flex-1 overflow-auto flex justify-center py-4 px-2">
        {loading && (
          <div className="flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <p className="text-xs text-muted-foreground">Loading document…</p>
          </div>
        )}

        {isPDF ? (
          <div ref={pageRef}>
            <Document
              file={currentDocument.file_url}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={() => setLoading(false)}
              loading=""
            >
              <Page
                pageNumber={viewerPage}
                scale={scale}
                className="shadow-lg rounded-lg overflow-hidden"
                renderTextLayer={true}
                renderAnnotationLayer={true}
                onRenderSuccess={highlightClauseText}
              />
            </Document>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 text-center p-6">
            <span className="text-3xl">📋</span>
            <p className="text-sm text-muted-foreground">
              Document preview is available for PDF files
            </p>
            <a
              href={currentDocument.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              Open document in new tab →
            </a>
          </div>
        )}
      </div>

      {/* Page clause markers */}
      {clauses.length > 0 && (
        <div className="flex items-center gap-1 px-3 py-2 border-t border-border/30 bg-card/50 overflow-x-auto">
          <span className="text-[10px] text-muted-foreground font-medium flex-shrink-0">Clauses on this page:</span>
          {clauses
            .filter((c) => c.page_number === viewerPage)
            .map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  const { selectClause } = useJuristLens();
                  // Can't call hook here, so dispatch via parent
                }}
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-medium flex-shrink-0 transition-all",
                  c.risk_level === "high" ? "bg-red-500/15 text-red-400" :
                  c.risk_level === "medium" ? "bg-amber-500/15 text-amber-400" :
                  "bg-emerald-500/15 text-emerald-400",
                  selectedClause?.id === c.id && "ring-1 ring-primary"
                )}
              >
                {c.title.slice(0, 25)}
              </button>
            ))}
          {clauses.filter((c) => c.page_number === viewerPage).length === 0 && (
            <span className="text-[10px] text-muted-foreground/50">None</span>
          )}
        </div>
      )}
    </div>
  );
}
