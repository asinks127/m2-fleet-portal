import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { supabase } from '@/lib/supabaseClient.js';
import { parseScheduleFile, rowsToCsv, buildScheduleGroups } from '@/lib/techScheduleParser.js';
import {
  uploadOriginalFile, saveParsedUpload, listUploads, loadUploadRows,
  downloadOriginalFile, deleteUpload, setUploadStatus,
} from '@/lib/techScheduleStorage.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import {
  Upload, MapPin, FileSpreadsheet, Loader2, Download, Trash2, Eye, RefreshCw,
  AlertTriangle, Wrench, Clock, CheckCircle2, XCircle, Layers, Filter, Table as TableIcon,
} from 'lucide-react';

const ACCEPTED = ['.xlsx', '.xls', '.csv'];
const MAX_BYTES = 25 * 1024 * 1024; // 25MB (bucket limit)

// ---- color logic ----
function statusColor(row) {
  if (row.rowType === 'delay') return '#ea580c'; // orange
  const s = (row.serviceStatus || '').toLowerCase();
  if (s.startsWith('install')) return '#16a34a'; // green
  if (s.startsWith('repair')) return '#2563eb'; // blue
  if (s.includes('not available') || s === 'na' || s === 'n/a') return '#dc2626'; // red
  return '#6b7280'; // gray unknown
}
function statusLabel(row) {
  if (row.rowType === 'delay') return 'Delay';
  return row.serviceStatus || 'Unknown';
}
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const fmtMin = (m) => (m == null ? '—' : `${m}m`);

// =====================================================================
// Map subcomponent (Leaflet + marker clustering; no API key required)
// =====================================================================
function ScheduleMap({ rows }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const clusterRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!containerRef.current || mapRef.current) return;
      // markercluster attaches to global L
      if (!L.MarkerClusterGroup) { window.L = L; await import('leaflet.markercluster'); }
      if (cancelled) return;
      const map = L.map(containerRef.current, { scrollWheelZoom: true }).setView([39.5, -98.35], 4);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors', maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
      const cluster = L.markerClusterGroup({ maxClusterRadius: 50 });
      clusterRef.current = cluster;
      map.addLayer(cluster);
    }
    init();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const cluster = clusterRef.current;
    if (!map || !cluster) return;
    cluster.clearLayers();
    const mapped = rows.filter(r => r.hasMapLocation && r.latitude != null && r.longitude != null);
    if (!mapped.length) return;
    const latlngs = [];
    for (const r of mapped) {
      const color = statusColor(r);
      const m = L.circleMarker([r.latitude, r.longitude], {
        radius: 8, color, weight: 2, fillColor: color, fillOpacity: 0.85,
      });
      m.bindPopup(`
        <div style="font-family:Arial,sans-serif;min-width:200px;font-size:12px">
          <div style="font-weight:700;margin-bottom:4px">${escapeHtml(r.techScheduleName || '(Unassigned)')}</div>
          <div><b>Asset:</b> ${escapeHtml(r.assetNumber || '—')}</div>
          <div><b>Status:</b> ${escapeHtml(statusLabel(r))}</div>
          <div><b>Start:</b> ${fmtDate(r.startTime)}</div>
          <div><b>End:</b> ${fmtDate(r.endTime)}</div>
          <div><b>Duration:</b> ${fmtMin(r.durationMinutes)}</div>
          ${r.rowType === 'delay' && r.delayType ? `<div><b>Delay Type:</b> ${escapeHtml(r.delayType)}</div>` : ''}
          <div><b>Lat/Lng:</b> ${r.latitude}, ${r.longitude}</div>
        </div>`);
      cluster.addLayer(m);
      latlngs.push([r.latitude, r.longitude]);
    }
    if (latlngs.length) {
      const bounds = L.latLngBounds(latlngs);
      map.fitBounds(bounds.pad(0.1), { maxZoom: 14 });
    }
  }, [rows]);

  return (
    <div
      ref={containerRef}
      style={{ height: 480, width: '100%', borderRadius: 8, overflow: 'hidden', zIndex: 0 }}
      className="border"
    />
  );
}
function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// =====================================================================
// KPI card
// =====================================================================
function Kpi({ icon: Icon, label, value, color }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <Icon className="w-8 h-8" style={{ color }} />
      </CardContent>
    </Card>
  );
}

