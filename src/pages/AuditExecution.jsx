import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AuditHeader from '@/components/auditing/AuditHeader';
import ChecklistSection from '@/components/auditing/ChecklistSection';
import CreateCorrectiveActionDialog from '@/components/auditing/CreateCorrectiveActionDialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, CheckCircle, AlertTriangle, XCircle, ArrowLeft, Send, Clock, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';

export default function AuditExecution() {
  const urlParams = new URLSearchParams(window.location.search);
  const auditId = urlParams.get('auditId');
  const queryClient = useQueryClient();

  const [responses, setResponses] = useState({});
  const [auditNotes, setAuditNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [caDialog, setCaDialog] = useState({ open: false, itemId: null });
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const { data: audit, isLoading: auditLoading, refetch: refetchAudit } = useQuery({
    queryKey: ['audit', auditId],
    queryFn: async () => {
      const r = await base44.entities.AuditRecord.filter({ id: auditId });
      return r[0] || null;
    },
    enabled: !!auditId,
  });

  const { data: templateItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['auditItems', audit?.templateId],
    queryFn: () => base44.entities.AuditTemplateItem.filter({ templateId: audit.templateId }, 'sortOrder'),
    enabled: !!audit?.templateId,
  });

  const { data: existingResponses = [], isLoading: responsesLoading, refetch: refetchResponses } = useQuery({
    queryKey: ['auditResponses', auditId],
    queryFn: () => base44.entities.AuditResponse.filter({ auditId }),
    enabled: !!auditId,
  });

  const { data: correctiveActions = [], refetch: refetchCAs } = useQuery({
    queryKey: ['auditCAs', auditId],
    queryFn: () => base44.entities.CorrectiveAction.filter({ auditId }),
    enabled: !!auditId,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    initialData: [],
  });

  const { data: settingsList = [] } = useQuery({
    queryKey: ['auditSettings'],
    queryFn: () => base44.entities.AuditSystemSetting.filter({}),
    initialData: [],
  });
  const settings = settingsList[0] || { passThreshold: 90, needsReviewThreshold: 80 };

  // Initialize responses from existing saved data
  useEffect(() => {
    if (existingResponses.length > 0) {
      const map = {};
      existingResponses.forEach(r => {
        map[r.itemId] = { id: r.id, responseValue: r.responseValue || '', notes: r.notes || '', attachmentUrl: r.attachmentUrl || '' };
      });
      setResponses(map);
    }
  }, [existingResponses]);

  // Real-time score calculation
  const scoreData = useMemo(() => {
    const scorableItems = templateItems.filter(i => i.pointValue > 0 || ['pass_fail', 'yes_no'].includes(i.responseType));
    const totalPoints = scorableItems.reduce((sum, i) => sum + (i.pointValue || (['pass_fail', 'yes_no'].includes(i.responseType) ? 1 : 0)), 0);
    let earnedPoints = 0;
    let criticalFailed = false;

    scorableItems.forEach(item => {
      const resp = responses[item.id];
      const itemPts = item.pointValue || (['pass_fail', 'yes_no'].includes(item.responseType) ? 1 : 0);
      if (!resp?.responseValue) return;
      const val = resp.responseValue.toLowerCase();
      if (item.responseType === 'pass_fail' || item.responseType === 'yes_no') {
        const isReverseScored = item.question?.toLowerCase().includes('delay');
        const passValues = isReverseScored ? ['pass', 'no'] : ['pass', 'yes'];
        const failValues = isReverseScored ? ['fail', 'yes'] : ['fail', 'no'];

        if (passValues.includes(val)) earnedPoints += itemPts;
        if (failValues.includes(val) && item.isCritical) criticalFailed = true;
      } else {
        if (resp.responseValue) earnedPoints += itemPts;
      }
    });

    const percentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
    const answeredCount = Object.values(responses).filter(r => r.responseValue).length;
    let result = 'Pending';
    
    if (answeredCount > 0) {
      if (criticalFailed) {
        result = 'Fail';
      } else if (totalPoints > 0) {
        if (percentage >= settings.passThreshold) result = 'Pass';
        else if (percentage >= settings.needsReviewThreshold) result = 'Needs Review';
        else result = 'Fail';
      } else {
        result = 'Pass'; // No scorable items but answers exist
      }
    }

    // Preserve the AI override or custom status if it's already graded and closed/completed
    if (audit && ['Completed', 'Under Review', 'Closed'].includes(audit.status) && audit.overallScore !== null && audit.compliancePercentage !== null) {
      return {
        totalPoints,
        earnedPoints: audit.overallScore,
        percentage: audit.compliancePercentage,
        result: audit.result || result,
        criticalFailed,
        answeredCount
      };
    }

    return { totalPoints, earnedPoints, percentage, result, criticalFailed, answeredCount };
  }, [templateItems, responses, settings, audit]);

  // Group items by section
  const sections = useMemo(() => {
    const map = {};
    templateItems.forEach(item => {
      const key = item.sectionName || 'General';
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    return map;
  }, [templateItems]);

  const handleResponse = (itemId, field, value) => {
    setResponses(prev => ({ ...prev, [itemId]: { ...prev[itemId], [field]: value } }));
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const handleStartAudit = async () => {
    if (!navigator.geolocation) {
      handleSave('In Progress');
      return;
    }
    setSaving(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        let isOffSite = false;
        
        if (audit.siteLatitude && audit.siteLongitude) {
          const dist = calculateDistance(latitude, longitude, audit.siteLatitude, audit.siteLongitude);
          if (dist !== null && dist > 500) {
            isOffSite = true;
          }
        }
        
        handleSave('In Progress', {
          checkInLatitude: latitude,
          checkInLongitude: longitude,
          isOffSite: isOffSite
        });
      },
      (error) => {
        console.warn("Geolocation error:", error);
        handleSave('In Progress'); // Fallback if user denies location
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleSave = async (newStatus, additionalUpdateData = {}) => {
    if (!auditId) return;
    setSaving(true);
    setSuccessMsg('');
    try {
      // Save all responses
      const promises = Object.entries(responses).map(async ([itemId, resp]) => {
        const payload = {
          auditId, itemId,
          responseValue: resp.responseValue,
          notes: resp.notes,
          attachmentUrl: resp.attachmentUrl,
          completedBy: currentUser?.email,
          completedDate: new Date().toISOString()
        };
        if (resp.id) return base44.entities.AuditResponse.update(resp.id, payload);
        if (resp.responseValue) return base44.entities.AuditResponse.create(payload);
      });
      await Promise.all(promises.filter(Boolean));

      // Build audit update payload
      const statusToSet = newStatus || (audit?.status === 'Open' ? 'In Progress' : audit?.status);
      const update = { status: statusToSet, ...additionalUpdateData };

      if (['Completed', 'Under Review', 'Closed', 'Resolve Escalation'].includes(newStatus)) {
        update.completedDate = new Date().toISOString();
        update.overallScore = scoreData.earnedPoints;
        update.compliancePercentage = scoreData.percentage;
        update.result = scoreData.result;
        update.correctiveActionRequired = scoreData.result === 'Fail' || scoreData.criticalFailed;
        if (scoreData.criticalFailed && newStatus !== 'Resolve Escalation') {
          update.escalated = true;
          update.escalationReason = 'Critical item failed during audit execution';
        }
      }
      if (newStatus === 'Escalated') {
        update.escalated = true;
      }
      if (newStatus === 'Resolve Escalation') {
        update.escalated = false;
        update.status = 'Closed';
        update.result = 'Pass';
      }

      await base44.entities.AuditRecord.update(auditId, update);
      await refetchAudit();
      await refetchResponses();
      setSuccessMsg(newStatus ? `Audit status updated to "${newStatus}".` : 'Progress saved.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      alert('Error saving: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const isAdmin = currentUser?.role === 'admin';
  const canEdit = isAdmin || audit?.assignedAuditor === currentUser?.email || audit?.defaultOwner === currentUser?.email;
  const isClosed = ['Closed', 'Completed', 'Under Review'].includes(audit?.status) && !isAdmin;
  const completedItems = Object.values(responses).filter(r => r.responseValue).length;
  const totalItems = templateItems.length;

  if (!auditId) return (
    <div className="p-10 text-center text-gray-500">No audit selected. Please navigate from the Audit List.</div>
  );

  if (auditLoading || responsesLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" /><span className="ml-3 text-gray-600">Loading audit...</span>
    </div>
  );

  if (!audit) return (
    <div className="p-10 text-center text-gray-500">Audit not found.</div>
  );

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
      {/* Back nav */}
      <Link to={createPageUrl('AuditList')} className="inline-flex items-center text-sm text-blue-600 hover:underline">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Audit List
      </Link>

      {successMsg && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{successMsg}</AlertDescription>
        </Alert>
      )}

      {audit.isOffSite && (
        <Alert variant="destructive" className="bg-red-50 text-red-900 border-red-200">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription>
            <strong>Off-Site Check-in Detected:</strong> The technician checked in more than 500 meters from the assigned site address.
            <br />
            <span className="text-sm">Recorded Location: {audit.checkInLatitude?.toFixed(4)}, {audit.checkInLongitude?.toFixed(4)}</span>
          </AlertDescription>
        </Alert>
      )}

      {audit.checkInLatitude && audit.checkInLongitude && !audit.isOffSite && (
        <Alert className="bg-blue-50 border-blue-200">
          <MapPin className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <strong>Location Verified:</strong> Checked in successfully at coordinates {audit.checkInLatitude.toFixed(4)}, {audit.checkInLongitude.toFixed(4)}.
          </AlertDescription>
        </Alert>
      )}
      
      {audit.status === 'Completed' && !audit.checkInLatitude && !audit.isOffSite && (
        <Alert className="bg-gray-50 border-gray-200">
          <MapPin className="h-4 w-4 text-gray-500" />
          <AlertDescription className="text-gray-700">
            <strong>Location Not Recorded:</strong> This audit was completed before location tracking was enabled.
          </AlertDescription>
        </Alert>
      )}

      {scoreData.criticalFailed && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>A critical item has failed — this audit will be escalated upon submission.</AlertDescription>
        </Alert>
      )}

      <AuditHeader
        audit={audit}
        scoreData={scoreData}
        completedItems={completedItems}
        totalItems={totalItems}
        users={users}
        isAdmin={isAdmin}
        onAssignAuditor={async (email) => {
          await base44.entities.AuditRecord.update(auditId, { assignedAuditor: email, status: 'Open' });
          await refetchAudit();
          if (email) {
            const url = `${window.location.origin}/AuditExecution?auditId=${auditId}`;
            try {
              await base44.integrations.Core.SendEmail({
                to: email,
                subject: `Action Required: New Audit Assigned (${audit.title})`,
                body: `Hello,\n\nYou have been manually assigned an audit: ${audit.title}.\n\nPlease click the link below to complete the audit:\n${url}\n\nThank you.`
              });
            } catch (e) {
              console.error("Failed to send assignment email", e);
            }
          }
        }}
      />

      {/* Checklist Sections */}
      {audit.status === 'Awaiting Auditor Assignment' && !isAdmin ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
          <Clock className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-yellow-900">Awaiting Auditor Assignment</h3>
          <p className="text-yellow-700 text-sm mt-1">An admin must assign an auditor before this audit can be started.</p>
        </div>
      ) : templateItems.length === 0 ? (
        <div className="bg-white border rounded-xl p-8 text-center">
          <p className="text-gray-400">No checklist items for this audit template. Notes-only audit.</p>
        </div>
      ) : (
        Object.entries(sections).map(([sectionName, items]) => (
          <ChecklistSection
            key={sectionName}
            sectionName={sectionName}
            items={items}
            responses={responses}
            onResponse={handleResponse}
            onCreateCA={(itemId) => setCaDialog({ open: true, itemId })}
            disabled={isClosed || !canEdit}
          />
        ))
      )}

      {/* General Notes */}
      {canEdit && !isClosed && (
        <div className="bg-white border rounded-xl p-6 space-y-3">
          <h3 className="font-semibold text-gray-900">General Audit Notes</h3>
          <Textarea
            placeholder="Add notes, observations, or reviewer comments..."
            value={auditNotes}
            onChange={(e) => setAuditNotes(e.target.value)}
            className="min-h-[100px]"
          />
        </div>
      )}

      {/* Action Buttons */}
      {canEdit && !isClosed && (
        <div className="bg-white border rounded-xl p-5 flex flex-wrap gap-3 items-center">
          <Button variant="outline" onClick={() => handleSave()} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Draft
          </Button>

          {['Open', 'Draft'].includes(audit.status) && (
            <Button onClick={handleStartAudit} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Start Audit
            </Button>
          )}

          {audit.status === 'In Progress' && (
            <Button onClick={() => handleSave('Completed')} disabled={saving} className="bg-green-600 hover:bg-green-700">
              <CheckCircle className="w-4 h-4 mr-2" />
              Submit & Complete
            </Button>
          )}

          {isAdmin && audit.status === 'Completed' && (
            <Button onClick={() => handleSave('Under Review')} disabled={saving} variant="outline">
              <Send className="w-4 h-4 mr-2" />
              Send for Review
            </Button>
          )}

          {isAdmin && ['Completed', 'Under Review'].includes(audit.status) && (
            <Button onClick={() => handleSave('Closed')} disabled={saving} variant="outline">
              Close Audit
            </Button>
          )}

          {isAdmin && (audit.status === 'Escalated' || audit.escalated) && (
            <Button onClick={() => handleSave('Resolve Escalation')} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white">
              <CheckCircle className="w-4 h-4 mr-2" />
              Resolve & Pass
            </Button>
          )}

          {isAdmin && !audit.escalated && audit.status !== 'Escalated' && (
            <Button variant="outline" className="border-orange-300 text-orange-600 hover:bg-orange-50"
              onClick={() => handleSave('Escalated')} disabled={saving}>
              <AlertTriangle className="w-4 h-4 mr-2" />
              Escalate
            </Button>
          )}

          {isAdmin && (
            <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50"
              onClick={() => setCaDialog({ open: true, itemId: null })}>
              <XCircle className="w-4 h-4 mr-2" />
              Add Corrective Action
            </Button>
          )}
        </div>
      )}

      {/* Corrective Actions Summary */}
      {correctiveActions.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <h3 className="font-semibold text-red-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Corrective Actions ({correctiveActions.length})
          </h3>
          <div className="space-y-3">
            {correctiveActions.map(ca => (
              <div key={ca.id} className="bg-white border border-red-100 rounded-lg p-4 flex justify-between items-start">
                <div>
                  <p className="font-medium text-gray-900">{ca.title}</p>
                  <p className="text-sm text-gray-600 mt-1">{ca.description}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Owner: {ca.ownerEmail} | Due: {ca.dueDate ? format(new Date(ca.dueDate), 'MMM d, yyyy') : 'N/A'}
                  </p>
                </div>
                <Badge className={ca.status === 'Closed' ? 'bg-green-100 text-green-800' : ca.status === 'In Progress' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}>
                  {ca.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <CreateCorrectiveActionDialog
        open={caDialog.open}
        auditId={auditId}
        users={users}
        onClose={() => setCaDialog({ open: false, itemId: null })}
        onCreated={() => { setCaDialog({ open: false, itemId: null }); refetchCAs(); }}
      />
    </div>
  );
}