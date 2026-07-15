-- ===========================================================================
-- M2 Fleet Electronic Signature System — Supabase schema + RLS
-- Option B: built on Supabase (the app's existing backbone).
-- Idempotent: safe to re-run.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) Templates
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.esign_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  description   text,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived','deleted')),
  pdf_storage_path text,       -- Supabase Storage path to the source PDF
  pdf_file_name text,
  page_count    integer NOT NULL DEFAULT 1,
  page_width    numeric,       -- pt
  page_height   numeric,       -- pt
  created_by    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  version       integer NOT NULL DEFAULT 1
);

-- ---------------------------------------------------------------------------
-- 2) Template fields (positioned on pages)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.esign_template_fields (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   uuid NOT NULL REFERENCES public.esign_templates(id) ON DELETE CASCADE,
  field_key     text,           -- stable key for referencing in field_values
  type          text NOT NULL CHECK (type IN (
    'signature','initials','date','signed_date','text','textarea',
    'checkbox','radio','dropdown','full_name','printed_name','email',
    'company','title','address','phone','contractor_id','custom_text',
    'attachment','acknowledgment'
  )),
  page          integer NOT NULL DEFAULT 1,
  x             numeric NOT NULL DEFAULT 50,   -- pt from left
  y             numeric NOT NULL DEFAULT 50,   -- pt from bottom
  width         numeric NOT NULL DEFAULT 200,
  height        numeric NOT NULL DEFAULT 40,
  recipient_role text NOT NULL DEFAULT 'contractor', -- contractor, m2_rep, customer, witness, approver, external, signer
  label         text,
  instructions  text,
  required      boolean NOT NULL DEFAULT false,
  font_size     integer DEFAULT 12,
  default_value text,
  validation    jsonb,           -- { rule: 'email'|'phone'|'date'|'number'|'regex', pattern: '...' }
  options       jsonb,           -- for dropdown/radio: ["opt1","opt2"]
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_estf_template ON public.esign_template_fields(template_id);

-- ---------------------------------------------------------------------------
-- 3) Template versions (snapshots for restore)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.esign_template_versions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   uuid NOT NULL REFERENCES public.esign_templates(id) ON DELETE CASCADE,
  version       integer NOT NULL,
  snapshot      jsonb NOT NULL,  -- full template + fields snapshot
  created_by    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_estv_template ON public.esign_template_versions(template_id, version DESC);

-- ---------------------------------------------------------------------------
-- 4) Documents (envelope — a sent or draft instance of a template)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.esign_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  template_id     uuid REFERENCES public.esign_templates(id) ON DELETE SET NULL,
  template_name   text,                  -- denormalized for history
  contractor_id   text,                  -- links to User.id if internal contractor
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','preparing','sent','delivered','delivery_failed','viewed',
    'partially_signed','waiting_for_another','completed','declined','expired','voided'
  )),
  sent_by         text,
  sent_at         timestamptz,
  expires_at      timestamptz,
  viewed_at       timestamptz,
  completed_at    timestamptz,
  voided_at       timestamptz,
  void_reason     text,
  voided_by       text,
  declined_at     timestamptz,
  declined_by     text,
  decline_reason  text,
  reminder_config jsonb,                 -- { interval_days: 3, enabled: true, next_reminder: ISO }
  email_subject   text,
  email_message   text,
  source_pdf_path text,                  -- copy of template PDF in this doc's storage path
  completed_pdf_path text,               -- finalized signed PDF in Storage
  drive_file_id   text,                  -- Google Drive file ID of completed PDF
  drive_folder_id text,                  -- Google Drive folder ID
  drive_saved_at  timestamptz,
  drive_error     text,
  completion_id   text,                  -- unique completion certificate ID
  project         text,
  m2_pm           text,
  signing_order   text NOT NULL DEFAULT 'parallel', -- 'parallel' | 'sequential'
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_esd_contractor ON public.esign_documents(contractor_id);
CREATE INDEX IF NOT EXISTS idx_esd_status     ON public.esign_documents(status);
CREATE INDEX IF NOT EXISTS idx_esd_sent_by    ON public.esign_documents(sent_by);
CREATE INDEX IF NOT EXISTS idx_esd_sent_at    ON public.esign_documents(sent_at DESC);

-- ---------------------------------------------------------------------------
-- 5) Recipients (signers / approvers / cc)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.esign_recipients (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     uuid NOT NULL REFERENCES public.esign_documents(id) ON DELETE CASCADE,
  name            text NOT NULL,
  email           text NOT NULL,
  role            text NOT NULL DEFAULT 'contractor',
  order_index     integer NOT NULL DEFAULT 1,
  phone           text,
  company         text,
  is_external     boolean NOT NULL DEFAULT false,
  contractor_link_id text,              -- if linked to a User record
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending','sent','delivered','viewed','signed','declined','expired'
  )),
  token_hash      text NOT NULL,        -- SHA-256 of the signing token (never store raw)
  viewed_at       timestamptz,
  signed_at       timestamptz,
  declined_at     timestamptz,
  decline_reason  text,
  auth_code       text,                 -- optional access code for extra security
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_esr_document ON public.esign_recipients(document_id);
CREATE INDEX IF NOT EXISTS idx_esr_email    ON public.esign_recipients(email);
CREATE INDEX IF NOT EXISTS idx_esr_token    ON public.esign_recipients(token_hash);

