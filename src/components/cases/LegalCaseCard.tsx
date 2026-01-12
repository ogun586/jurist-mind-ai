import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChevronRight,
  Calendar,
  Building,
  User,
  Clock,
  FileText,
  Shield,
  Tag,
  CheckCircle2,
} from "lucide-react";

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
  status?: "pending" | "verified" | "rejected";
  has_ctc?: boolean;
}

interface LegalCaseCardProps {
  note: JudgeNote;
  onClick: () => void;
}

export function LegalCaseCard({ note, onClick }: LegalCaseCardProps) {
  const status = note.status || (note.has_ctc ? "verified" : "pending");
  
  const getStatusConfig = () => {
    switch (status) {
      case "verified":
        return {
          label: "Verified",
          icon: CheckCircle2,
          className: "bg-[hsl(145,35%,38%)]/10 text-[hsl(145,35%,38%)] border-[hsl(145,35%,38%)]/20",
        };
      case "rejected":
        return {
          label: "Rejected",
          icon: Clock,
          className: "bg-[hsl(0,45%,45%)]/10 text-[hsl(0,45%,45%)] border-[hsl(0,45%,45%)]/20",
        };
      default:
        return {
          label: "Pending Review",
          icon: Clock,
          className: "bg-[hsl(35,30%,50%)]/10 text-[hsl(35,30%,50%)] border-[hsl(35,30%,50%)]/20",
        };
    }
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  const truncateContent = (content: string, maxLength: number = 160) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + "...";
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-NG", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return formatDate(dateStr);
  };

  const isVerified = status === "verified";

  return (
    <Card
      className={`group legal-card-hover cursor-pointer overflow-hidden border ${
        isVerified
          ? "border-[hsl(145,35%,38%)]/20 legal-seal"
          : "border-border"
      } bg-card`}
      onClick={onClick}
    >
      <CardHeader className="pb-3 pt-5 px-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Status Badge & Time */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Badge variant="outline" className={`gap-1 text-xs font-medium ${statusConfig.className}`}>
                <StatusIcon className="w-3 h-3" />
                {statusConfig.label}
              </Badge>
              <Badge
                variant="outline"
                className="bg-muted/50 text-muted-foreground border-border text-xs font-normal"
              >
                {note.category}
              </Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {getTimeAgo(note.created_at)}
              </span>
            </div>

            {/* Case Title - Serif Typography */}
            <h3 className="font-legal-serif text-lg md:text-xl font-semibold text-foreground group-hover:text-foreground/80 transition-colors leading-snug line-clamp-2">
              {note.title}
            </h3>

            {/* Case Citation */}
            {note.case_suit_number && (
              <p className="text-xs text-muted-foreground mt-1 font-medium tracking-wide uppercase">
                {note.case_suit_number}
              </p>
            )}
          </div>

          {/* Arrow or Verified Icon */}
          {isVerified ? (
            <div className="shrink-0">
              <div className="w-10 h-10 rounded-full bg-[hsl(145,35%,38%)]/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-[hsl(145,35%,38%)]" />
              </div>
            </div>
          ) : (
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0 px-5 pb-5">
        {/* Metadata Row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mb-3 font-legal-body">
          <span className="flex items-center gap-1">
            <User className="w-3.5 h-3.5" />
            <span className="font-medium text-foreground/80">{note.judge_name}</span>
          </span>
          <span className="flex items-center gap-1">
            <Building className="w-3.5 h-3.5" />
            {note.court}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {formatDate(note.created_at)}
          </span>
        </div>

        {/* Content Preview */}
        <p className="text-muted-foreground text-sm mb-4 leading-relaxed font-legal-body">
          {truncateContent(note.content)}
        </p>

        {/* Tags */}
        {note.tags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mb-4">
            <Tag className="w-3 h-3 text-muted-foreground shrink-0" />
            {note.tags.slice(0, 3).map((tag, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="text-xs font-normal bg-muted/60 text-muted-foreground px-2 py-0"
              >
                {tag}
              </Badge>
            ))}
            {note.tags.length > 3 && (
              <span className="text-xs text-muted-foreground">
                +{note.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* CTA Footer */}
        <div className="pt-3 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            {note.has_ctc && (
              <Badge
                variant="outline"
                className="gap-1 text-xs bg-[hsl(145,35%,38%)]/5 text-[hsl(145,35%,38%)] border-[hsl(145,35%,38%)]/20"
              >
                <FileText className="w-3 h-3" />
                CTC Available
              </Badge>
            )}
            {!note.has_ctc && (
              <span className="text-xs text-muted-foreground">
                Click to view full report
              </span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-8 bg-transparent border-border hover:bg-foreground hover:text-background hover:border-foreground transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            View Report
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
