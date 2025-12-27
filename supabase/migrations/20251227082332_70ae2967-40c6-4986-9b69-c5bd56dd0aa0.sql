-- Create CTC files table for storing judgment documents
CREATE TABLE public.ctc_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID REFERENCES public.judge_notes(id) ON DELETE CASCADE NOT NULL,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL DEFAULT 'application/pdf',
    version INTEGER NOT NULL DEFAULT 1,
    judgment_date DATE,
    issuing_court TEXT,
    bench_judge_name TEXT,
    case_reference TEXT,
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    uploaded_by_name TEXT,
    is_current BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create CTC comments/annotations table
CREATE TABLE public.ctc_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ctc_file_id UUID REFERENCES public.ctc_files(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    user_name TEXT,
    content TEXT NOT NULL,
    page_number INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create audit log for CTC actions
CREATE TABLE public.ctc_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ctc_file_id UUID REFERENCES public.ctc_files(id) ON DELETE CASCADE,
    note_id UUID REFERENCES public.judge_notes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_name TEXT,
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.ctc_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ctc_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ctc_audit_log ENABLE ROW LEVEL SECURITY;

-- CTC Files policies
CREATE POLICY "Everyone can view CTC files" ON public.ctc_files
FOR SELECT USING (true);

CREATE POLICY "Authenticated users can upload CTC files" ON public.ctc_files
FOR INSERT WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can update their own CTC files" ON public.ctc_files
FOR UPDATE USING (auth.uid() = uploaded_by);

CREATE POLICY "Users can delete their own CTC files" ON public.ctc_files
FOR DELETE USING (auth.uid() = uploaded_by);

-- CTC Comments policies
CREATE POLICY "Everyone can view CTC comments" ON public.ctc_comments
FOR SELECT USING (true);

CREATE POLICY "Authenticated users can add comments" ON public.ctc_comments
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments" ON public.ctc_comments
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON public.ctc_comments
FOR DELETE USING (auth.uid() = user_id);

-- Audit log policies (read-only for users, insert via service role)
CREATE POLICY "Everyone can view audit logs" ON public.ctc_audit_log
FOR SELECT USING (true);

CREATE POLICY "System can insert audit logs" ON public.ctc_audit_log
FOR INSERT WITH CHECK (true);

-- Create storage bucket for CTC documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('ctc-documents', 'ctc-documents', false, 15728640, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies for CTC documents
CREATE POLICY "Authenticated users can upload CTC documents"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'ctc-documents' 
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Everyone can view CTC documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'ctc-documents');

CREATE POLICY "Users can delete their own CTC documents"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'ctc-documents' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_ctc_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_ctc_files_updated_at
    BEFORE UPDATE ON public.ctc_files
    FOR EACH ROW
    EXECUTE FUNCTION public.update_ctc_updated_at();

CREATE TRIGGER update_ctc_comments_updated_at
    BEFORE UPDATE ON public.ctc_comments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_ctc_updated_at();

-- Index for faster lookups
CREATE INDEX idx_ctc_files_note_id ON public.ctc_files(note_id);
CREATE INDEX idx_ctc_files_current ON public.ctc_files(note_id, is_current) WHERE is_current = true;
CREATE INDEX idx_ctc_comments_file_id ON public.ctc_comments(ctc_file_id);
CREATE INDEX idx_ctc_audit_log_note_id ON public.ctc_audit_log(note_id);