import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ManagerCallLog, ExternalManager, User } from '@/api/entities.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog.jsx';
import { Phone, Download, Search, Loader2, Pencil } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';

const roleOf = (manager) => {
  const role = String(manager?.role || '').toLowerCase();
  if (role.includes('qc') || role.includes('quality')) return 'QC';
  if (role.includes('pm') || role.includes('manager') || role.includes('project')) return 'PM';
  return 'Other';
};
const nameOf = (m) => m?.name || m?.managerName || m?.displayName || 'Unknown';

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

export default function VeloPMQCCallsReport() {
  const [calls, setCalls] = useState([]);
  const [managers, setManagers] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState('this_month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedManager, setSelectedManager] = useState('all');
  const [selectedRole, setSelectedRole] = useState('all');
  const [selectedTech, setSelectedTech] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [callRows, managerRows, users] = await Promise.all([
        ManagerCallLog.list('-callDate', 3000),
        ExternalManager.list(),
        User.list(),
      ]);
      setCalls(Array.isArray(callRows) ? callRows : []);
      setManagers(Array.isArray(managerRows) ? managerRows.filter((m) => m.active !== false) : []);
      setTechnicians((Array.isArray(users) ? users : []).filter((u) => u.email && (
        u.email.toLowerCase().includes('.contractor@m2fleetcom.com') ||
        u.email.toLowerCase().includes('.contractor@smcinstallations.com')
      )));
    } catch (error) {
      console.error('Error loading Velociti calls:', error);
      setCalls([]);
    } finally { setIsLoading(false); }
  };

  const managerById = useMemo(() => new Map(managers.map((m) => [String(m.id), m])), [managers]);
  const techById = useMemo(() => {
    const m = new Map();
    technicians.forEach((t) => m.set(String(t.id), t));
    return m;
  }, [technicians]);
  const techName = useCallback((id) => {
    const t = techById.get(String(id));
    return t ? (t.displayName || t.full_name || t.fullName || t.name || t.email) : null;
  }, [techById]);

  const getDateRange = useCallback(() => {
    const now = new Date();
    const weekStartsOn = 5;
    switch (dateRange) {
      case 'today': { const s = new Date(now); s.setHours(0, 0, 0, 0); const e = new Date(now); e.setHours(23, 59, 59, 999); return { start: s, end: e }; }
      case 'this_week': return { start: startOfWeek(now, { weekStartsOn }), end: endOfWeek(now, { weekStartsOn }) };
      case 'last_week': { const lw = subDays(now, 7); return { start: startOfWeek(lw, { weekStartsOn }), end: endOfWeek(lw, { weekStartsOn }) }; }
      case 'this_month': return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'last_month': { const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1); return { start: startOfMonth(lm), end: endOfMonth(lm) }; }
      case 'custom': {
        const start = customStartDate ? new Date(`${customStartDate}T00:00:00`) : startOfWeek(now, { weekStartsOn });
        const end = customEndDate ? new Date(`${customEndDate}T23:59:59.999`) : endOfWeek(now, { weekStartsOn });
        return { start, end };
      }
      default: return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  }, [dateRange, customStartDate, customEndDate]);

  const filtered = useMemo(() => {
    const { start, end } = getDateRange();
    return calls.filter((call) => {
      const rawDate = call.callDate || call.created_at;
      const d = rawDate ? new Date(rawDate) : null;
      if (!d || Number.isNaN(d.getTime()) || d < start || d > end) return false;
      const manager = managerById.get(String(call.managerId));
      if (selectedManager !== 'all' && String(call.managerId) !== String(selectedManager)) return false;
      if (selectedRole !== 'all' && roleOf(manager) !== selectedRole) return false;
      if (selectedTech !== 'all') {
        if (selectedTech === 'none') { if (call.technicianId) return false; }
        else if (String(call.technicianId || '') !== String(selectedTech)) return false;
      }
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const managerName = manager ? nameOf(manager).toLowerCase() : '';
        const techNameLower = call.technicianId ? (call.technicianName || techName(call.technicianId) || '').toLowerCase() : '';
        const notes = String(call.note || call.notes || '').toLowerCase();
        if (!notes.includes(s) && !managerName.includes(s) && !techNameLower.includes(s)) return false;
      }
      return true;
    });
  }, [calls, getDateRange, selectedManager, selectedRole, selectedTech, searchTerm, managerById, techName]);

  const summary = useMemo(() => {
    const byManager = {}; const byRole = { PM: 0, QC: 0, Other: 0 };
    filtered.forEach((call) => {
      const manager = managerById.get(String(call.managerId));
      if (manager) {
        const label = `${nameOf(manager)} (${roleOf(manager)})`;
        byManager[label] = (byManager[label] || 0) + 1;
        byRole[roleOf(manager)] += 1;
      } else {
        byManager['Unknown'] = (byManager['Unknown'] || 0) + 1;
      }
    });
    return { byManager, byRole };
  }, [filtered, managerById]);

  const exportFile = (type) => {
    const rows = filtered.map((call) => {
      const when = call.callDate ? new Date(call.callDate) : null;
      const manager = managerById.get(String(call.managerId));
      return {
        Date: when ? format(when, 'MM/dd/yyyy') : '',
        Time: when ? format(when, 'HH:mm') : '',
        'Velociti Contact': manager ? nameOf(manager) : call.managerId || 'Unknown',
        Role: manager ? roleOf(manager) : 'Unknown',
        Technician: call.technicianId ? (call.technicianName || techName(call.technicianId) || '') : '',
        'Logged By': call.loggedBy || '',
        Notes: call.note || call.notes || '',
      };
    });
    if (type === 'csv') {
      const headers = Object.keys(rows[0] || { Date: '', 'Velociti Contact': '' });
      const csvContent = [headers, ...rows.map((r) => headers.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `velociti-pm-qc-calls-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url); a.remove();
    } else {
      import('xlsx').then((XLSX) => {
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'PM & QC Calls');
        XLSX.writeFile(wb, `velociti-pm-qc-calls-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      });
    }
  };

  const openEdit = (call) => {
    setEditing(call);
    setEditForm({ notes: String(call.note || call.notes || ''), technicianId: call.technicianId || '' });
  };

  const saveEdit = async () => {
    if (!editing) return;
    setIsSaving(true);
    try {
      const updates = { notes: editForm.notes };
      if (editForm.technicianId) {
        const t = techById.get(String(editForm.technicianId));
        updates.technicianId = editForm.technicianId;
        updates.technicianName = t ? (t.displayName || t.full_name || t.fullName || t.name || t.email) : null;
      } else {
        updates.technicianId = null;
        updates.technicianName = null;
      }
      await ManagerCallLog.update(editing.id, updates);
      setCalls((prev) => prev.map((c) => (c.id === editing.id ? { ...c, ...updates, note: updates.notes } : c)));
      setEditing(null);
    } catch (e) { alert(`Edit failed: ${e.message}`); }
    finally { setIsSaving(false); }
  };

  if (isLoading) return <div className="p-6 flex justify-center items-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Velociti PM & QC Calls Report</h1>
          <p className="text-gray-600 mt-1">Communication history with Velociti Project Managers and Quality Control personnel</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportFile('csv')} disabled={!filtered.length}><Download className="w-4 h-4 mr-2" />CSV</Button>
          <Button onClick={() => exportFile('xlsx')} disabled={!filtered.length}><Download className="w-4 h-4 mr-2" />Excel</Button>
        </div>
      </div>

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
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Velociti Contact</Label>
              <Select value={selectedManager} onValueChange={setSelectedManager}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Contacts</SelectItem>
                  {managers.map((m) => <SelectItem key={m.id} value={m.id}>{nameOf(m)} ({roleOf(m)})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Role</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="PM">PM</SelectItem>
                  <SelectItem value="QC">QC</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Associated Technician</Label>
              <Select value={selectedTech} onValueChange={setSelectedTech}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All / Any</SelectItem>
                  {technicians.map((t) => <SelectItem key={t.id} value={t.id}>{t.displayName || t.full_name || t.fullName || t.email}</SelectItem>)}
                  <SelectItem value="none">— No technician linked —</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="lg:col-span-2"><Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input placeholder="Search notes, contacts, technicians..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
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

      <div className="grid md:grid-cols-3 gap-6">
        <Card><CardHeader><CardTitle className="text-lg flex items-center"><Phone className="w-5 h-5 mr-2" />Total Calls</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{filtered.length}</div><p className="text-gray-600 text-sm">in selected period</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-lg">By Role</CardTitle></CardHeader><CardContent>
          <div className="space-y-2">
            <div className="flex justify-between"><span>Project Managers</span><Badge variant="outline">{summary.byRole.PM}</Badge></div>
            <div className="flex justify-between"><span>Quality Control</span><Badge variant="outline">{summary.byRole.QC}</Badge></div>
            <div className="flex justify-between"><span>Other</span><Badge variant="outline">{summary.byRole.Other}</Badge></div>
          </div>
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-lg">Most Contacted</CardTitle></CardHeader><CardContent>
          <div className="space-y-2 max-h-36 overflow-y-auto">
            {Object.entries(summary.byManager).sort(([, a], [, b]) => b - a).slice(0, 8).map(([name, count]) => (
              <div key={name} className="flex justify-between"><span className="truncate">{name}</span><Badge variant="outline">{count}</Badge></div>
            ))}
            {!Object.keys(summary.byManager).length && <p className="text-sm text-gray-500">No calls in this period.</p>}
          </div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Call History ({filtered.length} records)</CardTitle></CardHeader>
        <CardContent>
          {filtered.length > 0 ? (
            <div className="space-y-4">
              {filtered.map((call) => {
                const when = call.callDate ? new Date(call.callDate) : null;
                const manager = managerById.get(String(call.managerId));
                const tech = call.technicianId ? (call.technicianName || techName(call.technicianId)) : null;
                return (
                  <div key={call.id} className="border rounded-lg p-4">
                    <div className="flex flex-wrap justify-between items-start gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline">{manager ? roleOf(manager) : 'Unknown role'}</Badge>
                          {tech && <Badge variant="secondary">Tech: {tech}</Badge>}
                        </div>
                        <p className="font-medium mt-2">{manager ? nameOf(manager) : 'Unknown Contact'}</p>
                        <p className="text-sm text-gray-600">
                          {when ? format(when, 'MMM d, yyyy HH:mm') : 'No date'} • Logged by: {call.loggedBy || 'Unknown'}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => openEdit(call)}><Pencil className="w-4 h-4 mr-1" />Edit</Button>
                    </div>
                    <div className="bg-gray-50 p-3 rounded mt-3"><p className="text-sm whitespace-pre-wrap">{call.note || call.notes || '(no notes)'}</p></div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Phone className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No Velociti calls found for the selected criteria.</p>
              <p className="text-xs mt-2">Log calls to Velociti PMs and QCs from the QC Board → Managers tab.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Call Log</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div><Label>Notes</Label>
              <textarea
                className="w-full border rounded-md p-2 text-sm min-h-[120px]"
                value={editForm.notes || ''}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div><Label>Associated Technician</Label>
              <Select value={editForm.technicianId || 'none'} onValueChange={(v) => setEditForm((f) => ({ ...f, technicianId: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {technicians.map((t) => <SelectItem key={t.id} value={t.id}>{t.displayName || t.full_name || t.fullName || t.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={isSaving}>{isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
