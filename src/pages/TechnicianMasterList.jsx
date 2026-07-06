import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';

export default function TechnicianMasterList() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({});

  const { data: technicians = [], refetch } = useQuery({
    queryKey: ['TechnicianMaster'],
    queryFn: () => base44.entities.TechnicianMaster.list('-created_date', 1000),
  });

  const handleOpenModal = (tech = null) => {
    if (tech) {
      setFormData(tech);
      setEditingId(tech.id);
    } else {
      setFormData({ active: true });
      setEditingId(null);
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await base44.entities.TechnicianMaster.update(editingId, formData);
        toast.success("Technician updated");
      } else {
        await base44.entities.TechnicianMaster.create(formData);
        toast.success("Technician added");
      }
      setIsModalOpen(false);
      refetch();
    } catch (err) {
      toast.error("Failed to save technician");
    }
  };

  const handleDelete = async (id) => {
    if (confirm("Delete this technician?")) {
      await base44.entities.TechnicianMaster.delete(id);
      refetch();
      toast.success("Deleted");
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Technician Master List</h1>
          <p className="text-gray-500">Source of truth for technician assignments and teams.</p>
        </div>
        <Button onClick={() => handleOpenModal()}><Plus className="w-4 h-4 mr-2" /> Add Technician</Button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tech ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>PM</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {technicians.map(t => (
              <TableRow key={t.id}>
                <TableCell className="text-gray-500">{t.technicianId || '-'}</TableCell>
                <TableCell className="font-medium">{t.technicianName}</TableCell>
                <TableCell>{t.projectTeam || '-'}</TableCell>
                <TableCell>{t.projectManagerName || '-'}</TableCell>
                <TableCell>
                  {t.active ? <Badge className="bg-green-100 text-green-800">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => handleOpenModal(t)}><Edit className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete(t.id)}><Trash2 className="w-4 h-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editingId ? 'Edit Technician' : 'Add Technician'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Technician Name *</Label>
                <Input required value={formData.technicianName || ''} onChange={e => setFormData({...formData, technicianName: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Technician ID (optional)</Label>
                <Input value={formData.technicianId || ''} onChange={e => setFormData({...formData, technicianId: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={formData.technicianEmail || ''} onChange={e => setFormData({...formData, technicianEmail: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Project Team</Label>
                <Input value={formData.projectTeam || ''} onChange={e => setFormData({...formData, projectTeam: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Project Manager Name</Label>
                <Input value={formData.projectManagerName || ''} onChange={e => setFormData({...formData, projectManagerName: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Project Manager Email</Label>
                <Input type="email" value={formData.projectManagerEmail || ''} onChange={e => setFormData({...formData, projectManagerEmail: e.target.value})} />
              </div>
            </div>
            <div className="flex items-center justify-between p-4 border rounded bg-gray-50 mt-4">
              <Label>Active Technician</Label>
              <Switch checked={formData.active !== false} onCheckedChange={c => setFormData({...formData, active: c})} />
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}