// Maintenance/backfill operations for the warranty flow (ported from the
// warranty app's base44 functions). All run against Supabase with the
// service role and return summary stats.
import { entities, detectCategory, normalizeName, isPlaceholderName, formatDate } from './warrantyService.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Map camelCase app keys to the snake_case DB columns for QCIssue updates.
const ISSUE_KEY_MAP = {
  warrantyTitle: 'warranty_title', technicianId: 'technician_id', technicianName: 'technician_name',
  customerName: 'customer_name', productName: 'product_description', issueDescription: 'issue_description',
  qcNotes: 'qc_notes', remoteQcNotes: 'remote_qc_notes', postInstallNotes: 'post_install_notes',
  assetNumber: 'asset_number', installedVin: 'installed_vin', equipVin: 'equip_vin',
  workOrderName: 'work_order_name', siteLocation: 'site_location', projectManager: 'project_manager',
  projectId: 'project_id', caseNumber: 'case_number', installServiceDate: 'install_service_date',
  qcEventDate: 'qc_event_date', dateReceived: 'date_received', dateRepaired: 'date_repaired',
  dateClosed: 'date_closed', issueWeek: 'issue_week', issueMonth: 'issue_month', issueYear: 'issue_year',
  sourceMessageId: 'source_message_id', sourceThreadId: 'source_thread_id', sourceEmailSubject: 'source_email_subject',
  sourceEmailFrom: 'source_email_from', sourceEmailDate: 'source_email_date', rawEmailBody: 'raw_email_body',
  issueSummaryClean: 'issue_summary_clean', resolutionSummaryClean: 'resolution_summary_clean',
  autoCategory: 'auto_category', finalCategory: 'final_category', issueCategory: 'issue_category',
  qcCategory: 'qc_category', issueWeight: 'issue_weight', isDocumentationOnly: 'is_documentation_only',
  dataStatus: 'data_status', issueSource: 'issue_source', dedupeKey: 'dedupe_key', duplicateStatus: 'duplicate_status',
  parseStatus: 'parse_status', parseConfidence: 'parse_confidence', techStatus: 'technician_profile_status',
};

export function mapIssueKeys(obj) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [ISSUE_KEY_MAP[k] || k, v]));
}

// Backfill QCIssue + WarrantyClaim records from the mailbox for a date range.
export async function backfillEmails({ start_date, end_date, max } = {}) {
  const { syncWarrantyEmails } = await import('./warrantyService.js');
  return syncWarrantyEmails({ mode: 'backfill', start_date, end_date, max: max || 200 });
}

// Create WarrantyClaim records for QCIssues that don't have one.
export async function backfillWarrantyClaims({ offset = 0, batchSize = 50, startDate = '2025-01-01' } = {}) {
  const issues = (await entities.QCIssue.list('-created_date', 2000))
    .filter((i) => i.install_service_date >= startDate);
  const claims = await entities.WarrantyClaim.list();
  const claimKeys = new Set(claims.map((c) => `${c.claim_number}`));
  const issueIds = new Set(claims.map((c) => c.source_issue_id).filter(Boolean));

  let created = 0, skipped = 0;
  for (const issue of issues.slice(offset, offset + batchSize)) {
    if (issueIds.has(issue.id)) { skipped++; continue; }
    const claimNumber = `WC-${String(issue.source_message_id || issue.id).substring(0, 8).toUpperCase()}`;
    if (claimKeys.has(claimNumber)) { skipped++; continue; }
    await entities.WarrantyClaim.create({
      claim_number: claimNumber,
      customer_name: issue.customer || 'Unknown',
      product_description: `${issue.asset_number || ''} - ${issue.make || ''} ${issue.model || ''}`.trim(),
      issue_description: issue.issue_summary_clean || issue.remote_qc_notes || issue.qc_notes || '',
      technician_name: issue.technician_name || '',
      claim_date: issue.install_service_date || issue.qc_event_date || (issue.created_at || '').split('T')[0],
      status: 'pending',
      return_required: true,
      source_issue_id: issue.id,
    });
    created++;
    await sleep(100);
  }
  return { created, skipped, remaining: Math.max(0, issues.length - offset - batchSize) };
}

