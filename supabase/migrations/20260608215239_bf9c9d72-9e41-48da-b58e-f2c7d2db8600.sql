CREATE OR REPLACE FUNCTION public.sync_lawyer_verification_flags()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.is_verified := COALESCE(NEW.verification_status = 'verified', false);
  NEW.verified := NEW.is_verified;
  RETURN NEW;
END;
$$;

UPDATE public.lawyers
SET
  is_verified = (verification_status = 'verified'),
  verified = (verification_status = 'verified')
WHERE is_verified IS DISTINCT FROM (verification_status = 'verified')
   OR verified IS DISTINCT FROM (verification_status = 'verified');