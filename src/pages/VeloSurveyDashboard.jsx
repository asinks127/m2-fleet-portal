
import React, { useState, useEffect } from 'react';
import { sendSurveyNotification, testEmail } from '@/functions.js';
import { VeloSurvey, VeloSurveyResponse, User } from '@/api/entities.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import {
  Send,
  Star,
  Calendar,
  Mail,
  CheckCircle,
  Clock,
  Plus,
  Loader2,
  Eye,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox.jsx';

const StarRatingDisplay = ({ rating }) => (
  <div className="flex items-center">
    {[...Array(5)].map((_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
        }`}
      />
    ))}
    <span className="ml-2 text-sm text-gray-600">({rating})</span>
  </div>
);

export default function VeloSurveyDashboard() {
  const [surveys, setSurveys] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [responses, setResponses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [actionStatus, setActionStatus] = useState(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedSurveys, setSelectedSurveys] = useState(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const [newSurvey, setNewSurvey] = useState({
    projectName: '',
    veloPM: '',
    veloPMEmail: '',
    selectedTechIds: []
  });

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const user = await User.me();
      setCurrentUser(user);

      const [surveysData, contractorsData, responsesData] = await Promise.all([
        VeloSurvey.list('-sentDate'),
        User.filter({ active: true }),
        VeloSurveyResponse.list('-submittedDate')
      ]);

      setSurveys(surveysData);
      setContractors(contractorsData.filter(user =>
        user.email && (
          user.email.toLowerCase().includes('.contractor@m2fleetcom.com') ||
          user.email.toLowerCase().includes('.contractor@smcinstallations.com')
        )
      ));
      setResponses(responsesData);
    } catch (error) {
      console.error('Error loading survey data:', error);
      setActionStatus({ type: 'error', message: 'Failed to load survey data.' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateSurvey = async () => {
    if (!newSurvey.projectName || !newSurvey.veloPM || !newSurvey.veloPMEmail || newSurvey.selectedTechIds.length === 0) {
      setActionStatus({ type: 'error', message: 'Please fill in all required fields and select at least one technician.' });
      return;
    }

    if (!currentUser) {
      setActionStatus({ type: 'error', message: 'Could not identify current user. Please refresh and try again.' });
      return;
    }

    setIsSending(true);
    setActionStatus(null);

    try {
      // Generate unique survey token
      const array = new Uint8Array(16);
      crypto.getRandomValues(array);
      const surveyToken = `survey_${Date.now()}_${Array.from(array, b => b.toString(16).padStart(2, '0')).join('')}`;

      // Create survey record first
      const survey = await VeloSurvey.create({
        projectName: newSurvey.projectName,
        veloPM: newSurvey.veloPM,
        veloPMEmail: newSurvey.veloPMEmail,
        technicianIds: newSurvey.selectedTechIds,
        surveyToken,
        sentDate: new Date().toISOString()
      });

      // CORRECTED: Use the new backend function to send the email
      try {
        await sendSurveyNotification({
          to: newSurvey.veloPMEmail,
          subject: `New Performance Survey Assignment - ${newSurvey.projectName}`,
          body: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2563eb;">New Survey Assignment</h2>
              
              <p>Hello ${newSurvey.veloPM},</p>
              
              <p>You have been assigned a new performance survey for the following project:</p>
              
              <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <strong>Project:</strong> ${newSurvey.projectName}<br />
                <strong>Technicians to Rate:</strong> ${newSurvey.selectedTechIds.length}
              </div>
              
              <p>To complete your survey, please log into your Velo PM portal:</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${window.location.origin}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                  Access Survey Portal
                </a>
              </div>
              
              <p>If you don't have an account yet, you'll be able to create one using this email address.</p>
              
              <p>Thank you!</p>
              <p>M2 Fleet Team</p>
            </div>
          `,
          from_name: 'M2 Fleet Survey System'
        });
      } catch (emailError) {
        console.warn('Failed to send notification email (non-blocking):', emailError);
      }

      setActionStatus({
        type: 'success',
        message: `Survey for "${newSurvey.projectName}" has been assigned to ${newSurvey.veloPM}. They have been notified via email.`
      });
      
      setShowCreateDialog(false);
      setNewSurvey({ projectName: '', veloPM: '', veloPMEmail: '', selectedTechIds: [] });
      loadData();

    } catch (error) {
      console.error('Complete error creating survey:', error);
      setActionStatus({
        type: 'error',
        message: `Failed to create survey: ${error.message}. Check console for details.`
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSelectSurvey = (surveyId, checked) => {
    const newSelected = new Set(selectedSurveys);
    if (checked) {
      newSelected.add(surveyId);
    } else {
      newSelected.delete(surveyId);
    }
    setSelectedSurveys(newSelected);
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedSurveys(new Set(surveys.map(s => s.id)));
    } else {
      setSelectedSurveys(new Set());
    }
  };

  const handleBulkDelete = async () => {
    setIsDeleting(true);
    setActionStatus(null);

    try {
      // Delete all selected surveys and their responses
      for (const surveyId of selectedSurveys) {
        const responsesToDelete = responses.filter(r => r.surveyId === surveyId);
        for (const response of responsesToDelete) {
          await VeloSurveyResponse.delete(response.id);
        }
        await VeloSurvey.delete(surveyId);
      }

      setActionStatus({ type: 'success', message: `Successfully deleted ${selectedSurveys.size} survey(s) and their responses.` });
      setSelectedSurveys(new Set());
      setShowDeleteConfirm(false);
      loadData();
    } catch (error) {
      console.error('Error deleting surveys:', error);
      setActionStatus({ type: 'error', message: 'Failed to delete some surveys.' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteSurvey = async (surveyId) => {
    setActionStatus(null);
    try {
      // Also delete associated responses
      const responsesToDelete = responses.filter(r => r.surveyId === surveyId);
      for (const response of responsesToDelete) {
        await VeloSurveyResponse.delete(response.id);
      }

      await VeloSurvey.delete(surveyId);

      setActionStatus({ type: 'success', message: 'Survey and its responses deleted successfully.' });
      setShowDeleteConfirm(false);
      setSelectedSurvey(null);
      loadData();
    } catch (error) {
      console.error('Error deleting survey:', error);
      setActionStatus({ type: 'error', message: 'Failed to delete survey.' });
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-100 text-blue-800"><Clock className="w-3 h-3 mr-1" />In Progress</Badge>;
      default:
        return <Badge className="bg-orange-100 text-orange-800"><Mail className="w-3 h-3 mr-1" />Sent</Badge>;
    }
  };

  const getSurveyResponses = (surveyId) => {
    return responses.filter(r => r.surveyId === surveyId);
  };

  const handleViewDetails = (survey) => {
    setSelectedSurvey(survey);
    setShowDetailsDialog(true);
  };

  const handleTestEmail = async () => {
    setActionStatus(null);
    if (!currentUser?.email) {
      setActionStatus({ type: 'error', message: 'No user email found to send test email.' });
      return;
    }

    try {
      const response = await testEmail({ testEmail: currentUser.email });

      if (response.data?.success) {
        setActionStatus({
          type: 'success',
          message: `Test email sent to ${currentUser.email}. Check your inbox and spam folder.`
        });
      } else {
        setActionStatus({
          type: 'error',
          message: `Test email failed: ${response.data?.error || 'Unknown error'}`
        });
      }
    } catch (error) {
      setActionStatus({
        type: 'error',
        message: `Test email error: ${error.message}. Please check console.`
      });
      console.error("Test email function error:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center items-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const uniqueVeloPMs = [...new Set(contractors.map(c => c.veloPM).filter(Boolean))];
  const surveyResponsesForDialog = selectedSurvey ? getSurveyResponses(selectedSurvey.id) : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Star className="w-8 h-8 text-yellow-500" />
            Velo PM Surveys
          </h1>
          <p className="text-gray-600 mt-1">Send performance surveys to Velo PMs and track responses.</p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleTestEmail}
            disabled={!currentUser}
          >
            Test Email
          </Button>
          {selectedSurveys.size > 0 && (
            <Button
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete Selected ({selectedSurveys.size})
            </Button>
          )}
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Assign Survey
          </Button>
        </div>
      </div>

      {actionStatus && (
        <Alert variant={actionStatus.type === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{actionStatus.message}</AlertDescription>
        </Alert>
      )}

      {/* Summary Stats */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Surveys</p>
              <p className="text-2xl font-bold">{surveys.length}</p>
            </div>
            <Send className="w-8 h-8 text-blue-500" />
          </div>
        </CardContent>
      </Card>
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold">{surveys.filter(s => s.status === 'completed').length}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold">{surveys.filter(s => s.status !== 'completed').length}</p>
              </div>
              <Clock className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Response Rate</p>
                <p className="text-2xl font-bold">
                  {surveys.length > 0 ? Math.round((surveys.filter(s => s.status === 'completed').length / surveys.length) * 100) : 0}%
                </p>
              </div>
              <Star className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Surveys Table */}
      <Card>
        <CardHeader>
          <CardTitle>Survey History</CardTitle>
        </CardHeader>
        <CardContent>
          {surveys.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedSurveys.size === surveys.length && surveys.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Velo PM</TableHead>
                    <TableHead>Technicians</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent Date</TableHead>
                    <TableHead>Responses</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {surveys.map(survey => {
                    const surveyResponses = getSurveyResponses(survey.id);
                    return (
                      <TableRow key={survey.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedSurveys.has(survey.id)}
                            onCheckedChange={(checked) => handleSelectSurvey(survey.id, checked)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{survey.projectName}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{survey.veloPM}</div>
                            <div className="text-sm text-gray-500">{survey.veloPMEmail}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{survey.technicianIds.length} techs</Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(survey.status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            {format(new Date(survey.sentDate), 'MMM d, yyyy')}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {surveyResponses.length} / {survey.technicianIds.length}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleViewDetails(survey)}>
                              <Eye className="w-4 h-4 mr-1" />
                              View
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                setSelectedSurvey(survey);
                                setShowDeleteConfirm(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Star className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No surveys sent yet.</p>
              <p className="text-sm">Create your first survey to get Velo PM feedback on technician performance.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Survey Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Velo PM Survey</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="projectName">Project Name *</Label>
              <Input
                id="projectName"
                value={newSurvey.projectName}
                onChange={(e) => setNewSurvey({...newSurvey, projectName: e.target.value})}
                placeholder="Enter project name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="veloPM">Velo PM Name *</Label>
                <Select
                  value={newSurvey.veloPM}
                  onValueChange={(value) => setNewSurvey({...newSurvey, veloPM: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Velo PM" />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueVeloPMs.map(pm => (
                      <SelectItem key={pm} value={pm}>{pm}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="veloPMEmail">Velo PM Email *</Label>
                <Input
                  id="veloPMEmail"
                  type="email"
                  value={newSurvey.veloPMEmail}
                  onChange={(e) => setNewSurvey({...newSurvey, veloPMEmail: e.target.value})}
                  placeholder="pm@velociti.com"
                />
              </div>
            </div>
            <div>
              <Label>Select Technicians to Survey *</Label>
              <div className="mt-2 max-h-60 overflow-y-auto border rounded-lg p-3 space-y-2">
                {contractors.map(contractor => (
                  <label key={contractor.id} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newSurvey.selectedTechIds.includes(contractor.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewSurvey({
                            ...newSurvey,
                            selectedTechIds: [...newSurvey.selectedTechIds, contractor.id]
                          });
                        } else {
                          setNewSurvey({
                            ...newSurvey,
                            selectedTechIds: newSurvey.selectedTechIds.filter(id => id !== contractor.id)
                          });
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm">
                      {contractor.displayName || contractor.full_name} ({contractor.project || 'No Project'})
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSurvey} disabled={isSending}>
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Assign Survey
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Survey Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-7xl">
          <DialogHeader>
            <DialogTitle>Survey Details: {selectedSurvey?.projectName}</DialogTitle>
            <DialogDescription>
              Velo PM: {selectedSurvey?.veloPM} ({selectedSurvey?.veloPMEmail})
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {surveyResponsesForDialog.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Technician</TableHead>
                      <TableHead>Avg. Score</TableHead>
                      <TableHead>Communication</TableHead>
                      <TableHead>Availability</TableHead>
                      <TableHead>Install Quality</TableHead>
                      <TableHead>Reliability</TableHead>
                      <TableHead>Problem Solving</TableHead>
                      <TableHead>Safety</TableHead>
                      <TableHead>Overall</TableHead>
                      <TableHead>Additional Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {surveyResponsesForDialog.map(res => (
                      <TableRow key={res.id}>
                        <TableCell className="font-medium">{res.technicianName}</TableCell>
                        <TableCell>{res.calculatedScore?.toFixed(2) || 'N/A'}</TableCell>
                        <TableCell><StarRatingDisplay rating={res.communicationSkills} /></TableCell>
                        <TableCell><StarRatingDisplay rating={res.availability} /></TableCell>
                        <TableCell><StarRatingDisplay rating={res.installQuality} /></TableCell>
                        <TableCell><StarRatingDisplay rating={res.reliability} /></TableCell>
                        <TableCell><StarRatingDisplay rating={res.problemSolving} /></TableCell>
                        <TableCell><StarRatingDisplay rating={res.safetyCompliance} /></TableCell>
                        <TableCell><StarRatingDisplay rating={res.overallPerformance} /></TableCell>
                        <TableCell className="text-sm text-gray-600 max-w-xs">
                          <div className="break-words whitespace-pre-wrap">
                            {res.additionalNotes || '-'}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No responses have been submitted for this survey yet.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Are you absolutely sure?</DialogTitle>
                <DialogDescription>
                    {selectedSurveys.size > 0 ? (
                      `This action cannot be undone. This will permanently delete ${selectedSurveys.size} survey(s) and all of their associated responses.`
                    ) : (
                      `This action cannot be undone. This will permanently delete the survey for "${selectedSurvey?.projectName}" and all of its associated responses.`
                    )}
                </DialogDescription>
            </DialogHeader>
            <DialogFooter>
                <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
                <Button
                  variant="destructive"
                  onClick={selectedSurveys.size > 0 ? handleBulkDelete : () => handleDeleteSurvey(selectedSurvey.id)}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : `Delete Survey${selectedSurveys.size > 1 ? 's' : ''}`}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