// Heuristic classification for issues missing qc_category.
export async function backfillClassification({ reclassify_all = false, batch_size = 50 } = {}) {
  const allIssues = await entities.QCIssue.list('-created_date', 200);
  const records = allIssues.filter((r) => {
    if (r.data_status === 'legacy_review' || r.data_status === 'archived') return false;
    return reclassify_all === true ? true : !r.qc_category;
  }).slice(0, batch_size);

  const WEIGHTS = { 'Functional Failure': 3.0, 'Installation Quality': 1.75, 'Verification Failure': 1.0, 'Install Risk': 0.75, 'Documentation': 0.25 };
  let classified = 0;
  for (const rec of records) {
    const notes = [rec.remote_qc_notes, rec.post_install_notes].filter(Boolean).join(' | ') || rec.qc_notes || '';
    const category = detectCategory(notes);
    const CATEGORY_NAME = {
      camera_positioning: 'Installation Quality', mirror_adjustment: 'Installation Quality',
      mounting: 'Installation Quality', connection_issue: 'Functional Failure',
      equipment_missing: 'Functional Failure', installation_quality: 'Installation Quality', other: 'Install Risk',
    };
    const qcCategory = CATEGORY_NAME[category] || 'Install Risk';
    const isDoc = /missing (image|photo|view)|no photos|retake/i.test(notes) && !/camera|mount|loose|cable/i.test(notes);
    const finalCat = isDoc ? 'Documentation' : qcCategory;
    await entities.QCIssue.update(rec.id, mapIssueKeys({
      qc_category: finalCat,
      severity: finalCat === 'Functional Failure' ? 'critical' : finalCat === 'Installation Quality' ? 'high' : finalCat === 'Documentation' ? 'low' : 'medium',
      issue_weight: WEIGHTS[finalCat] ?? 1.0,
      is_documentation_only: isDoc,
    }));
    classified++;
    await sleep(50);
  }
  return { classified, scanned: allIssues.length, remaining: Math.max(0, records.length - classified) };
}

// Link issues to WarrantyProject records by work order name (creating as needed).
export async function backfillProjects({ batch_size = 30 } = {}) {
  const allIssues = await entities.QCIssue.list();
  const existingProjects = await entities.Project.list();
  const projectMap = {};
  for (const p of existingProjects) projectMap[(p.project_name || '').trim().toLowerCase()] = p;

  const unlinked = allIssues.filter((i) => !i.project_id && i.work_order_name).slice(0, batch_size);
  let created = 0, linked = 0, skipped = 0;

  for (const issue of unlinked) {
    const workOrder = (issue.work_order_name || '').trim();
    if (!workOrder) { skipped++; continue; }
    const key = workOrder.toLowerCase();
    let project = projectMap[key];
    if (!project) {
      project = await entities.Project.create({
        project_name: workOrder,
        customer: issue.customer || '',
        project_manager: issue.project_manager || '',
        active_status: 'active',
      });
      projectMap[key] = project;
      created++;
      await sleep(100);
    }
    await entities.QCIssue.update(issue.id, { project_id: project.id });
    linked++;
    await sleep(50);
  }
  const unlinkedRemaining = allIssues.filter((i) => !i.project_id && i.work_order_name).length - unlinked.length;
  return { created, linked, skipped, unlinked_remaining: Math.max(0, unlinkedRemaining) };
}

// Alias: only fill project_id/customer linkage, no creation beyond backfillProjects.
export async function backfillCustomerProject() {
  return backfillProjects({ batch_size: 500 });
}

// Derive qc_event_date / email_received_date where missing.
export async function backfillQCEventDate() {
  const issues = await entities.QCIssue.list();
  let updated = 0, skipped = 0;
  for (const issue of issues) {
    const emailReceivedDate = issue.email_received_date ||
      (issue.source_email_date ? new Date(issue.source_email_date).toISOString() : null) ||
      (issue.date_received ? new Date(issue.date_received).toISOString() : null);
    const qcEventDate = issue.install_service_date ||
      (emailReceivedDate ? emailReceivedDate.split('T')[0] : null) ||
      issue.date_received || null;
    if (!qcEventDate) { skipped++; continue; }
    const updateData = { qc_event_date: qcEventDate };
    if (!issue.email_received_date && emailReceivedDate) updateData.email_received_date = emailReceivedDate;
    await entities.QCIssue.update(issue.id, updateData);
    updated++;
    await sleep(50);
  }
  return { updated, skipped };
}

