import { useState, useEffect } from "react";
import {
  FileText,
  Search,
  Filter,
  Building,
  Scale,
  Shield,
  BookOpen,
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
        has_ctc: index % 3 === 0, // Every 3rd note has CTC
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

    // Apply search term filter
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

    // Apply category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter((note) => note.category === categoryFilter);
    }

    // Apply court filter
    if (courtFilter !== "all") {
      filtered = filtered.filter((note) => note.court === courtFilter);
    }

    // Apply status filter
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
      <div className="h-full bg-gradient-legal flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-justice-blue/10 flex items-center justify-center mx-auto mb-4">
            <Scale className="w-8 h-8 text-justice-blue animate-pulse" />
          </div>
          <p className="text-muted-foreground font-legal-body">
            Loading Legal Repository...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-legal overflow-y-auto">
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
        {/* Authority Vault Header */}
        <div className="mb-10">
          {/* Badge */}
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-justice-blue/10 rounded-full border border-justice-blue/20">
              <Scale className="w-4 h-4 text-justice-blue" />
              <span className="text-sm font-medium text-justice-blue uppercase tracking-wider font-legal-body">
                Legal Authority Vault
              </span>
            </div>
          </div>

          {/* Title */}
          <h1 className="font-legal-serif text-4xl md:text-5xl font-bold text-foreground mb-4 leading-tight">
            Latest Cases Report
          </h1>

          {/* Description */}
          <p className="text-muted-foreground text-lg max-w-3xl font-legal-body leading-relaxed">
            Access instant case reports from lawyers directly from the court
            room. View and download Certified True Copies (CTC) of judgments
            with complete authenticity verification.
          </p>

          {/* Stats Row */}
          <div className="flex flex-wrap gap-6 mt-6">
            <div className="flex items-center gap-3 px-4 py-3 bg-card rounded-xl border shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-justice-blue/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-justice-blue" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground font-legal-serif">
                  {notes.length}
                </p>
                <p className="text-xs text-muted-foreground">Total Reports</p>
              </div>
            </div>

            <div className="flex items-center gap-3 px-4 py-3 bg-card rounded-xl border shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-status-verified/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-status-verified" />
              </div>
              <div>
                <p className="text-2xl font-bold text-status-verified font-legal-serif">
                  {verifiedCount}
                </p>
                <p className="text-xs text-muted-foreground">Verified CTCs</p>
              </div>
            </div>

            <div className="flex items-center gap-3 px-4 py-3 bg-card rounded-xl border shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-status-pending/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-status-pending" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground font-legal-serif">
                  {pendingCount}
                </p>
                <p className="text-xs text-muted-foreground">Pending Review</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-card border-2 rounded-2xl p-5 mb-8 shadow-sm">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search Input */}
            <div className="flex-1 relative">
              <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by title, judge, court, or keywords..."
                className="pl-12 h-12 text-base font-legal-body border-2 focus:border-justice-blue"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px] h-12 border-2">
                  <Shield className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[160px] h-12 border-2">
                  <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
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
                <SelectTrigger className="w-[180px] h-12 border-2">
                  <Building className="w-4 h-4 mr-2 text-muted-foreground" />
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
            <div className="flex items-center gap-2 mt-4 pt-4 border-t flex-wrap">
              <span className="text-sm text-muted-foreground font-legal-body">
                Active filters:
              </span>
              {searchTerm && (
                <Badge variant="secondary" className="gap-1">
                  Search: "{searchTerm}"
                  <button
                    onClick={() => setSearchTerm("")}
                    className="ml-1 hover:text-destructive"
                  >
                    ×
                  </button>
                </Badge>
              )}
              {statusFilter !== "all" && (
                <Badge variant="secondary" className="gap-1">
                  {statusFilter}
                  <button
                    onClick={() => setStatusFilter("all")}
                    className="ml-1 hover:text-destructive"
                  >
                    ×
                  </button>
                </Badge>
              )}
              {categoryFilter !== "all" && (
                <Badge variant="secondary" className="gap-1">
                  {categoryFilter}
                  <button
                    onClick={() => setCategoryFilter("all")}
                    className="ml-1 hover:text-destructive"
                  >
                    ×
                  </button>
                </Badge>
              )}
              {courtFilter !== "all" && (
                <Badge variant="secondary" className="gap-1">
                  {courtFilter}
                  <button
                    onClick={() => setCourtFilter("all")}
                    className="ml-1 hover:text-destructive"
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
                className="text-muted-foreground hover:text-foreground"
              >
                Clear all
              </Button>
            </div>
          )}
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-muted-foreground font-legal-body">
            Showing{" "}
            <span className="font-semibold text-foreground">
              {filteredNotes.length}
            </span>{" "}
            of {notes.length} case reports
          </p>
        </div>

        {/* Case Reports Grid */}
        <div className="grid gap-6">
          {filteredNotes.map((note) => (
            <LegalCaseCard
              key={note.id}
              note={note}
              onClick={() => handleReadFullNote(note.id)}
            />
          ))}

          {filteredNotes.length === 0 && !loading && (
            <div className="text-center py-20 px-6">
              <div className="w-24 h-24 rounded-full bg-justice-blue/10 flex items-center justify-center mx-auto mb-6">
                <Scale className="w-12 h-12 text-justice-blue/60" />
              </div>
              <h3 className="font-legal-serif text-2xl font-semibold text-foreground mb-3">
                {searchTerm ||
                categoryFilter !== "all" ||
                courtFilter !== "all" ||
                statusFilter !== "all"
                  ? "No matching case reports"
                  : "No case reports yet"}
              </h3>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto font-legal-body">
                {searchTerm ||
                categoryFilter !== "all" ||
                courtFilter !== "all" ||
                statusFilter !== "all"
                  ? "Try adjusting your search criteria or filters"
                  : "Be the first to add a case report and help build our legal repository"}
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
