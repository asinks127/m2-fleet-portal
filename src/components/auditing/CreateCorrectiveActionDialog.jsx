import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Loader2 } from 'lucide-react';

export default function CreateCorrectiveActionDialog({ open, auditId, users, onClose, onCreated }) {
  const [form, setForm] = useState({ title: '', description: '', ownerEmail: '', dueDate: '' });
  const [saving, setSaving] = useState(false);

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    if (!form.title || !form.ownerEmail) {
      alert('Title and Owner are required.');
      return;
    }
    setSaving(true);
    try {
      const created = await base44.entities.CorrectiveAction.create({
        auditId,
        title: form.title,
        description: form.description,
        ownerEmail: form.ownerEmail,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
        status: 'Open'
      });
      setForm({ title: '', description: '', ownerEmail: '', dueDate: '' });
      onCreated(created);
    } catch (err) {
      alert('Failed to create corrective action: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-5 h-5" />
            Create Corrective Action
          </DialogTitle>
          <DialogDescription>
            Document an issue and assign it to someone for resolution.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Action Title *</Label>
            <Input placeholder="e.g. Missing W-9 documentation" value={form.title} onChange={e => set('title', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              placeholder="Describe the issue and what needs to be corrected..."
              value={form.description}
              onChange={e => set('description', e.target.value)}
              className="min-h-[90px]"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Assign To *</Label>
              <Select value={form.ownerEmail} onValueChange={v => set('ownerEmail', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select owner..." />
                </SelectTrigger>
                <SelectContent>
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.email}>{u.full_name || u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !form.title || !form.ownerEmail} className="bg-red-600 hover:bg-red-700">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Create Action
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}