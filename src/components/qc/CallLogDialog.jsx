import React, { useState, useEffect } from 'react';
import { CallLog, ManagerCallLog, User } from '@/api/entities.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Loader2, Phone, Sparkles } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';

export default function CallLogDialog({ technician, isOpen, onClose, onSuccess, entityType = 'CallLog', idField = 'technicianId' }) {
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const isManagerCall = entityType === 'ManagerCallLog';
  const [linkedTechnicianId, setLinkedTechnicianId] = useState('');
  const [technicianOptions, setTechnicianOptions] = useState([]);

  useEffect(() => {
    if (!isOpen || !isManagerCall) return;
    (async () => {
      try {
        const users = await User.list();
        setTechnicianOptions((users || []).filter(u => u.email && (
          u.email.toLowerCase().includes('.contractor@m2fleetcom.com') ||
          u.email.toLowerCase().includes('.contractor@smcinstallations.com')
        ) && u.active !== false));
      } catch (e) {
        console.error('Failed to load technician roster:', e);
      }
    })();
  }, [isOpen, isManagerCall]);

  const handleSubmit = async () => {
    if (notes.trim() === '') {
      setError('Please add some notes about the call.');
      return;
    }
    
    setIsSaving(true);
    setError(null);
    
    try {
      const currentUser = await User.me();
      if (!currentUser) throw new Error('Not signed in');

      // Construct payload dynamically based on entity type. Column names match
      // the actual Supabase tables (camelCase).
      const payload = {
        note: notes.trim(),
        callDate: new Date().toISOString(),
        loggedBy: currentUser.email
      };

      payload[idField] = technician.id;
      if (isManagerCall) {
          payload.managerEmail = technician.email;
          // Optional link back to the M2 technician the call was about
          const linked = technicianOptions.find(t => String(t.id) === String(linkedTechnicianId));
          if (linked) {
            payload.technicianId = linked.id;
            payload.technicianName = linked.displayName || linked.full_name || linked.email;
          }
      } else {
          payload.technicianEmail = technician.email;
      }

      // Step 1: Save the call log
      const logEntity = isManagerCall ? ManagerCallLog : CallLog;
      const callLog = await logEntity.create(payload);

      console.log('Call log saved successfully');

      // Step 2: AI analysis (only for technicians for now, or adapt for managers if needed)
      if (entityType === 'CallLog') {
          analyzeCallLogInBackground(callLog.id, notes.trim(), technician, currentUser.email);
      }

      // Step 3: Immediately close dialog and refresh board
      onSuccess();
      setNotes('');
      onClose();
      
    } catch (err) {
      console.error("Error saving call log:", err);
      setError('Failed to save call log. Please try again.');
      setIsSaving(false);
    }
  };

  // Background async function - doesn't block the UI
  const analyzeCallLogInBackground = async (callLogId, notes, tech, loggedByEmail) => {
    try {
      console.log('Starting background AI analysis for call log:', callLogId);
      
      // Call the backend function to handle AI analysis and alerts
      await (await fetch('/api/analyzeCallLog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        callLogId,
        notes,
        technicianId: tech.id,
        technicianEmail: tech.email,
        technicianName: tech.displayName || tech.full_name,
        loggedBy: loggedByEmail
      }) })).json();
      
      console.log('Background AI analysis completed');
    } catch (error) {
      console.error('Background AI analysis failed (non-blocking):', error);
      // Don't show error to user since this is background processing
    }
  };

  const handleClose = () => {
    setNotes('');
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-blue-600" />
            Log Call - {technician?.displayName || technician?.full_name || 'Technician'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="notes">Call Notes *</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What was discussed? Any issues, complaints, or follow-ups needed..."
              rows={6}
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              AI will automatically analyze for urgent issues in the background
            </p>
          </div>
          
          {isManagerCall && (
            <div>
              <Label>Related M2 Technician (optional)</Label>
              <Select value={linkedTechnicianId} onValueChange={setLinkedTechnicianId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Not tied to a technician" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not tied to a technician</SelectItem>
                  {technicianOptions.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.displayName || t.full_name || t.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">Link this call to the technician it concerned, if any.</p>
            </div>
          )}
          
          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isSaving ? 'Saving...' : 'Save Call Log'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}