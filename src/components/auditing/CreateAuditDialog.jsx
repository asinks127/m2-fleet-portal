import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const MODULES = ['Recruiting', 'Project Management', 'Quality Control', 'Contractor Offboarding'];
const FREQUENCIES = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Annual', 'Event-Triggered'];
const MANUAL_ASSIGN_FREQS = ['Monthly', 'Quarterly', 'Annual', 'Daily', 'Event-Triggered'];

export default function CreateAuditDialog({ open, onClose, onCreated }) {
  const [form, setForm] = useState({
    templateId: 'none', title: '', module: '', frequency: '', responsibleDepartment: '',
    defaultOwner: '', assignedAuditor: '', dueDate: '', notes: '',
    siteLatitude: '', siteLongitude: ''
  });
  const [saving, setSaving] = useState(false);

  const { data: templates = [] } = useQuery({
    queryKey: ['activeTemplates'],
    queryFn: () => base44.entities.AuditTemplate.filter({ active: true }),
    enabled: open
  });

  const { data: users = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
    enabled: open
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ['allTechnicians'],
    queryFn: () => base44.entities.TechnicianMaster.filter({ active: true }),
    enabled: open
  });

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));
  const needsManualAssign = MANUAL_ASSIGN_FREQS.includes(form.frequency);

  useEffect(() => {
    if (form.templateId && form.templateId !== 'none') {
      const t = templates.find(x => x.id === form.templateId);
      if (t) {
        setForm(prev => ({
          ...prev,
          title: `${t.name} - ${format(new Date(), 'yyyy-MM-dd')}`,
          module: t.module || '',
          frequency: t.frequency || '',
          responsibleDepartment: t.department || '',
          defaultOwner: t.defaultOwnerRole || ''
        }));
      }
    }
  }, [form.templateId, templates]);

  const handleCreate = async () => {
    if (!form.title || !form.module || !form.frequency) {
      alert('Title, Module, and Frequency are required.');
      return;
    }
    setSaving(true);
    try {
      const status = needsManualAssign && !form.assignedAuditor
        ? 'Awaiting Auditor Assignment'
        : 'Open';

      let relatedContractorId = null;
      if (form.assignedAuditor) {
          const tech = technicians.find(t => t.technicianEmail === form.assignedAuditor);
          if (tech) {
              relatedContractorId = tech.technicianId;
          }
      }

      const audit = await base44.entities.AuditRecord.create({
        title: form.title,
        templateId: form.templateId === 'none' ? null : form.templateId,
        module: form.module,
        frequency: form.frequency,
        responsibleDepartment: form.responsibleDepartment,
        defaultOwner: form.defaultOwner,
        assignedAuditor: needsManualAssign ? form.assignedAuditor : form.defaultOwner,
        relatedContractorId: relatedContractorId,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
        siteLatitude: form.siteLatitude ? parseFloat(form.siteLatitude) : null,
        siteLongitude: form.siteLongitude ? parseFloat(form.siteLongitude) : null,
        status,
        result: 'Pending'
      });

      if (audit.assignedAuditor) {
        const url = `${window.location.origin}/AuditExecution?auditId=${audit.id}`;
        try {
          await base44.integrations.Core.SendEmail({
            to: audit.assignedAuditor,
            subject: `Action Required: New Audit Assigned (${audit.title})`,
            body: `Hello,\n\nYou have been assigned a new audit: ${audit.title}.\n\nPlease click the link below to complete the audit:\n${url}\n\nThank you.`
          });
        } catch (e) {
          console.error("Failed to send assignment email", e);
        }
      }

      setForm({ templateId: 'none', title: '', module: '', frequency: '', responsibleDepartment: '', defaultOwner: '', assignedAuditor: '', dueDate: '', notes: '', siteLatitude: '', siteLongitude: '' });
      onCreated(audit);
    } catch (err) {
      alert('Error creating audit: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const combinedAssignees = [
    ...users.map(u => ({ email: u.email, name: u.full_name || u.email, group: 'Admins/Staff' })),
    ...technicians.map(t => ({ email: t.technicianEmail, name: t.technicianName, group: 'Technicians' }))
  ].filter(x => x.email);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Audit</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          
          <div className="space-y-1.5">
            <Label>From Template</Label>
            <Select value={form.templateId} onValueChange={v => set('templateId', v)}>
              <SelectTrigger><SelectValue placeholder="Select template..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- No Template (Ad-hoc) --</SelectItem>
                {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Audit Title *</Label>
            <Input placeholder="e.g. Weekly PM Audit – Project X" value={form.title} onChange={e => set('title', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Module *</Label>
              <Select value={form.module} onValueChange={v => set('module', v)}>
                <SelectTrigger><SelectValue placeholder="Select module..." /></SelectTrigger>
                <SelectContent>{MODULES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Frequency *</Label>
              <Select value={form.frequency} onValueChange={v => set('frequency', v)}>
                <SelectTrigger><SelectValue placeholder="Select frequency..." /></SelectTrigger>
                <SelectContent>{FREQUENCIES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Input placeholder="e.g. Project Management" value={form.responsibleDepartment} onChange={e => set('responsibleDepartment', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Target Latitude (Optional)</Label>
              <Input type="number" step="any" placeholder="e.g. 40.7128" value={form.siteLatitude} onChange={e => set('siteLatitude', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Target Longitude (Optional)</Label>
              <Input type="number" step="any" placeholder="e.g. -74.0060" value={form.siteLongitude} onChange={e => set('siteLongitude', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Operational Owner</Label>
              <Input placeholder="e.g. PM Role" value={form.defaultOwner} onChange={e => set('defaultOwner', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>
                Assign To
                {needsManualAssign && <span className="text-yellow-600 text-xs ml-1">(required)</span>}
              </Label>
              <Select value={form.assignedAuditor} onValueChange={v => set('assignedAuditor', v)}>
                <SelectTrigger><SelectValue placeholder="Select person to assign..." /></SelectTrigger>
                <SelectContent>
                  {combinedAssignees.map((u, i) => (
                      <SelectItem key={i} value={u.email}>{u.name} ({u.group})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {needsManualAssign && !form.assignedAuditor && (
            <p className="text-xs text-yellow-700 bg-yellow-50 p-2 rounded border border-yellow-200">
              No auditor selected — status will be set to "Awaiting Auditor Assignment".
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Create & Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}