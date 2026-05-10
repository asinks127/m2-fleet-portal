import React, { useState, useEffect, useCallback } from 'react';
import { Invoice, WorkersCompRecord, SafetyCertification, CallLog, QCInspection } from '@/api/entities.js';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent } from '@/components/ui/card.jsx';
import { 
  TrendingUp, 
  Shield, 
  FileText, 
  Activity, 
  Phone, 
  ClipboardCheck,
  AlertTriangle,
  CheckCircle,
  Clock,
  Star,
  Loader2
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import CallLogDialog from '../qc/CallLogDialog';
import QCInspectionDialog from '../qc/QCInspectionDialog';

export default function ExpandedContractorRow({ user, onUpdate }) {
  const [data, setData] = useState({
    invoices: [],
    wcRecord: null,
    certifications: [],
    callLogs: [],
    inspections: [],
    isLoading: true
  });
  
  const [showCallLogDialog, setShowCallLogDialog] = useState(false);
  const [showInspectionDialog, setShowInspectionDialog] = useState(false);

  const loadExpandedData = useCallback(async () => {
    try {
      const [invoices, wcRecords, certs, callLogs, inspections] = await Promise.all([
        Invoice.filter({ contractorEmail: user.email }, '-created_date', 10),
        WorkersCompRecord.filter({ userEmail: user.email }),
        SafetyCertification.filter({ userEmail: user.email }),
        CallLog.filter({ technicianId: user.id }, '-callDate', 5),
        QCInspection.filter({ technicianId: user.id }, '-inspection_date', 5)
      ]);

      setData({
        invoices,
        wcRecord: wcRecords[0] || null,
        certifications: certs,
        callLogs,
        inspections,
        isLoading: false
      });
    } catch (error) {
      console.error('Error loading expanded data:', error);
      setData(prev => ({ ...prev, isLoading: false }));
    }
  }, [user.email, user.id]);

  useEffect(() => {
    loadExpandedData();
  }, [loadExpandedData]);

  const handleDialogSuccess = () => {
    setShowCallLogDialog(false);
    setShowInspectionDialog(false);
    loadExpandedData();
    if (onUpdate) onUpdate();
  };

  if (data.isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading details...</span>
      </div>
    );
  }

  // Calculate invoice compliance for last week
  const now = new Date();
  const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
  const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
  const lastWeekInvoices = data.invoices.filter(inv => {
    const createdDate = new Date(inv.created_at || inv.invoiceDate || inv.created_date);
    return createdDate >= lastWeekStart && createdDate <= lastWeekEnd;
  });
  const submittedLastWeek = lastWeekInvoices.length > 0;

  // Calculate compliance status
  const getComplianceStatus = () => {
    const { wcRecord, certifications } = data;
    if (!wcRecord || certifications.length === 0) {
      return { status: 'missing', text: 'Missing Documents', color: 'bg-red-100 text-red-800', icon: AlertTriangle };
    }
    
    const today = new Date();
    const wcExpired = wcRecord.expirationDate && new Date(wcRecord.expirationDate) < today;
    const certsExpired = certifications.some(cert => cert.expirationDate && new Date(cert.expirationDate) < today);
    
    if (wcExpired || certsExpired) {
      return { status: 'expired', text: 'Documents Expired', color: 'bg-red-100 text-red-800', icon: AlertTriangle };
    }
    
    const wcExpiring = wcRecord.expirationDate && new Date(wcRecord.expirationDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const certsExpiring = certifications.some(cert => cert.expirationDate && new Date(cert.expirationDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
    
    if (wcExpiring || certsExpiring) {
      return { status: 'expiring', text: 'Documents Expiring Soon', color: 'bg-yellow-100 text-yellow-800', icon: Clock };
    }
    
    return { status: 'compliant', text: 'Compliant', color: 'bg-green-100 text-green-800', icon: CheckCircle };
  };

  const complianceStatus = getComplianceStatus();
  const ComplianceIcon = complianceStatus.icon;

  return (
    <div className="p-6 space-y-6">
      {/* Quick Actions Bar */}
      <div className="flex gap-3 pb-4 border-b">
        <Button size="sm" onClick={() => setShowCallLogDialog(true)}>
          <Phone className="w-4 h-4 mr-2" />
          Log Call
        </Button>
        <Button size="sm" onClick={() => setShowInspectionDialog(true)}>
          <ClipboardCheck className="w-4 h-4 mr-2" />
          Record QC Inspection
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Performance Summary */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <h4 className="font-semibold">Performance</h4>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Velociti Score:</span>
                <Badge className={
                  (Number(user.velocitiScore || 0)) >= 90 ? 'bg-green-100 text-green-800' :
                  (Number(user.velocitiScore || 0)) >= 70 ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }>
                  {Number(Number(user.velocitiScore || 0))}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">QC Average:</span>
                <Badge variant="outline">{Number(Number(user.avgQcScore || 0))}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Velo Survey:</span>
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                  <span className="text-sm">{user.veloSurveyFeedback || 'N/A'}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invoice Compliance */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-5 h-5 text-purple-600" />
              <h4 className="font-semibold">Invoice Status</h4>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Last Week:</span>
                <Badge className={submittedLastWeek ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                  {submittedLastWeek ? 'Submitted' : 'Missing'}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Invoices:</span>
                <span className="text-sm font-medium">{data.invoices.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Last Submission:</span>
                <span className="text-xs text-gray-500">
                  {data.invoices[0] ? format(new Date(data.invoices[0].created_at || data.invoices[0].invoiceDate || data.invoices[0].created_date), 'MMM d') : 'Never'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Safety & Compliance */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-5 h-5 text-green-600" />
              <h4 className="font-semibold">Compliance</h4>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ComplianceIcon className="w-4 h-4" />
                <Badge className={complianceStatus.color}>
                  {complianceStatus.text}
                </Badge>
              </div>
              <div className="text-xs text-gray-600 space-y-1">
                {data.wcRecord && (
                  <div>
                    Workers Comp: Exp. {data.wcRecord.expirationDate ? format(new Date(data.wcRecord.expirationDate), 'MMM d, yyyy') : 'N/A'}
                  </div>
                )}
                {data.certifications.length > 0 && (
                  <div>
                    {data.certifications.length} certification{data.certifications.length > 1 ? 's' : ''} on file
                  </div>
                )}
                {!data.wcRecord && !data.certifications.length && (
                  <div className="text-red-600">No compliance documents on file</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-5 h-5 text-orange-600" />
              <h4 className="font-semibold">Recent Activity</h4>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Call Logs:</span>
                <span className="text-sm font-medium">{data.callLogs.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">QC Inspections:</span>
                <span className="text-sm font-medium">{data.inspections.length}</span>
              </div>
              {data.callLogs[0] && (
                <div className="text-xs text-gray-500">
                  Last call: {format(new Date(data.callLogs[0].callDate), 'MMM d')}
                </div>
              )}
              {data.inspections[0] && (
                <div className="text-xs text-gray-500">
                  Last inspection: {format(new Date(data.inspections[0].inspection_date || data.inspections[0].inspectionDate), 'MMM d')} - Score: {data.inspections[0].score}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Call Logs */}
      {data.callLogs.length > 0 && (
        <div>
          <h4 className="font-semibold mb-2 flex items-center gap-2">
            <Phone className="w-4 h-4" />
            Recent Call Logs
          </h4>
          <div className="space-y-2">
            {data.callLogs.map(log => (
              <div key={log.id} className="p-3 bg-gray-50 rounded-lg border text-sm">
                <div className="flex justify-between items-start">
                  <span className="font-medium">{format(new Date(log.callDate || log.created_at), 'MMM d, yyyy h:mm a')}</span>
                  <span className="text-xs text-gray-500">by {log.loggedBy}</span>
                </div>
                {log.note && <p className="text-gray-600 mt-1">{log.note}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent QC Inspections */}
      {data.inspections.length > 0 && (
        <div>
          <h4 className="font-semibold mb-2 flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4" />
            Recent QC Inspections
          </h4>
          <div className="space-y-2">
            {data.inspections.map(inspection => (
              <div key={inspection.id} className="p-3 bg-gray-50 rounded-lg border text-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-medium">{format(new Date(inspection.inspection_date || inspection.inspectionDate), 'MMM d, yyyy')}</span>
                    <Badge className="ml-2">{inspection.score}/100</Badge>
                  </div>
                  <span className="text-xs text-gray-500">by {inspection.qcUserName}</span>
                </div>
                {inspection.notes && <p className="text-gray-600 mt-1">{inspection.notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dialogs */}
      {showCallLogDialog && (
        <CallLogDialog 
          isOpen={showCallLogDialog} 
          onClose={() => setShowCallLogDialog(false)} 
          technician={user}
          onSuccess={handleDialogSuccess}
        />
      )}

      {showInspectionDialog && (
        <QCInspectionDialog 
          isOpen={showInspectionDialog} 
          onClose={() => setShowInspectionDialog(false)} 
          technician={user}
          onSuccess={handleDialogSuccess}
        />
      )}
    </div>
  );
}