-- ---------------------------------------------------------------------------
-- 6) Field values (what each recipient filled in)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.esign_field_values (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   uuid NOT NULL REFERENCES public.esign_documents(id) ON DELETE CASCADE,
  recipient_id  uuid REFERENCES public.esign_recipients(id) ON DELETE CASCADE,
  field_id      uuid REFERENCES public.esign_template_fields(id) ON DELETE SET NULL,
  field_key     text,                   -- also stored denormalized in case template is deleted
  type          text,
  page          integer,
  x             numeric, y numeric, width numeric, height numeric,
  value         text,
  signature_image text,                 -- base64 PNG of drawn/typed signature
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_id, recipient_id, field_key)
);
CREATE INDEX IF NOT EXISTS idx_esfv_document ON public.esign_field_values(document_id);

-- ---------------------------------------------------------------------------
-- 7) Audit logs (append-only, never edited/deleted by users)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.esign_audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   uuid NOT NULL REFERENCES public.esign_documents(id) ON DELETE CASCADE,
  event         text NOT NULL,          -- 'created','sent','viewed','signed','declined','voided','completed','resent','reminded','drive_saved','downloaded', etc.
  actor         text,                   -- name or 'system'
  email         text,
  ip_address    text,
  user_agent    text,
  details       jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_esal_document ON public.esign_audit_logs(document_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 8) Settings (singleton — consent text, email templates, defaults)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.esign_settings (
  id            text PRIMARY KEY DEFAULT 'singleton',
  consent_text  text NOT NULL DEFAULT 'I agree that my electronic signature and initials appearing on this document are legally binding equivalents of my handwritten signature and initials. I have reviewed the document and agree to its terms.',
  email_subject_template text NOT NULL DEFAULT 'Document Ready for Signature: {{documentName}}',
  email_body_template    text NOT NULL DEFAULT '<p>Hello {{recipientName}},</p><p>{{senderName}} from M2 Fleet Communications has sent you a document to review and sign: <strong>{{documentName}}</strong>.</p><p>Please click the button below to review and sign the document. This link will expire on {{expirationDate}}.</p><p style="margin:30px 0;text-align:center;"><a href="{{signingLink}}" style="background:#2563eb;color:white;padding:12px 28px;text-decoration:none;border-radius:6px;font-size:16px;">Review &amp; Sign Document</a></p><p>If you have any questions, please contact {{senderName}} at M2 Fleet Communications.</p>',
  default_expiration_days integer NOT NULL DEFAULT 30,
  default_reminder_interval_days integer NOT NULL DEFAULT 3,
  reminder_enabled boolean NOT NULL DEFAULT true,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.esign_settings (id) VALUES ('singleton') ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- RLS — authenticated users can manage templates/documents; anon can only
-- call the SECURITY DEFINER RPCs (defined separately).
-- ---------------------------------------------------------------------------
ALTER TABLE public.esign_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esign_template_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esign_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esign_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esign_field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esign_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esign_settings ENABLE ROW LEVEL SECURITY;

-- Drop old policies if re-running
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'esign_templates','esign_template_fields','esign_template_versions',
    'esign_documents','esign_recipients','esign_field_values',
    'esign_audit_logs','esign_settings'
  ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t || '_auth_all', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t || '_anon_none', t);
  END LOOP;
END $$;

-- Authenticated = full access (admin app is behind Supabase auth)
CREATE POLICY esign_templates_auth_all ON public.esign_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY esign_template_fields_auth_all ON public.esign_template_fields FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY esign_template_versions_auth_all ON public.esign_template_versions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY esign_documents_auth_all ON public.esign_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY esign_recipients_auth_all ON public.esign_recipients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY esign_field_values_auth_all ON public.esign_field_values FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY esign_audit_logs_auth_insert ON public.esign_audit_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY esign_audit_logs_auth_select ON public.esign_audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY esign_settings_auth_all ON public.esign_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Anon = denied on all tables (signing happens via SECURITY DEFINER RPCs)
CREATE POLICY esign_templates_anon_none ON public.esign_templates FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY esign_template_fields_anon_none ON public.esign_template_fields FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY esign_template_versions_anon_none ON public.esign_template_versions FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY esign_documents_anon_none ON public.esign_documents FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY esign_recipients_anon_none ON public.esign_recipients FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY esign_field_values_anon_none ON public.esign_field_values FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY esign_audit_logs_anon_none ON public.esign_audit_logs FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY esign_settings_anon_none ON public.esign_settings FOR ALL TO anon USING (false) WITH CHECK (false);
