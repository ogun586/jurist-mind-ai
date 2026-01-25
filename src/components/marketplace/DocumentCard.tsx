import { FileText, Eye, Download, Calendar, FileIcon } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { Document } from "./types";

interface DocumentCardProps {
  document: Document;
  onView: (doc: Document) => void;
  onDownload: (doc: Document) => void;
  showStatus?: boolean;
}

export function DocumentCard({ document, onView, onDownload, showStatus = false }: DocumentCardProps) {
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  const truncateDescription = (text: string | null, maxLength: number = 120): string => {
    if (!text) return "No description available";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + "...";
  };

  const getStatusBadge = () => {
    switch (document.status) {
      case 'active':
        return <Badge variant="default" className="bg-green-500 hover:bg-green-600">Active</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-500 text-black hover:bg-yellow-600">Pending</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
    }
  };

  return (
    <Card className="flex flex-col h-full hover:shadow-lg transition-shadow group">
      <CardContent className="flex-1 p-4">
        {/* Document Icon/Thumbnail */}
        <div className="w-full h-32 bg-muted rounded-lg flex items-center justify-center mb-4 group-hover:bg-muted/80 transition-colors">
          <FileText className="w-16 h-16 text-primary/60" />
        </div>

        {/* Title & Status */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-lg line-clamp-2 flex-1">{document.title}</h3>
          {showStatus && getStatusBadge()}
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
          {truncateDescription(document.description)}
        </p>

        {/* Metadata */}
        <div className="space-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span>Uploaded {formatDistanceToNow(new Date(document.created_at), { addSuffix: true })}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <FileIcon className="w-3 h-3" />
              <span>{formatFileSize(document.file_size)}</span>
            </div>
            {document.page_count > 0 && (
              <span>{document.page_count} pages</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              <span>{document.view_count} views</span>
            </div>
            <div className="flex items-center gap-1">
              <Download className="w-3 h-3" />
              <span>{document.download_count} downloads</span>
            </div>
          </div>
          {document.uploader_name && (
            <p className="text-xs">By {document.uploader_name}</p>
          )}
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0 gap-2">
        <Button 
          variant="default" 
          className="flex-1"
          onClick={() => onView(document)}
        >
          <Eye className="w-4 h-4 mr-2" />
          View
        </Button>
        <Button 
          variant="outline" 
          size="icon"
          onClick={() => onDownload(document)}
        >
          <Download className="w-4 h-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
