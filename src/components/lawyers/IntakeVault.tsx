import { useEffect, useRef, useState } from "react";
import { Upload, File, Lock, Loader2, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function IntakeVault({ lawyerId }: { lawyerId: string }) {
  const { user } = useAuth();
  const [consultations, setConsultations] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [files, setFiles] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) loadConsultations();
  }, [user, lawyerId]);

  useEffect(() => {
    if (selected) loadFiles();
  }, [selected]);

  async function loadConsultations() {
    const { data } = await (supabase.from as any)("consultations")
      .select("id, subject, status")
      .eq("lawyer_id", lawyerId)
      .eq("client_id", user!.id)
      .in("status", ["requested", "scheduled", "completed"])
      .order("created_at", { ascending: false });
    setConsultations(data || []);
    if (data && data.length > 0) setSelected(data[0].id);
  }

  async function loadFiles() {
    const { data } = await (supabase.from as any)("client_intake_files")
      .select("*")
      .eq("consultation_id", selected)
      .order("created_at", { ascending: false });
    setFiles(data || []);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user || !selected) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File must be under 20MB");
      return;
    }
    setUploading(true);
    try {
      const path = `${lawyerId}/${selected}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("client-intake").upload(path, file);
      if (upErr) throw upErr;
      const { error: metaErr } = await (supabase.from as any)("client_intake_files").insert({
        consultation_id: selected,
        lawyer_id: lawyerId,
        client_id: user.id,
        file_name: file.name,
        file_path: path,
        file_size: file.size,
        mime_type: file.type,
      });
      if (metaErr) throw metaErr;
      toast.success("File uploaded securely");
      loadFiles();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function removeFile(f: any) {
    try {
      await supabase.storage.from("client-intake").remove([f.file_path]);
      await (supabase.from as any)("client_intake_files").delete().eq("id", f.id);
      toast.success("Removed");
      loadFiles();
    } catch (e: any) {
      toast.error(e.message || "Failed to remove");
    }
  }

  if (!user) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Lock className="w-5 h-5" /> Secure Intake Vault
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Files are private — only you and the assigned lawyer can read them.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {consultations.length === 0 ? (
          <p className="text-sm text-muted-foreground">Start by booking a consultation. You'll be able to share documents securely here.</p>
        ) : (
          <>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger><SelectValue placeholder="Select consultation" /></SelectTrigger>
              <SelectContent>
                {consultations.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.subject} · {c.status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Button onClick={() => inputRef.current?.click()} disabled={uploading} variant="outline">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                Upload File
              </Button>
              <input ref={inputRef} type="file" className="hidden" onChange={handleUpload} />
              <span className="text-xs text-muted-foreground">PDF, DOC, images · max 20MB</span>
            </div>
            <div className="space-y-2">
              {files.map((f) => (
                <div key={f.id} className="flex items-center gap-3 p-2 rounded-lg border border-border/50">
                  <File className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm flex-1 truncate">{f.file_name}</span>
                  <span className="text-xs text-muted-foreground">{(f.file_size / 1024).toFixed(0)} KB</span>
                  <Button size="icon" variant="ghost" onClick={() => removeFile(f)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
              {files.length === 0 && <p className="text-xs text-muted-foreground">No files yet.</p>}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}