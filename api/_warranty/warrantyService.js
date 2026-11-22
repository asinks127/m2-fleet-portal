// Shared warranty/QC service layer (server-side, service role).
// Ported from the warranty app's base44 shared parser + entity access.
import { supabase } from '../../_lib/supabaseServer.js';
import { createWarrantyEntityProxy } from '../../shared/warrantyContract.js';

// Auto-create tables if missing (runs at module load, idempotent)
async function setupDatabase() {
  const tables = [`warranty_claims`, `technicians`, `qc_issues`, `projects`, `user_sessions`];
  for (const t of tables) {
    try {
      const { error: checkErr } = await supabase.from(t).select('id').limit(1);
      if (checkErr && checkErr.message.includes('does not exist') || (checkErr && checkErr.code === 'PGRST116')) {
        console.warn(`[warranty-setup] Table ${t} missing - run SQL migration to create`);
      }
    } catch(e) {}
  }
}

// Non-blocking setup check
setupDatabase().catch(e => console.warn('[warranty-setup]', e.message));


export const warrantySyncState = {
  last_run_at: null,
  last_mode: null,
  last_result: null,
  last_error: null,
  runs: 0,
};

// ─── Entity helpers (service role, mirrors the frontend entity proxy) ───────

export const entities = Object.fromEntries(
  ['QCIssue', 'Technician', 'WarrantyProject', 'WarrantyClaim', 'UserSession', 'ServiceCall'].map(
    (name) => [name, createWarrantyEntityProxy(supabase, name)]
  )
);
entities.Project = entities.WarrantyProject;

// ─── Parser helpers (ported from shared/warrantyEmailParser.ts) ─────────────

const PLACEHOLDER_NAMES = new Set(['john doe', 'john smith', 'jane doe', 'technician', 'unknown', 'not specified', 'pending', 'tbd', 'n/a', 'na']);

export function normalizeName(name) {
  return (name || '').toLowerCase().replace(/[^a-z\s]/g, '').trim().replace(/\s+/g, ' ');
}

export function isPlaceholderName(name) {
  if (!name) return true;
  const n = normalizeName(name);
  return PLACEHOLDER_NAMES.has(n) || n.length < 3;
}

export function formatDate(dateStr) {
  const match = dateStr?.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    const [, m, d, y] = match;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return '';
}

export function extractFromSubject(subject) {
  const result = { subject_asset_number: '', subject_vendor: '' };
  const colonMatch = subject.match(/:\s*(\d+)\s*-\s*([^|]+)/);
  if (colonMatch) {
    result.subject_asset_number = colonMatch[1].trim();
    result.subject_vendor = colonMatch[2].trim();
  }
  return result;
}

