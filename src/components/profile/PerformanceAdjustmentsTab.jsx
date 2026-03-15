import React, { useState, useEffect } from 'react';
import { PerformanceAdjustment, User } from '@/api/entities.js';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Card, CardContent, CardHeader } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog.jsx';
import { Plus, Edit3, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { format } from 'date-fns';

export default function PerformanceAdjustmentsTab({ contractor, onUpdate }) {
  const [adjustments, setAdjustments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [formData, setFormData] = useState({
    adjustmentType: '',
    originalIssue: '',
    correctionTaken: '',
    scoreImpact: 0,
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, [contractor.id]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [adjustmentData, userData] = await Promise.all([
        PerformanceAdjustment.filter({ technicianId: contractor.id }, '-adjustmentDate'),
        User.me()
      ]);
      setAdjustments(adjustmentData);
      setCurrentUser(userData);
    } catch (error) {
      console.error('Error loading performance adjustments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.adjustmentType || !formData.originalIssue) {
      return;
    }

    setIsSubmitting(true);
    try {
      await PerformanceAdjustment.create({
        technicianId: contractor.id,
        technicianName: contractor.displayName || contractor.full_name,
        adjustmentType: formData.adjustmentType,
        originalIssue: formData.originalIssue,
        correctionTaken: formData.correctionTaken,
        scoreImpact: parseFloat(formData.scoreImpact) || 0,
        adjustedBy: currentUser.email,
        adjustmentDate: new Date().toISOString(),
        notes: formData.notes
      });

      // Update the contractor's score if there's an impact
      if (formData.scoreImpact && formData.scoreImpact !== 0) {
        const newScore = Math.min(100, Math.max(0, (contractor.velocitiScore || 100) + parseFloat(formData.scoreImpact)));
        await User.update(contractor.id, { velocitiScore: newScore });
        onUpdate(); // Refresh parent component
      }

      setShowAddDialog(false);
      setFormData({
        adjustmentType: '',
        originalIssue: '',
        correctionTaken: '',
        scoreImpact: 0,
        notes: ''
      });
      loadData();
    } catch (error) {
      console.error('Error saving adjustment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleAdjustment = async (adjustmentId, currentActive) => {
    try {
      await PerformanceAdjustment.update(adjustmentId, { isActive: !currentActive });
      loadData();
    } catch (error) {
      console.error('Error toggling adjustment:', error);
    }
  };

  const getAdjustmentIcon = (type) => {
    switch (type) {
      case 'score_correction': return Edit3;
      case 'context_note': return Info;
      case 'remediation_complete': return CheckCircle;
      case 'dispute_resolution': return AlertTriangle;
      default: return Info;
    }
  };

  const getAdjustmentColor = (type) => {
    switch (type) {
      case 'score_correction': return 'bg-blue-100 text-blue-800';
      case 'context_note': return 'bg-gray-100 text-gray-800';
      case 'remediation_complete': return 'bg-green-100 text-green-800';
      case 'dispute_resolution': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Performance Adjustments</h3>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Adjustment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Performance Adjustment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="adjustmentType">Adjustment Type</Label>
                <Select value={formData.adjustmentType} onValueChange={(value) => setFormData({...formData, adjustmentType: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select adjustment type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="score_correction">Score Correction</SelectItem>
                    <SelectItem value="context_note">Context Note</SelectItem>
                    <SelectItem value="remediation_complete">Remediation Complete</SelectItem>
                    <SelectItem value="dispute_resolution">Dispute Resolution</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="originalIssue">Original Issue/Problem</Label>
                <Textarea
                  id="originalIssue"
                  value={formData.originalIssue}
                  onChange={(e) => setFormData({...formData, originalIssue: e.target.value})}
                  placeholder="Describe the original issue that led to the low score or concern..."
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="correctionTaken">Steps Taken to Address</Label>
                <Textarea
                  id="correctionTaken"
                  value={formData.correctionTaken}
                  onChange={(e) => setFormData({...formData, correctionTaken: e.target.value})}
                  placeholder="Describe what was done to fix the issue, training provided, etc..."
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="scoreImpact">Score Impact (+/-)</Label>
                <Input
                  id="scoreImpact"
                  type="number"
                  step="0.1"
                  value={formData.scoreImpact}
                  onChange={(e) => setFormData({...formData, scoreImpact: e.target.value})}
                  placeholder="0"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Positive number to increase score, negative to decrease. Leave 0 for documentation only.
                </p>
              </div>

              <div>
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Any additional context or notes..."
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Adjustment'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : adjustments.length === 0 ? (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            No performance adjustments have been recorded for this technician.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-4">
          {adjustments.map((adjustment) => {
            const IconComponent = getAdjustmentIcon(adjustment.adjustmentType);
            return (
              <Card key={adjustment.id} className={adjustment.isActive ? '' : 'opacity-60'}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-2">
                      <IconComponent className="w-5 h-5 text-gray-600" />
                      <Badge className={getAdjustmentColor(adjustment.adjustmentType)}>
                        {adjustment.adjustmentType.replace('_', ' ').toUpperCase()}
                      </Badge>
                      {adjustment.scoreImpact !== 0 && (
                        <Badge variant={adjustment.scoreImpact > 0 ? 'default' : 'destructive'}>
                          {adjustment.scoreImpact > 0 ? '+' : ''}{adjustment.scoreImpact} pts
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleAdjustment(adjustment.id, adjustment.isActive)}
                      >
                        {adjustment.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-1">Original Issue:</h4>
                    <p className="text-gray-700">{adjustment.originalIssue}</p>
                  </div>
                  
                  {adjustment.correctionTaken && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">Correction Taken:</h4>
                      <p className="text-gray-700">{adjustment.correctionTaken}</p>
                    </div>
                  )}
                  
                  {adjustment.notes && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">Additional Notes:</h4>
                      <p className="text-gray-700">{adjustment.notes}</p>
                    </div>
                  )}
                  
                  <div className="pt-2 border-t border-gray-200 text-sm text-gray-500">
                    Adjusted by {adjustment.adjustedBy} on {format(new Date(adjustment.adjustmentDate), 'MMM d, yyyy h:mm a')}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}