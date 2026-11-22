// /api/veloManagers — manage Velociti PM / QC contact profiles (ExternalManager).
// These are external Velociti personnel — never app users. Only records created
// intentionally through this endpoint appear on the QC Board Managers tab.
//
// GET            -> { managers: [...] }
// POST { name, email, phone, role, project }  -> create (role: 'PM' | 'QC')
// PATCH { id, ...fields, active }             -> update / deactivate
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
      const { data, error } = await supabase.from('ExternalManager').select('*').order('created_at', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ managers: data || [] });
    }

    if (req.method === 'POST') {
      const { name, email, phone, role, project } = req.body || {};
      if (!name || !String(name).trim()) return res.status(400).json({ error: 'Name is required' });
      const normalizedRole = role === 'QC' ? 'Velociti QC' : 'Velociti PM';
      const { data, error } = await supabase
        .from('ExternalManager')
        .insert({
          name: String(name).trim(),
          email: email ? String(email).trim() : null,
          phone: phone ? String(phone).trim() : null,
          role: normalizedRole,
          project: project ? String(project).trim() : null,
          active: true,
        })
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true, manager: data });
    }

    if (req.method === 'PATCH') {
      const { id, ...updates } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id required' });
      const patch = {};
      if (updates.name !== undefined) patch.name = String(updates.name).trim();
      if (updates.email !== undefined) patch.email = updates.email ? String(updates.email).trim() : null;
      if (updates.phone !== undefined) patch.phone = updates.phone ? String(updates.phone).trim() : null;
      if (updates.role !== undefined) patch.role = updates.role === 'QC' ? 'Velociti QC' : updates.role === 'PM' ? 'Velociti PM' : updates.role;
      if (updates.project !== undefined) patch.project = updates.project ? String(updates.project).trim() : null;
      if (updates.active !== undefined) patch.active = !!updates.active;
      const { data, error } = await supabase.from('ExternalManager').update(patch).eq('id', id).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true, manager: data });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('[veloManagers] failed:', e);
    return res.status(500).json({ error: e?.message || 'Unexpected error' });
  }
}
