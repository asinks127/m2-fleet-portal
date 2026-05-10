import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowLeft, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

export default function SafetyReportDetail() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get('id');
  const reportId = urlParams.get('reportId'); // Sometimes we only have the reportId string
  const type = urlParams.get('type') || 'Hazard'; // Hazard or Injury/Accident
  
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);

  // Edit states for management
  const [status, setStatus] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [rootCauseSummary, setRootCauseSummary] = useState('');
  const [resolutionSummary, setResolutionSummary] = useState('');

  useEffect(() => {
    fetchReport();
  }, [id, reportId]);

  const fetchReport = async () => {
    try {
      const me = await base44.auth.me();
      setUser(me);

      let data;
      if (id) {
        if (type === 'Hazard') data = await base44.entities.SafetyHazardReport.get(id);
        else data = await base44.entities.SafetyInjuryReport.get(id);
      } else if (reportId) {
        if (type === 'Hazard') {
          const list = await base44.entities.SafetyHazardReport.filter({ reportId });
          data = list[0];
        } else {
          const list = await base44.entities.SafetyInjuryReport.filter({ reportId });
          data = list[0];
        }
      }

      if (data) {
        setReport(data);
        setStatus(data.status || '');
        setAdminNotes(data.adminNotes || data.investigationNotes || '');
        setRootCauseSummary(data.rootCauseSummary || '');
        setResolutionSummary(data.resolutionSummary || '');
      }
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Could not load report.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = { status, rootCauseSummary, resolutionSummary };
      if (type === 'Hazard') updates.adminNotes = adminNotes;
      else updates.investigationNotes = adminNotes;

      if (status === 'Closed' && report.status !== 'Closed') {
        updates.finalClosedDate = new Date().toISOString();
      }

      if (type === 'Hazard') {
        await base44.entities.SafetyHazardReport.update(report.id, updates);
      } else {
        await base44.entities.SafetyInjuryReport.update(report.id, updates);
      }

      toast({ title: 'Success', description: 'Report updated.' });
      fetchReport();
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to update report.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  if (!report) {
    return <div className="p-6 text-center">Report not found.</div>;
  }

  const isHazard = type === 'Hazard';
  const isAdminOrPM = user?.role === 'admin' || user?.email === report.assignedPmEmail || user?.email === 'orville@m2fleetcom.com';

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-2xl font-bold text-gray-900 flex-1">
          {isHazard ? 'Hazard Report' : 'Injury / Accident Report'}: {report.reportId}
        </h1>
        <Badge variant="outline" className="text-sm px-3 py-1 bg-gray-100">{report.status}</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="bg-gray-50 border-b py-3">
              <CardTitle className="text-lg">Reporter & Location</CardTitle>
            </CardHeader>
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><strong className="text-gray-500 block text-xs">Submitted By</strong>{report.submittedByName} ({report.submittedByEmail})</div>
              <div><strong className="text-gray-500 block text-xs">Submitted Date</strong>{format(new Date(report.submittedAt || report.created_date), 'PPP p')}</div>
              <div><strong className="text-gray-500 block text-xs">Project</strong>{report.projectName}</div>
              <div><strong className="text-gray-500 block text-xs">Site Location</strong>{report.siteLocation}</div>
              <div><strong className="text-gray-500 block text-xs">Assigned PM</strong>{report.assignedPmName || 'Unassigned'}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="bg-gray-50 border-b py-3">
              <CardTitle className="text-lg">Incident Details</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {isHazard ? (
                  <>
                    <div><strong className="text-gray-500 block text-xs">Date & Time</strong>{report.hazardDate} {report.hazardTime}</div>
                    <div><strong className="text-gray-500 block text-xs">Category</strong>{report.hazardCategory}</div>
                    <div><strong className="text-gray-500 block text-xs">Severity</strong>{report.hazardSeverity}</div>
                  </>
                ) : (
                  <>
                    <div><strong className="text-gray-500 block text-xs">Date & Time</strong>{report.incidentDate} {report.incidentTime}</div>
                    <div><strong className="text-gray-500 block text-xs">Type</strong>{report.incidentType}</div>
                    <div><strong className="text-gray-500 block text-xs">Injured?</strong>{report.injured ? `Yes (${report.injuryType})` : 'No'}</div>
                  </>
                )}
              </div>

              <div>
                <strong className="text-gray-500 block text-xs mb-1">Description</strong>
                <p className="whitespace-pre-wrap bg-gray-50 p-3 rounded">{report.description || report.incidentDescription}</p>
              </div>

              <div>
                <strong className="text-gray-500 block text-xs mb-1">{isHazard ? 'What was happening at the time?' : 'Task being performed'}</strong>
                <p className="whitespace-pre-wrap">{report.activityAtTime || report.taskBeingPerformed}</p>
              </div>

              {report.immediateActionTaken || report.immediateCorrectiveAction ? (
                <div>
                  <strong className="text-gray-500 block text-xs mb-1">Immediate Action Taken</strong>
                  <p className="whitespace-pre-wrap bg-blue-50 p-3 rounded">{report.immediateActionTaken || report.immediateCorrectiveAction}</p>
                </div>
              ) : null}

              {isHazard ? (
                <div className="grid grid-cols-2 gap-4">
                  <div><strong className="text-gray-500 block text-xs">Work Stopped?</strong>{report.workNeedsToStop ? 'Yes' : 'No'}</div>
                  <div><strong className="text-gray-500 block text-xs">Immediate Danger?</strong>{report.immediateDanger ? 'Yes' : 'No'}</div>
                  <div><strong className="text-gray-500 block text-xs">Work Can Continue?</strong>{report.workCanContinueSafely}</div>
                  <div><strong className="text-gray-500 block text-xs">Leadership Notified?</strong>{report.siteLeadershipNotified ? 'Yes' : 'No'}</div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div><strong className="text-gray-500 block text-xs">Medical Needed?</strong>{report.medicalTreatmentNeeded ? 'Yes' : 'No'}</div>
                  <div><strong className="text-gray-500 block text-xs">Emergency Care?</strong>{report.emergencyCareNeeded ? 'Yes' : 'No'}</div>
                  <div><strong className="text-gray-500 block text-xs">Work Stopped?</strong>{report.workStopped ? 'Yes' : 'No'}</div>
                  <div><strong className="text-gray-500 block text-xs">Property Damage?</strong>{report.propertyDamageInvolved ? 'Yes' : 'No'}</div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Management Sidebar */}
        <div className="space-y-6">
          {isAdminOrPM ? (
            <Card className="border-blue-200">
              <CardHeader className="bg-blue-50 border-b border-blue-100 py-3">
                <CardTitle className="text-lg text-blue-900">Management Panel</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div>
                  <Label>Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {isHazard ? (
                        <>
                          <SelectItem value="Open - Standard">Open - Standard</SelectItem>
                          <SelectItem value="Open - Serious">Open - Serious</SelectItem>
                          <SelectItem value="Open - Immediate">Open - Immediate</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="Submitted - Needs Review">Submitted - Needs Review</SelectItem>
                          <SelectItem value="Under Investigation">Under Investigation</SelectItem>
                        </>
                      )}
                      <SelectItem value="Under Review">Under Review</SelectItem>
                      <SelectItem value="Waiting for Follow-up">Waiting for Follow-up</SelectItem>
                      <SelectItem value="Resolved">Resolved</SelectItem>
                      <SelectItem value="Closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Management Notes</Label>
                  <Textarea 
                    rows={3} 
                    value={adminNotes} 
                    onChange={e => setAdminNotes(e.target.value)} 
                    placeholder="Internal notes..."
                  />
                </div>

                <div>
                  <Label>Root Cause Summary</Label>
                  <Textarea 
                    rows={2} 
                    value={rootCauseSummary} 
                    onChange={e => setRootCauseSummary(e.target.value)} 
                  />
                </div>

                <div>
                  <Label>Resolution Summary</Label>
                  <Textarea 
                    rows={2} 
                    value={resolutionSummary} 
                    onChange={e => setResolutionSummary(e.target.value)} 
                  />
                </div>

                <Button className="w-full" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Updates
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="bg-gray-50 border-b py-3">
                <CardTitle className="text-lg">Management Notes</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4 text-sm text-gray-700">
                <p>Your report is currently <strong>{report.status}</strong>.</p>
                {report.resolutionSummary && (
                  <div className="bg-green-50 p-3 rounded border border-green-100">
                    <strong className="text-green-800 block mb-1">Resolution:</strong>
                    {report.resolutionSummary}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="text-sm text-gray-500 text-center p-4 bg-gray-50 rounded-lg border">
            Signed by: <br/><span className="font-semibold text-gray-900">{report.signatureName}</span><br/>
            Acknowledged accurate
          </div>
        </div>
      </div>
    </div>
  );
}