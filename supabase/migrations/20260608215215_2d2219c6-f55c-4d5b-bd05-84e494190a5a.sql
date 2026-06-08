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
    ALTER TABLE public.lawyers ALTER COLUMN is_verified DROP EXPRESSION;
  END IF;
END $$;

ALTER TABLE public.lawyers
  ALTER COLUMN is_verified SET DEFAULT false;

UPDATE public.lawyers
SET is_verified = (verification_status = 'verified')
WHERE is_verified IS DISTINCT FROM (verification_status = 'verified');

CREATE OR REPLACE FUNCTION public.sync_lawyer_verification_flags()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.is_verified := COALESCE(NEW.verification_status = 'verified', false);
  NEW.verified := COALESCE(NEW.verified, NEW.is_verified, false);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_lawyer_verification_flags_on_write ON public.lawyers;

CREATE TRIGGER sync_lawyer_verification_flags_on_write
BEFORE INSERT OR UPDATE OF verification_status, is_verified, verified
ON public.lawyers
FOR EACH ROW
EXECUTE FUNCTION public.sync_lawyer_verification_flags();