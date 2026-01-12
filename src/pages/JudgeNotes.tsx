import { useState, useEffect } from "react";
import {
  FileText,
  Search,
  Filter,
  Building,
  Shield,
  BookOpen,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AddNoteDialog } from "@/components/AddNoteDialog";
import { ReadFullNote } from "@/components/ReadFullNote";
import { LegalCaseCard } from "@/components/cases";

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

export default function JudgeNotes() {
  const [notes, setNotes] = useState<JudgeNote[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<JudgeNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [courtFilter, setCourtFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedNoteId, setSelectedNoteId] = useState<string>("");
  const [readNoteOpen, setReadNoteOpen] = useState(false);

  // Get unique categories and courts for filters
  const categories = [...new Set(notes.map((n) => n.category))].filter(Boolean);
  const courts = [...new Set(notes.map((n) => n.court))].filter(Boolean);

  useEffect(() => {
    fetchNotes();
  }, []);

  useEffect(() => {
    handleSearch();
  }, [searchTerm, notes, categoryFilter, courtFilter, statusFilter]);

  const fetchNotes = async () => {
    try {
      const { data, error } = await supabase.functions.invoke(
        "manage-judge-notes",
        {
          body: { action: "list" },
        }
      );

      if (error) throw error;
      // Simulate some notes having CTC and verified status for demo
      const enrichedNotes = (data || []).map((note: JudgeNote, index: number) => ({
        ...note,
        has_ctc: index % 3 === 0,
        status: index % 3 === 0 ? "verified" : "pending" as const,
      }));
      setNotes(enrichedNotes);
      setFilteredNotes(enrichedNotes);
    } catch (error) {
      console.error("Error fetching notes:", error);
      toast.error("Failed to fetch case reports");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    let filtered = notes;

    if (searchTerm) {
      filtered = filtered.filter(
        (note) =>
          note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          note.judge_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          note.court.toLowerCase().includes(searchTerm.toLowerCase()) ||
          note.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
          note.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
          note.tags.some((tag) =>
            tag.toLowerCase().includes(searchTerm.toLowerCase())
          )
      );
    }

    if (categoryFilter !== "all") {
      filtered = filtered.filter((note) => note.category === categoryFilter);
    }

    if (courtFilter !== "all") {
      filtered = filtered.filter((note) => note.court === courtFilter);
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((note) => note.status === statusFilter);
    }

    setFilteredNotes(filtered);
  };

  const handleReadFullNote = (noteId: string) => {
    setSelectedNoteId(noteId);
    setReadNoteOpen(true);
  };

  const verifiedCount = notes.filter((n) => n.status === "verified").length;
  const pendingCount = notes.filter((n) => n.status === "pending").length;

  if (loading) {
    return (
      <div className="h-full bg-background flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="w-12 h-12 rounded-full border-2 border-muted flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
          </div>
          <p className="text-muted-foreground font-legal-body text-sm">
            Loading case reports...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-background overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6 md:p-8 lg:p-10">
        {/* Header Section - Clean, Institutional */}
        <div className="mb-10 animate-fade-in">
          {/* Main Title */}
          <h1 className="font-legal-serif text-3xl md:text-4xl font-bold text-foreground mb-3 tracking-tight">
            Latest Cases Report
          </h1>

          {/* Description */}
          <p className="text-muted-foreground text-base max-w-2xl font-legal-body leading-relaxed mb-6">
            Access instant case reports from lawyers directly from the courtroom. 
            View and download Certified True Copies (CTC) of judgments with complete 
            authenticity verification.
          </p>

          {/* Primary Action */}
          <Button 
            className="bg-[hsl(350,45%,35%)] hover:bg-[hsl(350,45%,28%)] text-white font-medium px-6 h-11 rounded-lg transition-colors duration-200"
          >
            View Verified Cases
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>

        {/* Stats Row - Subtle, Professional */}
        <div className="grid grid-cols-3 gap-4 mb-8 animate-fade-in" style={{ animationDelay: '50ms' }}>
          <div className="legal-container p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-foreground" />
              </div>
              <div>
                <p className="text-xl font-semibold text-foreground font-legal-serif">
                  {notes.length}
                </p>
                <p className="text-xs text-muted-foreground">Total Reports</p>
              </div>
            </div>
          </div>

          <div className="legal-container p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[hsl(145,35%,38%)]/10 flex items-center justify-center">
                <Shield className="w-4 h-4 text-[hsl(145,35%,38%)]" />
              </div>
              <div>
                <p className="text-xl font-semibold text-[hsl(145,35%,38%)] font-legal-serif">
                  {verifiedCount}
                </p>
                <p className="text-xs text-muted-foreground">Verified</p>
              </div>
            </div>
          </div>

          <div className="legal-container p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[hsl(35,30%,50%)]/10 flex items-center justify-center">
                <FileText className="w-4 h-4 text-[hsl(35,30%,50%)]" />
              </div>
              <div>
                <p className="text-xl font-semibold text-foreground font-legal-serif">
                  {pendingCount}
                </p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="legal-container p-5 mb-6 animate-fade-in" style={{ animationDelay: '100ms' }}>
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search Input */}
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by title, judge, court, or keywords..."
                className="pl-10 h-11 text-sm font-legal-body bg-background border-border focus:border-foreground focus:ring-0 transition-colors"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] h-11 bg-background border-border">
                  <Shield className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[140px] h-11 bg-background border-border">
                  <Filter className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={courtFilter} onValueChange={setCourtFilter}>
                <SelectTrigger className="w-[160px] h-11 bg-background border-border">
                  <Building className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Court" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Courts</SelectItem>
                  {courts.map((court) => (
                    <SelectItem key={court} value={court}>
                      {court}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <AddNoteDialog onNoteAdded={fetchNotes} />
            </div>
          </div>

          {/* Active Filters */}
          {(categoryFilter !== "all" ||
            courtFilter !== "all" ||
            statusFilter !== "all" ||
            searchTerm) && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border flex-wrap">
              <span className="text-xs text-muted-foreground font-legal-body">
                Active:
              </span>
              {searchTerm && (
                <Badge variant="secondary" className="gap-1 text-xs font-normal">
                  "{searchTerm}"
                  <button
                    onClick={() => setSearchTerm("")}
                    className="ml-1 hover:text-foreground"
                  >
                    ×
                  </button>
                </Badge>
              )}
              {statusFilter !== "all" && (
                <Badge variant="secondary" className="gap-1 text-xs font-normal">
                  {statusFilter}
                  <button
                    onClick={() => setStatusFilter("all")}
                    className="ml-1 hover:text-foreground"
                  >
                    ×
                  </button>
                </Badge>
              )}
              {categoryFilter !== "all" && (
                <Badge variant="secondary" className="gap-1 text-xs font-normal">
                  {categoryFilter}
                  <button
                    onClick={() => setCategoryFilter("all")}
                    className="ml-1 hover:text-foreground"
                  >
                    ×
                  </button>
                </Badge>
              )}
              {courtFilter !== "all" && (
                <Badge variant="secondary" className="gap-1 text-xs font-normal">
                  {courtFilter}
                  <button
                    onClick={() => setCourtFilter("all")}
                    className="ml-1 hover:text-foreground"
                  >
                    ×
                  </button>
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm("");
                  setCategoryFilter("all");
                  setCourtFilter("all");
                  setStatusFilter("all");
                }}
                className="text-xs text-muted-foreground hover:text-foreground h-7"
              >
                Clear all
              </Button>
            </div>
          )}
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between mb-4 animate-fade-in" style={{ animationDelay: '150ms' }}>
          <p className="text-xs text-muted-foreground font-legal-body">
            Showing{" "}
            <span className="font-medium text-foreground">
              {filteredNotes.length}
            </span>{" "}
            of {notes.length} reports
          </p>
        </div>

        {/* Case Reports Grid */}
        <div className="grid gap-4">
          {filteredNotes.map((note, index) => (
            <div 
              key={note.id} 
              className="animate-fade-in"
              style={{ animationDelay: `${200 + index * 50}ms` }}
            >
              <LegalCaseCard
                note={note}
                onClick={() => handleReadFullNote(note.id)}
              />
            </div>
          ))}

          {filteredNotes.length === 0 && !loading && (
            <div className="text-center py-16 px-6 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <FileText className="w-7 h-7 text-muted-foreground" />
              </div>
              <h3 className="font-legal-serif text-xl font-semibold text-foreground mb-2">
                {searchTerm ||
                categoryFilter !== "all" ||
                courtFilter !== "all" ||
                statusFilter !== "all"
                  ? "No matching reports"
                  : "No case reports yet"}
              </h3>
              <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto font-legal-body">
                {searchTerm ||
                categoryFilter !== "all" ||
                courtFilter !== "all" ||
                statusFilter !== "all"
                  ? "Try adjusting your search criteria"
                  : "Be the first to add a case report"}
              </p>
              {!(
                searchTerm ||
                categoryFilter !== "all" ||
                courtFilter !== "all" ||
                statusFilter !== "all"
              ) && <AddNoteDialog onNoteAdded={fetchNotes} />}
            </div>
          )}
        </div>

        <ReadFullNote
          noteId={selectedNoteId}
          open={readNoteOpen}
          onOpenChange={setReadNoteOpen}
        />
      </div>
    </div>
  );
}
