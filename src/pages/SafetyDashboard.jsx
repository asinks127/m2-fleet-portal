import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldAlert, AlertTriangle, Stethoscope, CheckCircle2, Clock, BookOpen, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <Card>
      <CardContent className="p-6 flex items-center gap-4">
        <div className={`p-3 rounded-full ${color}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <div className="text-3xl font-bold text-gray-900">{value}</div>
          <div className="text-sm text-gray-500">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function severityBadge(s) {
  if (s === 'Immediate Action Required' || s === 'Open - Immediate') return 'bg-red-100 text-red-800 border-red-200';
  if (s === 'Serious' || s === 'Open - Serious' || s === 'Critical') return 'bg-orange-100 text-orange-800 border-orange-200';
  if (s?.includes('Resolved') || s?.includes('Closed')) return 'bg-green-100 text-green-800 border-green-200';
  return 'bg-gray-100 text-gray-700 border-gray-200';
}

export default function SafetyDashboard() {
  const [hazards, setHazards] = useState([]);
  const [injuries, setInjuries] = useState([]);
  const [correctiveActions, setCorrectiveActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [haz, inj, ca] = await Promise.all([
        base44.entities.SafetyHazardReport.list('-created_date'),
        base44.entities.SafetyInjuryReport.list('-created_date'),
        base44.entities.SafetyCorrectiveAction.list('-created_date'),
      ]);
      setHazards(haz || []);
      setInjuries(inj || []);
      setCorrectiveActions(ca || []);
    } catch (error) {
      console.error('Error fetching safety data:', error);
    } finally {
      setLoading(false);
    }
  };

  const openHazards = hazards.filter(h => !['Resolved', 'Closed'].includes(h.status));
  const seriousHazards = hazards.filter(h => h.status === 'Open - Serious');
  const immediateHazards = hazards.filter(h => h.status === 'Open - Immediate');
  const openInjuries = injuries.filter(i => !['Resolved', 'Closed'].includes(i.status));

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="p-6 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Safety Dashboard</h1>
          <p className="text-gray-600 mt-1">Real-time overview of safety reports and corrective actions.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(createPageUrl('HazardReportsQueue'))}>
            <ShieldAlert className="w-4 h-4 mr-2" /> Hazard Queue
          </Button>
          <Button variant="outline" onClick={() => navigate(createPageUrl('InjuryReportsQueue'))}>
            <Stethoscope className="w-4 h-4 mr-2" /> Injury Queue
          </Button>
        </div>
      </div>

      {immediateHazards.length > 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-6">
          <h2 className="text-xl font-bold text-red-800 flex items-center">
            <AlertTriangle className="w-6 h-6 mr-2 animate-pulse" />
            {immediateHazards.length} IMMEDIATE ACTION REQUIRED Hazard{immediateHazards.length > 1 ? 's' : ''}
          </h2>
          <p className="text-red-600 mt-1">These require immediate attention and response.</p>
          <div className="mt-4 space-y-2">
            {immediateHazards.map(h => (
              <div key={h.id} className="bg-white p-3 rounded-lg border border-red-200 flex justify-between items-center">
                <div>
                  <strong>{h.submittedByName}</strong> - {h.projectName} - {h.siteLocation}
                  <div className="text-sm text-gray-600">{h.description?.slice(0, 100)}...</div>
                </div>
                <Button size="sm" variant="destructive" onClick={() => navigate(createPageUrl('SafetyReportDetail') + `?id=${h.id}&type=Hazard`)}>
                  <Eye className="w-4 h-4 mr-1" /> Review
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Open Hazards" value={openHazards.length} icon={ShieldAlert} color="bg-orange-100 text-orange-600" />
        <StatCard label="Serious Hazards" value={seriousHazards.length} icon={AlertTriangle} color="bg-orange-200 text-orange-700" />
        <StatCard label="Immediate Hazards" value={immediateHazards.length} icon={AlertTriangle} color="bg-red-100 text-red-600" />
        <StatCard label="Open Injury Reports" value={openInjuries.length} icon={Stethoscope} color="bg-red-100 text-red-600" />
        <StatCard label="Open Corrective Actions" value={correctiveActions.filter(ca => ['Open', 'In Progress', 'Waiting', 'Overdue'].includes(ca.status)).length} icon={Clock} color="bg-yellow-100 text-yellow-600" />
        <StatCard label="Total Reports" value={hazards.length + injuries.length} icon={CheckCircle2} color="bg-blue-100 text-blue-600" />
      </div>

      {/* Immediate Hazards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-red-800 flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 text-red-600" />
              Recent Hazard Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hazards.slice(0, 5).map(h => (
              <div key={h.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <div className="font-medium text-gray-900">{h.submittedByName} <span className="text-gray-500">• {h.projectName}</span></div>
                  <div className="text-sm text-gray-600">{h.hazardCategory} — {format(new Date(h.created_date), 'MMM d')}</div>
                </div>
                <Badge variant="outline" className={`text-xs ${severityBadge(h.status)}`}>{h.status}</Badge>
              </div>
            ))}
            {hazards.length === 0 && <p className="text-gray-500 py-4 text-center">No hazard reports.</p>}
            <Button className="w-full mt-4" variant="outline" onClick={() => navigate(createPageUrl('HazardReportsQueue'))}>
              View All
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-red-900 flex items-center">
              <Stethoscope className="w-5 h-5 mr-2 text-red-600" />
              Recent Injury / Accident Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            {injuries.slice(0, 5).map(i => (
              <div key={i.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <div className="font-medium text-gray-900">{i.submittedByName} <span className="text-gray-500">• {i.projectName}</span></div>
                  <div className="text-sm text-gray-600">{i.incidentType} — {format(new Date(i.created_date), 'MMM d')}</div>
                </div>
                <Badge variant="outline" className={`text-xs ${severityBadge(i.status)}`}>{i.status}</Badge>
              </div>
            ))}
            {injuries.length === 0 && <p className="text-gray-500 py-4 text-center">No injury reports.</p>}
            <Button className="w-full mt-4" variant="outline" onClick={() => navigate(createPageUrl('InjuryReportsQueue'))}>
              View All
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Open Corrective Actions */}
      {correctiveActions.filter(ca => ca.status !== 'Complete').length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="w-5 h-5 mr-2 text-yellow-600" />
              Open Corrective Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="p-3">Report ID</th>
                    <th className="p-3">Action Required</th>
                    <th className="p-3">Assigned To</th>
                    <th className="p-3">Due Date</th>
                    <th className="p-3">Priority</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {correctiveActions.filter(ca => ca.status !== 'Complete').slice(0, 5).map(ca => (
                    <tr key={ca.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-mono text-gray-500">{ca.linkedReportId}</td>
                      <td className="p-3">{ca.actionRequired?.slice(0, 60)}...</td>
                      <td className="p-3">{ca.assignedTo}</td>
                      <td className="p-3">{ca.dueDate ? format(new Date(ca.dueDate), 'MMM d, yyyy') : '-'}</td>
                      <td className="p-3"><Badge variant="outline" className={ca.priority === 'Critical' ? 'bg-red-100 text-red-800' : ''}>{ca.priority}</Badge></td>
                      <td className="p-3"><Badge variant="outline">{ca.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button className="w-full mt-4" variant="outline" onClick={() => navigate(createPageUrl('CorrectiveActionsTracker'))}>
              View All Corrective Actions
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}