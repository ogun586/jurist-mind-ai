import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { 
  ArrowLeft, MapPin, Mail, Phone, MessageSquare, CheckCircle2, 
  Globe, Linkedin, Briefcase, Award, Eye, Shield, Star, Bookmark,
  Clock, Calendar as CalendarIcon, Building2, Languages, Tag, ChevronRight, Copy
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LawyerSchedule } from "./LawyerSchedule";
import { LawyerReviews } from "./LawyerReviews";
import { IntakeVault } from "./IntakeVault";
import { ConsultationRequest } from "./ConsultationRequest";
import { StickyMobileActions } from "./StickyMobileActions";
import { useAuth } from "@/contexts/AuthContext";

interface Lawyer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  state: string;
  city?: string;
  street?: string;
  postal_code?: string;
  country?: string;
  firm_name?: string;
  firm_logo_url?: string;
  avatar_url?: string;
  brand_accent_color?: string;
  bio_structured?: {
    about?: string;
    approach?: string;
    case_studies?: Array<{
      title: string;
      outcome: string;
      category: string;
    }>;
  };
  description?: string;
  specialization: string[];
  years_experience: number;
  bar_number?: string;
  rating: number;
  total_ratings: number;
  verification_status?: string;
  availability_status?: string;
  slug?: string;
  profile_views?: number;
  intro_video_url?: string;
  website?: string;
  social_media?: string;
  languages?: string[];
  response_time_label?: string;
  is_priority_partner?: boolean;
  created_at?: string;
  firm_id_ref?: string;
}

interface FirmLite {
  id: string;
  slug?: string;
  name: string;
  logo_url?: string;
  description?: string;
  is_priority_partner?: boolean;
  city?: string;
  country?: string;
}

