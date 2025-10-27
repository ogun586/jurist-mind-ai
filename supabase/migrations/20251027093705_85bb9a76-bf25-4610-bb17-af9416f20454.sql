-- Create plans table with normalized plan data
CREATE TABLE IF NOT EXISTS public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  daily_request_limit integer, -- null = unlimited
  monthly_points integer, -- for Student Monthly
  duration_days integer NOT NULL,
  price_ngn numeric NOT NULL,
  features jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on plans
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- Everyone can view plans (for upgrade page)
CREATE POLICY "Everyone can view plans"
  ON public.plans FOR SELECT
  USING (true);

-- Seed plans data
INSERT INTO public.plans (plan_key, name, description, daily_request_limit, monthly_points, duration_days, price_ngn, features) VALUES
  ('free', 'Free Plan', 'For new and casual users', 3, null, 7, 0, 
   '["3 AI requests per day", "7-day trial", "Basic legal research", "Access to judge notes"]'::jsonb),
  ('student_monthly', 'Student Monthly', 'Budget-friendly for students', null, 100, 30, 15000,
   '["100 points per month", "1 point = 1 request", "Full legal research", "Document templates", "Priority support"]'::jsonb),
  ('monthly', 'Monthly Plan', 'For professionals', null, null, 30, 24000,
   '["Unlimited requests", "Full legal research", "Document drafting", "Case management", "Priority support", "API access"]'::jsonb),
  ('yearly', 'Yearly Plan', 'For heavy users - Best Value!', null, null, 365, 250000,
   '["Unlimited requests", "Full legal research", "Document drafting", "Case management", "Priority support", "API access", "20% savings"]'::jsonb),
  ('enterprise', 'Enterprise', 'For teams and firms', 1000, null, 30, 500000,
   '["Shared 1000 requests/day", "Unlimited members", "Admin dashboard", "Custom integrations", "Dedicated support", "Training sessions"]'::jsonb)
ON CONFLICT (plan_key) DO NOTHING;

-- Add plan_key column to profiles (links to plans table)
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS plan_key text DEFAULT 'free' REFERENCES public.plans(plan_key);

-- Add plan expiry tracking to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_expires_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS plan_started_at timestamp with time zone;

-- Create index for faster plan lookups
CREATE INDEX IF NOT EXISTS idx_profiles_plan_key ON public.profiles(plan_key);
CREATE INDEX IF NOT EXISTS idx_profiles_plan_expires ON public.profiles(plan_expires_at);

-- Update existing users to have free plan with 7-day expiry
UPDATE public.profiles
SET 
  plan_key = 'free',
  plan_started_at = now(),
  plan_expires_at = now() + interval '7 days'
WHERE plan_key IS NULL;

-- Create usage tracking table for plan-based limits
CREATE TABLE IF NOT EXISTS public.user_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  requests_count integer DEFAULT 0,
  points_used integer DEFAULT 0, -- for Student Monthly
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, usage_date)
);

-- Enable RLS on user_usage
ALTER TABLE public.user_usage ENABLE ROW LEVEL SECURITY;

-- Users can view their own usage
CREATE POLICY "Users can view their own usage"
  ON public.user_usage FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own usage (via function)
CREATE POLICY "Users can manage their own usage"
  ON public.user_usage FOR ALL
  USING (auth.uid() = user_id);

-- Create index for faster usage lookups
CREATE INDEX IF NOT EXISTS idx_user_usage_date ON public.user_usage(user_id, usage_date);

-- Function to get user's current plan with details
CREATE OR REPLACE FUNCTION public.get_user_plan(p_user_id uuid DEFAULT auth.uid())
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t)
  FROM (
    SELECT 
      pl.plan_key,
      pl.name,
      pl.description,
      pl.daily_request_limit,
      pl.monthly_points,
      pl.duration_days,
      pl.price_ngn,
      pl.features,
      pr.plan_started_at,
      pr.plan_expires_at,
      (pr.plan_expires_at > now()) as is_active,
      EXTRACT(DAY FROM (pr.plan_expires_at - now())) as days_remaining
    FROM public.profiles pr
    JOIN public.plans pl ON pl.plan_key = pr.plan_key
    WHERE pr.user_id = p_user_id
  ) t;
$$;

-- Function to check if user can make request (enforces limits)
CREATE OR REPLACE FUNCTION public.can_user_make_request(p_user_id uuid DEFAULT auth.uid())
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan json;
  v_usage record;
  v_can_proceed boolean := false;
  v_reason text := '';
  v_requests_remaining integer := 0;
  v_points_remaining integer := 0;