// =====================================================================
// Main page
// =====================================================================
export default function TechScheduleMap() {
  const [result, setResult] = useState(null); // { uploadId, rows, groups, summary, sourceReportTitle, generatedAt, originalFileName, errors }
  const [uploads, setUploads] = useState([]);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false); // uploading/parsing
  const [statusMsg, setStatusMsg] = useState(null); // {type, message}
  const [search, setSearch] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // filters
  const [fTech, setFTech] = useState('all');
  const [fStatus, setFStatus] = useState('all');
  const [fDelay, setFDelay] = useState('all');
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');
  const [tInstalled, setTInstalled] = useState(true);
  const [tRepaired, setTRepaired] = useState(true);
  const [tNotAvail, setTNotAvail] = useState(true);
  const [tDelays, setTDelays] = useState(true);
  const [tIssues, setTIssues] = useState(true);

  const refreshUploads = useCallback(async () => {
    const { data } = await listUploads();
    setUploads(data || []);
  }, []);
  useEffect(() => { refreshUploads(); }, [refreshUploads]);

  // ---- upload + parse + persist ----
  const handleFile = async (file) => {
    if (!file) return;
    setStatusMsg(null);
    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
    if (!ACCEPTED.includes(ext)) {
      setStatusMsg({ type: 'error', message: `Unsupported file type "${ext}". Use .xlsx, .xls, or .csv.` });
      return;
    }
    if (file.size > MAX_BYTES) {
      setStatusMsg({ type: 'error', message: `File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max is 25MB.` });
      return;
    }
    setFileName(file.name);
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const parsed = parseScheduleFile(buf, { fileName: file.name });
      if (parsed.errors && parsed.errors.length) {
        setStatusMsg({ type: 'error', message: parsed.errors.join(' ') });
        setBusy(false);
        return;
      }
      // show parsed result immediately (map + table) even before persistence
      setResult({
        uploadId: null, rows: parsed.rows, groups: parsed.groups, summary: parsed.summary,
        sourceReportTitle: parsed.sourceReportTitle, generatedAt: parsed.generatedAt,
        originalFileName: file.name, errors: [],
      });

      // persist: get user, create upload id, upload file, save rows
      const { data: { user } } = await supabase.auth.getUser();
      const uploadedBy = user?.email || null;
      const uploadId = crypto.randomUUID();
      const { error: stErr } = await setUploadStatus(uploadId, 'parsing'); // creates row placeholder? no
      // create the upload row first (so it exists), then upload file
      const { error: insErr } = await supabase.from('tech_schedule_uploads').upsert({
        id: uploadId, original_file_name: file.name, storage_path: null,
        uploaded_by: uploadedBy, status: 'parsing', error_message: null,
        source_report_title: parsed.sourceReportTitle || null, generated_at: parsed.generatedAt || null,
        summary: null,
      });
      if (insErr) throw new Error(`Upload record failed: ${insErr.message}`);
      const { path, error: upErr } = await uploadOriginalFile(file, uploadId);
      if (upErr) throw new Error(`File storage failed: ${upErr}`);
      const { error: saveErr } = await saveParsedUpload({ uploadId, file, storagePath: path, uploadedBy, parsed });
      if (saveErr) throw new Error(`Saving parsed rows failed: ${saveErr}`);
      await refreshUploads();
      setResult(r => r && ({ ...r, uploadId }));
      setStatusMsg({ type: 'success', message: `Parsed ${parsed.summary.totalRows} rows across ${parsed.summary.totalSchedules} schedules. Saved to history.` });
    } catch (e) {
      console.error(e);
      setStatusMsg({ type: 'error', message: e.message || 'Upload/parse failed.' });
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); };

  // ---- history actions ----
  const viewMap = async (up) => {
    setBusy(true); setStatusMsg(null);
    try {
      const { rows, error } = await loadUploadRows(up.id);
      if (error) throw new Error(error);
      const groups = buildScheduleGroups(rows);
      const summary = summarizeLocal(rows, groups);
      setResult({
        uploadId: up.id, rows, groups, summary,
        sourceReportTitle: up.source_report_title, generatedAt: up.generated_at,
        originalFileName: up.original_file_name, errors: [],
      });
      setFileName(up.original_file_name);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { setStatusMsg({ type: 'error', message: e.message }); }
    finally { setBusy(false); }
  };

  const reparse = async (up) => {
    if (!confirm(`Re-parse "${up.original_file_name}"? Existing parsed rows will be replaced.`)) return;
    setBusy(true); setStatusMsg(null);
    try {
      await setUploadStatus(up.id, 'parsing');
      const { buffer, error } = await downloadOriginalFile(up.storage_path);
      if (error) throw new Error(`Could not download original: ${error}`);
      const parsed = parseScheduleFile(buffer, { fileName: up.original_file_name });
      if (parsed.errors?.length) throw new Error(parsed.errors.join(' '));
      const { error: saveErr } = await saveParsedUpload({
        uploadId: up.id, file: { name: up.original_file_name }, storagePath: up.storage_path,
        uploadedBy: up.uploaded_by, parsed,
      });
      if (saveErr) throw new Error(saveErr);
      await refreshUploads();
      await viewMap({ ...up, status: 'parsed' });
      setStatusMsg({ type: 'success', message: `Re-parsed ${parsed.summary.totalRows} rows.` });
    } catch (e) { await setUploadStatus(up.id, 'failed', e.message); await refreshUploads(); setStatusMsg({ type: 'error', message: e.message }); }
    finally { setBusy(false); }
  };

  const downloadOriginal = async (up) => {
    try {
      const { buffer, error } = await downloadOriginalFile(up.storage_path);
      if (error) throw new Error(error);
      const blob = new Blob([buffer], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = up.original_file_name; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setStatusMsg({ type: 'error', message: e.message }); }
  };

  const removeUpload = async (up) => {
    if (!confirm(`Delete upload "${up.original_file_name}"? This removes the file and all parsed rows.`)) return;
    setBusy(true);
    try { const { error } = await deleteUpload(up); if (error) throw new Error(error); await refreshUploads(); if (result?.uploadId === up.id) setResult(null); setStatusMsg({ type: 'success', message: 'Upload deleted.' }); }
    catch (e) { setStatusMsg({ type: 'error', message: e.message }); }
    finally { setBusy(false); }
  };

  const exportCsv = () => {
    if (!result) return;
    const csv = rowsToCsv(filteredRows);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `tech-schedule-${result.originalFileName || 'export'}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // ---- derived filter options ----
  const rows = result?.rows || [];
  const techOptions = useMemo(() => [...new Set(rows.map(r => r.techScheduleName).filter(Boolean))].sort(), [rows]);
  const statusOptions = useMemo(() => [...new Set(rows.map(r => r.serviceStatus).filter(Boolean))].sort(), [rows]);
  const delayOptions = useMemo(() => [...new Set(rows.filter(r => r.rowType === 'delay').map(r => r.delayType).filter(Boolean))].sort(), [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = fFrom ? new Date(fFrom).getTime() : null;
    const to = fTo ? new Date(fTo).getTime() + 86400000 : null;
    return rows.filter(r => {
      if (fTech !== 'all' && r.techScheduleName !== fTech) return false;
      if (fStatus !== 'all' && r.serviceStatus !== fStatus) return false;
      if (fDelay !== 'all' && !(r.rowType === 'delay' && r.delayType === fDelay)) return false;
      if (from || to) {
        const t = r.startTime ? new Date(r.startTime).getTime() : null;
        if (t == null) return false;
        if (from && t < from) return false;
        if (to && t > to) return false;
      }
      const s = (r.serviceStatus || '').toLowerCase();
      if (r.rowType === 'service' && s.startsWith('install') && !tInstalled) return false;
      if (r.rowType === 'service' && s.startsWith('repair') && !tRepaired) return false;
      if (r.rowType === 'service' && (s.includes('not available') || s === 'na' || s === 'n/a') && !tNotAvail) return false;
      if (r.rowType === 'delay' && !tDelays) return false;
      if (r.dataIssues?.length && !tIssues) return false;
      if (q && !(`${r.techScheduleName} ${r.assetNumber} ${r.serviceStatus} ${r.delayType}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [rows, search, fTech, fStatus, fDelay, fFrom, fTo, tInstalled, tRepaired, tNotAvail, tDelays, tIssues]);

  const summary = result?.summary;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Layers className="w-8 h-8 text-blue-600" /> Tech Schedule Parser &amp; Service Map
        </h1>
        <p className="text-gray-600 mt-1">Upload a tech schedule export, parse installs/repairs vs delays, and map every service location.</p>
      </div>

      {statusMsg && (
        <Alert variant={statusMsg.type === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{statusMsg.message}</AlertDescription>
        </Alert>
      )}

      {/* ---- Upload area ---- */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FileSpreadsheet className="w-5 h-5" />Upload Schedule File</CardTitle></CardHeader>
        <CardContent>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
          >
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
            <Upload className="w-10 h-10 mx-auto text-gray-400 mb-2" />
            <p className="font-medium">Drag &amp; drop an Excel or CSV file here</p>
            <p className="text-sm text-gray-500">or click to browse — supports .xlsx, .xls, .csv (max 25MB)</p>
            {fileName && <p className="mt-3 text-sm"><Badge variant="secondary">{fileName}</Badge></p>}
            {busy && <p className="mt-3 text-sm text-blue-600 flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Parsing &amp; saving…</p>}
          </div>
          <Button className="mt-3" onClick={() => fileInputRef.current?.click()} disabled={busy}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />Choose File &amp; Parse
          </Button>
        </CardContent>
      </Card>

      {/* ---- KPI cards ---- */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <Kpi icon={Layers} label="Schedules" value={summary.totalSchedules} color="#7c3aed" />
          <Kpi icon={CheckCircle2} label="Services" value={summary.serviceRows} color="#0ea5e9" />
          <Kpi icon={MapPin} label="Mapped" value={summary.mappedRows} color="#16a34a" />
          <Kpi icon={Clock} label="Delays" value={summary.delayRows} color="#ea580c" />
          <Kpi icon={CheckCircle2} label="Installed" value={summary.installedCount} color="#16a34a" />
          <Kpi icon={Wrench} label="Repaired" value={summary.repairedCount} color="#2563eb" />
          <Kpi icon={AlertTriangle} label="Data Issues" value={summary.dataIssueCount} color="#dc2626" />
        </div>
      )}

      {/* ---- Filters ---- */}
      {result && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Filter className="w-5 h-5" />Filters</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div><Label>Tech Schedule</Label><Select value={fTech} onValueChange={setFTech}><SelectTrigger><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{techOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Service Status</Label><Select value={fStatus} onValueChange={setFStatus}><SelectTrigger><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{statusOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Delay Type</Label><Select value={fDelay} onValueChange={setFDelay}><SelectTrigger><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{delayOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>From</Label><Input type="date" value={fFrom} onChange={e => setFFrom(e.target.value)} /></div>
              <div><Label>To</Label><Input type="date" value={fTo} onChange={e => setFTo(e.target.value)} /></div>
            </div>
            <div className="flex flex-wrap gap-4">
              {[
                ['Installed', tInstalled, setTInstalled, '#16a34a'],
                ['Repaired', tRepaired, setTRepaired, '#2563eb'],
                ['Not Available', tNotAvail, setTNotAvail, '#dc2626'],
                ['Delays', tDelays, setTDelays, '#ea580c'],
                ['Rows w/ Issues', tIssues, setTIssues, '#6b7280'],
              ].map(([label, val, set, color]) => (
                <label key={label} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" checked={val} onChange={e => set(e.target.checked)} className="rounded" />
                  <span className="w-3 h-3 rounded-full" style={{ background: color }} />
                  {label}
                </label>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---- Map ---- */}
      {result && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="w-5 h-5" />Service Map <span className="text-sm font-normal text-gray-500">({filteredRows.filter(r => r.hasMapLocation).length} mapped)</span></CardTitle></CardHeader>
          <CardContent><ScheduleMap rows={filteredRows} /></CardContent>
        </Card>
      )}

      {/* ---- Table ---- */}
      {result && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2"><TableIcon className="w-5 h-5" />Parsed Rows ({filteredRows.length})</CardTitle>
            <Button size="sm" variant="outline" onClick={exportCsv}><Download className="w-4 h-4 mr-2" />Export CSV</Button>
          </CardHeader>
          <CardContent>
            <Input className="mb-3" placeholder="Search tech, asset, status…" value={search} onChange={e => setSearch(e.target.value)} />
            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-white">
                  <TableRow>
                    {['Tech Schedule','Asset','Row Type','Status','Delay Type','Start','End','Dur','Lat','Lng','Issues'].map(h => <TableHead key={h}>{h}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((r, i) => (
                    <TableRow key={i} className={r.dataIssues?.length ? 'bg-red-50' : ''}>
                      <TableCell className="font-medium">{r.techScheduleName || '—'}</TableCell>
                      <TableCell>{r.assetNumber || '—'}</TableCell>
                      <TableCell><Badge variant={r.rowType === 'delay' ? 'secondary' : 'outline'}>{r.rowType}</Badge></TableCell>
                      <TableCell><span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: statusColor(r) }} />{statusLabel(r)}</span></TableCell>
                      <TableCell>{r.delayType || '—'}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{fmtDate(r.startTime)}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{fmtDate(r.endTime)}</TableCell>
                      <TableCell>{fmtMin(r.durationMinutes)}</TableCell>
                      <TableCell>{r.latitude ?? '—'}</TableCell>
                      <TableCell>{r.longitude ?? '—'}</TableCell>
                      <TableCell className="text-xs text-red-600 max-w-[180px]">{r.dataIssues?.length ? r.dataIssues.join('; ') : ''}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---- Uploaded Schedule Files (history) ---- */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FileSpreadsheet className="w-5 h-5" />Uploaded Schedule Files</CardTitle></CardHeader>
        <CardContent>
          {uploads.length === 0 ? (
            <p className="text-center py-6 text-gray-500">No uploads yet. Upload a schedule file above to get started.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  {['File Name','Uploaded By','Date','Status','Rows','Services','Delays','Mapped','Issues','Actions'].map(h => <TableHead key={h}>{h}</TableHead>)}
                </TableRow></TableHeader>
                <TableBody>
                  {uploads.map(up => {
                    const s = up.summary || {};
                    return (
                      <TableRow key={up.id}>
                        <TableCell className="font-medium max-w-[200px] truncate">{up.original_file_name}</TableCell>
                        <TableCell className="text-xs">{up.uploaded_by || '—'}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{up.uploaded_at ? new Date(up.uploaded_at).toLocaleDateString() : '—'}</TableCell>
                        <TableCell><Badge className={up.status === 'parsed' ? 'bg-green-100 text-green-800' : up.status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}>{up.status}</Badge></TableCell>
                        <TableCell>{s.totalRows ?? '—'}</TableCell>
                        <TableCell>{s.serviceRows ?? '—'}</TableCell>
                        <TableCell>{s.delayRows ?? '—'}</TableCell>
                        <TableCell>{s.mappedRows ?? '—'}</TableCell>
                        <TableCell>{s.dataIssueCount ?? '—'}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="outline" size="sm" title="View Map" onClick={() => viewMap(up)}><Eye className="w-4 h-4" /></Button>
                            <Button variant="outline" size="sm" title="Re-Parse" onClick={() => reparse(up)}><RefreshCw className="w-4 h-4" /></Button>
                            <Button variant="outline" size="sm" title="Download Original" onClick={() => downloadOriginal(up)}><Download className="w-4 h-4" /></Button>
                            <Button variant="destructive" size="sm" title="Delete" onClick={() => removeUpload(up)}><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// local summarizer for rows loaded from DB (rows already in camelCase shape)
function summarizeLocal(rows, groups) {
  let serviceRows = 0, delayRows = 0, mappedRows = 0, installed = 0, repaired = 0, notAvail = 0, issues = 0;
  for (const r of rows) {
    if (r.rowType === 'service') { serviceRows++; if (r.hasMapLocation) mappedRows++; const s = (r.serviceStatus || '').toLowerCase(); if (s.startsWith('install')) installed++; else if (s.startsWith('repair')) repaired++; else if (s.includes('not available') || s === 'na' || s === 'n/a') notAvail++; }
    else if (r.rowType === 'delay') delayRows++;
    if (r.dataIssues?.length) issues++;
  }
  return { totalRows: rows.length, totalSchedules: groups.length, serviceRows, delayRows, mappedRows, installedCount: installed, repairedCount: repaired, notAvailableCount: notAvail, dataIssueCount: issues };
}
