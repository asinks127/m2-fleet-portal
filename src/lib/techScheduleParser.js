// Tech Schedule Parser & Service Map — pure parsing logic.
// Framework-agnostic. Imported by src/pages/TechScheduleMap.jsx and unit-tested
// directly. Handles .xlsx / .xls / .csv via SheetJS (xlsx).

import * as XLSX from 'xlsx';

// ---------------------------------------------------------------------------
// Types (documented for clarity; not enforced at runtime)
// ---------------------------------------------------------------------------
// TechScheduleRow:
//   { techScheduleName, assetNumber, serviceStatus, startTime, endTime,
//     durationMinutes, delayType, latitude, longitude,
//     rowType: "service"|"delay"|"unknown", hasMapLocation, dataIssues: [] }
//
// TechScheduleGroup:
//   { techScheduleName, totalRows, serviceRows, delayRows, mappedServiceRows,
//     installedCount, repairedCount, notAvailableCount, delayCount,
//     totalServiceMinutes, totalDelayMinutes, firstStartTime, lastEndTime }
// ---------------------------------------------------------------------------

// Required header tokens (normalized). A row is the header if it contains all.
const REQUIRED_HEADER_TOKENS = [
  'tech schedule name',
  'asset number',
  'service status',
  'start time',
  'end time',
  'delay type',
  'service latlong latitude',
  'service latlong longitude',
];

// Canonical header name -> field key
const HEADER_FIELD_MAP = {
  'tech schedule name': 'techScheduleName',
  'asset number': 'assetNumber',
  'service status': 'serviceStatus',
  'start time': 'startTime',
  'end time': 'endTime',
  'start time end time': 'durationMinutes', // "Start Time - End Time"
  'delay type': 'delayType',
  'service latlong latitude': 'latitude',
  'service latlong longitude': 'longitude',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Normalize a header string for matching: lowercase, drop parentheticals,
// strip punctuation, collapse whitespace.
export function normalizeHeader(raw) {
  if (raw == null) return '';
  let s = String(raw)
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, '-') // en/em dash -> hyphen
    .replace(/[()]/g, ' ') // keep parenthetical words (Latitude/Longitude)
    .replace(/[^a-z0-9]+/g, ' ') // other punctuation -> spaces
    .trim()
    .replace(/\s+/g, ' ');
  return s;
}

// Find the header row index in a 2D array of raw cell values.
// Returns -1 if no row contains all required header tokens.
export function detectHeaderRow(rows) {
  if (!Array.isArray(rows)) return -1;
  for (let i = 0; i < rows.length; i++) {
    const cells = (rows[i] || []).map((c) => normalizeHeader(c));
    const cellSet = new Set(cells.filter(Boolean));
    const hit = REQUIRED_HEADER_TOKENS.every((tok) => cellSet.has(tok));
    if (hit) return i;
  }
  return -1;
}

// Fill-down: if the current tech schedule name cell is blank, carry the previous.
export function fillDownTechScheduleName(currentValue, previousValue) {
  const c = (currentValue == null ? '' : String(currentValue)).trim();
  if (c) return c;
  if (previousValue == null) return null;
  const p = String(previousValue).trim();
  return p || null;
}

// Excel serial date number -> JS Date (UTC). Serial 1 = 1900-01-01 (with the
// Excel 1900 leap-year bug; use the standard (date - 25569) * 86400 formula).
function excelSerialToDate(serial) {
  if (typeof serial !== 'number' || !isFinite(serial)) return null;
  // fractional day -> ms
  const utcDays = serial - 25569;
  const ms = utcDays * 86400 * 1000;
  const d = new Date(ms);
  return isNaN(d.getTime()) ? null : d;
}

