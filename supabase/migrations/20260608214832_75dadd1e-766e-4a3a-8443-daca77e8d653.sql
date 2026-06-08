-- Ensure generated verification flags don't block older clients that may send is_verified.
-- The app will stop sending this field, while the database keeps it derived from verification_status.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lawyers'
      AND column_name = 'is_verified'
      AND is_generated = 'ALWAYS'
  ) THEN
    RAISE NOTICE 'lawyers.is_verified is generated and will remain derived from verification_status; clients must not send explicit values.';
  END IF;
END $$;

-- Make Data API privileges explicit for the existing lawyer onboarding tables.
GRANT SELECT ON public.lawyers TO anon;
GRANT SELECT, INSERT, UPDATE ON public.lawyers TO authenticated;
GRANT ALL ON public.lawyers TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.lawyer_credentials TO authenticated;
GRANT ALL ON public.lawyer_credentials TO service_role;

-- Storage uploads: replace brittle/overlapping policies with explicit durable rules.
DROP POLICY IF EXISTS "Anyone can view lawyer assets" ON storage.objects;
DROP POLICY IF EXISTS "Lawyers can upload their own assets" ON storage.objects;
DROP POLICY IF EXISTS "Lawyers can update their own assets" ON storage.objects;
DROP POLICY IF EXISTS "Lawyers can delete their own assets" ON storage.objects;
DROP POLICY IF EXISTS "Lawyers can upload their credentials" ON storage.objects;
DROP POLICY IF EXISTS "Lawyers can view their own credentials" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage all credentials" ON storage.objects;
DROP POLICY IF EXISTS "Public read for lawyer-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users upload own lawyer assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users update own lawyer assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users delete own lawyer assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users upload own lawyer credentials" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users view own lawyer credentials" ON storage.objects;
DROP POLICY IF EXISTS "Admins manage lawyer credentials" ON storage.objects;

CREATE POLICY "Public read for lawyer-assets"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'lawyer-assets');

CREATE POLICY "Authenticated users upload own lawyer assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'lawyer-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Authenticated users update own lawyer assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'lawyer-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'lawyer-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Authenticated users delete own lawyer assets"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'lawyer-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Authenticated users upload own lawyer credentials"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'lawyer-credentials'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Authenticated users view own lawyer credentials"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'lawyer-credentials'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR auth.uid() = public.get_admin_uid()
  )
);

CREATE POLICY "Admins manage lawyer credentials"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'lawyer-credentials'
  AND auth.uid() = public.get_admin_uid()
)
WITH CHECK (
  bucket_id = 'lawyer-credentials'
  AND auth.uid() = public.get_admin_uid()
);