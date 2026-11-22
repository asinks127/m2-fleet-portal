// GET/POST /api/getAllSessions — recent user sessions (admin only).
import { getAuthUser, supabase } from '../_lib/supabaseServer.js';
import { entities } from './_warranty/warrantyService.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { data: profile, error } = await supabase.from('User').select('role').eq('email', user.email.toLowerCase()).maybeSingle();
    if (error) throw error;
    if (profile?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const sessions = await entities.UserSession.list('-session_start', 1000);
    return res.status(200).json({ sessions });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
