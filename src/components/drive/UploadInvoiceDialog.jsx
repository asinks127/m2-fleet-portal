import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { AlertCircle, DollarSign, Loader2 } from 'lucide-react';

export default function UploadInvoiceDialog({ isOpen, onClose, onUpdate, contractors }) {
  const [file, setFile] = useState(null);
  const [contractorId, setContractorId] = useState('');
  const [weekEndingDate, setWeekEndingDate] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const user = (await supabase.auth.getUser()).data.user;
        setCurrentUser(user);
      } catch (err) {
        console.error('Failed to load current user:', err);
      }
    };
    
    if (isOpen) {
      loadCurrentUser();
    }
  }, [isOpen]);

  const resetForm = () => {
    setFile(null);
    setContractorId('');
    setWeekEndingDate('');
    setTotalAmount('');
    setError(null);
    setIsUploading(false);
  };

  const handleClose = () => {
    if (isUploading) return;
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!file || !contractorId || !weekEndingDate || !totalAmount) {
      setError('All fields are required.');
      return;
    }
    setError(null);
    setIsUploading(true);

    try {
      const selectedContractor = contractors.find(c => c.id === contractorId);
      if (!selectedContractor) {
        throw new Error('Selected contractor not found.');
      }

      // Check for duplicate invoices
      const existingInvoices = await (await supabase.from('Invoice').select('*').match({
        contractorEmail: selectedContractor.email,
        weekEndingDate: weekEndingDate
      })).data;

      const duplicate = existingInvoices.find(inv => 
        inv.fileName === file.name && 
        inv.status !== 'rejected'
      );

      if (duplicate) {
        setError(
          `Duplicate invoice detected: "${file.name}" has already been submitted for this contractor ` +
          `for the week ending ${new Date(weekEndingDate).toLocaleDateString()}. ` +
          `Current status: ${duplicate.status}.`
        );
        setIsUploading(false);
        return;
      }

      console.log('Uploading invoice file to storage...');
      const fileName = `${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from('documents').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(fileName);
      const file_url = urlData.publicUrl;

      console.log('Creating approved invoice record...');
      const contractorName = selectedContractor.name || selectedContractor.email;
      const { data: invoice, error: insertError } = await supabase.from('Invoice').insert({
        contractorName: contractorName,
        contractorEmail: selectedContractor.email,
        businessName: selectedContractor.name,
        fileName: file.name,
        fileUrl: file_url,
        mimeType: file.type,
        invoiceDate: new Date().toISOString(),
        weekEndingDate,
        totalAmount: parseFloat(totalAmount),
        status: 'approved',
        autoApproved: false,
        approvedBy: currentUser?.email || 'admin_upload',
        approvedDate: new Date().toISOString(),
        approvalNotes: `Manually uploaded by admin ${currentUser?.email || 'unknown'} via Invoices Drive`,
        pendingReason: null,
        rejectionReason: null
      }).select().single();
      if (insertError) throw insertError;

      // Trigger Google Drive Upload
      fetch('/api/uploadToDrive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        fileUrl: file_url,
        fileName: file.name,
        documentType: 'invoice',
        contractorName: contractorName,
        invoiceId: invoice.id
      }) }).then(res => res.json()).catch(err => console.error('Drive upload failed:', err));

      console.log('✅ Invoice uploaded and automatically approved');
      onUpdate();
      handleClose();
    } catch (err) {
      console.error('Failed to upload invoice:', err);
      setError(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Invoice (Auto-Approved)</DialogTitle>
          <DialogDescription>
            Manually upload an invoice directly to a contractor's profile. This will be automatically approved and saved immediately.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div>
            <Label htmlFor="invoiceFile">Invoice File *</Label>
            <Input
              id="invoiceFile"
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="mt-1"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
            />
            <p className="text-xs text-gray-500 mt-1">
              Supported formats: PDF, images, Excel, Word
            </p>
          </div>

          <div>
            <Label htmlFor="contractor">Assign to Contractor *</Label>
            <Select value={contractorId} onValueChange={setContractorId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select a contractor" />
              </SelectTrigger>
              <SelectContent>
                {contractors
                  .filter(c => c.name)
                  .sort((a,b) => a.name.localeCompare(b.name))
                  .map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="weekEndingDate">Week Ending Date *</Label>
              <Input
                id="weekEndingDate"
                type="date"
                value={weekEndingDate}
                onChange={(e) => setWeekEndingDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="totalAmount">Total Amount *</Label>
              <div className="relative mt-1">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="totalAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          <Alert className="bg-green-50 border-green-200">
            <AlertCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <strong>Note:</strong> This invoice will be automatically approved and saved to the selected contractor's profile. It will not require manual review.
            </AlertDescription>
          </Alert>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isUploading} className="bg-green-600 hover:bg-green-700">
            {isUploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isUploading ? 'Uploading & Approving...' : 'Upload & Auto-Approve'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}