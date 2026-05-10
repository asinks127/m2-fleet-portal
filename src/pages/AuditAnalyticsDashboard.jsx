import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, FileSpreadsheet, FileText, CheckCircle, AlertTriangle, Clock, Target, ListChecks, Filter } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import AnalyticsOverviewTab from '@/components/auditing/AnalyticsOverviewTab';
import AnalyticsUsersTab from '@/components/auditing/AnalyticsUsersTab';
import AnalyticsFailedItemsTab from '@/components/auditing/AnalyticsFailedItemsTab';
import AnalyticsEntitiesTab from '@/components/auditing/AnalyticsEntitiesTab';

export default function AuditAnalyticsDashboard() {
  const { data: audits = [], isLoading: loadingAudits } = useQuery({ queryKey: ['audits'], queryFn: () => base44.entities.AuditRecord.filter({}) });
  const { data: correctiveActions = [] } = useQuery({ queryKey: ['correctiveActions'], queryFn: () => base44.entities.CorrectiveAction.filter({}) });
  const { data: responses = [] } = useQuery({ queryKey: ['auditResponses'], queryFn: () => base44.entities.AuditResponse.filter({}) });
  const { data: templateItems = [] } = useQuery({ queryKey: ['auditTemplateItems'], queryFn: () => base44.entities.AuditTemplateItem.filter({}) });
  const { data: settingsList = [] } = useQuery({ queryKey: ['auditSettings'], queryFn: () => base44.entities.AuditSystemSetting.filter({}) });
  const settings = settingsList[0] || {
    passThreshold: 90, needsReviewThreshold: 80,
    weightAuditScore: 50, weightOnTime: 30, weightPenalty: 20,
    valueCompletedOnTime: 100, valueCompletedLate: 75, valueOpen: 50, valueOverdue: 25, valueEscalated: 0,
    riskModerate: 80, riskHigh: 70, repeatFailureCount: 3, repeatFailureDays: 60,
    userAtRiskCompletionRate: 85, userAtRiskOverdueCount: 3, userAtRiskDays: 30
  };

  const [filters, setFilters] = useState({ department: 'All', module: 'All', status: 'All' });

  const filteredAudits = useMemo(() => {
    return audits.filter(a => {
      if (filters.department !== 'All' && (a.responsibleDepartment || 'Uncategorized') !== filters.department) return false;
      if (filters.module !== 'All' && a.module !== filters.module) return false;
      if (filters.status !== 'All' && a.status !== filters.status) return false;
      return true;
    });
  }, [audits, filters]);

  const departments = ['All', ...new Set(audits.map(a => a.responsibleDepartment || 'Uncategorized'))];
  const modules = ['All', ...new Set(audits.map(a => a.module))];

  // KPIs
  const totalAudits = filteredAudits.length;
  const completedAudits = filteredAudits.filter(a => a.status === 'Completed' || a.status === 'Closed').length;
  const overdueAudits = filteredAudits.filter(a => a.status === 'Overdue').length;
  const escalatedAudits = filteredAudits.filter(a => a.escalated).length;
  
  const completedWithScore = filteredAudits.filter(a => typeof a.compliancePercentage === 'number');
  const avgScore = completedWithScore.length ? Math.round(completedWithScore.reduce((sum, a) => sum + a.compliancePercentage, 0) / completedWithScore.length) : 0;

  const filteredCAs = correctiveActions.filter(ca => {
    const audit = filteredAudits.find(a => a.id === ca.auditId);
    return !!audit;
  });
  
  const openCAs = filteredCAs.filter(ca => ca.status === 'Open' || ca.status === 'In Progress').length;

  const exportCSV = () => {
    const headers = ['Title', 'Module', 'Department', 'Status', 'Result', 'Score', 'Due Date'];
    const rows = filteredAudits.map(a => [
        `"${a.title}"`, `"${a.module}"`, `"${a.responsibleDepartment || '-'}"`, `"${a.status}"`, `"${a.result || '-'}"`, `"${a.compliancePercentage || 0}"`, `"${a.dueDate || '-'}"`
    ].join(','));
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Audit_Report.csv';
    a.click();
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text('Audit Analytics Report', 14, 15);
    autoTable(doc, {
      startY: 20,
      head: [['Title', 'Module', 'Department', 'Status', 'Result', 'Score']],
      body: filteredAudits.map(a => [a.title, a.module, a.responsibleDepartment || '-', a.status, a.result || '-', a.compliancePercentage ? `${a.compliancePercentage}%` : '-'])
    });
    doc.save('Audit_Report.pdf');
  };

  if (loadingAudits) return <div className="p-8 text-center text-gray-500">Loading Analytics...</div>;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Analytics & Reporting</h1>
          <p className="text-gray-500 text-sm">Track compliance trends, operational risks, and team performance.</p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" onClick={exportCSV} className="gap-2 bg-white"><FileSpreadsheet className="w-4 h-4 text-green-600" /> Export CSV</Button>
            <Button variant="outline" onClick={exportPDF} className="gap-2 bg-white"><FileText className="w-4 h-4 text-red-600" /> Export PDF</Button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border flex flex-wrap gap-4 items-center shadow-sm">
          <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 whitespace-nowrap"><Filter className="w-4 h-4 inline mr-1"/> Filters:</span>
          </div>
          <Select value={filters.department} onValueChange={v => setFilters({...filters, department: v})}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Department" /></SelectTrigger>
              <SelectContent>{departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filters.module} onValueChange={v => setFilters({...filters, module: v})}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Module" /></SelectTrigger>
              <SelectContent>{modules.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filters.status} onValueChange={v => setFilters({...filters, status: v})}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                  <SelectItem value="All">All Statuses</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Overdue">Overdue</SelectItem>
                  <SelectItem value="Escalated">Escalated</SelectItem>
              </SelectContent>
          </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
              <CardContent className="p-4 flex flex-col justify-center items-center text-center">
                  <ListChecks className="w-6 h-6 text-blue-600 mb-2" />
                  <span className="text-2xl font-bold text-gray-900">{totalAudits}</span>
                  <span className="text-xs text-gray-500 uppercase tracking-wide font-semibold mt-1">Total Audits</span>
              </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-100">
              <CardContent className="p-4 flex flex-col justify-center items-center text-center">
                  <Target className="w-6 h-6 text-green-600 mb-2" />
                  <span className="text-2xl font-bold text-gray-900">{avgScore}%</span>
                  <span className="text-xs text-gray-500 uppercase tracking-wide font-semibold mt-1">Avg Compliance</span>
              </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-100">
              <CardContent className="p-4 flex flex-col justify-center items-center text-center">
                  <Clock className="w-6 h-6 text-yellow-600 mb-2" />
                  <span className="text-2xl font-bold text-gray-900">{overdueAudits}</span>
                  <span className="text-xs text-gray-500 uppercase tracking-wide font-semibold mt-1">Overdue Audits</span>
              </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-50 to-rose-50 border-red-100">
              <CardContent className="p-4 flex flex-col justify-center items-center text-center">
                  <AlertTriangle className="w-6 h-6 text-red-600 mb-2" />
                  <div className="flex gap-4">
                      <div className="text-center">
                          <span className="text-2xl font-bold text-gray-900 block">{escalatedAudits}</span>
                          <span className="text-[10px] text-gray-500 uppercase font-semibold">Escalated</span>
                      </div>
                      <div className="text-center">
                          <span className="text-2xl font-bold text-gray-900 block">{openCAs}</span>
                          <span className="text-[10px] text-gray-500 uppercase font-semibold">Open CAs</span>
                      </div>
                  </div>
              </CardContent>
          </Card>
      </div>

      <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4 max-w-2xl bg-white border">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="users">Team Performance</TabsTrigger>
              <TabsTrigger value="failed">Failed Items</TabsTrigger>
              <TabsTrigger value="entities">Contractors/Projects</TabsTrigger>
          </TabsList>
          
          <div className="mt-6">
              <TabsContent value="overview">
                  <AnalyticsOverviewTab audits={filteredAudits} correctiveActions={filteredCAs} settings={settings} />
              </TabsContent>
              <TabsContent value="users">
                  <AnalyticsUsersTab audits={filteredAudits} settings={settings} />
              </TabsContent>
              <TabsContent value="failed">
                  <AnalyticsFailedItemsTab responses={responses} templateItems={templateItems} audits={filteredAudits} />
              </TabsContent>
              <TabsContent value="entities">
                  <AnalyticsEntitiesTab audits={filteredAudits} correctiveActions={filteredCAs} />
              </TabsContent>
          </div>
      </Tabs>
    </div>
  );
}