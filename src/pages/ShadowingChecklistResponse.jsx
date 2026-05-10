import React, { useState, useEffect } from 'react';
import { getShadowingChecklistData, submitShadowingChecklist } from '@/functions.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Loader2, CheckCircle, AlertTriangle, ClipboardCheck } from 'lucide-react';

export default function ShadowingChecklistResponse() {
  const [checklist, setChecklist] = useState(null);
  const [formData, setFormData] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    const loadChecklist = async () => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      
      if (!token) {
        setError('Invalid or missing checklist token.');
        setIsLoading(false);
        return;
      }

      try {
        const { data } = await getShadowingChecklistData({ checklistToken: token });
        
        if (data.success) {
          setChecklist(data.checklist);
          
          // Initialize form data with existing values or defaults
          setFormData({
            safetyOrientationComplete: data.checklist.safetyOrientationComplete || false,
            safetyOrientationDate: data.checklist.safetyOrientationDate || '',
            toolsAndEquipmentReview: data.checklist.toolsAndEquipmentReview || false,
            toolsReviewDate: data.checklist.toolsReviewDate || '',
            hasTools: data.checklist.hasTools || false,
            hasToolsDate: data.checklist.hasToolsDate || '',
            firstInstallShadowed: data.checklist.firstInstallShadowed || false,
            firstInstallDate: data.checklist.firstInstallDate || '',
            qualityStandardsReview: data.checklist.qualityStandardsReview || false,
            qualityReviewDate: data.checklist.qualityReviewDate || '',
            isPunctualAndReliable: data.checklist.isPunctualAndReliable || false,
            punctualAndReliableDate: data.checklist.punctualAndReliableDate || '',
            independentInstallObserved: data.checklist.independentInstallObserved || false,
            independentInstallDate: data.checklist.independentInstallDate || '',
            trainerNotes: data.checklist.trainerNotes || ''
          });
        } else {
          setError(data.error || 'Failed to load checklist.');
        }
      } catch (err) {
        console.error('Error loading checklist:', err);
        setError('Failed to load checklist. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadChecklist();
  }, []);

  const handleCheckboxChange = (key, checked) => {
    const dateKey = key.replace('Complete', 'Date').replace('Review', 'Date').replace('Shadowed', 'Date').replace('Observed', 'Date');
    
    setFormData(prev => ({
      ...prev,
      [key]: checked,
      [dateKey]: checked ? new Date().toISOString().split('T')[0] : prev[dateKey]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');

      const { data } = await submitShadowingChecklist({
        checklistToken: token,
        checklistData: formData
      });

      if (data.success) {
        setIsSubmitted(true);
      } else {
        setError(data.error || 'Failed to submit checklist.');
      }
    } catch (err) {
      console.error('Error submitting checklist:', err);
      setError('Failed to submit checklist. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading shadowing checklist...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Error</h2>
            <p className="text-red-600 mb-4">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Checklist Submitted</h2>
            <p className="text-gray-600 mb-4">
              Thank you! The shadowing checklist has been submitted successfully and sent to the QC team for final approval.
            </p>
            <Badge className="bg-green-100 text-green-800">
              Awaiting QC Approval
            </Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  const checklistItems = [
    { key: 'safetyOrientationComplete', label: 'Safety Orientation Complete', dateKey: 'safetyOrientationDate' },
    { key: 'toolsAndEquipmentReview', label: 'Tools and Equipment Review', dateKey: 'toolsReviewDate' },
    { key: 'hasTools', label: 'Has All Required Tools', dateKey: 'hasToolsDate' },
    { key: 'firstInstallShadowed', label: 'First Installation Shadowed', dateKey: 'firstInstallDate' },
    { key: 'qualityStandardsReview', label: 'Quality Standards Review', dateKey: 'qualityReviewDate' },
    { key: 'isPunctualAndReliable', label: 'Is Punctual and Reliable', dateKey: 'punctualAndReliableDate' },
    { key: 'independentInstallObserved', label: 'Independent Install Observed', dateKey: 'independentInstallDate' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <ClipboardCheck className="w-8 h-8 text-blue-600" />
              Shadowing Checklist
            </CardTitle>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p><strong>Contractor:</strong> {checklist?.contractorName}</p>
                  <p><strong>Email:</strong> {checklist?.contractorEmail}</p>
                </div>
                <div>
                  <p><strong>Assigned Trainer:</strong> {checklist?.trainerName}</p>
                  <p><strong>QC Manager:</strong> {checklist?.qcManagerEmail}</p>
                </div>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Shadowing Requirements</h3>
                <p className="text-gray-600 mb-6">
                  Please check off each item as it is completed and add the date when it was finished.
                  The final QC approval will be handled by the QC team after you submit this checklist.
                </p>
                
                <div className="space-y-4">
                  {checklistItems.map((item, index) => (
                    <div key={item.key} className="flex items-center justify-between p-4 border rounded-lg bg-white">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={formData[item.key] || false}
                          onCheckedChange={(checked) => handleCheckboxChange(item.key, checked)}
                        />
                        <Label className="font-medium">{item.label}</Label>
                      </div>
                      {formData[item.key] && (
                        <Input
                          type="date"
                          value={formData[item.dateKey] || ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            [item.dateKey]: e.target.value
                          }))}
                          className="w-40"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <Label htmlFor="trainerNotes">Training Notes & Comments</Label>
                <Textarea
                  id="trainerNotes"
                  value={formData.trainerNotes || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    trainerNotes: e.target.value
                  }))}
                  placeholder="Add any notes about the contractor's progress, areas of strength, or items that need attention..."
                  rows={4}
                  className="mt-1"
                />
              </div>
              
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="flex justify-end">
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Submit Checklist
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}