import React, { useState, useEffect } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { Edit, Loader2, ExternalLink } from 'lucide-react';

export default function EditInvoiceDialog({ isOpen, onClose, invoice, onSuccess }) {
  const [formData, setFormData] = useState({
    fileName: '',
    weekEndingDate: '',
    totalAmount: '',
    daysWorked: '',
    notes: '',
    approvalNotes: '',
    paymentStatus: 'unpaid',
    paymentDate: '',
    paymentMethod: '',
    paymentReference: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (invoice && isOpen) {
      setFormData({
        fileName: invoice.fileName || '',
        weekEndingDate: invoice.weekEndingDate || '',
        totalAmount: invoice.totalAmount?.toString() || '',
        daysWorked: invoice.daysWorked?.toString() || '',
        notes: invoice.notes || '',
        approvalNotes: invoice.approvalNotes || '',
        paymentStatus: invoice.paymentStatus || 'unpaid',
        paymentDate: invoice.paymentDate || '',
        paymentMethod: invoice.paymentMethod || '',
        paymentReference: invoice.paymentReference || ''
      });
    }
  }, [invoice, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.totalAmount || parseFloat(formData.totalAmount) <= 0) {
      setError('Please enter a valid total amount');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const updateData = {
        fileName: formData.fileName,
        weekEndingDate: formData.weekEndingDate,
        totalAmount: parseFloat(formData.totalAmount),
        daysWorked: formData.daysWorked ? parseFloat(formData.daysWorked) : undefined,
        notes: formData.notes,
        approvalNotes: formData.approvalNotes,
        paymentStatus: formData.paymentStatus,
        paymentDate: formData.paymentDate || null,
        paymentMethod: formData.paymentMethod || null,
        paymentReference: formData.paymentReference || null
      };

      await (await supabase.from('Invoice').update(updateData).eq('id', invoice.id)).data;
      
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Error updating invoice:', err);
      setError(err.message || 'Failed to update invoice. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!invoice) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="w-5 h-5" />
            Edit Invoice - {invoice.fileName}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Invoice File Link */}
          {invoice.fileUrl && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => window.open(invoice.fileUrl, '_blank')}
                className="text-blue-600 hover:text-blue-700"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View Original Invoice File
              </Button>
            </div>
          )}

          {/* File Name */}
          <div>
            <Label htmlFor="fileName">File Name</Label>
            <Input
              id="fileName"
              type="text"
              value={formData.fileName}
              onChange={(e) => setFormData({ ...formData, fileName: e.target.value })}
            />
          </div>

          {/* Week Ending Date */}
          <div>
            <Label htmlFor="weekEndingDate">Week Ending Date</Label>
            <Input
              id="weekEndingDate"
              type="date"
              value={formData.weekEndingDate}
              onChange={(e) => setFormData({ ...formData, weekEndingDate: e.target.value })}
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

          {/* Payment Status */}
          <div>
            <Label htmlFor="paymentStatus">Payment Status</Label>
            <Select
              value={formData.paymentStatus}
              onValueChange={(value) => setFormData({ ...formData, paymentStatus: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="partial">Partially Paid</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Payment Details (shown if paid or partial) */}
          {(formData.paymentStatus === 'paid' || formData.paymentStatus === 'partial') && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="paymentDate">Payment Date</Label>
                  <Input
                    id="paymentDate"
                    type="date"
                    value={formData.paymentDate}
                    onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="paymentMethod">Payment Method</Label>
                  <Input
                    id="paymentMethod"
                    placeholder="e.g., Check, ACH, Wire"
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="paymentReference">Payment Reference</Label>
                <Input
                  id="paymentReference"
                  placeholder="e.g., Check #12345"
                  value={formData.paymentReference}
                  onChange={(e) => setFormData({ ...formData, paymentReference: e.target.value })}
                />
              </div>
            </>
          )}

          {/* Contractor Notes */}
          <div>
            <Label htmlFor="notes">Contractor Notes</Label>
            <Textarea
              id="notes"
              placeholder="Notes from contractor..."
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          {/* Approval Notes */}
          <div>
            <Label htmlFor="approvalNotes">Admin Notes</Label>
            <Textarea
              id="approvalNotes"
              placeholder="Internal admin notes..."
              rows={2}
              value={formData.approvalNotes}
              onChange={(e) => setFormData({ ...formData, approvalNotes: e.target.value })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Edit className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}