import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CallLog, User } from '@/api/entities.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { FileText, Phone, Download, Search, Loader2 } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';

const getLogNote = (log) => String(log.note || log.notes || '');
const getLoggedBy = (log) => String(log.loggedBy || log.created_by || '');
const normalize = (value) => String(value || '').trim().toLowerCase();
const technicianFields = ['displayName', 'full_name', 'fullName', 'name', 'email', 'business', 'businessName'];
const getTechnicianName = (technician) => technician?.displayName || technician?.full_name || technician?.fullName || technician?.name || technician?.email || 'Unknown Technician';
const getTechnicianBusiness = (technician) => technician?.business || technician?.businessName || '';
const getTechnicianKey = (value) => normalize(value);

export default function CallLogsReport() {
  const [callLogs, setCallLogs] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContractor, setSelectedContractor] = useState('all');
  const [selectedQc, setSelectedQc] = useState('all');
  const [dateRange, setDateRange] = useState('this_week');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [logs, users] = await Promise.all([CallLog.list('-callDate'), User.list()]);
      setCallLogs(Array.isArray(logs) ? logs : []);
      setContractors((Array.isArray(users) ? users : []).filter(user => user.email && (
        user.email.toLowerCase().includes('.contractor@m2fleetcom.com') ||
        user.email.toLowerCase().includes('.contractor@smcinstallations.com')
      )));
    } catch (error) {
      console.error('Error loading call logs:', error);
      setCallLogs([]);
      setContractors([]);
    } finally {
      setIsLoading(false);
    }
  };

  const technicianByKey = useMemo(() => {
    const map = new Map();
    contractors.forEach(technician => {
      technicianFields.forEach(field => {
        const value = technician?.[field];
        if (value) map.set(getTechnicianKey(value), technician);
      });
    });
    return map;
  }, [contractors]);

  const findTechnician = useCallback((log) => {
    const id = log?.technicianId || log?.technician_id;
    if (id) {
      const byId = contractors.find(technician => String(technician.id) === String(id));
      if (byId) return byId;
    }
    const email = log?.technicianEmail || log?.technician_email;
    if (email) {
      const byEmail = technicianByKey.get(getTechnicianKey(email));
      if (byEmail) return byEmail;
    }
    const note = getLogNote(log);
    const candidates = contractors.filter(technician => technicianFields.some(field => {
      const value = technician?.[field];
      return value && new RegExp(`\\b${String(value).replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`, 'i').test(note);
    }));
    return candidates.length === 1 ? candidates[0] : null;
  }, [contractors, technicianByKey]);

  const getDateRange = useCallback(() => {
    const now = new Date();
    const weekStartsOn = 5;
    switch (dateRange) {
      case 'today': {
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);
        return { start: todayStart, end: todayEnd };
      }
      case 'this_week':
        return { start: startOfWeek(now, { weekStartsOn }), end: endOfWeek(now, { weekStartsOn }) };
      case 'last_week': {
        const lastWeek = subDays(now, 7);
        return { start: startOfWeek(lastWeek, { weekStartsOn }), end: endOfWeek(lastWeek, { weekStartsOn }) };
      }
      case 'this_month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'last_month': {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      }
      case 'custom': {
        const start = customStartDate ? new Date(`${customStartDate}T00:00:00`) : startOfWeek(now, { weekStartsOn });
        const end = customEndDate ? new Date(`${customEndDate}T23:59:59.999`) : endOfWeek(now, { weekStartsOn });
        return { start, end };
      }
      default:
        return { start: startOfWeek(now, { weekStartsOn }), end: endOfWeek(now, { weekStartsOn }) };
    }
  }, [dateRange, customStartDate, customEndDate]);

  const filteredLogs = useMemo(() => {
    const { start, end } = getDateRange();
    return callLogs.filter(log => {
      const rawDate = log.callDate || log.created_at;
      const logDate = rawDate ? new Date(rawDate) : null;
      if (!logDate || Number.isNaN(logDate.getTime())) return false;
      const loggedBy = getLoggedBy(log).toLowerCase();
      const note = getLogNote(log).toLowerCase();
      const contractor = findTechnician(log);
      const contractorName = normalize(getTechnicianName(contractor));
      const contractorBusiness = normalize(getTechnicianBusiness(contractor));
      const dateInRange = logDate >= start && logDate <= end;
      const contractorMatch = selectedContractor === 'all' || contractor?.id === selectedContractor;
      const qcMatch = selectedQc === 'all' || loggedBy.includes(selectedQc.toLowerCase());
      const searchMatch = !searchTerm || note.includes(searchTerm.toLowerCase()) || contractorName.includes(searchTerm.toLowerCase()) || contractorBusiness.includes(searchTerm.toLowerCase());
      return dateInRange && contractorMatch && qcMatch && searchMatch;
    });
  }, [callLogs, contractors, selectedContractor, selectedQc, searchTerm, getDateRange, findTechnician]);

  const summary = useMemo(() => {
    const qcCounts = {};
    const contractorCounts = {};
    filteredLogs.forEach(log => {
      const loggedBy = getLoggedBy(log).toLowerCase();
      const qc = loggedBy.includes('ryan') ? 'Ryan Miller' : loggedBy.includes('chance') ? 'Chance Hoffman' : getLoggedBy(log) || 'Unknown';
      qcCounts[qc] = (qcCounts[qc] || 0) + 1;
      const contractor = findTechnician(log);
      if (contractor) {
        const name = getTechnicianName(contractor);
        contractorCounts[name] = (contractorCounts[name] || 0) + 1;
      }
    });
    return { qcCounts, contractorCounts };
  }, [filteredLogs, findTechnician]);

  const exportToCsv = () => {
    const headers = ['Date', 'QC Manager', 'Technician', 'Business', 'Project', 'Notes'];
    const csvData = filteredLogs.map(log => {
      const contractor = findTechnician(log);
      const loggedBy = getLoggedBy(log).toLowerCase();
      const qc = loggedBy.includes('ryan') ? 'Ryan Miller' : loggedBy.includes('chance') ? 'Chance Hoffman' : getLoggedBy(log) || 'Unknown';
      return [
        format(new Date(log.callDate || log.created_at), 'MM/dd/yyyy HH:mm'), qc,
        getTechnicianName(contractor), getTechnicianBusiness(contractor) || 'N/A', contractor?.project || 'N/A',
        `"${getLogNote(log).replace(/"/g, '""')}"`
      ];
    });
    const csvContent = [headers, ...csvData].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `call-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  if (isLoading) {
    return <div className="p-6 flex justify-center items-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-3xl font-bold text-gray-900">Call Logs Report</h1><p className="text-gray-600 mt-1">Track QC interactions with technicians</p></div>
        <Button onClick={exportToCsv} disabled={filteredLogs.length === 0}><Download className="w-4 h-4 mr-2" />Export CSV</Button>
      </div>
      <Card><CardHeader><CardTitle className="text-lg">Filters</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div><Label>Date Range</Label><Select value={dateRange} onValueChange={setDateRange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="today">Today</SelectItem><SelectItem value="this_week">This Week</SelectItem><SelectItem value="last_week">Last Week</SelectItem><SelectItem value="this_month">This Month</SelectItem><SelectItem value="last_month">Last Month</SelectItem><SelectItem value="custom">Custom Range</SelectItem>
          </SelectContent></Select></div>
          <div><Label>QC Manager</Label><Select value={selectedQc} onValueChange={setSelectedQc}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All QCs</SelectItem><SelectItem value="ryan">Ryan Miller</SelectItem><SelectItem value="chance">Chance Hoffman</SelectItem></SelectContent></Select></div>
          <div><Label>Technician</Label><Select value={selectedContractor} onValueChange={setSelectedContractor}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Technicians</SelectItem>{contractors.map(contractor => <SelectItem key={contractor.id} value={contractor.id}>{getTechnicianName(contractor)}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Search Notes</Label><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" /><Input placeholder="Search in notes..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" /></div></div>
        </div>
        {dateRange === 'custom' && <div className="grid md:grid-cols-2 gap-4"><div><Label>Start Date</Label><Input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} /></div><div><Label>End Date</Label><Input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} /></div></div>}
      </CardContent></Card>
      <div className="grid md:grid-cols-3 gap-6">
        <Card><CardHeader><CardTitle className="text-lg flex items-center"><Phone className="w-5 h-5 mr-2" />Total Calls</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{filteredLogs.length}</div><p className="text-gray-600 text-sm">in selected period</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-lg">Calls by QC</CardTitle></CardHeader><CardContent><div className="space-y-2">{Object.entries(summary.qcCounts).map(([qc, count]) => <div key={qc} className="flex justify-between"><span>{qc}</span><Badge variant="outline">{count}</Badge></div>)}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-lg">Most Contacted</CardTitle></CardHeader><CardContent><div className="space-y-2">{Object.entries(summary.contractorCounts).sort(([, a], [, b]) => b - a).slice(0, 5).map(([contractor, count]) => <div key={contractor} className="flex justify-between"><span className="truncate">{contractor}</span><Badge variant="outline">{count}</Badge></div>)}</div></CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle className="text-lg">Call History ({filteredLogs.length} records)</CardTitle></CardHeader><CardContent>{filteredLogs.length > 0 ? <div className="space-y-4">{filteredLogs.map(log => {
        const contractor = findTechnician(log);
        const loggedBy = getLoggedBy(log).toLowerCase();
        const qc = loggedBy.includes('ryan') ? 'Ryan Miller' : loggedBy.includes('chance') ? 'Chance Hoffman' : 'Other';
        return <div key={log.id} className="border rounded-lg p-4"><div className="flex justify-between items-start mb-2"><div className="flex items-center gap-3"><Badge variant="outline">{qc}</Badge><div><p className="font-medium">{getTechnicianName(contractor)}</p><p className="text-sm text-gray-600">{contractor?.project && `Project: ${contractor.project} • `}{format(new Date(log.callDate || log.created_at), 'MMM d, yyyy HH:mm')}</p></div></div></div>{getLogNote(log) && <div className="bg-gray-50 p-3 rounded mt-3"><p className="text-sm">{getLogNote(log)}</p></div>}</div>;
      })}</div> : <div className="text-center py-8 text-gray-500"><FileText className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>No call logs found for the selected criteria.</p></div>}</CardContent></Card>
    </div>
  );
}