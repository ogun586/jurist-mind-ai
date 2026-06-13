import { useState, useEffect } from "react";
import {
  Briefcase, MapPin, Clock, Plus, Users, Trash2,
  Search, BookmarkPlus, Bookmark, Share2, ChevronDown,
  Building2, DollarSign, Calendar, CheckCircle2,
  TrendingUp, X, SlidersHorizontal, Globe, Send,
  Loader2, FileText, Lock,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCountryId, useAllCountries } from "@/hooks/useCountryId";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  job_type: string;
  salary_range?: string;
  description: string;
  requirements?: string;
  benefits?: string;
  experience_level?: string;
  deadline?: string;
  is_remote: boolean;
  is_active: boolean;
  created_at: string;
  applications_count: number;
  posted_by: string;
  country_id: string;
}

interface JobForm {
  title: string;
  company: string;
  location: string;
  job_type: string;
  salary_range: string;
  description: string;
  requirements: string;
  benefits: string;
  experience_level: string;
  deadline: string;
  is_remote: boolean;
}

const JOB_TYPES = ["Full-time", "Part-time", "Contract", "Remote", "Hybrid", "Internship"];
const EXPERIENCE_LEVELS = ["Entry Level", "Mid Level", "Senior Level", "Partner", "Director"];

const EMPTY_FORM: JobForm = {
  title: "", company: "", location: "", job_type: "",
  salary_range: "", description: "", requirements: "",
  benefits: "", experience_level: "", deadline: "", is_remote: false,
};

function getJobTypeBadgeColor(type: string) {
  const t = type.toLowerCase();
  if (t === "remote")    return "bg-green-500/10 text-green-600 border-green-500/20";
  if (t === "full-time") return "bg-primary/10 text-primary border-primary/20";
  if (t === "part-time") return "bg-blue-500/10 text-blue-600 border-blue-500/20";
  if (t === "contract")  return "bg-orange-500/10 text-orange-600 border-orange-500/20";
  if (t === "hybrid")    return "bg-purple-500/10 text-purple-600 border-purple-500/20";
  if (t === "internship")return "bg-pink-500/10 text-pink-600 border-pink-500/20";
  return "bg-muted text-muted-foreground border-border";
}

function formatDate(dateString: string) {
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  } catch {
    return "recently";
  }
}

