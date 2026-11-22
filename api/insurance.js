// /api/insurance — centralized insurance policy API (admin only)
// GET  → { policies, summary, alerts }   (status computed server-side)
// POST → create policy  { technician_id?, contractor_name, business_name, insurance_type, carrier, policy_number, effective_date, expiration_date, notes }
// PATCH→ update / renew { id, ...fields, renew_from_id? }
import { supabase, getAuthUser } from '../_lib/supabaseServer.js';

export function isAdminAuth(user) {
  if (!user) return false;
  const email = (user.email || '').toLowerCase();
  const metaRole = user.user_metadata?.role || user.app_metadata?.role;
  if (metaRole === 'admin') return true;
  if (email.endsWith('@m2fleetcom.com') && !email.includes('.contractor@')) return true;
  return ['tjserota@gmail.com', 'zo-test@m2fleetcom.com'].includes(email);
}

const TYPES = new Set(['workers_comp', 'general_liability', 'commercial_auto']);

export function computeStatus(expirationDate) {
  if (!expirationDate) return 'Missing';
  const exp = new Date(expirationDate + 'T23:59:59Z');
  if (Number.isNaN(exp.getTime())) return 'Missing';
  const now = new Date();
  const days = Math.ceil((exp.getTime() - now.getTime()) / 86400000);
  if (days < 0) return 'Expired';
  if (days <= 7) return 'Critical';
  if (days <= 15) return 'Urgent';
  if (days <= 30) return 'Expiring Soon';
  if (days <= 60) return 'Early Warning';
  return 'Active';
}

export function daysUntil(expirationDate) {
  if (!expirationDate) return null;
  const exp = new Date(expirationDate + 'T23:59:59Z');
  if (Number.isNaN(exp.getTime())) return null;
  return Math.ceil((exp.getTime() - Date.now()) / 86400000);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!isAdminAuth(user)) return res.status(403).json({ error: 'Forbidden — admin only' });

  try {
    if (req.method === 'GET') {
      const [{ data: policies, error: pErr }, { data: privs, error: cErr }] = await Promise.all([
        supabase.from('InsurancePolicy').select('*').order('expiration_date', { ascending: true }),
        supabase.from('ContractorPrivateInfo').select('user_id'),
      ]);
      if (pErr) throw pErr;
      if (cErr) throw cErr;

      const [{ data: users, error: uErr }, { data: wc, error: wErr }] = await Promise.all([
        supabase.from('User').select('id, email, full_name, display_name, businessName, active').order('full_name', { ascending: true }),
        supabase.from('WorkersCompRecord').select('id, "userEmail", "expirationDate"'),
      ]);
      // WorkersCompRecord read is best-effort (legacy table)
      const allUsers = uErr ? [] : (users || []);

      const byEmail = new Map(allUsers.map(u => [(u.email || '').toLowerCase(), u]));
      const rows = (policies || []).map(p => ({
        ...p,
        policy_status: computeStatus(p.expiration_date),
        days_until_expiration: daysUntil(p.expiration_date),
      }));

      // Contractors who have NO policy row for a required type yet
      const haveType = new Map(); // userId -> Set(types)
      for (const p of rows) {
        if (!p.technician_id) continue;
        if (!haveType.has(p.technician_id)) haveType.set(p.technician_id, new Set());
        haveType.get(p.technician_id).add(p.insurance_type);
      }
      const missing = allUsers
        .filter(u => u.active !== false)
        .map(u => {
          const have = haveType.get(u.id) || new Set();
          const missingTypes = ['workers_comp', 'general_liability', 'commercial_auto'].filter(t => !have.has(t));
          return { user_id: u.id, name: u.full_name || u.display_name || u.email, email: u.email, business_name: u.businessName || '', missing_types: missingTypes };
        })
        .filter(m => m.missing_types.length > 0);

      const summary = {
        total_policies: rows.length,
        active: rows.filter(r => r.policy_status === 'Active').length,
        expiring_60: rows.filter(r => ['Early Warning', 'Expiring Soon', 'Urgent', 'Critical'].includes(r.policy_status)).length,
        expiring_30: rows.filter(r => ['Expiring Soon', 'Urgent', 'Critical'].includes(r.policy_status)).length,
        expired: rows.filter(r => r.policy_status === 'Expired').length,
        contractors_missing: missing.length,
      };

      // WC coverage check from legacy table (missing = active contractor with no WC row or expired row)
      const wcByEmail = new Map((wc || []).map(w => [(w.userEmail || '').toLowerCase(), w]));
      const legacyWcMissing = allUsers
        .filter(u => u.active !== false && u.email && !wcByEmail.has(u.email.toLowerCase()))
        .map(u => ({ user_id: u.id, name: u.full_name || u.display_name || u.email, email: u.email, source: 'legacy workers comp' }));

      return res.status(200).json({
        policies: rows,
        summary,
        missing,
        legacy_wc_missing: legacyWcMissing,
      });
    }

    if (req.method === 'POST' || req.method === 'PATCH') {
      const b = req.body || {};

      if (req.method === 'POST') {
        if (!b.contractor_name || !TYPES.has(b.insurance_type)) {
          return res.status(400).json({ error: 'contractor_name and valid insurance_type required' });
        }
        const insert = {
          technician_id: b.technician_id || null,
          contractor_name: b.contractor_name,
          business_name: b.business_name || null,
          insurance_type: b.insurance_type,
          carrier: b.carrier || null,
          policy_number: b.policy_number || null,
          effective_date: b.effective_date || null,
          expiration_date: b.expiration_date || null,
          notes: b.notes || null,
          supersedes_policy_id: b.supersedes_policy_id || null,
          created_by: user.email,
          updated_by: user.email,
        };
        const { data, error } = await supabase.from('InsurancePolicy').insert(insert).select().single();
        if (error) throw error;

        // Mark superseded policy as historical/renewed
        if (b.supersedes_policy_id) {
          await supabase.from('InsurancePolicy').update({ superseded_by: data.id, updated_by: user.email, updated_at: new Date().toISOString() }).eq('id', b.supersedes_policy_id);
        }
        return res.status(201).json({ policy: { ...data, policy_status: computeStatus(data.expiration_date), days_until_expiration: daysUntil(data.expiration_date) } });
      }

      // PATCH
      if (!b.id) return res.status(400).json({ error: 'id required' });
      const patch = { updated_by: user.email, updated_at: new Date().toISOString() };
      for (const k of ['contractor_name', 'business_name', 'insurance_type', 'carrier', 'policy_number', 'effective_date', 'expiration_date', 'notes', 'technician_id']) {
        if (b[k] !== undefined) patch[k] = b[k];
      }
      const { data, error } = await supabase.from('InsurancePolicy').update(patch).eq('id', b.id).select().single();
      if (error) throw error;
      return res.status(200).json({ policy: { ...data, policy_status: computeStatus(data.expiration_date), days_until_expiration: daysUntil(data.expiration_date) } });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[insurance] error:', error);
    return res.status(500).json({ error: error.message || 'Insurance operation failed' });
  }
}
