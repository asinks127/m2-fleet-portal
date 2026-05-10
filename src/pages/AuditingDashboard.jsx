import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, LayoutDashboard, ClipboardList, AlertTriangle, FileText, CheckCircle, Clock, Play } from 'lucide-react';
import { format } from 'date-fns';
import { generateRecurringAudits } from '@/functions/generateRecurringAudits';
import { escalateOverdueAudits } from '@/functions/escalateOverdueAudits';
import { toast } from 'sonner';

export default function AuditingDashboard() {
  const [generating, setGenerating] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const handleGenerateAudits = async () => {
    setGenerating(true);
    try {
      const response = await generateRecurringAudits({});
      if (response.data.success) {
        if (response.data.createdCount === 0) {
           toast.info('Audits are already up to date. No new audits generated.');
        } else {
           toast.success(`Successfully generated ${response.data.createdCount} new audits.`);
        }
        queryClient.invalidateQueries(['audits']);
      } else {
        toast.error('Error generating audits.');
      }
    } catch (e) {
      toast.error('Failed to run generation: ' + e.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleEscalateAudits = async () => {
    setGenerating(true);
    try {
      const response = await escalateOverdueAudits({});
      if (response.data.success) {
        toast.success(`Checked and escalated ${response.data.escalatedCount} overdue audits.`);
        queryClient.invalidateQueries(['audits']);
      } else {
        toast.error('Error checking escalations.');
      }
    } catch (e) {
      toast.error('Failed to check escalations: ' + e.message);
    } finally {
      setGenerating(false);
    }
  };

  const { data: audits = [], isLoading } = useQuery({
    queryKey: ['audits'],
    queryFn: () => base44.entities.AuditRecord.list('-created_date', 100),
    initialData: [],
  });

  const { data: actions = [] } = useQuery({
    queryKey: ['correctiveActions'],
    queryFn: () => base44.entities.CorrectiveAction.list('-created_date', 100),
    initialData: [],
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed': return 'bg-green-100 text-green-800';
      case 'Awaiting Auditor Assignment': return 'bg-yellow-100 text-yellow-800';
      case 'Overdue': return 'bg-red-100 text-red-800';
      case 'In Progress': return 'bg-blue-100 text-blue-800';
      case 'Escalated': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getResultColor = (result) => {
    switch (result) {
      case 'Pass': return 'bg-green-100 text-green-800';
      case 'Needs Review': return 'bg-yellow-100 text-yellow-800';
      case 'Fail': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Auditing Dashboard</h1>
          <p className="text-gray-600 mt-1">Manage and track operational audits across departments</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <LayoutDashboard className="w-4 h-4 mr-2" />
            Reports
          </Button>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Audit
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Open Audits</p>
              <h3 className="text-2xl font-bold">{audits.filter(a => ['Open', 'In Progress'].includes(a.status)).length}</h3>
            </div>
            <div className="p-3 bg-blue-50 rounded-full">
              <ClipboardList className="w-6 h-6 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Awaiting Assignment</p>
              <h3 className="text-2xl font-bold">{audits.filter(a => a.status === 'Awaiting Auditor Assignment').length}</h3>
            </div>
            <div className="p-3 bg-yellow-50 rounded-full">
              <Clock className="w-6 h-6 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Overdue / Escalated</p>
              <h3 className="text-2xl font-bold text-red-600">
                {audits.filter(a => ['Overdue', 'Escalated'].includes(a.status)).length}
              </h3>
            </div>
            <div className="p-3 bg-red-50 rounded-full">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Open Corrective Actions</p>
              <h3 className="text-2xl font-bold">{actions.filter(a => ['Open', 'In Progress'].includes(a.status)).length}</h3>
            </div>
            <div className="p-3 bg-orange-50 rounded-full">
              <FileText className="w-6 h-6 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4 p-4 bg-gray-50 border rounded-xl items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Admin Automation Controls</h3>
          <p className="text-sm text-gray-500">Manually trigger the background jobs that handle recurring audits and escalations.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleEscalateAudits} disabled={generating}>
            <AlertTriangle className="w-4 h-4 mr-2" /> Check Overdue
          </Button>
          <Button onClick={handleGenerateAudits} disabled={generating}>
            <Play className="w-4 h-4 mr-2" /> Run Daily Audit Engine
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Audits */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Recent Audits</CardTitle>
            <CardDescription>Latest audits created in the system</CardDescription>
          </CardHeader>
          <CardContent>
            {audits.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">No audits found.</p>
            ) : (
              <div className="space-y-4">
                {audits.slice(0, 5).map(audit => (
                  <div 
                    key={audit.id} 
                    onClick={() => navigate(createPageUrl('AuditExecution') + `?auditId=${audit.id}`)}
                    className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border hover:bg-gray-100 cursor-pointer transition-colors"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{audit.title}</p>
                      <div className="flex gap-2 items-center mt-1">
                        <span className="text-xs text-gray-500">{audit.module}</span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-500">{audit.frequency}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className={getStatusColor(audit.status)}>{audit.status}</Badge>
                      {audit.result && audit.result !== 'Pending' && (
                        <div className="mt-1">
                          <Badge variant="outline" className={getResultColor(audit.result)}>{audit.result}</Badge>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Actions */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>My Pending Tasks</CardTitle>
            <CardDescription>Audits and actions requiring your attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-8 text-center border-2 border-dashed rounded-lg bg-gray-50">
                <CheckCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-gray-900">You're all caught up!</h3>
                <p className="text-sm text-gray-500 mt-1">You have no pending audits or corrective actions assigned to you.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}