// Tech Roster Parser — reads the "XP – Tech Schedules W/Wo CICO" export and
// builds a lookup from Tech Schedule Name (TS-…) -> actual Technician name.
// Framework-agnostic. Uses SheetJS (xlsx).
//
// The CICO file header (after normalization) includes:
//   tech schedule name, work order id, technician, work order, account name,
//   start time, check in date time, ..., check-in latlong (latitude), ...
// We only need: tech schedule name (key) + technician (value).

import * as XLSX from 'xlsx';

export function normalizeHeader(raw) {
  if (raw == null) return '';
  return String(raw)
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[()]/g, ' ')
    .replace(/[\u2191\u2193]/g, ' ') // arrow chars
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

// Find the header row that contains "tech schedule name" AND "technician".
export function detectHeaderRow(rows) {
  if (!Array.isArray(rows)) return -1;
  for (let i = 0; i < rows.length; i++) {
    const cells = (rows[i] || []).map(normalizeHeader).filter(Boolean);
    const set = new Set(cells);
    if (set.has('tech schedule name') && set.has('technician')) return i;
  }
  return -1;
}

// Parse the CICO file. Returns { roster, technicianLocations, errors }
//   roster: { "TS-0001510082": "Justin McLean", ... }
//   technicianLocations: { "Justin McLean": { lat, lng, address } }  (check-in)
export function parseRosterFile(arrayBuffer, { fileName = '' } = {}) {
  const errors = [];
  let workbook;
  try {
    workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
  } catch (e) {
    return { roster: {}, technicianLocations: {}, errors: [`Could not read file: ${e.message}`] };
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { roster: {}, technicianLocations: {}, errors: ['Workbook has no sheets.'] };
  const sheet = workbook.Sheets[sheetName];
  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });

  const headerIdx = detectHeaderRow(grid);
  if (headerIdx < 0) {
    return { roster: {}, technicianLocations: {}, errors: ['Could not find header row with "Tech Schedule Name" and "Technician".'] };
  }

  const headerCells = (grid[headerIdx] || []).map(normalizeHeader);
  const colIndex = {};
  headerCells.forEach((h, i) => {
    if (h === 'tech schedule name' && colIndex.techScheduleName == null) colIndex.techScheduleName = i;
    if (h === 'technician' && colIndex.technician == null) colIndex.technician = i;
    if (h === 'check in latlong latitude' && colIndex.checkInLat == null) colIndex.checkInLat = i;
    if (h === 'check in latlong longitude' && colIndex.checkInLng == null) colIndex.checkInLng = i;
    if (h === 'wo address' && colIndex.woAddress == null) colIndex.woAddress = i;
  });

  if (colIndex.techScheduleName == null || colIndex.technician == null) {
    return { roster: {}, technicianLocations: {}, errors: ['Missing required columns (Tech Schedule Name / Technician).'] };
  }

  const roster = {};
  const technicianLocations = {};
  let lastTech = null;

  for (let r = headerIdx + 1; r < grid.length; r++) {
    const line = grid[r] || [];
    if (!line.some((c) => c != null && String(c).trim() !== '')) continue;

    const rawTs = line[colIndex.techScheduleName];
    const ts = rawTs == null ? '' : String(rawTs).trim();
    if (!ts) continue; // no TS id, skip (don't fill down — roster rows are independent)

    const rawTech = colIndex.technician != null ? line[colIndex.technician] : null;
    const techName = rawTech == null ? '' : String(rawTech).trim();
    if (techName) {
      roster[ts] = techName;
      lastTech = techName;
    } else if (lastTech && !roster[ts]) {
      // carry last known tech for blank technician cells
      roster[ts] = lastTech;
    }

    // Capture check-in location for the technician (first wins)
    if (techName && !technicianLocations[techName]) {
      const lat = colIndex.checkInLat != null ? line[colIndex.checkInLat] : null;
      const lng = colIndex.checkInLng != null ? line[colIndex.checkInLng] : null;
      const addr = colIndex.woAddress != null ? line[colIndex.woAddress] : null;
      const latN = lat == null || lat === '' ? null : (typeof lat === 'number' ? lat : parseFloat(lat));
      const lngN = lng == null || lng === '' ? null : (typeof lng === 'number' ? lng : parseFloat(lng));
      const valid = latN != null && lngN != null && isFinite(latN) && isFinite(lngN) &&
        latN >= -90 && latN <= 90 && lngN >= -180 && lngN <= 180;
      technicianLocations[techName] = {
        lat: valid ? latN : null,
        lng: valid ? lngN : null,
        address: addr == null ? null : String(addr).trim() || null,
      };
    }
  }

  return { roster, technicianLocations, errors };
}

// Reverse lookup: technician name -> array of TS ids.
export function buildTechnicianIndex(roster) {
  const idx = {};
  for (const [ts, name] of Object.entries(roster)) {
    if (!idx[name]) idx[name] = [];
    idx[name].push(ts);
  }
  return idx;
}
