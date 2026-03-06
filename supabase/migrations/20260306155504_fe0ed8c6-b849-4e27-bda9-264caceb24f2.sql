-- Create juristlens_sessions table
CREATE TABLE public.juristlens_sessions (
  session_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lawyer_id UUID NOT NULL,
  mode TEXT NOT NULL DEFAULT 'single',
  document_urls JSONB,
  document_names JSONB,
  document_url TEXT,
  document_name TEXT,
  page_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.juristlens_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own juristlens sessions"
  ON public.juristlens_sessions FOR SELECT
  USING (auth.uid() = lawyer_id);

CREATE POLICY "Users can create their own juristlens sessions"
  ON public.juristlens_sessions FOR INSERT
  WITH CHECK (auth.uid() = lawyer_id);

CREATE POLICY "Users can update their own juristlens sessions"
  ON public.juristlens_sessions FOR UPDATE
  USING (auth.uid() = lawyer_id);

CREATE POLICY "Users can delete their own juristlens sessions"
  ON public.juristlens_sessions FOR DELETE
  USING (auth.uid() = lawyer_id);

-- Create juristlens_messages table
CREATE TABLE public.juristlens_messages (
  message_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.juristlens_sessions(session_id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT,
  clause TEXT,
  page_number INTEGER,
  document_name TEXT,
  confidence TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.juristlens_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own juristlens messages"
  ON public.juristlens_messages FOR SELECT
  USING (session_id IN (
    SELECT session_id FROM public.juristlens_sessions WHERE lawyer_id = auth.uid()
  ));

CREATE POLICY "Users can create their own juristlens messages"
  ON public.juristlens_messages FOR INSERT
  WITH CHECK (session_id IN (
    SELECT session_id FROM public.juristlens_sessions WHERE lawyer_id = auth.uid()
  ));

CREATE POLICY "Users can delete their own juristlens messages"
  ON public.juristlens_messages FOR DELETE
  USING (session_id IN (
    SELECT session_id FROM public.juristlens_sessions WHERE lawyer_id = auth.uid()
  ));

-- Timestamp trigger for juristlens_sessions
CREATE TRIGGER update_juristlens_sessions_updated_at
  BEFORE UPDATE ON public.juristlens_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for JuristLens documents (public so Render backend can fetch by URL)
INSERT INTO storage.buckets (id, name, public)
VALUES ('juristlens-documents', 'juristlens-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY "Authenticated users can upload juristlens docs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'juristlens-documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Public can view juristlens documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'juristlens-documents');

CREATE POLICY "Users can delete their own juristlens documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'juristlens-documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );