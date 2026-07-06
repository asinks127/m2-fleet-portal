import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { base44 } from '@/api/base44Client';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const RESOURCE_TYPES = [
  "Article", "Install Guide", "Training Video", "Troubleshooting Guide", 
  "Safety Document", "Contact", "PDF Document", "Project Documentation"
];

export default function CreateResourceDialog({ open, onClose, onSuccess, initialData = null }) {
  const [formData, setFormData] = useState(initialData || {
    title: '', resourceType: 'Article', category: '', subcategory: '', tags: '',
    content: '', videoLink: '', visibility: 'Both', featured: false, searchKeywords: '',
    contactName: '', contactPhone: '', contactEmail: '', device: '', customer: '',
    project: '', vehicleType: '', attachments: []
  });
  
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (open) {
      if (initialData) {
        setFormData({
          ...initialData,
          tags: Array.isArray(initialData.tags) ? initialData.tags.join(', ') : '',
        });
      } else {
        setFormData({
          title: '', resourceType: 'Article', category: '', subcategory: '', tags: '',
          content: '', videoLink: '', visibility: 'Both', featured: false, searchKeywords: '',
          contactName: '', contactPhone: '', contactEmail: '', device: '', customer: '',
          project: '', vehicleType: '', attachments: []
        });
      }
    }
  }, [open, initialData]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const newUrls = await Promise.all(
        files.map(file => base44.integrations.Core.UploadFile({ file }).then(res => res.file_url))
      );
      handleChange('attachments', [...formData.attachments, ...newUrls]);
    } catch (err) {
      console.error(err);
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...formData };
      payload.tags = payload.tags.split(',').map(t => t.trim()).filter(Boolean);
      
      if (initialData?.id) {
        await base44.entities.ResourceLibrary.update(initialData.id, payload);
      } else {
        await base44.entities.ResourceLibrary.create(payload);
      }
      onSuccess();
    } catch (err) {
      console.error(err);
      alert('Failed to save resource');
    } finally {
      setSaving(false);
    }
  };

  const isContact = formData.resourceType === 'Contact';
  const isVideo = formData.resourceType === 'Training Video';
  const isInstall = formData.resourceType === 'Install Guide';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Edit Resource' : 'Create New Resource'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input required value={formData.title} onChange={e => handleChange('title', e.target.value)} />
            </div>
            
            <div className="space-y-2">
              <Label>Resource Type *</Label>
              <Select value={formData.resourceType} onValueChange={v => handleChange('resourceType', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RESOURCE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Input placeholder="e.g. Safety, Troubleshooting" value={formData.category} onChange={e => handleChange('category', e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Visibility *</Label>
              <Select value={formData.visibility} onValueChange={v => handleChange('visibility', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Both">Both (Admins & Contractors)</SelectItem>
                  <SelectItem value="Contractor">Contractors Only</SelectItem>
                  <SelectItem value="Admin">Admins Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isContact && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg border">
              <div className="space-y-2">
                <Label>Contact Name</Label>
                <Input value={formData.contactName} onChange={e => handleChange('contactName', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={formData.contactEmail} onChange={e => handleChange('contactEmail', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={formData.contactPhone} onChange={e => handleChange('contactPhone', e.target.value)} />
              </div>
            </div>
          )}

          {isInstall && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
              <div className="space-y-2"><Label>Device</Label><Input value={formData.device} onChange={e => handleChange('device', e.target.value)} /></div>
              <div className="space-y-2"><Label>Customer</Label><Input value={formData.customer} onChange={e => handleChange('customer', e.target.value)} /></div>
              <div className="space-y-2"><Label>Project</Label><Input value={formData.project} onChange={e => handleChange('project', e.target.value)} /></div>
              <div className="space-y-2"><Label>Vehicle Type</Label><Input value={formData.vehicleType} onChange={e => handleChange('vehicleType', e.target.value)} /></div>
            </div>
          )}

          {isVideo && (
            <div className="space-y-2">
              <Label>Video URL (YouTube/Vimeo)</Label>
              <Input placeholder="https://youtube.com/watch?v=..." value={formData.videoLink} onChange={e => handleChange('videoLink', e.target.value)} />
            </div>
          )}

          <div className="space-y-2">
            <Label>Content / Article Body</Label>
            <div className="bg-white rounded-md overflow-hidden border">
              <ReactQuill theme="snow" value={formData.content} onChange={v => handleChange('content', v)} className="h-48 mb-10" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tags (comma separated)</Label>
              <Input placeholder="onboarding, basics, install" value={formData.tags} onChange={e => handleChange('tags', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Search Keywords (hidden metadata)</Label>
              <Input placeholder="synonyms, common misspellings" value={formData.searchKeywords} onChange={e => handleChange('searchKeywords', e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Attachments</Label>
            <div className="flex items-center gap-4">
              <Input type="file" multiple onChange={handleFileUpload} disabled={uploading} className="w-auto" />
              {uploading && <span className="text-sm text-gray-500 animate-pulse">Uploading files...</span>}
            </div>
            {formData.attachments.length > 0 && (
              <ul className="text-sm mt-2 space-y-1">
                {formData.attachments.map((url, i) => (
                  <li key={i} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                    <span className="truncate max-w-[80%]">{url.split('/').pop()}</span>
                    <Button type="button" variant="ghost" size="sm" className="text-red-500 h-6 px-2" onClick={() => {
                      const updated = [...formData.attachments];
                      updated.splice(i, 1);
                      handleChange('attachments', updated);
                    }}>Remove</Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
            <div>
               <Label htmlFor="featured" className="text-base">Featured Resource</Label>
               <p className="text-sm text-gray-500">Show this resource at the top of search results</p>
            </div>
            <Switch id="featured" checked={formData.featured} onCheckedChange={v => handleChange('featured', v)} />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving || uploading} className="bg-blue-600 hover:bg-blue-700 text-white">
              {saving ? 'Saving...' : 'Save Resource'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}