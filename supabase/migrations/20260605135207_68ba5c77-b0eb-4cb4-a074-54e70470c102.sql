
-- =============================================================
-- 1. Extend lawyers table
-- =============================================================
ALTER TABLE public.lawyers
  ADD COLUMN IF NOT EXISTS is_priority_partner boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS languages text[] DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS response_time_label text,
  ADD COLUMN IF NOT EXISTS firm_id_ref uuid;

-- =============================================================
-- 2. firms
-- =============================================================
CREATE TABLE IF NOT EXISTS public.firms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  logo_url text,
  description text,
  website text,
  country text,
  country_id_ref uuid,
  state text,
  city text,
  street text,
  postal_code text,
  brand_accent_color text DEFAULT '#C9A84C',
  is_priority_partner boolean DEFAULT false,
  is_verified boolean DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.firms TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.firms TO authenticated;
GRANT ALL ON public.firms TO service_role;

ALTER TABLE public.firms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read firms" ON public.firms
  FOR SELECT USING (true);

CREATE POLICY "Authenticated can create firms" ON public.firms
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creator or admin can update firms" ON public.firms
  FOR UPDATE TO authenticated USING (
    auth.uid() = created_by
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role IN ('admin','super_admin'))
  );

CREATE POLICY "Creator or admin can delete firms" ON public.firms
  FOR DELETE TO authenticated USING (
    auth.uid() = created_by
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role IN ('admin','super_admin'))
  );

-- Slug auto-generator for firms
CREATE OR REPLACE FUNCTION public.generate_firm_slug()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 0;
BEGIN
  IF NEW.slug IS NOT NULL AND NEW.slug <> '' THEN
    RETURN NEW;
  END IF;
  base_slug := lower(regexp_replace(regexp_replace(COALESCE(NEW.name,'firm') || '-' || COALESCE(NEW.city,'ng'), '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'));
  final_slug := base_slug || '-' || substring(NEW.id::text, 1, 4);
  WHILE EXISTS (SELECT 1 FROM public.firms WHERE slug = final_slug AND id <> NEW.id) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || substring(NEW.id::text, 1, 4) || '-' || counter;
  END LOOP;
  NEW.slug := final_slug;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_firms_slug ON public.firms;
CREATE TRIGGER trg_firms_slug BEFORE INSERT ON public.firms
  FOR EACH ROW EXECUTE FUNCTION public.generate_firm_slug();

DROP TRIGGER IF EXISTS trg_firms_updated ON public.firms;
CREATE TRIGGER trg_firms_updated BEFORE UPDATE ON public.firms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- 3. firm_members
-- =============================================================
CREATE TABLE IF NOT EXISTS public.firm_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL,
  lawyer_id uuid NOT NULL,
  title_at_firm text,
  is_primary_contact boolean DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (firm_id, lawyer_id)
);

GRANT SELECT ON public.firm_members TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.firm_members TO authenticated;
GRANT ALL ON public.firm_members TO service_role;

ALTER TABLE public.firm_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read firm members" ON public.firm_members
  FOR SELECT USING (true);

CREATE POLICY "Lawyer or admin can add themselves to firm" ON public.firm_members
  FOR INSERT TO authenticated WITH CHECK (
    lawyer_id IN (SELECT id FROM public.lawyers WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role IN ('admin','super_admin'))
  );

CREATE POLICY "Lawyer or admin can update firm membership" ON public.firm_members
  FOR UPDATE TO authenticated USING (
    lawyer_id IN (SELECT id FROM public.lawyers WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role IN ('admin','super_admin'))
  );

CREATE POLICY "Lawyer or admin can leave firm" ON public.firm_members
  FOR DELETE TO authenticated USING (
    lawyer_id IN (SELECT id FROM public.lawyers WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role IN ('admin','super_admin'))
  );

-- =============================================================
-- 4. lawyer_experiences
-- =============================================================
CREATE TABLE IF NOT EXISTS public.lawyer_experiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id uuid NOT NULL,
  title text NOT NULL,
  company text NOT NULL,
  start_date date NOT NULL,
  end_date date,
  is_current boolean DEFAULT false,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.lawyer_experiences TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lawyer_experiences TO authenticated;
