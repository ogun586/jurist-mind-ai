
-- Add country_id and is_published to judge_notes
ALTER TABLE public.judge_notes ADD COLUMN IF NOT EXISTS country_id uuid REFERENCES public.countries(id);
ALTER TABLE public.judge_notes ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT false;

-- Admin insert policy
CREATE POLICY "admin_insert_judge_notes" ON public.judge_notes
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Admin update policy
CREATE POLICY "admin_update_judge_notes" ON public.judge_notes
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Admin read all policy
CREATE POLICY "admin_read_all_judge_notes" ON public.judge_notes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Public read published notes
CREATE POLICY "read_published_judge_notes" ON public.judge_notes
  FOR SELECT USING (is_published = true);

-- Admin delete policy
CREATE POLICY "admin_delete_judge_notes" ON public.judge_notes
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );
