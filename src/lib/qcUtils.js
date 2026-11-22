/**
 * Shared QC utilities — single source of truth for parsing, matching, search, and classification.
 * Import from here across all pages and functions.
 */
import { subDays, subMonths, isAfter, parseISO } from 'date-fns';

// ─── Date range filtering ───────────────────────────────────────────────────

/**
 * TIME_FRAMES presets — use these everywhere so labels and ranges are consistent.
 */
export const TIME_FRAMES = [
  { label: '7 Days',    days: 7 },
  { label: '30 Days',   days: 30 },
  { label: '60 Days',   days: 60 },
  { label: '90 Days',   days: 90 },
  { label: '6 Months',  months: 6 },
  { label: '12 Months', months: 12 },
  { label: 'All Time',  all: true },
];

/**
 * Returns { cutoffDate, cutoffEnd } Date objects from a TIME_FRAMES preset or a custom range.
 * Pass timeFrame = one of TIME_FRAMES entries.
 * Pass customFrom / customTo as YYYY-MM-DD strings for custom range.
 */
export function resolveDateRange(timeFrame, customFrom = '', customTo = '') {
  const isCustom = !!(customFrom || customTo);
  let cutoffDate = null;
  let cutoffEnd  = null;
  if (isCustom) {
    if (customFrom) cutoffDate = parseISO(customFrom);
    if (customTo)   cutoffEnd  = parseISO(customTo);
  } else if (timeFrame && !timeFrame.all) {
    cutoffDate = timeFrame.months
      ? subMonths(new Date(), timeFrame.months)
      : subDays(new Date(), timeFrame.days);
  }
  return { cutoffDate, cutoffEnd };
}

/**
 * Filter an array of QCIssues to only those within the given date range.
 * Uses qc_event_date → date_received → email_received_date as the date source.
 */
export function filterIssuesByDateRange(issues, cutoffDate, cutoffEnd = null) {
  if (!cutoffDate && !cutoffEnd) return issues;
  return issues.filter(i => {
    const dateStr = i.qc_event_date || i.date_received || i.email_received_date;
    if (!dateStr) return true; // no date → always include
    const d = new Date(dateStr);
    if (cutoffDate && !isAfter(d, cutoffDate)) return false;
    if (cutoffEnd  && !isAfter(cutoffEnd, d))  return false;
    return true;
  });
}

// ─── Name normalization ────────────────────────────────────────────────────

export function normalizeName(name) {
  return (name || '').toLowerCase().replace(/[^a-z\s]/g, '').trim().replace(/\s+/g, ' ');
}

export const PLACEHOLDER_NAMES = new Set([
  'unknown', 'tbd', 'n/a', 'na', 'pending', 'not specified', '', 'technician',
  'tech', 'installer', 'employee', 'staff', 'contractor'
]);

export function isPlaceholderName(name) {
  return PLACEHOLDER_NAMES.has((name || '').trim().toLowerCase());
}

// ─── Data quality classification ────────────────────────────────────────────

/**
 * Canonical data quality status for a QCIssue record.
 * Returns: 'valid' | 'needs_review' | 'duplicate' | 'incomplete'
 *
 * Required fields for 'valid':
 *   - asset_number
 *   - technician_id OR technician_name (non-placeholder)
 *   - qc_event_date
 *   - issue_type
 */
export function computeDataQualityStatus(issue) {
  // Duplicate
  if (String(issue.duplicate_status || '').startsWith('duplicate_of_')) return 'duplicate';
  // Archived / legacy — exclude from metrics
  if (issue.data_status === 'archived' || issue.data_status === 'legacy_review') return 'needs_review';
  // Required fields
  const hasTech = !!(issue.technician_id || issue.technician_name);
  const techName = (issue.technician_name || '').trim().toLowerCase();
  const techIsPlaceholder = PLACEHOLDER_NAMES.has(techName);
  const missingRequired = !issue.asset_number || !hasTech || techIsPlaceholder || !issue.qc_event_date;
  if (missingRequired) return 'incomplete';
  // Soft quality flags
  if (issue.parse_status === 'needs_review' || issue.parse_status === 'duplicate_suspected') return 'needs_review';
  return 'valid';
}

