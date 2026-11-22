// /api/getContractorDocuments — scoped documents + signature requests for a tech profile.
// Returns { data: { documents, signatureRequests } } so the profile Documents tab
// can show uploads (admin or contractor) plus signed/completed e-signature docs.
// Admins may pass targetUserId/targetUserEmail; contractors are limited to their own.
import { supabase, getAuthUser } from './_lib/supabaseServer.js';

const ADMIN_EMAILS = new Set([
  'lena@m2fleetcom.com', 'orville@m2fleetcom.com', 'steve@m2fleetcom.com',
  'austin@m2fleetcom.com', 'adam@m2fleetcom.com', 'jason@m2fleetcom.com',
  'erica@m2fleetcom.com', 'lowell@m2fleetcom.com', 'secretary@m2fleetcom.com',
  'tjserota@gmail.com',
]);

function isAdmin(user) {
  if (!user) return false;
  const email = (user.email || '').toLowerCase();
  const metaRole = user.user_metadata?.role || user.app_metadata?.role;
  return metaRole === 'admin' || ADMIN_EMAILS.has(email);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const body = req.body || {};
    const targetUserId = body.targetUserId || user.id;
    let targetUserEmail = body.targetUserEmail || user.email;
    const isOwnProfile = targetUserId === user.id;

    if (!isOwnProfile && !isAdmin(user)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (isOwnProfile) targetUserEmail = user.email;

    const emailLower = String(targetUserEmail || '').trim().toLowerCase();

    const [docsRes, reqRes] = await Promise.all([
      supabase.from('ContractorDocument').select('*').order('uploadDate', { ascending: false }).limit(500),
      supabase.from('SignatureRequest').select('*').order('created_date', { ascending: false }).limit(500),
    ]);

    if (docsRes.error) throw docsRes.error;
    if (reqRes.error) console.warn('[getContractorDocuments] SignatureRequest query failed:', reqRes.error.message);

    const documents = (docsRes.data || []).filter(d => {
      if (!d) return false;
      if (d.contractorId === targetUserId) return true;
      const docEmail = String(d.contractorEmail || '').trim().toLowerCase();
      return emailLower && docEmail && docEmail === emailLower;
    });

    const signatureRequests = (reqRes.data || []).filter(r => {
      if (!r) return false;
      const idMatch = (r.technicianid || r.technicianId) === targetUserId;
      const reqEmail = String(r.technicianemail || r.technicianEmail || '').trim().toLowerCase();
      const emailMatch = emailLower && reqEmail && reqEmail === emailLower;
      return idMatch || emailMatch;
    }).sort((a, b) => new Date(b.created_date || b.createdat || 0) - new Date(a.created_date || a.createdat || 0));

    return res.status(200).json({ data: { documents, signatureRequests } });
  } catch (error) {
    console.error('[getContractorDocuments] error:', error);
    return res.status(500).json({ error: 'An unexpected error occurred. Please try again later.' });
  }
}
