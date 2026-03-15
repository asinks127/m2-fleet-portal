import React, { useState, useEffect } from 'react';
import { sendPerformanceAlert } from '@/functions.js';
import { QCInspection, User } from '@/api/entities.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import { format } from 'date-fns';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';


export default function QCInspectionDialog({ 
    technician, 
    isOpen, 
    onClose, 
    onSuccess, 
    inspectionToEdit = null,
    entityType = 'QCInspection',
    idField = 'technicianId'
}) {
  const [currentUser, setCurrentUser] = useState(null);
  const [pastInspections, setPastInspections] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [score, setScore] = useState(100);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen && inspectionToEdit) {
      setScore(inspectionToEdit.score);
      setNotes(inspectionToEdit.notes);
    } else if (isOpen) {
      setScore(100);
      setNotes('');
    }
  }, [isOpen, inspectionToEdit]);

  useEffect(() => {
    async function loadData() {
      if (!isOpen) return;

      setIsLoadingHistory(true);
      try {
        const user = await User.me();
        setCurrentUser(user);
        
        // Dynamically fetch inspections based on entity type
        const InspectionEntity = /* FIXME: Unconverted base44 call */ supabase.entities[entityType];
        if (InspectionEntity) {
            const filter = {};
            filter[idField] = technician.id;
            const inspections = await InspectionEntity.filter(filter, '-inspectionDate', 5);
            setPastInspections(inspections);
        }
      } catch (err) {
        console.error("Error loading inspection data:", err);
      } finally {
        setIsLoadingHistory(false);
      }
    }
    loadData();
  }, [isOpen, technician, entityType, idField]);

  const handleSubmit = async () => {
    if (!score || notes.trim() === '') {
      setError('Please provide a score and notes for the inspection.');
      return;
    }
    
    setIsSaving(true);
    setError(null);
    
    try {
      const inspectionData = {
        qcUserId: currentUser.id,
        qcUserName: currentUser.displayName || currentUser.full_name || currentUser.email,
        inspectionDate: inspectionToEdit ? inspectionToEdit.inspectionDate : new Date().toISOString(),
        score: Number(score),
        notes: notes,
      };
      
      // Set ID field dynamically
      inspectionData[idField] = technician.id;

      const InspectionEntity = /* FIXME: Unconverted base44 call */ supabase.entities[entityType];
      if (!InspectionEntity) throw new Error(`Entity ${entityType} not found`);

      if (inspectionToEdit) {
        await InspectionEntity.update(inspectionToEdit.id, inspectionData);
      } else {
        await InspectionEntity.create(inspectionData);
      }

      // Update average score (User entity update)
      // For Technicians: User.avgQcScore
      // For Managers: User.managerAvgQcScore ?? Actually we decided to calculate it on the fly in getQcBoardData
      // So we might skip updating User entity for managers if we don't store it there.
      
      if (entityType === 'QCInspection') {
          const allInspections = await InspectionEntity.filter({ technicianId: technician.id });
          const avgScore = allInspections.reduce((sum, insp) => sum + insp.score, 0) / allInspections.length;
          await User.update(technician.id, { avgQcScore: Math.round(avgScore) });
      }

      // Trigger alert logic (Only for Technicians for now)
      if (entityType === 'QCInspection' && Number(score) < 75 && (!inspectionToEdit || inspectionToEdit.score >= 75)) {
        const alertSubject = `Low QC Score: ${score}/100`;
        const alertBody = `
          <h3>Low QC Score Recorded</h3>
          <p>A Quality Control inspection resulted in a low score.</p>
          <ul>
            <li><strong>Score Given:</strong> ${score}/100</li>
            <li><strong>QC Inspector:</strong> ${inspectionData.qcUserName}</li>
            <li><strong>Date:</strong> ${format(new Date(), 'MMMM d, yyyy')}</li>
          </ul>
          <h4>Notes from Inspector:</h4>
          <p style="white-space: pre-wrap; background: #f0f0f0; padding: 10px; border-radius: 5px;">${notes}</p>
        `;
        // Fire and forget, don't block UI
        sendPerformanceAlert({
            technicianId: technician.id,
            subject: alertSubject,
            body: alertBody
        });
      }

      onSuccess(); // Refresh the board
      onClose(); // Close the dialog
    } catch (err) {
      console.error("Error saving inspection:", err);
      setError('Failed to save the inspection. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{inspectionToEdit ? 'Edit' : 'Log'} QC Inspection for {technician.displayName || technician.full_name}</DialogTitle>
          <DialogDescription>{inspectionToEdit ? 'Update' : 'Record'} the score and any notes, complaints, or required returns.</DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          {/* New Inspection Form */}
          <div className="space-y-4">
            <h4 className="font-semibold text-lg border-b pb-2">{inspectionToEdit ? 'Edit Entry' : 'New Entry'}</h4>
            <div>
              <Label htmlFor="score">Inspection Score (0-100)</Label>
              <Input
                id="score"
                type="number"
                min="0"
                max="100"
                value={score}
                onChange={(e) => setScore(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes & Complaints</Label>
              <Textarea
                id="notes"
                placeholder="Detail any issues, returns, or feedback..."
                rows={8}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
          
          {/* Past Inspections History */}
          <div className="space-y-3">
            <h4 className="font-semibold text-lg border-b pb-2">Recent History</h4>
            {isLoadingHistory ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : pastInspections.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {pastInspections.map(insp => (
                  <div key={insp.id} className="p-3 bg-gray-50 rounded-lg border">
                    <div className="flex justify-between items-center mb-1">
                      <p className="font-semibold text-gray-800">Score: {insp.score}</p>
                      <p className="text-xs text-gray-500">{format(new Date(insp.inspectionDate), 'MM/dd/yy')}</p>
                    </div>
                    <p className="text-sm text-gray-600">{insp.notes}</p>
                    <p className="text-xs text-gray-400 mt-2">Logged by: {insp.qcUserName}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 pt-4 text-center">No recent inspections found.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Inspection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}