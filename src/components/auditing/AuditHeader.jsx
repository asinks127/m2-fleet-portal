import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Calendar, User, Users, Building2, CheckCircle, XCircle, Clock, TrendingUp, MapPin } from 'lucide-react';
import { format, isAfter } from 'date-fns';

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

const RESULT_CONFIG = {
  'Pass': { color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle, iconColor: 'text-green-500' },
  'Needs Review': { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock, iconColor: 'text-yellow-500' },
  'Fail': { color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle, iconColor: 'text-red-500' },
  'Pending': { color: 'bg-gray-100 text-gray-600 border-gray-200', icon: Clock, iconColor: 'text-gray-400' },
};

export default function AuditHeader({ audit, scoreData, completedItems, totalItems, users, isAdmin, onAssignAuditor }) {
  const [assigning, setAssigning] = useState(false);
  const [selectedAuditor, setSelectedAuditor] = useState('');

  if (!audit) return null;

  const isOverdue = audit.dueDate && isAfter(new Date(), new Date(audit.dueDate)) && !['Closed', 'Completed'].includes(audit.status);
  const resultCfg = RESULT_CONFIG[scoreData?.result || 'Pending'] || RESULT_CONFIG['Pending'];
  const ResultIcon = resultCfg.icon;
  const needsAuditorAssignment = ['Monthly', 'Quarterly', 'Annual'].includes(audit.frequency) && !audit.assignedAuditor && isAdmin;
  const progressPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  return (
    <Card className="border-2 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap justify-between items-start gap-3">
          <div>
            <CardTitle className="text-2xl text-gray-900">{audit.title}</CardTitle>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge className={STATUS_COLORS[audit.status] || 'bg-gray-100 text-gray-700'}>{audit.status}</Badge>
              <Badge variant="outline">{audit.module}</Badge>
              <Badge variant="outline">{audit.frequency}</Badge>
              {audit.escalated && <Badge className="bg-orange-100 text-orange-700"><AlertTriangle className="w-3 h-3 mr-1" />Escalated</Badge>}
              {isOverdue && <Badge className="bg-red-100 text-red-700"><AlertTriangle className="w-3 h-3 mr-1" />Overdue</Badge>}
              {audit.isOffSite && <Badge className="bg-red-100 text-red-700"><MapPin className="w-3 h-3 mr-1" />Off-Site</Badge>}
            </div>
          </div>
          {/* Live Score */}
          <div className={`flex items-center gap-3 px-5 py-3 rounded-xl border ${resultCfg.color}`}>
            <ResultIcon className={`w-6 h-6 ${resultCfg.iconColor}`} />
            <div>
              <p className="text-xs font-medium opacity-70">Compliance Score</p>
              <p className="text-2xl font-bold leading-none">{scoreData?.percentage ?? 0}%</p>
              <p className="text-xs mt-0.5 font-semibold">{scoreData?.result || 'Pending'}</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Key Info Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500 font-medium">Check-in Location</p>
              <p className="text-sm font-semibold text-gray-900">
                {audit.checkInLatitude && audit.checkInLongitude ? 
                  `${audit.checkInLatitude.toFixed(4)}, ${audit.checkInLongitude.toFixed(4)}` : 
                  'Not recorded'}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500 font-medium">Due Date</p>
              <p className={`text-sm font-semibold ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                {audit.dueDate ? format(new Date(audit.dueDate), 'MMM d, yyyy') : '—'}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Building2 className="w-4 h-4 text-gray-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500 font-medium">Department</p>
              <p className="text-sm font-semibold text-gray-900">{audit.responsibleDepartment || '—'}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <TrendingUp className="w-4 h-4 text-gray-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500 font-medium">Points Earned</p>
              <p className="text-sm font-semibold text-gray-900">{scoreData?.earnedPoints ?? 0} / {scoreData?.totalPoints ?? 0}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-gray-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500 font-medium">Progress</p>
              <p className="text-sm font-semibold text-gray-900">{completedItems} / {totalItems} items</p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        {totalItems > 0 && (
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Completion Progress</span>
              <span>{progressPct}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}

        {/* Ownership Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg border shadow-sm">
              <Building2 className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Operational Owner</p>
              <p className="text-sm font-semibold text-gray-900">{audit.defaultOwner || 'Not set'}</p>
              <p className="text-xs text-gray-400">Responsible for this function</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg border shadow-sm">
              <User className="w-5 h-5 text-indigo-500" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Assigned Auditor</p>
              {audit.assignedAuditor ? (
                <p className="text-sm font-semibold text-gray-900">{audit.assignedAuditor}</p>
              ) : (
                <p className="text-sm text-yellow-600 font-medium">Not yet assigned</p>
              )}
              <p className="text-xs text-gray-400">Performing the audit</p>
            </div>
          </div>
        </div>

        {/* Assign Auditor - Admin only, for M/Q/A audits */}
        {needsAuditorAssignment && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-yellow-900 mb-3">
              <AlertTriangle className="w-4 h-4 inline mr-1" />
              This {audit.frequency} audit requires an auditor to be manually assigned.
            </p>
            <div className="flex gap-2">
              <Select value={selectedAuditor} onValueChange={setSelectedAuditor}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select an auditor..." />
                </SelectTrigger>
                <SelectContent>
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.email}>{u.full_name || u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                disabled={!selectedAuditor || assigning}
                onClick={async () => {
                  setAssigning(true);
                  await onAssignAuditor(selectedAuditor);
                  setAssigning(false);
                }}
              >
                Assign
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}