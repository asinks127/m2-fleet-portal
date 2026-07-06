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
import { Stethoscope, Loader2, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function InjuryReportForm() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);
  
  const [formData, setFormData] = useState({
    projectName: '',
    siteLocation: '',
    incidentDate: new Date().toISOString().split('T')[0],
    incidentTime: '',
    incidentType: '',
    injured: false,
    injuryType: 'N/A',
    bodyPartAffected: '',
    medicalTreatmentNeeded: false,
    emergencyCareNeeded: false,
    workStopped: false,
    incidentDescription: '',
    taskBeingPerformed: '',
    equipmentInvolved: '',
    ppeUsed: false,
    ppeDetails: '',
    witnesses: '',
    supervisorNotified: false,
    timeReported: '',
    immediateCorrectiveAction: '',
    anyoneElseInvolved: false,
    propertyDamageInvolved: false,
    lostTimeExpected: 'Unknown',
    followUpNeeded: '',
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
      const reportId = 'INJ-' + Date.now().toString().slice(-6);

      const report = await base44.entities.SafetyInjuryReport.create({
        ...formData,
        reportId,
        submittedByName: user.full_name || user.email,
        submittedByEmail: user.email,
        contractorId: user.id,
        status: 'Submitted - Needs Review',
        submittedAt: new Date().toISOString()
      });

      setSubmittedData(report);
      setSubmitted(true);
      
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
          <p className="text-gray-600 mb-6">Your injury / accident report has been submitted successfully. Management has been notified.</p>
          
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 text-left space-y-2 mb-6">
            <p><strong>Report ID:</strong> {submittedData.reportId}</p>
            <p><strong>Submitted:</strong> {new Date().toLocaleString()}</p>
            <p><strong>Current Status:</strong> {submittedData.status}</p>
          </div>

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
        <CardHeader className="bg-red-50 border-b">
          <CardTitle className="flex items-center text-red-800">
            <Stethoscope className="w-6 h-6 mr-2" />
            Submit Injury / Accident Report
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
                  <Label>Incident Date *</Label>
                  <Input type="date" required value={formData.incidentDate} onChange={e => setFormData({...formData, incidentDate: e.target.value})} />
                </div>
                <div>
                  <Label>Incident Time *</Label>
                  <Input type="time" required value={formData.incidentTime} onChange={e => setFormData({...formData, incidentTime: e.target.value})} />
                </div>
              </div>
            </div>

            {/* Incident Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Incident Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Incident Type *</Label>
                  <Select required onValueChange={v => setFormData({...formData, incidentType: v})}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Injury">Injury</SelectItem>
                      <SelectItem value="Near Miss">Near Miss</SelectItem>
                      <SelectItem value="Vehicle Accident">Vehicle Accident</SelectItem>
                      <SelectItem value="Equipment Accident">Equipment Accident</SelectItem>
                      <SelectItem value="Property Damage">Property Damage</SelectItem>
                      <SelectItem value="Customer Site Incident">Customer Site Incident</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2 pt-8">
                  <Checkbox id="injured" checked={formData.injured} onCheckedChange={c => setFormData({...formData, injured: c})} />
                  <Label htmlFor="injured" className="font-semibold text-red-600">Was someone injured?</Label>
                </div>
              </div>

              {formData.injured && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-lg space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Type of Injury</Label>
                      <Select value={formData.injuryType} onValueChange={v => setFormData({...formData, injuryType: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Cut / Laceration">Cut / Laceration</SelectItem>
                          <SelectItem value="Burn">Burn</SelectItem>
                          <SelectItem value="Sprain / Strain">Sprain / Strain</SelectItem>
                          <SelectItem value="Fall">Fall</SelectItem>
                          <SelectItem value="Eye Injury">Eye Injury</SelectItem>
                          <SelectItem value="Electrical Contact">Electrical Contact</SelectItem>
                          <SelectItem value="Heat Related">Heat Related</SelectItem>
                          <SelectItem value="Vehicle Related">Vehicle Related</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                          <SelectItem value="N/A">N/A</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Body part affected</Label>
                      <Input value={formData.bodyPartAffected} onChange={e => setFormData({...formData, bodyPartAffected: e.target.value})} placeholder="e.g. Left hand, Right knee..." />
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-6 pt-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="medicalTreatmentNeeded" checked={formData.medicalTreatmentNeeded} onCheckedChange={c => setFormData({...formData, medicalTreatmentNeeded: c})} />
                      <Label htmlFor="medicalTreatmentNeeded">Medical treatment needed?</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="emergencyCareNeeded" checked={formData.emergencyCareNeeded} onCheckedChange={c => setFormData({...formData, emergencyCareNeeded: c})} />
                      <Label htmlFor="emergencyCareNeeded" className="text-red-700">Emergency care needed?</Label>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <Label>Description of incident *</Label>
                <Textarea required rows={4} value={formData.incidentDescription} onChange={e => setFormData({...formData, incidentDescription: e.target.value})} placeholder="What exactly happened? Who was involved? What were the sequence of events?" />
              </div>
              
              <div>
                <Label>What task was being performed? *</Label>
                <Textarea required rows={2} value={formData.taskBeingPerformed} onChange={e => setFormData({...formData, taskBeingPerformed: e.target.value})} />
              </div>

              <div>
                <Label>Equipment / tools involved</Label>
                <Input value={formData.equipmentInvolved} onChange={e => setFormData({...formData, equipmentInvolved: e.target.value})} />
              </div>

              <div className="flex items-center space-x-2 p-3 border rounded-lg bg-gray-50">
                <Checkbox id="ppeUsed" checked={formData.ppeUsed} onCheckedChange={c => setFormData({...formData, ppeUsed: c})} />
                <Label htmlFor="ppeUsed">Was PPE being used?</Label>
              </div>

              {formData.ppeUsed && (
                <div>
                  <Label>What PPE was used?</Label>
                  <Input value={formData.ppeDetails} onChange={e => setFormData({...formData, ppeDetails: e.target.value})} placeholder="e.g. Hard hat, safety glasses, gloves..." />
                </div>
              )}
            </div>

            {/* Additional Info */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Response & Follow-up</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox id="workStopped" checked={formData.workStopped} onCheckedChange={c => setFormData({...formData, workStopped: c})} />
                  <Label htmlFor="workStopped">Did work stop due to incident?</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="anyoneElseInvolved" checked={formData.anyoneElseInvolved} onCheckedChange={c => setFormData({...formData, anyoneElseInvolved: c})} />
                  <Label htmlFor="anyoneElseInvolved">Was anyone else involved?</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="propertyDamageInvolved" checked={formData.propertyDamageInvolved} onCheckedChange={c => setFormData({...formData, propertyDamageInvolved: c})} />
                  <Label htmlFor="propertyDamageInvolved">Was there property damage?</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="supervisorNotified" checked={formData.supervisorNotified} onCheckedChange={c => setFormData({...formData, supervisorNotified: c})} />
                  <Label htmlFor="supervisorNotified">Was supervisor/PM notified?</Label>
                </div>
              </div>

              {formData.supervisorNotified && (
                <div>
                  <Label>Time reported</Label>
                  <Input type="time" value={formData.timeReported} onChange={e => setFormData({...formData, timeReported: e.target.value})} />
                </div>
              )}

              <div>
                <Label>Immediate corrective action taken</Label>
                <Textarea rows={2} value={formData.immediateCorrectiveAction} onChange={e => setFormData({...formData, immediateCorrectiveAction: e.target.value})} placeholder="What was done immediately following the incident?" />
              </div>

              <div>
                <Label>Witnesses</Label>
                <Input value={formData.witnesses} onChange={e => setFormData({...formData, witnesses: e.target.value})} placeholder="Names and contact info of any witnesses..." />
              </div>

              <div>
                <Label>Lost time from work expected?</Label>
                <Select value={formData.lostTimeExpected} onValueChange={v => setFormData({...formData, lostTimeExpected: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                    <SelectItem value="Unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Follow-up needed / Additional Notes</Label>
                <Textarea rows={2} value={formData.followUpNeeded} onChange={e => setFormData({...formData, followUpNeeded: e.target.value})} />
              </div>
            </div>

            {/* Acknowledgment */}
            <div className="space-y-4 pt-4 border-t border-gray-200">
              <div className="flex items-start space-x-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <Checkbox 
                  id="ack" 
                  checked={formData.contractorAcknowledged} 
                  onCheckedChange={c => setFormData({...formData, contractorAcknowledged: c})} 
                  className="mt-1"
                />
                <div className="space-y-2 flex-1">
                  <Label htmlFor="ack" className="font-semibold text-red-900">
                    I confirm this report is accurate to the best of my knowledge. I understand that submitting a false report may lead to disciplinary action.
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

            <Button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-lg py-6" disabled={submitting || !formData.contractorAcknowledged || !formData.signatureName}>
              {submitting ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Submitting...</> : 'Submit Injury / Accident Report'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}