import React, { useState, useEffect } from 'react';
import { Announcement, AnnouncementAcknowledgment, User } from '@/api/entities.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx';
import { Loader2, Plus, Edit, Trash2, Eye, Megaphone } from 'lucide-react';
import { format } from 'date-fns';

export default function AnnouncementManager() {
  const [announcements, setAnnouncements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [viewingAcknowledgments, setViewingAcknowledgments] = useState(null);
  const [acknowledgments, setAcknowledgments] = useState([]);

  const [formData, setFormData] = useState({
    title: '',
    message: '',
    priority: 'normal',
    targetAudience: 'contractors',
    requiresAcknowledgment: false,
    expiryDate: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [announcementData, userData] = await Promise.all([
        Announcement.list('-publishDate'),
        User.me()
      ]);
      setAnnouncements(announcementData);
      setCurrentUser(userData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title || !formData.message) {
      alert('Please fill in title and message');
      return;
    }

    try {
      const announcementData = {
        ...formData,
        publishDate: new Date().toISOString(),
        createdBy: currentUser.email,
        isActive: true
      };

      if (editingAnnouncement) {
        await Announcement.update(editingAnnouncement.id, announcementData);
      } else {
        await Announcement.create(announcementData);
      }

      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving announcement:', error);
      alert('Error saving announcement. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      message: '',
      priority: 'normal',
      targetAudience: 'contractors',
      requiresAcknowledgment: false,
      expiryDate: ''
    });
    setShowCreateForm(false);
    setEditingAnnouncement(null);
  };

  const handleEdit = (announcement) => {
    setFormData({
      title: announcement.title,
      message: announcement.message,
      priority: announcement.priority,
      targetAudience: announcement.targetAudience,
      requiresAcknowledgment: announcement.requiresAcknowledgment,
      expiryDate: announcement.expiryDate ? announcement.expiryDate.split('T')[0] : ''
    });
    setEditingAnnouncement(announcement);
    setShowCreateForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    
    try {
      await Announcement.delete(id);
      loadData();
    } catch (error) {
      console.error('Error deleting announcement:', error);
    }
  };

  const toggleActive = async (announcement) => {
    try {
      await Announcement.update(announcement.id, { isActive: !announcement.isActive });
      loadData();
    } catch (error) {
      console.error('Error updating announcement status:', error);
    }
  };

  const viewAcknowledgments = async (announcement) => {
    try {
      const acks = await AnnouncementAcknowledgment.filter({ 
        announcementId: announcement.id 
      }, '-acknowledgedAt');
      setAcknowledgments(acks);
      setViewingAcknowledgments(announcement);
    } catch (error) {
      console.error('Error loading acknowledgments:', error);
    }
  };

  const getPriorityBadge = (priority) => {
    const colors = {
      low: 'bg-gray-100 text-gray-800',
      normal: 'bg-blue-100 text-blue-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800'
    };
    return <Badge className={colors[priority]}>{priority.toUpperCase()}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Megaphone className="w-8 h-8 text-blue-600" />
            Announcement Manager
          </h1>
          <p className="text-gray-600 mt-1">Create and manage system-wide announcements for contractors.</p>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Announcement
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Announcements</CardTitle>
        </CardHeader>
        <CardContent>
          {announcements.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Megaphone className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No announcements yet. Create your first announcement to communicate with contractors.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {announcements.map((announcement) => (
                  <TableRow key={announcement.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{announcement.title}</p>
                        <p className="text-sm text-gray-500 truncate max-w-xs">
                          {announcement.message}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{announcement.targetAudience}</Badge>
                    </TableCell>
                    <TableCell>{getPriorityBadge(announcement.priority)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActive(announcement)}
                        className={announcement.isActive ? 'text-green-600' : 'text-gray-400'}
                      >
                        {announcement.isActive ? 'Active' : 'Inactive'}
                      </Button>
                    </TableCell>
                    <TableCell>
                      {format(new Date(announcement.publishDate), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(announcement)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        {announcement.requiresAcknowledgment && (
                          <Button variant="ghost" size="sm" onClick={() => viewAcknowledgments(announcement)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(announcement.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Form Dialog */}
      <Dialog open={showCreateForm} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingAnnouncement ? 'Edit Announcement' : 'Create New Announcement'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="e.g., Holiday Pay Delay Notice"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="message">Message *</Label>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData({...formData, message: e.target.value})}
                placeholder="e.g., Due to the upcoming holiday, payments will be processed one day later than usual. Please plan accordingly."
                rows={4}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Priority</Label>
                <Select value={formData.priority} onValueChange={(value) => setFormData({...formData, priority: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Target Audience</Label>
                <Select value={formData.targetAudience} onValueChange={(value) => setFormData({...formData, targetAudience: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contractors">Contractors</SelectItem>
                    <SelectItem value="admins">Admins</SelectItem>
                    <SelectItem value="qc">QC Managers</SelectItem>
                    <SelectItem value="all">Everyone</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Expiry Date (Optional)</Label>
              <Input
                type="date"
                value={formData.expiryDate}
                onChange={(e) => setFormData({...formData, expiryDate: e.target.value})}
                className="mt-1"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="requiresAcknowledgment"
                checked={formData.requiresAcknowledgment}
                onCheckedChange={(checked) => setFormData({...formData, requiresAcknowledgment: checked})}
              />
              <Label htmlFor="requiresAcknowledgment">
                Require acknowledgment (users must confirm they've read this)
              </Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button type="submit">
                {editingAnnouncement ? 'Update' : 'Create'} Announcement
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Acknowledgments Dialog */}
      <Dialog open={!!viewingAcknowledgments} onOpenChange={() => setViewingAcknowledgments(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Acknowledgments: {viewingAcknowledgments?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {acknowledgments.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No acknowledgments yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Acknowledged At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {acknowledgments.map((ack) => (
                    <TableRow key={ack.id}>
                      <TableCell>{ack.userName}</TableCell>
                      <TableCell>{ack.userEmail}</TableCell>
                      <TableCell>{format(new Date(ack.acknowledgedAt), 'MMM d, yyyy h:mm a')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}