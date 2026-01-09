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
  AlertCircle,
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
          label: "Active & Verified",
          icon: CheckCircle2,
          className: "bg-status-verified text-status-verified-foreground",
        };
      case "rejected":
        return {
          label: "Rejected",
          icon: AlertCircle,
          className: "bg-status-rejected text-status-rejected-foreground",
        };
      default:
        return {
          label: "Pending Review",
          icon: Clock,
          className: "bg-status-pending text-status-pending-foreground",
        };
    }
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  const truncateContent = (content: string, maxLength: number = 180) => {
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
      className={`group legal-card-hover cursor-pointer overflow-hidden border-2 ${
        isVerified
          ? "border-justice-blue/20 legal-seal"
          : "border-border hover:border-primary/20"
      }`}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Status Badge & Time */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Badge className={`gap-1 ${statusConfig.className}`}>
                <StatusIcon className="w-3 h-3" />
                {statusConfig.label}
              </Badge>
              <Badge
                variant="outline"
                className="bg-justice-blue-muted text-justice-blue border-justice-blue/20"
              >
                {note.category}
              </Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {getTimeAgo(note.created_at)}
              </span>
            </div>

            {/* Case Title - Serif Typography */}
            <h3 className="font-legal-serif text-xl md:text-2xl font-semibold text-foreground group-hover:text-justice-blue transition-colors leading-tight line-clamp-2">
              {note.title}
            </h3>

            {/* Case Citation */}
            {note.case_suit_number && (
              <p className="text-sm text-muted-foreground mt-1 font-medium tracking-wide">
                {note.case_suit_number}
              </p>
            )}
          </div>

          {/* Verified Seal Icon */}
          {isVerified && (
            <div className="relative shrink-0">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-justice-blue to-justice-blue/80 flex items-center justify-center shadow-lg">
                <Shield className="w-7 h-7 text-justice-blue-foreground" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-status-verified flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5 text-status-verified-foreground" />
              </div>
            </div>
          )}

          {!isVerified && (
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-justice-blue group-hover:translate-x-1 transition-all shrink-0 mt-1" />
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Metadata Row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground mb-4 font-legal-body">
          <span className="flex items-center gap-1.5">
            <User className="w-4 h-4 text-justice-blue/70" />
            <span className="font-medium">{note.judge_name}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Building className="w-4 h-4 text-justice-blue/70" />
            {note.court}
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-justice-blue/70" />
            {formatDate(note.created_at)}
          </span>
        </div>

        {/* Content Preview */}
        <p className="text-muted-foreground mb-4 leading-relaxed font-legal-body">
          {truncateContent(note.content)}
        </p>

        {/* Tags */}
        {note.tags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Tag className="w-4 h-4 text-muted-foreground shrink-0" />
            {note.tags.slice(0, 4).map((tag, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="text-xs font-normal bg-muted/60"
              >
                {tag}
              </Badge>
            ))}
            {note.tags.length > 4 && (
              <span className="text-xs text-muted-foreground">
                +{note.tags.length - 4} more
              </span>
            )}
          </div>
        )}

        {/* CTA Footer */}
        <div className="mt-4 pt-4 border-t flex items-center justify-between">
          <div className="flex items-center gap-2">
            {note.has_ctc && (
              <Badge
                variant="outline"
                className="gap-1 text-xs bg-status-verified/10 text-status-verified border-status-verified/30"
              >
                <FileText className="w-3 h-3" />
                CTC Available
              </Badge>
            )}
            {!note.has_ctc && (
              <span className="text-sm text-muted-foreground">
                Click to view full report
              </span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 group-hover:bg-justice-blue group-hover:text-justice-blue-foreground group-hover:border-justice-blue transition-colors"
          >
            <FileText className="w-4 h-4" />
            View Report
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
