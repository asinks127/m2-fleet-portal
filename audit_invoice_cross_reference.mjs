import fs from 'node:fs/promises';
import path from 'node:path';

const [csvPath = '/home/.z/chat-uploads/Invoice_export-1923035cedd7.csv', outputDir = '/home/workspace/M23FOR3-15/invoice-audit-final'] = process.argv.slice(2);
const envText = await fs.readFile('.env.local', 'utf8');
const env = Object.fromEntries(envText.split(/\r?\n/).filter(line => line && !line.startsWith('#')).map(line => {
  const index = line.indexOf('=');
  return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, '')];
}));
const base = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!base || !key) throw new Error('Missing Supabase environment variables');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const character = text[i];
    if (quoted) {
      if (character === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(cell);
      cell = '';
    } else if (character === '\n') {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ''));
    rows.push(row);
  }
  const headers = rows.shift() || [];
  return rows.filter(values => values.some(Boolean)).map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

async function getAll(table) {
  const records = [];
  for (let start = 0; ; start += 1000) {
    const response = await fetch(`${base}/rest/v1/${table}?select=*`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${start}-${start + 999}` },
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`${table} HTTP ${response.status}: ${body.slice(0, 500)}`);
    const page = JSON.parse(body);
    records.push(...page);
    if (page.length < 1000) return records;
  }
}

function text(value) {
  return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function dateOnly(value) {
  const raw = text(value);
  if (!raw) return '';
  const iso = raw.match(/(\d{4}-\d{1,2}-\d{1,2})/);
  if (iso) return iso[1].replace(/-(\d)(?=-|$)/g, '-0$1');
  const us = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (us) return `${us[3]}-${String(us[1]).padStart(2, '0')}-${String(us[2]).padStart(2, '0')}`;
  return raw.slice(0, 10);
}

function money(value) {
  const parsed = Number.parseFloat(text(value).replace(/[$,]/g, ''));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function fileKey(value) {
  const raw = text(value).split(/[?#]/)[0].split('/').pop() || '';
  return lower(raw).replace(/[^a-z0-9]+/g, '');
}

function contractorKey(row) {
  const email = lower(row.contractorEmail || row.email);
  if (email) return `email:${email}`;
  const name = lower(row.contractorName || row.name).replace(/[^a-z0-9]+/g, '');
  return name ? `name:${name}` : '';
}

function dateKey(row) {
  return dateOnly(row.weekEndingDate) || dateOnly(row.invoiceDate) || dateOnly(row.invoice_date);
}

function identityKey(row) {
  const contractor = contractorKey(row);
  const file = fileKey(row.fileName || row.filename || row.name);
  const date = dateKey(row);
  const amount = money(row.totalAmount || row.amount);
  if (!contractor || !file || !date) return '';
  return `${contractor}|${file}|${date}|${amount}`;
}

function csvEscape(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

async function writeCsv(file, rows, headers) {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) lines.push(headers.map(header => csvEscape(row[header])).join(','));
  await fs.writeFile(file, `${lines.join('\n')}\n`);
}

function summaryRow(row) {
  return {
    id: row.id || '',
    contractorName: row.contractorName || row.name || '',
    contractorEmail: row.contractorEmail || row.email || '',
    fileName: row.fileName || row.filename || row.name || '',
    weekEndingDate: row.weekEndingDate || '',
    invoiceDate: row.invoiceDate || row.invoice_date || '',
    totalAmount: row.totalAmount ?? row.amount ?? '',
    status: row.status || '',
    approvedDate: row.approvedDate || '',
    approvedBy: row.approvedBy || '',
    driveFileId: row.driveFileId || '',
    driveLink: row.driveLink || '',
    pendingReason: row.pendingReason || '',
    identityKey: identityKey(row),
  };
}

const [historicalRows, currentRows] = await Promise.all([
  parseCsv(await fs.readFile(csvPath, 'utf8')),
  getAll('Invoice'),
]);

const historicalByIdentity = new Map();
const currentByIdentity = new Map();
for (const row of historicalRows) {
  const identity = identityKey(row);
  if (!identity) continue;
  if (!historicalByIdentity.has(identity)) historicalByIdentity.set(identity, []);
  historicalByIdentity.get(identity).push(row);
}
for (const row of currentRows) {
  const identity = identityKey(row);
  if (!identity) continue;
  if (!currentByIdentity.has(identity)) currentByIdentity.set(identity, []);
  currentByIdentity.get(identity).push(row);
}

const historicalToCurrent = [];
const missingFromCurrent = [];
const ambiguousHistorical = [];
const matchedCurrentIds = new Set();
const statusDifferences = [];
const pendingApprovalCandidates = [];

for (const historical of historicalRows) {
  const identity = identityKey(historical);
  const matches = identity ? (currentByIdentity.get(identity) || []) : [];
  if (matches.length === 0) {
    missingFromCurrent.push({ ...summaryRow(historical), historicalStatus: historical.status || '' });
    continue;
  }
  if (matches.length > 1) {
    ambiguousHistorical.push({
      ...summaryRow(historical),
      currentMatchCount: matches.length,
      currentIds: matches.map(row => row.id).join('|'),
      currentStatuses: matches.map(row => row.status || '').join('|'),
    });
    continue;
  }
  const current = matches[0];
  matchedCurrentIds.add(current.id);
  const historicalStatus = lower(historical.status);
  const currentStatus = lower(current.status);
  const row = {
    ...summaryRow(historical),
    historicalStatus: historical.status || '',
    historicalApprovedDate: historical.approvedDate || '',
    historicalApprovedBy: historical.approvedBy || '',
    currentId: current.id || '',
    currentStatus: current.status || '',
    currentCreatedAt: current.created_at || '',
    currentDriveFileId: current.driveFileId || '',
    currentDriveLink: current.driveLink || '',
    statusChanged: historicalStatus !== currentStatus,
  };
  historicalToCurrent.push(row);
  if (historicalStatus !== currentStatus) statusDifferences.push(row);
  if (historicalStatus === 'approved' && currentStatus === 'pending') pendingApprovalCandidates.push({
    ...row,
    decision: 'review-only',
    reason: 'Historical record is approved, but current identity match must still be checked for duplicate records and current app Drive reference.',
  });
}

const currentNotInHistorical = currentRows.filter(row => !matchedCurrentIds.has(row.id)).map(summaryRow);
const currentPending = currentRows.filter(row => lower(row.status) === 'pending');
const currentPendingIdentityGroups = new Map();
for (const row of currentPending) {
  const identity = identityKey(row);
  if (!identity) continue;
  if (!currentPendingIdentityGroups.has(identity)) currentPendingIdentityGroups.set(identity, []);
  currentPendingIdentityGroups.get(identity).push(row);
}
const pendingDuplicateGroups = [...currentPendingIdentityGroups.entries()]
  .filter(([, rows]) => rows.length > 1)
  .map(([identity, rows]) => ({
    identityKey: identity,
    duplicateCount: rows.length,
    currentIds: rows.map(row => row.id).join('|'),
    contractor: rows[0].contractorName || '',
    email: rows[0].contractorEmail || '',
    file: rows[0].fileName || '',
    weekEnding: rows[0].weekEndingDate || '',
    amount: rows[0].totalAmount ?? '',
  }));

const driveReferenceAudit = currentRows.map(row => {
  const hasDriveId = Boolean(text(row.driveFileId));
  const hasDriveLink = Boolean(text(row.driveLink));
  const approved = lower(row.status) === 'approved';
  return {
    ...summaryRow(row),
    hasDriveFileId: hasDriveId,
    hasDriveLink,
    classification: approved && hasDriveId && hasDriveLink
      ? 'approved-and-recorded-in-app-drive'
      : approved && !hasDriveId && !hasDriveLink
        ? 'approved-missing-app-drive-reference'
        : approved
          ? 'approved-partial-app-drive-reference'
          : !hasDriveId && !hasDriveLink
            ? 'non-approved-no-app-drive-reference'
            : 'non-approved-has-app-drive-reference',
  };
});

const historicalStatusCounts = Object.groupBy(historicalRows, row => lower(row.status) || '(blank)');
const currentStatusCounts = Object.groupBy(currentRows, row => lower(row.status) || '(blank)');
const summary = {
  generatedAt: new Date().toISOString(),
  csvPath,
  matchingMethod: 'contractor email or name + normalized filename + week ending/invoice date + amount; database IDs are not used because IDs were regenerated during migration',
  driveScope: 'app Invoice records and their stored driveFileId/driveLink references; no external Google Drive search was used',
  historicalRows: historicalRows.length,
  currentRows: currentRows.length,
  historicalRowsWithIdentityKey: historicalRows.filter(row => identityKey(row)).length,
  currentRowsWithIdentityKey: currentRows.filter(row => identityKey(row)).length,
  uniqueHistoricalIdentityKeys: historicalByIdentity.size,
  uniqueCurrentIdentityKeys: currentByIdentity.size,
  uniqueIdentityMatches: historicalToCurrent.length,
  missingFromCurrentByIdentity: missingFromCurrent.length,
  ambiguousHistoricalMatches: ambiguousHistorical.length,
  currentNotInHistoricalByIdentity: currentNotInHistorical.length,
  fieldStatusDifferences: statusDifferences.length,
  historicalApprovedCurrentPendingMatches: pendingApprovalCandidates.length,
  currentPendingInvoices: currentPending.length,
  currentPendingDuplicateGroups: pendingDuplicateGroups.length,
  currentInvoicesWithAnyAppDriveReference: driveReferenceAudit.filter(row => row.hasDriveFileId || row.hasDriveLink).length,
  currentInvoicesWithCompleteAppDriveReference: driveReferenceAudit.filter(row => row.hasDriveFileId && row.hasDriveLink).length,
  approvedInvoicesWithCompleteAppDriveReference: driveReferenceAudit.filter(row => row.classification === 'approved-and-recorded-in-app-drive').length,
  statusCountsHistorical: Object.fromEntries(Object.entries(historicalStatusCounts).map(([status, rows]) => [status, rows.length])),
  statusCountsCurrent: Object.fromEntries(Object.entries(currentStatusCounts).map(([status, rows]) => [status, rows.length])),
};

await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(path.join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2));
await writeCsv(path.join(outputDir, 'historical_to_current_identity_matches.csv'), historicalToCurrent, ['id', 'contractorName', 'contractorEmail', 'fileName', 'weekEndingDate', 'invoiceDate', 'totalAmount', 'historicalStatus', 'historicalApprovedDate', 'historicalApprovedBy', 'currentId', 'currentStatus', 'currentCreatedAt', 'currentDriveFileId', 'currentDriveLink', 'statusChanged', 'identityKey']);
await writeCsv(path.join(outputDir, 'missing_from_current_by_identity.csv'), missingFromCurrent, ['id', 'contractorName', 'contractorEmail', 'fileName', 'weekEndingDate', 'invoiceDate', 'totalAmount', 'status', 'approvedDate', 'approvedBy', 'driveFileId', 'driveLink', 'pendingReason', 'identityKey']);
await writeCsv(path.join(outputDir, 'ambiguous_historical_matches.csv'), ambiguousHistorical, ['id', 'contractorName', 'contractorEmail', 'fileName', 'weekEndingDate', 'invoiceDate', 'totalAmount', 'status', 'currentMatchCount', 'currentIds', 'currentStatuses', 'identityKey']);
await writeCsv(path.join(outputDir, 'current_not_in_historical_by_identity.csv'), currentNotInHistorical, ['id', 'contractorName', 'contractorEmail', 'fileName', 'weekEndingDate', 'invoiceDate', 'totalAmount', 'status', 'approvedDate', 'approvedBy', 'driveFileId', 'driveLink', 'pendingReason', 'identityKey']);
await writeCsv(path.join(outputDir, 'status_differences_identity_matched.csv'), statusDifferences, ['id', 'contractorName', 'contractorEmail', 'fileName', 'weekEndingDate', 'invoiceDate', 'totalAmount', 'historicalStatus', 'currentStatus', 'historicalApprovedDate', 'historicalApprovedBy', 'currentId', 'currentCreatedAt', 'currentDriveFileId', 'currentDriveLink', 'identityKey']);
await writeCsv(path.join(outputDir, 'pending_approval_candidates_review_only.csv'), pendingApprovalCandidates, ['id', 'contractorName', 'contractorEmail', 'fileName', 'weekEndingDate', 'invoiceDate', 'totalAmount', 'historicalStatus', 'currentStatus', 'historicalApprovedDate', 'historicalApprovedBy', 'currentId', 'currentCreatedAt', 'currentDriveFileId', 'currentDriveLink', 'decision', 'reason', 'identityKey']);
await writeCsv(path.join(outputDir, 'pending_duplicate_groups.csv'), pendingDuplicateGroups, ['identityKey', 'duplicateCount', 'currentIds', 'contractor', 'email', 'file', 'weekEnding', 'amount']);
await writeCsv(path.join(outputDir, 'app_drive_reference_audit.csv'), driveReferenceAudit, ['id', 'contractorName', 'contractorEmail', 'fileName', 'weekEndingDate', 'invoiceDate', 'totalAmount', 'status', 'approvedDate', 'approvedBy', 'driveFileId', 'driveLink', 'hasDriveFileId', 'hasDriveLink', 'classification', 'identityKey']);
console.log(JSON.stringify(summary, null, 2));
console.log(`Output directory: ${outputDir}`);
