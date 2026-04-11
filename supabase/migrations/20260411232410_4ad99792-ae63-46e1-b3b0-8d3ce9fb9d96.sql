
-- 1.1 Add referral columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.profiles(user_id),
  ADD COLUMN IF NOT EXISTS referral_earnings_pending numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_earnings_cleared numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_earnings_total numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_withdrawal_at timestamptz;

-- 1.2 Create referral_clicks table
CREATE TABLE IF NOT EXISTS public.referral_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code text NOT NULL,
  referrer_id uuid REFERENCES public.profiles(user_id),
  clicked_at timestamptz DEFAULT now(),
  ip_address text,
  user_agent text,
  platform text DEFAULT 'unknown',
  converted boolean DEFAULT false
);

ALTER TABLE public.referral_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_insert_clicks" ON public.referral_clicks
  FOR INSERT WITH CHECK (true);

CREATE POLICY "referrer_read_own_clicks" ON public.referral_clicks
  FOR SELECT USING (referrer_id = auth.uid());

-- 1.3 Create referrals table
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid REFERENCES public.profiles(user_id) NOT NULL,
  referred_id uuid REFERENCES public.profiles(user_id) NOT NULL UNIQUE,
  referral_code text NOT NULL,
  status text DEFAULT 'signed_up',
  months_commissioned integer DEFAULT 0,
  total_commission_earned numeric DEFAULT 0,
  first_click_at timestamptz,
  signed_up_at timestamptz DEFAULT now(),
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referrer_read_own" ON public.referrals
  FOR SELECT USING (referrer_id = auth.uid());

CREATE POLICY "admin_read_all_referrals" ON public.referrals
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- 1.4 Create referral_commissions table
CREATE TABLE IF NOT EXISTS public.referral_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid REFERENCES public.profiles(user_id) NOT NULL,
  referred_id uuid REFERENCES public.profiles(user_id) NOT NULL,
  referral_id uuid REFERENCES public.referrals(id) NOT NULL,
  payment_id uuid REFERENCES public.payments(id),
  amount_paid numeric NOT NULL,
  commission_rate numeric DEFAULT 0.10,
  commission_amount numeric NOT NULL,
  status text DEFAULT 'pending',
  month_number integer NOT NULL,
  clears_at timestamptz NOT NULL,
  cleared_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.referral_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referrer_read_own_commissions" ON public.referral_commissions
  FOR SELECT USING (referrer_id = auth.uid());

CREATE POLICY "admin_read_all_commissions" ON public.referral_commissions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- 1.5 Create withdrawal_requests table
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(user_id) NOT NULL,
  amount numeric NOT NULL,
  status text DEFAULT 'pending_review',
  bank_account_name text NOT NULL,
  bank_account_number text NOT NULL,
  bank_name text NOT NULL,
  paystack_transfer_code text,
  paystack_transfer_reference text,
  admin_note text,
  reviewed_by uuid REFERENCES public.profiles(user_id),
  reviewed_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_insert_withdrawal" ON public.withdrawal_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_read_own_status" ON public.withdrawal_requests
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "admin_full_access_withdrawals" ON public.withdrawal_requests
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );
