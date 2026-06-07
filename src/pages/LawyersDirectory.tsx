import { useState, useEffect, useMemo } from "react";
import { Users, Search, Globe, MapPin, Send, Check, Loader2, Shield, Briefcase, Filter, Star, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCountryId, useAllCountries } from "@/hooks/useCountryId";
import { toast } from "sonner";

interface LawyerRow {
  id: string;
  user_id: string;
  specialization: string[];
  years_experience: number;
  description: string | null;
  city: string | null;
  verified: boolean;
  is_available: boolean;
  hourly_rate: number | null;
  bar_number: string | null;
  name: string;
  country_id_ref: string;
  rating: number | null;
  total_ratings: number | null;
}

export default function LawyersDirectory() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const userCountry = profile?.country;
  const { countryId } = useCountryId();
  const { countries } = useAllCountries();

  const [lawyers, setLawyers] = useState<LawyerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSpec, setSelectedSpec] = useState<string | null>(null);
  const [connectingLawyer, setConnectingLawyer] = useState<LawyerRow | null>(null);
  const [connectMessage, setConnectMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  const [hasProfile, setHasProfile] = useState<boolean | null>(null);

  useEffect(() => {
    if (countryId && !selectedCountryId) setSelectedCountryId(countryId);
  }, [countryId]);

  useEffect(() => {
    if (selectedCountryId) fetchLawyers(selectedCountryId);
  }, [selectedCountryId]);

  useEffect(() => {
    if (user) {
      fetchSentRequests();
      checkLawyerProfile();
    }
  }, [user]);

  if (!userCountry) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0a0a0a]">
        <div className="flex items-center gap-3 text-[#a3a3a3]">
          <Loader2 className="w-5 h-5 animate-spin text-[#d4a843]" />
          <p>Loading your profile…</p>
        </div>
      </div>
    );
  }

  async function fetchLawyers(cId: string) {
    setLoading(true);
    try {
      const { data, error } = await (supabase.from as any)("lawyers")
        .select("id, user_id, specialization, years_experience, description, city, verified, is_available, hourly_rate, bar_number, name, country_id_ref, rating, total_ratings")
        .eq("country_id_ref", cId)
        .eq("verified", true)
        .eq("is_available", true);
      if (error) throw error;
      setLawyers(data || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSentRequests() {
    if (!user) return;
    try {
      const { data } = await (supabase.from as any)("lawyer_contact_requests")
        .select("lawyer_id")
        .eq("requester_id", user.id);
      if (data) setSentRequests(new Set(data.map((d: any) => d.lawyer_id)));
    } catch {}
  }

  async function checkLawyerProfile() {
    if (!user) return;
    try {
      const { data } = await supabase.from("lawyers").select("id").eq("user_id", user.id).maybeSingle();
      setHasProfile(!!data);
    } catch { setHasProfile(false); }
  }

  async function handleConnect() {
    if (!connectingLawyer || !user || !connectMessage.trim()) {
      toast.error("Please write a message");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await (supabase.from as any)("lawyer_contact_requests").insert({
        lawyer_id: connectingLawyer.id,
        requester_id: user.id,
        message: connectMessage,
      });
      if (error) throw error;
      setSentRequests((prev) => new Set([...prev, connectingLawyer.id]));
      toast.success("Request sent!");
      setConnectingLawyer(null);
      setConnectMessage("");
    } catch (e: any) {
      toast.error(e.message?.includes("unique") ? "Request already sent" : "Failed to send request");
    } finally {
      setSubmitting(false);
    }
  }

  const allSpecs = useMemo(() => [...new Set(lawyers.flatMap((l) => l.specialization || []))].sort(), [lawyers]);

  const filtered = useMemo(() => lawyers.filter((l) => {
    const matchSearch = !searchTerm || l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.description || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.city || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchSpec = !selectedSpec || (l.specialization || []).includes(selectedSpec);
    return matchSearch && matchSpec;
  }), [lawyers, searchTerm, selectedSpec]);

  const selectedCountryName = countries.find((c) => c.id === selectedCountryId)?.name || userCountry || "";

  // Stats
  const onlineCount = lawyers.filter(l => l.is_available).length;
  const topRatedCount = lawyers.filter(l => (l.rating || 0) >= 4.5).length;
  const uniqueCities = new Set(lawyers.map(l => l.city).filter(Boolean)).size;

  return (
    <div className="h-full bg-[#0a0a0a] overflow-y-auto">
      {/* Header Strip */}
      <div className="sticky top-0 z-30 bg-[#0a0a0a]/95 backdrop-blur border-b border-[#262626]">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-[72px] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#d4a843] flex items-center justify-center shrink-0">
              <span className="text-black font-bold text-sm">J</span>
            </div>
            <div className="hidden sm:flex items-baseline gap-1">
              <span className="text-white font-semibold tracking-tight">JURIST</span>
              <span className="text-[#737373] font-medium tracking-tight">MIND</span>
            </div>
            <span className="hidden md:inline-block ml-3 pl-3 border-l border-[#262626] text-[11px] uppercase tracking-[0.15em] text-[#737373]">
              Lawyers Directory
            </span>
          </div>
          <Button
            onClick={() => navigate("/join")}
            className="h-9 rounded-full bg-[#d4a843] text-black hover:bg-[#e8c566] active:scale-[0.97] font-semibold text-xs px-5"
          >
            Join as a Lawyer
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-6">
        {/* Hero */}
        <div className="mb-8 pt-2">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#737373] mb-3">
            Verified Legal Professionals
          </p>
          <h1 className="text-3xl md:text-5xl font-semibold text-white tracking-tight" style={{ letterSpacing: "-0.02em" }}>
            Connect with a Lawyer
          </h1>
          <p className="mt-3 text-[#a3a3a3] text-sm md:text-base max-w-2xl leading-relaxed">
            Discover trusted lawyers and firms across {selectedCountryName}. Vetted credentials, transparent ratings, direct contact.
          </p>

          {/* Stat strip */}
          <div className="mt-6 grid grid-cols-3 max-w-xl gap-px rounded-2xl overflow-hidden border border-[#262626] bg-[#262626]">
            <Stat label="Online Now" value={onlineCount} accent dot />
            <Stat label="Top Rated" value={topRatedCount} icon={<Star className="w-3.5 h-3.5 text-[#d4a843]" />} />
            <Stat label={uniqueCities === 1 ? "City" : "Cities"} value={uniqueCities} icon={<MapPin className="w-3.5 h-3.5 text-[#737373]" />} />
          </div>
        </div>

        {/* Search Row */}
        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#737373]" />
            <Input
              placeholder="Search by name, firm, or practice area..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-11 h-12 rounded-full bg-[#141414] border-[#262626] text-white placeholder:text-[#737373] focus-visible:border-[#d4a843] focus-visible:ring-1 focus-visible:ring-[#d4a843]/30"
            />
          </div>
          <Select value={selectedCountryId || ""} onValueChange={(v) => setSelectedCountryId(v)}>
            <SelectTrigger className="md:w-52 h-12 rounded-full bg-[#141414] border-[#262626] text-white focus:ring-1 focus:ring-[#d4a843]/30">
              <Globe className="w-4 h-4 mr-2 text-[#737373]" />
              <SelectValue placeholder="Country" />
            </SelectTrigger>
            <SelectContent className="max-h-72 bg-[#141414] border-[#262626] text-white">
              {countries.map((c) => (
                <SelectItem key={c.id} value={c.id} className="focus:bg-[#1a1a1a] focus:text-white">
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="h-12 rounded-full bg-transparent border-[#333333] text-white hover:bg-[#1a1a1a] hover:border-[#d4a843] hover:text-white"
          >
            <Filter className="w-4 h-4 mr-2" /> Filters
          </Button>
        </div>

        {/* Spec Filters */}
        {showFilters && allSpecs.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6 p-5 rounded-2xl border border-[#262626] bg-[#141414] animate-fade-in">
            <span className="text-[11px] uppercase tracking-widest text-[#737373] mr-2 self-center">Practice Areas</span>
            {selectedSpec && (
              <button
                onClick={() => setSelectedSpec(null)}
                className="text-xs px-3 py-1.5 rounded-lg bg-[#d4a843] text-black font-medium"
              >
                {selectedSpec} ✕
              </button>
            )}
            {allSpecs.filter((s) => s !== selectedSpec).slice(0, 18).map((s) => (
              <button
                key={s}
                onClick={() => setSelectedSpec(s)}
                className="text-xs px-3 py-1.5 rounded-lg bg-[#1a1a1a] text-[#a3a3a3] border border-[#262626] hover:border-[#d4a843] hover:text-white transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {user && hasProfile === false && (
          <div className="mb-6 p-5 rounded-2xl border-l-4 border-l-[#d4a843] border border-[#262626] bg-[#141414] flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#d4a843]/10 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-[#d4a843]" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-[#d4a843] font-bold">For Lawyers</p>
                <p className="text-sm text-white mt-0.5 truncate">
                  Claim your verified legal identity in {selectedCountryName}.
                </p>
              </div>
            </div>
            <Button
              onClick={() => navigate("/join")}
              className="h-10 rounded-full bg-[#d4a843] text-black hover:bg-[#e8c566] active:scale-[0.97] font-semibold text-xs px-5 shrink-0"
            >
              Join as a Lawyer
            </Button>
          </div>
        )}

        {/* Lawyers Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-2xl bg-[#1a1a1a]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border border-[#262626] bg-[#141414]">
            <div className="w-14 h-14 rounded-2xl bg-[#1a1a1a] border border-[#262626] mx-auto mb-4 flex items-center justify-center">
              <Users className="w-6 h-6 text-[#737373]" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">No verified lawyers</h3>
            <p className="text-[#a3a3a3] text-sm">
              No verified lawyers listed in {selectedCountryName} yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map((lawyer) => {
              const topRated = (lawyer.rating || 0) >= 4.5 && (lawyer.total_ratings || 0) >= 5;
              const initials = lawyer.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
              return (
                <div
                  key={lawyer.id}
                  onClick={() => navigate(`/lawyers/${lawyer.id}`)}
                  className="group relative p-6 rounded-2xl border border-[#262626] bg-[#141414] hover:bg-[#1a1a1a] hover:border-[#333333] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer flex flex-col"
                >
                  {topRated && (
                    <div className="absolute top-4 right-4 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#d4a843]/10 border border-[#d4a843]/30">
                      <Star className="w-3 h-3 fill-[#d4a843] text-[#d4a843]" />
                      <span className="text-[10px] font-bold text-[#d4a843] uppercase tracking-wider">Top</span>
                    </div>
                  )}

                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-[#1a1a1a] ring-2 ring-[#262626] flex items-center justify-center text-white font-semibold text-base shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-white truncate" style={{ letterSpacing: "-0.01em" }}>
                        {lawyer.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 text-xs">
                        {(lawyer.rating || 0) > 0 ? (
                          <span className="flex items-center gap-1">
                            <Star className="w-3 h-3 fill-[#d4a843] text-[#d4a843]" />
                            <span className="text-white font-semibold">{lawyer.rating?.toFixed(1)}</span>
                            <span className="text-[#737373]">({lawyer.total_ratings})</span>
                          </span>
                        ) : (
                          <span className="text-[#737373]">New profile</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-[#a3a3a3]">
                        {lawyer.city && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-[#737373]" /> {lawyer.city}
                          </span>
                        )}
                        {lawyer.years_experience > 0 && (
                          <span className="flex items-center gap-1">
                            <Briefcase className="w-3 h-3 text-[#737373]" /> {lawyer.years_experience}y
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {lawyer.specialization?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-4">
                      {lawyer.specialization.slice(0, 3).map((s) => (
                        <span
                          key={s}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg bg-[#1a1a1a] text-[#a3a3a3] border border-[#262626] group-hover:border-[#333333]"
                        >
                          {s}
                        </span>
                      ))}
                      {lawyer.specialization.length > 3 && (
                        <span className="text-xs font-medium px-3 py-1.5 rounded-lg bg-[#1a1a1a] text-[#737373] border border-[#262626]">
                          +{lawyer.specialization.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {lawyer.description && (
                    <p className="text-sm text-[#a3a3a3] mt-4 line-clamp-2 leading-relaxed">
                      {lawyer.description}
                    </p>
                  )}

                  <div className="mt-5 pt-5 border-t border-[#262626] flex items-center gap-2">
                    {sentRequests.has(lawyer.id) ? (
                      <Button
                        size="sm"
                        disabled
                        className="flex-1 h-10 rounded-xl bg-[#1a1a1a] text-[#22c55e] border border-[#22c55e]/20 hover:bg-[#1a1a1a]"
                      >
                        <Check className="w-4 h-4 mr-1.5" /> Request Sent
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); setConnectingLawyer(lawyer); }}
                        className="flex-1 h-10 rounded-xl bg-[#d4a843] text-black font-semibold hover:bg-[#e6c060] active:scale-[0.98] transition-all"
                      >
                        <Send className="w-4 h-4 mr-1.5" /> Connect
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => { e.stopPropagation(); navigate(`/lawyers/${lawyer.id}`); }}
                      className="h-10 rounded-xl bg-transparent border-[#333333] text-white hover:bg-[#1a1a1a] hover:border-[#d4a843] hover:text-white"
                    >
                      View <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Connect Dialog */}
        <Dialog open={!!connectingLawyer} onOpenChange={(o) => !o && setConnectingLawyer(null)}>
          <DialogContent className="bg-[#141414] border border-[#262626] text-white rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-white" style={{ letterSpacing: "-0.01em" }}>
                Connect with {connectingLawyer?.name}
              </DialogTitle>
            </DialogHeader>
            <Textarea
              placeholder="Briefly describe what you need help with..."
              value={connectMessage}
              onChange={(e) => setConnectMessage(e.target.value)}
              className="min-h-[120px] bg-[#1a1a1a] border-[#262626] text-white placeholder:text-[#737373] rounded-xl focus-visible:border-[#d4a843] focus-visible:ring-1 focus-visible:ring-[#d4a843]/30"
            />
            <Button
              onClick={handleConnect}
              disabled={submitting}
              className="h-12 rounded-xl bg-[#d4a843] text-black font-semibold hover:bg-[#e6c060] active:scale-[0.98] transition-all"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Send Request
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function Stat({
  label, value, icon, accent, dot,
}: { label: string; value: number; icon?: React.ReactNode; accent?: boolean; dot?: boolean }) {
  return (
    <div className="bg-[#141414] p-4 flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        {dot && <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />}
        {icon}
        <span className="text-[10px] uppercase tracking-widest text-[#737373] font-medium">{label}</span>
      </div>
      <span className={`text-2xl font-semibold ${accent ? "text-[#22c55e]" : "text-white"}`} style={{ letterSpacing: "-0.02em" }}>
        {value}
      </span>
    </div>
  );
}