// Parse a value (Date | number | string) into a Date, or null.
export function parseDateTime(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') return excelSerialToDate(value);
  const s = String(value).trim();
  if (!s) return null;
  // Try native parse (handles ISO + many locale formats)
  const t = Date.parse(s);
  if (!isNaN(t)) return new Date(t);
  // Try "MM/DD/YYYY HH:mm" style
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})[ ,T]?(\d{1,2})?:?(\d{2})?/);
  if (m) {
    const yr = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    const d = new Date(yr, +m[1] - 1, +m[2], +(m[4] || 0), +(m[5] || 0));
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// "Start Time - End Time" column appears to already be minutes.
export function parseDurationMinutes(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return isFinite(value) ? value : null;
  const s = String(value).trim();
  if (!s) return null;
  // Pull the first numeric token (handles "45 min", "-5", "45.0")
  const m = s.match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return isFinite(n) ? n : null;
}

// Validate lat/lng; returns array of issue strings (empty if valid).
export function validateLatLng(lat, lng) {
  const issues = [];
  if (lat != null && lat !== '') {
    const n = typeof lat === 'number' ? lat : parseFloat(lat);
    if (!isFinite(n) || n < -90 || n > 90) issues.push('invalid latitude');
  }
  if (lng != null && lng !== '') {
    const n = typeof lng === 'number' ? lng : parseFloat(lng);
    if (!isFinite(n) || n < -180 || n > 180) issues.push('invalid longitude');
  }
  return issues;
}

// Classify a normalized row object as service / delay / unknown.
export function classifyRow(row) {
  const asset = (row.assetNumber == null ? '' : String(row.assetNumber)).trim();
  if (asset.toLowerCase() === 'delay') return 'delay';
  const hasAsset = !!asset;
  const hasCoords = row.latitude != null && row.latitude !== '' &&
    row.longitude != null && row.longitude !== '';
  if (hasAsset && hasCoords) return 'service';
  if (hasAsset) return 'service'; // service row even without coords (just not mapped)
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Status normalization
// ---------------------------------------------------------------------------
function normStatus(s) {
  return (s == null ? '' : String(s))
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}
function isInstalled(s) { return normStatus(s).startsWith('install'); }
function isRepaired(s) {
  const n = normStatus(s);
  return n.startsWith('repair');
}
function isNotAvailable(s) {
  const n = normStatus(s);
  return n.includes('not available') || n.includes('not-available') || n === 'na' || n === 'n/a';
}

// ---------------------------------------------------------------------------
// Core parse: takes an ArrayBuffer of an .xlsx/.xls/.csv file, returns
// { rows, groups, summary, sourceReportTitle, generatedAt, errors }
// ---------------------------------------------------------------------------
export function parseScheduleFile(arrayBuffer, { fileName = '' } = {}) {
  const errors = [];
  let workbook;
  try {
    workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
  } catch (e) {
    return { rows: [], groups: [], summary: emptySummary(), errors: [`Could not read file: ${e.message}`] };
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { rows: [], groups: [], summary: emptySummary(), errors: ['Workbook has no sheets.'] };
  }
  const sheet = workbook.Sheets[sheetName];

  // 2D array of raw values (header detection must run on raw grid)
  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });

  const headerIdx = detectHeaderRow(grid);
  if (headerIdx < 0) {
    return {
      rows: [],
      groups: [],
      summary: emptySummary(),
      errors: ['Could not find the required header row (Tech Schedule Name, Asset Number, Service Status, Start Time, End Time, Delay Type, lat/long).'],
    };
  }

  // Confirm lat/lng columns exist (defensive validation per spec)
  const headerCells = (grid[headerIdx] || []).map(normalizeHeader);
  if (!headerCells.includes('service latlong latitude') || !headerCells.includes('service latlong longitude')) {
    return {
      rows: [],
      groups: [],
      summary: emptySummary(),
      errors: ['Latitude/longitude columns are missing in the header row.'],
    };
  }

  // Build column index map
  const colIndex = {};
  headerCells.forEach((h, i) => {
    if (HEADER_FIELD_MAP[h] && colIndex[HEADER_FIELD_MAP[h]] == null) {
      colIndex[HEADER_FIELD_MAP[h]] = i;
    }
  });

  // Source report title / generated-at: usually rows ABOVE the header.
  // Best-effort: scan rows 0..headerIdx-1 for a "report title" looking cell.
  let sourceReportTitle = null;
  let generatedAt = null;
  for (let i = 0; i < headerIdx; i++) {
    for (const cell of grid[i] || []) {
      if (cell == null) continue;
      const s = String(cell).trim();
      if (!s) continue;
      if (/generated|run date|report date/i.test(s) && s.length < 80) generatedAt = s;
      else if (!sourceReportTitle && s.length > 3 && s.length < 120 && !/filter|criteria/i.test(s)) {
        sourceReportTitle = s;
      }
    }
  }

  // Walk data rows below the header
  const rows = [];
  let lastTechName = null;
  for (let r = headerIdx + 1; r < grid.length; r++) {
    const line = grid[r] || [];
    // Skip fully blank rows
    if (!line.some((c) => c != null && String(c).trim() !== '')) continue;

    const rawTech = colIndex.techScheduleName != null ? line[colIndex.techScheduleName] : null;
    const techName = fillDownTechScheduleName(rawTech, lastTechName);
    if (rawTech != null && String(rawTech).trim() !== '') lastTechName = String(rawTech).trim();

    const assetNumber = colIndex.assetNumber != null ? line[colIndex.assetNumber] : null;
    const serviceStatus = colIndex.serviceStatus != null ? line[colIndex.serviceStatus] : null;
    const startTime = colIndex.startTime != null ? line[colIndex.startTime] : null;
    const endTime = colIndex.endTime != null ? line[colIndex.endTime] : null;
    const durationRaw = colIndex.durationMinutes != null ? line[colIndex.durationMinutes] : null;
    const delayType = colIndex.delayType != null ? line[colIndex.delayType] : null;
    const latRaw = colIndex.latitude != null ? line[colIndex.latitude] : null;
    const lngRaw = colIndex.longitude != null ? line[colIndex.longitude] : null;

    const startDt = parseDateTime(startTime);
    const endDt = parseDateTime(endTime);
    const durationMinutes = parseDurationMinutes(durationRaw);

    // Numeric lat/lng (or null)
    const latitude = latRaw == null || latRaw === '' ? null : (typeof latRaw === 'number' ? latRaw : parseFloat(latRaw));
    const longitude = lngRaw == null || lngRaw === '' ? null : (typeof lngRaw === 'number' ? lngRaw : parseFloat(lngRaw));

    const provisional = { techScheduleName: techName, assetNumber, serviceStatus, latitude, longitude };
    const rowType = classifyRow(provisional);

    // Defensive validation -> dataIssues
    const dataIssues = [];
    dataIssues.push(...validateLatLng(latitude, longitude));
    const assetStr = (assetNumber == null ? '' : String(assetNumber)).trim();
    if (!assetStr) dataIssues.push('missing asset number');
    if (startTime == null || startTime === '') dataIssues.push('missing start time');
    if (startDt && endDt && endDt < startDt) dataIssues.push('invalid time range');
    if (durationMinutes != null && durationMinutes < 0) dataIssues.push('negative duration');
    if (rowType === 'delay' && !(delayType && String(delayType).trim())) dataIssues.push('missing delay type');

    const hasMapLocation =
      latitude != null && longitude != null &&
      isFinite(latitude) && isFinite(longitude) &&
      latitude >= -90 && latitude <= 90 &&
      longitude >= -180 && longitude <= 180;

    rows.push({
      techScheduleName: techName,
      assetNumber: assetStr,
      serviceStatus: serviceStatus == null ? null : String(serviceStatus).trim() || null,
      startTime: startDt ? startDt.toISOString() : null,
      endTime: endDt ? endDt.toISOString() : null,
      durationMinutes,
      delayType: delayType == null ? null : String(delayType).trim() || null,
      latitude: hasMapLocation ? latitude : (latitude != null ? latitude : null),
      longitude: hasMapLocation ? longitude : (longitude != null ? longitude : null),
      rowType,
      hasMapLocation,
      dataIssues,
    });
  }

  const groups = buildScheduleGroups(rows);
  const summary = summarize(rows, groups);

  return { rows, groups, summary, sourceReportTitle, generatedAt, errors };
}

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------
export function buildScheduleGroups(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = r.techScheduleName || '(Unassigned)';
    if (!map.has(key)) {
      map.set(key, {
        techScheduleName: key,
        totalRows: 0,
        serviceRows: [],
        delayRows: [],
        mappedServiceRows: [],
        installedCount: 0,
        repairedCount: 0,
        notAvailableCount: 0,
        delayCount: 0,
        totalServiceMinutes: 0,
        totalDelayMinutes: 0,
        firstStartTime: null,
        lastEndTime: null,
      });
    }
    const g = map.get(key);
    g.totalRows++;
    if (r.rowType === 'service') {
      g.serviceRows.push(r);
      if (r.hasMapLocation) g.mappedServiceRows.push(r);
      if (isInstalled(r.serviceStatus)) g.installedCount++;
      else if (isRepaired(r.serviceStatus)) g.repairedCount++;
      else if (isNotAvailable(r.serviceStatus)) g.notAvailableCount++;
      if (typeof r.durationMinutes === 'number') g.totalServiceMinutes += r.durationMinutes;
    } else if (r.rowType === 'delay') {
      g.delayRows.push(r);
      g.delayCount++;
      if (typeof r.durationMinutes === 'number') g.totalDelayMinutes += r.durationMinutes;
    }
    if (r.startTime) {
      if (!g.firstStartTime || r.startTime < g.firstStartTime) g.firstStartTime = r.startTime;
    }
    if (r.endTime) {
      if (!g.lastEndTime || r.endTime > g.lastEndTime) g.lastEndTime = r.endTime;
    }
  }
  return Array.from(map.values()).sort((a, b) => a.techScheduleName.localeCompare(b.techScheduleName));
}

