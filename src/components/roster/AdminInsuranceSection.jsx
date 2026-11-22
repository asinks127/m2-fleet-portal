import React, { useCallback, useEffect, useState } from 'react';
import { authFetch } from '@/api/authFetch.js';
import { ShieldCheck, Upload, History, Save, X, FileText, ExternalLink, AlertTriangle, CheckCircle, Clock, Loader2, Eye, EyeOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { toast } from 'sonner';

const TYPES = [
  { value: 'workers_comp', label: "Workers' Comp" },
  { value: 'general_liability', label: 'General Liability' },
  { value: 'commercial_auto', label: 'Commercial Auto' },
];

function statusFor(expirationDate) {
  if (!expirationDate) return { label: 'Missing', cls: 'bg-gray-100 text-gray-700' };
  const exp = new Date(expirationDate + 'T23:59:59Z');
  if (Number.isNaN(exp.getTime())) return { label: 'Missing', cls: 'bg-gray-100 text-gray-700' };
  const days = Math.ceil((exp.getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: `Expired ${-days}d ago`, cls: 'bg-red-100 text-red-800' };
  if (days <= 7) return { label: `Critical — ${days}d left`, cls: 'bg-red-100 text-red-800' };
  if (days <= 15) return { label: `Urgent — ${days}d left`, cls: 'bg-orange-100 text-orange-800' };
  if (days <= 30) return { label: `Expiring — ${days}d left`, cls: 'bg-yellow-100 text-yellow-800' };
  if (days <= 60) return { label: `Early warning — ${days}d`, cls: 'bg-amber-100 text-amber-800' };
  return { label: `Active — ${days}d left`, cls: 'bg-green-100 text-green-800' };
}

function fmtPhone(raw) {
  const d = String(raw || '').replace(/\D/g, '').slice(0, 10);
  if (d.length < 3) return d;
  if (d.length < 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

function fmtEIN(raw) {
  const d = String(raw || '').replace(/\D/g, '').slice(0, 9);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}-${d.slice(2)}`;
}

function fmtDOB(raw) {
  const d = String(raw || '').replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

export default function AdminInsuranceSection({ user, onRefresh }) {
  const [policies, setPolicies] = useState(null);
  const [privateInfo, setPrivateInfo] = useState(null);
  const [privateDraft, setPrivateDraft] = useState({});
  const [showPrivate, setShowPrivate] = useState(false);
  const [savingPrivate, setSavingPrivate] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [historyType, setHistoryType] = useState(null);
  const [form, setForm] = useState({});
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [denied, setDenied] = useState(false);

  if (denied) return null;

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await authFetch(`/api/insurance?technician_id=${user.id}`, { credentials: 'include' });
      if (res.status === 403 || res.status === 401) { setDenied(true); setPolicies([]); return; }
      const data = await res.json();
      setPolicies((data.policies || []).filter(p => p.technician_id === user.id));
    } catch {
      setPolicies([]);
    }
    try {
      const res = await authFetch(`/api/rosterPrivate?user_id=${user.id}`, { credentials: 'include' });
      if (res.ok) {
        const info = await res.json();
        const row = info.row || null;
        setPrivateInfo(row);
        setPrivateDraft(row ? {
          ...row,
          date_of_birth_display: row.date_of_birth ? fmtDOB(row.date_of_birth.replace(/-/g, '')) : '',
          ein_display: row.ein || '',
          phone_display: row.phone || '',
        } : {});
      }
    } catch { /* admin-only; non-admins get nothing */ }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const openAdd = (type) => {
    setForm({
      insurance_type: type || 'workers_comp',
      contractor_name: user.full_name || user.display_name || '',
      contractor_email: user.email || '',
      business_name: user.businessName || '',
      carrier: '', policy_number: '', effective_date: '', expiration_date: '', notes: '',
    });
    setFile(null);
    setAddOpen(true);
  };

  const submitPolicy = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await authFetch('/api/insurance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...form, technician_id: user.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save policy');
      const policyId = data.policy?.id;
      if (file && policyId) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('policy_id', policyId);
        const up = await authFetch('/api/insuranceUpload', { method: 'POST', credentials: 'include', body: fd });
        if (!up.ok) {
          const err = await up.json().catch(() => ({}));
          toast.error(err.error || 'Policy saved, but document upload failed.');
        }
      }
      toast.success('Policy saved.');
      setAddOpen(false);
      load();
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const renewPolicy = async (policy) => {
    const exp = window.prompt('New policy expiration date (YYYY-MM-DD). Leave the current document or upload a new one afterwards:', '');
    if (!exp) return;
    try {
      const res = await authFetch('/api/insurance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: policy.id, expiration_date: exp, renew: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Renewal failed');
      toast.success('Policy renewed. Previous record kept in history.');
      load();
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const uploadFor = async (policy) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,image/*';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      const fd = new FormData();
      fd.append('file', f);
      fd.append('policy_id', policy.id);
      const up = await authFetch('/api/insuranceUpload', { method: 'POST', credentials: 'include', body: fd });
      if (up.ok) { toast.success('Document uploaded.'); load(); }
      else toast.error('Upload failed.');
    };
    input.click();
  };

  const savePrivate = async () => {
    setSavingPrivate(true);
    try {
      const { date_of_birth_display, ein_display, phone_display, ...rest } = privateDraft;
      const dobDigits = String(date_of_birth_display || '').replace(/\D/g, '');
      const res = await authFetch('/api/rosterPrivate', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          user_id: user.id,
          ...rest,
          date_of_birth: dobDigits.length === 8 ? `${dobDigits.slice(4)}-${dobDigits.slice(0, 2)}-${dobDigits.slice(2, 4)}` : null,
          ein: ein_display || null,
          phone: phone_display || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast.success('Private info saved.');
      setPrivateInfo(data.row);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingPrivate(false);
    }
  };

  const download = async (p) => {
    try {
      const res = await authFetch(`/api/insuranceDoc?policy_id=${p.id}`, { credentials: 'include' });
      const data = await res.json();
      if (data.signedUrl) window.open(data.signedUrl, '_blank');
      else toast.error(data.error || 'No document on file.');
    } catch { toast.error('Could not open document.'); }
  };

  const currentByType = {};
  for (const t of TYPES) {
    currentByType[t.value] = (policies || [])
      .filter(p => p.insurance_type === t.value)
      .sort((a, b) => (b.expiration_date || '').localeCompare(a.expiration_date || ''))[0] || null;
  }

  return (
    <Card className="border-blue-200 bg-blue-50/40">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="w-4 h-4 text-blue-600" />
          Insurance Compliance <span className="text-xs font-normal text-gray-500">(admin only)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {TYPES.map(t => {
            const p = currentByType[t.value];
            const st = statusFor(p?.expiration_date);
            return (
              <div key={t.value} className="rounded-lg border bg-white p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-600">{t.label}</span>
                  <Badge className={st.cls}>{st.label}</Badge>
                </div>
                {p ? (
                  <div className="text-xs text-gray-600 space-y-0.5">
                    <div className="font-medium text-gray-800">{p.carrier || 'Carrier not set'}</div>
                    <div>Policy #: {p.policy_number || '—'}</div>
                    <div>Expires: {p.expiration_date || '—'}</div>
                  </div>
                ) : (
                  <div className="text-xs text-gray-500">No policy on file.</div>
                )}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openAdd(t.value)}>
                    <Upload className="w-3 h-3 mr-1" /> Add
                  </Button>
                  {p && (
                    <>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => renewPolicy(p)}>
                        <Clock className="w-3 h-3 mr-1" /> Renew
                      </Button>
                      {p.document_path && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => download(p)}>
                          <ExternalLink className="w-3 h-3 mr-1" /> Doc
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setHistoryType(historyType === t.value ? null : t.value)}>
                        <History className="w-3 h-3 mr-1" /> History
                      </Button>
                    </>
                  )}
                </div>
                {historyType === t.value && (
                  <div className="mt-2 border-t pt-2 space-y-1">
                    {(policies || []).filter(x => x.insurance_type === t.value).map(h => (
                      <div key={h.id} className="flex items-center justify-between text-[11px] text-gray-600">
                        <span>{h.expiration_date || 'no exp.'} · {h.is_current === false ? 'historical' : 'current'} · {h.policy_number || '—'}</span>
                        {h.document_path && (
                          <button className="text-blue-600 hover:underline inline-flex items-center" onClick={() => download(h)}>
                            <FileText className="w-3 h-3 mr-0.5" /> doc
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Private info (DOB/EIN/address) — admin eyes only */}
        <div className="rounded-lg border bg-white p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600">Private Info (DOB, EIN, Address)</span>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowPrivate(!showPrivate)}>
              {showPrivate ? <><EyeOff className="w-3 h-3 mr-1" /> Hide</> : <><Eye className="w-3 h-3 mr-1" /> Show / Edit</>}
            </Button>
          </div>
          {showPrivate && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Date of Birth (MM/DD/YYYY)</Label>
                <Input className="h-8 text-sm" value={privateDraft.date_of_birth_display || privateInfo?.date_of_birth || ''}
                  onChange={e => setPrivateDraft(d => ({ ...d, date_of_birth_display: fmtDOB(e.target.value) }))}
                  placeholder="MM/DD/YYYY" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">EIN (XX-XXXXXXX)</Label>
                <Input className="h-8 text-sm" value={privateDraft.ein_display || privateInfo?.ein || ''}
                  onChange={e => setPrivateDraft(d => ({ ...d, ein_display: fmtEIN(e.target.value) }))}
                  placeholder="XX-XXXXXXX" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Phone</Label>
                <Input className="h-8 text-sm" value={privateDraft.phone_display || privateInfo?.phone || ''}
                  onChange={e => setPrivateDraft(d => ({ ...d, phone_display: fmtPhone(e.target.value) }))}
                  placeholder="(XXX) XXX-XXXX" />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs">Street Address</Label>
                <Input className="h-8 text-sm" value={privateDraft.address_street || ''} onChange={e => setPrivateDraft(d => ({ ...d, address_street: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Address Line 2</Label>
                <Input className="h-8 text-sm" value={privateDraft.address_line2 || ''} onChange={e => setPrivateDraft(d => ({ ...d, address_line2: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">City</Label>
                <Input className="h-8 text-sm" value={privateDraft.city || ''} onChange={e => setPrivateDraft(d => ({ ...d, city: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">State</Label>
                <Input className="h-8 text-sm" value={privateDraft.state || ''} onChange={e => setPrivateDraft(d => ({ ...d, state: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">ZIP</Label>
                <Input className="h-8 text-sm" value={privateDraft.zip || ''} onChange={e => setPrivateDraft(d => ({ ...d, zip: e.target.value }))} />
              </div>
              <div className="md:col-span-3 flex justify-end">
                <Button size="sm" className="h-8 text-xs" onClick={savePrivate} disabled={savingPrivate}>
                  {savingPrivate ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                  Save Private Info
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Add / upload policy dialog */}
        {addOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setAddOpen(false)}>
            <form className="bg-white rounded-xl shadow-xl w-full max-w-lg p-5 space-y-3" onClick={e => e.stopPropagation()} onSubmit={submitPolicy}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Add Insurance Policy — {user.full_name || user.display_name}</h3>
                <button type="button" onClick={() => setAddOpen(false)}><X className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Insurance Type</Label>
                  <select className="w-full h-8 rounded border text-sm" value={form.insurance_type}
                    onChange={e => setForm(f => ({ ...f, insurance_type: e.target.value }))}>
                    {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Carrier / Provider</Label>
                  <Input className="h-8 text-sm" value={form.carrier || ''} onChange={e => setForm(f => ({ ...f, carrier: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Policy Number</Label>
                  <Input className="h-8 text-sm" value={form.policy_number || ''} onChange={e => setForm(f => ({ ...f, policy_number: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Business Name</Label>
                  <Input className="h-8 text-sm" value={form.business_name || ''} onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Effective Date</Label>
                  <Input type="date" className="h-8 text-sm" value={form.effective_date || ''} onChange={e => setForm(f => ({ ...f, effective_date: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Expiration Date</Label>
                  <Input type="date" required className="h-8 text-sm" value={form.expiration_date || ''} onChange={e => setForm(f => ({ ...f, expiration_date: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Notes</Label>
                <Textarea rows={2} className="text-sm" value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Policy / COI Document (PDF or image)</Label>
                <input type="file" accept="application/pdf,image/*" className="text-sm" onChange={e => setFile(e.target.files?.[0] || null)} />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button type="submit" size="sm" disabled={submitting}>
                  {submitting ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                  Save Policy
                </Button>
              </div>
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
