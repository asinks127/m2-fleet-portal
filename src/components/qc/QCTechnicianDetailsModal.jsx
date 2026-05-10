import React, { useState, useEffect } from 'react';
import { CallLog, QCInspection } from '@/api/entities.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import { 
  Phone, Mail, MapPin, Building, User, Calendar, 
  ClipboardCheck, MessageSquarePlus, Star, TrendingUp,
  Clock, AlertCircle, Pencil, Trash2
} from 'lucide-react';
import QCInspectionDialog from './QCInspectionDialog';
import { User as UserEntity } from '@/api/entities.js';
import { format } from 'date-fns';

export default function QCTechnicianDetailsModal({ technician, isOpen, onClose, onLogCall, onRecordInspection }) {
  const [callLogs, setCallLogs] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingInspection, setEditingInspection] = useState(null);
  const [isEditInspectionOpen, setIsEditInspectionOpen] = useState(false);

  useEffect(() => {
    if (isOpen && technician) {
      loadTechnicianData();
    }
  }, [isOpen, technician]);

  const loadTechnicianData = async () => {
    setIsLoading(true);
    try {
      const [calls, qcInspections] = await Promise.all([
        CallLog.filter({ technicianId: technician.id }, '-callDate'),
        QCInspection.filter({ technicianId: technician.id }, '-inspectionDate')
      ]);
      setCallLogs(calls);
      setInspections(qcInspections);
    } catch (error) {
      console.error('Error loading technician data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteInspection = async (inspectionId) => {
    if (!window.confirm('Are you sure you want to delete this inspection? This cannot be undone.')) {
      return;
    }

    try {
      await QCInspection.delete(inspectionId);
      
      // Recalculate average score
      const remainingInspections = await QCInspection.filter({ technicianId: technician.id });
      const avgScore = remainingInspections.length > 0 
        ? remainingInspections.reduce((sum, insp) => sum + insp.score, 0) / remainingInspections.length
        : 0;
      
      await UserEntity.update(technician.id, { avgQcScore: Math.round(avgScore) });
      
      // Refresh list
      loadTechnicianData();
    } catch (error) {
      console.error('Error deleting inspection:', error);
      alert('Failed to delete inspection');
    }
  };

  const handleEditInspection = (inspection) => {
    setEditingInspection(inspection);
    setIsEditInspectionOpen(true);
  };

  if (!technician) return null;

  const getScoreColor = (score) => {
    if (score >= 95) return 'text-green-600 bg-green-100';
    if (score >= 85) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getVelocitiScoreColor = (score) => {
    if (score >= 90) return 'text-green-600 bg-green-100';
    if (score >= 70) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <User className="w-6 h-6" />
            {technician.displayName || technician.full_name} - QC Profile
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="flex gap-3">
            <Button onClick={() => onLogCall(technician)} className="bg-blue-600 hover:bg-blue-700">
              <Phone className="w-4 h-4 mr-2" />
              Log Call
            </Button>
            <Button onClick={() => onRecordInspection(technician)} className="bg-green-600 hover:bg-green-700">
              <ClipboardCheck className="w-4 h-4 mr-2" />
              Record Inspection
            </Button>
          </div>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="calls">Call History</TabsTrigger>
              <TabsTrigger value="inspections">Inspections</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Contact Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Contact Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Mail className="w-4 h-4 text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-500">Email</p>
                        <p className="font-medium">{technician.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="w-4 h-4 text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-500">Phone</p>
                        <p className="font-medium">{technician.phone || 'Not provided'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <MapPin className="w-4 h-4 text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-500">Location</p>
                        <p className="font-medium">{technician.location || 'Not specified'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Building className="w-4 h-4 text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-500">Business</p>
                        <p className="font-medium">{technician.business || 'Not specified'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Project Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Project Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-500">Project</p>
                      <p className="font-medium">{technician.project || 'Not assigned'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">M2 Project Manager</p>
                      <p className="font-medium">{technician.m2PM || 'Not assigned'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Velo Project Manager</p>
                      <p className="font-medium">{technician.veloPM || 'Not assigned'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">QC Assignment</p>
                      <Badge variant="outline">
                        {technician.qcAssignment || 'Not assigned'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Performance Scores */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Current Performance Scores</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-6">
                    <div className="flex items-center gap-3">
                      <ClipboardCheck className="w-5 h-5 text-blue-500" />
                      <div>
                        <p className="text-sm text-gray-500">Average QC Score</p>
                        <Badge className={getScoreColor(technician.avgQcScore || 0)}>
                          {technician.avgQcScore || 0}/100
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Star className="w-5 h-5 text-yellow-500" />
                      <div>
                        <p className="text-sm text-gray-500">Velociti Score</p>
                        <Badge className={getVelocitiScoreColor(technician.velocitiScore || 100)}>
                          {technician.velocitiScore || 100}/100
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="calls" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Call History ({callLogs.length})</h3>
                <Button onClick={() => onLogCall(technician)} size="sm">
                  <Phone className="w-4 h-4 mr-2" />
                  Log New Call
                </Button>
              </div>
              
              {isLoading ? (
                <div className="text-center py-8 text-gray-500">Loading call history...</div>
              ) : callLogs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Phone className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No calls logged yet for this technician.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {callLogs.map(call => (
                    <Card key={call.id}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <Badge variant="outline">
                            {format(new Date(call.callDate), 'MMM d, yyyy - h:mm a')}
                          </Badge>
                          <p className="text-sm text-gray-500">Logged by: {call.loggedBy}</p>
                        </div>
                        <p className="text-gray-700 bg-gray-50 p-3 rounded-md">
                          {call.note || 'No notes provided.'}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="inspections" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">QC Inspections ({inspections.length})</h3>
                <Button onClick={() => onRecordInspection(technician)} size="sm">
                  <ClipboardCheck className="w-4 h-4 mr-2" />
                  Record Inspection
                </Button>
              </div>
              
              {isLoading ? (
                <div className="text-center py-8 text-gray-500">Loading inspection history...</div>
              ) : inspections.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No inspections recorded yet for this technician.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {inspections.map(inspection => (
                    <Card key={inspection.id}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-3">
                            <Badge className={getScoreColor(inspection.score)}>
                              Score: {inspection.score}/100
                            </Badge>
                            <Badge variant="outline">
                              {format(new Date(inspection.inspectionDate), 'MMM d, yyyy')}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-gray-500 mr-2">Inspector: {inspection.qcUserName}</p>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                              onClick={() => handleEditInspection(inspection)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600 hover:text-red-800 hover:bg-red-50"
                              onClick={() => handleDeleteInspection(inspection.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-gray-700 bg-gray-50 p-3 rounded-md">
                          {inspection.notes || 'No notes provided.'}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="performance" className="space-y-4">
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">QC Performance Trends</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {inspections.length > 0 ? (
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span>Total Inspections:</span>
                          <Badge variant="outline">{inspections.length}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Average Score:</span>
                          <Badge className={getScoreColor(technician.avgQcScore || 0)}>
                            {technician.avgQcScore || 0}/100
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Last Inspection:</span>
                          <span className="text-sm text-gray-500">
                            {format(new Date(inspections[0]?.inspectionDate), 'MMM d, yyyy')}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-4">No inspection data available</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Communication Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span>Total Calls Logged:</span>
                        <Badge variant="outline">{callLogs.length}</Badge>
                      </div>
                      {callLogs.length > 0 && (
                        <div className="flex justify-between">
                          <span>Last Call:</span>
                          <span className="text-sm text-gray-500">
                            {format(new Date(callLogs[0]?.callDate), 'MMM d, yyyy')}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Status:</span>
                        <Badge variant={technician.active ? 'default' : 'secondary'}>
                          {technician.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>

      <QCInspectionDialog
        technician={technician}
        isOpen={isEditInspectionOpen}
        onClose={() => {
          setIsEditInspectionOpen(false);
          setEditingInspection(null);
        }}
        onSuccess={() => {
          loadTechnicianData();
          setIsEditInspectionOpen(false);
          setEditingInspection(null);
        }}
        inspectionToEdit={editingInspection}
      />
    </Dialog>
  );
}