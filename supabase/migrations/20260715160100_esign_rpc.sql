-- ===========================================================================
-- M2 Fleet eSign — public signing RPCs (SECURITY DEFINER)
-- These let anon recipients (who only have a signing token) load their doc
-- and submit signatures WITHOUT table-level access.
-- ===========================================================================

-- Drop & recreate so re-runs are clean
DROP FUNCTION IF EXISTS public.esign_get_signing_session(text, text);
DROP FUNCTION IF EXISTS public.esign_submit_signing(text, text, jsonb);
DROP FUNCTION IF EXISTS public.esign_view_document(text);

-- ---------------------------------------------------------------------------
-- esign_get_signing_session: validate token, return recipient + fields to fill
--   args: p_token (raw signing token), p_auth_code (optional access code)
--   returns: jsonb with document, recipient, fields for THIS recipient only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.esign_get_signing_session(p_token text, p_auth_code text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_hash text := encode(digest(p_token, 'sha256'), 'hex');
  v_rec record;
  v_doc record;
  v_auth_ok boolean := true;
BEGIN
  SELECT * INTO v_rec FROM public.esign_recipients WHERE token_hash = v_token_hash LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid or expired signing link');
  END IF;
  -- If an auth code is set, it must match (constant-time-ish via length + equals)
  IF v_rec.auth_code IS NOT NULL AND v_rec.auth_code <> '' THEN
    IF p_auth_code IS NULL OR p_auth_code <> v_rec.auth_code THEN
      RETURN jsonb_build_object('ok', false, 'error', 'An access code is required for this document');
    END IF;
  END IF;
  SELECT * INTO v_doc FROM public.esign_documents WHERE id = v_rec.document_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Document not found');
  END IF;
  -- Block if voided/declined/expired/completed
  IF v_doc.status = 'voided' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This document has been voided and is no longer available for signature');
  END IF;
  IF v_doc.status = 'declined' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This document has been declined');
  END IF;
  IF v_doc.expires_at IS NOT NULL AND v_doc.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This document has expired');
  END IF;
  IF v_rec.status = 'signed' THEN
    RETURN jsonb_build_object('ok', true, 'already_signed', true, 'document', to_jsonb(v_doc), 'recipient', to_jsonb(v_rec));
  END IF;
  -- Mark viewed
  IF v_rec.viewed_at IS NULL THEN
    UPDATE public.esign_recipients SET viewed_at = now(), status = 'viewed' WHERE id = v_rec.id;
  END IF;
  IF v_doc.viewed_at IS NULL THEN
    UPDATE public.esign_documents SET viewed_at = now(), status = 'viewed' WHERE id = v_doc.id;
  END IF;
  INSERT INTO public.esign_audit_logs (document_id, event, actor, email, details)
  VALUES (v_doc.id, 'viewed', v_rec.name, v_rec.email, jsonb_build_object('recipient_id', v_rec.id));

  -- Return fields assigned to this recipient's role (and generic ones)
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', f.id, 'field_key', f.field_key, 'type', f.type, 'page', f.page,
      'x', f.x, 'y', f.y, 'width', f.width, 'height', f.height,
      'recipient_role', f.recipient_role, 'label', f.label,
      'instructions', f.instructions, 'required', f.required,
      'font_size', f.font_size, 'default_value', f.default_value,
      'validation', f.validation, 'options', f.options
    )
  ) INTO v_auth_ok
  FROM public.esign_template_fields f
  WHERE f.template_id = v_doc.template_id
    AND (f.recipient_role = v_rec.role OR f.recipient_role IS NULL OR f.recipient_role = '');

  RETURN jsonb_build_object(
    'ok', true,
    'document', to_jsonb(v_doc),
    'recipient', jsonb_build_object(
      'id', v_rec.id, 'name', v_rec.name, 'email', v_rec.email,
      'role', v_rec.role, 'company', v_rec.company, 'status', v_rec.status,
      'requires_auth_code', v_rec.auth_code IS NOT NULL AND v_rec.auth_code <> ''
    ),
    'fields', COALESCE(v_auth_ok, '[]'::jsonb),
    'consent_text', (SELECT consent_text FROM public.esign_settings WHERE id = 'singleton')
  );
END $$;

