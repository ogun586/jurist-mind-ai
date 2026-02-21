import { useState, useEffect } from "react";
import {
  Briefcase, MapPin, Clock, Plus, Users, Trash2,
  Search, Bookmark, Share2, ChevronDown,
  Building2, DollarSign, Calendar, CheckCircle2,
  TrendingUp, X, SlidersHorizontal
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { showToast } from "@/lib/toast";

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
  created_at: string;
  applications_count: number;
  posted_by: string;
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
}

const JOB_TYPES = ["Full-time", "Part-time", "Contract", "Remote", "Hybrid", "Internship"];
const EXPERIENCE_LEVELS = ["Entry Level", "Mid Level", "Senior Level", "Partner", "Director"];

export default function Jobs() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [jobTypeFilter, setJobTypeFilter] = useState("all");
  const [experienceFilter, setExperienceFilter] = useState("all");
  const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set());
  const [appliedJobs, setAppliedJobs] = useState<Set<string>>(new Set());
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("find");
  const [jobForm, setJobForm] = useState<JobForm>({
    title: "", company: "", location: "", job_type: "",
    salary_range: "", description: "", requirements: "",
    benefits: "", experience_level: "", deadline: "",
  });

  useEffect(() => { fetchJobs(); }, []);

  useEffect(() => {
    const saved = localStorage.getItem('savedJobs');
    const applied = localStorage.getItem('appliedJobs');
    if (saved) setSavedJobs(new Set(JSON.parse(saved)));
    if (applied) setAppliedJobs(new Set(JSON.parse(applied)));
  }, []);

  const fetchJobs = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-jobs', {
        body: { action: 'list-jobs' }
      });
      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast.error('Failed to fetch jobs');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-jobs', {
        body: { action: 'create-job', jobData: jobForm }
      });
      if (error) throw error;
      toast.success('Job posted successfully!');
      setJobForm({
        title: "", company: "", location: "", job_type: "",
        salary_range: "", description: "", requirements: "",
        benefits: "", experience_level: "", deadline: "",
      });
      setActiveTab("find");
      fetchJobs();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to post job');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApplyJob = async (job: Job) => {
    if (!user) {
      toast.error('You must be logged in to apply');
      return;
    }
    try {
      const { data: posterData } = await supabase
        .from('profiles')
        .select('email, display_name')
        .eq('user_id', job.posted_by)
        .single();

      const posterEmail = posterData?.email || '';
      const posterName = posterData?.display_name || 'Hiring Manager';

      const subject = encodeURIComponent(`Application: ${job.title}`);
      const body = encodeURIComponent(
`Dear ${posterName},

My name is [Your Name]. I am reaching out regarding the "${job.title}" position listed on Jurist Mind.
Please find my resume attached.

Best regards,
[Your Name]`
      );
      window.location.href = `mailto:${posterEmail}?subject=${subject}&body=${body}`;

      const newApplied = new Set(appliedJobs).add(job.id);
      setAppliedJobs(newApplied);
      localStorage.setItem('appliedJobs', JSON.stringify([...newApplied]));
      showToast('Opening email client…');
    } catch (error: any) {
      showToast('Could not open email client. Please try again.', 5000);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this job posting?')) return;
    try {
      const { error } = await supabase.functions.invoke('manage-jobs', {
        body: { action: 'delete-job', jobId }
      });
      if (error) throw error;
      toast.success('Job deleted successfully.');
      fetchJobs();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete job');
    }
  };

  const toggleSaveJob = (jobId: string) => {
    const newSaved = new Set(savedJobs);
    if (newSaved.has(jobId)) {
      newSaved.delete(jobId);
      toast.success('Job removed from saved');
    } else {
      newSaved.add(jobId);
      toast.success('Job saved!');
    }
    setSavedJobs(newSaved);
    localStorage.setItem('savedJobs', JSON.stringify([...newSaved]));
  };

  const handleShareJob = (job: Job) => {
    const text = `Check out this legal job: ${job.title} at ${job.company}`;
    if (navigator.share) {
      navigator.share({ title: job.title, text, url: window.location.href });
    } else {
      navigator.clipboard.writeText(`${text} - ${window.location.href}`);
      toast.success('Link copied to clipboard!');
    }
  };

  const filteredJobs = jobs.filter(job => {
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
    const matchesExperience =
      experienceFilter === "all" ||
      (job.experience_level && job.experience_level.toLowerCase() === experienceFilter.toLowerCase());
    return matchesSearch && matchesLocation && matchesType && matchesExperience;
  });

  const savedJobsList = jobs.filter(j => savedJobs.has(j.id));
  const myPostedJobs = jobs.filter(j => j.posted_by === user?.id);

  const activeFilterCount = [
    jobTypeFilter !== "all",
    experienceFilter !== "all",
    locationFilter !== "",
  ].filter(Boolean).length;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.ceil(Math.abs(now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) return "1 day ago";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
    return `${Math.ceil(diffDays / 30)} months ago`;
  };

  const getJobTypeBadgeColor = (type: string) => {
    const t = type.toLowerCase();
    if (t === 'remote') return 'bg-green-500/10 text-green-600 border-green-500/20';
    if (t === 'full-time') return 'bg-primary/10 text-primary border-primary/20';
    if (t === 'part-time') return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    if (t === 'contract') return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
    if (t === 'hybrid') return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
    return 'bg-muted text-muted-foreground border-border';
  };

  const stats = [
    { label: "Total Jobs", value: jobs.length, icon: Briefcase },
    { label: "Saved", value: savedJobs.size, icon: Bookmark },
    { label: "Applied", value: appliedJobs.size, icon: CheckCircle2 },
    { label: "My Posts", value: myPostedJobs.length, icon: TrendingUp },
  ];

  return (
    <div className="h-full bg-background overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Legal Career Hub</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Curated legal career opportunities across Nigeria and beyond.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((stat) => (
            <div key={stat.label} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <stat.icon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground leading-none">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="find"><Search className="w-4 h-4 mr-1.5" />Browse Jobs</TabsTrigger>
            <TabsTrigger value="saved">
              <Bookmark className="w-4 h-4 mr-1.5" />Saved
              {savedJobs.size > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">{savedJobs.size}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="post"><Plus className="w-4 h-4 mr-1.5" />Post Job</TabsTrigger>
          </TabsList>

          {/* ── FIND JOBS ── */}
          <TabsContent value="find" className="space-y-4 mt-4">
            {/* Search + filters */}
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search jobs, companies…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 h-10 text-sm"
                  />
                  {searchTerm && (
                    <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Mobile filter sheet */}
                <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 sm:hidden relative">
                      <SlidersHorizontal className="w-4 h-4" />
                      {activeFilterCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center">{activeFilterCount}</span>
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="rounded-t-2xl">
                    <SheetHeader><SheetTitle>Filter Jobs</SheetTitle></SheetHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Location</label>
                        <Input placeholder="e.g. Lagos, Abuja" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className="h-11" />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Job Type</label>
                        <Select value={jobTypeFilter} onValueChange={setJobTypeFilter}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            {JOB_TYPES.map(t => <SelectItem key={t} value={t.toLowerCase()}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Experience Level</label>
                        <Select value={experienceFilter} onValueChange={setExperienceFilter}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Levels</SelectItem>
                            {EXPERIENCE_LEVELS.map(l => <SelectItem key={l} value={l.toLowerCase()}>{l}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={() => { setLocationFilter(""); setJobTypeFilter("all"); setExperienceFilter("all"); setFilterSheetOpen(false); }}>Clear</Button>
                        <Button className="flex-1" onClick={() => setFilterSheetOpen(false)}>Apply</Button>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>

              {/* Desktop filters */}
              <div className="hidden sm:flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input placeholder="Location" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className="pl-8 h-9 w-40 text-sm" />
                </div>
                <Select value={jobTypeFilter} onValueChange={setJobTypeFilter}>
                  <SelectTrigger className="h-9 w-36 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {JOB_TYPES.map(t => <SelectItem key={t} value={t.toLowerCase()}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={experienceFilter} onValueChange={setExperienceFilter}>
                  <SelectTrigger className="h-9 w-36 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    {EXPERIENCE_LEVELS.map(l => <SelectItem key={l} value={l.toLowerCase()}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
                {(locationFilter || jobTypeFilter !== "all" || experienceFilter !== "all") && (
                  <Button variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground" onClick={() => { setLocationFilter(""); setJobTypeFilter("all"); setExperienceFilter("all"); }}>
                    <X className="w-3 h-3 mr-1" />Clear filters
                  </Button>
                )}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Showing {filteredJobs.length} of {jobs.length} jobs
            </p>

            {/* Job cards */}
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                <p className="mt-3 text-sm text-muted-foreground">Loading jobs...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredJobs.map((job) => (
                  <Card key={job.id} className="overflow-hidden hover:shadow-md transition-shadow">
                    {appliedJobs.has(job.id) && (
                      <div className="bg-green-500/10 border-b border-green-500/20 px-4 py-1.5 flex items-center gap-1.5 text-xs text-green-600 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />You applied to this job
                      </div>
                    )}
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                            <Building2 className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground leading-tight">{job.title}</h3>
                            <p className="text-sm text-muted-foreground">{job.company}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => toggleSaveJob(job.id)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-primary/10 transition-colors" title={savedJobs.has(job.id) ? "Unsave" : "Save job"}>
                            {savedJobs.has(job.id) ? <Bookmark className="w-4 h-4 text-primary fill-primary" /> : <Bookmark className="w-4 h-4 text-muted-foreground" />}
                          </button>
                          <button onClick={() => handleShareJob(job)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-primary/10 transition-colors" title="Share job">
                            <Share2 className="w-4 h-4 text-muted-foreground" />
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <Badge variant="outline" className={`text-[11px] ${getJobTypeBadgeColor(job.job_type)}`}>
                          <Briefcase className="w-3 h-3 mr-1" />{job.job_type}
                        </Badge>
                        <Badge variant="outline" className="text-[11px]">
                          <MapPin className="w-3 h-3 mr-1" />{job.location}
                        </Badge>
                        <Badge variant="outline" className="text-[11px]">
                          <Clock className="w-3 h-3 mr-1" />{formatDate(job.created_at)}
                        </Badge>
                        {job.salary_range && (
                          <Badge variant="outline" className="text-[11px]">
                            <DollarSign className="w-3 h-3 mr-1" />{job.salary_range}
                          </Badge>
                        )}
                        {job.experience_level && (
                          <Badge variant="outline" className="text-[11px]">
                            {job.experience_level}
                          </Badge>
                        )}
                        {job.deadline && (
                          <Badge variant="outline" className="text-[11px]">
                            <Calendar className="w-3 h-3 mr-1" />Deadline: {new Date(job.deadline).toLocaleDateString()}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className={`text-sm text-muted-foreground ${expandedJob === job.id ? '' : 'line-clamp-2'}`}>
                        {job.description}
                      </p>

                      {expandedJob === job.id && job.requirements && (
                        <div className="mt-2">
                          <p className="text-xs font-semibold text-foreground mb-1">Requirements:</p>
                          <p className="text-sm text-muted-foreground whitespace-pre-line">{job.requirements}</p>
                        </div>
                      )}
                      {expandedJob === job.id && job.benefits && (
                        <div className="mt-2">
                          <p className="text-xs font-semibold text-foreground mb-1">Benefits:</p>
                          <p className="text-sm text-muted-foreground whitespace-pre-line">{job.benefits}</p>
                        </div>
                      )}

                      <button onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)} className="text-xs text-primary hover:underline flex items-center gap-1 mt-2 mb-3">
                        {expandedJob === job.id ? 'Show less' : 'Read more'}
                        <ChevronDown className={`w-3 h-3 transition-transform ${expandedJob === job.id ? 'rotate-180' : ''}`} />
                      </button>

                      <div className="flex items-center justify-between pt-2 border-t border-border">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="w-3.5 h-3.5" />{job.applications_count} applied
                        </div>
                        <div className="flex items-center gap-2">
                          {user?.id === job.posted_by && (
                            <Button variant="outline" size="sm" onClick={() => handleDeleteJob(job.id)} className="h-8 px-3 text-destructive hover:bg-destructive hover:text-destructive-foreground border-destructive/30 text-xs">
                              <Trash2 className="w-3.5 h-3.5 mr-1" />Delete
                            </Button>
                          )}
                          {user ? (
                            <Button onClick={() => handleApplyJob(job)} size="sm" disabled={appliedJobs.has(job.id)} className="h-8 px-4 text-xs">
                              {appliedJobs.has(job.id) ? (<><CheckCircle2 className="w-3.5 h-3.5 mr-1" />Applied</>) : 'Apply Now'}
                            </Button>
                          ) : (
                            <Button size="sm" onClick={() => window.location.href = '/auth'}>Login to Apply</Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {filteredJobs.length === 0 && (
                  <div className="text-center py-16 space-y-3">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                      <Briefcase className="w-7 h-7 text-muted-foreground" />
                    </div>
                    <p className="font-medium text-foreground">No jobs found</p>
                    <p className="text-sm text-muted-foreground">Try adjusting your search or filters</p>
                    <Button variant="outline" size="sm" onClick={() => { setSearchTerm(""); setLocationFilter(""); setJobTypeFilter("all"); setExperienceFilter("all"); }}>Clear search</Button>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── SAVED JOBS ── */}
          <TabsContent value="saved" className="mt-4">
            {savedJobsList.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                  <Bookmark className="w-7 h-7 text-muted-foreground" />
                </div>
                <p className="font-medium text-foreground">No saved jobs yet</p>
                <p className="text-sm text-muted-foreground">Tap the bookmark icon on any job to save it here</p>
                <Button variant="outline" size="sm" onClick={() => setActiveTab("find")}>Browse Jobs</Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">{savedJobsList.length} saved job{savedJobsList.length !== 1 ? 's' : ''}</p>
                {savedJobsList.map((job) => (
                  <Card key={job.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-foreground text-sm">{job.title}</h3>
                          <p className="text-xs text-muted-foreground">{job.company}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <Badge variant="outline" className="text-[10px]">{job.job_type}</Badge>
                            <span className="text-[11px] text-muted-foreground flex items-center gap-0.5"><MapPin className="w-3 h-3" />{job.location}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => toggleSaveJob(job.id)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-destructive/10 transition-colors">
                            <Bookmark className="w-4 h-4 text-primary fill-primary" />
                          </button>
                          <Button size="sm" className="h-8 text-xs" onClick={() => handleApplyJob(job)}>Apply</Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── POST JOB ── */}
          <TabsContent value="post" className="mt-4">
            {!user ? (
              <div className="text-center py-16 space-y-3">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                  <Briefcase className="w-7 h-7 text-muted-foreground" />
                </div>
                <p className="font-medium text-foreground">Login Required</p>
                <p className="text-sm text-muted-foreground">You must be logged in to post job listings</p>
                <Button onClick={() => window.location.href = '/auth'}>Login to Post Jobs</Button>
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Plus className="w-5 h-5 text-primary" />
                    <h2 className="font-semibold text-foreground">Post a New Job</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">Fill in the details below to list your legal job opening</p>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmitJob} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Job Title *</label>
                        <Input placeholder="e.g. Senior Associate" value={jobForm.title} onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })} required />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Company / Firm *</label>
                        <Input placeholder="Your firm name" value={jobForm.company} onChange={(e) => setJobForm({ ...jobForm, company: e.target.value })} required />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Location *</label>
                        <Input placeholder="City, State" value={jobForm.location} onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })} required />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Job Type *</label>
                        <Select value={jobForm.job_type} onValueChange={(v) => setJobForm({ ...jobForm, job_type: v })}>
                          <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                          <SelectContent>
                            {JOB_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Experience Level</label>
                        <Select value={jobForm.experience_level} onValueChange={(v) => setJobForm({ ...jobForm, experience_level: v })}>
                          <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                          <SelectContent>
                            {EXPERIENCE_LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Salary Range</label>
                        <Input placeholder="₦XXX,XXX - ₦XXX,XXX/month" value={jobForm.salary_range} onChange={(e) => setJobForm({ ...jobForm, salary_range: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Application Deadline</label>
                        <Input type="date" value={jobForm.deadline} onChange={(e) => setJobForm({ ...jobForm, deadline: e.target.value })} />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Job Description *</label>
                      <Textarea rows={4} placeholder="Describe the role, responsibilities..." value={jobForm.description} onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })} required />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Requirements</label>
                      <Textarea rows={3} placeholder="e.g. Called to Bar, 5+ years experience, LLM preferred..." value={jobForm.requirements} onChange={(e) => setJobForm({ ...jobForm, requirements: e.target.value })} />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Benefits & Perks</label>
                      <Textarea rows={2} placeholder="e.g. Health insurance, remote work, professional development..." value={jobForm.benefits} onChange={(e) => setJobForm({ ...jobForm, benefits: e.target.value })} />
                    </div>

                    <Button type="submit" className="w-full h-11 font-semibold" disabled={submitting}>
                      {submitting ? (
                        <><div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />Posting Job...</>
                      ) : (
                        <><Plus className="w-4 h-4 mr-2" />Post Job Listing</>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
