
-- Add new columns to profiles table (safe with IF NOT EXISTS)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS school_country TEXT,
ADD COLUMN IF NOT EXISTS school_name TEXT,
ADD COLUMN IF NOT EXISTS law_firm TEXT,
ADD COLUMN IF NOT EXISTS location_in_country TEXT,
ADD COLUMN IF NOT EXISTS occupation TEXT,
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Ensure phone column is TEXT (already is, but safe to reaffirm)
ALTER TABLE profiles ALTER COLUMN phone TYPE TEXT;

-- Create/replace the auth trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    user_id,
    email,
    full_name,
    display_name,
    phone,
    user_type,
    onboarding_completed,
    created_at
  )
  VALUES (
    NEW.id,
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'user_type', ''),
    FALSE,
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.subscriptions (user_id, plan, status, started_at, expires_at)
  VALUES (
    NEW.id,
    'free',
    'active',
    now(),
    now() + interval '3 days'
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
