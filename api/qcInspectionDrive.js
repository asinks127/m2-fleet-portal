// /api/qcInspectionDrive — file a completed QC inspection into the M2 Fleet
// ComPortal shared drive: <Technician Folder>/QC/Inspection Reports/.
// Generates the inspection PDF server-side (pdf-lib) with all form fields,
// date/time, QC name, notes, and embeds the uploaded photos. Photos are also
// stored alongside the PDF.
//
// POST { inspectionId }                      -> file it now (also used for retry)
// POST { action: 'verify' }                  -> re-check every filed inspection still exists in Drive
// GET                                        -> { pending: [...], failed: [...], filed: n }
import { supabase, getAuthUser } from '../_lib/supabaseServer.js';
import { google } from 'googleapis';
import { Readable } from 'stream';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const ROOT_FOLDER_ID = '0AG5XubOTYKLFUk9PVA';
const QC_SUBFOLDER = 'QC';
const REPORTS_SUBFOLDER = 'Inspection Reports';
const BUCKET = 'qc-inspection-photos';

function isAdminAuth(user) {
  if (!user) return false;
  const email = (user.email || '').toLowerCase();
  const metaRole = user.user_metadata?.role || user.app_metadata?.role;
  if (metaRole === 'admin') return true;
  if (email.endsWith('@m2fleetcom.com') && !email.includes('.contractor@')) return true;
  return ['tjserota@gmail.com', 'zo-test@m2fleetcom.com'].includes(email);
}

function getDriveClient() {
  let key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!key) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is missing');
  key = key.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  let credentials;
  try {
    credentials = JSON.parse(key);
  } catch (e) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON: ' + e.message);
  }
  if (credentials.private_key) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
  }
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/drive'] });
  return google.drive({ version: 'v3', auth });
}