/** List which required fields are missing for a given issue (for admin display) */
export function getMissingFields(issue) {
  const missing = [];
  if (!issue.asset_number) missing.push('asset_number');
  if (!issue.qc_event_date) missing.push('qc_event_date');
  const hasTech = !!(issue.technician_id || issue.technician_name);
  const techIsPlaceholder = PLACEHOLDER_NAMES.has((issue.technician_name || '').trim().toLowerCase());
  if (!hasTech || techIsPlaceholder) missing.push('technician');
  return missing;
}

// ─── Record validity ────────────────────────────────────────────────────────

export function isValidRecord(issue) {
  return computeDataQualityStatus(issue) === 'valid';
}

export function isScoreableRecord(issue) {
  return isValidRecord(issue) && issue.technician_profile_status !== 'duplicate_candidate';
}

// ─── Canonical predicates (single source of truth) ────────────────────────

/** A warranty issue: explicitly flagged as requiring a warranty return */
export function isWarrantyIssue(issue) {
  return issue.warranty_return_required === true;
}

/** A damage claim: claim_type=damage OR issue_type=damage_claim */
export function isDamageClaim(issue) {
  return issue.claim_type === 'damage' || issue.issue_type === 'damage_claim';
}

/**
 * An open issue: not yet resolved — not closed/repaired and repair not verified.
 * This is the single definition of "open" used everywhere.
 */
export function isOpenIssue(issue) {
  return (
    issue.status !== 'closed' &&
    issue.status !== 'repaired' &&
    issue.repair_status !== 'verified'
  );
}

/**
 * A closed/resolved issue: status is closed or repaired, or repair is verified.
 */
export function isClosedIssue(issue) {
  return (
    issue.status === 'closed' ||
    issue.status === 'repaired' ||
    issue.repair_status === 'verified'
  );
}

/**
 * An overdue issue: the backend-set overdue_flag is the canonical source.
 * Never use days_open > N directly — that would drift from the flag logic.
 */
export function isOverdueIssue(issue) {
  return issue.overdue_flag === true;
}

/** Active warranty = warranty + open (composed from canonical predicates) */
export function isActiveWarrantyIssue(issue) {
  return isWarrantyIssue(issue) && isOpenIssue(issue);
}

/**
 * Compute a standard metrics object from a list of valid QCIssues.
 * Use this everywhere instead of inline filter chains.
 */
export function computeMetrics(validIssues) {
  return {
    total:        validIssues.length,
    open:         validIssues.filter(isOpenIssue).length,
    closed:       validIssues.filter(isClosedIssue).length,
    warranty:     validIssues.filter(isWarrantyIssue).length,
    openWarranty: validIssues.filter(i => isWarrantyIssue(i) && isOpenIssue(i)).length,
    damage:       validIssues.filter(isDamageClaim).length,
    overdue:      validIssues.filter(isOverdueIssue).length,
  };
}

export function isAlertResolved(issue) {
  return (
    issue.status === 'closed' ||
    issue.qc_verified === true ||
    issue.repair_status === 'verified'
  );
}

/**
 * Returns only primary, active technicians sorted A–Z.
 * Use this everywhere technician dropdowns are rendered.
 * A technician is shown if:
 *  - is_primary is true OR is_primary is undefined (legacy records before the flag existed)
 *  - AND status is not 'inactive'
 *  - AND their full_name does not contain '[MERGED]'
 */
export function getPrimaryTechnicians(technicians) {
  return technicians
    .filter(t =>
      t.status !== 'inactive' &&
      t.is_active !== false &&
      t.technician_profile_status !== 'merged' &&
      !String(t.full_name || '').includes('[MERGED]') &&
      (t.is_primary === true || t.is_primary === undefined || t.is_primary === null)
    )
    .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
}

