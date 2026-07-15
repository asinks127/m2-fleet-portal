-- ===========================================================================
-- E-Sign System — SECURITY DEFINER RPCs for public signing flow
-- Anon recipients (not logged in) sign via tokens. These functions validate
-- the token before exposing any data. Callable by anon + authenticated.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- esign_load_signing_session
-- Validates a signing token, returns the document + fields assigned to THIS
-- recipient (matched by role). Marks the recipient's document as "viewed".
-- Returns: jsonb {success, document, recipient, fields} or {success:false, error}
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.esign_load_signing_session(
  p_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recip  record;
  v_doc    record;
  v_fields jsonb;
  v_now    timestamptz := now();
BEGIN
  SELECT * INTO v_recip FROM esign_recipients WHERE token_hash = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid signing link');
  END IF;

  SELECT * INTO v_doc FROM esign_documents WHERE id = v_recip.document_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Document not found');
  END IF;

  IF v_doc.status = 'draft' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This document has not been sent yet');
  END IF;
  IF v_doc.status IN ('completed','declined','voided','expired') THEN
    RETURN jsonb_build_object('success', false, 'error', 'This document is no longer available for signing. Status: ' || v_doc.status);
  END IF;

  IF v_doc.expires_at IS NOT NULL AND v_doc.expires_at < v_now THEN
    UPDATE esign_documents SET status = 'expired', updated_at = now() WHERE id = v_doc.id;
    RETURN jsonb_build_object('success', false, 'error', 'This document has expired');
  END IF;

  IF v_recip.signed_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have already signed this document');
  END IF;

  -- Mark as viewed (first time only)
  IF v_recip.viewed_at IS NULL THEN
    UPDATE esign_recipients SET viewed_at = now(), status = 'viewed' WHERE id = v_recip.id;
  END IF;

  -- Update document status to 'viewed' if it was 'sent'
  IF v_doc.status = 'sent' THEN
    UPDATE esign_documents SET status = 'viewed', updated_at = now() WHERE id = v_doc.id;
  END IF;

  -- Get fields assigned to THIS recipient (matched by role), or unassigned fields
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', f.id,
      'fieldName', f.field_key,
      'label', COALESCE(f.label, f.field_key),
      'type', f.type,
      'pageNumber', f.page,
      'x', f.x,
      'y', f.y,
      'width', f.width,
      'height', f.height,
      'required', f.required,
      'recipientRole', f.recipient_role,
      'options', f.options,
      'defaultValue', f.default_value
    ) ORDER BY f.page, f.y, f.x
  ), '[]'::jsonb) INTO v_fields
  FROM esign_template_fields f
  WHERE f.template_id = v_doc.template_id
    AND (f.recipient_role = v_recip.role OR f.recipient_role IS NULL OR f.recipient_role = '');

  RETURN jsonb_build_object(
    'success', true,
    'document', jsonb_build_object(
      'id', v_doc.id,
      'name', v_doc.name,
      'message', v_doc.email_message,
      'templateId', v_doc.template_id,
      'sourcePdfPath', v_doc.source_pdf_path
    ),
    'recipient', jsonb_build_object(
      'id', v_recip.id,
      'name', v_recip.name,
      'email', v_recip.email,
      'role', v_recip.role,
      'orderIndex', v_recip.order_index
    ),
    'fields', v_fields
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- esign_submit_signing
-- Validates token, saves field values, marks recipient as signed, checks if
-- all recipients are done → marks document completed.
-- p_field_values: jsonb array of [{fieldId, value, signatureImage?}]
-- Returns: jsonb {success, fieldsSaved, documentStatus} or {success:false, error}
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.esign_submit_signing(
  p_token        text,
  p_field_values jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recip        record;
  v_doc          record;
  v_val          jsonb;
  v_field        record;
  v_count        int := 0;
  v_all_signed   boolean;
  v_total_recips int;
  v_signed_recs  int;
BEGIN
  SELECT * INTO v_recip FROM esign_recipients WHERE token_hash = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid signing link');
  END IF;

  SELECT * INTO v_doc FROM esign_documents WHERE id = v_recip.document_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Document not found');
  END IF;

  IF v_doc.status IN ('completed','declined','voided','expired') THEN
    RETURN jsonb_build_object('success', false, 'error', 'This document is no longer available for signing');
  END IF;

  IF v_doc.expires_at IS NOT NULL AND v_doc.expires_at < now() THEN
    UPDATE esign_documents SET status = 'expired', updated_at = now() WHERE id = v_doc.id;
    RETURN jsonb_build_object('success', false, 'error', 'This document has expired');
  END IF;

  IF v_recip.signed_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have already signed this document');
  END IF;

  IF jsonb_typeof(p_field_values) IS DISTINCT FROM 'array' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Field values must be an array');
  END IF;

  -- Check required fields (matched by role) are filled
  FOR v_field IN
    SELECT f.* FROM esign_template_fields f
    WHERE f.template_id = v_doc.template_id
      AND (f.recipient_role = v_recip.role OR f.recipient_role IS NULL OR f.recipient_role = '')
      AND f.required = true
  LOOP
    SELECT elem INTO v_val
    FROM jsonb_array_elements(p_field_values) AS elem
    WHERE elem->>'fieldId' = v_field.id::text;

    IF v_val IS NULL OR v_val->>'value' IS NULL OR v_val->>'value' = '' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Required field missing: ' || COALESCE(v_field.label, v_field.field_key));
    END IF;
  END LOOP;

  -- Save each field value
  FOR v_val IN SELECT * FROM jsonb_array_elements(p_field_values)
  LOOP
    INSERT INTO esign_field_values (document_id, field_id, recipient_id, field_key, type, value, signature_image)
    SELECT v_doc.id, f.id, v_recip.id, f.field_key, f.type,
           v_val->'value',
           CASE WHEN v_val->>'signatureImage' IS NOT NULL THEN v_val->>'signatureImage' ELSE NULL END
    FROM esign_template_fields f
    WHERE f.id::text = v_val->>'fieldId'
      AND f.template_id = v_doc.template_id
    ON CONFLICT (document_id, field_id) DO UPDATE
      SET value = EXCLUDED.value,
          signature_image = EXCLUDED.signature_image;

    v_count := v_count + 1;
  END LOOP;

  -- Mark recipient as signed
  UPDATE esign_recipients
  SET signed_at = now(), status = 'signed'
  WHERE id = v_recip.id;

  -- Write audit log
  INSERT INTO esign_audit_logs (document_id, event, actor, email, details)
  VALUES (v_doc.id, 'recipient_signed', v_recip.name, v_recip.email,
    jsonb_build_object('recipientId', v_recip.id, 'recipientName', v_recip.name, 'fieldCount', v_count));

  -- Check if ALL recipients have signed
  SELECT count(*) INTO v_total_recips FROM esign_recipients WHERE document_id = v_doc.id;
  SELECT count(*) INTO v_signed_recs FROM esign_recipients WHERE document_id = v_doc.id AND signed_at IS NOT NULL;

  IF v_signed_recs = v_total_recips THEN
    UPDATE esign_documents SET status = 'completed', completed_at = now(), updated_at = now() WHERE id = v_doc.id;
    INSERT INTO esign_audit_logs (document_id, event, actor, email, details)
    VALUES (v_doc.id, 'document_completed', v_recip.name, v_recip.email,
      jsonb_build_object('recipientCount', v_total_recips));
    v_all_signed := true;
  ELSE
    UPDATE esign_documents SET status = 'partially_signed', updated_at = now() WHERE id = v_doc.id;
    v_all_signed := false;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'fieldsSaved', v_count,
    'documentStatus', CASE WHEN v_all_signed THEN 'completed' ELSE 'awaiting_others' END
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- esign_decline_document
-- Lets a recipient decline the document.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.esign_decline_document(
  p_token   text,
  p_reason  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recip record;
  v_doc   record;
BEGIN
  SELECT * INTO v_recip FROM esign_recipients WHERE token_hash = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid signing link');
  END IF;

  SELECT * INTO v_doc FROM esign_documents WHERE id = v_recip.document_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Document not found');
  END IF;

  IF v_doc.status IN ('completed','declined','voided','expired') THEN
    RETURN jsonb_build_object('success', false, 'error', 'This document can no longer be declined');
  END IF;

  UPDATE esign_documents SET status = 'declined', updated_at = now() WHERE id = v_doc.id;
  UPDATE esign_recipients SET status = 'declined', declined_at = now(), decline_reason = p_reason WHERE id = v_recip.id;

  INSERT INTO esign_audit_logs (document_id, event, actor, email, details)
  VALUES (v_doc.id, 'document_declined', v_recip.name, v_recip.email,
    jsonb_build_object('reason', p_reason, 'recipientName', v_recip.name));

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- esign_get_completion_data
-- Returns all field values (with positions) + recipients for a completed document.
-- Used by the signing page to finalize the signed PDF.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.esign_get_completion_data(p_document_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc record;
BEGIN
  SELECT * INTO v_doc FROM esign_documents WHERE id = p_document_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Document not found');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'field_values', (
      SELECT jsonb_agg(jsonb_build_object(
        'field_id', fv.field_id,
        'field_key', fv.field_key,
        'type', fv.type,
        'page', COALESCE(tf.page, 1),
        'x', COALESCE(tf.x, 0),
        'y', COALESCE(tf.y, 0),
        'width', COALESCE(tf.width, 200),
        'height', COALESCE(tf.height, 40),
        'value', fv.value,
        'signature_image', fv.signature_image,
        'recipient_name', r.name
      ))
      FROM esign_field_values fv
      LEFT JOIN esign_template_fields tf ON tf.id = fv.field_id
      LEFT JOIN esign_recipients r ON r.id = fv.recipient_id
      WHERE fv.document_id = p_document_id
    ),
    'recipients', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id,
        'name', r.name,
        'email', r.email,
        'role', r.role,
        'signed_at', r.signed_at
      ))
      FROM esign_recipients r
      WHERE r.document_id = p_document_id
    )
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants: anon can call the public signing RPCs, authenticated can call them too.
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.esign_load_signing_session(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.esign_submit_signing(text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.esign_decline_document(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.esign_get_completion_data(uuid) TO anon, authenticated;
