import { useState, useEffect } from "react";
import { Briefcase, MapPin, Clock, Globe, Search, Plus, Send, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCountryId, useAllCountries } from "@/hooks/useCountryId";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Job {
  id: string;
  title: string;
  company: string;
  description: string;
  job_type: string;
  location: string;
  is_remote: boolean;
  is_active: boolean;
  created_at: string;
  posted_by: string;
  country_id: string;
}

export default function Jobs() {
  const { user, profile } = useAuth();
  const userCountry = profile?.country;
  const { countryId } = useCountryId();
  const { countries } = useAllCountries();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("browse");
  const [applyingJob, setApplyingJob] = useState<Job | null>(null);
  const [coverNote, setCoverNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [appliedJobs, setAppliedJobs] = useState<Set<string>>(new Set());

  const [postTitle, setPostTitle] = useState("");
  const [postCompany, setPostCompany] = useState("");
  const [postJobType, setPostJobType] = useState("full-time");
  const [postLocation, setPostLocation] = useState("");
  const [postIsRemote, setPostIsRemote] = useState(false);
  const [postDescription, setPostDescription] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (countryId && !selectedCountryId) setSelectedCountryId(countryId);
  }, [countryId, selectedCountryId]);

  useEffect(() => {
    if (selectedCountryId) fetchJobs(selectedCountryId);
  }, [selectedCountryId]);

  useEffect(() => {
    if (user) fetchAppliedJobs();
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

  async function fetchJobs(cId: string) {
    setLoading(true);
    try {
      const { data, error } = await (supabase.from as any)("jobs")
        .select("*")
        .eq("country_id", cId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setJobs(data || []);
    } catch {
      toast.error("Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }

  async function fetchAppliedJobs() {
    if (!user) return;
    try {
      const { data } = await supabase.from("job_applications").select("job_id").eq("applicant_id", user.id);
      if (data) setAppliedJobs(new Set(data.map((d) => d.job_id)));
    } catch {}
  }

  async function handleApply() {
    if (!applyingJob || !user) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("job_applications").insert({
        job_id: applyingJob.id,
        applicant_id: user.id,
        cover_letter: coverNote || null,
      });
      if (error) throw error;
      setAppliedJobs((prev) => new Set([...prev, applyingJob.id]));
      toast.success("Application submitted!");
      setApplyingJob(null);
      setCoverNote("");
    } catch (e: any) {
      toast.error(e.message?.includes("unique") ? "You already applied" : "Failed to apply");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePostJob() {
    if (!user || !countryId) return;
    if (!postTitle.trim() || !postCompany.trim() || !postDescription.trim() || !postLocation.trim()) {
      toast.error("Please fill all required fields");
      return;
    }
    setPosting(true);
    try {
      const { error } = await (supabase.from as any)("jobs").insert({
        title: postTitle, company: postCompany, job_type: postJobType,
        location: postLocation, is_remote: postIsRemote, description: postDescription,
        posted_by: user.id, country_id: countryId, is_active: true,
      });
      if (error) throw error;
      toast.success("Job posted successfully!");
      setPostTitle(""); setPostCompany(""); setPostDescription(""); setPostLocation(""); setPostIsRemote(false);
      setActiveTab("browse");
      if (selectedCountryId) fetchJobs(selectedCountryId);
    } catch {
      toast.error("Failed to post job");
    } finally {
      setPosting(false);
    }
  }

  const filteredJobs = jobs.filter(
    (j) => j.title.toLowerCase().includes(searchTerm.toLowerCase()) || j.company.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const jobTypeBadgeColor: Record<string, string> = {
    "full-time": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    "part-time": "bg-blue-500/10 text-blue-400 border-blue-500/20",
    contract: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    internship: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  };

  return (
    <div className="h-full bg-background overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Briefcase className="w-6 h-6 text-primary" /> Legal Jobs
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Find and post legal job opportunities</p>
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

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="browse">Browse Jobs</TabsTrigger>
            <TabsTrigger value="post"><Plus className="w-4 h-4 mr-1" /> Post a Job</TabsTrigger>
          </TabsList>

          <TabsContent value="browse">
            <div className="relative mb-6">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search jobs..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            {loading ? (
              <div className="space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>
            ) : filteredJobs.length === 0 ? (
              <div className="text-center py-16">
                <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-foreground mb-1">No job listings yet</h3>
                <p className="text-muted-foreground text-sm">Be the first to post one.</p>
                <Button className="mt-4" onClick={() => setActiveTab("post")}><Plus className="w-4 h-4 mr-1" /> Post a Job</Button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredJobs.map((job) => (
                  <div key={job.id} className="p-5 rounded-xl border border-border/50 bg-card hover:border-primary/20 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-foreground">{job.title}</h3>
                        <p className="text-primary font-medium text-sm">{job.company}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <Badge variant="outline" className={jobTypeBadgeColor[job.job_type] || ""}>{job.job_type}</Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" /> {job.location}</span>
                          {job.is_remote && <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-xs">Remote</Badge>}
                        </div>
                        <p className="text-muted-foreground text-sm mt-3 line-clamp-2">{job.description}</p>
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <div className="ml-4 flex-shrink-0">
                        {appliedJobs.has(job.id) ? (
                          <Button variant="outline" disabled size="sm"><Check className="w-4 h-4 mr-1" /> Applied</Button>
                        ) : (
                          <Button size="sm" onClick={() => setApplyingJob(job)}>Apply</Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="post">
            <div className="max-w-lg space-y-4">
              <div><Label>Country</Label><Input value={userCountry} disabled className="mt-1 opacity-70" /></div>
              <div><Label>Job Title *</Label><Input value={postTitle} onChange={(e) => setPostTitle(e.target.value)} placeholder="e.g. Associate Lawyer" className="mt-1" /></div>
              <div><Label>Company Name *</Label><Input value={postCompany} onChange={(e) => setPostCompany(e.target.value)} placeholder="e.g. Lex Chambers" className="mt-1" /></div>
              <div>
                <Label>Job Type *</Label>
                <Select value={postJobType} onValueChange={setPostJobType}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full-time">Full-time</SelectItem>
                    <SelectItem value="part-time">Part-time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="internship">Internship</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Location (City) *</Label><Input value={postLocation} onChange={(e) => setPostLocation(e.target.value)} placeholder="e.g. Lagos" className="mt-1" /></div>
              <div className="flex items-center gap-3"><Switch checked={postIsRemote} onCheckedChange={setPostIsRemote} /><Label>Remote position</Label></div>
              <div><Label>Description *</Label><Textarea value={postDescription} onChange={(e) => setPostDescription(e.target.value)} placeholder="Describe the role..." className="mt-1 min-h-[120px]" /></div>
              <Button onClick={handlePostJob} disabled={posting} className="w-full">
                {posting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />} Post Job
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={!!applyingJob} onOpenChange={(o) => !o && setApplyingJob(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Apply to {applyingJob?.title}</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">{applyingJob?.company}</p>
            <Textarea placeholder="Write a cover note (optional)..." value={coverNote} onChange={(e) => setCoverNote(e.target.value)} className="min-h-[100px]" />
            <Button onClick={handleApply} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />} Submit Application
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
