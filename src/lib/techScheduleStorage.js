// Tech Schedule upload persistence — Supabase Storage (original file) + Supabase
// tables (tech_schedule_uploads / tech_schedule_rows). This repo uses Supabase,
// not Firebase, so the Firestore structure from the spec maps to two tables.
import { supabase } from '@/lib/supabaseClient.js';

const BUCKET = 'tech-schedule-uploads';

// Upload the original .xlsx/.xls/.csv to Supabase Storage.
// Returns { path, error }.
export async function uploadOriginalFile(file, uploadId) {
  const path = `${uploadId}/${file.name}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: true });
  if (error) return { path: null, error: error.message };
  return { path, error: null };
}

// Create the upload record + insert all parsed rows in batches.
export async function saveParsedUpload({ uploadId, file, storagePath, uploadedBy, parsed }) {
  const summary = {
    totalRows: parsed.summary.totalRows,
    totalSchedules: parsed.summary.totalSchedules,
    serviceRows: parsed.summary.serviceRows,
    delayRows: parsed.summary.delayRows,
    mappedRows: parsed.summary.mappedRows,
    installedCount: parsed.summary.installedCount,
    repairedCount: parsed.summary.repairedCount,
    notAvailableCount: parsed.summary.notAvailableCount,
    dataIssueCount: parsed.summary.dataIssueCount,
  };

  const { error: upErr } = await supabase.from('tech_schedule_uploads').upsert({
    id: uploadId,
    original_file_name: file.name,
    storage_path: storagePath,
    uploaded_by: uploadedBy || null,
    status: 'parsed',
    error_message: null,
    source_report_title: parsed.sourceReportTitle || null,
    generated_at: parsed.generatedAt || null,
    summary,
  });
  if (upErr) return { error: upErr.message };

  // Clear any old rows for this upload (re-parse case)
  await supabase.from('tech_schedule_rows').delete().eq('upload_id', uploadId);

  // Insert rows in batches of 200
  const BATCH = 200;
  const dbRows = parsed.rows.map((r) => ({
    upload_id: uploadId,
    tech_schedule_name: r.techScheduleName,
    asset_number: r.assetNumber,
    service_status: r.serviceStatus,
    start_time: r.startTime,
    end_time: r.endTime,
    duration_minutes: r.durationMinutes,
    delay_type: r.delayType,
    latitude: r.latitude,
    longitude: r.longitude,
    row_type: r.rowType,
    has_map_location: r.hasMapLocation,
    data_issues: r.dataIssues || [],
  }));
  for (let i = 0; i < dbRows.length; i += BATCH) {
    const { error: rErr } = await supabase.from('tech_schedule_rows').insert(dbRows.slice(i, i + BATCH));
    if (rErr) return { error: `Row insert failed at batch ${i}: ${rErr.message}` };
  }
  return { error: null };
}

// List previous uploads (newest first).
export async function listUploads() {
  const { data, error } = await supabase
    .from('tech_schedule_uploads')
    .select('*')
    .order('uploaded_at', { ascending: false });
  if (error) return { data: [], error: error.message };
  return { data: data || [], error: null };
}

// Load all parsed rows for an upload (for "View Map").
export async function loadUploadRows(uploadId) {
  const { data, error } = await supabase
    .from('tech_schedule_rows')
    .select('*')
    .eq('upload_id', uploadId);
  if (error) return { rows: [], error: error.message };
  const rows = (data || []).map(rowFromDb);
  return { rows, error: null };
}

// Download the original file bytes (for re-parse / download).
export async function downloadOriginalFile(storagePath) {
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
  if (error) return { buffer: null, error: error.message };
  const buf = await data.arrayBuffer();
  return { buffer: buf, error: null };
}

// Delete upload: storage object + upload row (rows cascade).
export async function deleteUpload(upload) {
  if (upload.storage_path) {
    await supabase.storage.from(BUCKET).remove([upload.storage_path]);
  }
  await supabase.from('tech_schedule_rows').delete().eq('upload_id', upload.id);
  const { error } = await supabase.from('tech_schedule_uploads').delete().eq('id', upload.id);
  return { error: error ? error.message : null };
}

// Mark an upload's status (e.g. 'parsing' / 'failed').
export async function setUploadStatus(uploadId, status, errorMessage = null) {
  const { error } = await supabase
    .from('tech_schedule_uploads')
    .update({ status, error_message: errorMessage })
    .eq('id', uploadId);
  return { error: error ? error.message : null };
}

// Map a snake_case DB row back to the camelCase TechScheduleRow shape.
function rowFromDb(r) {
  return {
    id: r.id,
    uploadId: r.upload_id,
    techScheduleName: r.tech_schedule_name,
    assetNumber: r.asset_number,
    serviceStatus: r.service_status,
    startTime: r.start_time,
    endTime: r.end_time,
    durationMinutes: r.duration_minutes,
    delayType: r.delay_type,
    latitude: r.latitude,
    longitude: r.longitude,
    rowType: r.row_type,
    hasMapLocation: r.has_map_location,
    dataIssues: r.data_issues || [],
  };
}
