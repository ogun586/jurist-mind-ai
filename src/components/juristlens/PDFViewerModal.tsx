import { useState, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface PDFViewerModalProps {
  url: string;
  page: number;
  name: string;
  onClose: () => void;
}

export default function PDFViewerModal({ url, page: initialPage, name, onClose }: PDFViewerModalProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
  }, []);

  const prevPage = () => setCurrentPage(p => Math.max(1, p - 1));
  const nextPage = () => setCurrentPage(p => Math.min(numPages, p + 1));
  const zoomIn = () => setScale(s => Math.min(2.5, s + 0.25));
  const zoomOut = () => setScale(s => Math.max(0.5, s - 0.25));

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b border-border/40 flex-shrink-0"
        style={{ background: "hsl(var(--card))" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-red-500/15 flex items-center justify-center">
            <span className="text-xs font-bold text-red-400">PDF</span>
          </div>
          <span className="text-sm font-semibold text-foreground truncate max-w-xs">{name}</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Page nav */}
          <div className="flex items-center gap-1">
            <button
              onClick={prevPage}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-muted-foreground min-w-[60px] text-center">
              {loading ? "—" : `${currentPage} / ${numPages}`}
            </span>
            <button
              onClick={nextPage}
              disabled={currentPage >= numPages}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Zoom */}
          <div className="flex items-center gap-1 border-l border-border/40 pl-3">
            <button onClick={zoomOut} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-all">
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs text-muted-foreground min-w-[40px] text-center">{Math.round(scale * 100)}%</span>
            <button onClick={zoomIn} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-all">
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-destructive/20 transition-all ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* PDF area */}
      <div className="flex-1 overflow-auto flex justify-center py-6 px-4">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Loading document…</p>
            </div>
          </div>
        )}

        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={() => setLoading(false)}
          loading=""
        >
          <Page
            pageNumber={currentPage}
            scale={scale}
            className="shadow-lg rounded-lg overflow-hidden"
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </Document>
      </div>

      {/* Bottom hint */}
      <div className="flex-shrink-0 text-center py-2 text-xs text-muted-foreground/40">
        Source clause is on page {initialPage}
      </div>
    </div>
  );
}
