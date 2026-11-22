// /api/insuranceExport — admin-only insurance report export (xlsx/csv)
// Query params mirror the report filters chosen in the UI:
//   type=workers_comp|general_liability|commercial_auto|all
//   status=active|expiring|expired|missing|all
//   contractor=<name substring>  business=<name substring>
//   effective_from, effective_to, expiration_from, expiration_to, created_from, created_to (YYYY-MM-DD)
//   format=csv|xlsx   consolidated=1 (all three types per contractor)
import { supabase, getAuthUser } from '../_lib/supabaseServer.js';
import { computeStatus, daysUntil, isAdminAuth } from './insurance.js';
import * as XLSX from 'xlsx';

function within(dateStr, from, to) {
  if (!dateStr) return false;
  if (from && dateStr < from) return false;
  if (to && dateStr > to) return false;
  return true;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!isAdminAuth(user)) return res.status(403).json({ error: 'Forbidden — admin only' });

  try {
    const q = req.query || {};
    const [{ data: policies, error }, { data: users, error: uErr }] = await Promise.all([
      supabase.from('InsurancePolicy').select('*').order('expiration_date', { ascending: true }),
      supabase.from('User').select('id, email, full_name, display_name, businessName, active').order('full_name', { ascending: true }),
    ]);
    if (error) throw error;
    const byId = new Map((users || []).map(u => [u.id, u]));

    let rows = (policies || []).map(p => {
      const u = p.technician_id ? byId.get(p.technician_id) : null;
      return {
        'Technician/Contractor Name': u ? (u.full_name || u.display_name || u.email) : (p.contractor_name || ''),
        'Business Name': p.business_name || (u && u.businessName) || '',
        'Insurance Type': p.insurance_type === 'workers_comp' ? "Workers' Comp" : p.insurance_type === 'general_liability' ? 'General Liability' : 'Commercial Auto',
        'Insurance Provider': p.carrier || '',
        'Policy Number': p.policy_number || '',
        'Policy Effective Date': p.effective_date || '',
        'Policy Expiration Date': p.expiration_date || '',
        'Record Creation Date': (p.created_at || '').slice(0, 10),
        'Upload Date': p.uploaded_date || '',
        'Current Insurance Status': computeStatus(p.expiration_date),
        'Days Until Expiration': daysUntil(p.expiration_date),
      };
    });

    // Missing-coverage rows (active contractors lacking a type)
    if (q.status === 'missing' || q.consolidated) {
      const haveType = new Map();
      for (const p of (policies || [])) {
        if (!p.technician_id) continue;
        if (!haveType.has(p.technician_id)) haveType.set(p.technician_id, new Set());
        haveType.get(p.technician_id).add(p.insurance_type);
      }
      const missingRows = (users || []).filter(u => u.active !== false).flatMap(u => {
        const have = haveType.get(u.id) || new Set();
        return ['workers_comp', 'general_liability', 'commercial_auto']
          .filter(t => !have.has(t))
          .map(t => ({
            'Technician/Contractor Name': u.full_name || u.display_name || u.email,
            'Business Name': u.businessName || '',
            'Insurance Type': t === 'workers_comp' ? "Workers' Comp" : t === 'general_liability' ? 'General Liability' : 'Commercial Auto',
            'Insurance Provider': '', 'Policy Number': '', 'Policy Effective Date': '', 'Policy Expiration Date': '',
            'Record Creation Date': '', 'Upload Date': '',
            'Current Insurance Status': 'Missing',
            'Days Until Expiration': '',
          }));
      });
      rows = rows.concat(missingRows);
    }

    if (q.type && q.type !== 'all') {
      const typeMap = { workers_comp: 'Workers\' Comp', general_liability: 'General Liability', commercial_auto: 'Commercial Auto' };
      rows = rows.filter(r => r['Insurance Type'] === typeMap[q.type]);
    }
    if (q.status && q.status !== 'all') {
      rows = rows.filter(r => {
        const s = r['Current Insurance Status'];
        if (q.status === 'active') return s === 'Active' || s === 'Early Warning';
        if (q.status === 'expiring') return ['Early Warning', 'Expiring Soon', 'Urgent', 'Critical'].includes(s);
        if (q.status === 'expired') return s === 'Expired';
        if (q.status === 'missing') return s === 'Missing';
        return true;
      });
    }
    if (q.contractor) rows = rows.filter(r => r['Technician/Contractor Name'].toLowerCase().includes(q.contractor.toLowerCase()));
    if (q.business) rows = rows.filter(r => r['Business Name'].toLowerCase().includes(q.business.toLowerCase()));
    if (q.effective_from || q.effective_to) rows = rows.filter(r => within(r['Policy Effective Date'], q.effective_from, q.effective_to));
    if (q.expiration_from || q.expiration_to) rows = rows.filter(r => within(r['Policy Expiration Date'], q.expiration_from, q.expiration_to));
    if (q.created_from || q.created_to) rows = rows.filter(r => within(r['Record Creation Date'], q.created_from, q.created_to));

    const stamp = new Date().toISOString().slice(0, 10);
    if ((q.format || 'csv') === 'xlsx') {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Insurance Report');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="insurance-report-${stamp}.xlsx"`);
      return res.status(200).send(buf);
    }
    const header = Object.keys(rows[0] || { 'No data': '' });
    const csv = [header.join(','), ...rows.map(r => header.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="insurance-report-${stamp}.csv"`);
    return res.status(200).send(csv);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Export failed' });
  }
}
