import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { processInsuranceDocument } from '@/functions.js';
import { supabase } from '@/lib/supabaseClient.js';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog.jsx';
import { Loader2, UploadCloud, Folder, File, Trash2, Download, FilePlus, Upload, FolderPlus, FileSignature, CheckCircle, Clock, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { groupBy } from 'lodash';

const getCurrentTimeInCT = () => {
  const now = new Date();
  const options = {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  };
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(now);
  const p = parts.reduce((acc, part) => ({ ...acc, [part.type]: part.value }), {});
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}.000Z`;
};

function CreateFolderDialog({ isOpen, onClose, onCreateFolder, existingFolders }) {
  const [folderName, setFolderName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    const trimmedName = folderName.trim();
    
    if (!trimmedName) {
      setError('Please enter a folder name.');
      return;
    }
    
    if (existingFolders.includes(trimmedName)) {
      setError('A folder with this name already exists.');
      return;
    }
    
    onCreateFolder(trimmedName);
    setFolderName('');
    setError('');
    onClose();
  };

  const handleClose = () => {
    setFolderName('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="w-5 h-5" />
            Create New Folder
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="folderName">Folder Name</Label>
            <Input
              id="folderName"
              placeholder="e.g., W-9 Forms, Contracts, Insurance"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
              className="mt-1"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            Create Folder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UploadDocumentDialog({ contractor, currentUser, onUploadSuccess, initialFolderName, onClose, existingFolders }) {
  const [files, setFiles] = useState([]);
  const [folder, setFolder] = useState(initialFolderName || '');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    setFolder(initialFolderName || '');
  }, [initialFolderName]);

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
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles(prev => [...prev, ...droppedFiles]);
  };

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(prev => [...prev, ...selectedFiles]);
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Map folder names to Google Drive document types
  const getDocumentType = (folderName) => {
    const folderLower = folderName.toLowerCase();
    
    if (folderLower.includes('workers comp') || folderLower.includes('workers compensation')) {
      return 'workers_comp';
    }
    if (folderLower.includes('safety') || folderLower.includes('osha') || folderLower.includes('certification')) {
      return 'safety';
    }
    if (folderLower.includes('w-9') || folderLower.includes('w9') || folderLower.includes('initial') || folderLower.includes('onboarding')) {
      return 'initial_paperwork';
    }
    if (folderLower.includes('invoice')) {
      return 'invoice';
    }
    // Default to initial paperwork for other document types
    return 'initial_paperwork';
  };

  const handleSubmit = async () => {
    if (files.length === 0 || !folder.trim()) {
      setError('Please select files and provide a folder name.');
      return;
    }
    
    setIsUploading(true);
    setError(null);

    try {
      const contractorName = contractor.displayName || contractor.business || contractor.full_name || contractor.email;
      const documentType = getDocumentType(folder);

      // "Concerned Family Member" Duplicate Check
      // 1. Check for duplicates within the batch itself
      const fileNamesInBatch = files.map(f => f.name.toLowerCase());
      const uniqueNamesInBatch = new Set(fileNamesInBatch);
      if (fileNamesInBatch.length !== uniqueNamesInBatch.size) {
        setError('It looks like you have selected the same file multiple times. Please remove duplicates.');
        setIsUploading(false);
        return;
      }

      // 2. Check against existing documents in this folder
        const { data: existingDocsData } = await supabase.from('ContractorDocument').select('*').match({
            contractorId: contractor.id,
            folder: folder.trim()
        });
        const existingDocs = existingDocsData;

      for (const file of files) {
          const duplicate = existingDocs.find(doc => doc.fileName.toLowerCase() === file.name.toLowerCase());
          if (duplicate) {
               setError(`Double Check: The file "${file.name}" already exists in the "${folder}" folder. To prevent confusion, we cannot accept duplicates unless the previous one is deleted.`);
               setIsUploading(false);
               return;
          }
      }

      for (const file of files) {
        const { file_url } = await supabase.storage.from('documents').upload( file .file.name,  file .file);

        const { data: documentData } = await supabase.from('ContractorDocument').insert({
          contractorId: contractor.id,
          fileName: file.name,
          fileUrl: file_url,
          mimeType: file.type,
          folder: folder.trim(),
          uploadedBy: currentUser.email,
          uploadDate: getCurrentTimeInCT(),
        }).select().single();
        const document = documentData;

        // Upload to Google Drive in the background
        fetch('/api/uploadToDrive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          fileUrl: file_url,
          fileName: file.name,
          documentType: documentType,
          contractorName: contractorName
        }) }).then(res => res.json()).then(result => {
          console.log('Document uploaded to Google Drive:', result);
        }).catch(err => {
          console.warn('Google Drive upload failed (non-blocking):', err);
        });

        const insuranceFolders = [
          'workers comp', 'workers compensation', 'insurance', 'coi', 
          'certificate of insurance', 'liability', 'workers comp records'
        ];
        
        const folderLower = folder.toLowerCase();
        if (insuranceFolders.some(insFolder => folderLower.includes(insFolder))) {
            // Process the document in the background (don't block UI)
            processInsuranceDocument({ documentId: document.id })
              .then(() => console.log('Insurance document processed successfully'))
              .catch(err => console.warn('Insurance processing failed:', err));
        }
      }

      onUploadSuccess();
      setFiles([]);
    } catch (err) {
      console.error('Error uploading documents:', err);
      setError('An error occurred during upload. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Upload Documents</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div>
          <Label htmlFor="folder">Folder Name</Label>
          {initialFolderName ? (
            <Input 
              id="folder" 
              value={folder}
              disabled
              className="mt-1"
            />
          ) : (
            <div className="flex gap-2 mt-1">
              <Input 
                id="folder" 
                placeholder="e.g., Onboarding, W-9, Contracts"
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
              />
              <select 
                className="border border-gray-300 rounded-md px-3 py-2 bg-white text-sm"
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    setFolder(e.target.value);
                  }
                }}
              >
                <option value="" disabled>Use existing...</option>
                {existingFolders.map(folderName => (
                  <option key={folderName} value={folderName}>{folderName}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        
        <div className="space-y-4">
          <Label>Files</Label>
          
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 mb-2">
              Drag and drop files here, or{' '}
              <label className="text-blue-600 hover:text-blue-700 cursor-pointer underline">
                click to browse
                <input
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt,.xlsx,.xls"
                />
              </label>
            </p>
            <p className="text-sm text-gray-400">
              Supports PDF, Word, Excel, Images, and Text files
            </p>
          </div>

          {files.length > 0 && (
            <div className="border rounded-lg p-4 bg-gray-50">
              <h4 className="text-sm font-medium mb-2">Selected Files ({files.length})</h4>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-white p-2 rounded border">
                    <div className="flex items-center gap-2">
                      <File className="w-4 h-4 text-blue-500" />
                      <span className="text-sm truncate">{file.name}</span>
                      <span className="text-xs text-gray-500">
                        ({(file.size / 1024 / 1024).toFixed(1)} MB)
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="text-red-500 hover:text-red-700 h-6 w-6 p-0"
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={isUploading}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isUploading || files.length === 0}>
          {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isUploading ? `Uploading ${files.length} file(s)...` : `Upload ${files.length} file(s)`}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export default function ContractorDocumentsTab({ contractor }) {
  const [documents, setDocuments] = useState([]);
  const [signatureRequests, setSignatureRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [uploadConfig, setUploadConfig] = useState({ isOpen: false, folderName: '' });
  const [showCreateFolder, setShowCreateFolder] = useState(false);

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    try {
      // Use backend function to bypass potential entity permission issues
      const response = await (await fetch('/api/getContractorDocuments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        targetUserId: contractor.id,
        targetUserEmail: contractor.email
      }) })).json();
      
      const { documents: docs, signatureRequests: reqs } = response.data;

      setDocuments(docs || []);
      setSignatureRequests(reqs || []);
    } catch (error) {
      console.error('Error loading documents:', error);
      // Fallback to direct entity access if function fails (unlikely)
      try {
           const docs = await (await supabase.from('ContractorDocument').select('*').match({ contractorId: contractor.id }, '-uploadDate')).data;
           setDocuments(docs);
      } catch (e) { console.error('Fallback load failed', e); }
    } finally {
      setIsLoading(false);
    }
  }, [contractor.id, contractor.email]);

  useEffect(() => {
    loadDocuments();
    (supabase.auth.getUser().then(res => res.data.user)).then(setCurrentUser);
  }, [loadDocuments]);

  const handleDelete = async (docId) => {
    if(window.confirm('Are you sure you want to delete this document? This action cannot be undone.')){
      try {
        await (await supabase.from('ContractorDocument').delete().eq('id', docId));
        loadDocuments();
      } catch(error){
        console.error("Failed to delete document", error)
      }
    }
  };

  const handleCreateFolder = async (folderName) => {
    if (!currentUser) {
      console.error("User not loaded, cannot create folder.");
      return;
    }
    try {
      await supabase.from('ContractorDocument').insert({
        contractorId: contractor.id,
        fileName: '.folder_placeholder',
        fileUrl: '#', 
        mimeType: 'application/x-folder',
        folder: folderName,
        uploadedBy: currentUser.email,
        uploadDate: getCurrentTimeInCT()
      });
      loadDocuments();
    } catch (error) {
      console.error('Error creating folder:', error);
    }
  };

  const groupedDocuments = useMemo(() => {
    return groupBy(documents.filter(doc => doc.fileName !== '.folder_placeholder'), 'folder');
  }, [documents]);

  const existingFolders = useMemo(() => {
    return Object.keys(groupedDocuments).sort();
  }, [groupedDocuments]);

  if (isLoading) {
    return <div className="flex justify-center items-center p-8"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }
  
  const handleCloseDialog = () => {
    setUploadConfig({ isOpen: false, folderName: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Contractor Documents</h3>
          <p className="text-sm text-gray-500">
            Organize and manage documents for {contractor.displayName || contractor.full_name}.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowCreateFolder(true)} disabled={!currentUser}>
            <FolderPlus className="mr-2 h-4 w-4" /> Create Folder
          </Button>
          <Button onClick={() => setUploadConfig({ isOpen: true, folderName: '' })} disabled={!currentUser}>
            <UploadCloud className="mr-2 h-4 w-4" /> Upload Documents
          </Button>
        </div>
      </div>
      
      <Dialog open={uploadConfig.isOpen} onOpenChange={(isOpen) => !isOpen && handleCloseDialog()}>
        {currentUser && (
          <UploadDocumentDialog 
            contractor={contractor} 
            currentUser={currentUser}
            initialFolderName={uploadConfig.folderName}
            existingFolders={existingFolders}
            onUploadSuccess={() => {
              handleCloseDialog();
              loadDocuments();
            }}
            onClose={handleCloseDialog}
          />
        )}
      </Dialog>

      <CreateFolderDialog
        isOpen={showCreateFolder}
        onClose={() => setShowCreateFolder(false)}
        onCreateFolder={handleCreateFolder}
        existingFolders={existingFolders}
      />

      {/* Signature Requests Section */}
      {signatureRequests.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/20">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-blue-800">
                    <FileSignature className="h-5 w-5" />
                    Signature Requests
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    {signatureRequests.map(req => (
                        <div key={req.id} className="flex items-center justify-between p-3 bg-white rounded border border-blue-100">
                            <div className="flex items-center gap-3">
                                {req.status === 'Signed' ? (
                                    <CheckCircle className="h-5 w-5 text-green-500" />
                                ) : req.status === 'Viewed' ? (
                                    <Eye className="h-5 w-5 text-blue-500" />
                                ) : (
                                    <Clock className="h-5 w-5 text-orange-500" />
                                )}
                                <div>
                                    <p className="text-sm font-medium text-gray-900">{req.documentTitle}</p>
                                    <p className="text-xs text-gray-500">
                                        Status: {req.status} • Sent: {format(new Date(req.created_date), 'MMM d, yyyy')}
                                        {req.signedAt && ` • Signed: ${format(new Date(req.signedAt), 'MMM d, yyyy')}`}
                                    </p>
                                </div>
                            </div>
                            {req.status === 'Signed' && req.signedPdfUrl && (
                                <a href={req.signedPdfUrl} target="_blank" rel="noopener noreferrer">
                                    <Button variant="outline" size="sm" className="h-8">
                                        <Download className="h-3 w-3 mr-1" /> View Signed PDF
                                    </Button>
                                </a>
                            )}
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
      )}

      {Object.keys(groupedDocuments).length === 0 && signatureRequests.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <File className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No documents found</h3>
            <p className="mt-1 text-sm text-gray-500">No uploads or signature requests found for this contractor.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {existingFolders.map((folderName) => (
            <Card key={folderName}>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Folder className="h-5 w-5 text-gray-500" />
                    {folderName}
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setUploadConfig({ isOpen: true, folderName: folderName })}>
                    <FilePlus className="h-4 w-4 mr-2"/>
                    Add files
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-gray-200">
                  {groupedDocuments[folderName].map(doc => (
                    <li key={doc.id} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <File className="h-5 w-5 text-blue-500" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{doc.fileName}</p>
                          <p className="text-xs text-gray-500">
                            Uploaded by {doc.uploadedBy} on {format(new Date(doc.uploadDate), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm">
                            <Download className="h-4 w-4 mr-1"/> View
                          </Button>
                        </a>
                        <Button variant="ghost" size="icon" className="text-gray-500 hover:text-red-600" onClick={() => handleDelete(doc.id)}>
                          <Trash2 className="h-4 w-4"/>
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}