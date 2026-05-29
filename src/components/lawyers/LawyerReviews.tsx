import { useEffect, useState } from "react";
import { Star, Loader2, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Review {
  id: string;
  rating: number;
  review: string | null;
  created_at: string;
  client_id: string;
}

export function LawyerReviews({ lawyerId, accentColor }: { lawyerId: string; accentColor?: string }) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [openForm, setOpenForm] = useState(false);
  const [completedConsultations, setCompletedConsultations] = useState<any[]>([]);
  const [selectedConsultation, setSelectedConsultation] = useState<string>("");
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchReviews();
  }, [lawyerId]);

  useEffect(() => {
    if (user) fetchCompletedConsultations();
  }, [user, lawyerId]);

  async function fetchReviews() {
    const { data } = await (supabase.from as any)("lawyer_reviews")
      .select("id, rating, review, created_at, client_id")
      .eq("lawyer_id", lawyerId)
      .eq("is_approved", true)
      .order("created_at", { ascending: false })
      .limit(10);
    setReviews(data || []);
    setLoading(false);
  }

  async function fetchCompletedConsultations() {
    if (!user) return;
    const { data: cons } = await (supabase.from as any)("consultations")
      .select("id, subject")
      .eq("lawyer_id", lawyerId)
      .eq("client_id", user.id)
      .eq("status", "completed");
    const { data: existing } = await (supabase.from as any)("lawyer_reviews")
      .select("consultation_id")
      .eq("lawyer_id", lawyerId)
      .eq("client_id", user.id);
    const reviewedSet = new Set((existing || []).map((r: any) => r.consultation_id));
    setCompletedConsultations((cons || []).filter((c: any) => !reviewedSet.has(c.id)));
  }

  async function submitReview() {
    if (!user || !selectedConsultation) {
      toast.error("Select a completed consultation");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await (supabase.from as any)("lawyer_reviews").insert({
        lawyer_id: lawyerId,
        client_id: user.id,
        consultation_id: selectedConsultation,
        rating,
        review: text || null,
      });
      if (error) throw error;
      toast.success("Review submitted");
      setOpenForm(false);
      setText("");
      setRating(5);
      setSelectedConsultation("");
      fetchReviews();
      fetchCompletedConsultations();
    } catch (e: any) {
      toast.error(e.message || "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="w-5 h-5" /> Client Reviews
        </CardTitle>
        {user && completedConsultations.length > 0 && (
          <Button size="sm" onClick={() => setOpenForm(true)} style={accentColor ? { backgroundColor: accentColor } : undefined}>
            Write a Review
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        ) : reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reviews yet. Verified reviews appear after a completed consultation.</p>
        ) : (
          <div className="space-y-4">
            {reviews.map((r) => (
              <div key={r.id} className="pb-4 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-2 mb-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`w-4 h-4 ${i < r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                  ))}
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </div>
                {r.review && <p className="text-sm text-muted-foreground">{r.review}</p>}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share your experience</DialogTitle>
            <DialogDescription>Only completed consultations can be reviewed — verified client feedback only.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Consultation</label>
              <Select value={selectedConsultation} onValueChange={setSelectedConsultation}>
                <SelectTrigger><SelectValue placeholder="Select completed consultation" /></SelectTrigger>
                <SelectContent>
                  {completedConsultations.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.subject}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Rating</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setRating(n)}>
                    <Star className={`w-7 h-7 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                  </button>
                ))}
              </div>
            </div>
            <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Share what worked well..." />
            <Button onClick={submitReview} disabled={submitting} className="w-full">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Submit Review
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}