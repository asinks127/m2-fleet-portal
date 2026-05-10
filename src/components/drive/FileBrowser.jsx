import React, { useState, useMemo, useCallback } from 'react';
import { Invoice } from '@/api/entities.js';
import { motion, AnimatePresence } from 'framer-motion';
import Breadcrumbs from './Breadcrumbs';
import Toolbar from './Toolbar';
import FolderItem from './FolderItem';
import FileItem from './FileItem';
import { FileWarning, Search, UploadCloud, Loader2, FileUp } from 'lucide-react';
import { Input } from '@/components/ui/input.jsx';
import { UploadFile } from '@/api/integrations.js';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { supabase } from '@/lib/supabaseClient.js';

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

export default function FileBrowser({ initialItems, isLoading, onUpdate, contractors }) {
  const [path, setPath] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState([]);
  const [uploadError, setUploadError] = useState(null);

  const navigateTo = (folderName) => {
    setPath([...path, folderName]);
    setSearchTerm('');
  };

  const navigateUp = (index) => {
    setPath(path.slice(0, index + 1));
    setSearchTerm('');
  };
  
  const goHome = () => {
    setPath([]);
    setSearchTerm('');
  };

  const getContractorFromPath = useCallback(() => {
    // Modified to work at any folder depth - contractor is always the first path segment
    if (path.length === 0) return null;
    const contractorName = path[0];
    // FIX: Compare against the 'name' property of the simplified contractor object
    return contractors.find(c => c.name === contractorName);
  }, [path, contractors]);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const contractor = getContractorFromPath();
    // Now works in any subfolder, not just contractor root
    if (contractor) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    setUploadError(null);

    const contractor = getContractorFromPath();
    if (!contractor) {
      setUploadError("You can only drop files inside a contractor's folder.");
      return;
    }

    const files = [...e.dataTransfer.files];
    if (!files || files.length === 0) return;

    // "Concerned Family Member" Duplicate Check
    // 1. Check for duplicates within the dropped batch
    const fileNamesInBatch = files.map(f => f.name.toLowerCase());
    const uniqueNamesInBatch = new Set(fileNamesInBatch);
    if (fileNamesInBatch.length !== uniqueNamesInBatch.size) {
      setUploadError('It looks like you have dropped the same file multiple times. Please remove duplicates.');
      return;
    }

    // 2. Check against existing files in the current view/folder
    // currentItems contains the currently displayed files and folders
    const existingFileNames = currentItems
      .filter(item => item.type === 'file')
      .map(item => item.name.toLowerCase());

    const duplicateFiles = files.filter(file => existingFileNames.includes(file.name.toLowerCase()));
    
    if (duplicateFiles.length > 0) {
      setUploadError(`Double Check: The following files already exist in this folder: ${duplicateFiles.map(f => f.name).join(', ')}. To prevent confusion, duplicates are not allowed.`);
      return;
    }

    const newUploadingFiles = files.map(file => ({ name: file.name, status: 'uploading' }));
    setUploadingFiles(prev => [...prev, ...newUploadingFiles]);

    for (const file of files) {
      try {
        const { file_url } = await UploadFile({ file });

        setUploadingFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'creating_record' } : f));
        
        // Determine the year from the current path or use current year as default
        let invoiceYear = new Date().getFullYear();
        if (path.length >= 2) {
          // If we're in a year subfolder (e.g., ["Adam White", "2025"]), use that year
          const yearFromPath = parseInt(path[1]);
          if (!isNaN(yearFromPath)) {
            invoiceYear = yearFromPath;
          }
        }

        // Set the invoice date to match the folder year (January 1st of that year)
        const invoiceDate = `${invoiceYear}-01-01T00:00:00.000Z`;
        const approvedDate = getCurrentTimeInCT();
        
        const invoice = await Invoice.create({
          contractorEmail: contractor.email,
          // FIX: Use the 'name' property from the found contractor object
          contractorName: contractor.name,
          businessName: contractor.business, // This field might be missing, but let's keep it
          fileName: file.name,
          fileUrl: file_url,
          mimeType: file.type,
          status: 'approved', // Automatically approved since admin dropped it
          autoApproved: true, // Mark as auto-approved to distinguish from user submissions
          approvedDate: approvedDate,
          approvedBy: 'admin_upload', // Indicate this was an admin action
          approvalNotes: 'File uploaded directly via Drive interface',
          invoiceDate: invoiceDate,
          // Remove pendingReason since we don't want review
        });

        // Trigger Google Drive Upload
        fetch('/api/uploadToDrive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          fileUrl: file_url,
          fileName: file.name,
          documentType: 'invoice',
          contractorName: contractor.name,
          invoiceId: invoice.id
        }) }).then(res => res.json()).catch(err => console.error('Drive upload failed:', err));
        
        setUploadingFiles(prev => prev.filter(f => f.name !== file.name));
      } catch (err) {
        console.error('Upload failed for file:', file.name, err);
        setUploadingFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'error', message: err.message } : f));
        setUploadError(`Failed to upload ${file.name}. Please try again.`);
        // Note: For multiple files, this approach will continue trying other files even if one fails.
        // If you want to stop on the first error, you would add a 'break' here or refactor.
      }
    }
    setTimeout(() => onUpdate(path), 500); // Pass current path to maintain position
  };


  const currentItems = useMemo(() => {
    if (path.length === 0) return initialItems;
    let currentLevel = initialItems;
    for (const segment of path) {
      const nextLevel = currentLevel.find(item => item.name === segment && item.type === 'folder');
      if (nextLevel && nextLevel.children) {
        currentLevel = nextLevel.children;
      } else {
        return [];
      }
    }
    return currentLevel;
  }, [path, initialItems]);

  const filteredItems = useMemo(() => {
    if (!searchTerm) return currentItems;
    return currentItems.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [currentItems, searchTerm]);

  const folders = filteredItems.filter(item => item.type === 'folder');
  const files = filteredItems.filter(item => item.type === 'file');

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  return (
    <div 
      className="bg-white rounded-lg shadow-md border border-gray-200 flex-1 flex flex-col overflow-hidden relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <AnimatePresence>
        {isDraggingOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-blue-500/20 border-4 border-dashed border-blue-500 rounded-lg z-10 flex flex-col items-center justify-center pointer-events-none" // pointer-events-none allows interaction with underlying elements if needed, but here it's an overlay
          >
            <UploadCloud className="w-16 h-16 text-blue-600" />
            <p className="mt-4 text-xl font-semibold text-blue-700">
              Drop files to upload
              {path.length >= 2 && (
                <span className="block text-sm mt-1">into {path.join(' → ')}</span>
              )}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      
      <Toolbar onUpdate={() => onUpdate(path)} path={path} contractors={contractors} />
      <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-3">
        <Breadcrumbs path={path} onNavigateUp={navigateUp} onGoHome={goHome} />
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search in this folder..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>
      <div 
        className="flex-1 overflow-auto p-4"
      >
        {uploadingFiles.length > 0 && (
          <div className="mb-4 space-y-2">
            <h3 className="text-sm font-medium text-gray-600">Uploads in Progress</h3>
            {uploadingFiles.map(file => (
              <div key={file.name} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                <div className="flex items-center gap-2">
                  <FileUp className="w-4 h-4 text-gray-500" />
                  <span className="text-sm">{file.name}</span>
                </div>
                {file.status === 'uploading' && <span className="text-xs text-blue-600 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin"/> Uploading...</span>}
                {file.status === 'creating_record' && <span className="text-xs text-green-600 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin"/> Processing...</span>}
                {file.status === 'error' && <span className="text-xs text-red-600">Error: {file.message || 'Unknown error'}</span>}
              </div>
            ))}
          </div>
        )}
        {uploadError && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{uploadError}</AlertDescription>
          </Alert>
        )}
        {folders.length > 0 && (
          <motion.div 
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {folders.map(folder => (
              <FolderItem key={folder.id} folder={folder} onNavigate={() => navigateTo(folder.name)} />
            ))}
          </motion.div>
        )}
        
        {files.length > 0 && (
          <>
            {folders.length > 0 && <hr className="my-6" />}
            <motion.div 
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <AnimatePresence>
                {files.map(file => (
                  <FileItem 
                    key={file.id} 
                    file={file} 
                    onUpdate={() => onUpdate(path)} 
                    contractors={contractors}
                    currentPath={path}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          </>
        )}

        {!isLoading && filteredItems.length === 0 && (
          <div className="text-center text-gray-500 py-16">
            <FileWarning className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold">
              {searchTerm ? 'No results found' : 'This folder is empty'}
            </h3>
            <p className="text-sm mt-1">
              {searchTerm 
                ? `Your search for "${searchTerm}" did not match any files or folders.`
                : 'There are no items in this location.'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}