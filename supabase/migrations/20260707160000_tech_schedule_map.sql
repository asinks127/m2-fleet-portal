-- Tech Schedule Parser & Service Map
-- Tables + RLS. Storage bucket created separately via the Storage API.
-- This repo uses Supabase (not Firebase); the spec's Firestore structure maps
-- to tech_schedule_uploads (the upload doc) + tech_schedule_rows (the rows
-- subcollection), with upload_id FK + ON DELETE CASCADE.

-- 1) Uploads ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tech_schedule_uploads (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_file_name text NOT NULL,
  storage_path  text,
  uploaded_by   text,
  uploaded_at   timestamptz NOT NULL DEFAULT now(),
  status        text NOT NULL DEFAULT 'uploaded'
                CHECK (status IN ('uploaded','parsing','parsed','failed')),
  error_message text,
  source_report_title text,
  generated_at  text,
  summary       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 2) Parsed rows -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tech_schedule_rows (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id          uuid NOT NULL REFERENCES public.tech_schedule_uploads(id) ON DELETE CASCADE,
  tech_schedule_name text,
  asset_number       text,
  service_status     text,
  start_time         timestamptz,
  end_time           timestamptz,
  duration_minutes   integer,
  delay_type         text,
  latitude           double precision,
  longitude          double precision,
  row_type           text NOT NULL DEFAULT 'unknown'
                     CHECK (row_type IN ('service','delay','unknown')),
  has_map_location   boolean NOT NULL DEFAULT false,
  data_issues        jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tsr_upload_id ON public.tech_schedule_rows(upload_id);
CREATE INDEX IF NOT EXISTS idx_tsr_tech      ON public.tech_schedule_rows(tech_schedule_name);
CREATE INDEX IF NOT EXISTS idx_tsr_status    ON public.tech_schedule_rows(service_status);
CREATE INDEX IF NOT EXISTS idx_tsr_map       ON public.tech_schedule_rows(has_map_location);

-- 3) RLS — admin/authenticated only; anon denied ---------------------------
ALTER TABLE public.tech_schedule_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_schedule_rows    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ts_uploads_auth_all"    ON public.tech_schedule_uploads;
DROP POLICY IF EXISTS "ts_uploads_anon_none"   ON public.tech_schedule_uploads;
DROP POLICY IF EXISTS "ts_rows_auth_all"       ON public.tech_schedule_rows;
DROP POLICY IF EXISTS "ts_rows_anon_none"      ON public.tech_schedule_rows;

CREATE POLICY "ts_uploads_auth_all"  ON public.tech_schedule_uploads
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ts_uploads_anon_none" ON public.tech_schedule_uploads
  FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "ts_rows_auth_all"     ON public.tech_schedule_rows
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ts_rows_anon_none"    ON public.tech_schedule_rows
  FOR ALL TO anon USING (false) WITH CHECK (false);
