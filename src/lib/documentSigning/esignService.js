// E-Sign System — Supabase data layer (replaces Firebase firestoreService)
// Column names match the actual Supabase schema (migration 20260715160000).
import { supabase } from '@/lib/supabaseClient.js';
import { DOCUMENT_STATUS, SIGNER_STATUS } from './models.js';

const generateId = () => crypto.randomUUID();
const BUCKET = 'esign-documents';

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------
export async function createTemplate(templateData, pdfFile) {
  const id = generateId();
  const path = `templates/${id}/${pdfFile.name}`;

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, pdfFile, {
    contentType: 'application/pdf', upsert: false,
  });
  if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);

  const row = {
    id,
    name: templateData.name || 'Untitled Template',
    description: templateData.description || '',
    status: 'active',
    pdf_storage_path: path,
    pdf_file_name: pdfFile.name,
    page_count: templateData.pageCount || 1,
    page_width: templateData.pageWidth || 612,
    page_height: templateData.pageHeight || 792,
    created_by: templateData.createdBy || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from('esign_templates').insert(row).select().single();
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw new Error(`DB insert failed: ${error.message}`);
  }

  // Insert template fields into the separate table
  if (templateData.fields && templateData.fields.length > 0) {
    const fieldRows = templateData.fields.map(f => ({
      id: generateId(),
      template_id: id,
      field_key: f.fieldKey || f.key || `field_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
      type: f.type || 'text',
      page: f.page || 1,
      x: f.x || 50,
      y: f.y || 50,
      width: f.width || 200,
      height: f.height || 40,
      recipient_role: f.recipientRole || f.role || 'signer_1',
      label: f.label || '',
      instructions: f.instructions || '',
      required: f.required !== false,
      font_size: f.fontSize || 12,
      default_value: f.defaultValue || '',
      validation: f.validation || null,
      options: f.options || null,
      created_at: new Date().toISOString(),
    }));
    const { error: fErr } = await supabase.from('esign_template_fields').insert(fieldRows);
    if (fErr) console.error('Template fields insert failed:', fErr.message);
  }

  // Load fields back with the template
  const { data: fields } = await supabase
    .from('esign_template_fields')
    .select('*')
    .eq('template_id', id)
    .order('created_at', { ascending: true });
  return { ...data, fields: fields || [] };
}

export async function getTemplates() {
  const { data, error } = await supabase
    .from('esign_templates')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  // Load fields for each template
  const templateIds = (data || []).map(t => t.id);
  if (templateIds.length === 0) return [];

  const { data: allFields } = await supabase
    .from('esign_template_fields')
    .select('*')
    .in('template_id', templateIds)
    .order('created_at', { ascending: true });

  return (data || []).map(t => ({
    ...t,
    fields: (allFields || []).filter(f => f.template_id === t.id),
  }));
}

export async function getTemplate(id) {
  const { data, error } = await supabase.from('esign_templates').select('*').eq('id', id).single();
  if (error) throw new Error(error.message);

  const { data: fields } = await supabase
    .from('esign_template_fields')
    .select('*')
    .eq('template_id', id)
    .order('created_at', { ascending: true });

  return { ...data, fields: fields || [] };
}

export async function updateTemplate(id, updates) {
  const { data, error } = await supabase
    .from('esign_templates')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteTemplate(id) {
  const { data: tmpl } = await supabase
    .from('esign_templates')
    .select('pdf_storage_path')
    .eq('id', id)
    .single();
  if (tmpl?.pdf_storage_path) {
    await supabase.storage.from(BUCKET).remove([tmpl.pdf_storage_path]);
  }
  // Delete template fields first
  await supabase.from('esign_template_fields').delete().eq('template_id', id);
  const { error } = await supabase.from('esign_templates').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------
export async function createDocument(docData, pdfFile) {
  const id = generateId();
  const path = `documents/${id}/${pdfFile.name}`;

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, pdfFile, {
    contentType: 'application/pdf', upsert: false,
  });
  if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);

  const row = {
    id,
    name: docData.name || docData.title || 'Untitled Document',
    template_id: docData.templateId || null,
    template_name: docData.templateName || null,
    contractor_id: docData.contractorId || null,
    status: DOCUMENT_STATUS.DRAFT,
    sent_by: docData.sentBy || null,
    email_subject: docData.emailSubject || 'Document requires your signature',
    email_message: docData.message || '',
    source_pdf_path: path,
    expires_at: docData.expiresAt || null,
    project: docData.project || null,
    m2_pm: docData.m2Pm || null,
    signing_order: docData.signingOrder || 'parallel',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from('esign_documents').insert(row).select().single();
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw new Error(`DB insert failed: ${error.message}`);
  }

  // Insert recipients
  if (docData.recipients && docData.recipients.length > 0) {
    const recRows = docData.recipients.map((r, i) => ({
      id: generateId(),
      document_id: id,
      name: r.name,
      email: r.email,
      role: r.role || 'Signer',
      order_index: i + 1,
      phone: r.phone || null,
      company: r.company || null,
      is_external: r.isExternal !== false,
      contractor_link_id: r.contractorLinkId || r.contractorId || null,
      status: SIGNER_STATUS.PENDING,
      token_hash: generateId(),
      created_at: new Date().toISOString(),
    }));
    const { error: rErr } = await supabase.from('esign_recipients').insert(recRows);
    if (rErr) throw new Error(`Recipient insert failed: ${rErr.message}`);

    await addAuditLog(id, null, 'document_created', {
      recipients: docData.recipients.length,
      name: docData.name || docData.title,
    });
  }

  return data;
}

export async function getDocuments(filters = {}) {
  let q = supabase
    .from('esign_documents')
    .select('*, esign_recipients(*)')
    .order('created_at', { ascending: false });

  if (filters.status) q = q.eq('status', filters.status);
  if (filters.search) q = q.ilike('name', `%${filters.search}%`);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  return (data || []).map(d => ({
    ...d,
    esign_recipients: (d.esign_recipients || []).sort(
      (a, b) => (a.order_index || 0) - (b.order_index || 0)
    ),
  }));
}

export async function getDocument(id) {
  const { data, error } = await supabase
    .from('esign_documents')
    .select('*, esign_recipients(*), esign_field_values(*), esign_audit_logs(*)')
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);

  if (data.esign_recipients) {
    data.esign_recipients.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
  }
  if (data.esign_audit_logs) {
    data.esign_audit_logs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }
  return data;
}

export async function updateDocument(id, updates) {
  const { data, error } = await supabase
    .from('esign_documents')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function voidDocument(id, reason = '') {
  const { data, error } = await supabase
    .from('esign_documents')
    .update({
      status: DOCUMENT_STATUS.VOIDED,
      voided_at: new Date().toISOString(),
      void_reason: reason,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  await addAuditLog(id, null, 'document_voided', { reason });
  return data;
}

export async function resendToRecipient(recipientId) {
  const { data: recip, error } = await supabase
    .from('esign_recipients')
    .select('*, esign_documents!inner(*)')
    .eq('id', recipientId)
    .single();
  if (error) throw new Error(error.message);

  await supabase
    .from('esign_recipients')
    .update({ status: SIGNER_STATUS.SENT })
    .eq('id', recipientId);

  await addAuditLog(recip.document_id, recip.email, 'reminder_sent', { email: recip.email });
  return recip;
}

// ---------------------------------------------------------------------------
// Audit log (table name: esign_audit_logs, columns: event, actor, email)
// ---------------------------------------------------------------------------
export async function addAuditLog(documentId, actor, event, details = {}) {
  const { error } = await supabase.from('esign_audit_logs').insert({
    id: generateId(),
    document_id: documentId,
    event,
    actor: actor || 'system',
    email: typeof details.email === 'string' ? details.email : null,
    details,
    created_at: new Date().toISOString(),
  });
  if (error) console.error('Audit log insert failed:', error.message);
}

export async function getAuditLog(documentId) {
  const { data, error } = await supabase
    .from('esign_audit_logs')
    .select('*')
    .eq('document_id', documentId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
export async function getSettings() {
  const { data, error } = await supabase
    .from('esign_settings')
    .select('*')
    .eq('id', 'singleton')
    .single();
  if (error && error.code !== 'PGRST116') throw new Error(error.message);
  return data || { default_from_name: 'M2 Fleet', default_expiration_days: 30 };
}

export async function updateSettings(updates) {
  const { data, error } = await supabase
    .from('esign_settings')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', 'singleton')
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------
export async function uploadSignedPdf(documentId, pdfBlob, fileName = 'signed.pdf') {
  const path = `completed/${documentId}/${fileName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, pdfBlob, {
    contentType: 'application/pdf', upsert: true,
  });
  if (error) throw new Error(`Signed PDF upload failed: ${error.message}`);

  // Update document with the completed PDF path
  await supabase
    .from('esign_documents')
    .update({ completed_pdf_path: path, updated_at: new Date().toISOString() })
    .eq('id', documentId);

  const { data: privData } = await supabase
    .storage.from(BUCKET)
    .createSignedUrl(path, 86400 * 365 * 5);
  return { path, url: privData?.signedUrl };
}

export async function getSignedPdfUrl(documentId) {
  const { data: doc } = await supabase
    .from('esign_documents')
    .select('completed_pdf_path')
    .eq('id', documentId)
    .single();
  if (!doc?.completed_pdf_path) return null;
  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(doc.completed_pdf_path, 3600);
  return data?.signedUrl || null;
}

export async function getPdfBytes(storagePath) {
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
  if (error) throw new Error(`PDF download failed: ${error.message}`);
  const arrayBuffer = await data.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

// ---------------------------------------------------------------------------
// Contractor helpers (for recipient selection)
// ---------------------------------------------------------------------------
export async function getContractors() {
  const { data, error } = await supabase
    .from('User')
    .select('id, full_name, email, company_name, phone_number')
    .eq('role', 'contractor')
    .order('full_name', { ascending: true });
  if (error) {
    // Fallback — try without role filter
    const { data: data2 } = await supabase
      .from('User')
      .select('id, full_name, email, company_name, phone_number')
      .order('full_name', { ascending: true });
    return data2 || [];
  }
  return data || [];
}

export async function getCompletedSignatureRequests() {
  const { data: sigReqs, error } = await supabase
    .from('SignatureRequest')
    .select('id, documentid, documenttitle, technitianname, technitianemail, completedat, createdat, status')
    .eq('status', 'Completed')
    .order('completedat', { ascending: false })
    .limit(100);

  if (error || !sigReqs?.length) return [];

  const docIds = [...new Set(sigReqs.map(r => r.documentid).filter(Boolean))];
  let docMap = {};
  if (docIds.length) {
    const { data: docs } = await supabase
      .from('SignableDocument')
      .select('id, title, fileUrl')
      .in('id', docIds);
    (docs || []).forEach(d => { docMap[d.id] = d; });
  }

  return sigReqs.map(r => ({
    id: `legacy_${r.id}`,
    title: r.documenttitle || (docMap[r.documentid]?.title || 'Untitled Document'),
    status: 'completed',
    contractor_name: r.technitianname || 'Unknown',
    contractor_email: r.technitianemail || '',
    completed_at: r.completedat,
    created_at: r.createdat,
    fileUrl: docMap[r.documentid]?.fileUrl || null,
    _isLegacy: true,
  }));
}
