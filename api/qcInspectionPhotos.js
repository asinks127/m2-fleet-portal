// /api/qcInspectionPhotos
// POST { paths: [storage paths] } -> { urls: { path: signedUrl } } for displaying
//   inspection photos stored in the private qc-inspection-photos bucket.
// DELETE { path } -> remove a photo object (used when an inspection is deleted).
import { supabase, getAuthUser } from '../_lib/supabaseServer.js';

const BUCKET = 'qc-inspection-photos';

function isAdminAuth(user) {
  if (!user) return false;
  const email = (user.email || '').toLowerCase();
  const metaRole = user.user_metadata?.role || user.app_metadata?.role;
  if (metaRole === 'admin') return true;
  if (email.endsWith('@m2fleetcom.com') && !email.includes('.contractor@')) return true;
  return ['tjserota@gmail.com', 'zo-test@m2fleetcom.com'].includes(email);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!isAdminAuth(user)) return res.status(403).json({ error: 'Forbidden — admin only' });

  try {
    if (req.method === 'POST') {
      const paths = (req.body?.paths || []).filter(Boolean).slice(0, 50);
      const urls = {};
      for (const path of paths) {
        const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
        urls[path] = error ? null : data?.signedUrl;
      }
      return res.status(200).json({ urls });
    }

    if (req.method === 'DELETE') {
      const path = req.body?.path;
      if (!path) return res.status(400).json({ error: 'path required' });
      const { error } = await supabase.storage.from(BUCKET).remove([path]);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Unexpected error' });
  }
}
