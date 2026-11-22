// POST /api/warrantyQuickAction — one-click repair workflow actions on a QCIssue.
// Body: { issue_id, action: 'schedule'|'start'|'complete'|'verify'|'reopen'|'update_fields', extra }
import { getAuthUser } from '../_lib/supabaseServer.js';
import { entities, recalcProjectRollups } from './_warranty/warrantyService.js';
import { recalcTechnicianStats } from './_warranty/warrantyService.js';

function computeNextAction(repairStatus, qcVerified, status) {
  if (qcVerified || repairStatus === 'verified' || status === 'closed') return 'Closed';
  if (repairStatus === 'reopened') return 'Reopened - Immediate Attention';
  if (!repairStatus || repairStatus === 'not_started') return 'Schedule Repair';
  if (repairStatus === 'scheduled') return 'Repair In Progress';
  if (repairStatus === 'in_progress') return 'Awaiting Completion';
  if (repairStatus === 'completed') return 'Awaiting QC Verification';
  return 'Schedule Repair';
}

function addAuditEntry(existingLog, action, user, notes) {
  let log = [];
  try { log = JSON.parse(existingLog || '[]'); } catch { log = []; }
  log.push({ action, user: user || 'unknown', timestamp: new Date().toISOString(), notes: notes || '' });
  return JSON.stringify(log);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const body = typeof req.body === 'object' ? req.body : {};
    const { issue_id, action, extra = {} } = body;
    if (!issue_id || !action) return res.status(400).json({ error: 'issue_id and action required' });

    const found = await entities.QCIssue.filter({ id: issue_id });
    if (!found || found.length === 0) return res.status(404).json({ error: 'Issue not found' });
    const current = found[0];

    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();
    const userEmail = user.email || 'unknown';

    const updates = { last_status_changed_by: userEmail, last_status_changed_at: now };
    let auditAction = action;
    let auditNotes = extra.notes || '';

    if (action === 'schedule') {
      updates.repair_status = 'scheduled';
      if (extra.assigned_repair_tech) updates.assigned_repair_tech = extra.assigned_repair_tech;
      auditAction = 'Repair Scheduled';
    } else if (action === 'start') {
      updates.repair_status = 'in_progress';
      auditAction = 'Repair Started';
    } else if (action === 'complete') {
      if (!extra.repair_action_taken && !current.repair_action_taken) {
        return res.status(400).json({ error: 'repair_action_taken is required to mark completed' });
      }
      updates.repair_status = 'completed';
      updates.repair_completed_date = today;
      updates.repair_action_taken = extra.repair_action_taken || current.repair_action_taken;
      updates.repair_completed_by = extra.repair_completed_by || current.repair_completed_by || userEmail;
      auditAction = 'Repair Completed';
      auditNotes = updates.repair_action_taken;
    } else if (action === 'verify') {
      updates.repair_status = 'verified';
      updates.qc_verified = true;
      updates.qc_verified_by = userEmail;
      updates.qc_verification_date = today;
      updates.date_closed = today;
      updates.resolution_outcome = 'fully_resolved';
      if (current.status !== 'closed') updates.status = 'closed';
      auditAction = 'QC Verified';
    } else if (action === 'reopen') {
      if (!extra.reopened_reason) {
        return res.status(400).json({ error: 'reopened_reason is required to reopen' });
      }
      updates.repair_status = 'reopened';
      updates.qc_verified = false;
      updates.resolution_outcome = 'failed_reopened';
      updates.date_closed = '';
      updates.reopened_reason = extra.reopened_reason;
      updates.reopen_count = (current.reopen_count || 0) + 1;
      if (current.status === 'closed') updates.status = 'pending_repair';
      auditAction = 'Issue Reopened';
      auditNotes = extra.reopened_reason;
    } else if (action === 'update_fields') {
      const allowed = ['assigned_repair_tech', 'repair_action_taken', 'repair_completed_by', 'repair_completed_date', 'qc_verified_by', 'qc_verification_date', 'resolution_outcome', 'root_cause', 'repair_notes', 'severity'];
      for (const k of allowed) {
        if (extra[k] !== undefined) updates[k] = extra[k];
      }
      auditAction = 'Fields Updated';
    } else {
      return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    const newRepairStatus = updates.repair_status || current.repair_status;
    const newQcVerified = updates.qc_verified !== undefined ? updates.qc_verified : current.qc_verified;
    const newStatus = updates.status || current.status;
    updates.next_action_needed = computeNextAction(newRepairStatus, newQcVerified, newStatus);
    updates.warranty_audit_log = addAuditEntry(current.warranty_audit_log, auditAction, userEmail, auditNotes);

    await entities.QCIssue.update(issue_id, updates);

    if (current.technician_id) await recalcTechnicianStats(current.technician_id);
    if (current.project_id) await recalcProjectRollups(current.project_id);

    return res.status(200).json({ success: true, updates });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
