-- ===========================================================================
-- M2 Fleet — Velo Survey workflow upgrade
-- Idempotent: safe to re-run. Created 2026-07-06.
-- Adds: outside-PM directory, public submission/get RPCs, survey link + type,
-- and locked-down RLS so only the service role can write, anon can only call
-- the public RPCs (SECURITY DEFINER).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) Outside Project Manager directory
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.velo_project_managers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  company text,
  notes text,
  created_at timestamptz not null default now()
);

ALTER TABLE public.velo_project_managers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "velo_pm_block_all" ON public.velo_project_managers;
CREATE POLICY "velo_pm_block_all" ON public.velo_project_managers
  FOR ALL USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- 2) VeloSurvey: extra columns for the new workflow
-- ---------------------------------------------------------------------------
ALTER TABLE public."VeloSurvey" ADD COLUMN IF NOT EXISTS "driveFileUrl" text;
ALTER TABLE public."VeloSurvey" ADD COLUMN IF NOT EXISTS "autoTriggered" boolean not null default false;
ALTER TABLE public."VeloSurvey" ADD COLUMN IF NOT EXISTS "surveyType" text not null default 'manual';
ALTER TABLE public."VeloSurvey" ADD COLUMN IF NOT EXISTS "surveyLink" text;

-- Backfill any NULL/blank status to 'sent' so legacy rows render sanely
UPDATE public."VeloSurvey" SET status = 'sent' WHERE status IS NULL OR status = '';

-- ---------------------------------------------------------------------------
-- 3) Public submission RPC (SECURITY DEFINER) — callable by anon key from the
--    public survey page. Validates the survey token, inserts each response with
--    a calculatedScore (avg of the 7 ratings, 1-5 scale), marks the survey
--    completed. No service-role secret ever reaches the browser.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_velo_survey(p_token text, p_responses jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_survey record;
  v_resp   jsonb;
  v_count  int := 0;
BEGIN
  SELECT * INTO v_survey
  FROM "VeloSurvey"
  WHERE "surveyToken" = p_token
    AND (status IS NULL OR status NOT IN ('completed','Completed'))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired survey token');
  END IF;

  IF jsonb_typeof(p_responses) IS DISTINCT FROM 'array' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Responses must be an array');
  END IF;

  FOR v_resp IN SELECT * FROM jsonb_array_elements(p_responses) LOOP
    BEGIN
      INSERT INTO "VeloSurveyResponse" (
        "surveyId", "technicianId", "technicianName",
        "communicationSkills", "availability", "installQuality",
        "reliability", "problemSolving", "safetyCompliance",
        "overallPerformance", "additionalNotes", "calculatedScore",
        "submittedDate"
      ) VALUES (
        v_survey.id,
        v_resp->>'technicianId',
        v_resp->>'technicianName',
        NULLIF(v_resp->>'communicationSkills','')::int,
        NULLIF(v_resp->>'availability','')::int,
        NULLIF(v_resp->>'installQuality','')::int,
        NULLIF(v_resp->>'reliability','')::int,
        NULLIF(v_resp->>'problemSolving','')::int,
        NULLIF(v_resp->>'safetyCompliance','')::int,
        NULLIF(v_resp->>'overallPerformance','')::int,
        v_resp->>'additionalNotes',
        ROUND((
          COALESCE(NULLIF(v_resp->>'communicationSkills','')::float,0)
        + COALESCE(NULLIF(v_resp->>'availability','')::float,0)
        + COALESCE(NULLIF(v_resp->>'installQuality','')::float,0)
        + COALESCE(NULLIF(v_resp->>'reliability','')::float,0)
        + COALESCE(NULLIF(v_resp->>'problemSolving','')::float,0)
        + COALESCE(NULLIF(v_resp->>'safetyCompliance','')::float,0)
        + COALESCE(NULLIF(v_resp->>'overallPerformance','')::float,0)
        ) / 7.0, 2),
        now()
      );
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipped response: %', SQLERRM;
    END;
  END LOOP;

  IF v_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No valid responses were saved');
  END IF;

  UPDATE "VeloSurvey"
  SET status = 'completed'
  WHERE id = v_survey.id;

  RETURN jsonb_build_object('success', true, 'responsesCount', v_count);
END;
$$;

-- Revoke all direct table access from anon/authenticated on the response table
-- so writes only happen through the SECURITY DEFINER RPC.
REVOKE ALL ON public."VeloSurveyResponse" FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) Public "get survey" RPC (SECURITY DEFINER) — returns a survey + the
--    resolved technician names for a given token, callable by anon from the
--    public survey page. Handles technicianIds stored as jsonb array or text.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_velo_survey_for_public(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_survey jsonb;
  v_ids    text[];
BEGIN
  SELECT to_jsonb(s) INTO v_survey
  FROM "VeloSurvey" s
  WHERE s."surveyToken" = p_token
    AND (s.status IS NULL OR s.status NOT IN ('completed','Completed'))
  LIMIT 1;

  IF v_survey IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired survey token');
  END IF;

  BEGIN
    v_ids := ARRAY(SELECT jsonb_array_elements_text(v_survey->'technicianIds'));
  EXCEPTION WHEN OTHERS THEN
    v_ids := ARRAY(SELECT regexp_split_to_array((v_survey->>'technicianIds'), ','));
  END;

  SELECT jsonb_build_object(
    'success', true,
    'survey', v_survey,
    'technicians', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', u.id, 'name', COALESCE(u.full_name, u.display_name, u.email)))
      FROM "User" u
      WHERE u.id::text = ANY(v_ids)
    ), '[]'::jsonb)
  ) INTO v_survey;

  RETURN v_survey;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_velo_survey(text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_velo_survey_for_public(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5) Ensure VeloSurvey / VeloSurveyResponse stay locked down (service-role only)
-- ---------------------------------------------------------------------------
ALTER TABLE public."VeloSurvey" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."VeloSurveyResponse" ENABLE ROW LEVEL SECURITY;
