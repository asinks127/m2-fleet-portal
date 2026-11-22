// /api/rosterPrivate — admin-only access to sensitive technician roster fields
// (DOB, EIN, address). Stored in ContractorPrivateInfo keyed by the existing User.id.
// GET  ?user_id=uuid → row (or { row: null })
// PUT  { user_id, date_of_birth, ein, phone, address_street, address_line2, city, state, zip_code }
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
      const url = new URL(req.url, 'http://localhost');
      const userId = url.searchParams.get('user_id');
      if (!userId) return res.status(400).json({ error: 'user_id required' });
      const { data, error } = await supabase
        .from('ContractorPrivateInfo')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return res.status(200).json({ row: data || null });
    }

    if (req.method === 'PUT') {
      const b = req.body || {};
      if (!b.user_id) return res.status(400).json({ error: 'user_id required' });

      // light format validation
      if (b.ein && !/^(\d{2}-\d{7}|\d{3}-\d{2}-\d{4})$/.test(b.ein)) return res.status(400).json({ error: 'EIN must be XX-XXXXXXX or SSN must be XXX-XX-XXXX' });
      if (b.phone && !/^[\d\s().+\-]{7,20}$/.test(b.phone)) return res.status(400).json({ error: 'Invalid phone number' });
      if (b.date_of_birth && !/^\d{4}-\d{2}-\d{2}$/.test(b.date_of_birth)) return res.status(400).json({ error: 'DOB must be YYYY-MM-DD (displayed as MM/DD/YYYY)' });

      const payload = {
        user_id: b.user_id,
        date_of_birth: b.date_of_birth || null,
        ein: b.ein || null,
        phone: b.phone || null,
        address_street: b.address_street || null,
        address_line2: b.address_line2 || null,
        city: b.city || null,
        state: b.state || null,
        zip: b.zip_code || b.zip || null,
        updated_by: user.email,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('ContractorPrivateInfo')
        .upsert(payload, { onConflict: 'user_id' })
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json({ row: data });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[rosterPrivate] error:', error);
    return res.status(500).json({ error: error.message || 'Private roster operation failed' });
  }
}
