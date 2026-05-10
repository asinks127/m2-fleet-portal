
import React, { useState, useEffect } from 'react';
import { sendShadowingChecklist } from '@/functions.js';
import { User, ShadowingChecklist } from '@/api/entities.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Progress } from '@/components/ui/progress.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx';
import {
  Users, Clock, CheckCircle, AlertTriangle,
  ClipboardCheck, UserPlus, Edit, Send, Mail
} from 'lucide-react';
import { differenceInDays, addDays } from 'date-fns';

export default function ShadowingDashboard() {
  const [shadowingContractors, setShadowingContractors] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedContractor, setSelectedContractor] = useState(null);
  const [showChecklistDialog, setShowChecklistDialog] = useState(false);
  const [showAssignTechDialog, setShowAssignTechDialog] = useState(false);
  const [editingChecklist, setEditingChecklist] = useState(null);
  const [leadTechEmail, setLeadTechEmail] = useState('');
  const [leadTechName, setLeadTechName] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [userData, allUsers, checklistData] = await Promise.all([
        User.me(),
        User.list(),
        ShadowingChecklist.list()
      ]);

      setCurrentUser(userData);

      // Filter contractors who are currently shadowing
      const shadowingUsers = allUsers.filter(user =>
        user.shadowingStatus &&
        ['in_progress', 'not_started'].includes(user.shadowingStatus) &&
        user.active !== false &&
        user.email && user.email.includes('.contractor@')
      );

      setShadowingContractors(shadowingUsers);
      setChecklists(checklistData);
    } catch (error) {
      console.error('Error loading shadowing data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const startShadowing = async (contractorId) => {
    try {
      const today = new Date();
      const endDate = addDays(today, 14); // 2 weeks from now

      await User.update(contractorId, {
        shadowingStatus: 'in_progress',
        shadowingStartDate: today.toISOString().split('T')[0],
        shadowingEndDate: endDate.toISOString().split('T')[0]
      });

      // Create initial checklist
      const contractor = shadowingContractors.find(c => c.id === contractorId);
      await ShadowingChecklist.create({
        contractorId: contractorId,
        contractorName: contractor.displayName || contractor.full_name,
        contractorEmail: contractor.email,
        qcManagerEmail: currentUser.email,
        workflowStatus: 'draft' // Set initial workflow status
      });

      loadData();
    } catch (error) {
      console.error('Error starting shadowing:', error);
    }
  };

  const openAssignTechDialog = (contractor) => {
    setSelectedContractor(contractor);
    const existingChecklist = checklists.find(c => c.contractorId === contractor.id);
    setLeadTechEmail(existingChecklist?.trainerEmail || '');
    setLeadTechName(existingChecklist?.trainerName || '');
    setShowAssignTechDialog(true);
  };

  const handleAssignLeadTech = async () => {
    if (!leadTechEmail || !leadTechName) return;

    try {
      let checklist = checklists.find(c => c.contractorId === selectedContractor.id);
      
      // If no checklist exists, create one first
      if (!checklist) {
        console.log('No existing checklist found, creating one...');
        
        // Start shadowing if not already started
        if (selectedContractor.shadowingStatus !== 'in_progress') {
          const today = new Date();
          const endDate = addDays(today, 14);

          await User.update(selectedContractor.id, {
            shadowingStatus: 'in_progress',
            shadowingStartDate: today.toISOString().split('T')[0],
            shadowingEndDate: endDate.toISOString().split('T')[0]
          });
        }

        // Create the checklist
        const newChecklist = await ShadowingChecklist.create({
          contractorId: selectedContractor.id,
          contractorName: selectedContractor.displayName || selectedContractor.full_name,
          contractorEmail: selectedContractor.email,
          qcManagerEmail: currentUser.email,
          workflowStatus: 'draft'
        });
        
        checklist = newChecklist;
        console.log('Created new checklist:', checklist);
        
        // Add a small delay to ensure the checklist is fully saved
        // This might be crucial for the subsequent API call to find the newly created checklist in the backend
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      if (checklist && checklist.id) {
        console.log('Sending checklist with ID:', checklist.id);
        
        // Call the external function to send the checklist
        const response = await sendShadowingChecklist({
          checklistId: checklist.id,
          trainerEmail: leadTechEmail,
          trainerName: leadTechName
        });
        
        if (response && response.data && response.data.success) { 
          setShowAssignTechDialog(false);
          setLeadTechEmail('');
          setLeadTechName('');
          loadData(); // Reload to show updated status
          
          console.log('Checklist sent successfully to lead tech');
          alert('Checklist sent successfully to the Lead Tech!');
        } else {
          const errorMsg = response?.data?.error || 'Unknown error occurred';
          console.error('Failed to send checklist:', errorMsg);
          alert(`Failed to send checklist: ${errorMsg}`);
        }
      } else {
        console.error('Failed to create or find checklist, or missing ID for selected contractor.');
        alert('Failed to create or find checklist. Please ensure the contractor has a checklist associated, or try again.');
      }
    } catch (error) {
      console.error('Error assigning lead tech:', error);
      alert(`Error assigning lead tech: ${error.message || 'Please try again.'}`);
    }
  };

  const openChecklistDialog = (contractor) => {
    setSelectedContractor(contractor);
    const existingChecklist = checklists.find(c => c.contractorId === contractor.id);
    setEditingChecklist(existingChecklist || {
      contractorId: contractor.id,
      contractorName: contractor.displayName || contractor.full_name,
      contractorEmail: contractor.email,
      qcManagerEmail: currentUser?.email || '',
      safetyOrientationComplete: false,
      toolsAndEquipmentReview: false,
      hasTools: false,
      firstInstallShadowed: false,
      qualityStandardsReview: false,
      isPunctualAndReliable: false,
      independentInstallObserved: false,
      finalApproval: false,
      qcNotes: '',
      trainerNotes: '',
      workflowStatus: 'draft'
    });
    setShowChecklistDialog(true);
  };

  const saveChecklist = async () => {
    try {
      const existingChecklist = checklists.find(c => c.contractorId === selectedContractor.id);

      // Determine new workflow status if all items are complete
      const checklistItems = [
        'safetyOrientationComplete', 'toolsAndEquipmentReview', 'hasTools', 'firstInstallShadowed',
        'qualityStandardsReview', 'isPunctualAndReliable', 'independentInstallObserved',
        'finalApproval'
      ];

      const completedItems = checklistItems.filter(item => editingChecklist[item]).length;
      const isComplete = completedItems === checklistItems.length;

      let updatedChecklistData = { ...editingChecklist };

      if (isComplete && editingChecklist.workflowStatus !== 'approved_by_qc') {
        updatedChecklistData.workflowStatus = 'approved_by_qc';
      } else if (editingChecklist.workflowStatus === 'completed_by_trainer' && !isComplete) {
        // If trainer completed but QC hasn't fully approved, keep as 'completed_by_trainer'
        // Or set to a 'review_in_progress' if such status exists. For now, keep it simple.
      }


      if (existingChecklist) {
        await ShadowingChecklist.update(existingChecklist.id, updatedChecklistData);
      } else {
        await ShadowingChecklist.create(updatedChecklistData);
      }

      if (isComplete) {
        await User.update(selectedContractor.id, {
          shadowingStatus: 'completed',
          shadowingCompletedBy: currentUser.email,
          needsInsuranceSetup: true,
          needsContractSetup: true
        });
      }

      setShowChecklistDialog(false);
      loadData();
    } catch (error) {
      console.error('Error saving checklist:', error);
    }
  };

  const getShadowingProgress = (contractor) => {
    const checklist = checklists.find(c => c.contractorId === contractor.id);
    if (!checklist) return 0;

    const items = [
      'safetyOrientationComplete', 'toolsAndEquipmentReview', 'hasTools', 'firstInstallShadowed',
      'qualityStandardsReview', 'isPunctualAndReliable', 'independentInstallObserved',
      'finalApproval'
    ];

    const completed = items.filter(item => checklist[item]).length;
    return Math.round((completed / items.length) * 100);
  };

  const getWorkflowStatusBadge = (checklist) => {
    if (!checklist) return null;

    const statusColors = {
      'draft': 'bg-gray-100 text-gray-800',
      'sent_to_trainer': 'bg-blue-100 text-blue-800',
      'completed_by_trainer': 'bg-yellow-100 text-yellow-800',
      'approved_by_qc': 'bg-green-100 text-green-800',
      'rejected': 'bg-red-100 text-red-800'
    };

    const statusLabels = {
      'draft': 'Draft',
      'sent_to_trainer': 'With Lead Tech',
      'completed_by_trainer': 'Awaiting QC Review',
      'approved_by_qc': 'Approved',
      'rejected': 'Rejected'
    };

    return (
      <Badge className={statusColors[checklist.workflowStatus] || 'bg-gray-100 text-gray-800'}>
        {statusLabels[checklist.workflowStatus] || 'Unknown'}
      </Badge>
    );
  };

  const getShadowingStatusBadge = (contractor) => {
    const status = contractor.shadowingStatus;
    const startDate = contractor.shadowingStartDate;

    if (status === 'completed') {
      return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
    }

    if (status === 'failed') {
      return <Badge className="bg-red-100 text-red-800">Failed</Badge>;
    }

    if (status === 'in_progress' && startDate) {
      const daysRemaining = 14 - differenceInDays(new Date(), new Date(startDate));
      if (daysRemaining <= 0) {
        return <Badge className="bg-red-100 text-red-800">Overdue</Badge>;
      }
      if (daysRemaining <= 3) {
        return <Badge className="bg-yellow-100 text-yellow-800">Due Soon ({daysRemaining}d left)</Badge>;
      }
      return <Badge className="bg-blue-100 text-blue-800">In Progress ({daysRemaining}d left)</Badge>;
    }

    return <Badge className="bg-gray-100 text-gray-800">Not Started</Badge>;
  };

  if (isLoading) {
    return <div className="p-6 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Shadowing Dashboard</h1>
          <p className="text-gray-600 mt-1">Track new contractor shadowing and onboarding progress</p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid md:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-blue-600 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Total Shadowing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{shadowingContractors.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-yellow-600 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              In Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {shadowingContractors.filter(c => c.shadowingStatus === 'in_progress').length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Overdue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {shadowingContractors.filter(c => {
                if (c.shadowingStatus !== 'in_progress' || !c.shadowingStartDate) return false;
                return differenceInDays(new Date(), new Date(c.shadowingStartDate)) > 14;
              }).length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-green-600 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Ready for Contracts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {shadowingContractors.filter(c => c.needsContractSetup).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Shadowing Table */}
      <Card>
        <CardHeader>
          <CardTitle>Active Shadowing Contractors</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contractor</TableHead>
                  <TableHead>Assigned Lead Tech</TableHead>
                  <TableHead>Workflow Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shadowingContractors.map(contractor => {
                  const checklist = checklists.find(c => c.contractorId === contractor.id);
                  
                  return (
                    <TableRow key={contractor.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{contractor.displayName || contractor.full_name}</div>
                          <div className="text-sm text-gray-500">{contractor.email}</div>
                          <div className="mt-1">{getShadowingStatusBadge(contractor)}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {checklist?.trainerName || 'Not assigned'}
                        {checklist?.trainerEmail && (
                          <div className="text-sm text-gray-500">{checklist.trainerEmail}</div>
                        )}
                      </TableCell>
                      <TableCell>{getWorkflowStatusBadge(checklist)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={getShadowingProgress(contractor)} className="w-20" />
                          <span className="text-sm">{getShadowingProgress(contractor)}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2 flex-wrap">
                          {contractor.shadowingStatus === 'not_started' ? (
                            <Button size="sm" onClick={() => startShadowing(contractor.id)}>
                              <UserPlus className="w-4 h-4 mr-1" />
                              Start Shadowing
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => openAssignTechDialog(contractor)}>
                              <Send className="w-4 h-4 mr-1" />
                              {checklist?.workflowStatus === 'sent_to_trainer' ? 'Reassign Lead Tech' : 'Assign Lead Tech'}
                            </Button>
                          )}
                          
                          {/* This button will now always appear if a checklist exists */}
                          {checklist && (
                            <Button
                              size="sm"
                              variant={checklist.workflowStatus === 'completed_by_trainer' ? 'default' : 'outline'}
                              className={checklist.workflowStatus === 'completed_by_trainer' ? 'bg-yellow-600 text-white hover:bg-yellow-700' : ''}
                              onClick={() => openChecklistDialog(contractor)}
                            >
                              {checklist.workflowStatus === 'completed_by_trainer' ? 
                                <ClipboardCheck className="w-4 h-4 mr-1" /> : 
                                <Edit className="w-4 h-4 mr-1" />
                              }
                              {checklist.workflowStatus === 'completed_by_trainer' ? 'Review & Approve' : 'View / Edit Checklist'}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Assign Lead Tech Dialog */}
      <Dialog open={showAssignTechDialog} onOpenChange={setShowAssignTechDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Lead Tech</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-600">
              Assign a Lead Tech for <strong>{selectedContractor?.displayName || selectedContractor?.full_name}</strong>.
              The Lead Tech will receive an email with a secure link to complete the shadowing checklist.
            </p>
            <div>
              <Label htmlFor="leadTechName">Lead Tech Name</Label>
              <Input
                id="leadTechName"
                value={leadTechName}
                onChange={(e) => setLeadTechName(e.target.value)}
                placeholder="Enter lead tech's full name"
              />
            </div>
            <div>
              <Label htmlFor="leadTechEmail">Lead Tech Email</Label>
              <Input
                id="leadTechEmail"
                type="email"
                value={leadTechEmail}
                onChange={(e) => setLeadTechEmail(e.target.value)}
                placeholder="Enter lead tech's email address"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignTechDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAssignLeadTech}
              disabled={!leadTechEmail || !leadTechName}
            >
              <Mail className="w-4 h-4 mr-2" />
              Send Checklist
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QC Review Dialog */}
      <Dialog open={showChecklistDialog} onOpenChange={setShowChecklistDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              QC Review - {selectedContractor?.displayName || selectedContractor?.full_name}
            </DialogTitle>
          </DialogHeader>

          {editingChecklist && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4">
                {[
                  { key: 'safetyOrientationComplete', label: 'Safety Orientation Complete', dateKey: 'safetyOrientationDate' },
                  { key: 'toolsAndEquipmentReview', label: 'Tools and Equipment Review', dateKey: 'toolsReviewDate' },
                  { key: 'hasTools', label: 'Has All Required Tools', dateKey: 'hasToolsDate' },
                  { key: 'firstInstallShadowed', label: 'First Installation Shadowed', dateKey: 'firstInstallDate' },
                  { key: 'qualityStandardsReview', label: 'Quality Standards Review', dateKey: 'qualityReviewDate' },
                  { key: 'isPunctualAndReliable', label: 'Is Punctual and Reliable', dateKey: 'punctualAndReliableDate' },
                  { key: 'independentInstallObserved', label: 'Independent Install Observed', dateKey: 'independentInstallDate' },
                  { key: 'finalApproval', label: 'Final QC Approval', dateKey: 'finalApprovalDate' }
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={editingChecklist[item.key] || false}
                        onCheckedChange={(checked) =>
                          setEditingChecklist({
                            ...editingChecklist,
                            [item.key]: checked,
                            [item.dateKey]: checked ? new Date().toISOString().split('T')[0] : ''
                          })
                        }
                        // The 'disabled' property has been removed to allow editing at all times
                      />
                      <Label>{item.label}</Label>
                    </div>
                    {editingChecklist[item.key] && (
                      <Input
                        type="date"
                        value={editingChecklist[item.dateKey] || ''}
                        onChange={(e) => setEditingChecklist({
                          ...editingChecklist,
                          [item.dateKey]: e.target.value
                        })}
                        className="w-40"
                        // The 'disabled' property has been removed
                      />
                    )}
                  </div>
                ))}
              </div>

              {editingChecklist.trainerNotes && (
                <div>
                  <Label>Lead Tech Notes</Label>
                  <div className="p-3 bg-gray-50 border rounded-lg">
                    <p className="text-sm">{editingChecklist.trainerNotes}</p>
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="qcNotes">QC Manager Notes</Label>
                <Textarea
                  id="qcNotes"
                  value={editingChecklist.qcNotes || ''}
                  onChange={(e) => setEditingChecklist({
                    ...editingChecklist,
                    qcNotes: e.target.value
                  })}
                  rows={4}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowChecklistDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={saveChecklist}>
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
