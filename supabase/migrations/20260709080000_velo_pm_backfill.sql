-- ===========================================================================
-- M2 Fleet — Velo PM Directory backfill from historical VeloSurvey rows
-- Idempotent: safe to re-run.
--
-- Reconstructs the velo_project_managers table from distinct (name, email)
-- pairs found in the VeloSurvey history. Uses ON CONFLICT DO NOTHING so
-- re-running the migration is a no-op for PMs that already exist.
-- ===========================================================================

INSERT INTO public.velo_project_managers (name, email)
SELECT DISTINCT "veloPM" AS name, "veloPMEmail" AS email
FROM public."VeloSurvey"
WHERE "veloPM" IS NOT NULL
  AND "veloPMEmail" IS NOT NULL
  AND "veloPM" <> ''
  AND "veloPMEmail" <> ''
ON CONFLICT (email) DO NOTHING;