const folderCache = {};
async function getOrCreateFolder(drive, folderName, parentId) {
  const cacheKey = `${parentId}::${folderName}`;
  if (folderCache[cacheKey]) return folderCache[cacheKey];
  const escaped = folderName.replace(/'/g, "\\'");
  const query = `name='${escaped}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  try {
    const found = await drive.files.list({
      q: query,
      fields: 'files(id, name)',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    });
    if (found.data.files?.length) {
      folderCache[cacheKey] = found.data.files[0].id;
      return found.data.files[0].id;
    }
  } catch (e) {
    console.error(`[qcInspectionDrive] folder search failed for ${folderName}:`, e?.message);
  }
  const created = await drive.files.create({
    requestBody: { name: folderName, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    fields: 'id, name, webViewLink',
    supportsAllDrives: true,
  });
  folderCache[cacheKey] = created.data.id;
  return created.data.id;
}

function getTechnicianName(tech, inspection) {
  return (
    tech?.displayName ||
    tech?.fullName ||
    tech?.full_name ||
    inspection?.technicianName ||
    inspection?.technicianEmail ||
    'Unknown Technician'
  );
}

function wrapText(text, font, size, maxWidth) {
  const lines = [];
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    let current = '';
    for (const word of rawLine.split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    lines.push(current);
  }
  return lines;
}

function sanitizeText(value) {
  // pdf-lib standard fonts are WinAnsi; strip anything they can't encode.
  return String(value ?? '').replace(/[^\x00-\xFF\u2018\u2019\u201C\u201D\u2013\u2014\u2022]/g, '')
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-').replace(/\u2022/g, '-');
}

async function buildInspectionPdf(inspection, tech, photoBuffers) {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([612, 792]);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const margin = 50;
  const width = 612 - margin * 2;
  let y = 792 - 50;

  page.drawText('M2 FLEET COMMUNICATIONS — QC INSPECTION REPORT', { x: margin, y, size: 14, font: bold, color: rgb(0.1, 0.1, 0.35) });
  y -= 18;
  page.drawText(`Generated ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} (ET)`, { x: margin, y, size: 8, font: regular, color: rgb(0.45, 0.45, 0.45) });
  y -= 24;

  const inspectionDate = inspection.inspectionDate || inspection.inspection_date || inspection.created_at;
  const dt = inspectionDate ? new Date(inspectionDate) : new Date();
  const rows = [
    ['Technician', getTechnicianName(tech, inspection)],
    ['Asset Number', inspection.assetNumber || '—'],
    ['Customer', inspection.customer || '—'],
    ['Location', inspection.location || '—'],
    ['Available for Inspection', inspection.availability === 'no' ? 'No' : 'Yes'],
    ['Inspection Date', dt.toLocaleDateString('en-US', { timeZone: 'America/New_York' })],
    ['Inspection Time', dt.toLocaleTimeString('en-US', { timeZone: 'America/New_York' })],
    ['QC Inspector', inspection.qcUserName || inspection.qcUserNameFromToken || 'Unknown'],
  ];
  rows.forEach(([label, value]) => {
    page.drawText(`${label}:`, { x: margin, y, size: 10, font: bold });
    const lines = wrapText(sanitizeText(value), regular, 10, width - 130);
    lines.forEach((line, i) => page.drawText(line, { x: margin + 130, y: y - i * 13, size: 10, font: regular }));
    y -= 13 * lines.length + 5;
  });

  y -= 10;
  page.drawLine({ start: { x: margin, y }, end: { x: 612 - margin, y }, thickness: 0.75, color: rgb(0.7, 0.7, 0.7) });
  y -= 20;
  page.drawText('Inspection Notes', { x: margin, y, size: 11, font: bold });
  y -= 16;
  const noteLines = wrapText(sanitizeText(inspection.notes || 'No notes recorded.'), regular, 10, width);
  for (const line of noteLines) {
    if (y < 130) {
      y = 792 - 50;
      // continue on a new page if notes are long
      const newPage = pdf.addPage([612, 792]);
      newPage.drawText('(notes continued)', { x: margin, y: y + 14, size: 9, font: regular, color: rgb(0.5, 0.5, 0.5) });
      y -= 16;
      page = newPage;
    }
    page.drawText(line, { x: margin, y, size: 10, font: regular });
    y -= 13;
  }

  if (photoBuffers.length) {
    y -= 14;
    page.drawText(`Photos (${photoBuffers.length})`, { x: margin, y, size: 11, font: bold });
    y -= 14;
    const boxW = 240;
    const boxH = 190;
    for (let i = 0; i < photoBuffers.length; i += 1) {
      const photo = photoBuffers[i];
      if (y - boxH < 40) {
        page = pdf.addPage([612, 792]);
        y = 792 - 50;
      }
      const col = i % 2;
      const x = margin + col * (boxW + 24);
      try {
        const image = photo.mimeType.includes('png') ? await pdf.embedPng(photo.buffer) : await pdf.embedJpg(photo.buffer);
        const dims = image.scale(1);
        const scale = Math.min(boxW / dims.width, boxH / dims.height);
        page.drawImage(image, { x, y: y - dims.height * scale, width: dims.width * scale, height: dims.height * scale });
        page.drawText(photo.label, { x, y: y - dims.height * scale - 11, size: 8, font: regular, color: rgb(0.4, 0.4, 0.4) });
      } catch (e) {
        page.drawText(`[photo could not be embedded: ${photo.label}]`, { x, y: y - 12, size: 8, font: regular, color: rgb(0.8, 0.2, 0.2) });
      }
      if (col === 1) y -= boxH + 22;
    }
  }

  return pdf.save();
}

export async function fileInspection(inspectionId) {
  const { data: inspection, error } = await supabase.from('QCInspection').select('*').eq('id', inspectionId).single();
  if (error || !inspection) throw new Error(`Inspection ${inspectionId} not found`);

  let tech = null;
  if (inspection.technicianId) {
    const { data } = await supabase.from('User').select('displayName, fullName, full_name, email').eq('id', inspection.technicianId).maybeSingle();
    tech = data;
  }

  const photos = Array.isArray(inspection.photos) ? inspection.photos : [];
  const photoBuffers = [];
  for (let i = 0; i < photos.length; i += 1) {
    const p = photos[i];
    const path = typeof p === 'string' ? p : p.path;
    if (!path) continue;
    const { data: blob, error: dlError } = await supabase.storage.from(BUCKET).download(path);
    if (dlError || !blob) {
      console.error(`[qcInspectionDrive] photo download failed: ${path}: ${dlError?.message}`);
      continue;
    }
    photoBuffers.push({ buffer: Buffer.from(await blob.arrayBuffer()), mimeType: p.mimeType || 'image/jpeg', label: `Photo ${i + 1}` });
  }

  const pdfBytes = await buildInspectionPdf(inspection, tech, photoBuffers);
  const drive = getDriveClient();

  const techFolderId = await getOrCreateFolder(drive, getTechnicianName(tech, inspection), ROOT_FOLDER_ID);
  const qcFolderId = await getOrCreateFolder(drive, QC_SUBFOLDER, techFolderId);
  const reportsFolderId = await getOrCreateFolder(drive, REPORTS_SUBFOLDER, qcFolderId);

  const dt = new Date(inspection.inspectionDate || inspection.inspection_date || inspection.created_at || Date.now());
  const stamp = dt.toISOString().slice(0, 19).replace('T', ' ');
  const baseName = `QC Inspection - ${getTechnicianName(tech, inspection)} - ${stamp}`;

  // Re-filing after an edit: retire the previously filed PDF so the folder
  // never accumulates stale copies of the same inspection.
  if (inspection.driveFileId) {
    try {
      await drive.files.update({ fileId: inspection.driveFileId, requestBody: { trashed: true }, supportsAllDrives: true });
    } catch (e) {
      console.error(`[qcInspectionDrive] could not trash previous PDF ${inspection.driveFileId}:`, e?.message);
    }
  }

  const pdfUpload = await drive.files.create({
    requestBody: { name: `${baseName}.pdf`, parents: [reportsFolderId] },
    media: { mimeType: 'application/pdf', body: Readable.from(Buffer.from(pdfBytes)) },
    fields: 'id, webViewLink',
    supportsAllDrives: true,
  });

  const photoUploads = [];
  for (let i = 0; i < photoBuffers.length; i += 1) {
    const photo = photoBuffers[i];
    const ext = photo.mimeType.includes('png') ? 'png' : photo.mimeType.includes('webp') ? 'webp' : 'jpg';
    try {
      const up = await drive.files.create({
        requestBody: { name: `${baseName} - photo-${i + 1}.${ext}`, parents: [reportsFolderId] },
        media: { mimeType: photo.mimeType, body: Readable.from(photo.buffer) },
        fields: 'id, webViewLink',
        supportsAllDrives: true,
      });
      photoUploads.push({ id: up.data.id, link: up.data.webViewLink });
    } catch (e) {
      console.error(`[qcInspectionDrive] photo upload failed: ${e?.message}`);
    }
  }

  const { error: updError } = await supabase
    .from('QCInspection')
    .update({
      driveStatus: 'filed',
      driveFileId: pdfUpload.data.id,
      driveLink: pdfUpload.data.webViewLink,
      driveFolderId: reportsFolderId,
      driveError: null,
      driveFiledAt: new Date().toISOString(),
    })
    .eq('id', inspectionId);
  if (updError) throw new Error(`Filed to Drive but could not update record: ${updError.message}`);

  return { driveFileId: pdfUpload.data.id, driveLink: pdfUpload.data.webViewLink, folderId: reportsFolderId, photos: photoUploads.length };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!isAdminAuth(user)) return res.status(403).json({ error: 'Forbidden — admin only' });

  try {
    if (req.method === 'GET') {
      const { data } = await supabase.from('QCInspection').select('id, technicianId, driveStatus, driveError, inspectionDate, created_at, assetNumber, customer').order('created_at', { ascending: false }).limit(500);
      const rows = data || [];
      return res.status(200).json({
        pending: rows.filter((r) => !r.driveStatus),
        failed: rows.filter((r) => r.driveStatus === 'failed' || r.driveStatus === 'missing'),
        filedCount: rows.filter((r) => r.driveStatus === 'filed').length,
      });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const body = req.body || {};

    if (body.action === 'verify') {
      const drive = getDriveClient();
      const { data } = await supabase.from('QCInspection').select('id, driveStatus, driveFileId').eq('driveStatus', 'filed').limit(500);
      let missing = 0;
      let checked = 0;
      for (const row of data || []) {
        if (!row.driveFileId) continue;
        checked += 1;
        try {
          await drive.files.get({ fileId: row.driveFileId, fields: 'id', supportsAllDrives: true });
        } catch (e) {
          if (e?.code === 404 || String(e?.message).includes('File not found')) {
            await supabase.from('QCInspection').update({ driveStatus: 'missing', driveError: 'File no longer exists in Drive (moved, deleted, or renamed externally).' }).eq('id', row.id);
            missing += 1;
          }
        }
      }
      return res.status(200).json({ success: true, checked, missing });
    }

    const inspectionId = body.inspectionId;
    if (!inspectionId) return res.status(400).json({ error: 'inspectionId required' });

    try {
      const result = await fileInspection(inspectionId);
      return res.status(200).json({ success: true, ...result });
    } catch (e) {
      await supabase.from('QCInspection').update({ driveStatus: 'failed', driveError: String(e?.message || e).slice(0, 500) }).eq('id', inspectionId);
      console.error('[qcInspectionDrive] filing failed:', e);
      return res.status(500).json({ error: String(e?.message || e) });
    }
  } catch (e) {
    console.error('[qcInspectionDrive] handler failed:', e);
    return res.status(500).json({ error: e?.message || 'Unexpected error' });
  }
}
