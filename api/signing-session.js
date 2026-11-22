import { supabase } from '../_lib/supabaseServer.js';

export default async function handler(req, res) {
  try {
    const method = req.method || 'GET';

    if (method === 'GET') {
      const token = req.query?.token;

      if (!token) {
        return res.status(400).json({ success: false, error: 'Missing token' });
      }

      const { data: sigReq, error: sigErr } = await supabase
        .from('SignatureRequest')
        .select('*')
        .eq('signaturetoken', token)
        .single();

      if (sigErr || !sigReq) {
        return res.json({ success: false, error: 'Invalid signing link' });
      }

      if (sigReq.status === 'Completed') {
        return res.json({ success: false, error: 'This document has already been signed' });
      }

      if (sigReq.status === 'Declined') {
        return res.json({ success: false, error: 'This document has been declined' });
      }

      const fields = [];
      let sourcePdfPath = null;

      if (sigReq.documentid) {
        const { data: sigDoc } = await supabase
          .from('SignableDocument')
          .select('*')
          .eq('id', sigReq.documentid)
          .single();

        if (sigDoc) {
          // Try signaturefields column first
          if (sigDoc.signaturefields) {
            try {
              const parsed = typeof sigDoc.signaturefields === 'string'
                ? JSON.parse(sigDoc.signaturefields)
                : sigDoc.signaturefields;
              const arr = Array.isArray(parsed) ? parsed : [];
              fields.push(...arr);
            } catch (e) { /* ignore */ }
          }

          // If no fields yet, parse the content JSON for signatureFields
          if (!fields.length && sigDoc.content) {
            try {
              const parsed = typeof sigDoc.content === 'string'
                ? JSON.parse(sigDoc.content)
                : sigDoc.content;
              if (parsed?.signatureFields && Array.isArray(parsed.signatureFields)) {
                const mappedFields = parsed.signatureFields.map((f, idx) => ({
                  id: f.id || `field_${idx}`,
                  type: f.type || 'signature',
                  pageNumber: f.page || f.pageNumber || 1,
                  x: f.x || 0,
                  y: f.y || 0,
                  width: f.width || 200,
                  height: f.height || 50,
                  label: f.label || 'Sign Here',
                  required: f.required !== false,
                }));
                fields.push(...mappedFields);
              }
            } catch (e) { /* ignore */ }
          }

          // Source PDF path
          if (sigDoc.originalfileurl) {
            sourcePdfPath = sigDoc.originalfileurl;
          } else if (sigDoc.fileUrl) {
            sourcePdfPath = sigDoc.fileUrl;
          }
        }
      }

      if (!fields.length) {
        fields.push({ id: 'signature', label: 'Signature', type: 'signature', required: true, pageNumber: 1, x: 0, y: 0, width: 0, height: 0 });
      }

      return res.json({
        success: true,
        requestId: sigReq.id,
        documentId: sigReq.documentid,
        documentTitle: sigReq.documenttitle,
        status: sigReq.status,
        document: {
          title: sigReq.documenttitle || 'Document',
          sourcePdfPath,
        },
        fields,
      });
    }

    if (method === 'POST') {
      const body = req.body || {};
      const decline = body.action === 'decline' || body.decline;
      const token = body.token;
      const fieldValues = body.fieldValues || body.field_values;

      if (!token) {
        return res.status(400).json({ success: false, error: 'Missing token' });
      }

      const { data: sigReq, error: sigErr } = await supabase
        .from('SignatureRequest')
        .select('*')
        .eq('signaturetoken', token)
        .single();

      if (sigErr || !sigReq) {
        return res.json({ success: false, error: 'Invalid signing link' });
      }

      if (decline) {
        await supabase
          .from('SignatureRequest')
          .update({ status: 'Declined' })
          .eq('id', sigReq.id);

        return res.json({ success: true, documentStatus: 'declined' });
      }

      if (!fieldValues || !fieldValues.length) {
        return res.status(400).json({ success: false, error: 'Missing field values' });
      }

      await supabase
        .from('SignatureRequest')
        .update({
          status: 'Completed',
          signed_at: new Date().toISOString(),
          signed_values: fieldValues,
        })
        .eq('id', sigReq.id);

      return res.json({ success: true, documentStatus: 'completed' });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('[signing-session] Error:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
