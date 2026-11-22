-- ===========================================================================
-- M2 Fleet — VeloSurvey write policies for admin dashboard
-- Fixes: "Queue Survey" button doing nothing because RLS blocks INSERT/UPDATE/DELETE
-- Date: 2026-07-15
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/rrvvklsknrjzzfdhrrfo/sql/new
-- ===========================================================================

-- 1. Allow authenticated users to INSERT surveys
DROP POLICY IF EXISTS "velo_survey_insert" ON public."VeloSurvey";
CREATE POLICY "velo_survey_insert" ON public."VeloSurvey"
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 2. Allow authenticated users to UPDATE surveys
DROP POLICY IF EXISTS "velo_survey_update" ON public."VeloSurvey";
CREATE POLICY "velo_survey_update" ON public."VeloSurvey"
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- 3. Allow authenticated users to DELETE surveys (admin only — already gated by UI)
DROP POLICY IF EXISTS "velo_survey_delete" ON public."VeloSurvey";
CREATE POLICY "velo_survey_delete" ON public."VeloSurvey"
  FOR DELETE TO authenticated
  USING (true);

-- 4. Same for VeloSurveyResponse
DROP POLICY IF EXISTS "velo_survey_response_insert" ON public."VeloSurveyResponse";
CREATE POLICY "velo_survey_response_insert" ON public."VeloSurveyResponse"
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "velo_survey_response_update" ON public."VeloSurveyResponse";
CREATE POLICY "velo_survey_response_update" ON public."VeloSurveyResponse"
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "velo_survey_response_delete" ON public."VeloSurveyResponse";
CREATE POLICY "velo_survey_response_delete" ON public."VeloSurveyResponse"
  FOR DELETE TO authenticated
  USING (true);

-- 5. Fix AppLog INSERT for navigation tracking
DROP POLICY IF EXISTS "applog_insert" ON public."AppLog";
CREATE POLICY "applog_insert" ON public."AppLog"
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);