export function buildDataBreakdown(allIssues) {
  const total = allIssues.length;
  const legacy = allIssues.filter(i => i.data_status === 'legacy_review' || i.data_status === 'archived').length;
  const needsReview = allIssues.filter(i => i.parse_status === 'needs_review' && i.data_status !== 'legacy_review').length;
  const valid = allIssues.filter(isValidRecord).length;
  const damageClaims = allIssues.filter(i => i.claim_type === 'damage' || i.issue_type === 'damage_claim').length;
  return { total, valid, needsReview, legacy, damageClaims };
}

// ─── Issue classification ───────────────────────────────────────────────────

export function classifyIssueType(issue) {
  if (issue.issue_type) return issue.issue_type;
  if (issue.warranty_return_required) return 'warranty_return';
  if (issue.is_documentation_only) return 'documentation_issue';
  return 'qc_issue';
}

export function classifyClaimType(issue) {
  if (issue.claim_type) return issue.claim_type;
  if (issue.warranty_return_required) return 'warranty';
  return 'none';
}

export function computeNextAction(issue) {
  if (issue.next_action_needed) return issue.next_action_needed;
  if (issue.qc_verified || issue.repair_status === 'verified' || issue.status === 'closed') return 'Closed';
  if (issue.repair_status === 'reopened') return 'Reopened - Immediate Attention';
  if (!issue.repair_status || issue.repair_status === 'not_started') return 'Schedule Repair';
  if (issue.repair_status === 'scheduled') return 'Repair In Progress';
  if (issue.repair_status === 'in_progress') return 'Awaiting Completion';
  if (issue.repair_status === 'completed') return 'Awaiting QC Verification';
  return 'Schedule Repair';
}

// ─── Universal search ───────────────────────────────────────────────────────

/**
 * Returns true if the issue matches the search query.
 * Searches across all meaningful text fields.
 */
export function issueMatchesSearch(issue, query, projectMap = {}) {
  if (!query || !query.trim()) return true;
  const q = query.toLowerCase().trim();
  const fields = [
    issue.technician_name,
    issue.asset_number,
    issue.customer,
    issue.work_order_name,
    issue.case_number,
    issue.issue_summary_clean,
    issue.remote_qc_notes,
    issue.qc_notes,
    issue.qc_category,
    issue.claim_type,
    issue.issue_type,
    issue.assigned_repair_tech,
    issue.assigned_repair_technician_name,
    issue.assigned_scheduler,
    issue.scheduler,
    issue.severity,
    issue.status,
    issue.repair_status,
    projectMap[issue.project_id],
  ];
  return fields.some(f => f && String(f).toLowerCase().includes(q));
}

/**
 * Apply a standard set of filters to a list of QCIssues.
 * filters: { search, techId, projectId, claimType, issueType, status, repairStatus }
 */
export function applyQCFilters(issues, filters = {}, projectMap = {}) {
  let list = [...issues];
  if (filters.search) list = list.filter(i => issueMatchesSearch(i, filters.search, projectMap));
  if (filters.techId && filters.techId !== 'all') list = list.filter(i => i.technician_id === filters.techId);
  if (filters.projectId && filters.projectId !== 'all') list = list.filter(i => i.project_id === filters.projectId);
  if (filters.claimType && filters.claimType !== 'all') list = list.filter(i => (i.claim_type || 'none') === filters.claimType);
  if (filters.issueType && filters.issueType !== 'all') list = list.filter(i => (i.issue_type || 'warranty_return') === filters.issueType);
  if (filters.status && filters.status !== 'all') list = list.filter(i => i.status === filters.status);
  if (filters.repairStatus && filters.repairStatus !== 'all') list = list.filter(i => i.repair_status === filters.repairStatus);
  return list;
}