BEGIN
  -- Get user's plan
  v_plan := public.get_user_plan(p_user_id);
  
  -- Check if plan is active
  IF (v_plan->>'is_active')::boolean = false THEN
    RETURN json_build_object(
      'allowed', false,
      'reason', 'Plan expired. Please upgrade to continue.',
      'plan_key', v_plan->>'plan_key'
    );
  END IF;
  
  -- Get today's usage
  SELECT * INTO v_usage
  FROM public.user_usage
  WHERE user_id = p_user_id AND usage_date = CURRENT_DATE;
  
  -- If no usage record, create one
  IF v_usage IS NULL THEN
    INSERT INTO public.user_usage (user_id, usage_date, requests_count, points_used)
    VALUES (p_user_id, CURRENT_DATE, 0, 0)
    RETURNING * INTO v_usage;
  END IF;
  
  -- Check limits based on plan type
  CASE v_plan->>'plan_key'
    WHEN 'free' THEN
      -- Free: 3 requests per day
      IF v_usage.requests_count < (v_plan->>'daily_request_limit')::integer THEN
        v_can_proceed := true;
        v_requests_remaining := (v_plan->>'daily_request_limit')::integer - v_usage.requests_count;
      ELSE
        v_reason := 'Daily limit reached. Upgrade for unlimited access!';
      END IF;
      
    WHEN 'student_monthly' THEN
      -- Student: 100 points per month (check monthly total)
      SELECT COALESCE(SUM(points_used), 0) INTO v_points_remaining
      FROM public.user_usage
      WHERE user_id = p_user_id 
        AND usage_date >= date_trunc('month', CURRENT_DATE);
      
      IF v_points_remaining < (v_plan->>'monthly_points')::integer THEN
        v_can_proceed := true;
        v_points_remaining := (v_plan->>'monthly_points')::integer - v_points_remaining;
      ELSE
        v_reason := 'Monthly points exhausted. Renew or upgrade!';
      END IF;
      
    WHEN 'monthly', 'yearly' THEN
      -- Unlimited for these plans
      v_can_proceed := true;
      v_requests_remaining := -1; -- -1 indicates unlimited
      
    WHEN 'enterprise' THEN
      -- Enterprise: 1000 requests per day (shared across team)
      -- For now, treat as unlimited per user (team logic needs separate implementation)
      IF v_usage.requests_count < 1000 THEN
        v_can_proceed := true;
        v_requests_remaining := 1000 - v_usage.requests_count;
      ELSE
        v_reason := 'Daily team limit reached. Contact support.';
      END IF;
  END CASE;
  
  RETURN json_build_object(
    'allowed', v_can_proceed,
    'reason', v_reason,
    'plan_key', v_plan->>'plan_key',
    'plan_name', v_plan->>'name',
    'requests_remaining', v_requests_remaining,
    'points_remaining', v_points_remaining,
    'days_remaining', (v_plan->>'days_remaining')::numeric
  );
END;
$$;

-- Function to increment usage after successful request
CREATE OR REPLACE FUNCTION public.increment_user_usage(p_user_id uuid DEFAULT auth.uid(), p_points integer DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_usage (user_id, usage_date, requests_count, points_used)
  VALUES (p_user_id, CURRENT_DATE, 1, p_points)
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET
    requests_count = user_usage.requests_count + 1,
    points_used = user_usage.points_used + p_points,
    updated_at = now();
END;
$$;

-- Function to upgrade user plan (used by Paystack webhook)
CREATE OR REPLACE FUNCTION public.upgrade_user_plan(
  p_user_id uuid,
  p_plan_key text,
  p_payment_reference text DEFAULT null
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan record;
  v_new_expiry timestamp with time zone;
BEGIN
  -- Get plan details
  SELECT * INTO v_plan FROM public.plans WHERE plan_key = p_plan_key;
  
  IF v_plan IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid plan key');
  END IF;
  
  -- Calculate new expiry
  v_new_expiry := now() + (v_plan.duration_days || ' days')::interval;
  
  -- Update profile
  UPDATE public.profiles
  SET 
    plan_key = p_plan_key,
    plan_started_at = now(),
    plan_expires_at = v_new_expiry,
    updated_at = now()
  WHERE user_id = p_user_id;
  
  -- Create subscription record (for history)
  INSERT INTO public.subscriptions (user_id, plan, status, started_at, expires_at, amount, paystack_reference)
  VALUES (
    p_user_id,
    v_plan.name,
    'active',
    now(),
    v_new_expiry,
    v_plan.price_ngn,
    p_payment_reference
  );
  
  -- Reset usage for new plan
  DELETE FROM public.user_usage WHERE user_id = p_user_id AND usage_date = CURRENT_DATE;
  
  RETURN json_build_object(
    'success', true,
    'plan_key', p_plan_key,
    'plan_name', v_plan.name,
    'expires_at', v_new_expiry
  );
END;
$$;

-- Trigger to update updated_at on plans
CREATE OR REPLACE FUNCTION public.update_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_plans_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_plans_updated_at();

-- Trigger to update updated_at on user_usage
CREATE TRIGGER update_user_usage_updated_at
  BEFORE UPDATE ON public.user_usage
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();