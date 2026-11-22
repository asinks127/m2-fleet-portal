import { supabase } from '../_lib/supabaseServer.js';

export default async function handler(req, res) {
  const token = req.body?.token || req.query?.token;
  
  if (!token) {
    return res.status(400).json({ success: false, error: 'Missing token' });
  }

  try {
    // 1. Find the SignatureRequest by signaturetoken
    const { data: sigReq, error: sigErr } = await supabase
      .from('SignatureRequest')
      .select('id, documentid, documenttitle, technicianname, technicianemail, status, signaturetoken, signed_at, pdf_storage_path, created_at')
      .eq('signaturetoken', token)
      .single();

    if (sigErr || !sigReq) {
      console.error('[esign-load-session] SignatureRequest not found:', sigErr?.message);
      return res.json({ success: false, error: 'Invalid signing link' });
    }

    if (sigReq.status === 'Signed') {
      return res.json({ success: false, error: 'This document has already been signed' });
    }

    // 2. Get the SignableDocument (or esign_template)
    let document = null;
    let fields = [];
    let sourcePdfPath = sigReq.pdf_storage_path;

    // Try SignableDocument first
    const { data: signableDoc, error: docErr } = await supabase
      .from('SignableDocument')
      .select('*')
      .eq('id', sigReq.documentid)
      .single();

    if (signableDoc) {
      document = {
        id: signableDoc.id,
        title: signableDoc.title || sigReq.documenttitle,
        fileUrl: signableDoc.originalfileurl || signableDoc.fileUrl,
        status: signableDoc.status,
      };
      
      try {
        fields = JSON.parse(signableDoc.signaturefields || signableDoc.content || '[]');
      } catch {
        fields = [];
      }

      if (!sourcePdfPath && signableDoc.originalfileurl) {
        sourcePdfPath = signableDoc.originalfileurl;
      }
    }

    // Fallback: try esign_templates
    if (!document) {
      const { data: esignTmpl } = await supabase
        .from('esign_templates')
        .select('*')
        .eq('id', sigReq.documentid)
        .single();

      if (esignTmpl) {
        document = {
          id: esignTmpl.id,
          title: esignTmpl.name || sigReq.documenttitle,
          fileUrl: null,
          status: esignTmpl.status,
        };
        sourcePdfPath = sourcePdfPath || esignTmpl.pdf_storage_path;

        // Get template fields
        const { data: tmplFields } = await supabase
          .from('esign_template_fields')
          .select('*')
          .eq('template_id', esignTmpl.id);

        if (tmplFields) {
          fields = tmplFields.map(f => ({
            id: f.id,
            pageNumber: f.page || 1,
            x: f.x ?? 0,
            y: f.y ?? 0,
            width: f.width || 200,
            height: f.height || 40,
            label: f.label || 'Signature',
            required: f.required !== false,
            type: f.type || 'signature',
            fieldName: f.label || `field_${f.id}`,
          }));
        }
      }
    }

    if (!document) {
      return res.json({ success: false, error: 'Document not found' });
    }

    return res.json({
      success: true,
      document,
      fields,
      sourcePdfPath,
      signatureRequest: {
        id: sigReq.id,
        status: sigReq.status,
        technicianName: sigReq.technicianname,
        technicianEmail: sigReq.technicianemail,
        documentTitle: sigReq.documenttitle,
        createdAt: sigReq.created_at,
        signedAt: sigReq.signed_at,
      },
      token,
    });
  } catch (err) {
    console.error('[esign-load-session] Error:', err);
    return res.status(500).json({ success: false, error: 'Server error loading signing session' });
  }
}
