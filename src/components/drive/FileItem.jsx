import React, { useState } from 'react';
import { Invoice } from '@/api/entities.js';
import { FileText, MoreVertical, Download, Trash2, Move, FileArchive, FileImage, FileJson, Edit } from 'lucide-react';
import { motion } from 'framer-motion';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import MoveInvoiceDialog from './MoveInvoiceDialog';
import { toast } from 'sonner';

const getFileIcon = (fileName) => {
  const extension = fileName.split('.').pop().toLowerCase();
  switch (extension) {
    case 'pdf':
      return <FileText className="w-12 h-12 text-red-500" />;
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'heic':
    case 'webp':
      return <FileImage className="w-12 h-12 text-green-500" />;
    case 'json':
      return <FileJson className="w-12 h-12 text-yellow-500" />;
    default:
      return <FileArchive className="w-12 h-12 text-gray-500" />;
  }
};

export default function FileItem({ file, onUpdate, contractors, currentPath }) {
  const [isMoving, setIsMoving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newFileName, setNewFileName] = useState('');

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete ${file.name}? This action cannot be undone.`)) {
      setIsDeleting(true);
      try {
        await Invoice.delete(file.data.id);
        toast.success(`Deleted ${file.name} successfully`);
        onUpdate();
      } catch (error) {
        console.error('Failed to delete invoice:', error);
        alert('Failed to delete invoice.');
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleRename = () => {
    setNewFileName(file.name);
    setIsRenaming(true);
  };

  const handleRenameConfirm = async () => {
    if (!newFileName.trim() || newFileName === file.name) {
      setIsRenaming(false);
      return;
    }

    try {
      await Invoice.update(file.data.id, {
        fileName: newFileName.trim()
      });
      setIsRenaming(false);
      toast.success(`Renamed to ${newFileName.trim()} successfully`);
      onUpdate();
    } catch (error) {
      console.error('Failed to rename file:', error);
      alert('Failed to rename file.');
    }
  };
  
  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 },
    exit: { scale: 0.8, opacity: 0 }
  };

  return (
    <>
      <motion.div
        variants={itemVariants}
        layout
        className="group relative flex flex-col items-center p-3 rounded-lg hover:bg-gray-100 text-center transition-colors"
      >
        <div className="flex-grow flex flex-col items-center justify-center">
          {getFileIcon(file.name)}
          <p className="mt-2 text-sm font-medium text-gray-700 break-words w-full">
            {file.name}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => window.open(file.data.fileUrl, '_blank')}>
              <Download className="w-4 h-4 mr-2" />
              Download
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleRename}>
              <Edit className="w-4 h-4 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setIsMoving(true)}>
              <Move className="w-4 h-4 mr-2" />
              Move
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleDelete} className="text-red-600 focus:text-red-600 focus:bg-red-50" disabled={isDeleting}>
              <Trash2 className="w-4 h-4 mr-2" />
              {isDeleting ? 'Deleting...' : 'Delete'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </motion.div>
      
      {/* Rename Dialog */}
      <Dialog open={isRenaming} onOpenChange={setIsRenaming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename File</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="fileName">File Name</Label>
              <Input
                id="fileName"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="Enter new file name"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleRenameConfirm();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenaming(false)}>
              Cancel
            </Button>
            <Button onClick={handleRenameConfirm}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Dialog */}
      {isMoving && (
        <MoveInvoiceDialog
          invoice={file.data}
          isOpen={isMoving}
          onClose={() => setIsMoving(false)}
          onUpdate={onUpdate}
          contractors={contractors}
          currentPath={currentPath}
        />
      )}
    </>
  );
}