import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarClock, CheckCircle2, Download, FileUp, History, Loader2, PlusCircle, RefreshCw, Search, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx';
import { format, parseISO } from 'date-fns';
import { authFetch, authDownload } from '@/api/authFetch.js';

const TYPES = [
  { value: 'workers_comp', label: "Workers' Comp" },
  { value: 'general_liability', label: 'General Liability' },
  { value: 'commercial_auto', label: 'Commercial Auto' },
];
const typeLabel = v => TYPES.find(t => t.value === v)?.label || v;

const STATUS_STYLES = {
  Active: 'bg-green-100 text-green-800',
  'Early Warning': 'bg-yellow-100 text-yellow-800',
  'Expiring Soon': 'bg-orange-100 text-orange-800',
  Urgent: 'bg-orange-200 text-orange-900',
  Critical: 'bg-red-100 text-red-800',
  Expired: 'bg-red-200 text-red-900',
  Missing: 'bg-gray-200 text-gray-700',
};
const statusIcon = s =>
  s === 'Active' ? <CheckCircle2 className="h-3.5 w-3.5" /> :
  s === 'Expired' ? <XCircle className="h-3.5 w-3.5" /> :
  s === 'Missing' ? <ShieldAlert className="h-3.5 w-3.5" /> :
  <AlertTriangle className="h-3.5 w-3.5" />;

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status] || 'bg-gray-100 text-gray-800'}`}>
      {statusIcon(status)}{status}
    </span>
  );
}

const EMPTY_FORM = {
  id: null, technician_id: '', contractor_name: '', business_name: '',
  insurance_type: 'workers_comp', carrier: '', policy_number: '',
  effective_date: '', expiration_date: '', notes: '',
};

export default function InsuranceManagement() {
  const qc = useQueryClient();
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [historyFor, setHistoryFor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState('');
  const [renewSource, setRenewSource] = useState(null);

  // All insurance API calls require an authenticated admin session.
  const { data, isLoading, error } = useQuery({
    queryKey: ['insurance-overview'],
    queryFn: async () => {
      const r = await authFetch('/api/insurance');
      if (!r.ok) throw new Error((await r.json()).error || 'Failed to load');
      return r.json();
    },
    refetchInterval: 5 * 60 * 1000,
  });

  const policies = data?.policies || [];
  const summary = data?.summary || {};
  const alerts = data?.alerts || [];
  const missing = data?.missing || [];

  const filtered = useMemo(() => policies.filter(p => {
    if (typeFilter !== 'all' && p.insurance_type !== typeFilter) return false;
    if (statusFilter !== 'all') {
      const s = p.policy_status;
      const ok = statusFilter === 'active' ? s === 'Active' || s === 'Early Warning'
        : statusFilter === 'expiring' ? ['Early Warning', 'Expiring Soon', 'Urgent', 'Critical'].includes(s)
        : statusFilter === 'expired' ? s === 'Expired' : s === 'Missing';
      if (!ok) return false;
    }
    if (search) {
      const hay = `${p.contractor_name || ''} ${p.business_name || ''} ${p.carrier || ''} ${p.policy_number || ''}`.toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  }), [policies, typeFilter, statusFilter, search]);

  const openAdd = useCallback(() => { setForm(EMPTY_FORM); setRenewSource(null); setPendingFile(null); setFormError(''); setShowForm(true); }, []);
  const openEdit = useCallback(p => {
    setForm({
      id: p.id, technician_id: p.technician_id || '', contractor_name: p.contractor_name || '',
      business_name: p.business_name || '', insurance_type: p.insurance_type, carrier: p.carrier || '',
      policy_number: p.policy_number || '', effective_date: p.effective_date || '',
      expiration_date: p.expiration_date || '', notes: p.notes || '',
    });
    setRenewSource(null); setPendingFile(null); setFormError(''); setShowForm(true);
  }, []);
  const openRenew = useCallback(p => {
    setForm({ ...EMPTY_FORM,
      technician_id: p.technician_id || '', contractor_name: p.contractor_name || '',
      business_name: p.business_name || '', insurance_type: p.insurance_type,
      carrier: p.carrier || '', effective_date: p.expiration_date || '',
    });
    setRenewSource(p); setPendingFile(null); setFormError(''); setShowForm(true);
  }, []);

  const handleSave = async e => {
    e.preventDefault();
    setFormError(''); setSaving(true);
    try {
      const payload = { ...form, renew_from_id: renewSource ? renewSource.id : null };
      const r = await authFetch('/api/insurance', {
        method: form.id ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Save failed');
      const saved = (await r.json())?.policy;
      // Upload the staged Certificate of Insurance, if any, to the saved policy
      if (pendingFile && saved?.id) {
        try {
          setUploading(true);
          const fd = new FormData();
          fd.append('policy_id', saved.id);
          fd.append('file', pendingFile);
          const up = await authFetch('/api/insuranceUpload', { method: 'POST', body: fd });
          if (!up.ok) throw new Error((await up.json()).error || 'Upload failed');
        } catch (upErr) {
          setFormError(`Policy saved, but the certificate upload failed: ${upErr.message}`);
          setSaving(false); setPendingFile(null);
          qc.invalidateQueries({ queryKey: ['insurance-overview'] });
          return;
        } finally {
          setUploading(false);
        }
      }
      setPendingFile(null);
      setShowForm(false); setRenewSource(null); setPendingFile(null);
      qc.invalidateQueries({ queryKey: ['insurance-overview'] });
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (policy, file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('policy_id', policy.id);
      fd.append('file', file);
      const r = await authFetch('/api/insuranceUpload', { method: 'POST', body: fd });
      if (!r.ok) throw new Error((await r.json()).error || 'Upload failed');
      qc.invalidateQueries({ queryKey: ['insurance-overview'] });
    } catch (err) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async policy => {
    try {
      const r = await authFetch(`/api/insuranceDoc?policy_id=${policy.id}`);
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.signedUrl) { alert(data.error || 'Download failed'); return; }
      window.open(data.signedUrl, '_blank');
    } catch (err) {
      alert(err.message || 'Download failed');
    }
  };

  const downloadExport = (params, fallbackName) => {
    const qs = new URLSearchParams({ ...params }).toString();
    authDownload(`/api/insuranceExport?${qs}`, fallbackName).catch(err => alert(err.message));
  };

  if (isLoading) return <div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  if (error) return <div className="p-6 text-red-600">{error.message}</div>;

  const alertTone = { 'Early Warning': 'border-yellow-400', 'Expiring Soon': 'border-orange-400', Urgent: 'border-orange-500', Critical: 'border-red-500', Expired: 'border-red-600' };

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Insurance Management</h1>
          <p className="text-sm text-muted-foreground">Workers' Comp, General Liability & Commercial Auto — admin only</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => downloadExport({ format: 'xlsx', consolidated: 1 }, 'insurance-report.xlsx')}>
            <Download className="mr-2 h-4 w-4" />Excel
          </Button>
          <Button variant="outline" onClick={() => downloadExport({ format: 'csv', consolidated: 1 }, 'insurance-report.csv')}>
            <Download className="mr-2 h-4 w-4" />CSV
          </Button>
          <Button onClick={openAdd}><PlusCircle className="mr-2 h-4 w-4" />Add Policy</Button>
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {[
          { label: 'Active Policies', value: summary.active, icon: ShieldCheck, tone: 'text-green-600' },
          { label: 'Expiring ≤ 60 Days', value: summary.expiring_60, icon: CalendarClock, tone: 'text-yellow-600' },
          { label: 'Expiring ≤ 30 Days', value: summary.expiring_30, icon: CalendarClock, tone: 'text-orange-600' },
          { label: 'Expired', value: summary.expired, icon: XCircle, tone: 'text-red-600' },
          { label: 'Missing Coverage', value: summary.contractors_missing, icon: ShieldAlert, tone: 'text-gray-600' },
        ].map(c => (
          <Card key={c.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <c.icon className={`h-8 w-8 ${c.tone}`} />
              <div>
                <div className="text-2xl font-bold">{c.value ?? 0}</div>
                <div className="text-xs text-muted-foreground">{c.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alerts */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-orange-500" />Expiration Alerts</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {alerts.length === 0 && <p className="text-sm text-muted-foreground">No expiration alerts — all current policies are more than 60 days out.</p>}
          {alerts.map(a => (
            <button key={a.id} onClick={() => openEdit(a)} className={`flex w-full items-center justify-between rounded-md border-l-4 ${alertTone[a.policy_status] || 'border-gray-300'} bg-muted/40 px-3 py-2 text-left hover:bg-muted`}>
              <div className="text-sm">
                <span className="font-medium">{a.contractor_name || 'Unknown'}</span>
                <span className="text-muted-foreground"> — {typeLabel(a.insurance_type)} · expires {a.expiration_date ? format(parseISO(a.expiration_date), 'MMM d, yyyy') : '—'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{a.days_until_expiration <= 0 ? 'Expired' : `${a.days_until_expiration} days left`}</span>
                <StatusBadge status={a.policy_status} />
              </div>
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Filters + table */}
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-base">Policies</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="w-48 pl-8" placeholder="Search name, carrier, policy #" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expiring">Expiring</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="missing">Missing</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3">Contractor</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Carrier</th>
                <th className="py-2 pr-3">Policy #</th>
                <th className="py-2 pr-3">Effective</th>
                <th className="py-2 pr-3">Expires</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Doc</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="py-2 pr-3">
                    <div className="font-medium">{p.contractor_name || '—'}</div>
                    {p.business_name && <div className="text-xs text-muted-foreground">{p.business_name}</div>}
                  </td>
                  <td className="py-2 pr-3">{typeLabel(p.insurance_type)}</td>
                  <td className="py-2 pr-3">{p.carrier || '—'}</td>
                  <td className="py-2 pr-3">{p.policy_number || '—'}</td>
                  <td className="py-2 pr-3">{p.effective_date ? format(parseISO(p.effective_date), 'MM/dd/yyyy') : '—'}</td>
                  <td className="py-2 pr-3">{p.expiration_date ? format(parseISO(p.expiration_date), 'MM/dd/yyyy') : '—'}</td>
                  <td className="py-2 pr-3"><StatusBadge status={p.policy_status} /></td>
                  <td className="py-2 pr-3">
                    {p.document_path
                      ? <Button variant="ghost" size="sm" onClick={() => handleDownload(p)}><Download className="h-4 w-4" /></Button>
                      : <span className="text-xs text-muted-foreground">none</span>}
                  </td>
                  <td className="py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>Edit</Button>
                      <Button variant="ghost" size="sm" onClick={() => openRenew(p)}><RefreshCw className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => setHistoryFor(p)}><History className="h-4 w-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={9} className="py-6 text-center text-muted-foreground">No policies match the current filters.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Missing coverage */}
      {missing.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Contractors Missing Required Insurance</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {missing.map(m => (
              <div key={m.user_id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <div>
                  <span className="font-medium">{m.name}</span>
                  {m.business_name && <span className="text-muted-foreground"> · {m.business_name}</span>}
                </div>
                <div className="flex gap-1">
                  {m.missing_types.map(t => <Badge key={t} variant="outline">Missing {typeLabel(t)}</Badge>)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Add / Edit / Renew dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{renewSource ? `Renew — ${renewSource.contractor_name || ''} ${typeLabel(renewSource.insurance_type)}` : form.id ? 'Edit Policy' : 'Add Policy'}</DialogTitle>
          </DialogHeader>
          {renewSource && (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800">
              Renewal of policy expiring {renewSource.expiration_date}. The old record is kept in history and marked superseded.
            </div>
          )}
          <form onSubmit={handleSave} className="grid grid-cols-2 gap-3">
            <label className="col-span-2 text-xs font-medium">Contractor
              <Input required value={form.contractor_name} onChange={e => setForm({ ...form, contractor_name: e.target.value })} />
            </label>
            <label className="text-xs font-medium">Business Name
              <Input value={form.business_name} onChange={e => setForm({ ...form, business_name: e.target.value })} />
            </label>
            <label className="text-xs font-medium">Insurance Type
              <Select value={form.insurance_type} onValueChange={v => setForm({ ...form, insurance_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </label>
            <label className="text-xs font-medium">Carrier / Provider
              <Input value={form.carrier} onChange={e => setForm({ ...form, carrier: e.target.value })} />
            </label>
            <label className="text-xs font-medium">Policy Number
              <Input value={form.policy_number} onChange={e => setForm({ ...form, policy_number: e.target.value })} />
            </label>
            <label className="text-xs font-medium">Effective Date
              <Input type="date" value={form.effective_date} onChange={e => setForm({ ...form, effective_date: e.target.value })} />
            </label>
            <label className="text-xs font-medium">Expiration Date
              <Input type="date" value={form.expiration_date} onChange={e => setForm({ ...form, expiration_date: e.target.value })} />
            </label>
            <label className="col-span-2 text-xs font-medium">Notes
              <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </label>
            <div className="col-span-2 rounded-md border border-dashed p-3">
              <label className="text-xs font-medium">Certificate of Insurance / Policy Document (PDF or image)</label>
              <p className="mb-2 text-xs text-muted-foreground">Attached automatically when you save. You can also replace it later from the policy card.</p>
              <Input
                type="file"
                accept="application/pdf,image/*"
                disabled={saving || uploading}
                onChange={e => setPendingFile(e.target.files?.[0] || null)}
              />
              {pendingFile && (
                <div className="mt-2 flex items-center justify-between rounded bg-muted px-2 py-1 text-xs">
                  <span className="truncate">{pendingFile.name} ({Math.ceil(pendingFile.size / 1024)} KB)</span>
                  <button type="button" className="text-red-600 hover:underline" onClick={() => setPendingFile(null)}>Remove</button>
                </div>
              )}
            </div>
            {formError && <p className="col-span-2 text-sm text-red-600">{formError}</p>}
            <div className="col-span-2 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); setPendingFile(null); }}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{renewSource ? 'Create Renewal' : 'Save'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* History dialog */}
      <Dialog open={!!historyFor} onOpenChange={() => setHistoryFor(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Policy History — {historyFor?.contractor_name}</DialogTitle></DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-1 pr-2">Effective</th><th className="py-1 pr-2">Expires</th>
                <th className="py-1 pr-2">Carrier</th><th className="py-1 pr-2">Status</th><th className="py-1">Created</th>
              </tr></thead>
              <tbody>
                {policies
                  .filter(p => (historyFor?.technician_id && p.technician_id === historyFor.technician_id) || (historyFor?.contractor_name && p.contractor_name === historyFor.contractor_name))
                  .filter(p => p.insurance_type === historyFor?.insurance_type)
                  .sort((a, b) => (b.effective_date || '').localeCompare(a.effective_date || ''))
                  .map(p => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-1.5 pr-2">{p.effective_date || '—'}</td>
                      <td className="py-1.5 pr-2">{p.expiration_date || '—'}</td>
                      <td className="py-1.5 pr-2">{p.carrier || '—'}</td>
                      <td className="py-1.5 pr-2">{p.id === historyFor?.id ? <StatusBadge status={p.policy_status} /> : <span className="text-xs text-muted-foreground">{p.is_current ? 'Superseded' : 'Historical'}</span>}</td>
                      <td className="py-1.5">{(p.created_at || '').slice(0, 10)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
