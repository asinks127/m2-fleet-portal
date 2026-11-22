import { supabase } from './_lib/supabaseServer.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.method === 'POST' ? (req.body || {}) : req.query || {};
    const { signatureToken, signatureRequestId } = body;

    if (!signatureToken && !signatureRequestId) {
      return res.status(400).json({ error: 'Missing signatureToken or signatureRequestId' });
    }

    let query = supabase.from('SignatureRequest').select('*');
    if (signatureToken) {
      query = query.eq('signaturetoken', signatureToken);
    } else {
      query = query.eq('id', signatureRequestId);
    }

    const { data: sigReq, error } = await query.single();
    if (error || !sigReq) {
      return res.status(200).json({ success: false, error: 'Invalid signing link' });
    }

    const { data: document } = await supabase
      .from('SignableDocument')
      .select('*')
      .eq('id', sigReq.documentid)
      .single();

    const normalizedDoc = document ? {
      ...document,
      originalFileUrl: document.originalfileurl || document.fileUrl || null,
      fileUrl: document.fileUrl || document.originalfileurl || null,
      fileName: document.filename || document.fileName || null,
      documentType: document.documenttype || document.documentType || 'pdf',
    } : null;

    return res.status(200).json({
      success: true,
      signatureRequest: sigReq,
      document: normalizedDoc,
    });
  } catch (error) {
    console.error('getSignatureRequestData error:', error);
    return res.status(500).json({ error: error.message });
  }
}
