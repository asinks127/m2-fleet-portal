import React, { useEffect, useMemo, useRef, useState } from 'react';
import { QCInspection } from '@/api/entities.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Loader2, AlertCircle, Camera, X, CheckCircle2, Clock, FileWarning } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import { format } from 'date-fns';

const getTechnicianName = (tech) =>
  tech?.displayName || tech?.full_name || tech?.fullName || tech?.name || tech?.email || 'Unknown Technician';

// Upload one photo through the authenticated API endpoint (service role writes to storage).
async function uploadPhoto(file, inspectionId) {
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
  const res = await fetch('/api/qcInspectionPhotos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inspectionId,
      fileName: file.name,
      mimeType: file.type || 'image/jpeg',
      fileBase64: base64,
    }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload.success) {
    throw new Error(payload.error || 'Photo upload failed');
  }
  return payload.photo; // { path, name }
}

export default function QcInspectionFormDialog({
  isOpen,
  onClose,
  technicians = [],
  currentUser = null,
  preselectedTechnician = null,
  onSuccess,
}) {
  const fileInputRef = useRef(null);
  const [form, setForm] = useState({
    technicianId: '',
    assetNumber: '',
    customer: '',
    location: '',
    notes: '',
    availability: null, // 'yes' | 'no'
  });
  const [photos, setPhotos] = useState([]); // [{ file, previewUrl, name, status }]
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setForm({
      technicianId: preselectedTechnician ? preselectedTechnician.id : '',
      assetNumber: '',
      customer: '',
      location: '',
      notes: '',
      availability: null,
    });
    setPhotos([]);
    setError(null);
  }, [isOpen, preselectedTechnician]);

  const sortedTechnicians = useMemo(
    () => [...technicians].sort((a, b) => getTechnicianName(a).localeCompare(getTechnicianName(b))),
    [technicians]
  );

  const selectedTechnician = useMemo(
    () => technicians.find((t) => String(t.id) === String(form.technicianId)) || null,
    [technicians, form.technicianId]
  );

  const canSubmit = form.technicianId && form.assetNumber.trim() && form.customer.trim() &&
    form.location.trim() && form.notes.trim() && form.availability &&
    (form.availability === 'no' || photos.length > 0);

  const handleAddPhotos = (fileList) => {
    const incoming = Array.from(fileList || []).filter((f) => f.type.startsWith('image/'));
    if (!incoming.length) return;
    setPhotos((prev) => [
      ...prev,
      ...incoming.map((file) => ({
        file,
        id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
        previewUrl: URL.createObjectURL(file),
        name: file.name,
        status: 'ready',
      })),
    ]);
  };

  const removePhoto = (id) => {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      setError('Please complete every required field before saving.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const inspectionRecord = {
        technicianId: form.technicianId,
        assetNumber: form.assetNumber.trim(),
        customer: form.customer.trim(),
        location: form.location.trim(),
        notes: form.notes.trim(),
        availability: form.availability,
        photos: [],
        inspectionDate: new Date().toISOString(),
        qcUserId: currentUser?.id || null,
        qcUserName: currentUser?.displayName || currentUser?.full_name || currentUser?.email || 'Unknown QC',
        driveStatus: 'pending',
        editHistory: [],
      };

      const created = await QCInspection.create(inspectionRecord);
      if (!created?.id) throw new Error('Inspection record could not be created');

      // Upload photos (required when the technician was available).
      const savedPhotos = [];
      if (photos.length > 0) {
        for (const photo of photos) {
          const uploaded = await uploadPhoto(photo.file, created.id);
          savedPhotos.push({ ...uploaded, status: 'uploaded' });
        }
        await QCInspection.update(created.id, { photos: savedPhotos });
      }

      // File to Google Drive in the background — failures are tracked on the
      // record and can be retried from the QC Inspections Report.
      fetch('/api/qcInspectionDrive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inspectionId: created.id }),
      }).catch(() => {});

      onSuccess?.(created);
      onClose();
    } catch (err) {
      console.error('Error saving inspection:', err);
      setError(err?.message || 'Failed to save the inspection. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New QC Inspection</DialogTitle>
          <DialogDescription>
            Record the inspection details. Date, time, and the QC completing this inspection are captured automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Technician Name *</Label>
              <Select value={form.technicianId} onValueChange={(v) => setForm((p) => ({ ...p, technicianId: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select technician..." /></SelectTrigger>
                <SelectContent>
                  {sortedTechnicians.map((tech) => (
                    <SelectItem key={tech.id} value={tech.id}>{getTechnicianName(tech)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="asset-number">Asset Number *</Label>
              <Input
                id="asset-number"
                value={form.assetNumber}
                onChange={(e) => setForm((p) => ({ ...p, assetNumber: e.target.value }))}
                placeholder="e.g. AST-10234"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="customer">Customer *</Label>
              <Input
                id="customer"
                value={form.customer}
                onChange={(e) => setForm((p) => ({ ...p, customer: e.target.value }))}
                placeholder="Customer name"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="location">Location *</Label>
              <Input
                id="location"
                value={form.location}
                onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                placeholder="Inspection location"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes *</Label>
            <Textarea
              id="notes"
              rows={4}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Inspection findings and comments..."
              className="mt-1"
            />
          </div>

          <div>
            <Label>Availability *</Label>
            <p className="text-xs text-gray-500 mb-2">
              Was the technician available for the inspection? Photos are required only when they were available.
            </p>
            <div className="flex gap-2">
              {['yes', 'no'].map((value) => (
                <Button
                  key={value}
                  type="button"
                  variant={form.availability === value ? 'default' : 'outline'}
                  onClick={() => setForm((p) => ({ ...p, availability: value }))}
                  className="capitalize"
                >
                  {value === 'yes' ? 'Yes' : 'No'}
                </Button>
              ))}
            </div>
          </div>

          {form.availability === 'yes' && (
            <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-blue-600" />
                <Label>Inspection Photos (required)</Label>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => { handleAddPhotos(e.target.files); e.target.value = ''; }}
              />
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Camera className="w-4 h-4 mr-2" /> Add Photos
              </Button>
              {photos.length === 0 && (
                <p className="text-xs text-red-600">At least one photo is required when the technician is available.</p>
              )}
              {photos.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {photos.map((photo) => (
                    <div key={photo.id} className="relative group border rounded bg-white overflow-hidden">
                      <img src={photo.previewUrl} alt={photo.name} className="h-20 w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(photo.id)}
                        className="absolute top-1 right-1 bg-white/90 rounded-full p-0.5 shadow"
                        aria-label="Remove photo"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {form.availability === 'no' && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Technician not available — photos are not required. The inspection can be completed without uploads.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 bg-blue-50 border border-blue-100 rounded-lg p-3">
            <Clock className="w-4 h-4 text-blue-600" />
            <span>Recorded: {format(new Date(), 'MMM d, yyyy HH:mm')}</span>
            <span>•</span>
            <span>QC: {currentUser?.displayName || currentUser?.full_name || currentUser?.email || '—'}</span>
          </div>

          {selectedTechnician && (
            <p className="text-xs text-gray-500">
              On completion this inspection is filed automatically to{' '}
              <span className="font-medium">{getTechnicianName(selectedTechnician)} → QC → Inspection Reports</span> in
              Google Drive.
            </p>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSaving || !canSubmit}>
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isSaving ? 'Saving...' : 'Complete Inspection'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
