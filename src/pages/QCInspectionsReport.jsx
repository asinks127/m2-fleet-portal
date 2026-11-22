import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { QCInspection, User } from '@/api/entities.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog.jsx';
import { FileCheck, Download, Search, Loader2, CloudUpload, RefreshCw, Pencil, ImageIcon, X, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';

const techFields = ['displayName', 'full_name', 'fullName', 'name', 'email', 'business', 'businessName'];
const techNameOf = (t) => t?.displayName || t?.full_name || t?.fullName || t?.name || t?.email || 'Unknown Technician';

async function postApi(name, body) {
  const { data: { session } } = await supabase.auth.getSession();
  const response = await fetch(`/api/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `${name} failed`);
  return payload;
}

export default function QCInspectionsReport() {
  const [inspections, setInspections] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState('this_month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedTech, setSelectedTech] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState('all');
  const [selectedQc, setSelectedQc] = useState('all');
  const [selectedAvailability, setSelectedAvailability] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [driveStatusFilter, setDriveStatusFilter] = useState('all');
  const [photoUrls, setPhotoUrls] = useState({});
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editHistory, setEditHistory] = useState([]);
  const [isSavingEdit, setIsSavingEdit] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [driveNotice, setDriveNotice] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [records, users] = await Promise.all([QCInspection.list('-inspection_date', 3000), User.list()]);
      setInspections(Array.isArray(records) ? records : []);
      setTechnicians((Array.isArray(users) ? users : []).filter((u) => u.email && (
        u.email.toLowerCase().includes('.contractor@m2fleetcom.com') ||
        u.email.toLowerCase().includes('.contractor@smcinstallations.com')
      )));
    } catch (error) {
      console.error('Error loading inspections:', error);
      setInspections([]);
    } finally { setIsLoading(false); }
  };

  const techById = useMemo(() => {
    const m = new Map();
    technicians.forEach((t) => { m.set(String(t.id), t); techFields.forEach((f) => { if (t?.[f]) m.set(String(t[f]).toLowerCase(), t); }); });
    return m;
  }, [technicians]);

  const resolveTech = useCallback((inspection) => {
    const id = inspection?.technicianId;
    if (id && techById.has(String(id))) return techById.get(String(id));
    if (id && techById.has(String(id).toLowerCase())) return techById.get(String(id).toLowerCase());
    if (inspection?.technicianName) {
      const byName = technicians.find((t) => (techFields.some((f) => t?.[f] && String(t[f]).toLowerCase() === String(inspection.technicianName).toLowerCase())));
      if (byName) return byName;
    }
    return null;
  }, [techById, technicians]);

  const techLabel = useCallback((inspection) => inspection?.technicianName || (resolveTech(inspection) ? techNameOf(resolveTech(inspection)) : 'Unknown'), [resolveTech]);

  const getDateRange = useCallback(() => {
    const now = new Date();
    const weekStartsOn = 5;
    switch (dateRange) {
      case 'today': { const s = new Date(now); s.setHours(0, 0, 0, 0); const e = new Date(now); e.setHours(23, 59, 59, 999); return { start: s, end: e }; }
      case 'this_week': return { start: startOfWeek(now, { weekStartsOn }), end: endOfWeek(now, { weekStartsOn }) };
      case 'last_week': { const lw = subDays(now, 7); return { start: startOfWeek(lw, { weekStartsOn }), end: endOfWeek(lw, { weekStartsOn }) }; }
      case 'this_month': return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'last_month': { const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1); return { start: startOfMonth(lm), end: endOfMonth(lm) }; }
      case 'this_year': return { start: new Date(now.getFullYear(), 0, 1), end: endOfMonth(new Date(now.getFullYear(), 11, 1)) };
      case 'custom': {
        const start = customStartDate ? new Date(`${customStartDate}T00:00:00`) : startOfWeek(now, { weekStartsOn });
        const end = customEndDate ? new Date(`${customEndDate}T23:59:59.999`) : endOfWeek(now, { weekStartsOn });
        return { start, end };
      }
      default: return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  }, [dateRange, customStartDate, customEndDate]);

  const customers = useMemo(() => Array.from(new Set(inspections.map((i) => i.customer).filter(Boolean))).sort(), [inspections]);
  const qcs = useMemo(() => Array.from(new Set(inspections.map((i) => i.qcUserName).filter(Boolean))).sort(), [inspections]);

  const filtered = useMemo(() => {
    const { start, end } = getDateRange();
    return inspections.filter((insp) => {
      const rawDate = insp.inspection_date || insp.created_at;
      const d = rawDate ? new Date(rawDate) : null;
      if (!d || Number.isNaN(d.getTime())) return false;
      if (d < start || d > end) return false;
      const techLabelLower = techLabel(insp).toLowerCase();
      const notes = String(insp.notes || '').toLowerCase();
      if (selectedTech !== 'all') {
        if (selectedTech === 'unmatched') { if (resolveTech(insp)) return false; }
        else if (String(resolveTech(insp)?.id) !== String(selectedTech)) return false;
      }
      if (selectedCustomer !== 'all' && String(insp.customer || '') !== selectedCustomer) return false;
      if (selectedQc !== 'all' && String(insp.qcUserName || '') !== selectedQc) return false;
      if (selectedAvailability !== 'all' && String(insp.availability || '') !== selectedAvailability) return false;
      if (driveStatusFilter !== 'all' && String(insp.driveStatus || 'pending') !== driveStatusFilter) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        if (!notes.includes(s) && !techLabelLower.includes(s) && !String(insp.assetNumber || '').toLowerCase().includes(s) && !String(insp.customer || '').toLowerCase().includes(s) && !String(insp.location || '').toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [inspections, getDateRange, selectedTech, selectedCustomer, selectedQc, selectedAvailability, driveStatusFilter, searchTerm, techLabel, resolveTech]);

  const summary = useMemo(() => {
    const byTech = {}; const availability = { yes: 0, no: 0, unset: 0 };
    filtered.forEach((insp) => {
      const label = techLabel(insp);
      byTech[label] = (byTech[label] || 0) + 1;
      const av = String(insp.availability || '').toLowerCase();
      if (av === 'yes') availability.yes += 1; else if (av === 'no') availability.no += 1; else availability.unset += 1;
    });
    return { byTech, availability, unfiled: filtered.filter((i) => String(i.driveStatus || 'pending') !== 'filed').length };
  }, [filtered, techLabel]);

  const loadPhotoUrls = async (inspection) => {
    const paths = (inspection.photos || []).map((p) => p.path || p).filter(Boolean);
    if (!paths.length) return;
    try {
      const { urls } = await postApi('qcInspectionPhotos', { paths });
      setPhotoUrls((prev) => ({ ...prev, [inspection.id]: Object.fromEntries(urls.map((u) => [u.path, u.url])) }));
    } catch (e) { console.error('Photo URL load failed:', e); }
  };

  const openEdit = (inspection) => {
    setEditing(inspection);
    setEditForm({
      technicianId: inspection.technicianId || '',
      assetNumber: inspection.assetNumber || '',
      customer: inspection.customer || '',
      location: inspection.location || '',
      availability: inspection.availability || '',
      notes: inspection.notes || '',
    });
    setEditHistory(Array.isArray(inspection.editHistory) ? inspection.editHistory : []);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setIsSavingEdit(true);
    try {
      const me = await User.me();
      const result = await postApi('qcInspectionEdit', {
        inspectionId: editing.id,
        changes: editForm,
        editedBy: me?.displayName || me?.full_name || me?.fullName || me?.email || 'Unknown',
      });
      if (result.changed > 0) {
        const fresh = await QCInspection.get(editing.id);
        setInspections((prev) => prev.map((i) => (i.id === fresh.id ? { ...i, ...fresh } : i)));
        setEditing(fresh);
        setEditHistory(Array.isArray(fresh.editHistory) ? fresh.editHistory : []);
      }
    } catch (e) { alert(`Edit failed: ${e.message}`); }
    finally { setIsSavingEdit(false); }
  };

  const retryDrive = async (inspection) => {
    setDriveNotice('');
    try {
      await postApi('qcInspectionDrive', { inspectionId: inspection.id, action: 'retry' });
      const fresh = await QCInspection.get(inspection.id);
      setInspections((prev) => prev.map((i) => (i.id === fresh.id ? { ...i, ...fresh } : i)));
      setDriveNotice(`Filed for ${techLabel(inspection)}.`);
    } catch (e) { setDriveNotice(`Retry failed for ${techLabel(inspection)}: ${e.message}`); }
  };

  const verifyDrive = async () => {
    setVerifying(true); setDriveNotice('');
    try {
      const result = await postApi('qcInspectionDrive', { action: 'verify' });
      setDriveNotice(`Verified ${result.checked} filed inspections — ${result.missing} missing in Drive.`);
      await loadData();
    } catch (e) { setDriveNotice(`Verify failed: ${e.message}`); }
    finally { setVerifying(false); }
  };

  const exportFile = (type) => {
    const rows = filtered.map((insp) => {
      const when = insp.inspection_date ? new Date(insp.inspection_date) : null;
      return {
        Date: when ? format(when, 'MM/dd/yyyy') : '',
        Time: when ? format(when, 'HH:mm') : '',
        Technician: techLabel(insp),
        'Asset Number': insp.assetNumber || '',
        Customer: insp.customer || '',
        Location: insp.location || '',
        Availability: insp.availability || '',
        'QC Inspector': insp.qcUserName || '',
        Notes: insp.notes || '',
        Photos: (insp.photos || []).length,
        'Drive Status': insp.driveStatus || 'pending',
        'Drive Link': insp.driveLink || '',
      };
    });
    if (type === 'csv') {
      const headers = Object.keys(rows[0] || { Date: '', Technician: '' });
      const csvContent = [headers, ...rows.map((r) => headers.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `qc-inspections-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url); a.remove();
    } else {
      import('xlsx').then((XLSX) => {
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'QC Inspections');
        XLSX.writeFile(wb, `qc-inspections-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      });
    }
  };

  const driveBadge = (insp) => {
    const status = String(insp.driveStatus || 'pending');
    if (status === 'filed') return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Filed</Badge>;
    if (status === 'failed') return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Failed</Badge>;
    if (status === 'missing') return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Missing</Badge>;
    return <Badge variant="outline">Pending</Badge>;
  };

  if (isLoading) return <div className="p-6 flex justify-center items-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">QC Inspections Report</h1>
          <p className="text-gray-600 mt-1">Inspection records, photos, and Drive filing status</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={verifyDrive} disabled={verifying}>
            {verifying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Verify Drive
          </Button>
          <Button variant="outline" onClick={() => exportFile('csv')} disabled={!filtered.length}><Download className="w-4 h-4 mr-2" />CSV</Button>
          <Button onClick={() => exportFile('xlsx')} disabled={!filtered.length}><Download className="w-4 h-4 mr-2" />Excel</Button>
        </div>
      </div>
      {driveNotice && <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800">{driveNotice}</div>}

      <Card>
        <CardHeader><CardTitle className="text-lg">Filters</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div><Label>Date Range</Label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="this_week">This Week</SelectItem>
                  <SelectItem value="last_week">Last Week</SelectItem>
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="last_month">Last Month</SelectItem>
                  <SelectItem value="this_year">This Year</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Technician</Label>
              <Select value={selectedTech} onValueChange={setSelectedTech}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Technicians</SelectItem>
                  {technicians.map((t) => <SelectItem key={t.id} value={t.id}>{techNameOf(t)}</SelectItem>)}
                  <SelectItem value="unmatched">— Unmatched / Legacy —</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Customer</Label>
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  {customers.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>QC Inspector</Label>
              <Select value={selectedQc} onValueChange={setSelectedQc}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Inspectors</SelectItem>
                  {qcs.map((q) => <SelectItem key={q} value={q}>{q}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Availability</Label>
              <Select value={selectedAvailability} onValueChange={setSelectedAvailability}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Drive Status</Label>
              <Select value={driveStatusFilter} onValueChange={setDriveStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="filed">Filed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="missing">Missing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="lg:col-span-2"><Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input placeholder="Notes, technician, asset, customer, location..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
              </div>
            </div>
          </div>
          {dateRange === 'custom' && (
            <div className="grid md:grid-cols-2 gap-4">
              <div><Label>Start Date</Label><Input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} /></div>
              <div><Label>End Date</Label><Input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} /></div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card><CardHeader><CardTitle className="text-lg flex items-center"><FileCheck className="w-5 h-5 mr-2" />Total Inspections</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{filtered.length}</div><p className="text-gray-600 text-sm">in selected period</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-lg">Availability</CardTitle></CardHeader><CardContent>
          <div className="space-y-2">
            <div className="flex justify-between"><span>Yes (photos required)</span><Badge className="bg-green-100 text-green-800 hover:bg-green-100">{summary.availability.yes}</Badge></div>
            <div className="flex justify-between"><span>No</span><Badge variant="outline">{summary.availability.no}</Badge></div>
          </div>
        </CardContent></Card>
        <Card className="lg:col-span-2"><CardHeader><CardTitle className="text-lg">By Technician</CardTitle></CardHeader><CardContent>
          <div className="space-y-2 max-h-36 overflow-y-auto">
            {Object.entries(summary.byTech).sort(([, a], [, b]) => b - a).map(([name, count]) => (
              <div key={name} className="flex justify-between"><span className="truncate">{name}</span><Badge variant="outline">{count}</Badge></div>
            ))}
            {!Object.keys(summary.byTech).length && <p className="text-sm text-gray-500">No inspections in this period.</p>}
          </div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Inspection Records ({filtered.length})</CardTitle></CardHeader>
        <CardContent>
          {filtered.length > 0 ? (
            <div className="space-y-4">
              {filtered.map((insp) => {
                const when = insp.inspection_date ? new Date(insp.inspection_date) : null;
                const photos = insp.photos || [];
                const urls = photoUrls[insp.id] || {};
                return (
                  <div key={insp.id} className="border rounded-lg p-4">
                    <div className="flex flex-wrap justify-between items-start gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={insp.availability === 'yes' ? 'default' : 'outline'}>
                            {insp.availability ? `Available: ${insp.availability}` : 'Availability not set'}
                          </Badge>
                          {driveBadge(insp)}
                        </div>
                        <p className="font-medium mt-2">{techLabel(insp)}</p>
                        <p className="text-sm text-gray-600">
                          {when ? format(when, 'MMM d, yyyy HH:mm') : 'No date'} • QC: {insp.qcUserName || 'Unknown'}
                          {insp.assetNumber ? ` • Asset: ${insp.assetNumber}` : ''}
                          {insp.customer ? ` • Customer: ${insp.customer}` : ''}
                          {insp.location ? ` • Location: ${insp.location}` : ''}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {photos.length > 0 && (
                          <Button size="sm" variant="outline" onClick={() => loadPhotoUrls(insp)}>
                            <ImageIcon className="w-4 h-4 mr-1" />{photos.length} photo{photos.length > 1 ? 's' : ''}
                          </Button>
                        )}
                        {insp.driveLink && (
                          <Button size="sm" variant="outline" onClick={() => window.open(insp.driveLink, '_blank')}>
                            <ExternalLink className="w-4 h-4 mr-1" />Drive
                          </Button>
                        )}
                        {String(insp.driveStatus || 'pending') !== 'filed' && (
                          <Button size="sm" variant="outline" onClick={() => retryDrive(insp)}>
                            <CloudUpload className="w-4 h-4 mr-1" />Retry Drive
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => openEdit(insp)}><Pencil className="w-4 h-4 mr-1" />Edit</Button>
                      </div>
                    </div>
                    {insp.notes && <div className="bg-gray-50 p-3 rounded mt-3"><p className="text-sm whitespace-pre-wrap">{insp.notes}</p></div>}
                    {photos.length > 0 && urls && Object.keys(urls).length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {photos.map((p, idx) => {
                          const path = p.path || p;
                          return urls[path] ? <img key={path} src={urls[path]} alt={`Inspection photo ${idx + 1}`} className="h-24 w-24 object-cover rounded border" /> : null;
                        })}
                      </div>
                    )}
                    {insp.driveError && <p className="text-xs text-red-600 mt-2">Drive error: {insp.driveError}</p>}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <FileCheck className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No inspections found for the selected criteria.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Inspection</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid gap-4 py-2">
              <div className="grid md:grid-cols-2 gap-4">
                <div><Label>Technician</Label>
                  <Select value={editForm.technicianId || ''} onValueChange={(v) => setEditForm((f) => ({ ...f, technicianId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select technician" /></SelectTrigger>
                    <SelectContent>
                      {technicians.map((t) => <SelectItem key={t.id} value={t.id}>{techNameOf(t)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Availability</Label>
                  <Select value={editForm.availability || ''} onValueChange={(v) => setEditForm((f) => ({ ...f, availability: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent><SelectItem value="yes">Yes</SelectItem><SelectItem value="no">No</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label>Asset Number</Label><Input value={editForm.assetNumber || ''} onChange={(e) => setEditForm((f) => ({ ...f, assetNumber: e.target.value }))} /></div>
                <div><Label>Customer</Label><Input value={editForm.customer || ''} onChange={(e) => setEditForm((f) => ({ ...f, customer: e.target.value }))} /></div>
                <div className="md:col-span-2"><Label>Location</Label><Input value={editForm.location || ''} onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))} /></div>
                <div className="md:col-span-2"><Label>Notes</Label><Textarea rows={4} value={editForm.notes || ''} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} /></div>
              </div>
              {(editing.photos || []).length > 0 && (
                <div>
                  <Label>Attached Photos ({(editing.photos || []).length}) — managed with the inspection record</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(editing.photos || []).map((p, idx) => {
                      const path = p.path || p;
                      const u = photoUrls[editing.id]?.[path];
                      return u
                        ? <div key={path} className="relative"><img src={u} alt={`photo ${idx + 1}`} className="h-20 w-20 object-cover rounded border" /></div>
                        : <Button key={path} size="sm" variant="outline" onClick={() => loadPhotoUrls(editing)}>Load photo {idx + 1}</Button>;
                    })}
                  </div>
                </div>
              )}
              {editHistory.length > 0 && (
                <div>
                  <Label>Change History</Label>
                  <div className="border rounded divide-y max-h-40 overflow-y-auto mt-2">
                    {editHistory.slice().reverse().map((h, idx) => (
                      <div key={idx} className="px-3 py-2 text-xs">
                        <span className="font-medium">{h.field}</span>: "{String(h.from ?? '—')}" → "{String(h.to ?? '—')}"
                        <span className="text-gray-500"> — {h.editedBy}, {h.editedAt ? format(new Date(h.editedAt), 'MMM d, yyyy HH:mm') : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={isSavingEdit}>
              {isSavingEdit && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