// Fix doubled field values ("IC CORPORATIONIC CORPORATION") and rebuild titles.
export function dedupeFieldValue(val) {
  if (!val || typeof val !== 'string' || val.length < 4) return val;
  const half = Math.floor(val.length / 2);
  if (val.length % 2 === 0 && val.slice(0, half) === val.slice(half)) return val.slice(0, half);
  for (let len = half; len >= 3; len--) {
    const prefix = val.slice(0, len);
    const idx = val.indexOf(prefix, 1);
    if (idx > 0 && idx <= len) return val.slice(0, idx + prefix.length - (len - idx));
  }
  return val;
}

export async function fixExistingWarrantyRecords({ dry_run = false } = {}) {
  const all = await entities.QCIssue.list('-created_date', 2000);
  let fixedFields = 0, fixedTitles = 0, markedDuplicates = 0;
  const seenKeys = new Map();

  for (const issue of all) {
    const updates = {};
    const DEDUP_FIELDS = ['asset_number', 'make', 'model', 'year', 'installed_vin', 'equip_vin', 'work_order_name', 'customer'];
    for (const field of DEDUP_FIELDS) {
      const val = issue[field];
      if (val) {
        const fixed = dedupeFieldValue(val);
        if (fixed !== val) { updates[field] = fixed; fixedFields++; }
      }
    }
    const techName = issue.technician_name || '';
    const assetNumber = updates.asset_number || issue.asset_number || '';
    const workOrder = updates.work_order_name || issue.work_order_name || '';
    const expectedTitle = assetNumber && techName
      ? `${assetNumber} - ${techName} - Warranty Return`
      : `Warranty Return - ${assetNumber || workOrder || 'Unknown'}`;
    if (issue.warranty_title !== expectedTitle && assetNumber) {
      updates.warranty_title = expectedTitle;
      fixedTitles++;
    }
    const dupeKey = [issue.asset_number, issue.install_service_date, (issue.work_order_name || '').toLowerCase()].filter(Boolean).join('|');
    if (dupeKey && seenKeys.has(dupeKey) && issue.status === 'pending_repair') {
      updates.duplicate_status = 'duplicate_suspected';
      markedDuplicates++;
    } else if (dupeKey) {
      seenKeys.set(dupeKey, issue.id);
    }
    if (!dry_run && Object.keys(updates).length > 0) {
      await entities.QCIssue.update(issue.id, updates);
      await sleep(30);
    }
  }
  return { fixed_fields: fixedFields, fixed_titles: fixedTitles, marked_duplicates: markedDuplicates, dry_run };
}

// Flag issues whose technician is a placeholder name.
export async function fixPlaceholderTechNames() {
  const issues = await entities.QCIssue.list();
  const flagged = [];
  for (const issue of issues) {
    if (issue.technician_name && isPlaceholderName(issue.technician_name)) {
      await entities.QCIssue.update(issue.id, {
        technician_id: '',
        technician_name: issue.technician_name,
        technician_profile_status: 'needs_review',
        parse_status: 'needs_review',
        parse_confidence: 'low',
      });
      flagged.push({ id: issue.id, name: issue.technician_name });
      await sleep(30);
    }
  }
  return { flagged: flagged.length, issues: flagged.slice(0, 50) };
}

// Mark old pending_repair issues as repaired (cutoff 2026-01-01, batch of 5).
export async function markOldWarrantiesRepaired({ skip = 0, cutoff = '2026-01-01' } = {}) {
  const raw = await entities.QCIssue.list('-created_date', 5);
  const issues = (skip > 0 ? raw.slice(skip) : raw).filter((i) =>
    i.status === 'pending_repair' && (i.qc_event_date || i.date_received || '') < cutoff);
  let updated = 0;
  for (const i of issues) {
    await entities.QCIssue.update(i.id, {
      status: 'repaired',
      date_repaired: new Date().toISOString().split('T')[0],
      data_status: 'legacy_review',
    });
    updated++;
    await sleep(30);
  }
  return { updated, scanned: raw.length };
}

// Recalculate stats for every technician.
export async function bulkRecalcTechStats() {
  const { recalcTechnicianStats } = await import('./warrantyService.js');
  const technicians = await entities.Technician.list();
  let updated = 0;
  const errors = [];
  for (const t of technicians) {
    if (t.technician_profile_status === 'merged') continue;
    try {
      await recalcTechnicianStats(t.id);
      updated++;
    } catch (e) {
      errors.push(`${t.full_name}: ${e.message}`);
    }
    await sleep(50);
  }
  return { updated, total: technicians.length, errors };
}