function emptySummary() {
  return {
    totalRows: 0, totalSchedules: 0, serviceRows: 0, delayRows: 0, mappedRows: 0,
    installedCount: 0, repairedCount: 0, notAvailableCount: 0, dataIssueCount: 0,
    totalServiceMinutes: 0, totalDelayMinutes: 0,
  };
}

function summarize(rows, groups) {
  let serviceRows = 0, delayRows = 0, mappedRows = 0, installed = 0, repaired = 0, notAvail = 0,
    issues = 0, svcMin = 0, dlyMin = 0;
  for (const r of rows) {
    if (r.rowType === 'service') {
      serviceRows++;
      if (r.hasMapLocation) mappedRows++;
      if (isInstalled(r.serviceStatus)) installed++;
      else if (isRepaired(r.serviceStatus)) repaired++;
      else if (isNotAvailable(r.serviceStatus)) notAvail++;
      if (typeof r.durationMinutes === 'number') svcMin += r.durationMinutes;
    } else if (r.rowType === 'delay') {
      delayRows++;
      if (typeof r.durationMinutes === 'number') dlyMin += r.durationMinutes;
    }
    if (r.dataIssues && r.dataIssues.length) issues++;
  }
  return {
    totalRows: rows.length,
    totalSchedules: groups.length,
    serviceRows,
    delayRows,
    mappedRows,
    installedCount: installed,
    repairedCount: repaired,
    notAvailableCount: notAvail,
    dataIssueCount: issues,
    totalServiceMinutes: svcMin,
    totalDelayMinutes: dlyMin,
  };
}

// ---------------------------------------------------------------------------
// CSV export of cleaned rows
// ---------------------------------------------------------------------------
export function rowsToCsv(rows) {
  const cols = [
    'techScheduleName', 'assetNumber', 'rowType', 'serviceStatus', 'delayType',
    'startTime', 'endTime', 'durationMinutes', 'latitude', 'longitude', 'dataIssues',
  ];
  const escape = (v) => {
    if (v == null) return '';
    const s = Array.isArray(v) ? v.join('; ') : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [cols.join(',')];
  for (const r of rows) {
    lines.push(cols.map((c) => escape(r[c])).join(','));
  }
  return lines.join('\n');
}
