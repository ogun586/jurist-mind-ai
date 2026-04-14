
-- JuristLens Documents table
CREATE TABLE public.juristlens_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id uuid REFERENCES public.juristlens_sessions(session_id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL DEFAULT 'pdf',
  file_path text,
  status text NOT NULL DEFAULT 'pending',
  page_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.juristlens_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own documents" ON public.juristlens_documents
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own documents" ON public.juristlens_documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own documents" ON public.juristlens_documents
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own documents" ON public.juristlens_documents
  FOR DELETE USING (auth.uid() = user_id);

-- JuristLens Pages table
CREATE TABLE public.juristlens_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.juristlens_documents(id) ON DELETE CASCADE,
  page_number integer NOT NULL,
  text_content text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.juristlens_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own document pages" ON public.juristlens_pages
  FOR SELECT USING (
    document_id IN (SELECT id FROM public.juristlens_documents WHERE user_id = auth.uid())
  );
CREATE POLICY "Users can insert own document pages" ON public.juristlens_pages
  FOR INSERT WITH CHECK (
    document_id IN (SELECT id FROM public.juristlens_documents WHERE user_id = auth.uid())
  );

-- JuristLens Clauses table
CREATE TABLE public.juristlens_clauses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.juristlens_documents(id) ON DELETE CASCADE,
  title text NOT NULL,
  text text NOT NULL,
  clause_type text,
  risk_level text NOT NULL DEFAULT 'low',
  explanation text,
  recommendation text,
  page_number integer NOT NULL DEFAULT 1,
  start_offset integer DEFAULT 0,
  end_offset integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.juristlens_clauses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own document clauses" ON public.juristlens_clauses
  FOR SELECT USING (
    document_id IN (SELECT id FROM public.juristlens_documents WHERE user_id = auth.uid())
  );
CREATE POLICY "Users can insert own document clauses" ON public.juristlens_clauses
  FOR INSERT WITH CHECK (
    document_id IN (SELECT id FROM public.juristlens_documents WHERE user_id = auth.uid())
  );

-- Index for faster lookups
CREATE INDEX idx_juristlens_pages_doc ON public.juristlens_pages(document_id, page_number);
CREATE INDEX idx_juristlens_clauses_doc ON public.juristlens_clauses(document_id, page_number);
CREATE INDEX idx_juristlens_documents_user ON public.juristlens_documents(user_id);
CREATE INDEX idx_juristlens_documents_session ON public.juristlens_documents(session_id);
