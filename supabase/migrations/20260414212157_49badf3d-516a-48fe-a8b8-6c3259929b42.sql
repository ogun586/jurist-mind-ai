
-- Generate referral codes for all existing users without one
UPDATE public.profiles
SET referral_code = 
  UPPER(LEFT(REGEXP_REPLACE(COALESCE(full_name, display_name, 'USER'), '[^a-zA-Z]', '', 'g'), 4)) 
  || '-' 
  || UPPER(SUBSTR(MD5(RANDOM()::text), 1, 4))
WHERE referral_code IS NULL;

-- Ensure uniqueness constraint exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_referral_code_key'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_referral_code_key UNIQUE (referral_code);
  END IF;
END $$;
