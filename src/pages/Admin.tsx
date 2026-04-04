import { useState, useEffect } from "react";
import { Shield, Scale, Users, Globe, Plus, Check, X, Loader2, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAllCountries } from "@/hooks/useCountryId";
import { toast } from "sonner";
import { format } from "date-fns";

interface AdminCase {
  id: string;
  title: string;
  court_name: string;
  date_decided: string;
  citation: string;
  summary: string;
  full_text: string | null;
  case_tags: string[];
  is_published: boolean;
  country_id: string;
  created_at: string;
}

interface AdminLawyer {
  id: string;
  name: string;
  email: string;
  bar_number: string | null;
  specialization: string[];
  verified: boolean;
  city: string | null;
  created_at: string;
  country_id_ref: string;
  user_id: string;
}

interface Country {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
}

export default function Admin() {
  const { user } = useAuth();
  const { countries: allCountries } = useAllCountries();
  const [activeTab, setActiveTab] = useState("cases");

  // Cases state
  const [cases, setCases] = useState<AdminCase[]>([]);
  const [casesLoading, setCasesLoading] = useState(true);
  const [showCaseForm, setShowCaseForm] = useState(false);
  const [editingCase, setEditingCase] = useState<AdminCase | null>(null);
  const [caseForm, setCaseForm] = useState({
    title: "", court_name: "", date_decided: "", citation: "", summary: "", full_text: "", tags: "", country_id: "", is_published: false,
  });
  const [savingCase, setSavingCase] = useState(false);

  // Lawyers state
  const [pendingLawyers, setPendingLawyers] = useState<AdminLawyer[]>([]);
  const [verifiedLawyers, setVerifiedLawyers] = useState<AdminLawyer[]>([]);
  const [lawyersLoading, setLawyersLoading] = useState(true);

  // Countries state
  const [countriesList, setCountriesList] = useState<Country[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(true);

  useEffect(() => {
    fetchCases();
    fetchLawyers();
    fetchCountries();
  }, []);

  // ─── Cases ──────────────────────────
  async function fetchCases() {
    setCasesLoading(true);
    try {
      const { data, error } = await (supabase.from as any)("cases")
        .select("id, title, court_name, date_decided, citation, summary, full_text, case_tags, is_published, country_id, created_at")
        .not("country_id", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setCases(data || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setCasesLoading(false);
    }
  }

  function openNewCase() {
    setEditingCase(null);
    setCaseForm({ title: "", court_name: "", date_decided: "", citation: "", summary: "", full_text: "", tags: "", country_id: "", is_published: false });
    setShowCaseForm(true);
  }

  function openEditCase(c: AdminCase) {
    setEditingCase(c);
    setCaseForm({
      title: c.title, court_name: c.court_name || "", date_decided: c.date_decided || "",
      citation: c.citation || "", summary: c.summary || "", full_text: c.full_text || "",
      tags: (c.case_tags || []).join(", "), country_id: c.country_id || "", is_published: c.is_published,
    });
    setShowCaseForm(true);
  }

  async function saveCase() {
    if (!user || !caseForm.title || !caseForm.country_id) {
      toast.error("Title and Country are required");
      return;
    }
    setSavingCase(true);
    const payload = {
      title: caseForm.title,
      court_name: caseForm.court_name || null,
      date_decided: caseForm.date_decided || null,
      citation: caseForm.citation || null,
      summary: caseForm.summary || null,
      full_text: caseForm.full_text || null,
      case_tags: caseForm.tags.split(",").map((t) => t.trim()).filter(Boolean),
      is_published: caseForm.is_published,
      country_id: caseForm.country_id,
    };
    try {
      if (editingCase) {
        const { error } = await (supabase.from as any)("cases").update(payload).eq("id", editingCase.id);
        if (error) throw error;
        toast.success("Case updated");
      } else {
        const { error } = await (supabase.from as any)("cases").insert({ ...payload, user_id: user.id });
        if (error) throw error;
        toast.success("Case created");
      }
      setShowCaseForm(false);
      fetchCases();
    } catch (e: any) {
      toast.error(e.message || "Failed to save case");
    } finally {
      setSavingCase(false);
    }
  }

  async function togglePublish(c: AdminCase) {
    try {
      const { error } = await (supabase.from as any)("cases").update({ is_published: !c.is_published }).eq("id", c.id);
      if (error) throw error;
      setCases((prev) => prev.map((x) => x.id === c.id ? { ...x, is_published: !x.is_published } : x));
      toast.success(c.is_published ? "Unpublished" : "Published");
    } catch { toast.error("Failed to update"); }
  }

  async function deleteCase(id: string) {
    try {
      const { error } = await (supabase.from as any)("cases").delete().eq("id", id);
      if (error) throw error;
      setCases((prev) => prev.filter((c) => c.id !== id));
      toast.success("Case deleted");
    } catch { toast.error("Failed to delete"); }
  }

  // ─── Lawyers ──────────────────────────
  async function fetchLawyers() {
    setLawyersLoading(true);
    try {
      const { data: pending } = await (supabase.from as any)("lawyers")
        .select("id, name, email, bar_number, specialization, verified, city, created_at, country_id_ref, user_id")
        .eq("verified", false)
        .order("created_at", { ascending: false });
      const { data: verified } = await (supabase.from as any)("lawyers")
        .select("id, name, email, bar_number, specialization, verified, city, created_at, country_id_ref, user_id")
        .eq("verified", true)
        .order("created_at", { ascending: false });
      setPendingLawyers(pending || []);
      setVerifiedLawyers(verified || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLawyersLoading(false);
    }
  }

  async function verifyLawyer(id: string) {
    try {
      const { error } = await supabase.from("lawyers").update({ verified: true, verification_status: "verified" } as any).eq("id", id);
      if (error) throw error;
      toast.success("Lawyer verified");
      fetchLawyers();
    } catch { toast.error("Failed to verify"); }
  }

  async function rejectLawyer(id: string) {
    try {
      const { error } = await supabase.from("lawyers").delete().eq("id", id);
      if (error) throw error;
      toast.success("Lawyer rejected and removed");
      fetchLawyers();
    } catch { toast.error("Failed to reject"); }
  }

  async function revokeLawyer(id: string) {
    try {
      const { error } = await supabase.from("lawyers").update({ verified: false, verification_status: "pending" } as any).eq("id", id);
      if (error) throw error;
      toast.success("Verification revoked");
      fetchLawyers();
    } catch { toast.error("Failed to revoke"); }
  }

  // ─── Countries ──────────────────────────
  async function fetchCountries() {
    setCountriesLoading(true);
    try {
      const { data, error } = await (supabase.from as any)("countries").select("*").order("name");
      if (error) throw error;
      setCountriesList(data || []);
    } catch { } finally { setCountriesLoading(false); }
  }

  async function toggleCountryActive(c: Country) {
    try {
      const { error } = await (supabase.from as any)("countries").update({ is_active: !c.is_active }).eq("id", c.id);
      if (error) throw error;
      setCountriesList((prev) => prev.map((x) => x.id === c.id ? { ...x, is_active: !x.is_active } : x));
    } catch { toast.error("Failed to update"); }
  }

  const getCountryName = (id: string) => allCountries.find((c) => c.id === id)?.name || countriesList.find((c) => c.id === id)?.name || "—";

  return (
    <div className="h-full bg-background overflow-y-auto">
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
            <p className="text-muted-foreground text-sm">Manage cases, lawyers, and countries</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="cases"><Scale className="w-4 h-4 mr-1" /> Cases</TabsTrigger>
            <TabsTrigger value="lawyers"><Users className="w-4 h-4 mr-1" /> Lawyers</TabsTrigger>
            <TabsTrigger value="countries"><Globe className="w-4 h-4 mr-1" /> Countries</TabsTrigger>
          </TabsList>

          {/* ─── Cases Tab ─── */}
          <TabsContent value="cases">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-foreground">All Cases ({cases.length})</h2>
              <Button onClick={openNewCase} size="sm"><Plus className="w-4 h-4 mr-1" /> New Case</Button>
            </div>
            {casesLoading ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : (
              <div className="border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>Court</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cases.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium max-w-[200px] truncate">{c.title}</TableCell>
                        <TableCell className="text-sm">{getCountryName(c.country_id)}</TableCell>
                        <TableCell className="text-sm">{c.court_name || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={c.is_published ? "default" : "secondary"} className="text-xs">
                            {c.is_published ? "Published" : "Draft"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditCase(c)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => togglePublish(c)}>
                              {c.is_published ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete case?</AlertDialogTitle>
                                  <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteCase(c.id)}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* ─── Lawyers Tab ─── */}
          <TabsContent value="lawyers">
            <h2 className="text-lg font-semibold text-foreground mb-4">Pending Verification ({pendingLawyers.length})</h2>
            {lawyersLoading ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : pendingLawyers.length === 0 ? (
              <p className="text-muted-foreground text-sm mb-6">No pending lawyers.</p>
            ) : (
              <div className="space-y-3 mb-8">
                {pendingLawyers.map((l) => (
                  <div key={l.id} className="p-4 rounded-xl border border-border/50 bg-card flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{l.name}</p>
                      <p className="text-xs text-muted-foreground">{l.email} · {getCountryName(l.country_id_ref)} · Bar: {l.bar_number || "N/A"}</p>
                      <div className="flex gap-1 mt-1">
                        {l.specialization?.map((s) => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => verifyLawyer(l.id)}>
                        <Check className="w-4 h-4 mr-1" /> Verify
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="destructive"><X className="w-4 h-4 mr-1" /> Reject</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Reject this lawyer?</AlertDialogTitle>
                            <AlertDialogDescription>This will delete their profile.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => rejectLawyer(l.id)}>Reject</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <h2 className="text-lg font-semibold text-foreground mb-4">Verified Lawyers ({verifiedLawyers.length})</h2>
            {verifiedLawyers.length === 0 ? (
              <p className="text-muted-foreground text-sm">No verified lawyers.</p>
            ) : (
              <div className="space-y-3">
                {verifiedLawyers.map((l) => (
                  <div key={l.id} className="p-4 rounded-xl border border-border/50 bg-card flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{l.name}</p>
                      <p className="text-xs text-muted-foreground">{getCountryName(l.country_id_ref)} · {l.city || ""}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => revokeLawyer(l.id)}>Revoke</Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ─── Countries Tab ─── */}
          <TabsContent value="countries">
            <h2 className="text-lg font-semibold text-foreground mb-4">Countries ({countriesList.length})</h2>
            {countriesLoading ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : (
              <div className="border rounded-xl overflow-hidden max-h-[60vh] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead className="text-right">Active</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {countriesList.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{c.name}</TableCell>
                        <TableCell>{c.code}</TableCell>
                        <TableCell className="text-right">
                          <Switch checked={c.is_active} onCheckedChange={() => toggleCountryActive(c)} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* ─── Case Form Dialog ─── */}
        <Dialog open={showCaseForm} onOpenChange={setShowCaseForm}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingCase ? "Edit Case" : "New Case"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Country *</Label>
                <Select value={caseForm.country_id} onValueChange={(v) => setCaseForm({ ...caseForm, country_id: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select country" /></SelectTrigger>
                  <SelectContent className="max-h-60">
                    {allCountries.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Title *</Label>
                <Input value={caseForm.title} onChange={(e) => setCaseForm({ ...caseForm, title: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Court</Label>
                <Input value={caseForm.court_name} onChange={(e) => setCaseForm({ ...caseForm, court_name: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Date Decided</Label>
                <Input type="date" value={caseForm.date_decided} onChange={(e) => setCaseForm({ ...caseForm, date_decided: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Citation</Label>
                <Input value={caseForm.citation} onChange={(e) => setCaseForm({ ...caseForm, citation: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Summary</Label>
                <Textarea value={caseForm.summary} onChange={(e) => setCaseForm({ ...caseForm, summary: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Full Text</Label>
                <Textarea value={caseForm.full_text} onChange={(e) => setCaseForm({ ...caseForm, full_text: e.target.value })} className="mt-1 min-h-[120px]" />
              </div>
              <div>
                <Label>Tags (comma-separated)</Label>
                <Input value={caseForm.tags} onChange={(e) => setCaseForm({ ...caseForm, tags: e.target.value })} placeholder="e.g. Criminal, Constitutional" className="mt-1" />
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={caseForm.is_published} onCheckedChange={(v) => setCaseForm({ ...caseForm, is_published: v })} />
                <Label>Publish immediately</Label>
              </div>
            </div>
            <Button onClick={saveCase} disabled={savingCase} className="w-full mt-2">
              {savingCase ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editingCase ? "Update Case" : "Create Case"}
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
