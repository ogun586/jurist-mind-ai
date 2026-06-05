import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Building2, MapPin, Globe, Star, ChevronRight, Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

export default function FirmProfilePage() {
  const { slug } = useParams();
  const [firm, setFirm] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data: f } = await (supabase.from as any)("firms").select("*").eq("slug", slug).maybeSingle();
      setFirm(f);
      if (f?.id) {
        const { data: links } = await (supabase.from as any)("firm_members")
          .select("title_at_firm, is_primary_contact, lawyer_id").eq("firm_id", f.id);
        const ids = (links || []).map((l: any) => l.lawyer_id);
        if (ids.length) {
          const { data: lws } = await (supabase.from as any)("lawyers")
            .select("id, name, avatar_url, slug, specialization, city, rating, total_ratings, verification_status")
            .in("id", ids);
          const byId = new Map((lws || []).map((l: any) => [l.id, l]));
          setMembers((links || []).map((l: any) => ({ ...l, lawyer: byId.get(l.lawyer_id) })).filter((m: any) => m.lawyer));
        }
      }
      setLoading(false);
    })();
  }, [slug]);

  if (loading) {
    return <div className="max-w-5xl mx-auto p-6"><Skeleton className="h-40 w-full" /></div>;
  }
  if (!firm) {
    return <div className="max-w-5xl mx-auto p-6 text-center text-muted-foreground">Firm not found.</div>;
  }

  const profileUrl = `https://jurist-mind-ai.lovable.app/firms/${firm.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LegalService",
    name: firm.name,
    url: profileUrl,
    description: firm.description || undefined,
    address: { "@type": "PostalAddress", addressLocality: firm.city, addressCountry: firm.country },
  };

  return (
    <div className="h-full bg-background overflow-y-auto">
      <Helmet>
        <title>{firm.name} — Law Firm | JuristMind</title>
        <meta name="description" content={(firm.description || `${firm.name} on JuristMind.`).slice(0, 155)} />
        <link rel="canonical" href={profileUrl} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>
      <div className="max-w-5xl mx-auto p-4 md:p-6">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <ChevronRight className="w-3 h-3" />
          <Link to="/lawyers" className="hover:text-foreground">Lawyers</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-foreground">{firm.name}</span>
        </div>

        <Card className={firm.is_priority_partner ? "border-primary/50 ring-1 ring-primary/20" : ""}>
          <CardContent className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="w-24 h-24 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
                {firm.logo_url ? <img src={firm.logo_url} alt={firm.name} className="w-full h-full object-cover" /> : <Building2 className="w-10 h-10 text-muted-foreground" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl md:text-3xl font-bold">{firm.name}</h1>
                  {firm.is_priority_partner && (
                    <Badge className="bg-primary/15 text-primary border-primary/30">
                      <Star className="w-3 h-3 mr-1 fill-primary" /> Priority Partner
                    </Badge>
                  )}
                  {firm.is_verified && (
                    <Badge variant="outline" className="border-primary/30 text-primary">
                      <Shield className="w-3 h-3 mr-1" /> Verified
                    </Badge>
                  )}
                </div>
                {firm.description && <p className="text-muted-foreground mt-3">{firm.description}</p>}
                <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
                  {(firm.city || firm.country) && (
                    <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" />{[firm.city, firm.country].filter(Boolean).join(", ")}</span>
                  )}
                  {firm.website && (
                    <a href={firm.website.startsWith("http") ? firm.website : `https://${firm.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-primary hover:underline">
                      <Globe className="w-4 h-4" />{firm.website.replace(/^https?:\/\//, "")}
                    </a>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <h2 className="text-xl font-semibold mt-8 mb-4">Lawyers at {firm.name}</h2>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No lawyers linked to this firm yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {members.map((m) => (
              <Link key={m.lawyer_id} to={`/lawyers/${m.lawyer.slug || m.lawyer.id}`}>
                <Card className="hover:border-primary/40 transition-colors h-full">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 overflow-hidden flex items-center justify-center text-primary font-semibold">
                      {m.lawyer.avatar_url ? <img src={m.lawyer.avatar_url} alt={m.lawyer.name} className="w-full h-full object-cover" /> : m.lawyer.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{m.lawyer.name}</p>
                      {m.title_at_firm && <p className="text-xs text-muted-foreground truncate">{m.title_at_firm}</p>}
                      {m.lawyer.city && <p className="text-xs text-muted-foreground truncate">{m.lawyer.city}</p>}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}