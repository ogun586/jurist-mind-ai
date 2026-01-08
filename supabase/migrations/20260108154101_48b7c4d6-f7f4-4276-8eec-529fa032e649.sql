-- Phase 1: Extended Lawyer Profile Schema for Digital Legal Identities

-- Add new columns to lawyers table for extended profile
ALTER TABLE public.lawyers 
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS firm_name TEXT,
ADD COLUMN IF NOT EXISTS firm_logo_url TEXT,
ADD COLUMN IF NOT EXISTS brand_accent_color TEXT DEFAULT '#1e40af',
ADD COLUMN IF NOT EXISTS bio_structured JSONB DEFAULT '{"about": "", "approach": "", "case_studies": []}'::jsonb,
ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS street TEXT,
ADD COLUMN IF NOT EXISTS postal_code TEXT,
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Nigeria',
ADD COLUMN IF NOT EXISTS intro_video_url TEXT,
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'under_review', 'verified', 'rejected')),
ADD COLUMN IF NOT EXISTS verification_notes TEXT,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS verified_by UUID,
ADD COLUMN IF NOT EXISTS profile_views INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS availability_status TEXT DEFAULT 'offline' CHECK (availability_status IN ('online', 'busy', 'offline'));

-- Create index on slug for SEO lookups
CREATE INDEX IF NOT EXISTS idx_lawyers_slug ON public.lawyers(slug);
CREATE INDEX IF NOT EXISTS idx_lawyers_verification_status ON public.lawyers(verification_status);
CREATE INDEX IF NOT EXISTS idx_lawyers_state ON public.lawyers(state);

-- Create lawyer_credentials table for bar license uploads
CREATE TABLE IF NOT EXISTS public.lawyer_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id UUID NOT NULL REFERENCES public.lawyers(id) ON DELETE CASCADE,
  credential_type TEXT NOT NULL CHECK (credential_type IN ('bar_license', 'certificate', 'id_card', 'other')),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on lawyer_credentials
ALTER TABLE public.lawyer_credentials ENABLE ROW LEVEL SECURITY;

-- Credentials policies: Only owner can upload, admins can view all
CREATE POLICY "Lawyers can upload their own credentials"
ON public.lawyer_credentials FOR INSERT
WITH CHECK (
  lawyer_id IN (
    SELECT id FROM public.lawyers WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Lawyers can view their own credentials"
ON public.lawyer_credentials FOR SELECT
USING (
  lawyer_id IN (
    SELECT id FROM public.lawyers WHERE user_id = auth.uid()
  )
  OR auth.uid() = get_admin_uid()
);

CREATE POLICY "Admins can update credentials"
ON public.lawyer_credentials FOR UPDATE
USING (auth.uid() = get_admin_uid());

-- Function to generate SEO-friendly slug
CREATE OR REPLACE FUNCTION public.generate_lawyer_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Generate base slug from name and city
  base_slug := lower(
    regexp_replace(
      regexp_replace(
        COALESCE(NEW.name, '') || '-' || COALESCE(NEW.city, NEW.state, 'ng'),
        '[^a-zA-Z0-9\s-]', '', 'g'
      ),
      '\s+', '-', 'g'
    )
  );
  
  -- Add unique suffix
  final_slug := base_slug || '-' || substring(NEW.id::text, 1, 4);
  
  -- Ensure uniqueness
  WHILE EXISTS (SELECT 1 FROM public.lawyers WHERE slug = final_slug AND id != NEW.id) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || substring(NEW.id::text, 1, 4) || '-' || counter;
  END LOOP;
  
  NEW.slug := final_slug;
  RETURN NEW;
END;
$$;

-- Create trigger to auto-generate slug on insert
DROP TRIGGER IF EXISTS trigger_generate_lawyer_slug ON public.lawyers;
CREATE TRIGGER trigger_generate_lawyer_slug
BEFORE INSERT ON public.lawyers
FOR EACH ROW
WHEN (NEW.slug IS NULL)
EXECUTE FUNCTION public.generate_lawyer_slug();

-- Function to increment profile views
CREATE OR REPLACE FUNCTION public.increment_lawyer_views(lawyer_slug TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.lawyers
  SET profile_views = COALESCE(profile_views, 0) + 1
  WHERE slug = lawyer_slug;
END;
$$;

-- Update RLS policy to allow viewing lawyers by slug (for public profiles)
DROP POLICY IF EXISTS "Everyone can view verified lawyers" ON public.lawyers;
CREATE POLICY "Everyone can view verified lawyers"
ON public.lawyers FOR SELECT
USING (verification_status = 'verified');

-- Allow users to also see their own unverified profile
CREATE POLICY "Users can view their own lawyer profile"
ON public.lawyers FOR SELECT
USING (auth.uid() = user_id);