import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, Clock, Search, Plus, ChevronRight, CheckCircle, XCircle, Filter } from 'lucide-react';
import { format, isAfter } from 'date-fns';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';
import CreateAuditDialog from '@/components/auditing/CreateAuditDialog';
import BulkIssueAuditDialog from '@/components/auditing/BulkIssueAuditDialog';

const STATUS_COLORS = {
  'Draft': 'bg-gray-100 text-gray-700',
  'Open': 'bg-blue-100 text-blue-700',
  'Awaiting Auditor Assignment': 'bg-yellow-100 text-yellow-700',
  'In Progress': 'bg-indigo-100 text-indigo-700',
  'Completed': 'bg-green-100 text-green-700',
  'Under Review': 'bg-purple-100 text-purple-700',
  'Closed': 'bg-gray-200 text-gray-600',
  'Overdue': 'bg-red-100 text-red-700',
  'Escalated': 'bg-orange-100 text-orange-700',
};

const RESULT_COLORS = {
  'Pass': 'bg-green-100 text-green-800',
  'Needs Review': 'bg-yellow-100 text-yellow-800',
  'Fail': 'bg-red-100 text-red-800',
  'Pending': 'bg-gray-100 text-gray-600',
};

export default function AuditList() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const { data: audits = [], isLoading, refetch } = useQuery({
    queryKey: ['audits'],
    queryFn: () => base44.entities.AuditRecord.list('-created_date', 200),
    initialData: [],
  });

  const myAudits = useMemo(() => {
    if (!currentUser) return [];
    return audits.filter(a =>
      a.assignedAuditor === currentUser.email ||
      a.defaultOwner === currentUser.email ||
      a.created_by === currentUser.email
    );
  }, [audits, currentUser]);

  const filtered = (list) => list.filter(a => {
    const matchSearch = !searchTerm ||
      a.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.module?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchModule = moduleFilter === 'all' || a.module === moduleFilter;
    const matchStatus = statusFilter === 'all' || a.status === statusFilter;
    return matchSearch && matchModule && matchStatus;
  });

  const isAdmin = currentUser?.role === 'admin';

  const handleQuickPass = async (e, audit) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to pass and close "${audit.title}"?`)) return;
    try {
      await base44.entities.AuditRecord.update(audit.id, {
        status: 'Closed',
        result: 'Pass',
        escalated: false,
        completedDate: new Date().toISOString()
      });
      refetch();
    } catch (err) {
      alert('Error updating audit: ' + err.message);
    }
  };

  const AuditRow = ({ audit }) => {
    const isOverdue = audit.dueDate && isAfter(new Date(), new Date(audit.dueDate)) && !['Closed', 'Completed'].includes(audit.status);
    const showQuickPass = isAdmin && (isOverdue || audit.status === 'Escalated' || audit.escalated);

    return (
      <div
        className={`flex items-center justify-between p-4 border rounded-xl bg-white hover:shadow-md transition-all cursor-pointer group ${isOverdue ? 'border-red-200 bg-red-50/30' : ''}`}
        onClick={() => navigate(createPageUrl('AuditExecution') + `?auditId=${audit.id}`)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 truncate">{audit.title}</p>
            {audit.escalated && <Badge className="bg-orange-100 text-orange-700 text-xs">Escalated</Badge>}
            {isOverdue && <Badge className="bg-red-100 text-red-700 text-xs flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Overdue</Badge>}
            {audit.isOffSite && <Badge className="bg-red-100 text-red-700 text-xs flex items-center gap-1">Off-Site Check-in</Badge>}
          </div>
          <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-500">
            <span>{audit.module}</span>
            <span className="text-gray-300">•</span>
            <span>{audit.frequency}</span>
            {audit.dueDate && (
              <>
                <span className="text-gray-300">•</span>
                <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                  Due: {format(new Date(audit.dueDate), 'MMM d, yyyy')}
                </span>
              </>
            )}
            {audit.assignedAuditor && (
              <>
                <span className="text-gray-300">•</span>
                <span>Auditor: {audit.assignedAuditor}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 ml-4 flex-shrink-0">
          {showQuickPass && (
            <Button
              size="sm"
              variant="outline"
              className="border-green-200 text-green-700 hover:bg-green-50 mr-2 z-10"
              onClick={(e) => handleQuickPass(e, audit)}
            >
              <CheckCircle className="w-3 h-3 mr-1" />
              Pass & Resolve
            </Button>
          )}
          <Badge className={STATUS_COLORS[audit.status] || 'bg-gray-100 text-gray-700'}>{audit.status}</Badge>
          {audit.result && audit.result !== 'Pending' && (
            <Badge className={RESULT_COLORS[audit.result]}>{audit.result}</Badge>
          )}
          {audit.compliancePercentage != null && (
            <span className="text-sm font-medium text-gray-700">{audit.compliancePercentage}%</span>
          )}
          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
        </div>
      </div>
    );
  };

  const EmptyState = () => (
    <div className="text-center py-12 border-2 border-dashed rounded-xl bg-gray-50">
      <CheckCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
      <h3 className="text-gray-700 font-medium text-lg">No audits found</h3>
      <p className="text-gray-500 text-sm mt-1">Try adjusting your filters or create a new audit.</p>
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Audit List</h1>
          <p className="text-gray-500 mt-1">All operational audits across departments</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button variant="outline" onClick={() => setBulkOpen(true)}>
              Issue Bulk Audits
            </Button>
          )}
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Audit
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search audits..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Modules" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modules</SelectItem>
            <SelectItem value="Recruiting">Recruiting</SelectItem>
            <SelectItem value="Project Management">Project Management</SelectItem>
            <SelectItem value="Quality Control">Quality Control</SelectItem>
            <SelectItem value="Contractor Offboarding">Contractor Offboarding</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.keys(STATUS_COLORS).map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="my">My Audits ({myAudits.length})</TabsTrigger>
          <TabsTrigger value="all">All Audits ({audits.length})</TabsTrigger>
          <TabsTrigger value="overdue">Overdue</TabsTrigger>
          <TabsTrigger value="awaiting">Awaiting Assignment</TabsTrigger>
        </TabsList>

        <TabsContent value="my" className="space-y-3 mt-4">
          {filtered(myAudits).length === 0 ? <EmptyState /> :
            filtered(myAudits).map(a => <AuditRow key={a.id} audit={a} />)}
        </TabsContent>

        <TabsContent value="all" className="space-y-3 mt-4">
          {isLoading ? <p className="text-gray-400 text-center py-8">Loading...</p> :
            filtered(audits).length === 0 ? <EmptyState /> :
              filtered(audits).map(a => <AuditRow key={a.id} audit={a} />)}
        </TabsContent>

        <TabsContent value="overdue" className="space-y-3 mt-4">
          {filtered(audits.filter(a =>
            a.dueDate && isAfter(new Date(), new Date(a.dueDate)) && !['Closed', 'Completed'].includes(a.status)
          )).map(a => <AuditRow key={a.id} audit={a} />)}
        </TabsContent>

        <TabsContent value="awaiting" className="space-y-3 mt-4">
          {filtered(audits.filter(a => a.status === 'Awaiting Auditor Assignment'))
            .map(a => <AuditRow key={a.id} audit={a} />)}
        </TabsContent>
      </Tabs>

      <CreateAuditDialog
        open={createOpen}
        users={[]}
        onClose={() => setCreateOpen(false)}
        onCreated={(newAudit) => {
          setCreateOpen(false);
          refetch();
          navigate(createPageUrl('AuditExecution') + `?auditId=${newAudit.id}`);
        }}
      />
      
      <BulkIssueAuditDialog 
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onIssued={() => {
          refetch();
          setBulkOpen(false);
          alert('Bulk audits issued successfully!');
        }}
      />
    </div>
  );
}