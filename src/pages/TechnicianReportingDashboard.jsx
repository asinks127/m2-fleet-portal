import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Download, RefreshCw, AlertCircle, PlayCircle, Settings, Edit, UserCheck, Search, Info } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { syncGoogleSheetData } from '@/functions/syncGoogleSheetData';
import { sendDailyPMReports } from '@/functions/sendDailyPMReports';

export default function TechnicianReportingDashboard() {
  const [filterPM, setFilterPM] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [timeframe, setTimeframe] = useState('Current Week');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sheetId, setSheetId] = useState('');
  const [sheetName, setSheetName] = useState('');
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: records = [], refetch: refetchRecords } = useQuery({
    queryKey: ['DailyActivityRecord'],
    queryFn: () => base44.entities.DailyActivityRecord.list('-timestamp', 1000),
  });

  const { data: settings = [], refetch: refetchSettings } = useQuery({
    queryKey: ['TechnicianReportingSettings'],
    queryFn: () => base44.entities.TechnicianReportingSettings.list(),
  });

  const { data: auditRecords = [] } = useQuery({
    queryKey: ['DailyTechAudits'],
    queryFn: () => base44.entities.AuditRecord.list('-completedDate', 500),
  });

  const dailyAudits = auditRecords.filter(a => a.title === 'Daily Technician Audit' && (a.status === 'Completed' || a.status === 'Under Review' || a.status === 'Closed'));

  const isAdmin = currentUser?.role === 'admin' || currentUser?.email?.includes('m2fleetcom.com');

  const filteredRecords = records.filter(r => {
    if (!isAdmin && r.projectManagerEmail !== currentUser?.email) return false;
    if (isAdmin && filterPM !== 'All' && r.projectManagerEmail !== filterPM) return false;
    if (filterStatus !== 'All' && r.importStatus !== filterStatus) return false;
    
    if (timeframe !== 'All Time' && r.timestamp) {
      let targetDate = new Date();
      if (timeframe === 'Specific Week...' && selectedDate) {
         targetDate = new Date(selectedDate);
      } else if (timeframe === 'Previous Week') {
         targetDate.setDate(targetDate.getDate() - 7);
      }
      
      const day = targetDate.getDay();
      const diff = targetDate.getDate() - day + (day === 0 ? -6 : 1);
      const startOfWeek = new Date(targetDate);
      startOfWeek.setDate(diff);
      startOfWeek.setHours(0,0,0,0);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23,59,59,999);
      
      const rDate = new Date(r.timestamp);
      if (rDate < startOfWeek || rDate > endOfWeek) return false;
    }
    
    return true;
  });

  const groupedRecords = {};
  filteredRecords.forEach(r => {
    const techName = r.technicianName || 'Unknown';
    if (!groupedRecords[techName]) groupedRecords[techName] = [];
    groupedRecords[techName].push(r);
  });
  
  const sortedTechs = Object.keys(groupedRecords).sort((a, b) => a.localeCompare(b));

  const totalInstalls = filteredRecords.reduce((sum, r) => sum + (r.completedAssets || 0), 0);
  const totalDelays = filteredRecords.reduce((sum, r) => sum + (r.delayCount || 0), 0);
  const totalDelayMins = filteredRecords.reduce((sum, r) => sum + (r.estimatedTotalDelayTime || 0), 0);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await syncGoogleSheetData({});
      if (res.data.error) throw new Error(res.data.error);
      toast.success(`Synced! Imported: ${res.data.imported}, Failed: ${res.data.failed}, Unmatched: ${res.data.unmatched}`);
      refetchRecords();
    } catch (error) {
      toast.error(`Sync failed: ${error.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSendReports = async () => {
    setIsSending(true);
    try {
      const res = await sendDailyPMReports({ forceDate: reportDate });
      if (res.data.error) throw new Error(res.data.error);
      toast.success(`Sent reports to: ${res.data.sentTo?.join(', ') || 'No reports sent'}`);
      setReportDialogOpen(false);
    } catch (error) {
      toast.error(`Send failed: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const saveSettings = async () => {
    if (settings.length > 0) {
      await base44.entities.TechnicianReportingSettings.update(settings[0].id, { spreadsheetId: sheetId, sheetName });
    } else {
      await base44.entities.TechnicianReportingSettings.create({ spreadsheetId: sheetId, sheetName });
    }
    toast.success('Settings saved');
    setSettingsOpen(false);
    refetchSettings();
  };

  const exportCSV = () => {
    const headers = ['Timestamp', 'Technician', 'Project', 'Installs', 'Delay Count', 'Delay Time', 'Status'];
    const csvContent = [
      headers.join(','),
      ...filteredRecords.map(r => [
        r.timestamp, r.technicianName, r.project, r.completedAssets, r.delayCount, r.estimatedTotalDelayTime, r.importStatus
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Technician_Report.csv';
    a.click();
  };

  const pmList = Array.from(new Set(records.map(r => r.projectManagerEmail).filter(Boolean)));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Technician Reporting</h1>
          <p className="text-gray-500">View and manage imported daily submissions.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" onClick={() => {
                  setSheetId(settings[0]?.spreadsheetId || '');
                  setSheetName(settings[0]?.sheetName || 'Form Responses 1');
                }}><Settings className="w-4 h-4 mr-2"/> Settings</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Sync Settings</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Google Sheet ID</Label>
                    <Input value={sheetId} onChange={(e) => setSheetId(e.target.value)} placeholder="1BxiMVs0XRY..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Sheet Name</Label>
                    <Input value={sheetName} onChange={(e) => setSheetName(e.target.value)} placeholder="Form Responses 1" />
                  </div>
                  <Button onClick={saveSettings}>Save Settings</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
          {isAdmin && <Button onClick={handleSync} disabled={isSyncing}><RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} /> Sync Now</Button>}
          {isAdmin && (
            <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary" disabled={isSending}><PlayCircle className="w-4 h-4 mr-2" /> Send Reports</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Send Daily Reports</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="report-date" className="text-right">Report Date</Label>
                    <Input 
                      id="report-date" 
                      type="date" 
                      value={reportDate} 
                      onChange={e => setReportDate(e.target.value)} 
                      className="col-span-3" 
                    />
                  </div>
                  <p className="text-sm text-gray-500 text-center">
                    This will generate and email reports for all technicians active on the selected date.
                  </p>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setReportDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleSendReports} disabled={isSending}>
                    {isSending ? 'Sending...' : 'Send Emails'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          <Button variant="outline" onClick={exportCSV}><Download className="w-4 h-4 mr-2" /> Export</Button>
        </div>
      </div>

      <Tabs defaultValue="sheets" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="sheets">Google Sheets Sync</TabsTrigger>
          <TabsTrigger value="audits">Daily Tech Audits</TabsTrigger>
        </TabsList>

        <TabsContent value="sheets" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">Total Installs</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold">{totalInstalls}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">Total Delays</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold">{totalDelays}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">Total Delay Time</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold">{totalDelayMins} mins</div></CardContent>
            </Card>
          </div>

          <div className="flex gap-4 items-center bg-white p-4 rounded-xl border flex-wrap">
        <div className="flex-1 min-w-[150px] max-w-xs">
          <Label>Timeframe</Label>
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger><SelectValue placeholder="Timeframe" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Current Week">Current Week</SelectItem>
              <SelectItem value="Previous Week">Previous Week</SelectItem>
              <SelectItem value="Specific Week...">Specific Week...</SelectItem>
              <SelectItem value="All Time">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {timeframe === 'Specific Week...' && (
          <div className="flex-1 min-w-[150px] max-w-xs">
            <Label>Select Date in Week</Label>
            <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
          </div>
        )}
        {isAdmin && (
          <div className="flex-1 min-w-[150px] max-w-xs">
            <Label>Filter by PM</Label>
            <Select value={filterPM} onValueChange={setFilterPM}>
              <SelectTrigger><SelectValue placeholder="All PMs" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All PMs</SelectItem>
                {pmList.map(pm => <SelectItem key={pm} value={pm}>{pm}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex-1 min-w-[150px] max-w-xs">
          <Label>Match Status</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger><SelectValue placeholder="All Statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Statuses</SelectItem>
              <SelectItem value="Matched">Matched</SelectItem>
              <SelectItem value="Unmatched">Unmatched</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-6">
        {sortedTechs.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-gray-500">
              No records found.
            </CardContent>
          </Card>
        ) : (
          sortedTechs.map(tech => (
            <Card key={tech} className="overflow-hidden">
              <CardHeader className="bg-gray-50/50 border-b pb-4 pt-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-primary" />
                  {tech}
                </CardTitle>
              </CardHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer/Project</TableHead>
                    <TableHead>Installs</TableHead>
                    <TableHead>Delay</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedRecords[tech]
                    .sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp))
                    .map(r => (
                    <TableRow key={r.id}>
                      <TableCell>{new Date(r.timestamp).toLocaleDateString()}</TableCell>
                      <TableCell>{r.customer}</TableCell>
                      <TableCell>{r.completedAssets}</TableCell>
                      <TableCell>{r.estimatedTotalDelayTime} mins</TableCell>
                      <TableCell>{r.projectTeam}</TableCell>
                      <TableCell>
                        {r.importStatus === 'Matched' ? 
                          <Badge variant="outline" className="bg-green-50 text-green-700">Matched</Badge> : 
                          <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1"/> Unmatched</Badge>
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ))
        )}
      </div>
        </TabsContent>

        <TabsContent value="audits" className="space-y-6">
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Technician</TableHead>
                  <TableHead>Project / WO</TableHead>
                  <TableHead>Compliance Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Flag Reasons</TableHead>
                  <TableHead>AI Summary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dailyAudits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">No Daily Technician Audits found.</TableCell>
                  </TableRow>
                ) : (
                  dailyAudits.map(audit => (
                    <TableRow key={audit.id}>
                      <TableCell className="whitespace-nowrap">
                        {audit.completedDate ? new Date(audit.completedDate).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell className="font-medium">{audit.assignedAuditor || 'Unknown'}</TableCell>
                      <TableCell>{audit.relatedProjectId || '-'}</TableCell>
                      <TableCell>
                        <span className="text-lg font-semibold">{audit.overallScore ?? '-'}</span>
                        <span className="text-xs text-gray-500">/100</span>
                      </TableCell>
                      <TableCell>
                        {audit.auditStatusColor === 'Green' && <Badge className="bg-green-100 text-green-800">Green</Badge>}
                        {audit.auditStatusColor === 'Yellow' && <Badge className="bg-yellow-100 text-yellow-800">Yellow</Badge>}
                        {audit.auditStatusColor === 'Red' && <Badge className="bg-red-100 text-red-800">Red</Badge>}
                        {!audit.auditStatusColor && <Badge variant="outline">Pending AI</Badge>}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        {audit.flagReasons && audit.flagReasons.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {audit.flagReasons.map((f, i) => (
                              <span key={i} className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded-md line-clamp-2" title={f}>• {f}</span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">None</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs text-sm text-gray-600">
                        {audit.aiSummary ? (
                          <div className="line-clamp-3" title={audit.aiSummary}>{audit.aiSummary}</div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}