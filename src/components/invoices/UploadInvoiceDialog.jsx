import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { Upload, X, FileText, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export default function UploadInvoiceDialog({ isOpen, onClose, contractor, onSuccess }) {
  const [file, setFile] = useState(null);
  const [formData, setFormData] = useState({
    weekEndingDate: format(new Date(), 'yyyy-MM-dd'),
    totalAmount: '',
    daysWorked: '',
    notes: ''
  });
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      // Check file size (50MB limit)
      if (selectedFile.size > 50 * 1024 * 1024) {
        setError('File size must be less than 50MB');
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!file) {
      setError('Please select a file to upload');
      return;
    }

    if (!formData.totalAmount || parseFloat(formData.totalAmount) <= 0) {
      setError('Please enter a valid total amount');
      return;
    }

    if (!formData.weekEndingDate) {
      setError('Please select a week ending date');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Get current user for approvedBy
      const currentUser = (await supabase.auth.getUser()).data.user;
      
      // Step 1: Upload file
      console.log('Uploading file...');
      const uploadResult = await supabase.storage.from('documents').upload( file .file.name,  file .file);
      console.log('File uploaded:', uploadResult.file_url);
      
      // Step 2: Create invoice record
      console.log('Creating invoice record...');
      const invoiceData = {
        contractorName: contractor.displayName || contractor.full_name || contractor.email,
        contractorEmail: contractor.email,
        businessName: contractor.business,
        fileName: file.name,
        fileUrl: uploadResult.file_url,
        mimeType: file.type,
        invoiceDate: new Date().toISOString(),
        weekEndingDate: formData.weekEndingDate,
        totalAmount: parseFloat(formData.totalAmount),
        daysWorked: formData.daysWorked ? parseFloat(formData.daysWorked) : undefined,
        status: 'approved',
        approvedDate: new Date().toISOString(),
        approvedBy: currentUser?.email || 'admin',
        autoApproved: false,
        approvalNotes: formData.notes || 'Manually uploaded by admin',
        notes: formData.notes,
        paymentStatus: 'unpaid'
      };
      
      const createdInvoice = await (await supabase.from('Invoice').insert(invoiceData)).data;
      console.log('Invoice created:', createdInvoice.id);

      // Step 3: Update payment ledger with the actual invoice ID
      console.log('Updating payment ledger...');
      try {
        await (await fetch('/api/updatePaymentLedger', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          invoice: {
            id: createdInvoice.id,
            contractorEmail: contractor.email,
            contractorName: contractor.displayName || contractor.full_name,
            approvedDate: new Date().toISOString(),
            totalAmount: parseFloat(formData.totalAmount),
            status: 'approved'
          }
        })}));
        console.log('Payment ledger updated successfully');
      } catch (ledgerError) {
        console.error('Error updating payment ledger:', ledgerError);
        // Don't fail the whole operation if ledger update fails
        // Invoice is still created successfully
      }

      // Success
      console.log('Invoice upload completed successfully');
      onSuccess?.('Invoice uploaded and saved successfully');
      handleClose();
    } catch (err) {
      console.error('Error uploading invoice:', err);
      setError(err.message || 'Failed to upload invoice. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setFormData({
      weekEndingDate: format(new Date(), 'yyyy-MM-dd'),
      totalAmount: '',
      daysWorked: '',
      notes: ''
    });
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload Invoice for {contractor?.displayName || contractor?.full_name}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* File Upload */}
          <div>
            <Label htmlFor="file">Invoice File *</Label>
            <div className="mt-2">
              {!file ? (
                <label
                  htmlFor="file-input"
                  className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600">Click to upload or drag and drop</p>
                  <p className="text-xs text-gray-500 mt-1">PDF, Image, Excel, Word (Max 50MB)</p>
                </label>
              ) : (
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="w-6 h-6 text-blue-500" />
                    <div>
                      <p className="font-medium text-gray-900">{file.name}</p>
                      <p className="text-sm text-gray-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFile(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
              <input
                id="file-input"
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx"
                onChange={handleFileChange}
              />
            </div>
          </div>

          {/* Week Ending Date */}
          <div>
            <Label htmlFor="weekEndingDate">Week Ending Date *</Label>
            <Input
              id="weekEndingDate"
              type="date"
              value={formData.weekEndingDate}
              onChange={(e) => setFormData({ ...formData, weekEndingDate: e.target.value })}
              required
            />
          </div>

          {/* Amount and Days Worked */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="totalAmount">Total Amount *</Label>
              <Input
                id="totalAmount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.totalAmount}
                onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="daysWorked">Days Worked</Label>
              <Input
                id="daysWorked"
                type="number"
                step="0.5"
                min="0"
                max="7"
                placeholder="5"
                value={formData.daysWorked}
                onChange={(e) => setFormData({ ...formData, daysWorked: e.target.value })}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this invoice..."
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isUploading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isUploading || !file}>
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Invoice
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}