export default function Jobs() {
  const { user } = useAuth();
  const { countryId } = useCountryId();
  const { countries } = useAllCountries();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [posting, setPosting] = useState(false);

  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [jobTypeFilter, setJobTypeFilter] = useState("all");
  const [experienceFilter, setExperienceFilter] = useState("all");

  const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set());
  const [appliedJobs, setAppliedJobs] = useState<Set<string>>(new Set());
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("find");

  const [applyingJob, setApplyingJob] = useState<Job | null>(null);
  const [coverNote, setCoverNote] = useState("");

  const [jobForm, setJobForm] = useState<JobForm>(EMPTY_FORM);

  useEffect(() => {
    if (countryId && !selectedCountryId) setSelectedCountryId(countryId);
  }, [countryId]);

  useEffect(() => {
    if (selectedCountryId) fetchJobs(selectedCountryId);
  }, [selectedCountryId]);

  useEffect(() => {
    const saved = localStorage.getItem("jm_savedJobs");
    if (saved) setSavedJobs(new Set(JSON.parse(saved)));
  }, []);

  useEffect(() => {
    if (user) fetchAppliedJobs();
  }, [user]);

  useEffect(() => {
    const channel = supabase
      .channel("job-notifications")
      .on("broadcast", { event: "new-job" }, (payload) => {
        const job = payload.payload as Job;
        if (job.posted_by !== user?.id && job.country_id === selectedCountryId) {
          toast(`🧑‍⚖️ New job posted`, {
            description: `${job.title} at ${job.company}`,
            action: { label: "View", onClick: () => setActiveTab("find") },
          });
          setJobs((prev) => [job, ...prev]);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, selectedCountryId]);

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
      toast.error("Failed to load jobs. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function fetchAppliedJobs() {
    if (!user) return;
    try {
      const { data } = await supabase
        .from("job_applications")
        .select("job_id")
        .eq("applicant_id", user.id);
      if (data) setAppliedJobs(new Set(data.map((d: any) => d.job_id)));
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
      if (error) {
        if (error.message?.includes("unique") || error.message?.includes("duplicate")) {
          toast.error("You've already applied for this role.");
        } else {
          throw error;
        }
        return;
      }
      const newApplied = new Set(appliedJobs).add(applyingJob.id);
      setAppliedJobs(newApplied);
      toast.success("Application submitted!", {
        description: `Your application for ${applyingJob.title} has been sent.`,
      });
      setApplyingJob(null);
      setCoverNote("");
    } catch {
      toast.error("Failed to submit application. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePostJob(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !countryId) return;
    if (!jobForm.title || !jobForm.company || !jobForm.description || !jobForm.location || !jobForm.job_type) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setPosting(true);
    try {
      const { data, error } = await (supabase.from as any)("jobs").insert({
        title: jobForm.title,
        company: jobForm.company,
        location: jobForm.location,
        job_type: jobForm.job_type,
        salary_range: jobForm.salary_range || null,
        description: jobForm.description,
        requirements: jobForm.requirements || null,
        benefits: jobForm.benefits || null,
        experience_level: jobForm.experience_level || null,
        deadline: jobForm.deadline || null,
        is_remote: jobForm.is_remote,
        posted_by: user.id,
        country_id: countryId,
        is_active: true,
        applications_count: 0,
      }).select().single();
      if (error) throw error;

      await supabase.channel("job-notifications").send({
        type: "broadcast",
        event: "new-job",
        payload: data,
      });

      toast.success("Job posted!", {
        description: "All users in your country have been notified.",
      });
      setJobForm(EMPTY_FORM);
      setActiveTab("find");
      if (selectedCountryId) fetchJobs(selectedCountryId);
    } catch {
      toast.error("Failed to post job. Please try again.");
    } finally {
      setPosting(false);
    }
  }

  async function handleDeleteJob(jobId: string) {
    if (!confirm("Delete this job listing permanently?")) return;
    try {
      const { error } = await (supabase.from as any)("jobs")
        .update({ is_active: false })
        .eq("id", jobId)
        .eq("posted_by", user?.id);
      if (error) throw error;
      toast.success("Job listing removed.");
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
    } catch {
      toast.error("Failed to delete job.");
    }
  }

  function toggleSaveJob(jobId: string) {
    const newSaved = new Set(savedJobs);
    if (newSaved.has(jobId)) {
      newSaved.delete(jobId);
      toast("Removed from saved jobs");
    } else {
      newSaved.add(jobId);
      toast.success("Job saved!");
    }
    setSavedJobs(newSaved);
    localStorage.setItem("jm_savedJobs", JSON.stringify([...newSaved]));
  }

  function handleShareJob(job: Job) {
    const text = `Legal opportunity: ${job.title} at ${job.company}`;
    if (navigator.share) {
      navigator.share({ title: job.title, text, url: window.location.href });
    } else {
      navigator.clipboard.writeText(`${text} — ${window.location.href}`);
      toast.success("Link copied to clipboard!");
    }
  }

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLocation =
      locationFilter === "" ||
      job.location.toLowerCase().includes(locationFilter.toLowerCase());
    const matchesType =
      jobTypeFilter === "all" ||
      job.job_type.toLowerCase() === jobTypeFilter.toLowerCase();
    return matchesSearch && matchesLocation && matchesType;
  });

  const savedJobsList = jobs.filter((j) => savedJobs.has(j.id));
  const myPostedJobs = jobs.filter((j) => j.posted_by === user?.id);
  const activeFilterCount = [
    jobTypeFilter !== "all",
    experienceFilter !== "all",
    locationFilter !== "",
  ].filter(Boolean).length;

  const stats = [
    { label: "Total Jobs", value: jobs.length, icon: Briefcase },
    { label: "Saved", value: savedJobs.size, icon: Bookmark },
    { label: "Applied", value: appliedJobs.size, icon: CheckCircle2 },
    { label: "My Listings", value: myPostedJobs.length, icon: TrendingUp },
  ];

  function JobCard({ job }: { job: Job }) {
    const isOwner = user?.id === job.posted_by;
    const isSaved = savedJobs.has(job.id);
    const hasApplied = appliedJobs.has(job.id);
    const isExpanded = expandedJob === job.id;

    return (
      <Card
        className={`border-2 transition-all duration-200 overflow-hidden ${
          isExpanded ? "border-primary/30 shadow-lg" : "hover:border-primary/20 hover:shadow-md"
        } ${hasApplied ? "opacity-80" : ""}`}
      >
        {hasApplied && (
          <div className="bg-green-500/10 border-b border-green-500/20 px-4 py-1.5 flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
            <span className="text-xs text-green-600 font-medium">You applied for this role</span>
          </div>
        )}

        <CardHeader className="p-4 md:p-5 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 md:w-6 md:h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base md:text-lg font-semibold text-foreground leading-tight mb-0.5 line-clamp-1">
                  {job.title}
                </h3>
                <p className="text-sm text-muted-foreground font-medium">{job.company}</p>
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <button
                onClick={() => toggleSaveJob(job.id)}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-primary/10 transition-colors"
                title={isSaved ? "Unsave" : "Save job"}
              >
                {isSaved
                  ? <Bookmark className="w-4 h-4 text-primary fill-primary" />
                  : <BookmarkPlus className="w-4 h-4 text-muted-foreground" />
                }
              </button>
              <button
                onClick={() => handleShareJob(job)}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-primary/10 transition-colors"
                title="Share"
              >
                <Share2 className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 mt-3">
            <Badge variant="outline" className={`text-xs ${getJobTypeBadgeColor(job.job_type)}`}>
              <Briefcase className="w-3 h-3 mr-1" /> {job.job_type}
            </Badge>
            {job.is_remote && (
              <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
                Remote
              </Badge>
            )}
            <Badge variant="outline" className="text-xs text-muted-foreground">
              <MapPin className="w-3 h-3 mr-1" /> {job.location}
            </Badge>
            <Badge variant="outline" className="text-xs text-muted-foreground">
              <Clock className="w-3 h-3 mr-1" /> {formatDate(job.created_at)}
            </Badge>
            {job.salary_range && (
              <Badge variant="outline" className="text-xs text-primary border-primary/20 bg-primary/5">
                <DollarSign className="w-3 h-3 mr-1" /> {job.salary_range}
              </Badge>
            )}
            {job.experience_level && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                {job.experience_level}
              </Badge>
            )}
            {job.deadline && (
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/20 bg-amber-500/5">
                <Calendar className="w-3 h-3 mr-1" /> Closes {formatDate(job.deadline)}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="px-4 md:px-5 pb-4 pt-0">
          <p className={`text-sm text-muted-foreground leading-relaxed mb-2 ${isExpanded ? "" : "line-clamp-2"}`}>
            {job.description}
          </p>

          {isExpanded && (job.requirements || job.benefits) && (
            <div className="mt-3 space-y-3">
              {job.requirements && (
                <div>
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-1">Requirements</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{job.requirements}</p>
                </div>
              )}
              {job.benefits && (
                <div>
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-1">Benefits</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{job.benefits}</p>
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => setExpandedJob(isExpanded ? null : job.id)}
            className="text-xs text-primary hover:underline flex items-center gap-1 mt-2 mb-3"
          >
            {isExpanded ? "Show less" : "Read more"}
            <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
          </button>

          <div className="flex items-center justify-between gap-3 pt-3 border-t border-border/50">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {job.applications_count ?? 0} applied
              </span>
            </div>
            <div className="flex gap-2">
              {isOwner && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteJob(job.id)}
                  className="h-8 px-3 text-destructive hover:bg-destructive hover:text-destructive-foreground border-destructive/30 text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                </Button>
              )}
              {user ? (
                <Button
                  onClick={() => { setApplyingJob(job); setCoverNote(""); }}
                  size="sm"
                  disabled={hasApplied}
                  className="h-8 px-4 text-xs bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-60"
                >
                  {hasApplied ? (
                    <><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Applied</>
                  ) : "Apply Now"}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-4 text-xs"
                  onClick={() => window.location.href = "/auth"}
                >
                  <Lock className="w-3.5 h-3.5 mr-1" /> Login to Apply
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  function JobSkeleton() {
    return (
      <Card className="border-2">
        <CardContent className="p-4 md:p-5 space-y-3">
          <div className="flex items-start gap-3">
            <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4 rounded" />
              <Skeleton className="h-4 w-1/2 rounded" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-10 w-full rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="h-full bg-background overflow-y-auto">
      <div className="max-w-5xl mx-auto p-4 md:p-6 lg:p-8">

        <div className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-primary mb-2">
              <Briefcase className="w-4 h-4 md:w-5 md:h-5" />
              <span className="text-xs md:text-sm font-medium uppercase tracking-wider">
                Legal Career Hub
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-2">
              Find Legal Jobs
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Curated legal opportunities — filtered to your country.
            </p>
          </div>

          <div className="shrink-0">
            <Select value={selectedCountryId || ""} onValueChange={setSelectedCountryId}>
              <SelectTrigger className="w-52 h-10">
                <Globe className="w-4 h-4 mr-2 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {countries.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-card border rounded-xl p-3 md:p-4 flex items-center gap-3"
            >
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <stat.icon className="w-4 h-4 md:w-5 md:h-5 text-primary" />
              </div>
              <div>
                <p className="text-lg md:text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-[10px] md:text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-card border rounded-xl p-1 mb-6 h-auto">
            <TabsTrigger value="find" className="rounded-lg text-xs md:text-sm py-2">
              <Search className="w-3.5 h-3.5 mr-1.5" /> Browse Jobs
            </TabsTrigger>
            <TabsTrigger value="saved" className="rounded-lg text-xs md:text-sm py-2">
              <Bookmark className="w-3.5 h-3.5 mr-1.5" /> Saved
              {savedJobs.size > 0 && (
                <span className="ml-1.5 bg-primary text-primary-foreground text-[10px] rounded-full px-1.5 py-0.5 font-bold">
                  {savedJobs.size}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="post" className="rounded-lg text-xs md:text-sm py-2">
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Post Job
            </TabsTrigger>
          </TabsList>

          <TabsContent value="find" className="space-y-4">
            <div className="bg-card border rounded-xl p-3 md:p-4 space-y-3">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search jobs, companies..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 h-10 text-sm"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="h-10 px-3 relative md:hidden shrink-0">
                      <SlidersHorizontal className="w-4 h-4" />
                      {activeFilterCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                          {activeFilterCount}
                        </span>
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="rounded-t-2xl pb-8">
                    <SheetHeader className="mb-4">
                      <SheetTitle className="text-left">Filter Jobs</SheetTitle>
                    </SheetHeader>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Location</label>
                        <Input
                          placeholder="City, State..."
                          value={locationFilter}
                          onChange={(e) => setLocationFilter(e.target.value)}
                          className="h-11"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Job Type</label>
                        <Select value={jobTypeFilter} onValueChange={setJobTypeFilter}>
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="All Types" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            {JOB_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Experience Level</label>
                        <Select value={experienceFilter} onValueChange={setExperienceFilter}>
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="All Levels" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Levels</SelectItem>
                            {EXPERIENCE_LEVELS.map((l) => (
                              <SelectItem key={l} value={l}>{l}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            setLocationFilter(""); setJobTypeFilter("all");
                            setExperienceFilter("all"); setFilterSheetOpen(false);
                          }}
                        >
                          Clear
                        </Button>
                        <Button className="flex-1" onClick={() => setFilterSheetOpen(false)}>
                          Apply Filters
                        </Button>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>

              <div className="hidden md:flex gap-3 flex-wrap">
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Location"
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                    className="pl-9 h-9 w-40 text-sm"
                  />
                </div>
                <Select value={jobTypeFilter} onValueChange={setJobTypeFilter}>
                  <SelectTrigger className="h-9 w-36 text-sm">
                    <SelectValue placeholder="Job Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {JOB_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={experienceFilter} onValueChange={setExperienceFilter}>
                  <SelectTrigger className="h-9 w-40 text-sm">
                    <SelectValue placeholder="Experience" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    {EXPERIENCE_LEVELS.map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(locationFilter || jobTypeFilter !== "all" || experienceFilter !== "all") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 text-muted-foreground hover:text-foreground text-xs"
                    onClick={() => {
                      setLocationFilter(""); setJobTypeFilter("all"); setExperienceFilter("all");
                    }}
                  >
                    <X className="w-3.5 h-3.5 mr-1" /> Clear filters
                  </Button>
                )}
              </div>
            </div>

            <p className="text-xs text-muted-foreground px-1">
              Showing{" "}
              <span className="font-semibold text-foreground">{filteredJobs.length}</span>{" "}
              of {jobs.length} jobs
            </p>

            {loading ? (
              <div className="space-y-3 md:space-y-4">
                {[...Array(4)].map((_, i) => <JobSkeleton key={i} />)}
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="text-center py-14">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Briefcase className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1">No jobs found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {searchTerm || locationFilter || jobTypeFilter !== "all"
                    ? "Try adjusting your search or filters"
                    : "No jobs have been posted in this country yet — be the first!"}
                </p>
                {(searchTerm || locationFilter || jobTypeFilter !== "all") ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchTerm(""); setLocationFilter(""); setJobTypeFilter("all");
                    }}
                  >
                    Clear search
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => setActiveTab("post")}>
                    <Plus className="w-4 h-4 mr-1" /> Post a Job
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3 md:space-y-4">
                {filteredJobs.map((job) => <JobCard key={job.id} job={job} />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="saved">
            {savedJobsList.length === 0 ? (
              <div className="text-center py-14">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Bookmark className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1">No saved jobs</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Tap the bookmark icon on any listing to save it here.
                </p>
                <Button variant="outline" size="sm" onClick={() => setActiveTab("find")}>
                  Browse Jobs
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground px-1">
                  {savedJobsList.length} saved job{savedJobsList.length !== 1 ? "s" : ""}
                </p>
                {savedJobsList.map((job) => (
                  <Card key={job.id} className="border hover:border-primary/20 hover:shadow-md transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-foreground mb-0.5 line-clamp-1">
                            {job.title}
                          </h3>
                          <p className="text-xs text-muted-foreground mb-2">{job.company}</p>
                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant="outline" className={`text-xs ${getJobTypeBadgeColor(job.job_type)}`}>
                              {job.job_type}
                            </Badge>
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              <MapPin className="w-3 h-3 mr-1" /> {job.location}
                            </Badge>
                            {job.is_remote && (
                              <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
                                Remote
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                          <button
                            onClick={() => toggleSaveJob(job.id)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-destructive/10 transition-colors"
                            title="Remove saved"
                          >
                            <X className="w-4 h-4 text-muted-foreground" />
                          </button>
                          {appliedJobs.has(job.id) ? (
                            <Button size="sm" variant="outline" disabled className="h-8 px-3 text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Applied
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              className="h-8 px-3 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
                              onClick={() => { setApplyingJob(job); setCoverNote(""); }}
                            >
                              Apply
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="post">
            {!user ? (
              <div className="text-center py-14">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1">Login Required</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  You must be logged in to post job listings.
                </p>
                <Button
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={() => window.location.href = "/auth"}
                >
                  Login to Post Jobs
                </Button>
              </div>
            ) : (
              <Card className="border-2">
                <CardHeader className="p-4 md:p-6 pb-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Plus className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-semibold text-foreground">Post a New Job</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    This listing will be visible to all users in your country and they will be notified instantly.
                  </p>
                </CardHeader>
                <CardContent className="p-4 md:p-6">
                  <form onSubmit={handlePostJob} className="space-y-4">

                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        Country <span className="text-muted-foreground font-normal text-xs">(based on your profile)</span>
                      </label>
                      <div className="flex items-center gap-2 h-10 px-3 rounded-md border bg-muted/30 text-sm text-muted-foreground">
                        <Globe className="w-4 h-4 shrink-0" />
                        {countries.find((c: any) => c.id === countryId)?.name || "Your country"}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Job Title *</label>
                        <Input
                          placeholder="e.g. Senior Corporate Lawyer"
                          value={jobForm.title}
                          onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Company / Firm *</label>
                        <Input
                          placeholder="Your law firm or company name"
                          value={jobForm.company}
                          onChange={(e) => setJobForm({ ...jobForm, company: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Location *</label>
                        <Input
                          placeholder="City, State"
                          value={jobForm.location}
                          onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Job Type *</label>
                        <Select
                          value={jobForm.job_type}
                          onValueChange={(v) => setJobForm({ ...jobForm, job_type: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            {JOB_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Experience Level</label>
                        <Select
                          value={jobForm.experience_level}
                          onValueChange={(v) => setJobForm({ ...jobForm, experience_level: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select level" />
                          </SelectTrigger>
                          <SelectContent>
                            {EXPERIENCE_LEVELS.map((l) => (
                              <SelectItem key={l} value={l}>{l}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
                      <Switch
                        id="is-remote"
                        checked={jobForm.is_remote}
                        onCheckedChange={(v) => setJobForm({ ...jobForm, is_remote: v })}
                      />
                      <Label htmlFor="is-remote" className="cursor-pointer">
                        This is a remote position
                      </Label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Salary Range</label>
                        <Input
                          placeholder="₦XXX,XXX – ₦XXX,XXX / month"
                          value={jobForm.salary_range}
                          onChange={(e) => setJobForm({ ...jobForm, salary_range: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Application Deadline</label>
                        <Input
                          type="date"
                          value={jobForm.deadline}
                          onChange={(e) => setJobForm({ ...jobForm, deadline: e.target.value })}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Job Description *</label>
                      <Textarea
                        rows={4}
                        placeholder="Describe the role and day-to-day responsibilities..."
                        value={jobForm.description}
                        onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Requirements</label>
                      <Textarea
                        rows={3}
                        placeholder="e.g. Called to Bar, 5+ years experience, LLM preferred..."
                        value={jobForm.requirements}
                        onChange={(e) => setJobForm({ ...jobForm, requirements: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Benefits & Perks</label>
                      <Textarea
                        rows={2}
                        placeholder="e.g. Health insurance, remote work, professional development..."
                        value={jobForm.benefits}
                        onChange={(e) => setJobForm({ ...jobForm, benefits: e.target.value })}
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-11 font-semibold"
                      disabled={posting}
                    >
                      {posting ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Posting Job...</>
                      ) : (
                        <><Send className="w-4 h-4 mr-2" /> Post & Notify Users</>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!applyingJob} onOpenChange={(open) => !open && setApplyingJob(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Apply for {applyingJob?.title}
            </DialogTitle>
            <DialogDescription>
              {applyingJob?.company} · {applyingJob?.location}
              {applyingJob?.is_remote && " · Remote"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Cover Note <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Textarea
                placeholder="Introduce yourself and explain why you're a great fit for this role..."
                value={coverNote}
                onChange={(e) => setCoverNote(e.target.value)}
                className="min-h-[120px]"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setApplyingJob(null)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={handleApply}
                disabled={submitting}
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</>
                ) : (
                  <><Send className="w-4 h-4 mr-2" /> Submit Application</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
