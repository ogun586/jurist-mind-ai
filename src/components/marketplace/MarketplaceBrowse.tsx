import { useState, useEffect } from "react";
import { Search, Filter, Loader2, FileText, SortAsc } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Document } from "./types";
import { DocumentCard } from "./DocumentCard";

interface MarketplaceBrowseProps {
  onViewDocument: (doc: Document) => void;
}

type SortOption = 'newest' | 'oldest' | 'title_asc' | 'title_desc' | 'most_viewed';

export function MarketplaceBrowse({ onViewDocument }: MarketplaceBrowseProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const ITEMS_PER_PAGE = 12;

  useEffect(() => {
    fetchDocuments(true);
  }, [sortBy]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchDocuments(true);
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  const fetchDocuments = async (reset: boolean = false) => {
    setLoading(true);
    try {
      const currentPage = reset ? 1 : page;
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      let query = supabase
        .from('documents')
        .select('*', { count: 'exact' })
        .eq('status', 'active');

      // Apply search
      if (searchTerm.trim()) {
        query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
      }

      // Apply sorting
      switch (sortBy) {
        case 'newest':
          query = query.order('created_at', { ascending: false });
          break;
        case 'oldest':
          query = query.order('created_at', { ascending: true });
          break;
        case 'title_asc':
          query = query.order('title', { ascending: true });
          break;
        case 'title_desc':
          query = query.order('title', { ascending: false });
          break;
        case 'most_viewed':
          query = query.order('view_count', { ascending: false });
          break;
      }

      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      const newDocs = (data as Document[]) || [];
      
      if (reset) {
        setDocuments(newDocs);
        setPage(1);
      } else {
        setDocuments(prev => [...prev, ...newDocs]);
      }

      setTotalCount(count || 0);
      setHasMore(newDocs.length === ITEMS_PER_PAGE && (from + newDocs.length) < (count || 0));
    } catch (error: any) {
      console.error('Error fetching documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    setPage(prev => prev + 1);
    fetchDocuments(false);
  };

  const handleDownload = async (doc: Document) => {
    try {
      // Increment download count
      await supabase.rpc('increment_document_downloads', { doc_id: doc.id });
      
      // Open file in new tab for download
      window.open(doc.file_url, '_blank');
    } catch (error) {
      console.error('Download error:', error);
      window.open(doc.file_url, '_blank');
    }
  };

  const handleView = async (doc: Document) => {
    try {
      // Increment view count
      await supabase.rpc('increment_document_views', { doc_id: doc.id });
    } catch (error) {
      console.error('View count error:', error);
    }
    onViewDocument(doc);
  };

  return (
    <div className="space-y-6">
      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SortAsc className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="title_asc">Title (A-Z)</SelectItem>
            <SelectItem value="title_desc">Title (Z-A)</SelectItem>
            <SelectItem value="most_viewed">Most viewed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results Count */}
      {!loading && (
        <p className="text-sm text-muted-foreground">
          Showing {documents.length} of {totalCount} documents
        </p>
      )}

      {/* Documents Grid */}
      {loading && documents.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No documents available yet</h3>
          <p className="text-muted-foreground">Be the first to upload!</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {documents.map((doc) => (
              <DocumentCard
                key={doc.id}
                document={doc}
                onView={handleView}
                onDownload={handleDownload}
              />
            ))}
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="text-center pt-6">
              <Button 
                variant="outline" 
                onClick={loadMore}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Load More
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
