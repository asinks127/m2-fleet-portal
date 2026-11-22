// /api/managerCalls — call logs for Velociti PMs & QCs (ManagerCallLog table).
// POST { managerId, managerEmail, note, callDate?, technicianId?, technicianName? }
// GET  ?managerId=&from=&to= — list call logs (newest first, capped at 1000)
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
    if (req.method === 'GET') {
      let query = supabase
        .from('ManagerCallLog')
        .select('*')
        .order('callDate', { ascending: false })
        .limit(1000);
      const { managerId, from, to } = req.query || {};
      if (managerId) query = query.eq('managerId', managerId);
      if (from) query = query.gte('callDate', from);
      if (to) query = query.lte('callDate', to);
      const { data, error } = await query;
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true, calls: data || [] });
    }

    if (req.method === 'POST') {
      const b = req.body || {};
      if (!b.managerId) return res.status(400).json({ error: 'managerId is required' });
      if (!b.note || !String(b.note).trim()) return res.status(400).json({ error: 'Call notes are required' });
      const { data, error } = await supabase
        .from('ManagerCallLog')
        .insert({
          managerId: b.managerId,
          managerEmail: b.managerEmail || null,
          note: String(b.note).trim(),
          callDate: b.callDate || new Date().toISOString(),
          loggedBy: user.email,
          technicianId: b.technicianId || null,
          technicianName: b.technicianName || null,
        })
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true, call: data });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('[managerCalls] failed:', e);
    return res.status(500).json({ error: e.message || 'Internal server error' });
  }
}
