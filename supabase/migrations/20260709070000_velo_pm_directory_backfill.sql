-- ===========================================================================
-- Backfill velo_project_managers from existing VeloSurvey rows
-- Distinct PMs found in surveys:
--   1. Dallas Byerly  -> dallas.byerly@velociti.com   (4 rows; most recent)
--                       austin@m2fleetcom.com          (6 rows; legacy)
--                       Dallas.byerly@velciti.com       (1 row; typo)
--                       omcvay@gmail.com               (1 row; misattributed)
--   2. Orville McVay  -> omcvay@gmail.com             (4 rows; correct)
--   3. Rob Hyberger   -> Rob.Hyberger@velociti.com     (1 row; correct)
-- ===========================================================================

INSERT INTO public.velo_project_managers (name, email, company, notes)
VALUES
  ('Dallas Byerly', 'dallas.byerly@velociti.com', 'Velciti',
   'Outside Project Manager. Primary contact: dallas.byerly@velociti.com (replaces earlier austin@m2fleetcom.com / Dallas.byerly@velciti.com / omcvay@gmail.com variants).'),
  ('Orville McVay', 'omcvay@gmail.com', NULL, 'Outside Project Manager.'),
  ('Rob Hyberger', 'Rob.Hyberger@velociti.com', 'Velciti', 'Outside Project Manager.')
ON CONFLICT (email) DO UPDATE
  SET name    = EXCLUDED.name,
      company = EXCLUDED.company,
      notes   = COALESCE(EXCLUDED.notes, velo_project_managers.notes);
