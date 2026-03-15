import React, { useState, useEffect } from 'react';
import { SignableDocument, SignatureRequest } from '@/api/entities.js';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { UploadFile } from '@/api/integrations.js';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.jsx';
import { PlusCircle, Edit, Trash2, Loader2, FileSignature, Upload, FileText, Send, Eye, FileCheck2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import DocumentEditor from '../components/documents/DocumentEditor';
import SendDocumentDialog from '../components/documents/SendDocumentDialog';
import { format } from 'date-fns';

function TemplateDialog({ open, setOpen, template, onSave }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [documentType, setDocumentType] = useState('text');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [originalFileUrl, setOriginalFileUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState(null); // Added error state

  useEffect(() => {
    if (template) {
      setTitle(template.title);
      setContent(template.content || '');
      setDocumentType(template.documentType || 'text');
      setOriginalFileUrl(template.originalFileUrl || '');
    } else {
      setTitle('');
      setContent('');
      setDocumentType('text');
      setOriginalFileUrl('');
    }
    setUploadedFile(null);
    setError(null); // Clear error on dialog open/template change
  }, [template, open]);

  const handleFileSelection = (selectedFiles) => {
    setError(null); // Clear previous errors
    if (!selectedFiles || selectedFiles.length === 0) {
      return;
    }
    
    const validFiles = Array.from(selectedFiles);

    // Take only the first file
    const file = validFiles[0];
    if (!file) {
        return;
    }

    // Type check
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please select a PDF or Word document (.pdf, .doc, .docx).');
      setUploadedFile(null); // Clear any previously selected file
      return;
    }

    // File size limit
    const MAX_FILE_SIZE_MB = 50;
    const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(`File is too large. Maximum file size is ${MAX_FILE_SIZE_MB}MB.`);
      setUploadedFile(null); // Clear any previously selected file
      return;
    }

    setUploadedFile(file);
  };

  const handleFileSelect = (e) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      handleFileSelection(selectedFiles);
    }
  };

  const handleFileUpload = async () => {
    if (!uploadedFile) return;
    
    setIsUploading(true);
    try {
      const { file_url } = await UploadFile({ file: uploadedFile });
      setOriginalFileUrl(file_url);
      setDocumentType('pdf');
      setContent('');
      
      if (!title) {
        setTitle(uploadedFile.name.replace(/\.[^/.]+$/, ""));
      }
      setError(null); // Clear any errors on successful upload
    } catch (uploadError) {
      console.error('Error uploading file:', uploadError);
      setError('Failed to upload file. Please try again.'); // Set error message
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      handleFileSelection(droppedFiles);
    }
  };

  const handleSave = async () => {
    if (!title) {
        setError('Please enter a document title.');
        return;
    }
    
    if (documentType === 'text' && !content) {
      setError('Please add document content.');
      return;
    }
    if (documentType === 'pdf' && !originalFileUrl) {
      setError('Please upload a document file.');
      return;
    }
    
    setError(null); // Clear any previous errors before saving
    setIsSaving(true);
    
    const data = { 
      title, 
      content: documentType === 'text' ? content : '',
      documentType,
      originalFileUrl: documentType === 'pdf' ? originalFileUrl : ''
    };

    try {
        let savedTemplate;
        if (template?.id) {
            savedTemplate = await SignableDocument.update(template.id, data);
        } else {
            savedTemplate = await SignableDocument.create(data);
        }

        if (savedTemplate) {
            onSave();
            setOpen(false);
        }
    } catch (saveError) {
        console.error('Error saving template:', saveError);
        setError('Failed to save template. Please try again.');
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{template?.id ? 'Edit' : 'Create'} Document Template</DialogTitle>
        </DialogHeader>
        <div className="flex-grow flex flex-col gap-4 overflow-hidden py-4">
          <Input 
            placeholder="Document Title (e.g., Independent Contractor Agreement)" 
            value={title} 
            onChange={(e) => { setTitle(e.target.value); setError(null); }} 
          />
          
          <Tabs value={documentType} onValueChange={(value) => { setDocumentType(value); setError(null); }} className="flex-grow flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="text" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Text Document
              </TabsTrigger>
              <TabsTrigger value="pdf" className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Upload File
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="text" className="flex-grow flex flex-col mt-4">
              <div className="flex-grow h-full min-h-0">
                <ReactQuill 
                  theme="snow" 
                  value={content} 
                  onChange={(value) => { setContent(value); setError(null); }} 
                  className="h-full"
                  placeholder="Enter your document content here..."
                />
              </div>
            </TabsContent>
            
            <TabsContent value="pdf" className="flex-grow flex flex-col mt-4">
              <div className="space-y-4">
                <div 
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    dragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <div className="space-y-2">
                    <p className="text-lg font-medium">Upload Document</p>
                    <p className="text-sm text-gray-600">
                      Drag and drop a PDF or Word document here, or click to browse.
                    </p>
                  </div>
                  
                  <div className="mt-4">
                    <input
                      type="file"
                      id="file-upload"
                      accept=".pdf,.doc,.docx"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <Button 
                      variant="outline" 
                      onClick={() => document.getElementById('file-upload').click()}
                      type="button"
                    >
                      Choose File
                    </Button>
                  </div>

                  {error && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                      <p className="text-sm font-medium text-red-700">
                        Error: {error}
                      </p>
                    </div>
                  )}
                  
                  {uploadedFile && (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                      <p className="text-sm font-medium text-blue-900">
                        Selected: {uploadedFile.name}
                      </p>
                      <p className="text-xs text-blue-700">
                        Size: {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <Button 
                        onClick={handleFileUpload} 
                        disabled={isUploading}
                        className="mt-2"
                        size="sm"
                        type="button"
                      >
                        {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Upload File'}
                      </Button>
                    </div>
                  )}
                  
                  {originalFileUrl && !uploadedFile && ( // Only show success if no new file is pending upload
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
                      <p className="text-sm font-medium text-green-900">
                        ✓ Document uploaded successfully
                      </p>
                      <p className="text-xs text-green-700 mt-1">
                        Ready to add signature fields in the editor
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving || isUploading}>
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {template?.id ? 'Update' : 'Create'} Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function DocumentSigningDashboard() {
  const [templates, setTemplates] = useState([]);
  const [signatureRequests, setSignatureRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showDocumentEditor, setShowDocumentEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  const loadData = async () => {
    setIsLoading(true);
    const [templateData, requestData] = await Promise.all([
      SignableDocument.list(),
      SignatureRequest.list('-created_date')
    ]);
    setTemplates(templateData);
    setSignatureRequests(requestData);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleEdit = (template) => {
    setSelectedTemplate(template);
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setSelectedTemplate(null);
    setIsDialogOpen(true);
  };
  
  const handleSend = (template) => {
    setSelectedTemplate(template);
    setIsSendDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this template? This cannot be undone.')) {
        await SignableDocument.delete(id);
        loadData();
    }
  };

  const handleOpenEditor = (template) => {
    setEditingTemplate(template);
    setShowDocumentEditor(true);
  };

  const handleSaveFromEditor = async (updatedTemplate) => {
    try {
      if (updatedTemplate.id) {
        await SignableDocument.update(updatedTemplate.id, updatedTemplate);
      } else {
        await SignableDocument.create(updatedTemplate);
      }
      setShowDocumentEditor(false);
      setEditingTemplate(null);
      loadData();
    } catch (error) {
      console.error('Error saving template:', error);
    }
  };
  
  const statusColors = {
    Sent: 'bg-gray-100 text-gray-800',
    Viewed: 'bg-blue-100 text-blue-800',
    Signed: 'bg-green-100 text-green-800',
    Declined: 'bg-red-100 text-red-800',
  };

  if (showDocumentEditor) {
    return (
      <div className="h-screen flex flex-col">
        <div className="bg-white border-b p-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">Document Editor</h1>
            <p className="text-sm text-gray-600">
              {editingTemplate?.title || 'New Document'} - Add signature fields by clicking on the document
            </p>
          </div>
          <Button variant="outline" onClick={() => setShowDocumentEditor(false)}>
            ← Back to Dashboard
          </Button>
        </div>
        <div className="flex-1 overflow-hidden">
          <DocumentEditor 
            document={editingTemplate} 
            onSave={handleSaveFromEditor}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <FileSignature className="w-8 h-8" />
            <span>Document Signing Center</span>
          </h1>
          <p className="text-gray-600 mt-1">Create, manage, and send documents for e-signature.</p>
        </div>
      </div>
      
      <Card>
          <CardHeader>
              <div className="flex justify-between items-center">
                  <CardTitle>Document Templates</CardTitle>
                  <Button onClick={handleCreate}>
                      <PlusCircle className="w-4 h-4 mr-2" />
                      Create Template
                  </Button>
              </div>
              <CardDescription>Create and manage reusable documents that can be sent for signature.</CardDescription>
          </CardHeader>
          <CardContent>
              {isLoading ? <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin"/></div> : (
                  <div className="space-y-2">
                      {templates.map(template => (
                          <div key={template.id} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
                              <div>
                                  <div className="flex items-center gap-2 mb-1">
                                      <span className="font-medium">{template.title}</span>
                                      <Badge variant="outline" className="text-xs">
                                          {template.documentType === 'pdf' ? 'PDF' : 'Text'}
                                      </Badge>
                                      {template.signatureFields && template.signatureFields.length > 0 && (
                                        <Badge variant="secondary" className="text-xs">
                                            {template.signatureFields.length} fields
                                        </Badge>
                                      )}
                                  </div>
                              </div>
                              <div className="flex items-center gap-2">
                                  <Button variant="default" size="sm" onClick={() => handleSend(template)}>
                                      <Send className="w-4 h-4 mr-1" /> Send
                                  </Button>
                                  <Button variant="outline" size="sm" onClick={() => handleEdit(template)}>
                                      <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button variant="outline" size="sm" onClick={() => handleOpenEditor(template)}>
                                      <FileSignature className="w-4 h-4" />
                                  </Button>
                                  <Button variant="destructive" size="sm" onClick={() => handleDelete(template.id)}>
                                      <Trash2 className="w-4 h-4" />
                                  </Button>
                              </div>
                          </div>
                      ))}
                      {templates.length === 0 && <p className="text-center text-gray-500 py-4">No templates created yet.</p>}
                  </div>
              )}
          </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle>Signature Status Tracker</CardTitle>
            <CardDescription>Monitor the status of all sent documents.</CardDescription>
        </CardHeader>
        <CardContent>
            {isLoading ? <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin"/></div> : (
              <div className="space-y-2">
                {signatureRequests.map(req => (
                  <div key={req.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-grow">
                      <p className="font-medium">{req.documentTitle}</p>
                      <div className="text-sm text-gray-600">
                        Sent to: <span className="font-medium">{req.technicianName}</span>
                        <span className="text-gray-400 mx-1">•</span>
                        <span>{req.technicianEmail}</span>
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                        <span>Sent on: {format(new Date(req.created_date), 'MMM d, yyyy, p')}</span>
                        {req.technicianId ? (
                            <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-green-200 text-green-700 bg-green-50 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                Linked to Profile
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-orange-200 text-orange-700 bg-orange-50 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                                Email Only
                            </Badge>
                        )}
                        {req.technicianId && <span className="text-[10px] text-gray-300">ID: {req.technicianId.slice(-4)}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge className={statusColors[req.status] || statusColors.Sent}>
                        {req.status}
                      </Badge>
                      {req.status === 'Signed' && req.signedPdfUrl && (
                        <a href={req.signedPdfUrl} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm">
                            <FileCheck2 className="w-4 h-4 mr-2" />
                            View Signed PDF
                          </Button>
                        </a>
                      )}
                      {req.status === 'Viewed' && (
                        <div className="flex items-center text-sm text-blue-600">
                          <Eye className="w-4 h-4 mr-1" />
                          Viewed
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {signatureRequests.length === 0 && <p className="text-center text-gray-500 py-4">No documents have been sent yet.</p>}
              </div>
            )}
        </CardContent>
      </Card>

      <TemplateDialog 
        open={isDialogOpen}
        setOpen={setIsDialogOpen}
        template={selectedTemplate}
        onSave={loadData}
      />
      
      {selectedTemplate && (
        <SendDocumentDialog
          template={selectedTemplate}
          open={isSendDialogOpen}
          onOpenChange={setIsSendDialogOpen}
          onSent={loadData}
        />
      )}
    </div>
  );
}