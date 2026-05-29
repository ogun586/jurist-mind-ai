-- Phase 1: Lawyer Digital Identity schema extensions

-- 1. Extend lawyers table
ALTER TABLE public.lawyers
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN GENERATED ALWAYS AS (verification_status = 'verified') STORED,
  ADD COLUMN IF NOT EXISTS address_json JSONB DEFAULT '{}'::jsonb;

-- Allow public reading of verified lawyers by slug (for SEO public profile pages without auth)
DROP POLICY IF EXISTS "Public can view verified lawyers by slug" ON public.lawyers;
CREATE POLICY "Public can view verified lawyers by slug"
  ON public.lawyers FOR SELECT
  TO anon
  USING (verification_status = 'verified');

GRANT SELECT ON public.lawyers TO anon;

-- 2. lawyer_schedules
CREATE TABLE IF NOT EXISTS public.lawyer_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id UUID NOT NULL REFERENCES public.lawyers(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  mode TEXT NOT NULL DEFAULT 'office' CHECK (mode IN ('office','virtual')),
  timezone TEXT DEFAULT 'Africa/Lagos',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.lawyer_schedules TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lawyer_schedules TO authenticated;
GRANT ALL ON public.lawyer_schedules TO service_role;
ALTER TABLE public.lawyer_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view schedules of verified lawyers"
  ON public.lawyer_schedules FOR SELECT
  USING (lawyer_id IN (SELECT id FROM public.lawyers WHERE verification_status = 'verified'));

CREATE POLICY "Lawyers manage their own schedules"
  ON public.lawyer_schedules FOR ALL
  USING (lawyer_id IN (SELECT id FROM public.lawyers WHERE user_id = auth.uid()))
  WITH CHECK (lawyer_id IN (SELECT id FROM public.lawyers WHERE user_id = auth.uid()));

-- 3. consultations
CREATE TABLE IF NOT EXISTS public.consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id UUID NOT NULL REFERENCES public.lawyers(id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  subject TEXT NOT NULL,
  message TEXT,
  mode TEXT NOT NULL DEFAULT 'virtual' CHECK (mode IN ('office','virtual','phone')),
  scheduled_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','scheduled','completed','cancelled','declined')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.consultations TO authenticated;
GRANT ALL ON public.consultations TO service_role;
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can create consultations"
  ON public.consultations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Participants can view consultations"
  ON public.consultations FOR SELECT TO authenticated
  USING (
    auth.uid() = client_id OR
    lawyer_id IN (SELECT id FROM public.lawyers WHERE user_id = auth.uid())
  );

CREATE POLICY "Lawyer can update their consultations"
  ON public.consultations FOR UPDATE TO authenticated
  USING (lawyer_id IN (SELECT id FROM public.lawyers WHERE user_id = auth.uid()));

CREATE POLICY "Client can cancel their own consultations"
  ON public.consultations FOR UPDATE TO authenticated
  USING (auth.uid() = client_id);

-- 4. lawyer_reviews (gated)
CREATE TABLE IF NOT EXISTS public.lawyer_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id UUID NOT NULL REFERENCES public.lawyers(id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  consultation_id UUID NOT NULL REFERENCES public.consultations(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review TEXT,
  is_approved BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(consultation_id)
);

GRANT SELECT ON public.lawyer_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lawyer_reviews TO authenticated;
GRANT ALL ON public.lawyer_reviews TO service_role;
ALTER TABLE public.lawyer_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved reviews are public"
  ON public.lawyer_reviews FOR SELECT
  USING (is_approved = true);

CREATE POLICY "Clients can submit gated reviews"
  ON public.lawyer_reviews FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = client_id AND
    EXISTS (
      SELECT 1 FROM public.consultations c
      WHERE c.id = consultation_id
        AND c.client_id = auth.uid()
        AND c.lawyer_id = lawyer_reviews.lawyer_id
        AND c.status = 'completed'
    )
  );

CREATE POLICY "Clients can update their own reviews"
  ON public.lawyer_reviews FOR UPDATE TO authenticated
  USING (auth.uid() = client_id);

-- 5. client_intake_files (metadata)
CREATE TABLE IF NOT EXISTS public.client_intake_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id UUID NOT NULL REFERENCES public.consultations(id) ON DELETE CASCADE,
  lawyer_id UUID NOT NULL REFERENCES public.lawyers(id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.client_intake_files TO authenticated;
GRANT ALL ON public.client_intake_files TO service_role;
ALTER TABLE public.client_intake_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view intake files"
  ON public.client_intake_files FOR SELECT TO authenticated
  USING (
    auth.uid() = client_id OR
    lawyer_id IN (SELECT id FROM public.lawyers WHERE user_id = auth.uid())
  );

CREATE POLICY "Clients upload intake files"
  ON public.client_intake_files FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Uploader can delete intake files"
  ON public.client_intake_files FOR DELETE TO authenticated
  USING (auth.uid() = client_id);

-- 6. Storage bucket for client intake
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-intake', 'client-intake', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS for client-intake (path layout: {lawyer_id}/{consultation_id}/{file})
CREATE POLICY "Clients upload to consultation folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'client-intake' AND
    EXISTS (
      SELECT 1 FROM public.consultations c
      WHERE c.id::text = (storage.foldername(name))[2]
        AND c.client_id = auth.uid()
    )
  );

CREATE POLICY "Participants can read intake files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'client-intake' AND
    EXISTS (
      SELECT 1 FROM public.consultations c
      WHERE c.id::text = (storage.foldername(name))[2]
        AND (
          c.client_id = auth.uid() OR
          c.lawyer_id IN (SELECT id FROM public.lawyers WHERE user_id = auth.uid())
        )
    )
  );

-- 7. Trigger to keep lawyer rating in sync with lawyer_reviews
CREATE OR REPLACE FUNCTION public.update_lawyer_rating_from_reviews()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.lawyers
  SET rating = COALESCE((
        SELECT AVG(rating)::numeric(2,1)
        FROM public.lawyer_reviews
        WHERE lawyer_id = COALESCE(NEW.lawyer_id, OLD.lawyer_id)
          AND is_approved = true
      ), 0),
      total_ratings = (
        SELECT COUNT(*) FROM public.lawyer_reviews
        WHERE lawyer_id = COALESCE(NEW.lawyer_id, OLD.lawyer_id)
          AND is_approved = true
      ),
      updated_at = now()
  WHERE id = COALESCE(NEW.lawyer_id, OLD.lawyer_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_lawyer_reviews_rating ON public.lawyer_reviews;
CREATE TRIGGER trg_lawyer_reviews_rating
AFTER INSERT OR UPDATE OR DELETE ON public.lawyer_reviews
FOR EACH ROW EXECUTE FUNCTION public.update_lawyer_rating_from_reviews();

-- 8. updated_at triggers
CREATE TRIGGER trg_lawyer_schedules_updated
BEFORE UPDATE ON public.lawyer_schedules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_consultations_updated
BEFORE UPDATE ON public.consultations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Indexes
CREATE INDEX IF NOT EXISTS idx_lawyer_schedules_lawyer ON public.lawyer_schedules(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_consultations_lawyer ON public.consultations(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_consultations_client ON public.consultations(client_id);
CREATE INDEX IF NOT EXISTS idx_lawyer_reviews_lawyer ON public.lawyer_reviews(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_intake_files_consultation ON public.client_intake_files(consultation_id);
CREATE INDEX IF NOT EXISTS idx_lawyers_slug ON public.lawyers(slug);
CREATE INDEX IF NOT EXISTS idx_lawyers_country_ref ON public.lawyers(country_id_ref);