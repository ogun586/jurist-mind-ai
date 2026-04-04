import { useState, useEffect } from "react";
import { Users, Search, Globe, MapPin, Star, Send, Check, Loader2, Shield, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
}

export default function LawyersDirectory() {
  const { user, profile } = useAuth();
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

  // Lawyer registration state
  const [showRegister, setShowRegister] = useState(false);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [regBarNumber, setRegBarNumber] = useState("");
  const [regSpecs, setRegSpecs] = useState("");
  const [regYears, setRegYears] = useState("");
  const [regBio, setRegBio] = useState("");
  const [regRate, setRegRate] = useState("");
  const [regCity, setRegCity] = useState("");
  const [regAvailable, setRegAvailable] = useState(true);
  const [registering, setRegistering] = useState(false);

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
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <p>Loading your profile…</p>
        </div>
      </div>
    );
  }

  async function fetchLawyers(cId: string) {
    setLoading(true);
    try {
      const { data, error } = await (supabase.from as any)("lawyers")
        .select("id, user_id, specialization, years_experience, description, city, verified, is_available, hourly_rate, bar_number, name, country_id_ref")
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

  async function handleRegister() {
    if (!user || !countryId) return;
    if (!regBio.trim()) { toast.error("Please provide a bio"); return; }
    setRegistering(true);
    try {
      const specs = regSpecs.split(",").map((s) => s.trim()).filter(Boolean);
      const { error } = await (supabase.from as any)("lawyers").insert({
        user_id: user.id,
        name: profile?.full_name || profile?.display_name || "Unnamed",
        email: profile?.email || "",
        state: userCountry,
        country_id_ref: countryId,
        bar_number: regBarNumber || null,
        specialization: specs,
        years_experience: parseInt(regYears) || 0,
        description: regBio,
        hourly_rate: regRate ? parseFloat(regRate) : null,
        city: regCity || null,
        is_available: regAvailable,
      });
      if (error) throw error;
      toast.success("Profile submitted for verification!");
      setShowRegister(false);
      setHasProfile(true);
    } catch (e: any) {
      toast.error(e.message || "Failed to register");
    } finally {
      setRegistering(false);
    }
  }

  const allSpecs = [...new Set(lawyers.flatMap((l) => l.specialization || []))].sort();

  const filtered = lawyers.filter((l) => {
    const matchSearch = !searchTerm || l.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchSpec = !selectedSpec || (l.specialization || []).includes(selectedSpec);
    return matchSearch && matchSpec;
  });

  return (
    <div className="h-full bg-background overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6">
        {/* Lawyer Registration Banner */}
        {profile?.user_type?.toLowerCase() === "lawyer" && hasProfile === false && (
          <div className="mb-6 p-4 rounded-xl border border-primary/20 bg-primary/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    You are registered as a lawyer. Complete your profile to appear in the directory.
                  </p>
                </div>
              </div>
              <Button size="sm" onClick={() => setShowRegister(true)}>Complete Profile</Button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" />
              Lawyers Directory
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Connect with verified legal professionals</p>
          </div>
          <Select value={selectedCountryId || ""} onValueChange={(v) => setSelectedCountryId(v)}>
            <SelectTrigger className="w-52">
              <Globe className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {countries.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search lawyers..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
        </div>

        {/* Spec Filters */}
        {allSpecs.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {selectedSpec && (
              <Badge variant="outline" className="cursor-pointer bg-primary/10 text-primary" onClick={() => setSelectedSpec(null)}>
                {selectedSpec} ✕
              </Badge>
            )}
            {allSpecs.filter((s) => s !== selectedSpec).slice(0, 10).map((s) => (
              <Badge key={s} variant="outline" className="cursor-pointer hover:bg-primary/5" onClick={() => setSelectedSpec(s)}>
                {s}
              </Badge>
            ))}
          </div>
        )}

        {/* Lawyers List */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-foreground mb-1">No verified lawyers</h3>
            <p className="text-muted-foreground text-sm">
              No verified lawyers listed in {countries.find((c) => c.id === selectedCountryId)?.name || "this country"} yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((lawyer) => (
              <div key={lawyer.id} className="p-5 rounded-xl border border-border/50 bg-card hover:border-primary/20 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">{lawyer.name}</h3>
                    {lawyer.city && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" /> {lawyer.city}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">
                    <Shield className="w-3 h-3 mr-1" /> Verified
                  </Badge>
                </div>

                {lawyer.specialization?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {lawyer.specialization.slice(0, 3).map((s) => (
                      <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  {lawyer.years_experience > 0 && (
                    <span className="flex items-center gap-1">
                      <Briefcase className="w-3 h-3" /> {lawyer.years_experience} yrs
                    </span>
                  )}
                  {lawyer.hourly_rate && <span>₦{lawyer.hourly_rate.toLocaleString()}/hr</span>}
                </div>

                {lawyer.description && (
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{lawyer.description}</p>
                )}

                <div className="mt-4">
                  {sentRequests.has(lawyer.id) ? (
                    <Button variant="outline" size="sm" disabled>
                      <Check className="w-4 h-4 mr-1" /> Request Sent
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => setConnectingLawyer(lawyer)}>
                      <Send className="w-4 h-4 mr-1" /> Connect
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Connect Dialog */}
        <Dialog open={!!connectingLawyer} onOpenChange={(o) => !o && setConnectingLawyer(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connect with {connectingLawyer?.name}</DialogTitle>
            </DialogHeader>
            <Textarea
              placeholder="Write a message..."
              value={connectMessage}
              onChange={(e) => setConnectMessage(e.target.value)}
              className="min-h-[100px]"
            />
            <Button onClick={handleConnect} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Send Request
            </Button>
          </DialogContent>
        </Dialog>

        {/* Register Dialog */}
        <Dialog open={showRegister} onOpenChange={setShowRegister}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Complete Your Lawyer Profile</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
              <div>
                <Label>Bar Number</Label>
                <Input value={regBarNumber} onChange={(e) => setRegBarNumber(e.target.value)} placeholder="e.g. SCN/12345" className="mt-1" />
              </div>
              <div>
                <Label>Specializations (comma-separated)</Label>
                <Input value={regSpecs} onChange={(e) => setRegSpecs(e.target.value)} placeholder="e.g. Criminal Law, Corporate Law" className="mt-1" />
              </div>
              <div>
                <Label>Years of Experience</Label>
                <Input type="number" value={regYears} onChange={(e) => setRegYears(e.target.value)} placeholder="e.g. 5" className="mt-1" />
              </div>
              <div>
                <Label>Bio *</Label>
                <Textarea value={regBio} onChange={(e) => setRegBio(e.target.value)} placeholder="Tell clients about yourself..." className="mt-1" />
              </div>
              <div>
                <Label>Hourly Rate (₦)</Label>
                <Input type="number" value={regRate} onChange={(e) => setRegRate(e.target.value)} placeholder="e.g. 50000" className="mt-1" />
              </div>
              <div>
                <Label>City</Label>
                <Input value={regCity} onChange={(e) => setRegCity(e.target.value)} placeholder="e.g. Lagos" className="mt-1" />
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={regAvailable} onCheckedChange={setRegAvailable} />
                <Label>Available for hire</Label>
              </div>
            </div>
            <Button onClick={handleRegister} disabled={registering} className="w-full mt-2">
              {registering ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Submit for Verification
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
