import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Trash2, Upload, FileText, File } from 'lucide-react';

export default function AdminOnboardingManager() {
  const { toast } = useToast();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [newDoc, setNewDoc] = useState({ title: '', description: '', type: 'contractor_facing', file: null });

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const docs = await base44.entities.OnboardingDocument.filter({}, 'sortOrder');
      setDocuments(docs || []);
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to load documents.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setNewDoc({ ...newDoc, file: e.target.files[0] });
    }
  };

  const handleUpload = async () => {
    if (!newDoc.file || !newDoc.title) {
      toast({ title: 'Error', description: 'Please provide a title and select a file.', variant: 'destructive' });
      return;
    }
    try {
      setUploading(true);
      const me = await base44.auth.me();
      
      const { file_url } = await base44.integrations.Core.UploadFile({ file: newDoc.file });
      
      await base44.entities.OnboardingDocument.create({
        title: newDoc.title,
        description: newDoc.description,
        fileUrl: file_url,
        fileName: newDoc.file.name,
        type: newDoc.type,
        isRequired: true,
        sortOrder: documents.length,
        uploadedBy: me.email,
        uploadDate: new Date().toISOString()
      });

      toast({ title: 'Success', description: 'Document uploaded successfully.' });
      setNewDoc({ title: '', description: '', type: newDoc.type, file: null });
      loadDocuments();
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Upload failed.', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    try {
      await base44.entities.OnboardingDocument.delete(id);
      toast({ title: 'Deleted', description: 'Document removed.' });
      loadDocuments();
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to delete.', variant: 'destructive' });
    }
  };

  const renderDocList = (type) => {
    const filtered = documents.filter(d => d.type === type);
    if (filtered.length === 0) return <p className="text-gray-500 py-4">No documents found.</p>;
    
    return (
      <div className="space-y-3 mt-4">
        {filtered.map(doc => (
          <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg bg-white shadow-sm">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-blue-500" />
              <div>
                <h4 className="font-medium text-gray-900">{doc.title}</h4>
                <p className="text-sm text-gray-500">{doc.fileName} • {doc.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a href={doc.fileUrl} target="_blank" rel="noreferrer">
                <Button variant="outline" size="sm">View</Button>
              </a>
              <Button variant="destructive" size="icon" onClick={() => handleDelete(doc.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Onboarding Documents Manager</h1>
        <p className="text-gray-600 mt-1">Upload and manage requirements for new technicians and internal trainers.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload New Document</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Document Title</Label>
              <Input value={newDoc.title} onChange={e => setNewDoc({...newDoc, title: e.target.value})} placeholder="e.g. Safety Policy 2026" />
            </div>
            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Input value={newDoc.description} onChange={e => setNewDoc({...newDoc, description: e.target.value})} placeholder="Brief instructions..." />
            </div>
            <div className="space-y-2">
              <Label>Document Type</Label>
              <select 
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={newDoc.type} 
                onChange={e => setNewDoc({...newDoc, type: e.target.value})}
              >
                <option value="contractor_facing">Contractor-Facing Onboarding</option>
                <option value="trainer_admin">Trainer/Admin Reference</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>File Upload</Label>
              <Input type="file" onChange={handleFileChange} accept=".pdf,.doc,.docx,.txt" />
            </div>
          </div>
          <Button onClick={handleUpload} disabled={uploading} className="w-full md:w-auto">
            {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Upload Document
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="contractor_facing" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="contractor_facing">Contractor Onboarding</TabsTrigger>
          <TabsTrigger value="trainer_admin">Trainer Documents</TabsTrigger>
        </TabsList>
        <TabsContent value="contractor_facing">
          <Card>
            <CardHeader><CardTitle>Documents Required for New Techs</CardTitle></CardHeader>
            <CardContent>{renderDocList('contractor_facing')}</CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="trainer_admin">
          <Card>
            <CardHeader><CardTitle>Internal Training Resources</CardTitle></CardHeader>
            <CardContent>{renderDocList('trainer_admin')}</CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}