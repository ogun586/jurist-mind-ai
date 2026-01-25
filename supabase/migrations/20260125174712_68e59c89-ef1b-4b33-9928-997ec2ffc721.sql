-- Create documents table for the marketplace
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected')),
  uploader_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  uploader_name TEXT,
  page_count INTEGER DEFAULT 0,
  file_size INTEGER NOT NULL,
  view_count INTEGER DEFAULT 0,
  download_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT
);

-- Create indexes for better performance
CREATE INDEX idx_documents_status ON public.documents(status);
CREATE INDEX idx_documents_uploader_id ON public.documents(uploader_id);
CREATE INDEX idx_documents_created_at ON public.documents(created_at DESC);

-- Enable RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Everyone can view active documents
CREATE POLICY "Everyone can view active documents"
ON public.documents FOR SELECT
USING (status = 'active');

-- Users can view their own documents regardless of status
CREATE POLICY "Users can view own documents"
ON public.documents FOR SELECT
USING (auth.uid() = uploader_id);

-- Admin can view all documents
CREATE POLICY "Admin can view all documents"
ON public.documents FOR SELECT
USING (auth.uid() = get_admin_uid());

-- Users can insert their own documents
CREATE POLICY "Users can upload documents"
ON public.documents FOR INSERT
WITH CHECK (auth.uid() = uploader_id);

-- Users can update their own pending documents
CREATE POLICY "Users can update own pending documents"
ON public.documents FOR UPDATE
USING (auth.uid() = uploader_id AND status = 'pending');

-- Admin can update any document (for approval/rejection)
CREATE POLICY "Admin can update any document"
ON public.documents FOR UPDATE
USING (auth.uid() = get_admin_uid());

-- Users can delete their own documents
CREATE POLICY "Users can delete own documents"
ON public.documents FOR DELETE
USING (auth.uid() = uploader_id);

-- Admin can delete any document
CREATE POLICY "Admin can delete any document"
ON public.documents FOR DELETE
USING (auth.uid() = get_admin_uid());

-- Create function to increment view count
CREATE OR REPLACE FUNCTION public.increment_document_views(doc_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.documents
  SET view_count = view_count + 1
  WHERE id = doc_id;
END;
$$;

-- Create function to increment download count
CREATE OR REPLACE FUNCTION public.increment_document_downloads(doc_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.documents
  SET download_count = download_count + 1
  WHERE id = doc_id;
END;
$$;

-- Create trigger to update updated_at
CREATE TRIGGER update_documents_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('marketplace-documents', 'marketplace-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for documents bucket
CREATE POLICY "Anyone can view marketplace documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'marketplace-documents');

CREATE POLICY "Authenticated users can upload documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'marketplace-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update own documents"
ON storage.objects FOR UPDATE
USING (bucket_id = 'marketplace-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'marketplace-documents' AND auth.uid()::text = (storage.foldername(name))[1]);