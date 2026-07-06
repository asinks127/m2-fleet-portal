import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Clock, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function CorrectiveActionsTracker() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [updateDialog, setUpdateDialog] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetchActions();
  }, []);

  const fetchActions = async () => {
    try {
      const data = await base44.entities.SafetyCorrectiveAction.list('-created_date');
      setActions(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    try {
      const isCompleting = selected.status === 'Complete' && actions.find(a => a.id === selected.id)?.status !== 'Complete';
      
      await base44.entities.SafetyCorrectiveAction.update(selected.id, {
        status: selected.status,
        completionNotes: selected.completionNotes,
        assignedTo: selected.assignedTo,
        completedDate: isCompleting ? new Date().toISOString() : selected.completedDate
      });
      
      toast({ title: 'Updated', description: 'Corrective action updated.' });
      setUpdateDialog(false);
      fetchActions();
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to update corrective action.', variant: 'destructive' });
    }
  };

  const filtered = actions.filter(a => {
    const matchSearch = !search || 
      a.projectName?.toLowerCase().includes(search.toLowerCase()) || 
      a.assignedTo?.toLowerCase().includes(search.toLowerCase()) ||
      a.correctiveActionId?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <Clock className="w-8 h-8 mr-3 text-yellow-600" />
          Corrective Actions Tracker
        </h1>
        <p className="text-gray-600 mt-1">Track and manage safety corrective actions assigned from hazard and injury reports.</p>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input placeholder="Search project or assignee..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-60">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Open">Open</SelectItem>
              <SelectItem value="In Progress">In Progress</SelectItem>
              <SelectItem value="Waiting">Waiting</SelectItem>
              <SelectItem value="Overdue">Overdue</SelectItem>
              <SelectItem value="Complete">Complete</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-yellow-600" /></div>
      ) : (
        <div className="bg-white rounded-xl shadow border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-4 font-medium text-gray-600">ID / Linked Report</th>
                  <th className="p-4 font-medium text-gray-600">Project</th>
                  <th className="p-4 font-medium text-gray-600">Assigned To</th>
                  <th className="p-4 font-medium text-gray-600">Action Required</th>
                  <th className="p-4 font-medium text-gray-600">Priority</th>
                  <th className="p-4 font-medium text-gray-600">Due Date</th>
                  <th className="p-4 font-medium text-gray-600">Status</th>
                  <th className="p-4 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(action => (
                  <tr key={action.id} className="hover:bg-gray-50">
                    <td className="p-4">
                      <div className="font-mono text-gray-500">{action.correctiveActionId}</div>
                      <Button variant="link" className="p-0 h-auto text-xs" onClick={() => navigate(createPageUrl('SafetyReportDetail') + `?reportId=${action.linkedReportId}&type=${action.linkedReportType}`)}>
                        {action.linkedReportId}
                      </Button>
                    </td>
                    <td className="p-4 font-medium">{action.projectName}</td>
                    <td className="p-4 text-gray-600">{action.assignedTo}</td>
                    <td className="p-4 max-w-xs truncate" title={action.actionRequired}>{action.actionRequired}</td>
                    <td className="p-4">
                      <Badge variant="outline" className={action.priority === 'Critical' ? 'bg-red-100 text-red-800' : action.priority === 'High' ? 'bg-orange-100 text-orange-800' : ''}>
                        {action.priority}
                      </Badge>
                    </td>
                    <td className="p-4">
                      {action.dueDate ? format(new Date(action.dueDate), 'MMM d, yyyy') : '-'}
                    </td>
                    <td className="p-4">
                      <Badge variant="outline" className={action.status === 'Complete' ? 'bg-green-100 text-green-800' : action.status === 'Overdue' ? 'bg-red-100 text-red-800' : 'bg-gray-100'}>
                        {action.status}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <Button variant="ghost" size="sm" onClick={() => { setSelected(action); setUpdateDialog(true); }}>
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan="8" className="p-8 text-center text-gray-500">No corrective actions found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={updateDialog} onOpenChange={setUpdateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update Corrective Action</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 mt-2">
              <div className="bg-gray-50 p-3 rounded-lg border text-sm text-gray-700">
                <strong>Action:</strong> {selected.actionRequired}
              </div>
              <div>
                <Label>Status</Label>
                <Select value={selected.status} onValueChange={v => setSelected({...selected, status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Open">Open</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Waiting">Waiting</SelectItem>
                    <SelectItem value="Overdue">Overdue</SelectItem>
                    <SelectItem value="Complete">Complete</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Assigned To</Label>
                <Input value={selected.assignedTo || ''} onChange={e => setSelected({...selected, assignedTo: e.target.value})} />
              </div>
              <div>
                <Label>Completion Notes / Updates</Label>
                <Textarea rows={3} value={selected.completionNotes || ''} onChange={e => setSelected({...selected, completionNotes: e.target.value})} />
              </div>
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