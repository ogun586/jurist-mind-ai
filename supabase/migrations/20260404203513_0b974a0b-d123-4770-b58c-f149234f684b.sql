
-- 1. Create countries table
CREATE TABLE IF NOT EXISTS countries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  code text UNIQUE NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_countries" ON countries FOR SELECT USING (true);

-- 2. Add role column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'user';

-- 3. Add columns to jobs for country support
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS country_id uuid REFERENCES countries(id) ON DELETE CASCADE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_remote boolean DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- 4. Add case law columns to cases
ALTER TABLE cases ADD COLUMN IF NOT EXISTS country_id uuid REFERENCES countries(id) ON DELETE CASCADE;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS summary text;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS court_name text;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS date_decided date;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS citation text;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS full_text text;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS case_tags text[] DEFAULT '{}';
ALTER TABLE cases ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT false;

-- 5. Add columns to lawyers
ALTER TABLE lawyers ADD COLUMN IF NOT EXISTS country_id_ref uuid REFERENCES countries(id) ON DELETE CASCADE;
ALTER TABLE lawyers ADD COLUMN IF NOT EXISTS hourly_rate numeric;
ALTER TABLE lawyers ADD COLUMN IF NOT EXISTS is_available boolean DEFAULT true;

-- 6. Create lawyer_contact_requests table
CREATE TABLE IF NOT EXISTS lawyer_contact_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id uuid REFERENCES lawyers(id) ON DELETE CASCADE NOT NULL,
  requester_id uuid NOT NULL,
  message text NOT NULL,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  UNIQUE(lawyer_id, requester_id)
);
ALTER TABLE lawyer_contact_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insert_contact_request" ON lawyer_contact_requests FOR INSERT WITH CHECK (requester_id = auth.uid());
CREATE POLICY "read_own_contact_requests" ON lawyer_contact_requests FOR SELECT USING (
  requester_id = auth.uid() OR
  EXISTS (SELECT 1 FROM lawyers WHERE lawyers.id = lawyer_contact_requests.lawyer_id AND lawyers.user_id = auth.uid())
);
CREATE POLICY "lawyer_update_contact_request" ON lawyer_contact_requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM lawyers WHERE lawyers.id = lawyer_contact_requests.lawyer_id AND lawyers.user_id = auth.uid())
);

-- 7. Additional RLS for cases (published cases public, admin management)
CREATE POLICY "read_published_cases_public" ON cases FOR SELECT USING (is_published = true);
CREATE POLICY "admin_manage_cases_insert" ON cases FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
);
CREATE POLICY "admin_manage_cases_update" ON cases FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
);
CREATE POLICY "admin_read_all_cases" ON cases FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- 8. Admin RLS for lawyers
CREATE POLICY "admin_read_all_lawyers_v2" ON lawyers FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
);
CREATE POLICY "admin_update_any_lawyer_v2" ON lawyers FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- 9. Unique constraint on job_applications
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_applications_unique_per_user') THEN
    ALTER TABLE job_applications ADD CONSTRAINT job_applications_unique_per_user UNIQUE(job_id, applicant_id);
  END IF;
END $$;
