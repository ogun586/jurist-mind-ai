import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Calendar,
  Tag,
  Download,
  ArrowLeft,
  Building,
  User,
  Hash,
  Share2,
  Printer,
  FileText,
  Shield,
  Scale,
  BookOpen,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CTCSection } from "@/components/ctc";

interface JudgeNote {
  id: string;
  title: string;
  judge_name: string;
  court: string;
  category: string;
  content: string;
  tags: string[];
  created_at: string;
  case_suit_number?: string;
}

interface ReadFullNoteProps {
  noteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReadFullNote({
  noteId,
  open,
  onOpenChange,
}: ReadFullNoteProps) {
  const [note, setNote] = useState<JudgeNote | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && noteId) {
      fetchNote();
    }
  }, [open, noteId]);

  const fetchNote = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "manage-judge-notes",
        {
          body: { action: "get-by-id", noteData: { id: noteId } },
        }
      );

      if (error) throw error;
      setNote(data);
    } catch (error) {
      console.error("Error fetching note:", error);
      toast.error("Failed to fetch case report details");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadText = () => {
    if (!note) return;

    const content = `
══════════════════════════════════════════════════════════════
                    CASE REPORT
══════════════════════════════════════════════════════════════

TITLE: ${note.title}

JUDGE: ${note.judge_name}
COURT: ${note.court}
CATEGORY: ${note.category}
${note.case_suit_number ? `CASE NUMBER: ${note.case_suit_number}` : ""}
DATE: ${new Date(note.created_at).toLocaleDateString("en-NG", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })}

══════════════════════════════════════════════════════════════
                    CONTENT
══════════════════════════════════════════════════════════════

${note.content}

══════════════════════════════════════════════════════════════

TAGS: ${note.tags.join(", ")}

Generated from JuristMind AI Legal Repository
    `.trim();

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `case-report-${note.title
      .replace(/[^a-zA-Z0-9]/g, "-")
      .toLowerCase()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success("Case report downloaded");
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    if (!note) return;

    const shareData = {
      title: note.title,
      text: `Case Report: ${note.title} - ${note.judge_name} at ${note.court}`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Link copied to clipboard");
      }
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-NG", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-charcoal text-white">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="gap-2 text-white/80 hover:text-white hover:bg-white/10"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-justice-blue" />
              <span className="text-sm font-medium text-white/80 font-legal-body">
                Legal Authority Vault
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleShare}
              title="Share"
              className="text-white/80 hover:text-white hover:bg-white/10"
            >
              <Share2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrint}
              title="Print"
              className="text-white/80 hover:text-white hover:bg-white/10"
            >
              <Printer className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              onClick={handleDownloadText}
              className="gap-1.5 bg-justice-blue hover:bg-justice-blue/90"
            >
              <Download className="w-4 h-4" />
              Download
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-gradient-legal">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-justice-blue/10 flex items-center justify-center mx-auto mb-4">
                  <Scale className="w-8 h-8 text-justice-blue animate-pulse" />
                </div>
                <p className="text-muted-foreground font-legal-body">
                  Loading case report...
                </p>
              </div>
            </div>
          ) : note ? (
            <div className="p-6 md:p-8 space-y-8 max-w-5xl mx-auto">
              {/* Title & Metadata Section */}
              <div className="bg-card border-2 rounded-2xl p-6 md:p-8 shadow-sm">
                {/* Status Badge Row */}
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                  <Badge className="bg-status-verified text-status-verified-foreground gap-1">
                    <Shield className="w-3 h-3" />
                    Active & Verified
                  </Badge>
                  <Badge
                    variant="outline"
                    className="bg-justice-blue-muted text-justice-blue border-justice-blue/20"
                  >
                    {note.category}
                  </Badge>
                  <span className="text-sm text-muted-foreground font-legal-body">
                    {formatDate(note.created_at)}
                  </span>
                </div>

                {/* Title */}
                <h1 className="font-legal-serif text-3xl md:text-4xl font-bold text-foreground mb-2 leading-tight">
                  {note.title}
                </h1>

                {/* Case Number */}
                {note.case_suit_number && (
                  <p className="text-lg text-muted-foreground font-medium font-legal-body tracking-wide mb-6">
                    {note.case_suit_number}
                  </p>
                )}

                {/* Metadata Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-muted/30 rounded-xl border">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
                      <User className="w-4 h-4 text-justice-blue" />
                      <span className="text-xs uppercase tracking-wider font-legal-body">
                        Presiding Judge
                      </span>
                    </div>
                    <p className="font-semibold text-foreground font-legal-serif">
                      {note.judge_name}
                    </p>
                  </div>

                  <div className="p-4 bg-muted/30 rounded-xl border">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
                      <Building className="w-4 h-4 text-justice-blue" />
                      <span className="text-xs uppercase tracking-wider font-legal-body">
                        Court
                      </span>
                    </div>
                    <p className="font-semibold text-foreground font-legal-serif">
                      {note.court}
                    </p>
                  </div>

                  <div className="p-4 bg-muted/30 rounded-xl border">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
                      <Calendar className="w-4 h-4 text-justice-blue" />
                      <span className="text-xs uppercase tracking-wider font-legal-body">
                        Date
                      </span>
                    </div>
                    <p className="font-semibold text-foreground font-legal-serif">
                      {new Date(note.created_at).toLocaleDateString("en-NG", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>

                  {note.case_suit_number && (
                    <div className="p-4 bg-muted/30 rounded-xl border">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
                        <Hash className="w-4 h-4 text-justice-blue" />
                        <span className="text-xs uppercase tracking-wider font-legal-body">
                          Case No.
                        </span>
                      </div>
                      <p className="font-semibold text-foreground font-legal-body text-sm">
                        {note.case_suit_number}
                      </p>
                    </div>
                  )}
                </div>

                {/* Tags */}
                {note.tags.length > 0 && (
                  <div className="flex items-center gap-2 mt-6 flex-wrap">
                    <Tag className="w-4 h-4 text-muted-foreground" />
                    {note.tags.map((tag, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="font-normal bg-muted/60"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* CTC Section */}
              <CTCSection noteId={note.id} />

              {/* Full Content Section */}
              <div className="bg-card border-2 rounded-2xl overflow-hidden shadow-sm">
                <div className="flex items-center gap-3 p-4 border-b bg-muted/30">
                  <div className="w-10 h-10 rounded-lg bg-justice-blue/10 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-justice-blue" />
                  </div>
                  <div>
                    <h2 className="font-legal-serif text-xl font-semibold">
                      Case Report Content
                    </h2>
                    <p className="text-sm text-muted-foreground font-legal-body">
                      Full judgment summary and analysis
                    </p>
                  </div>
                </div>

                <div className="p-6 md:p-8">
                  <div className="prose prose-slate dark:prose-invert max-w-none">
                    <div className="whitespace-pre-wrap text-foreground leading-relaxed text-base font-legal-body">
                      {note.content}
                    </div>
                  </div>

                  <div className="mt-8 pt-6 border-t text-center">
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Scale className="w-4 h-4 text-justice-blue" />
                      <span className="font-legal-body">
                        This case report is sourced from JuristMind AI Legal
                        Authority Vault
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground font-legal-body">
                  Case report not found
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
