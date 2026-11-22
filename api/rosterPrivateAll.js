// /api/rosterPrivateAll — batch admin-only read of sensitive roster fields
// GET → { rows: [{ user_id, date_of_birth, ein, phone, address_street, address_line2, city, state, zip }] }
import { supabase, getAuthUser } from '../_lib/supabaseServer.js';

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
    const { data, error } = await supabase.from('ContractorPrivateInfo').select('*');
    if (error) throw error;
    return res.status(200).json({ rows: data || [] });
  } catch (err) {
    console.error('[rosterPrivateAll] error:', err);
    return res.status(500).json({ error: err.message || 'Failed to load roster private data' });
  }
}
