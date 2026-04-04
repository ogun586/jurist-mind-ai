import { useState, useEffect } from "react";
import { Scale, Search, Globe, Calendar, BookOpen, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCountryId, useAllCountries } from "@/hooks/useCountryId";
import { format } from "date-fns";

interface LegalCase {
  id: string;
  title: string;
  summary: string;
  court_name: string;
  date_decided: string;
  citation: string;
  full_text: string | null;
  case_tags: string[];
  created_at: string;
  country_id: string;
}

export default function Cases() {
  const { profile } = useAuth();
  const userCountry = profile?.country;
  const { countryId } = useCountryId();
  const { countries } = useAllCountries();

  const [cases, setCases] = useState<LegalCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [viewingCase, setViewingCase] = useState<LegalCase | null>(null);

  useEffect(() => {
    if (countryId && !selectedCountryId) setSelectedCountryId(countryId);
  }, [countryId, selectedCountryId]);

  useEffect(() => {
    if (selectedCountryId) fetchCases(selectedCountryId);
  }, [selectedCountryId]);

  if (!userCountry) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <p>Loading your profile…</p>
        </div>
      </div>
    );
  }

  async function fetchCases(cId: string) {
    setLoading(true);
    try {
      const { data, error } = await (supabase.from as any)("cases")
        .select("id, title, summary, court_name, date_decided, citation, full_text, case_tags, created_at, country_id")
        .eq("country_id", cId)
        .eq("is_published", true)
        .order("date_decided", { ascending: false });
      if (error) throw error;
      setCases(data || []);
    } catch {
      console.error("Failed to fetch cases");
    } finally {
      setLoading(false);
    }
  }

  const allTags = [...new Set(cases.flatMap((c) => c.case_tags || []))].sort();

  const filtered = cases.filter((c) => {
    const matchSearch = !searchTerm || c.title.toLowerCase().includes(searchTerm.toLowerCase()) || c.citation?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchTag = !selectedTag || (c.case_tags || []).includes(selectedTag);
    return matchSearch && matchTag;
  });

  return (
    <div className="h-full bg-background overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Scale className="w-6 h-6 text-primary" /> Case Law Library
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Published case reports and judgments</p>
          </div>
          <Select value={selectedCountryId || ""} onValueChange={setSelectedCountryId}>
            <SelectTrigger className="w-52">
              <Globe className="w-4 h-4 mr-2 text-muted-foreground" /><SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {countries.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="relative mb-4">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by title or citation..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
        </div>

        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {selectedTag && (
              <Badge variant="outline" className="cursor-pointer bg-primary/10 text-primary border-primary/30" onClick={() => setSelectedTag(null)}>
                {selectedTag} <X className="w-3 h-3 ml-1" />
              </Badge>
            )}
            {allTags.filter((t) => t !== selectedTag).map((tag) => (
              <Badge key={tag} variant="outline" className="cursor-pointer hover:bg-primary/5" onClick={() => setSelectedTag(tag)}>{tag}</Badge>
            ))}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-foreground mb-1">No case reports</h3>
            <p className="text-muted-foreground text-sm">
              No case reports published for {countries.find((c) => c.id === selectedCountryId)?.name || "this country"} yet.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((c) => (
              <button key={c.id} onClick={() => setViewingCase(c)} className="w-full text-left p-5 rounded-xl border border-border/50 bg-card hover:border-primary/20 transition-colors">
                <h3 className="text-base font-semibold text-foreground">{c.title}</h3>
                <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                  {c.court_name && <span className="flex items-center gap-1"><Scale className="w-3 h-3" /> {c.court_name}</span>}
                  {c.citation && <span className="font-mono">{c.citation}</span>}
                  {c.date_decided && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {format(new Date(c.date_decided), "MMM d, yyyy")}</span>}
                </div>
                {c.summary && <p className="text-muted-foreground text-sm mt-3 line-clamp-3">{c.summary}</p>}
                {c.case_tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {c.case_tags.map((t) => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        <Dialog open={!!viewingCase} onOpenChange={(o) => !o && setViewingCase(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh]">
            <DialogHeader><DialogTitle className="text-xl">{viewingCase?.title}</DialogTitle></DialogHeader>
            <ScrollArea className="max-h-[65vh] pr-4">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  {viewingCase?.court_name && <span><strong>Court:</strong> {viewingCase.court_name}</span>}
                  {viewingCase?.citation && <span><strong>Citation:</strong> {viewingCase.citation}</span>}
                  {viewingCase?.date_decided && <span><strong>Decided:</strong> {format(new Date(viewingCase.date_decided), "PPP")}</span>}
                </div>
                {viewingCase?.case_tags?.length ? (
                  <div className="flex flex-wrap gap-1.5">{viewingCase.case_tags.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}</div>
                ) : null}
                {viewingCase?.summary && <div><h4 className="font-semibold text-foreground mb-1">Summary</h4><p className="text-muted-foreground text-sm whitespace-pre-wrap">{viewingCase.summary}</p></div>}
                {viewingCase?.full_text && <div><h4 className="font-semibold text-foreground mb-1">Full Text</h4><p className="text-muted-foreground text-sm whitespace-pre-wrap">{viewingCase.full_text}</p></div>}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
