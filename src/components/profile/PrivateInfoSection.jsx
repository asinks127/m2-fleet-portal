// Private technician info (DOB, EIN/SSN, physical address) — admin eyes only.
// Backed by /api/rosterPrivate and the ContractorPrivateInfo table, the same
// store used by the TechRoster private-info section.
import React, { useCallback, useEffect, useState } from 'react';
import { authFetch } from '@/api/authFetch.js';
import { Save, Loader2, Eye, EyeOff, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { toast } from 'sonner';

function fmtDOB(raw) {
  const d = String(raw || '').replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

// Accepts either EIN (XX-XXXXXXX) or SSN (XXX-XX-XXXX) entry.
function fmtEinOrSsn(raw) {
  const d = String(raw || '').replace(/\D/g, '').slice(0, 9);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
}

const EMPTY_DRAFT = {
  date_of_birth_display: '',
  ein_display: '',
  phone_display: '',
  address_street: '',
  address_line2: '',
  city: '',
  state: '',
  zip: '',
};

export default function PrivateInfoSection({ user }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [denied, setDenied] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await authFetch(`/api/rosterPrivate?user_id=${user.id}`, { credentials: 'include' });
      if (res.status === 401 || res.status === 403) { setDenied(true); return; }
      const data = await res.json();
      const row = data.row || null;
      setInfo(row);
      setDraft(row ? {
        ...EMPTY_DRAFT,
        ...row,
        date_of_birth_display: row.date_of_birth ? fmtDOB(row.date_of_birth.replace(/-/g, '')) : '',
        ein_display: row.ein || '',
        phone_display: row.phone || '',
      } : { ...EMPTY_DRAFT });
    } catch {
      setDenied(true);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  if (denied) return null;

  const save = async () => {
    setSaving(true);
    try {
      const { date_of_birth_display, ein_display, phone_display, ...rest } = draft;
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
      const row = data.row;
      setInfo(row);
      setDraft(row ? {
        ...EMPTY_DRAFT,
        ...row,
        date_of_birth_display: row.date_of_birth ? fmtDOB(row.date_of_birth.replace(/-/g, '')) : '',
        ein_display: row.ein || '',
        phone_display: row.phone || '',
      } : draft);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mt-4 border-blue-200 bg-blue-50/40">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Lock className="w-4 h-4 text-blue-600" />
          Private Info — DOB, EIN/SSN &amp; Address
          <span className="text-xs font-normal text-gray-500">(admin only)</span>
          <Button size="sm" variant="ghost" className="ml-auto h-7 text-xs" onClick={() => setVisible(!visible)}>
            {visible ? <><EyeOff className="w-3 h-3 mr-1" /> Hide</> : <><Eye className="w-3 h-3 mr-1" /> Show / Edit</>}
          </Button>
        </CardTitle>
      </CardHeader>
      {visible && (
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Date of Birth (MM/DD/YYYY)</Label>
              <Input className="h-8 text-sm" value={draft.date_of_birth_display || ''}
                onChange={e => setDraft(d => ({ ...d, date_of_birth_display: fmtDOB(e.target.value) }))}
                placeholder="MM/DD/YYYY" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">EIN / SSN</Label>
              <Input className="h-8 text-sm" value={draft.ein_display || ''}
                onChange={e => setDraft(d => ({ ...d, ein_display: fmtEinOrSsn(e.target.value) }))}
                placeholder="XX-XXXXXXX or XXX-XX-XXXX" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Phone</Label>
              <Input className="h-8 text-sm" value={draft.phone_display || ''}
                onChange={e => setDraft(d => ({ ...d, phone_display: e.target.value }))}
                placeholder="Contact number" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Physical Street Address</Label>
              <Input className="h-8 text-sm" value={draft.address_street || ''}
                onChange={e => setDraft(d => ({ ...d, address_street: e.target.value }))}
                placeholder="Street address" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Address Line 2</Label>
              <Input className="h-8 text-sm" value={draft.address_line2 || ''}
                onChange={e => setDraft(d => ({ ...d, address_line2: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">City</Label>
              <Input className="h-8 text-sm" value={draft.city || ''}
                onChange={e => setDraft(d => ({ ...d, city: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">State</Label>
              <Input className="h-8 text-sm" value={draft.state || ''}
                onChange={e => setDraft(d => ({ ...d, state: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">ZIP</Label>
              <Input className="h-8 text-sm" value={draft.zip || ''}
                onChange={e => setDraft(d => ({ ...d, zip: e.target.value }))} />
            </div>
            <div className="md:col-span-3 flex justify-end">
              <Button size="sm" className="h-8 text-xs" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                Save Private Info
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
