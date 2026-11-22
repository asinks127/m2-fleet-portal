// /api/exportTechRoster — admin-only roster CSV export
// Includes standard roster columns plus (for authorized admins) sensitive
// private fields (DOB, EIN, phone, address) and per-type insurance status.
import { supabase, getAuthUser } from '../_lib/supabaseServer.js';
import { computeStatus, isAdminAuth } from './insurance.js';

const TYPES = [
  ['workers_comp', "Workers' Comp"],
  ['general_liability', 'General Liability'],
  ['commercial_auto', 'Commercial Auto'],
];

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!isAdminAuth(user)) return res.status(403).json({ error: 'Forbidden — admin only' });

  try {
    const [{ data: users, error: uErr }, { data: privs, error: pErr }, { data: policies, error: iErr }] = await Promise.all([
      supabase.from('User').select('*').order('full_name', { ascending: true }),
      supabase.from('ContractorPrivateInfo').select('*'),
      supabase.from('InsurancePolicy').select('technician_id, insurance_type, carrier, policy_number, effective_date, expiration_date, is_current').order('expiration_date', { ascending: true }),
    ]);
    if (uErr) throw uErr;

    const privById = new Map((privs || []).map(r => [r.user_id, r]));
    // newest (farthest-future expiration) current policy per user/type
    const curPolicy = new Map();
    for (const p of (policies || [])) {
      if (!p.technician_id || p.is_current === false) continue;
      const key = `${p.technician_id}:${p.insurance_type}`;
      if (!curPolicy.has(key) || String(p.expiration_date || '') > String(curPolicy.get(key).expiration_date || '')) {
        curPolicy.set(key, p);
      }
    }

    const rows = (users || []).map(u => {
      const priv = privById.get(u.id) || {};
      const row = {
        'Name': u.full_name || u.display_name || '',
        'Display Name': u.display_name || '',
        'Email': u.email || '',
        'Active': u.active === false ? 'No' : 'Yes',
        'Project': u.project || '',
        'M2 PM': u.m2PM || '',
        'Date of Birth': priv.date_of_birth || '',
        'EIN': priv.ein || '',
        'Phone': priv.phone || '',
        'Street Address': priv.address_street || '',
        'Address Line 2': priv.address_line2 || '',
        'City': priv.city || '',
        'State': priv.state || '',
        'ZIP': priv.zip || '',
      };
      for (const [type, label] of TYPES) {
        const p = curPolicy.get(`${u.id}:${type}`);
        row[`${label} Status`] = p ? computeStatus(p.expiration_date) : 'Missing';
        row[`${label} Expiration`] = p ? (p.expiration_date || '') : '';
        row[`${label} Carrier`] = p ? (p.carrier || '') : '';
        row[`${label} Policy #`] = p ? (p.policy_number || '') : '';
      }
      return row;
    });

    const header = Object.keys(rows[0] || { 'No data': '' });
    const csv = [header.join(','), ...rows.map(r => header.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="tech-roster-${stamp}.csv"`);
    return res.status(200).send(csv);
  } catch (err) {
    console.error('[exportTechRoster] error:', err);
    return res.status(500).json({ error: err.message || 'Export failed' });
  }
}
