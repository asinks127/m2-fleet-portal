import crypto from 'node:crypto';
import { supabase, getAuthUser } from './_lib/supabaseServer.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const { documentId, recipients } = req.body || {};
    if (!documentId || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ success: false, error: 'Missing documentId or recipients' });
    }

    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { data: document, error: documentError } = await supabase
      .from('SignableDocument')
      .select('*')
      .eq('id', documentId)
      .single();

    if (documentError) throw documentError;
    if (!document) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    const appUrl = (req.headers.origin || process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');
    const results = [];

    for (const recipient of recipients) {
      if (!recipient?.name || !recipient?.email) {
        results.push({ ...recipient, status: 'failed', error: 'Missing name or email' });
        continue;
      }

      try {
        const signatureToken = crypto.randomUUID();
        const signingUrl = `${appUrl}/SignDocument?token=${signatureToken}`;
        const payload = {
          documentId: document.id,
          documentTitle: document.title,
          technicianName: recipient.name,
          technicianEmail: recipient.email,
          status: 'Sent',
          signatureToken,
        };
        if (recipient.technicianId) payload.technicianId = recipient.technicianId;

        const { error } = await supabase.from('SignatureRequest').insert(payload);
        if (error) throw error;

        results.push({
          ...recipient,
          signingUrl,
          status: recipient.technicianId ? 'created_internal' : 'created_pending_email'
        });
      } catch (error) {
        results.push({ ...recipient, status: 'failed', error: error.message });
      }
    }

    return res.status(200).json({ success: true, results });
  } catch (error) {
    console.error('Critical error in sendSignatureRequest:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
