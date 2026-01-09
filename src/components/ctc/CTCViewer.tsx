import { useState, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  RotateCw,
  Calendar,
  Building,
  User,
  Hash,
  Clock,
  HardDrive,
  Shield,
  Printer,
  Maximize2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface CTCFile {
  id: string;
  file_path: string;
  file_name: string;
  file_size: number;
  version: number;
  judgment_date: string | null;
  issuing_court: string | null;
  bench_judge_name: string | null;
  case_reference: string | null;
  uploaded_by_name: string | null;
  created_at: string;
  is_current: boolean;
}

interface CTCViewerProps {
  ctcFile: CTCFile;
  onClose?: () => void;
}

export function CTCViewer({ ctcFile, onClose }: CTCViewerProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);

  useEffect(() => {
    fetchPdfUrl();
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [ctcFile.file_path]);

  const fetchPdfUrl = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("manage-ctc", {
        body: { action: "get-download-url", filePath: ctcFile.file_path },
      });

      if (error) throw error;
      setPdfUrl(data.url);
    } catch (error) {
      console.error("Error fetching PDF URL:", error);
      toast.error("Failed to load PDF document");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!pdfUrl) return;

    try {
      const response = await fetch(pdfUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = ctcFile.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Download started");
    } catch (error) {
      toast.error("Failed to download file");
    }
  };

  const handleOpenNewTab = () => {
    if (pdfUrl) {
      window.open(pdfUrl, "_blank");
    }
  };

  const handlePrint = () => {
    if (pdfUrl) {
      const printWindow = window.open(pdfUrl, "_blank");
      printWindow?.print();
    }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-NG", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <Card className="overflow-hidden border-2 border-justice-blue/20">
      {/* Header */}
      <div className="bg-gradient-charcoal text-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-legal-serif text-lg font-semibold">
                Certified True Copy (CTC)
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                {ctcFile.is_current ? (
                  <Badge className="bg-status-verified text-status-verified-foreground text-xs gap-1">
                    <Shield className="w-3 h-3" />
                    Verified
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-amber-200 border-amber-200/50 text-xs"
                  >
                    v{ctcFile.version} (archived)
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrint}
              className="text-white/80 hover:text-white hover:bg-white/10"
              title="Print"
            >
              <Printer className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleOpenNewTab}
              className="text-white/80 hover:text-white hover:bg-white/10"
              title="Open in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
            <Button
              onClick={handleDownload}
              size="sm"
              className="bg-justice-blue hover:bg-justice-blue/90 gap-1.5"
            >
              <Download className="w-4 h-4" />
              Download
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* Sidebar - Metadata Panel */}
        <div className="lg:w-72 border-b lg:border-b-0 lg:border-r bg-muted/30 p-4 space-y-4">
          <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider font-legal-body flex items-center gap-2">
            <FileText className="w-4 h-4 text-justice-blue" />
            Document Details
          </h4>

          <div className="space-y-4">
            {ctcFile.judgment_date && (
              <div className="p-3 bg-card rounded-lg border">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Calendar className="w-4 h-4 text-justice-blue" />
                  <span className="text-xs uppercase tracking-wider font-legal-body">
                    Judgment Date
                  </span>
                </div>
                <p className="font-medium text-foreground font-legal-serif">
                  {formatDate(ctcFile.judgment_date)}
                </p>
              </div>
            )}

            {ctcFile.issuing_court && (
              <div className="p-3 bg-card rounded-lg border">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Building className="w-4 h-4 text-justice-blue" />
                  <span className="text-xs uppercase tracking-wider font-legal-body">
                    Issuing Court
                  </span>
                </div>
                <p className="font-medium text-foreground font-legal-serif">
                  {ctcFile.issuing_court}
                </p>
              </div>
            )}

            {ctcFile.bench_judge_name && (
              <div className="p-3 bg-card rounded-lg border">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <User className="w-4 h-4 text-justice-blue" />
                  <span className="text-xs uppercase tracking-wider font-legal-body">
                    Presiding Judge
                  </span>
                </div>
                <p className="font-medium text-foreground font-legal-serif">
                  {ctcFile.bench_judge_name}
                </p>
              </div>
            )}

            {ctcFile.case_reference && (
              <div className="p-3 bg-card rounded-lg border">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Hash className="w-4 h-4 text-justice-blue" />
                  <span className="text-xs uppercase tracking-wider font-legal-body">
                    Case Reference
                  </span>
                </div>
                <p className="font-medium text-foreground font-legal-body text-sm">
                  {ctcFile.case_reference}
                </p>
              </div>
            )}
          </div>

          {/* File Info */}
          <div className="pt-4 border-t space-y-2">
            <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              File Information
            </h5>
            <div className="text-xs text-muted-foreground space-y-1.5">
              <p className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" />
                <span className="truncate">{ctcFile.file_name}</span>
              </p>
              <p className="flex items-center gap-2">
                <HardDrive className="w-3.5 h-3.5" />
                {formatFileSize(ctcFile.file_size)}
              </p>
              <p className="flex items-center gap-2">
                <User className="w-3.5 h-3.5" />
                {ctcFile.uploaded_by_name || "Unknown"}
              </p>
              <p className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" />
                {formatDate(ctcFile.created_at)}
              </p>
            </div>
          </div>
        </div>

        {/* Main PDF Viewer */}
        <div className="flex-1">
          {/* Toolbar */}
          <div className="flex items-center justify-between p-3 border-b bg-card">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
                className="h-9 w-9"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="px-3 py-1.5 bg-muted rounded-md text-sm font-medium min-w-[100px] text-center font-legal-body">
                Page {currentPage} of {numPages || "?"}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  setCurrentPage(Math.min(numPages || 1, currentPage + 1))
                }
                disabled={!numPages || currentPage >= numPages}
                className="h-9 w-9"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setScale(Math.max(0.5, scale - 0.25))}
                disabled={scale <= 0.5}
                className="h-9 w-9"
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium min-w-[50px] text-center font-legal-body">
                {Math.round(scale * 100)}%
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setScale(Math.min(2, scale + 0.25))}
                disabled={scale >= 2}
                className="h-9 w-9"
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setScale(1)}
                title="Reset zoom"
                className="h-9 w-9"
              >
                <RotateCw className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* PDF Display */}
          <div className="relative bg-gradient-legal min-h-[500px] max-h-[700px] overflow-auto flex justify-center p-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-4 py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-justice-blue border-t-transparent" />
                <p className="text-muted-foreground font-legal-body">
                  Loading document...
                </p>
              </div>
            ) : pdfUrl ? (
              <Document
                file={pdfUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={
                  <div className="flex flex-col items-center justify-center gap-4 py-16">
                    <Skeleton className="h-[600px] w-[450px]" />
                  </div>
                }
                error={
                  <div className="text-center py-16">
                    <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-destructive font-legal-body">
                      Failed to load PDF
                    </p>
                    <Button
                      variant="outline"
                      onClick={fetchPdfUrl}
                      className="mt-4"
                    >
                      Retry
                    </Button>
                  </div>
                }
              >
                <Page
                  pageNumber={currentPage}
                  scale={scale}
                  className="shadow-legal rounded-lg overflow-hidden"
                  loading={<Skeleton className="h-[600px] w-[450px]" />}
                />
              </Document>
            ) : (
              <div className="text-center py-16">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground font-legal-body">
                  No document available
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
