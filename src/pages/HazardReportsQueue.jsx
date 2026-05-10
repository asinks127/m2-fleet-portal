import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, ShieldAlert, Search, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

function statusColor(s) {
  if (s === 'Open - Immediate') return 'bg-red-100 text-red-800 border-red-300';
  if (s === 'Open - Serious') return 'bg-orange-100 text-orange-800 border-orange-200';
  if (s === 'Open - Standard') return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  if (s === 'Under Review') return 'bg-blue-100 text-blue-800';
  if (s === 'Resolved' || s === 'Closed') return 'bg-green-100 text-green-800';
  return 'bg-gray-100 text-gray-700';
}

export default function HazardReportsQueue() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [updateDialog, setUpdateDialog] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const data = await base44.entities.SafetyHazardReport.list('-created_date');
      setReports(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    try {
      await base44.entities.SafetyHazardReport.update(selected.id, {
        status: selected.status,
        adminNotes: selected.adminNotes,
        followUpOwner: selected.followUpOwner,
        correctiveActionRequired: selected.correctiveActionRequired,
        correctiveActionDueDate: selected.correctiveActionDueDate
      });
      
      if (selected.correctiveActionRequired && selected.actionRequired) {
        await base44.entities.SafetyCorrectiveAction.create({
          correctiveActionId: 'CA-' + Date.now().toString().slice(-6),
          linkedReportId: selected.reportId,
          linkedReportType: 'Hazard',
          projectName: selected.projectName,
          assignedTo: selected.followUpOwner,
          actionRequired: selected.actionRequired,
          dueDate: selected.correctiveActionDueDate,
          priority: selected.hazardSeverity,
          status: 'Open'
        });
      }
      
      toast({ title: 'Updated', description: 'Report updated successfully.' });
      setUpdateDialog(false);
      fetchReports();
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to update report.', variant: 'destructive' });
    }
  };

  const handleConvertToLesson = async (report) => {
    navigate(createPageUrl('LessonsLearnedManager') + `?prefill=${report.id}`);
  };

  const filtered = reports.filter(r => {
    const matchSearch = !search || 
      r.submittedByName?.toLowerCase().includes(search.toLowerCase()) || 
      r.projectName?.toLowerCase().includes(search.toLowerCase()) ||
      r.reportId?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <ShieldAlert className="w-8 h-8 mr-3 text-orange-600" />
            Hazard Reports Queue
          </h1>
          <p className="text-gray-600 mt-1">Review and manage all submitted hazard reports.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input placeholder="Search reports..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-60">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Open - Standard">Open - Standard</SelectItem>
              <SelectItem value="Open - Serious">Open - Serious</SelectItem>
              <SelectItem value="Open - Immediate">Open - Immediate</SelectItem>
              <SelectItem value="Under Review">Under Review</SelectItem>
              <SelectItem value="Waiting for Follow-up">Waiting for Follow-up</SelectItem>
              <SelectItem value="Resolved">Resolved</SelectItem>
              <SelectItem value="Closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-orange-600" /></div>
      ) : (
        <div className="bg-white rounded-xl shadow border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-4 font-medium text-gray-600">Report ID</th>
                  <th className="p-4 font-medium text-gray-600">Submitted By</th>
                  <th className="p-4 font-medium text-gray-600">Project / Site</th>
                  <th className="p-4 font-medium text-gray-600">Category</th>
                  <th className="p-4 font-medium text-gray-600">Severity</th>
                  <th className="p-4 font-medium text-gray-600">Response</th>
                  <th className="p-4 font-medium text-gray-600">Status</th>
                  <th className="p-4 font-medium text-gray-600">Date</th>
                  <th className="p-4 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(report => (
                  <tr key={report.id} className={`hover:bg-gray-50 ${report.status === 'Open - Immediate' ? 'bg-red-50' : ''}`}>
                    <td className="p-4 font-mono text-gray-500">{report.reportId}</td>
                    <td className="p-4">
                      <div className="font-medium">{report.submittedByName}</div>
                      <div className="text-gray-500 text-xs">{report.submittedByEmail}</div>
                    </td>
                    <td className="p-4">
                      <div>{report.projectName}</div>
                      <div className="text-gray-500 text-xs">{report.siteLocation}</div>
                    </td>
                    <td className="p-4">{report.hazardCategory}</td>
                    <td className="p-4">
                      <Badge variant="outline" className={report.hazardSeverity === 'Critical' ? 'bg-red-100 text-red-800' : report.hazardSeverity === 'High' ? 'bg-orange-100 text-orange-800' : ''}>
                        {report.hazardSeverity}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <Badge variant="outline" className={statusColor(report.status)}>
                        {report.responseNeeded}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <Badge variant="outline" className={statusColor(report.status)}>
                        {report.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-gray-500">{format(new Date(report.created_date), 'MMM d')}</td>
                    <td className="p-4">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => navigate(createPageUrl('SafetyReportDetail') + `?id=${report.id}&type=Hazard`)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => { setSelected({...report, actionRequired: ''}); setUpdateDialog(true); }}>
                          Edit
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan="9" className="p-8 text-center text-gray-500">No hazard reports found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={updateDialog} onOpenChange={setUpdateDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Update Report: {selected?.reportId}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 mt-2">
              <div>
                <Label>Status</Label>
                <Select value={selected.status} onValueChange={v => setSelected({...selected, status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Open - Standard">Open - Standard</SelectItem>
                    <SelectItem value="Open - Serious">Open - Serious</SelectItem>
                    <SelectItem value="Open - Immediate">Open - Immediate</SelectItem>
                    <SelectItem value="Under Review">Under Review</SelectItem>
                    <SelectItem value="Waiting for Follow-up">Waiting for Follow-up</SelectItem>
                    <SelectItem value="Resolved">Resolved</SelectItem>
                    <SelectItem value="Closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Follow-up Owner (Name / Email)</Label>
                <Input value={selected.followUpOwner || ''} onChange={e => setSelected({...selected, followUpOwner: e.target.value})} />
              </div>
              <div>
                <Label>Admin / PM Notes</Label>
                <Textarea rows={3} value={selected.adminNotes || ''} onChange={e => setSelected({...selected, adminNotes: e.target.value})} />
              </div>
              <div>
                <Label>Corrective Action Required?</Label>
                <Select value={selected.correctiveActionRequired ? 'yes' : 'no'} onValueChange={v => setSelected({...selected, correctiveActionRequired: v === 'yes'})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="yes">Yes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {selected.correctiveActionRequired && (
                <>
                  <div>
                    <Label>Corrective Action</Label>
                    <Textarea rows={2} placeholder="Describe required corrective action..." value={selected.actionRequired || ''} onChange={e => setSelected({...selected, actionRequired: e.target.value})} />
                  </div>
                  <div>
                    <Label>Due Date</Label>
                    <Input type="date" value={selected.correctiveActionDueDate || ''} onChange={e => setSelected({...selected, correctiveActionDueDate: e.target.value})} />
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter className="mt-4 border-t pt-4">
            <Button variant="outline" onClick={() => setUpdateDialog(false)}>Cancel</Button>
            <Button onClick={handleUpdate}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}