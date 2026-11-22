// /api/insuranceUpload — store a policy document / COI in the private insurance-docs bucket (admin only)
// POST multipart/form-data: file, policyId (optional — attaches to policy), insuranceType, contractorName
import { supabase, getAuthUser } from '../_lib/supabaseServer.js';

function isAdminAuth(user) {
  if (!user) return false;
  const email = (user.email || '').toLowerCase();
  const metaRole = user.user_metadata?.role || user.app_metadata?.role;
  if (metaRole === 'admin') return true;
  if (email.endsWith('@m2fleetcom.com') && !email.includes('.contractor@')) return true;
  return ['tjserota@gmail.com', 'zo-test@m2fleetcom.com'].includes(email);
}

const ALLOWED = new Set([
  'application/pdf',
  'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif',
]);
const MAX_BYTES = 25 * 1024 * 1024;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!isAdminAuth(user)) return res.status(403).json({ error: 'Forbidden — admin only' });

  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const ct = req.headers['content-type'] || '';
    let fileBase64 = null, fileName = 'policy.pdf', mimeType = 'application/pdf';
    let policyId = null, insuranceType = null, contractorName = null;

    if (ct.includes('application/json')) {
      const b = req.body || {};
      fileBase64 = b.file_base64; fileName = b.fileName || fileName; mimeType = b.mimeType || mimeType;
      policyId = b.policyId || null; insuranceType = b.insuranceType || null; contractorName = b.contractorName || null;
    } else if (ct.includes('multipart/form-data')) {
      const busboy = (await import('busboy')).default;
      await new Promise((resolve, reject) => {
        const bb = busboy({ headers: req.headers });
        let fileBuf = null;
        bb.on('file', (name, stream, info) => {
          const chunks = [];
          stream.on('data', (d) => chunks.push(d));
          stream.on('end', () => {
            fileBuf = Buffer.concat(chunks);
            fileName = info.filename || fileName;
            mimeType = info.mimeType || mimeType;
          });
        });
        bb.on('field', (name, val) => {
          if (name === 'policyId') policyId = val;
          if (name === 'insuranceType') insuranceType = val;
          if (name === 'contractorName') contractorName = val;
        });
        bb.on('finish', () => {
          if (fileBuf) fileBase64 = fileBuf.toString('base64');
          resolve();
        });
        bb.on('error', reject);
        req.pipe(bb);
      });
    } else {
      return res.status(400).json({ error: 'Send multipart/form-data or JSON with file_base64' });
    }

    if (!fileBase64) return res.status(400).json({ error: 'file required' });
    const buf = Buffer.from(fileBase64, 'base64');
    if (buf.length > MAX_BYTES) return res.status(413).json({ error: 'File too large (max 25MB)' });
    if (!ALLOWED.has(mimeType)) return res.status(415).json({ error: `Unsupported type ${mimeType}. Use PDF or images.` });

    const safe = (fileName || 'policy.pdf').replace(/[^\w.\- ]+/g, '_').slice(0, 120);
    const slug = (contractorName || 'contractor').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'contractor';
    const typeSlug = insuranceType || 'policy';
    const path = `${slug}/${typeSlug}/${Date.now()}-${safe}`;

    const { error: upErr } = await supabase.storage
      .from('insurance-docs')
      .upload(path, buf, { contentType: mimeType, upsert: false });
    if (upErr) throw upErr;

    let policy = null;
    if (policyId) {
      const { data, error } = await supabase
        .from('InsurancePolicy')
        .update({ document_path: path, document_name: safe, document_mime_type: mimeType, uploaded_date: new Date().toISOString(), updated_by: user.email, updated_at: new Date().toISOString() })
        .eq('id', policyId)
        .select()
        .single();
      if (error) throw error;
      policy = data;
    }

    return res.status(200).json({ ok: true, path, policy });
  } catch (error) {
    console.error('[insuranceUpload] error:', error);
    return res.status(500).json({ error: error.message || 'Document upload failed' });
  }
}