export function extractFromBody(text) {
  const result = {
    work_order_name: '', technician_name: '', asset_number: '', install_service_date: '',
    make: '', model: '', year: '', installed_vin: '', equip_vin: '',
    remote_qc_notes: '', post_install_notes: '', case_number: '', site_location: '', project_manager: '',
    asset_type: '',
  };

  const techMatch = text.match(/Greetings\s+([^,\n]+)/i);
  if (techMatch) result.technician_name = techMatch[1].trim();

  const woMatch = text.match(/Work Order Name:\s*([^\n]+)/i);
  if (woMatch) result.work_order_name = woMatch[1].trim();

  const assetMatch = text.match(/Asset Number:\s*(\S+)/i);
  if (assetMatch) result.asset_number = assetMatch[1].trim();

  const makeMatch = text.match(/Make:\s*([^\t\n]+)/i);
  if (makeMatch) result.make = makeMatch[1].trim();

  const installMatch = text.match(/Install\/Service Date:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
  if (installMatch) result.install_service_date = formatDate(installMatch[1]);

  const modelMatch = text.match(/Model:\s*([^\t\n]+)/i);
  if (modelMatch) result.model = modelMatch[1].trim();

  const installedVinMatch = text.match(/Installed VIN:\s*([^\t\n]+)/i);
  if (installedVinMatch) result.installed_vin = installedVinMatch[1].trim();

  const yearMatch = text.match(/Year:\s*(\d{4})/i);
  if (yearMatch) result.year = yearMatch[1].trim();

  const assetTypeMatch = text.match(/Asset Type:\s*(.*?)(?=\s*Equip VIN:|\n|$)/i);
  if (assetTypeMatch) result.asset_type = assetTypeMatch[1].trim();

  const equipVinMatch = text.match(/Equip VIN:[ \t]*([^\n\r]*)/i);
  if (equipVinMatch) result.equip_vin = equipVinMatch[1].trim();

  const qcMatch = text.match(/Remote QC Notes:\s*([\s\S]*?)(?=\nAsset Number:|\nPost Install Notes:|\nPlease coordinate|$)/i);
  if (qcMatch) result.remote_qc_notes = qcMatch[1].trim();

  const postMatch = text.match(/Post Install Notes:[ \t]*\r?\n?([\s\S]*?)(?=\n+Please coordinate|\n+Thanks|$)/i);
  if (postMatch) result.post_install_notes = postMatch[1].trim();

  const caseMatch = text.match(/Case Number:\s*(\S+)/i);
  if (caseMatch) result.case_number = caseMatch[1].trim();

  const siteMatch = text.match(/Site Location:\s*([^\n]+)/i);
  if (siteMatch) result.site_location = siteMatch[1].trim();

  const pmMatch = text.match(/Project Manager:\s*([^\n]+)/i);
  if (pmMatch) result.project_manager = pmMatch[1].trim();

  return result;
}

export function resolveFields(subjectData, bodyData) {
  let customer = '';
  if (bodyData.work_order_name && bodyData.work_order_name.includes(' - ')) {
    customer = bodyData.work_order_name.split(' - ')[0].trim();
  } else if (subjectData.subject_vendor) {
    customer = subjectData.subject_vendor;
  }
  return {
    customer,
    project: bodyData.work_order_name || '',
    assetNumber: bodyData.asset_number || subjectData.subject_asset_number || '',
    installDate: bodyData.install_service_date || '',
    technician: bodyData.technician_name || '',
  };
}

export function detectCategory(notes) {
  const n = (notes || '').toLowerCase();
  if (n.includes('camera')) return 'camera_positioning';
  if (n.includes('mirror')) return 'mirror_adjustment';
  if (n.includes('mount')) return 'mounting';
  if (n.includes('connection') || n.includes('bugged')) return 'connection_issue';
  if (n.includes('missing') || n.includes('not on vehicle')) return 'equipment_missing';
  return 'installation_quality';
}

export function getISOWeek(date) {
  const d = new Date(date);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function generateDedupeKey(customer, assetNumber, installDate, techName) {
  const validFields = [
    (customer || '').toLowerCase().trim(),
    (assetNumber || '').toLowerCase().trim(),
    (installDate || '').trim(),
    (techName || '').toLowerCase().trim(),
  ].filter(Boolean);
  if (validFields.length < 2) return null;
  return validFields.join('|');
}

export async function findOrCreateTechnician(name, technicians) {
  if (!name || !name.trim() || isPlaceholderName(name)) return { id: '', full_name: '', inactive: false };
  const normalized = normalizeName(name);
  const matchers = [
    (t) => t.full_name === name,
    (t) => t.full_name?.toLowerCase() === name.toLowerCase(),
    (t) => normalizeName(t.full_name) === normalized || t.normalized_name === normalized,
    (t) => t.nickname && normalizeName(t.nickname) === normalized,
  ];
  for (const matcher of matchers) {
    const match = technicians.find(matcher);
    if (match) {
      const inactive = match.status === 'inactive' || match.is_active === false;
      return { id: inactive ? '' : match.id, full_name: match.full_name, inactive };
    }
  }
  const parts = normalized.split(' ');
  const partialMatch = technicians.find(t => {
    const tNorm = normalizeName(t.full_name);
    return parts.some(p => p.length > 2 && tNorm.includes(p));
  });
  if (partialMatch) {
    const inactive = partialMatch.status === 'inactive' || partialMatch.is_active === false;
    return { id: inactive ? '' : partialMatch.id, full_name: partialMatch.full_name, inactive };
  }
  const newTech = await entities.Technician.create({
    full_name: name, normalized_name: normalized, phone: 'TBD', status: 'active',
  });
  technicians.push(newTech);
  return { id: newTech.id, full_name: newTech.full_name, inactive: false };
}

export async function findOrCreateProject(projectName, projects) {
  if (!projectName || !projectName.trim()) return null;
  const key = projectName.trim().toLowerCase();
  let project = projects.find(p => (p.project_name || '').trim().toLowerCase() === key);
  if (project) return project.id;
  project = await entities.Project.create({
    project_name: projectName.trim(), active_status: 'active',
  });
  projects.push(project);
  return project.id;
}

/** Parse a warranty email message and create QCIssue + WarrantyClaim records. */
export async function parseAndCreateIssue(message, technicians, projects) {
  const subject = message.subject || '';
  const fromHeader = message.from || '';
  const dateHeader = message.date || '';
  const emailText = message.text || '';

  const subjectData = extractFromSubject(subject);
  const bodyData = extractFromBody(emailText);
  const resolved = resolveFields(subjectData, bodyData);

  if (!resolved.customer && !resolved.assetNumber && !resolved.project) {
    return { created: false, reason: 'no_fields' };
  }

  const existing = await entities.QCIssue.filter({ source_message_id: message.id });
  if (existing.length > 0) return { created: false, reason: 'already_exists' };

  const email_received_date = dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString();
  const dedupeKey = generateDedupeKey(resolved.customer, resolved.assetNumber, resolved.installDate, resolved.technician);

  if (dedupeKey) {
    const existingDupes = await entities.QCIssue.filter({ dedupe_key: dedupeKey });
    if (existingDupes.length > 0) return { created: false, reason: 'dedupe_key' };
  }

  const techResult = await findOrCreateTechnician(resolved.technician, technicians);
  if (techResult.inactive) return { created: false, reason: 'inactive_tech' };
  const project_id = await findOrCreateProject(resolved.project, projects) || '';

  const issueDate = new Date(resolved.installDate || email_received_date);
  const issue_week = getISOWeek(issueDate);
  const issue_month = `${issueDate.getFullYear()}-${String(issueDate.getMonth() + 1).padStart(2, '0')}`;
  const issue_year = issueDate.getFullYear();

  const issueRecord = {
    warranty_title: resolved.assetNumber && techResult.full_name
      ? `${resolved.assetNumber} - ${techResult.full_name} - Warranty Return`
      : `Warranty Return - ${resolved.assetNumber || resolved.project || 'Unknown'}`,
    technician_id: techResult.id, technician_name: techResult.full_name,
    technician_normalized_name: normalizeName(techResult.full_name),
    customer: resolved.customer, work_order_name: resolved.project,
    site_location: bodyData.site_location, project_manager: bodyData.project_manager, project_id,
    email_received_date, qc_event_date: resolved.installDate || email_received_date.split('T')[0],
    date_received: resolved.installDate || email_received_date.split('T')[0],
    qc_notes: bodyData.remote_qc_notes || subject, asset_number: resolved.assetNumber,
    make: bodyData.make, model: bodyData.model, year: bodyData.year,
    installed_vin: bodyData.installed_vin, equip_vin: bodyData.equip_vin,
    post_install_notes: bodyData.post_install_notes, case_number: bodyData.case_number,
    issue_summary_clean: bodyData.remote_qc_notes || subject,
    severity: 'medium', status: 'pending_repair',
    issue_source: 'gmail_backfill', warranty_return_required: true,
    auto_category: detectCategory(bodyData.remote_qc_notes),
    issue_week, issue_month, issue_year, days_open: 0, overdue_flag: false, repeat_issue: false,
    source_email_subject: subject, source_email_from: fromHeader, source_email_date: dateHeader,
    source_message_id: message.id, source_thread_id: message.threadId || '',
    raw_email_body: emailText.slice(0, 5000),
    parse_status: (!techResult.id || !resolved.customer) ? 'needs_review' : 'ok',
    parse_confidence: (!techResult.id || !resolved.customer) ? 'low' : 'medium',
    dedupe_key: dedupeKey, duplicate_status: dedupeKey ? 'checked' : 'insufficient_data',
    communication_history: '[]',
  };
  if (resolved.installDate) issueRecord.install_service_date = resolved.installDate;
  const qcIssue = await entities.QCIssue.create(issueRecord);

  await entities.WarrantyClaim.create({
    claim_number: `WC-${String(message.id).substring(0, 8).toUpperCase()}`,
    customer_name: resolved.customer || 'Unknown',
    product_description: `${resolved.assetNumber || ''} - ${bodyData.make || ''} ${bodyData.model || ''}`.trim(),
    issue_description: bodyData.remote_qc_notes || subject,
    technician_name: techResult.full_name,
    claim_date: resolved.installDate || email_received_date.split('T')[0],
    status: 'pending', return_required: true,
  });

  return { created: true, qc_issue_id: qcIssue.id, title: issueRecord.warranty_title };
}

/** Log a reply email into an existing issue's communication history. */
export async function logCommunication(existingIssue, subject, from, date, body) {
  const entry = { date: date || new Date().toISOString(), from, subject, body: body.slice(0, 1000) };
  let history = [];
  try { history = JSON.parse(existingIssue.communication_history || '[]'); } catch {}
  history.push(entry);
  await entities.QCIssue.update(existingIssue.id, { communication_history: JSON.stringify(history) });
}

export function detectStatusUpdate(body) {
  const b = body.toLowerCase();
  if (b.includes('repaired') || b.includes('repair complete') || b.includes('has been repaired')) return 'repaired';
  if (b.includes('approved') || b.includes('approval complete')) return 'repaired';
  if (b.includes('image review complete') || b.includes('images approved')) return 'repaired';
  if (b.includes('closed') || b.includes('issue closed')) return 'closed';
  return null;
}

// ─── Rollups ────────────────────────────────────────────────────────────────

export async function recalcTechnicianStats(technician_id) {
  const allIssues = await entities.QCIssue.filter({ technician_id });
  const issues = allIssues.filter(i =>
    i.parse_status !== 'needs_review' &&
    i.data_status !== 'legacy_review' &&
    i.data_status !== 'archived' &&
    !!i.customer && !!i.work_order_name && !!i.technician_id && !!i.asset_number && !!i.install_service_date
  );

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const qc_issue_count_total = issues.length;
  const qc_issue_count_30d = issues.filter(i => {
    const d = i.qc_event_date || i.date_received || (i.created_at || '').split('T')[0];
    return d >= thirtyDaysAgo;
  }).length;

  const open_qc_issue_count = issues.filter(i => i.status !== 'closed' && i.status !== 'repaired').length;
  const closed_qc_issue_count = issues.filter(i => i.status === 'closed' || i.status === 'repaired').length;

  const warranty_issues = issues.filter(i => i.warranty_return_required);
  const warranty_return_count_total = warranty_issues.length;
  const warranty_verified_count = warranty_issues.filter(i => i.repair_status === 'verified').length;
  const warranty_reopened_count = warranty_issues.filter(i => (i.reopen_count || 0) > 0).length;

  const repair_success_rate = warranty_return_count_total > 0
    ? Math.round((warranty_verified_count / warranty_return_count_total) * 100) : 0;
  const reopen_rate = warranty_return_count_total > 0
    ? Math.round((warranty_reopened_count / warranty_return_count_total) * 100) : 0;

  const repeat_issue_count = issues.filter(i => i.repeat_issue).length;

  const categories = {};
  issues.forEach(i => {
    const cat = i.final_category || i.auto_category || 'other';
    categories[cat] = (categories[cat] || 0) + 1;
  });
  const most_common_issue_category = Object.keys(categories).length > 0
    ? Object.keys(categories).reduce((a, b) => categories[a] > categories[b] ? a : b) : '';

  const last_qc_issue_date = issues.length > 0
    ? issues.reduce((latest, i) => {
        const d = i.qc_event_date || i.date_received || '0000-00-00';
        return d > latest ? d : latest;
      }, '0000-00-00') : '';

  const warranty_issues_sorted = [...warranty_issues].sort((a, b) => {
    const da = a.repair_completed_date || a.qc_event_date || '0000-00-00';
    const db = b.repair_completed_date || b.qc_event_date || '0000-00-00';
    return db.localeCompare(da);
  });

  const last_warranty_return_date = warranty_issues_sorted.length > 0
    ? warranty_issues_sorted[0].repair_completed_date || warranty_issues_sorted[0].qc_event_date || '' : '';
  const verifiedList = warranty_issues_sorted.filter(i => i.repair_status === 'verified');
  const last_verified_warranty_date = verifiedList.length > 0
    ? verifiedList[0].repair_verification_date || '' : '';

  const qc_score = warranty_return_count_total > 0
    ? Math.round((warranty_verified_count / warranty_return_count_total) * 100) : 100;
  const repeat_issue_flag = repeat_issue_count > 0;
  const avg_days_to_close = issues.length > 0
    ? Math.round(issues.reduce((sum, i) => sum + (i.days_open || 0), 0) / issues.length) : 0;

  await entities.Technician.update(technician_id, {
    qc_issue_count_total, qc_issue_count_30d, open_qc_issue_count, closed_qc_issue_count,
    warranty_return_count_total, warranty_verified_count, warranty_reopened_count,
    repair_success_rate, reopen_rate, repeat_issue_count,
    last_qc_issue_date, last_warranty_return_date, last_verified_warranty_date,
    qc_score, repeat_issue_flag, most_common_issue_category, avg_days_to_close,
  });

  return { qc_issue_count_total, warranty_return_count_total, qc_score };
}

export async function recalcProjectRollups(project_id) {
  const projectIssues = await entities.QCIssue.filter({ project_id });
  const pTotal = projectIssues.length;
  const pOpen = projectIssues.filter(i => i.status !== 'closed').length;
  const pVerified = projectIssues.filter(i => i.qc_verified).length;
  const pReopened = projectIssues.filter(i => (i.reopen_count || 0) > 0).length;
  const pClosed = projectIssues.filter(i => i.date_closed && (i.date_received || i.created_at));
  let avgDays = null;
  if (pClosed.length > 0) {
    const totalDays = pClosed.reduce((s, i) =>
      s + Math.max(0, (new Date(i.date_closed) - new Date(i.date_received || i.created_at)) / 86400000), 0);
    avgDays = Math.round(totalDays / pClosed.length);
  }
  const cats = {};
  for (const i of projectIssues) {
    const c = i.final_category || i.auto_category || i.issue_category || 'other';
    cats[c] = (cats[c] || 0) + 1;
  }
  const topCat = Object.entries(cats).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const lastDate = projectIssues.filter(i => i.date_received)
    .sort((a, b) => (b.date_received || '').localeCompare(a.date_received || ''))[0]?.date_received || null;

  await entities.Project.update(project_id, {
    total_warranty_returns: pTotal, open_warranty_returns: pOpen,
    verified_warranty_returns: pVerified, reopened_warranty_returns: pReopened,
    avg_days_to_close: avgDays, most_common_issue_category: topCat, last_warranty_return_date: lastDate,
  });
}

// ─── Gmail ingestion (IMAP — scheduling@m2fleetcom.com) ─────────────────────

const REQUIRED_BODY_MARKERS = [
  'While reviewing your service we have found the following issue:',
  'Remote QC Notes:',
  'Asset Number:',
  'Install/Service Date:',
  'Work Order Name:',
  'Please coordinate with your Scheduler or Project Manager for repair.',
];

function isOriginalWarrantyEmail(subject, body) {
  if (!subject.includes('Warranty Return Required:')) return false;
  for (const marker of REQUIRED_BODY_MARKERS) {
    if (!body.includes(marker)) return false;
  }
  return true;
}

function isReplyOrForward(subject) {
  const s = subject.trim().toLowerCase();
  return s.startsWith('re:') || s.startsWith('fw:') || s.startsWith('fwd:');
}

async function findExistingWarranty(threadId, assetNumber, installDate, workOrderName, techName, subject) {
  if (threadId) {
    const byThread = await entities.QCIssue.filter({ source_thread_id: threadId });
    if (byThread.length > 0) return byThread[0];
  }
  if (assetNumber && installDate && workOrderName) {
    const byAsset = await entities.QCIssue.filter({ asset_number: assetNumber });
    const match = byAsset.find(
      i => i.install_service_date === installDate &&
        (i.work_order_name || '').trim().toLowerCase() === workOrderName.trim().toLowerCase()
    );
    if (match) return match;
  }
  if (assetNumber && techName) {
    const byAsset = await entities.QCIssue.filter({ asset_number: assetNumber });
    const subjectKeyword = subject.replace(/Warranty Return Required:\s*/i, '').split(' - ')[0].trim();
    const match = byAsset.find(
      i => (i.technician_name || '').toLowerCase() === techName.toLowerCase() &&
        (i.source_email_subject || '').includes(subjectKeyword)
    );
    if (match) return match;
  }
  return null;
}

/**
 * Sync warranty emails from the mailbox via IMAP.
 * mode: 'sync' (since last sync / last 2 days) or 'backfill' (custom range).
 */
export async function syncWarrantyEmails({ mode = 'sync', start_date, end_date, max = 50 } = {}) {
  const user = process.env.GMAIL_WARRANTY_USER;
  const pass = process.env.GMAIL_WARRANTY_APP_PASSWORD;
  if (!user || !pass) {
    return {
      configured: false,
      message: 'Gmail not configured. Add GMAIL_WARRANTY_USER and GMAIL_WARRANTY_APP_PASSWORD secrets (an App Password for scheduling@m2fleetcom.com), then re-run.',
    };
  }

  const { ImapFlow } = await import('imapflow');
  const { simpleParser } = await import('mailparser');

  const client = new ImapFlow({
    host: 'imap.gmail.com', port: 993, secure: true,
    auth: { user, pass },
    logger: false,
  });

  let sinceDate;
  if (mode === 'backfill' && start_date) {
    sinceDate = new Date(start_date);
  } else {
    // Incremental: look back 2 days (dedupe prevents duplicates)
    sinceDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  }
  const sinceStr = sinceDate.toISOString().split('T')[0].replace(/-/g, '');

  const stats = { configured: true, found: 0, created: 0, replies_logged: 0, skipped: 0, status_updated: 0, errors: [] };
  warrantySyncState.last_run_at = new Date().toISOString();
  warrantySyncState.last_mode = mode;

  await client.connect();
  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      const searchQuery = { since: sinceDate };
      const uids = await client.search(searchQuery, { uid: true });
      const limitedUids = (uids || []).slice(-max);

      const technicians = await entities.Technician.list();
      const projects = await entities.Project.list();
      stats.found = limitedUids.length;

      for (const uid of limitedUids) {
        try {
          const msg = await client.fetchOne(uid, { uid: true, source: true, envelope: true }, { uid: true });
          if (!msg) { stats.skipped++; continue; }
          const parsed = await simpleParser(msg.source);
          const subject = parsed.subject || '';
          const from = (parsed.from?.text || '').slice(0, 200);
          const date = parsed.date ? parsed.date.toISOString() : new Date().toISOString();
          const text = parsed.text || (parsed.html ? parsed.html.replace(/<[^>]+>/g, ' ') : '');
          const messageId = (parsed.messageId || `imap-${uid}`).slice(0, 200);
          const threadId = (parsed.headers.get('in-reply-to') || parsed.messageId || `imap-thread-${uid}`).slice(0, 200);

          // Reply / forward → thread into existing warranty
          if (isReplyOrForward(subject)) {
            const subjectData = extractFromSubject(subject);
            const bodyData = extractFromBody(text);
            const resolved = resolveFields(subjectData, bodyData);
            const existing = await findExistingWarranty(threadId, resolved.assetNumber, resolved.installDate, resolved.project, resolved.technician, subject);
            if (existing) {
              await logCommunication(existing, subject, from, date, text);
              stats.replies_logged++;
              const newStatus = detectStatusUpdate(text);
              if (newStatus) {
                const updates = { status: newStatus };
                if (newStatus === 'repaired') updates.date_repaired = new Date().toISOString().split('T')[0];
                await entities.QCIssue.update(existing.id, updates);
                stats.status_updated++;
              }
            } else {
              stats.skipped++;
            }
            continue;
          }

          if (!isOriginalWarrantyEmail(subject, text)) { stats.skipped++; continue; }

          const result = await parseAndCreateIssue(
            { id: messageId, threadId, subject, from, date, text },
            technicians, projects
          );
          if (result.created) stats.created++;
          else stats.skipped++;

          await new Promise(r => setTimeout(r, 200));
        } catch (e) {
          stats.errors.push(`uid ${uid}: ${e.message}`);
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }

  warrantySyncState.last_result = stats;
  warrantySyncState.last_error = stats.errors.length ? stats.errors.join('; ') : null;
  warrantySyncState.runs += 1;
  return stats;
}

// ─── Internal polling loop ───────────────────────────────────────────────────
// Runs syncWarrantyEmails every 15 minutes when Gmail credentials are present.

export async function startWarrantySyncLoop() {
  const hasCreds = Boolean(process.env.GMAIL_WARRANTY_USER && process.env.GMAIL_WARRANTY_APP_PASSWORD);
  if (!hasCreds) {
    console.log('[warranty-sync] Gmail creds not set — sync loop idle (manual runs still possible via /api/warrantySync once configured)');
    return;
  }
  console.log('[warranty-sync] loop active: polling scheduling inbox every 15 min');
  const run = async () => {
    if (warrantySyncState.is_running) return;
    warrantySyncState.is_running = true;
    try {
      const result = await syncWarrantyEmails({ mode: 'sync', max: 100 });
      warrantySyncState.last_run = new Date().toISOString();
      warrantySyncState.last_result = result;
      console.log('[warranty-sync]', JSON.stringify(result));
    } catch (e) {
      warrantySyncState.last_run = new Date().toISOString();
      warrantySyncState.last_result = { error: e?.message };
      console.error('[warranty-sync] failed:', e?.message);
    } finally {
      warrantySyncState.is_running = false;
    }
  };
  setTimeout(run, 60 * 1000);        // first run 1 min after boot
  setInterval(run, 15 * 60 * 1000);  // then every 15 min
}
