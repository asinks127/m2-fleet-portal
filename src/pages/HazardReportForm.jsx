import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { ShieldAlert, Upload, Loader2, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function HazardReportForm() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);
  
  const [formData, setFormData] = useState({
    projectName: '',
    siteLocation: '',
    hazardDate: new Date().toISOString().split('T')[0],
    hazardTime: '',
    hazardCategory: '',
    hazardSeverity: '',
    responseNeeded: '',
    description: '',
    activityAtTime: '',
    immediateActionTaken: '',
    workNeedsToStop: false,
    immediateDanger: false,
    workCanContinueSafely: 'Unsure',
    siteLeadershipNotified: false,
    whoWasNotified: '',
    witnesses: '',
    recommendedFix: '',
    contractorAcknowledged: false,
    signatureName: ''
  });

  useEffect(() => {
    const fetchUser = async () => {
      const me = await base44.auth.me();
      setUser(me);
      // Auto-fill assigned PM if available
      const contractorUser = await base44.entities.User.get(me.id);
      setFormData(prev => ({
        ...prev,
        assignedPmName: contractorUser?.m2PM || '',
        assignedPmEmail: contractorUser?.m2PMEmail || ''
      }));
    };
    fetchUser();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.contractorAcknowledged) {
      toast({ title: 'Error', description: 'Please acknowledge the report.', variant: 'destructive' });
      return;
    }
    
    setSubmitting(true);
    try {
      let status = 'Open - Standard';
      if (formData.responseNeeded === 'Serious') status = 'Open - Serious';
      if (formData.responseNeeded === 'Immediate Action Required') status = 'Open - Immediate';

      const reportId = 'HAZ-' + Date.now().toString().slice(-6);

      const report = await base44.entities.SafetyHazardReport.create({
        ...formData,
        reportId,
        submittedByName: user.full_name || user.email,
        submittedByEmail: user.email,
        contractorId: user.id,
        status,
        submittedAt: new Date().toISOString()
      });

      setSubmittedData(report);
      setSubmitted(true);
      
      if (status === 'Open - Immediate') {
        toast({
          title: "URGENT REPORT SUBMITTED",
          description: "This hazard has been marked as Immediate Action Required. Stop work if conditions are unsafe and wait for direction from management.",
          variant: "destructive",
          duration: 10000
        });
      }
      
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to submit report. Please try again.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted && submittedData) {
    return (
      <div className="p-6 max-w-2xl mx-auto mt-10">
        <Card className="border-green-200 bg-green-50 shadow-lg text-center p-8">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Report Submitted Successfully</h2>
          <p className="text-gray-600 mb-6">Your hazard report has been submitted to management.</p>
          
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 text-left space-y-2 mb-6">
            <p><strong>Report ID:</strong> {submittedData.reportId}</p>
            <p><strong>Submitted:</strong> {new Date().toLocaleString()}</p>
            <p><strong>Current Status:</strong> {submittedData.status}</p>
          </div>

          {submittedData.status === 'Open - Immediate' && (
            <div className="p-4 bg-red-100 text-red-800 rounded-lg mb-6 text-left">
              <strong>URGENT:</strong> This hazard has been marked as Immediate Action Required. Stop work if conditions are unsafe and wait for direction from management.
            </div>
          )}

          <Button onClick={() => navigate(createPageUrl('SafetyHome'))} className="bg-green-600 hover:bg-green-700">
            Return to Safety Home
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <Card>
        <CardHeader className="bg-orange-50 border-b">
          <CardTitle className="flex items-center text-orange-800">
            <ShieldAlert className="w-6 h-6 mr-2" />
            Submit Hazard Report
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* General Info */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Project Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Project Name *</Label>
                  <Input required value={formData.projectName} onChange={e => setFormData({...formData, projectName: e.target.value})} />
                </div>
                <div>
                  <Label>Site / Job Location *</Label>
                  <Input required value={formData.siteLocation} onChange={e => setFormData({...formData, siteLocation: e.target.value})} />
                </div>
                <div>
                  <Label>Date of Hazard *</Label>
                  <Input type="date" required value={formData.hazardDate} onChange={e => setFormData({...formData, hazardDate: e.target.value})} />
                </div>
                <div>
                  <Label>Time of Hazard *</Label>
                  <Input type="time" required value={formData.hazardTime} onChange={e => setFormData({...formData, hazardTime: e.target.value})} />
                </div>
              </div>
            </div>

            {/* Hazard Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Hazard Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Hazard Category *</Label>
                  <Select required onValueChange={v => setFormData({...formData, hazardCategory: v})}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Electrical">Electrical</SelectItem>
                      <SelectItem value="Fall Risk">Fall Risk</SelectItem>
                      <SelectItem value="Tool / Equipment">Tool / Equipment</SelectItem>
                      <SelectItem value="Vehicle">Vehicle</SelectItem>
                      <SelectItem value="PPE">PPE</SelectItem>
                      <SelectItem value="Weather">Weather</SelectItem>
                      <SelectItem value="Housekeeping / Site Condition">Housekeeping / Site Condition</SelectItem>
                      <SelectItem value="Lifting / Ergonomics">Lifting / Ergonomics</SelectItem>
                      <SelectItem value="Customer Site Condition">Customer Site Condition</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Hazard Severity *</Label>
                  <Select required onValueChange={v => setFormData({...formData, hazardSeverity: v})}>
                    <SelectTrigger><SelectValue placeholder="Select severity" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Low">Low</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label>Response Needed *</Label>
                  <Select required onValueChange={v => setFormData({...formData, responseNeeded: v})}>
                    <SelectTrigger className="font-semibold text-orange-700 bg-orange-50"><SelectValue placeholder="Select urgency" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Standard">Standard - Normal processing</SelectItem>
                      <SelectItem value="Serious">Serious - Fast response</SelectItem>
                      <SelectItem value="Immediate Action Required" className="text-red-600 font-bold">Immediate Action Required - URGENT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Hazard Description *</Label>
                <Textarea required rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Describe the hazard in detail..." />
              </div>
              
              <div>
                <Label>What was happening when the hazard was noticed? *</Label>
                <Textarea required rows={2} value={formData.activityAtTime} onChange={e => setFormData({...formData, activityAtTime: e.target.value})} />
              </div>

              <div>
                <Label>Immediate action taken</Label>
                <Textarea rows={2} value={formData.immediateActionTaken} onChange={e => setFormData({...formData, immediateActionTaken: e.target.value})} placeholder="e.g., Blocked off area, stopped work..." />
              </div>

              <div>
                <Label>Recommended fix / corrective action</Label>
                <Textarea rows={2} value={formData.recommendedFix} onChange={e => setFormData({...formData, recommendedFix: e.target.value})} />
              </div>
            </div>

            {/* Questions */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Status & Notifications</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
                <div className="flex items-center space-x-2 p-3 border rounded-lg bg-gray-50">
                  <Checkbox id="workNeedsToStop" checked={formData.workNeedsToStop} onCheckedChange={c => setFormData({...formData, workNeedsToStop: c})} />
                  <Label htmlFor="workNeedsToStop">Does work need to stop?</Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border rounded-lg bg-gray-50">
                  <Checkbox id="immediateDanger" checked={formData.immediateDanger} onCheckedChange={c => setFormData({...formData, immediateDanger: c})} />
                  <Label htmlFor="immediateDanger" className="text-red-600 font-medium">Is anyone in immediate danger?</Label>
                </div>
              </div>

              <div>
                <Label>Can work continue safely? *</Label>
                <Select required value={formData.workCanContinueSafely} onValueChange={v => setFormData({...formData, workCanContinueSafely: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                    <SelectItem value="Unsure">Unsure</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2 mt-4">
                <Checkbox id="leadershipNotified" checked={formData.siteLeadershipNotified} onCheckedChange={c => setFormData({...formData, siteLeadershipNotified: c})} />
                <Label htmlFor="leadershipNotified">Has site leadership / customer been notified?</Label>
              </div>

              {formData.siteLeadershipNotified && (
                <div>
                  <Label>Who was notified on site?</Label>
                  <Input value={formData.whoWasNotified} onChange={e => setFormData({...formData, whoWasNotified: e.target.value})} />
                </div>
              )}

              <div>
                <Label>Witnesses</Label>
                <Input value={formData.witnesses} onChange={e => setFormData({...formData, witnesses: e.target.value})} placeholder="Names of any witnesses..." />
              </div>
            </div>

            {/* Acknowledgment */}
            <div className="space-y-4 pt-4 border-t border-gray-200">
              <div className="flex items-start space-x-3 p-4 bg-blue-50 border border-blue-100 rounded-lg">
                <Checkbox 
                  id="ack" 
                  checked={formData.contractorAcknowledged} 
                  onCheckedChange={c => setFormData({...formData, contractorAcknowledged: c})} 
                  className="mt-1"
                />
                <div className="space-y-2 flex-1">
                  <Label htmlFor="ack" className="font-semibold text-blue-900">
                    I confirm this report is accurate to the best of my knowledge.
                  </Label>
                  <div>
                    <Input 
                      placeholder="Type your full name as signature" 
                      required 
                      value={formData.signatureName} 
                      onChange={e => setFormData({...formData, signatureName: e.target.value})} 
                      disabled={!formData.contractorAcknowledged}
                    />
                  </div>
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-lg py-6" disabled={submitting || !formData.contractorAcknowledged || !formData.signatureName}>
              {submitting ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Submitting...</> : 'Submit Hazard Report'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}