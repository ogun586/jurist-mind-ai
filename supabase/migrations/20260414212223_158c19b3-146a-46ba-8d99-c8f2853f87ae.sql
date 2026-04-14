
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_code TEXT;
  v_name TEXT;
  v_prefix TEXT;
  v_suffix TEXT;
  v_attempts INT := 0;
BEGIN
  v_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'full_name',
    'USER'
  );
  
  -- Generate unique referral code
  LOOP
    v_prefix := UPPER(LEFT(REGEXP_REPLACE(v_name, '[^a-zA-Z]', '', 'g'), 4));
    IF LENGTH(v_prefix) < 4 THEN
      v_prefix := RPAD(v_prefix, 4, 'X');
    END IF;
    v_suffix := UPPER(SUBSTR(MD5(RANDOM()::text), 1, 4));
    v_code := v_prefix || '-' || v_suffix;
    
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = v_code);
    v_attempts := v_attempts + 1;
    EXIT WHEN v_attempts > 10;
  END LOOP;

  INSERT INTO public.profiles (
    id, user_id, email, full_name, display_name, phone, user_type,
    onboarding_completed, referral_code, created_at
  )
  VALUES (
    NEW.id, NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'user_type', ''),
    FALSE,
    v_code,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    referral_code = EXCLUDED.referral_code
  WHERE profiles.referral_code IS NULL;

  INSERT INTO public.subscriptions (user_id, plan, status, started_at, expires_at)
  VALUES (NEW.id, 'free', 'active', now(), now() + interval '3 days')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;