GRANT ALL ON public.lawyer_experiences TO service_role;

ALTER TABLE public.lawyer_experiences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read experiences of verified lawyers" ON public.lawyer_experiences
  FOR SELECT USING (
    lawyer_id IN (SELECT id FROM public.lawyers WHERE verification_status = 'verified')
  );

CREATE POLICY "Lawyer can manage own experiences" ON public.lawyer_experiences
  FOR ALL TO authenticated USING (
    lawyer_id IN (SELECT id FROM public.lawyers WHERE user_id = auth.uid())
  ) WITH CHECK (
    lawyer_id IN (SELECT id FROM public.lawyers WHERE user_id = auth.uid())
  );

-- =============================================================
-- 5. lawyer_articles
-- =============================================================
CREATE TABLE IF NOT EXISTS public.lawyer_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id uuid NOT NULL,
  title text NOT NULL,
  slug text UNIQUE,
  excerpt text,
  content text NOT NULL,
  cover_image_url text,
  is_published boolean DEFAULT false,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.lawyer_articles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lawyer_articles TO authenticated;
GRANT ALL ON public.lawyer_articles TO service_role;

ALTER TABLE public.lawyer_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read published articles" ON public.lawyer_articles
  FOR SELECT USING (is_published = true);

CREATE POLICY "Lawyer can read own articles" ON public.lawyer_articles
  FOR SELECT TO authenticated USING (
    lawyer_id IN (SELECT id FROM public.lawyers WHERE user_id = auth.uid())
  );

CREATE POLICY "Lawyer can manage own articles" ON public.lawyer_articles
  FOR ALL TO authenticated USING (
    lawyer_id IN (SELECT id FROM public.lawyers WHERE user_id = auth.uid())
  ) WITH CHECK (
    lawyer_id IN (SELECT id FROM public.lawyers WHERE user_id = auth.uid())
  );

DROP TRIGGER IF EXISTS trg_articles_updated ON public.lawyer_articles;
CREATE TRIGGER trg_articles_updated BEFORE UPDATE ON public.lawyer_articles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- 6. lawyer_qa_threads
-- =============================================================
CREATE TABLE IF NOT EXISTS public.lawyer_qa_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id uuid NOT NULL,
  asked_by_user_id uuid,
  asked_by_name text DEFAULT 'Anonymous',
  question text NOT NULL,
  answer text,
  is_answered boolean DEFAULT false,
  is_public boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz
);

GRANT SELECT ON public.lawyer_qa_threads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lawyer_qa_threads TO authenticated;
GRANT ALL ON public.lawyer_qa_threads TO service_role;

ALTER TABLE public.lawyer_qa_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read answered public Q&A" ON public.lawyer_qa_threads
  FOR SELECT USING (is_public = true AND is_answered = true);

CREATE POLICY "Lawyer can read all own Q&A" ON public.lawyer_qa_threads
  FOR SELECT TO authenticated USING (
    lawyer_id IN (SELECT id FROM public.lawyers WHERE user_id = auth.uid())
    OR asked_by_user_id = auth.uid()
  );

CREATE POLICY "Authenticated can ask questions" ON public.lawyer_qa_threads
  FOR INSERT TO authenticated WITH CHECK (asked_by_user_id = auth.uid());

CREATE POLICY "Lawyer can answer own Q&A" ON public.lawyer_qa_threads
  FOR UPDATE TO authenticated USING (
    lawyer_id IN (SELECT id FROM public.lawyers WHERE user_id = auth.uid())
  );

-- =============================================================
-- 7. saved_lawyers
-- =============================================================
CREATE TABLE IF NOT EXISTS public.saved_lawyers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lawyer_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, lawyer_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_lawyers TO authenticated;
GRANT ALL ON public.saved_lawyers TO service_role;

ALTER TABLE public.saved_lawyers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User manages own saved lawyers" ON public.saved_lawyers
  FOR ALL TO authenticated USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