export default function LawyerProfilePage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [lawyer, setLawyer] = useState<Lawyer | null>(null);
  const [loading, setLoading] = useState(true);
  const [firm, setFirm] = useState<FirmLite | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [savingToggle, setSavingToggle] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [bioExpanded, setBioExpanded] = useState(false);
  const [articles, setArticles] = useState<any[]>([]);
  const [qa, setQa] = useState<any[]>([]);
  const [experiences, setExperiences] = useState<any[]>([]);

  useEffect(() => {
    if (slug) {
      fetchLawyer();
      incrementViews();
    }
  }, [slug]);

  useEffect(() => {
    if (lawyer?.id) {
      fetchSidecars(lawyer.id, lawyer.firm_id_ref);
      if (user) checkSaved(lawyer.id);
    }
  }, [lawyer?.id, user?.id]);

  const fetchLawyer = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('search-lawyers', {
        body: { action: 'get-by-slug', slug }
      });

      if (error) throw error;
      setLawyer(data);
    } catch (error) {
      console.error('Error fetching lawyer:', error);
      toast.error('Failed to load lawyer profile');
    } finally {
      setLoading(false);
    }
  };

  const incrementViews = async () => {
    try {
      await supabase.rpc('increment_lawyer_views', { lawyer_slug: slug });
    } catch (error) {
      console.error('Error incrementing views:', error);
    }
  };

  const fetchSidecars = async (lawyerId: string, firmId?: string) => {
    try {
      const [arts, qas, exps, firmRes] = await Promise.all([
        (supabase.from as any)("lawyer_articles")
          .select("id, title, slug, excerpt, published_at, cover_image_url")
          .eq("lawyer_id", lawyerId).eq("is_published", true)
          .order("published_at", { ascending: false }).limit(6),
        (supabase.from as any)("lawyer_qa_threads")
          .select("id, question, answer, asked_by_name, answered_at")
          .eq("lawyer_id", lawyerId).eq("is_public", true).eq("is_answered", true)
          .order("answered_at", { ascending: false }).limit(10),
        (supabase.from as any)("lawyer_experiences")
          .select("id, title, company, start_date, end_date, is_current, description")
          .eq("lawyer_id", lawyerId).order("start_date", { ascending: false }),
        firmId
          ? (supabase.from as any)("firms").select("id, slug, name, logo_url, description, is_priority_partner, city, country").eq("id", firmId).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      setArticles(arts?.data || []);
      setQa(qas?.data || []);
      setExperiences(exps?.data || []);
      if ((firmRes as any)?.data) setFirm((firmRes as any).data);
    } catch (e) {
      console.error("sidecar fetch failed", e);
    }
  };

  const checkSaved = async (lawyerId: string) => {
    if (!user) return;
    const { data } = await (supabase.from as any)("saved_lawyers")
      .select("id").eq("user_id", user.id).eq("lawyer_id", lawyerId).maybeSingle();
    setIsSaved(!!data);
  };

  const toggleSave = async () => {
    if (!user) { toast.error("Sign in to save lawyers"); return; }
    if (!lawyer) return;
    setSavingToggle(true);
    try {
      if (isSaved) {
        await (supabase.from as any)("saved_lawyers")
          .delete().eq("user_id", user.id).eq("lawyer_id", lawyer.id);
        setIsSaved(false);
        toast.success("Removed from saved");
      } else {
        await (supabase.from as any)("saved_lawyers").insert({ user_id: user.id, lawyer_id: lawyer.id });
        setIsSaved(true);
        toast.success("Lawyer saved");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally { setSavingToggle(false); }
  };

  const callUsNow = () => {
    if (!lawyer?.phone) return;
    try {
      navigator.clipboard.writeText(lawyer.phone);
      toast.success("Phone number copied to clipboard");
    } catch {}
    // On mobile devices, also trigger tel:
    if (/Mobi|Android|iPhone/i.test(navigator.userAgent)) {
      window.location.href = `tel:${lawyer.phone}`;
    }
  };

  const scrollToBook = () => {
    document.getElementById("book-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'online':
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/10">
            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
            Online Now
          </Badge>
        );
      case 'busy':
        return (
          <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/10">
            <span className="w-2 h-2 rounded-full bg-amber-500 mr-1.5" />
            Busy
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-muted-foreground/50 mr-1.5" />
            Offline
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <div className="h-full bg-background overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6">
          <div className="flex items-center gap-4 mb-8">
            <Skeleton className="w-24 h-24 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!lawyer) {
    return (
      <div className="h-full bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Lawyer not found</h2>
          <p className="text-muted-foreground mb-4">The profile you're looking for doesn't exist.</p>
          <Button onClick={() => navigate('/lawyers')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Directory
          </Button>
        </div>
      </div>
    );
  }

  // Honour brand accent for the avatar ring / firm card; keep JuristMind gold for CTAs
  const accentColor = lawyer.brand_accent_color || '#C9A84C';
  const bioData = lawyer.bio_structured || { about: lawyer.description, approach: '', case_studies: [] };
  const bioText = bioData.about || lawyer.description || '';
  const topRated = (lawyer.rating || 0) >= 4.5 && (lawyer.total_ratings || 0) >= 5;
  const memberSince = lawyer.created_at
    ? new Date(lawyer.created_at).toLocaleDateString('en', { month: 'short', year: 'numeric' })
    : '—';
  const visibleSpecs = lawyer.specialization || [];

  const profileUrl = `https://jurist-mind-ai.lovable.app/lawyers/${lawyer.slug || lawyer.id}`;
  const seoTitle = `${lawyer.name}${lawyer.specialization?.[0] ? ` | ${lawyer.specialization[0]}` : ""}${lawyer.city ? ` in ${lawyer.city}` : ""} | JuristMind`;
  const seoDescription = (bioData.about || lawyer.description || `${lawyer.name} — verified lawyer on JuristMind.`).slice(0, 155);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LegalService",
    name: lawyer.name,
    url: profileUrl,
    image: lawyer.avatar_url || undefined,
    description: seoDescription,
    address: {
      "@type": "PostalAddress",
      streetAddress: lawyer.street || undefined,
      addressLocality: lawyer.city || undefined,
      addressRegion: lawyer.state,
      postalCode: lawyer.postal_code || undefined,
      addressCountry: lawyer.country || undefined,
    },
    areaServed: [lawyer.city, lawyer.state, lawyer.country].filter(Boolean),
    knowsAbout: lawyer.specialization,
    telephone: lawyer.phone || undefined,
    email: lawyer.email,
    aggregateRating: lawyer.total_ratings > 0 ? {
      "@type": "AggregateRating",
      ratingValue: lawyer.rating,
      reviewCount: lawyer.total_ratings,
    } : undefined,
  };

  return (
    <div className="h-full bg-background overflow-y-auto pb-24 md:pb-8">
      <Helmet>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDescription} />
        <link rel="canonical" href={profileUrl} />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDescription} />
        <meta property="og:url" content={profileUrl} />
        <meta property="og:type" content="profile" />
        {lawyer.avatar_url && <meta property="og:image" content={lawyer.avatar_url} />}
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-4 md:pt-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <ChevronRight className="w-3 h-3" />
          <Link to="/lawyers" className="hover:text-foreground">Lawyers</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-foreground truncate max-w-[200px]">{lawyer.name}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: Profile card */}
          <aside className="lg:col-span-3 space-y-4">
            <Card className="overflow-hidden border-border/60">
              <div className="relative aspect-square w-full bg-muted">
                {lawyer.avatar_url ? (
                  <img src={lawyer.avatar_url} alt={lawyer.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-primary bg-primary/5">
                    {getInitials(lawyer.name)}
                  </div>
                )}
                {lawyer.verification_status === 'verified' && (
                  <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background/95 backdrop-blur border border-border/60 shadow-sm">
                    <Shield className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-medium">Verified Lawyer</span>
                  </div>
                )}
              </div>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${lawyer.availability_status === 'online' ? 'bg-emerald-500 animate-pulse' : lawyer.availability_status === 'busy' ? 'bg-amber-500' : 'bg-muted-foreground/40'}`} />
                  <span className="text-sm font-medium text-foreground">
                    {lawyer.availability_status === 'online' ? 'Available' : lawyer.availability_status === 'busy' ? 'Busy' : 'Offline'}
                  </span>
                </div>

                <div className="space-y-2 pt-2">
                  <ConsultationRequest lawyerId={lawyer.id} lawyerName={lawyer.name} accentColor={accentColor} />
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => lawyer.email && (window.location.href = `mailto:${lawyer.email}`)}
                  >
                    <MessageSquare className="w-4 h-4 mr-2" /> Send Message
                  </Button>
                  <Button variant="outline" className="w-full" onClick={toggleSave} disabled={savingToggle}>
                    <Bookmark className={`w-4 h-4 mr-2 ${isSaved ? 'fill-primary text-primary' : ''}`} />
                    {isSaved ? 'Saved' : 'Save Lawyer'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {lawyer.verification_status === 'verified' && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                      <Shield className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">Verified Professional</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        This lawyer's credentials and documents have been verified by JuristMind.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="border-border/60">
              <CardContent className="p-4 text-sm space-y-3">
                <Stat icon={<CalendarIcon className="w-4 h-4" />} label="Member since" value={memberSince} />
                {lawyer.response_time_label && (
                  <Stat icon={<Clock className="w-4 h-4" />} label="Response time" value={lawyer.response_time_label} />
                )}
                {lawyer.languages && lawyer.languages.length > 0 && (
                  <Stat icon={<Languages className="w-4 h-4" />} label="Languages" value={lawyer.languages.join(', ')} />
                )}
                {(lawyer.profile_views ?? 0) > 0 && (
                  <Stat icon={<Eye className="w-4 h-4" />} label="Profile views" value={String(lawyer.profile_views)} />
                )}
              </CardContent>
            </Card>
          </aside>

          {/* CENTER: Header + Tabs */}
          <main className="lg:col-span-6 space-y-6" id="book-section">
            <div>
              {topRated && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-primary/30 bg-primary/5 mb-3">
                  <Star className="w-3.5 h-3.5 fill-primary text-primary" />
                  <span className="text-xs font-semibold text-primary">Top Rated Lawyer</span>
                </div>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-3xl md:text-4xl font-bold text-foreground">{lawyer.name}</h1>
                {lawyer.verification_status === 'verified' && (
                  <CheckCircle2 className="w-6 h-6 text-primary shrink-0" aria-label="Verified" />
                )}
              </div>
              {(lawyer.firm_name || firm) && (
                <p className="text-base text-muted-foreground mt-1">
                  {lawyer.years_experience >= 10 ? 'Managing Partner' : 'Lawyer'} at{' '}
                  {firm ? (
                    <Link to={`/firms/${firm.slug}`} className="text-primary hover:underline font-medium">
                      {firm.name}
                    </Link>
                  ) : (
                    <span className="text-primary font-medium">{lawyer.firm_name}</span>
                  )}
                </p>
              )}

              {(lawyer.total_ratings || 0) > 0 && (
                <div className="flex items-center gap-2 mt-3 text-sm">
                  <div className="flex items-center">
                    {[1,2,3,4,5].map(i => (
                      <Star key={i} className={`w-4 h-4 ${i <= Math.round(lawyer.rating || 0) ? 'fill-primary text-primary' : 'text-muted-foreground/30'}`} />
                    ))}
                  </div>
                  <span className="font-semibold text-foreground">{lawyer.rating?.toFixed(1)}</span>
                  <span className="text-muted-foreground">({lawyer.total_ratings} reviews)</span>
                </div>
              )}

              <div className="mt-3 space-y-1.5 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="w-4 h-4 shrink-0" />
                  <span>{[lawyer.city, lawyer.state, lawyer.country].filter(Boolean).join(', ')}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Briefcase className="w-4 h-4 shrink-0" />
                  <span>{lawyer.years_experience}+ years experience</span>
                </div>
                {visibleSpecs.length > 0 && (
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <Tag className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      {visibleSpecs.slice(0, 3).join(', ')}
                      {visibleSpecs.length > 3 && (
                        <button onClick={() => setActiveTab('practice')} className="text-primary hover:underline ml-1">
                          +{visibleSpecs.length - 3} more
                        </button>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full justify-start overflow-x-auto flex-nowrap whitespace-nowrap h-auto p-1 bg-transparent border-b border-border rounded-none">
                {[
                  { v: 'overview', l: 'Overview' },
                  { v: 'about', l: 'About' },
                  { v: 'practice', l: 'Practice Areas' },
                  { v: 'experience', l: 'Experience' },
                  { v: 'reviews', l: `Reviews${lawyer.total_ratings ? ` (${lawyer.total_ratings})` : ''}` },
                  { v: 'credentials', l: 'Credentials' },
                  { v: 'articles', l: 'Articles' },
                  { v: 'qa', l: 'Q&A' },
                ].map(t => (
                  <TabsTrigger
                    key={t.v}
                    value={t.v}
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3"
                  >
                    {t.l}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="overview" className="mt-6 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">About {lawyer.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className={`text-muted-foreground leading-relaxed ${!bioExpanded ? 'line-clamp-3' : ''}`}>
                      {bioText || 'No bio available yet.'}
                    </p>
                    {bioText.length > 240 && (
                      <button onClick={() => setBioExpanded(!bioExpanded)} className="text-primary text-sm mt-2 hover:underline">
                        {bioExpanded ? 'Show less' : 'Read more'}
                      </button>
                    )}
                  </CardContent>
                </Card>

                {visibleSpecs.length > 0 && (
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-lg">Practice Areas</CardTitle>
                      {visibleSpecs.length > 6 && (
                        <button onClick={() => setActiveTab('practice')} className="text-sm text-primary hover:underline">
                          View all ({visibleSpecs.length})
                        </button>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {visibleSpecs.slice(0, 6).map(s => (
                          <Badge key={s} variant="secondary" className="px-3 py-1">{s}</Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <LawyerReviews lawyerId={lawyer.id} accentColor={accentColor} />
              </TabsContent>

              <TabsContent value="about" className="mt-6 space-y-4">
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="font-semibold mb-2">Full bio</h3>
                    <p className="text-muted-foreground whitespace-pre-line">{bioText || '—'}</p>
                    {bioData.approach && (
                      <>
                        <h3 className="font-semibold mt-6 mb-2">Approach</h3>
                        <p className="text-muted-foreground whitespace-pre-line">{bioData.approach}</p>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="practice" className="mt-6">
                <Card>
                  <CardContent className="pt-6">
                    {visibleSpecs.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No practice areas listed yet.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {visibleSpecs.map(s => (
                          <div key={s} className="flex items-center gap-3 p-3 rounded-lg border border-border/60 hover:border-primary/40 transition-colors">
                            <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center">
                              <Tag className="w-4 h-4 text-primary" />
                            </div>
                            <span className="font-medium">{s}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="experience" className="mt-6">
                <Card>
                  <CardContent className="pt-6">
                    {experiences.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No experience timeline added yet.</p>
                    ) : (
                      <div className="relative pl-6 border-l-2 border-border space-y-6">
                        {experiences.map(exp => (
                          <div key={exp.id} className="relative">
                            <span className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-primary border-4 border-background" />
                            <div className="flex flex-wrap items-baseline gap-2">
                              <h4 className="font-semibold">{exp.title}</h4>
                              {exp.is_current && <Badge variant="secondary" className="text-xs">Current</Badge>}
                            </div>
                            <p className="text-sm text-muted-foreground">{exp.company}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {new Date(exp.start_date).toLocaleDateString('en', { month: 'short', year: 'numeric' })} —{' '}
                              {exp.end_date ? new Date(exp.end_date).toLocaleDateString('en', { month: 'short', year: 'numeric' }) : 'Present'}
                            </p>
                            {exp.description && <p className="text-sm text-muted-foreground mt-2">{exp.description}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="reviews" className="mt-6">
                <LawyerReviews lawyerId={lawyer.id} accentColor={accentColor} />
              </TabsContent>

              <TabsContent value="credentials" className="mt-6">
                <Card>
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
                      <Shield className="w-5 h-5 text-primary mt-0.5" />
                      <div className="text-sm">
                        <p className="font-semibold text-foreground">Verified by JuristMind</p>
                        <p className="text-muted-foreground mt-1">
                          We have reviewed this lawyer's credentials. Document names are masked for privacy.
                        </p>
                      </div>
                    </div>
                    {lawyer.bar_number && (
                      <div className="flex items-center gap-3 p-3 rounded-lg border border-border/60">
                        <Award className="w-4 h-4 text-muted-foreground" />
                        <div className="text-sm">
                          <p className="font-medium">Bar Enrolment</p>
                          <p className="text-muted-foreground font-mono">
                            {lawyer.bar_number.length > 4 ? `${'•'.repeat(lawyer.bar_number.length - 4)}${lawyer.bar_number.slice(-4)}` : lawyer.bar_number}
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
                <div className="mt-6">
                  <IntakeVault lawyerId={lawyer.id} />
                </div>
              </TabsContent>

              <TabsContent value="articles" className="mt-6">
                {articles.length === 0 ? (
                  <Card><CardContent className="pt-6 text-sm text-muted-foreground">No published articles yet.</CardContent></Card>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {articles.map(a => (
                      <Card key={a.id} className="hover:border-primary/40 transition-colors">
                        <CardContent className="pt-6">
                          <h4 className="font-semibold line-clamp-2">{a.title}</h4>
                          {a.excerpt && <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{a.excerpt}</p>}
                          {a.published_at && (
                            <p className="text-xs text-muted-foreground mt-3">
                              {new Date(a.published_at).toLocaleDateString()}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="qa" className="mt-6 space-y-3">
                {qa.length === 0 ? (
                  <Card><CardContent className="pt-6 text-sm text-muted-foreground">No questions answered yet.</CardContent></Card>
                ) : qa.map(t => (
                  <Card key={t.id}>
                    <CardContent className="pt-6">
                      <p className="font-medium text-foreground">{t.question}</p>
                      <p className="text-xs text-muted-foreground mt-1">Asked by {t.asked_by_name || 'Anonymous'}</p>
                      <div className="mt-3 pl-4 border-l-2 border-primary/40">
                        <p className="text-sm text-muted-foreground whitespace-pre-line">{t.answer}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            </Tabs>
          </main>

          {/* RIGHT: Availability + Contact + Firm */}
          <aside className="lg:col-span-3 space-y-4">
            <LawyerSchedule lawyerId={lawyer.id} accentColor={accentColor} />

            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Contact Lawyer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {lawyer.phone && (
                  <button
                    onClick={callUsNow}
                    className="flex items-center gap-3 w-full text-left hover:text-primary transition-colors group"
                  >
                    <Phone className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                    <span className="flex-1">{lawyer.phone}</span>
                    <Copy className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                )}
                {lawyer.email && (
                  <a href={`mailto:${lawyer.email}`} className="flex items-center gap-3 text-primary hover:underline break-all">
                    <Mail className="w-4 h-4 shrink-0" />
                    <span className="truncate">{lawyer.email}</span>
                  </a>
                )}
                {lawyer.website && (
                  <a
                    href={lawyer.website.startsWith('http') ? lawyer.website : `https://${lawyer.website}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 text-primary hover:underline break-all"
                  >
                    <Globe className="w-4 h-4 shrink-0" />
                    <span className="truncate">{lawyer.website.replace(/^https?:\/\//, '')}</span>
                  </a>
                )}
                {lawyer.social_media && (
                  <a
                    href={lawyer.social_media.startsWith('http') ? lawyer.social_media : `https://${lawyer.social_media}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 text-primary hover:underline"
                  >
                    <Linkedin className="w-4 h-4 shrink-0" />
                    <span>Social Profile</span>
                  </a>
                )}
                {lawyer.phone && (
                  <Button onClick={callUsNow} className="w-full mt-2" size="sm">
                    <Phone className="w-4 h-4 mr-2" /> Call Us Now
                  </Button>
                )}
              </CardContent>
            </Card>

            {(firm || lawyer.firm_name) && (
              <Card className={firm?.is_priority_partner ? 'border-primary/50 ring-1 ring-primary/20' : 'border-border/60'}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                      {(firm?.logo_url || lawyer.firm_logo_url) ? (
                        <img src={firm?.logo_url || lawyer.firm_logo_url} alt={firm?.name || lawyer.firm_name} className="w-full h-full object-cover" />
                      ) : (
                        <Building2 className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-foreground truncate">
                          {firm?.name || lawyer.firm_name}
                        </h4>
                        {firm?.is_priority_partner && (
                          <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px]">
                            <Star className="w-2.5 h-2.5 mr-0.5 fill-primary" /> Priority Partner
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">Law Firm</p>
                    </div>
                  </div>
                  {firm?.description && (
                    <p className="text-sm text-muted-foreground mt-3 line-clamp-3">{firm.description}</p>
                  )}
                  {(firm?.city || firm?.country) && (
                    <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      {[firm?.city, firm?.country].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {firm?.slug && (
                    <Link to={`/firms/${firm.slug}`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-3">
                      View Firm Profile <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </CardContent>
              </Card>
            )}
          </aside>
        </div>

        <Button
          variant="ghost"
          className="my-8"
          onClick={() => navigate('/lawyers')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Directory
        </Button>
      </div>

      <StickyMobileActions
        email={lawyer.email}
        phone={lawyer.phone}
        onBook={scrollToBook}
        accentColor={accentColor}
      />
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-muted-foreground">{icon} {label}</span>
      <span className="font-medium text-foreground text-right truncate">{value}</span>
    </div>
  );
}