-- ---------------------------------------------------------------------------
-- esign_submit_signing: store field values, mark recipient signed, maybe complete
--   args: p_token, p_auth_code, p_values (jsonb array of {field_key,type,value,signature_image,...})
--   returns: jsonb { ok, document_status, all_signed }
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.esign_submit_signing(p_token text, p_auth_code text, p_values jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_hash text := encode(digest(p_token, 'sha256'), 'hex');
  v_rec record;
  v_doc record;
  v_val jsonb;
  v_field record;
  v_count integer := 0;
  v_remaining integer;
  v_all_signed boolean := false;
BEGIN
  SELECT * INTO v_rec FROM public.esign_recipients WHERE token_hash = v_token_hash LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid signing link');
  END IF;
  IF v_rec.auth_code IS NOT NULL AND v_rec.auth_code <> '' THEN
    IF p_auth_code IS NULL OR p_auth_code <> v_rec.auth_code THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Access code required');
    END IF;
  END IF;
  SELECT * INTO v_doc FROM public.esign_documents WHERE id = v_rec.document_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Document not found');
  END IF;
  IF v_doc.status IN ('voided','declined') OR (v_doc.expires_at IS NOT NULL AND v_doc.expires_at < now()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This document is no longer available for signature');
  END IF;
  IF v_rec.status = 'signed' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You have already signed this document');
  END IF;

  IF jsonb_typeof(p_values) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Values must be an array');
  END IF;

  FOR v_val IN SELECT jsonb_array_elements(p_values) LOOP
    -- Find field by field_key for positioning
    SELECT * INTO v_field FROM public.esign_template_fields
      WHERE template_id = v_doc.template_id AND field_key = v_val->>'field_key' LIMIT 1;

    INSERT INTO public.esign_field_values
      (document_id, recipient_id, field_id, field_key, type, page, x, y, width, height, value, signature_image)
    VALUES
      (v_doc.id, v_rec.id, v_field.id, v_val->>'field_key', v_val->>'type',
       COALESCE((v_val->>'page')::integer, COALESCE(v_field.page, 1)),
       COALESCE((v_val->>'x')::numeric, v_field.x), COALESCE((v_val->>'y')::numeric, v_field.y),
       COALESCE((v_val->>'width')::numeric, v_field.width), COALESCE((v_val->>'height')::numeric, v_field.height),
       v_val->>'value', v_val->>'signature_image')
    ON CONFLICT (document_id, recipient_id, field_key)
    DO UPDATE SET value = EXCLUDED.value, signature_image = EXCLUDED.signature_image, type = EXCLUDED.type;
    v_count := v_count + 1;
  END LOOP;

  -- Mark recipient signed
  UPDATE public.esign_recipients
    SET status = 'signed', signed_at = now()
    WHERE id = v_rec.id;

  INSERT INTO public.esign_audit_logs (document_id, event, actor, email, details)
  VALUES (v_doc.id, 'signed', v_rec.name, v_rec.email,
    jsonb_build_object('recipient_id', v_rec.id, 'fields_count', v_count));

  -- Check remaining unsigned recipients
  SELECT count(*) INTO v_remaining FROM public.esign_recipients
    WHERE document_id = v_doc.id AND status NOT IN ('signed','declined','expired');

  IF v_remaining = 0 THEN
    UPDATE public.esign_documents
      SET status = 'completed', completed_at = now(),
          completion_id = 'M2-ESIGN-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 10))
      WHERE id = v_doc.id;
    INSERT INTO public.esign_audit_logs (document_id, event, actor, details)
      VALUES (v_doc.id, 'completed', 'system',
        jsonb_build_object('completion_id', (SELECT completion_id FROM public.esign_documents WHERE id = v_doc.id)));
    v_all_signed := true;
  ELSE
    UPDATE public.esign_documents SET status = 'partially_signed' WHERE id = v_doc.id AND status NOT IN ('completed','voided','declined');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'fields_saved', v_count,
    'document_status', (SELECT status FROM public.esign_documents WHERE id = v_doc.id),
    'all_signed', v_all_signed,
    'completion_id', (SELECT completion_id FROM public.esign_documents WHERE id = v_doc.id)
  );
END $$;

-- ---------------------------------------------------------------------------
-- esign_view_document: return a document + recipients + all field values
--   for the signing "completed" confirmation / audit download page.
--   Token-validated; only reveals values if doc is completed OR recipient is signed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.esign_view_document(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_hash text := encode(digest(p_token, 'sha256'), 'hex');
  v_rec record;
  v_doc record;
  v_fields jsonb;
  v_values jsonb;
  v_recipients jsonb;
BEGIN
  SELECT * INTO v_rec FROM public.esign_recipients WHERE token_hash = v_token_hash LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Invalid link'); END IF;
  SELECT * INTO v_doc FROM public.esign_documents WHERE id = v_rec.document_id LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Not found'); END IF;

  SELECT jsonb_agg(to_jsonb(r) - 'token_hash' - 'auth_code') INTO v_recipients
    FROM public.esign_recipients r WHERE r.document_id = v_doc.id;

  SELECT jsonb_agg(to_jsonb(fv)) INTO v_values
    FROM public.esign_field_values fv WHERE fv.document_id = v_doc.id;

  SELECT jsonb_agg(to_jsonb(f)) INTO v_fields
    FROM public.esign_template_fields f WHERE f.template_id = v_doc.template_id;

  RETURN jsonb_build_object(
    'ok', true,
    'document', to_jsonb(v_doc),
    'recipients', COALESCE(v_recipients, '[]'::jsonb),
    'fields', COALESCE(v_fields, '[]'::jsonb),
    'values', COALESCE(v_values, '[]'::jsonb)
  );
END $$;

-- Allow anon to call these (SECURITY DEFINER = runs as owner, bypasses RLS)
GRANT EXECUTE ON FUNCTION public.esign_get_signing_session(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.esign_submit_signing(text, text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.esign_view_document(text) TO anon, authenticated;
