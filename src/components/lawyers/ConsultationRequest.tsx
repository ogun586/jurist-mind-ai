import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function ConsultationRequest({
  lawyerId,
  lawyerName,
  accentColor,
}: {
  lawyerId: string;
  lawyerName: string;
  accentColor?: string;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"virtual" | "office" | "phone">("virtual");
  const [scheduledAt, setScheduledAt] = useState("");

  async function submit() {
    if (!user) {
      toast.error("Please sign in to request a consultation");
      navigate("/auth");
      return;
    }
    if (!subject.trim()) {
      toast.error("Please enter a subject");
      return;
    }
    setLoading(true);
    try {
      const { error } = await (supabase.from as any)("consultations").insert({
        lawyer_id: lawyerId,
        client_id: user.id,
        subject,
        message,
        mode,
        scheduled_at: scheduledAt || null,
        status: scheduledAt ? "scheduled" : "requested",
      });
      if (error) throw error;
      toast.success("Consultation request sent");
      setOpen(false);
      setSubject("");
      setMessage("");
      setScheduledAt("");
    } catch (e: any) {
      toast.error(e.message || "Failed to submit request");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        size="lg"
        className="flex-1 md:flex-none"
        style={accentColor ? { backgroundColor: accentColor } : undefined}
        onClick={() => setOpen(true)}
      >
        <Calendar className="w-4 h-4 mr-2" />
        Book Consultation
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Book with {lawyerName}</DialogTitle>
            <DialogDescription>Share a brief about your matter. The lawyer will confirm shortly.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Subject *</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Contract review" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Mode</Label>
                <Select value={mode} onValueChange={(v: any) => setMode(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="virtual">Virtual</SelectItem>
                    <SelectItem value="office">In-office</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Preferred time</Label>
                <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Brief description</Label>
              <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe your matter..." />
            </div>
            <Button onClick={submit} disabled={loading} className="w-full" style={accentColor ? { backgroundColor: accentColor } : undefined}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Send Request
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}