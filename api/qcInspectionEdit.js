// /api/qcInspectionEdit — edit a QC inspection with a tracked audit trail.
// POST { inspectionId, changes: { field: value, ... }, editedBy: 'name' }
// Only whitelisted fields are accepted. Each change is appended to editHistory
// as { field, from, to, editedBy, editedAt }.
import { supabase, getAuthUser } from '../_lib/supabaseServer.js';

const EDITABLE = new Set(['technicianId', 'technicianName', 'assetNumber', 'customer', 'location', 'notes', 'availability']);

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { inspectionId, changes, editedBy } = req.body || {};
    if (!inspectionId || !changes || typeof changes !== 'object') {
      return res.status(400).json({ error: 'inspectionId and changes are required' });
    }

    const { data: current, error } = await supabase.from('QCInspection').select('*').eq('id', inspectionId).maybeSingle();
    if (error || !current) return res.status(404).json({ error: 'Inspection not found' });

    const updates = {};
    const history = Array.isArray(current.editHistory) ? current.editHistory : [];
    const now = new Date().toISOString();
    for (const [key, value] of Object.entries(changes)) {
      if (!EDITABLE.has(key)) continue;
      const currentValue = current[key];
      const nextValue = value === '' ? null : value;
      if ((currentValue ?? null) === (nextValue ?? null)) continue;
      updates[key] = nextValue;
      history.push({ field: key, from: currentValue ?? null, to: nextValue, editedBy: editedBy || user.email, editedAt: now });
    }

    if (!Object.keys(updates).length) return res.json({ success: true, changed: 0, message: 'No changes detected' });

    updates.editHistory = history;
    const { error: updErr } = await supabase.from('QCInspection').update(updates).eq('id', inspectionId);
    if (updErr) throw updErr;

    // If this inspection was already filed to Drive, regenerate the PDF so the
    // filed copy always matches the corrected record.
    let refiled = false;
    if (current.driveStatus === 'filed') {
      try {
        const { default: fileInspection } = await import('./qcInspectionDrive.js');
        await fileInspection(inspectionId);
        refiled = true;
      } catch (e) {
        await supabase.from('QCInspection').update({ driveStatus: 'failed', driveError: 'Re-file after edit failed: ' + String(e?.message || e).slice(0, 300) }).eq('id', inspectionId);
      }
    }

    return res.json({ success: true, changed: Object.keys(updates).length - 1, editHistory: history, refiled });
  } catch (err) {
    console.error('[qcInspectionEdit] failed:', err);
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
