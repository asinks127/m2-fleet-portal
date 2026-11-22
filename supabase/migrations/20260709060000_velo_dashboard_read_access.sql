-- ===========================================================================
-- M2 Fleet — Velo dashboard read access for the admin app
-- Fixes: "Failed to load survey data" on /VeloSurveyDashboard.
--
-- Background: the 2026-07-06 velo_survey_upgrade migration locked down
-- VeloSurvey / VeloSurveyResponse / velo_project_managers to service-role only.
-- The admin dashboard runs in the browser and uses the anon key
-- (VITE_SUPABASE_ANON_KEY) for reads, so it started seeing 0 rows immediately
-- after that migration landed.
--
-- Writes are already funneled through SECURITY DEFINER RPCs
-- (submit_velo_survey, sendVeloSurvey) so it's safe to let anon/authenticated
-- read these tables. Idempotent.
-- ===========================================================================

-- VeloSurvey: allow anon + authenticated to read (writes still via service role / RPC)
ALTER TABLE public."VeloSurvey" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "velo_survey_read" ON public."VeloSurvey";
CREATE POLICY "velo_survey_read" ON public."VeloSurvey"
  FOR SELECT TO anon, authenticated USING (true);

-- Restore SELECT for anon/authenticated on the response table (was revoked).
-- Inserts/updates/deletes go through the submit_velo_survey RPC only.
GRANT SELECT ON public."VeloSurveyResponse" TO anon, authenticated;

ALTER TABLE public."VeloSurveyResponse" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "velo_survey_response_read" ON public."VeloSurveyResponse";
CREATE POLICY "velo_survey_response_read" ON public."VeloSurveyResponse"
  FOR SELECT TO anon, authenticated USING (true);

-- velo_project_managers: drop the blanket deny and let the dashboard list PMs.
-- Writes stay service-role only.
ALTER TABLE public.velo_project_managers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "velo_pm_block_all" ON public.velo_project_managers;
DROP POLICY IF EXISTS "velo_pm_read" ON public.velo_project_managers;

CREATE POLICY "velo_pm_read" ON public.velo_project_managers
  FOR SELECT TO anon, authenticated USING (true);

-- Writes still go through the service role key (the Vite app uses anon only
-- for reads; the backend write paths use SUPABASE_SERVICE_ROLE_KEY). Explicitly
-- deny writes from anon/authenticated as a belt-and-suspenders measure.
DROP POLICY IF EXISTS "velo_pm_write_block" ON public.velo_project_managers;
CREATE POLICY "velo_pm_write_block" ON public.velo_project_managers
  FOR INSERT TO anon, authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "velo_pm_update_block" ON public.velo_project_managers;
CREATE POLICY "velo_pm_update_block" ON public.velo_project_managers
  FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "velo_pm_delete_block" ON public.velo_project_managers;
CREATE POLICY "velo_pm_delete_block" ON public.velo_project_managers
  FOR DELETE TO anon, authenticated USING (false);
