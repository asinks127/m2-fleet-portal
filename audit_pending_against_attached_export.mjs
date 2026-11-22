import fs from 'node:fs/promises';
import path from 'node:path';

const [csvPath = '/home/.z/chat-uploads/Invoice_export (1)-f25da0e61dcf.csv', outputDir = '/home/workspace/M23FOR3-15/invoice-audit-pending-attached'] = process.argv.slice(2);

function loadEnv(text) {
  return Object.fromEntries(text.split(/\r?\n/).filter(line => line && !line.startsWith('#') && line.includes('=')).map(line => {
    const i = line.indexOf('=');
    return [line.slice(0, i), line.slice(i + 1).replace(/^['"]|['"]$/g, '')];
  }));
}

const env = loadEnv(await fs.readFile('.env.local', 'utf8'));
const base = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!base || !key) throw new Error('Missing Supabase environment variables');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  const headers = rows.shift() || [];
  return rows.filter(values => values.some(value => value !== '')).map(values => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ''])));
}

async function getAll(table) {
  const rows = [];
  for (let start = 0; ; start += 1000) {
    const response = await fetch(`${base}/rest/v1/${table}?select=*`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${start}-${start + 999}` },
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`${table} HTTP ${response.status}: ${body.slice(0, 500)}`);
    const page = JSON.parse(body);
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

const text = value => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim();
const lower = value => text(value).toLowerCase();
const nameKey = value => lower(value).replace(/[^a-z0-9]+/g, '');
const fileKey = value => nameKey(text(value).split(/[?#]/)[0].split('/').pop() || '');
const money = value => {
  const n = Number.parseFloat(text(value).replace(/[$,]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

function dateOnly(value) {
  const raw = text(value);
  if (!raw) return '';
  const iso = raw.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const us = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (us) return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  return '';
}

function dateKeys(row) {
  return [...new Set([dateOnly(row.weekEndingDate), dateOnly(row.week_ending_date), dateOnly(row.invoiceDate), dateOnly(row.invoice_date)].filter(Boolean))];
}

function contractor(row) {
  return lower(row.contractorEmail || row.contractor_email || row.email) || `name:${nameKey(row.contractorName || row.contractor_name || row.name)}`;
}

function summary(row) {
  return {
    id: row.id || '',
    contractorName: row.contractorName || row.contractor_name || row.name || '',
    contractorEmail: row.contractorEmail || row.contractor_email || row.email || '',
    businessName: row.businessName || row.business_name || '',
    fileName: row.fileName || row.file_name || row.filename || row.name || '',
    weekEndingDate: row.weekEndingDate || row.week_ending_date || '',
    invoiceDate: row.invoiceDate || row.invoice_date || '',
    totalAmount: row.totalAmount ?? row.total_amount ?? row.amount ?? '',
    status: row.status || '',
    pendingReason: row.pendingReason || row.pending_reason || '',
    approvedBy: row.approvedBy || row.approved_by || '',
    approvedDate: row.approvedDate || row.approved_date || '',
    driveFileId: row.driveFileId || row.drive_file_id || '',
    driveLink: row.driveLink || row.drive_link || '',
    createdAt: row.created_at || row.created_date || '',
  };
}

function exactIdentity(row) {
  const dates = dateKeys(row);
  const date = dates[0] || '';
  const file = fileKey(row.fileName || row.file_name || row.filename || row.name);
  return `${contractor(row)}|${date}|${money(row.totalAmount ?? row.total_amount ?? row.amount)}|${file}`;
}

function broadKey(row) {
  return `${contractor(row)}|${dateKeys(row).join('|')}|${money(row.totalAmount ?? row.total_amount ?? row.amount)}`;
}

function csvEscape(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

async function writeCsv(file, rows, headers) {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) lines.push(headers.map(header => csvEscape(row[header])).join(','));
  await fs.writeFile(file, `${lines.join('\n')}\n`);
}

const attached = parseCsv(await fs.readFile(csvPath, 'utf8'));
const current = await getAll('Invoice');
const attachedByDrive = new Map();
const attachedByExact = new Map();
const attachedByBroad = new Map();
for (const row of attached) {
  const drive = text(row.driveFileId || row.drive_file_id);
  if (drive) {
    if (!attachedByDrive.has(drive)) attachedByDrive.set(drive, []);
    attachedByDrive.get(drive).push(row);
  }
  const exact = exactIdentity(row);
  if (!attachedByExact.has(exact)) attachedByExact.set(exact, []);
  attachedByExact.get(exact).push(row);
  const broad = broadKey(row);
  if (!attachedByBroad.has(broad)) attachedByBroad.set(broad, []);
  attachedByBroad.get(broad).push(row);
}

function findMatches(row) {
  const drive = text(row.driveFileId || row.drive_file_id);
  if (drive && attachedByDrive.has(drive)) return { method: 'driveFileId', rows: attachedByDrive.get(drive) };
  const exact = attachedByExact.get(exactIdentity(row)) || [];
  if (exact.length) return { method: 'contractor-date-amount-file', rows: exact };
  const broad = attachedByBroad.get(broadKey(row)) || [];
  if (broad.length) return { method: 'contractor-date-amount', rows: broad };
  const c = contractor(row);
  const dates = new Set(dateKeys(row));
  const amount = money(row.totalAmount ?? row.total_amount ?? row.amount);
  const nearby = attached.filter(candidate => contractor(candidate) === c && money(candidate.totalAmount ?? candidate.total_amount ?? candidate.amount) === amount && dateKeys(candidate).some(d => [...dates].some(baseDate => Math.abs(Date.parse(`${d}T00:00:00Z`) - Date.parse(`${baseDate}T00:00:00Z`)) <= 86400000)));
  return { method: nearby.length ? 'contractor-date-plus-or-minus-one-day-amount' : 'none', rows: nearby };
}

const currentPending = current.filter(row => lower(row.status) === 'pending');
const pendingComparison = currentPending.map(row => {
  const match = findMatches(row);
  const statuses = [...new Set(match.rows.map(candidate => lower(candidate.status) || '(blank)'))];
  const classification = match.rows.length === 0
    ? 'not-in-attached-sheet'
    : match.rows.length > 1
      ? 'ambiguous-match'
      : statuses.includes('approved')
        ? 'attached-approved-match'
        : statuses.includes('rejected')
          ? 'attached-rejected-match'
          : statuses.includes('pending')
            ? 'attached-pending-match'
            : 'attached-other-status-match';
  const candidates = match.rows.map(candidate => summary(candidate));
  return {
    ...summary(row),
    classification,
    matchMethod: match.method,
    attachedMatchCount: match.rows.length,
    attachedStatuses: statuses.join('|'),
    attachedIds: candidates.map(candidate => candidate.id).join('|'),
    attachedFiles: candidates.map(candidate => candidate.fileName).join('|'),
    attachedDates: candidates.map(candidate => candidate.weekEndingDate || candidate.invoiceDate).join('|'),
    attachedAmounts: candidates.map(candidate => candidate.totalAmount).join('|'),
    attachedDriveFileIds: candidates.map(candidate => candidate.driveFileId).join('|'),
  };
});

const attachedPending = attached.filter(row => lower(row.status) === 'pending');
const attachedPendingComparison = attachedPending.map(row => {
  const match = findMatches(row);
  return {
    ...summary(row),
    currentMatchCount: match.rows.length,
    currentMatchMethod: match.method,
    currentMatchIds: match.rows.map(candidate => candidate.id).join('|'),
    currentMatchStatuses: match.rows.map(candidate => candidate.status || '').join('|'),
  };
});

const allCurrentSummary = current.map(row => {
  const match = findMatches(row);
  return { ...summary(row), attachedMatchCount: match.rows.length, attachedMatchMethod: match.method, attachedStatuses: [...new Set(match.rows.map(candidate => lower(candidate.status) || '(blank)'))].join('|') };
});

const countBy = (rows, key) => Object.fromEntries(Object.entries(Object.groupBy(rows, row => String(key(row) ?? '').trim().toLowerCase() || '(blank)')).map(([k, v]) => [k, v.length]));
const duplicateDriveIds = [...attachedByDrive.entries()].filter(([, rows]) => rows.length > 1).map(([driveFileId, rows]) => ({ driveFileId, rowCount: rows.length, statuses: rows.map(row => row.status).join('|'), ids: rows.map(row => row.id).join('|'), contractors: rows.map(row => row.contractorName || row.contractor_name || '').join('|'), files: rows.map(row => row.fileName || row.file_name || '').join('|') }));
const duplicateExact = [...attachedByExact.entries()].filter(([, rows]) => rows.length > 1).map(([identityKey, rows]) => ({ identityKey, rowCount: rows.length, statuses: rows.map(row => row.status).join('|'), ids: rows.map(row => row.id).join('|'), contractors: rows.map(row => row.contractorName || row.contractor_name || '').join('|'), files: rows.map(row => row.fileName || row.file_name || '').join('|'), dates: rows.map(row => row.weekEndingDate || row.invoiceDate || '').join('|'), amounts: rows.map(row => row.totalAmount || '').join('|') }));

const summaryOutput = {
  generatedAt: new Date().toISOString(),
  attachedCsv: csvPath,
  attachedRows: attached.length,
  currentInvoiceRows: current.length,
  attachedStatusCounts: countBy(attached, row => lower(row.status)),
  currentStatusCounts: countBy(current, row => lower(row.status)),
  currentPendingRows: currentPending.length,
  currentPendingClassifications: countBy(pendingComparison, row => row.classification),
  currentPendingMatchMethods: countBy(pendingComparison, row => row.matchMethod),
  attachedPendingRows: attachedPending.length,
  attachedPendingCurrentMatchCounts: countBy(attachedPendingComparison, row => row.currentMatchCount === 0 ? 'no-current-match' : row.currentMatchCount === 1 ? 'one-current-match' : 'multiple-current-matches'),
  currentRowsMatchedToAttached: allCurrentSummary.filter(row => row.attachedMatchCount > 0).length,
  currentRowsNotMatchedToAttached: allCurrentSummary.filter(row => row.attachedMatchCount === 0).length,
  duplicateDriveFileIdGroupsInAttached: duplicateDriveIds.length,
  duplicateExactIdentityGroupsInAttached: duplicateExact.length,
};

await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(path.join(outputDir, 'summary.json'), JSON.stringify(summaryOutput, null, 2));
await writeCsv(path.join(outputDir, 'current_pending_against_attached.csv'), pendingComparison, ['id', 'contractorName', 'contractorEmail', 'businessName', 'fileName', 'weekEndingDate', 'invoiceDate', 'totalAmount', 'status', 'pendingReason', 'driveFileId', 'classification', 'matchMethod', 'attachedMatchCount', 'attachedStatuses', 'attachedIds', 'attachedFiles', 'attachedDates', 'attachedAmounts', 'attachedDriveFileIds']);
await writeCsv(path.join(outputDir, 'attached_pending_against_current.csv'), attachedPendingComparison, ['id', 'contractorName', 'contractorEmail', 'businessName', 'fileName', 'weekEndingDate', 'invoiceDate', 'totalAmount', 'status', 'pendingReason', 'driveFileId', 'currentMatchCount', 'currentMatchMethod', 'currentMatchIds', 'currentMatchStatuses']);
await writeCsv(path.join(outputDir, 'all_current_against_attached.csv'), allCurrentSummary, ['id', 'contractorName', 'contractorEmail', 'businessName', 'fileName', 'weekEndingDate', 'invoiceDate', 'totalAmount', 'status', 'driveFileId', 'attachedMatchCount', 'attachedMatchMethod', 'attachedStatuses']);
await writeCsv(path.join(outputDir, 'duplicate_drive_file_ids_in_attached.csv'), duplicateDriveIds, ['driveFileId', 'rowCount', 'statuses', 'ids', 'contractors', 'files']);
await writeCsv(path.join(outputDir, 'duplicate_exact_identities_in_attached.csv'), duplicateExact, ['identityKey', 'rowCount', 'statuses', 'ids', 'contractors', 'files', 'dates', 'amounts']);
console.log(JSON.stringify(summaryOutput, null, 2));
console.log(`Output directory: ${outputDir}`);
