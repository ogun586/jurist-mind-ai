-- Create storage bucket for lawyer profile assets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lawyer-assets', 
  'lawyer-assets', 
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Create private bucket for credentials (admin only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lawyer-credentials', 
  'lawyer-credentials', 
  false,
  10485760, -- 10MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for lawyer-assets (public bucket)
CREATE POLICY "Anyone can view lawyer assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'lawyer-assets');

CREATE POLICY "Lawyers can upload their own assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'lawyer-assets' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Lawyers can update their own assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'lawyer-assets' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Lawyers can delete their own assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'lawyer-assets' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Storage policies for lawyer-credentials (private bucket)
CREATE POLICY "Lawyers can upload their credentials"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'lawyer-credentials' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Lawyers can view their own credentials"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'lawyer-credentials' 
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR auth.uid() = get_admin_uid()
  )
);

CREATE POLICY "Admins can manage all credentials"
ON storage.objects FOR ALL
USING (
  bucket_id = 'lawyer-credentials' 
  AND auth.uid() = get_admin_uid()
);