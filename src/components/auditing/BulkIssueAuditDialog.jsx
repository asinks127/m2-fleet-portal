import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Search } from 'lucide-react';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';

export default function BulkIssueAuditDialog({ open, onClose, onIssued }) {
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedTechs, setSelectedTechs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [issuing, setIssuing] = useState(false);

  const { data: templates = [] } = useQuery({
    queryKey: ['activeTemplates'],
    queryFn: () => base44.entities.AuditTemplate.filter({ active: true }),
    enabled: open
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ['activeTechnicians'],
    queryFn: () => base44.entities.TechnicianMaster.list({ limit: 1000 }),
    enabled: open
  });

  const { data: users = [] } = useQuery({
    queryKey: ['systemUsers'],
    queryFn: () => base44.entities.User.list(),
    enabled: open
  });

  // Combine technicians and users, prioritizing technicians
  const combinedList = React.useMemo(() => {
    const list = [];
    const emails = new Set();

    // Add Technicians first
    technicians.forEach(t => {
      if (t.active !== false && t.technicianEmail) {
        list.push({
          name: t.technicianName,
          email: t.technicianEmail,
          id: t.technicianId,
          type: 'Technician',
          original: t
        });
        emails.add(t.technicianEmail.toLowerCase());
      }
    });

    // Add Users if not already in list
    users.forEach(u => {
      if (u.email && !emails.has(u.email.toLowerCase())) {
        list.push({
          name: u.full_name || u.email,
          email: u.email,
          id: u.id,
          type: 'User',
          original: null
        });
      }
    });

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [technicians, users]);

  const filteredList = combinedList.filter(item => 
    !searchTerm || 
    item.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isManualEmail = searchTerm && searchTerm.includes('@') && !filteredList.some(i => i.email.toLowerCase() === searchTerm.toLowerCase());

  const handleToggleTech = (email) => {
    setSelectedTechs(prev => 
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    );
  };

  const handleSelectAll = () => {
    if (selectedTechs.length === filteredList.length) {
      setSelectedTechs([]);
    } else {
      setSelectedTechs(filteredList.map(item => item.email).filter(Boolean));
    }
  };

  const handleIssue = async () => {
    if (!selectedTemplateId || selectedTechs.length === 0) return;
    setIssuing(true);
    try {
      const template = templates.find(t => t.id === selectedTemplateId);
      const today = new Date();
      const dueDate = new Date();
      dueDate.setHours(23, 59, 59, 999);

      const promises = selectedTechs.map(async (email) => {
        const assignee = combinedList.find(i => i.email === email) || { name: email, email, id: null };

        const title = `${template.name} - ${assignee.name} - ${format(today, 'yyyy-MM-dd')}`;
        
        // Check for existing audit today to avoid duplicates
        const existing = await base44.entities.AuditRecord.filter({
            templateId: template.id,
            title: title
        });
        
        if (existing.length > 0) return;

        const audit = await base44.entities.AuditRecord.create({
        title,
        templateId: template.id,
        module: template.module,
        frequency: template.frequency,
        status: 'Open',
        responsibleDepartment: template.department,
        defaultOwner: template.defaultOwnerRole,
        assignedAuditor: email,
        relatedContractorId: assignee.id,
        dueDate: dueDate.toISOString(),
        result: 'Pending',
        overallScore: 0,
        compliancePercentage: 0
        });

        // Send email
        const url = `${window.location.origin}/AuditExecution?auditId=${audit.id}`;
        try {
        await base44.integrations.Core.SendEmail({
          to: email,
          subject: `Action Required: New Audit Assigned (${title})`,
          body: `Hello ${assignee.name},\n\nYou have been assigned a new audit: ${title}.\n\nPlease click the link below to complete the audit:\n${url}\n\nThank you.`
        });
        } catch (e) {
          console.error("Failed to send email to " + email, e);
        }
      });

      await Promise.all(promises);
      onIssued(selectedTechs.length);
      handleClose();
    } catch (err) {
      alert('Error issuing audits: ' + err.message);
    } finally {
      setIssuing(false);
    }
  };

  const handleClose = () => {
    setSelectedTemplateId('');
    setSelectedTechs([]);
    setSearchTerm('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Issue Bulk Audits</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4 flex-1 overflow-y-auto">
          <div className="space-y-2">
            <Label>Select Template</Label>
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an audit template..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name} ({t.frequency})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Select Technicians ({selectedTechs.length} selected)</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search technicians..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <div className="border rounded-md max-h-60 overflow-y-auto p-2 space-y-1">
              {filteredList.length > 0 && (
                <div className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer border-b mb-1" onClick={handleSelectAll}>
                  <Checkbox 
                    checked={selectedTechs.length === filteredList.length && filteredList.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                  <span className="font-medium text-sm">Select All Visible</span>
                </div>
              )}
              
              {isManualEmail && (
                <div 
                  className="flex items-center space-x-2 p-2 hover:bg-blue-50 rounded cursor-pointer border border-blue-100 bg-blue-50/30 mb-1"
                  onClick={() => handleToggleTech(searchTerm.toLowerCase())}
                >
                  <Checkbox 
                    checked={selectedTechs.includes(searchTerm.toLowerCase())}
                    onCheckedChange={() => handleToggleTech(searchTerm.toLowerCase())}
                  />
                  <div className="flex-1 text-sm">
                    <p className="font-medium text-blue-800">Add Manual Email</p>
                    <p className="text-blue-600 text-xs">{searchTerm.toLowerCase()}</p>
                  </div>
                </div>
              )}

              {filteredList.map(item => (
                <div 
                  key={item.email} 
                  className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                  onClick={() => handleToggleTech(item.email)}
                >
                  <Checkbox 
                    checked={selectedTechs.includes(item.email)}
                    onCheckedChange={() => handleToggleTech(item.email)}
                  />
                  <div className="flex-1 text-sm flex justify-between items-center">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-gray-500 text-xs">{item.email}</p>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider px-2 py-1 bg-gray-100 text-gray-500 rounded-full">
                      {item.type}
                    </span>
                  </div>
                </div>
              ))}
              
              {filteredList.length === 0 && !isManualEmail && (
                <p className="text-center text-gray-500 py-4 text-sm">No users or technicians found.</p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={issuing}>Cancel</Button>
          <Button onClick={handleIssue} disabled={issuing || !selectedTemplateId || selectedTechs.length === 0}>
            {issuing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Issue {selectedTechs.length} Audits
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}