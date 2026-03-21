import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import {
  FileText,
  Calendar,
  DollarSign,
  Clock,
  ExternalLink,
  Search,
  AlertCircle,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Filter,
  Loader2
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { Label } from '@/components/ui/label.jsx';
import { format } from 'date-fns';

// Helper to convert UTC to Central Time for display using browser Intl API
function formatCentralTime(utcDateString) {
  if (!utcDateString) return 'N/A';
  try {
    const utcDate = new Date(utcDateString);
    if (isNaN(utcDate.getTime())) {
      return 'Invalid Date';
    }

    const options = {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    };
    
    const centralString = utcDate.toLocaleString('en-US', options);
    return centralString + ' CT';
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid Date';
  }
}

// Helper component for editing invoice notes
function EditNotesDialog({ open, invoice, onClose, onConfirm, isProcessing }) {
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open && invoice) {
      setNotes(invoice.pendingReason || '');
    } else {
      setNotes('');
    }
  }, [open, invoice]);

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Manual Review Notes</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p>Editing notes for: <strong>{invoice.fileName}</strong></p>
          <div>
            <Label htmlFor="editPendingReason">Manual Review Reason</Label>
            <Textarea
              id="editPendingReason"
              placeholder="Update or clear the notes for this invoice..."
              rows={5}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(invoice, notes)}
            disabled={isProcessing}
          >
            Save Notes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Approval Dialog
function ApprovalDialog({ open, invoice, onClose, onConfirm, isProcessing }) {
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) setNotes('');
  }, [open]);

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve Invoice</DialogTitle>
          <DialogDescription>
            Approving invoice from {invoice.contractorName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm"><strong>File:</strong> {invoice.fileName}</p>
            <p className="text-sm"><strong>Amount:</strong> ${invoice.totalAmount}</p>
            <p className="text-sm"><strong>Week Ending:</strong> {invoice.weekEndingDate ? format(new Date(invoice.weekEndingDate), 'MMM d, yyyy') : 'N/A'}</p>
          </div>
          <div>
            <Label htmlFor="approvalNotes">Approval Notes (Optional)</Label>
            <Textarea
              id="approvalNotes"
              placeholder="Add any notes about this approval..."
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(invoice, notes)}
            disabled={isProcessing}
            className="bg-green-600 hover:bg-green-700"
          >
            {isProcessing ? 'Approving...' : 'Approve Invoice'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Rejection Dialog
function RejectionDialog({ open, invoice, onClose, onConfirm, isProcessing }) {
  const [reason, setReason] = useState('');
  const [placeOnHold, setPlaceOnHold] = useState(false);

  useEffect(() => {
    if (!open) {
      setReason('');
      setPlaceOnHold(false);
    }
  }, [open]);

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject Invoice</DialogTitle>
          <DialogDescription>
            Rejecting invoice from {invoice.contractorName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm"><strong>File:</strong> {invoice.fileName}</p>
            <p className="text-sm"><strong>Amount:</strong> ${invoice.totalAmount}</p>
          </div>
          <div>
            <Label htmlFor="rejectionReason">Reason for Rejection *</Label>
            <Textarea
              id="rejectionReason"
              placeholder="Please provide a clear reason for rejection..."
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="placeOnHold"
              checked={placeOnHold}
              onCheckedChange={setPlaceOnHold}
            />
            <Label htmlFor="placeOnHold" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Require manual review of next invoice
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(invoice, reason, placeOnHold)}
            disabled={!reason.trim() || isProcessing}
            className="bg-red-600 hover:bg-red-700"
          >
            {isProcessing ? 'Rejecting...' : 'Reject Invoice'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RenameDialog({ open, invoice, onClose, onConfirm, isProcessing }) {
  const [fileName, setFileName] = useState('');

  useEffect(() => {
    if (open && invoice) {
      setFileName(invoice.fileName || '');
    }
  }, [open, invoice]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Invoice</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="rename-file">File Name</Label>
            <Input
              id="rename-file"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="mt-1"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={isProcessing}>
              Cancel
            </Button>
            <Button onClick={() => onConfirm(invoice, fileName)} disabled={isProcessing || !fileName.trim()}>
              Save
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BulkRenameDialog({ open, invoices, onClose, onSave, isProcessing }) {
  const [renames, setRenames] = useState({});

  useEffect(() => {
    if (open) {
      const initial = {};
      invoices.forEach(inv => initial[inv.id] = inv.fileName);
      setRenames(initial);
    }
  }, [open, invoices]);

  const handleSubmit = () => {
    onSave(renames);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Rename Pending Invoices</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-4 space-y-4">
          {invoices.length === 0 && <p className="text-gray-500">No invoices to rename.</p>}
          {invoices.map(inv => (
            <div key={inv.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 border rounded-lg bg-gray-50">
              <div className="w-full sm:w-1/3 truncate text-sm">
                <span className="font-medium text-gray-900 block truncate" title={inv.contractorName}>{inv.contractorName}</span>
                <span className="text-gray-500">{formatCentralTime(inv.created_date)}</span>
              </div>
              <Input 
                className="flex-1"
                value={renames[inv.id] || ''}
                onChange={(e) => setRenames({...renames, [inv.id]: e.target.value})}
                placeholder="File name"
              />
            </div>
          ))}
        </div>
        <DialogFooter className="mt-4 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isProcessing || invoices.length === 0}>Save Names</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Delete Confirmation Dialog
function DeleteDialog({ open, invoice, onClose, onConfirm, isProcessing }) {
  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Invoice</DialogTitle>
          <DialogDescription>
            Are you sure you want to permanently delete this invoice?
          </DialogDescription>
        </DialogHeader>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm"><strong>File:</strong> {invoice.fileName}</p>
          <p className="text-sm"><strong>Contractor:</strong> {invoice.contractorName}</p>
          <p className="text-sm text-yellow-800 mt-2">This action cannot be undone.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(invoice)}
            disabled={isProcessing}
            variant="destructive"
          >
            {isProcessing ? 'Deleting...' : 'Delete Invoice'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PendingInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [m2PmFilter, setM2PmFilter] = useState('all');
  const [veloPmFilter, setVeloPmFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState('created_date_desc');
  const [selectedInvoices, setSelectedInvoices] = useState(new Set());

  const [approvalDialog, setApprovalDialog] = useState({ open: false, invoice: null });
  const [bulkApprovalDialog, setBulkApprovalDialog] = useState(false);
  const [rejectionDialog, setRejectionDialog] = useState({ open: false, invoice: null });
  const [editNotesDialog, setEditNotesDialog] = useState({ open: false, invoice: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, invoice: null });
  const [renameDialog, setRenameDialog] = useState({ open: false, invoice: null });
  const [bulkRenameDialog, setBulkRenameDialog] = useState(false);

  useEffect(() => {
    loadPendingInvoices();
  }, []);

  const loadPendingInvoices = async () => {
    setIsLoading(true);
    try {
      const [pendingInvoices, allContractors] = await Promise.all([
        (await supabase.from('Invoice').select('*').match({ status: 'pending' }, '-created_date')).data,
        (await supabase.from('User').select('*')).data
      ]);

      // Filter out invoices from inactive contractors
      const inactiveEmails = new Set(
        allContractors
          .filter(u => u.active === false)
          .map(u => u.email?.toLowerCase())
          .filter(Boolean)
      );

      const activeInvoices = pendingInvoices.filter(inv => 
        !inactiveEmails.has(inv.contractorEmail?.toLowerCase())
      );

      console.log('Loaded pending invoices:', activeInvoices.length, '(filtered from', pendingInvoices.length, ')');
      setInvoices(activeInvoices);
      setContractors(allContractors);
    } catch (err) {
      console.error('Error loading pending invoices:', err);
      setError(err.message || 'Failed to load invoices');
    } finally {
      setIsLoading(false);
    }
  };

  const getContractorInfo = (email) => {
    const contractor = contractors.find(c => c.email === email);
    return {
      project: contractor?.project || 'N/A',
      m2PM: contractor?.m2PM || 'N/A',
      veloPM: contractor?.veloPM || 'N/A'
    };
  };

  const filteredAndSortedInvoices = useMemo(() => {
    let filtered = [...invoices];

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(inv =>
        inv.contractorName?.toLowerCase().includes(search) ||
        inv.fileName?.toLowerCase().includes(search) ||
        inv.contractorEmail?.toLowerCase().includes(search)
      );
    }

    // Project filter
    if (projectFilter !== 'all') {
      filtered = filtered.filter(inv => {
        const info = getContractorInfo(inv.contractorEmail);
        return info.project === projectFilter;
      });
    }

    // M2 PM filter
    if (m2PmFilter !== 'all') {
      filtered = filtered.filter(inv => {
        const info = getContractorInfo(inv.contractorEmail);
        return info.m2PM === m2PmFilter;
      });
    }

    // Velo PM filter
    if (veloPmFilter !== 'all') {
      filtered = filtered.filter(inv => {
        const info = getContractorInfo(inv.contractorEmail);
        return info.veloPM === veloPmFilter;
      });
    }

    // Sorting
    const [field, order] = sortConfig.split('_');
    filtered.sort((a, b) => {
      let aVal, bVal;

      switch (field) {
        case 'created':
          aVal = new Date(a.created_date || 0);
          bVal = new Date(b.created_date || 0);
          break;
        case 'contractor':
          aVal = a.contractorName?.toLowerCase() || '';
          bVal = b.contractorName?.toLowerCase() || '';
          break;
        case 'amount':
          aVal = a.totalAmount || 0;
          bVal = b.totalAmount || 0;
          break;
        default:
          aVal = new Date(a.created_date || 0);
          bVal = new Date(b.created_date || 0);
      }

      if (order === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return filtered;
  }, [invoices, searchTerm, projectFilter, m2PmFilter, veloPmFilter, sortConfig, contractors]);

  const uniqueProjects = useMemo(() => {
    const projects = new Set();
    invoices.forEach(inv => {
      const info = getContractorInfo(inv.contractorEmail);
      if (info.project !== 'N/A') projects.add(info.project);
    });
    return Array.from(projects).sort();
  }, [invoices, contractors]);

  const uniqueM2PMs = useMemo(() => {
    const pms = new Set();
    invoices.forEach(inv => {
      const info = getContractorInfo(inv.contractorEmail);
      if (info.m2PM !== 'N/A') pms.add(info.m2PM);
    });
    return Array.from(pms).sort();
  }, [invoices, contractors]);

  const uniqueVeloPMs = useMemo(() => {
    const pms = new Set();
    invoices.forEach(inv => {
      const info = getContractorInfo(inv.contractorEmail);
      if (info.veloPM !== 'N/A') pms.add(info.veloPM);
    });
    return Array.from(pms).sort();
  }, [invoices, contractors]);

  const handleApprove = async (invoice, notes) => {
    setProcessingId(invoice.id);
    setError(null);
    setSuccess(null);

    try {
      const user = (await supabase.auth.getUser()).data.user;
      
      await supabase.from('Invoice').update({
        status: 'approved',
        approvedDate: new Date().toISOString(),
        approvedBy: user.email,
        approvalNotes: notes || `Approved by ${user.email}`,
        rejectionReason: null,
        pendingReason: null
      }).eq('id', invoice.id);

      const billedAmount = Number(invoice.amount || 0);
      await supabase.from('PaymentLedger').upsert({
        invoiceId: invoice.id,
        contractorEmail: invoice.contractorEmail,
        contractorName: invoice.contractorName || invoice.contractorEmail,
        amount: billedAmount,
        status: 'pending',
        notes: `Auto-created from approved invoice ${invoice.fileName || invoice.id}`
      }, { onConflict: 'invoiceId' });

      if (invoice.fileUrl) {
        fetch('/api/uploadToDrive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
            fileUrl: invoice.fileUrl,
            fileName: invoice.fileName,
            documentType: 'invoice',
            contractorName: invoice.contractorName,
            invoiceId: invoice.id
        }) }).then(res => res.json()).catch(e => console.error(`Background Drive upload failed for ${invoice.id}:`, e));
      }

      setSuccess(`Invoice "${invoice.fileName}" has been approved and added to Payment Ledger.`);
      setApprovalDialog({ open: false, invoice: null });
      loadPendingInvoices();
    } catch (err) {
      console.error('Error approving invoice:', err);
      setError('Failed to approve invoice. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedInvoices.size === 0) return;

    setProcessingId('bulk');
    setError(null);
    setSuccess(null);

    try {
      const user = (await supabase.auth.getUser()).data.user;
      const approvalPromises = Array.from(selectedInvoices).map(async (invoiceId) => {
        const invoice = invoices.find(inv => inv.id === invoiceId);
        
        // Trigger automatic upload to Google Drive
        if (invoice && invoice.fileUrl) {
            fetch('/api/uploadToDrive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                fileUrl: invoice.fileUrl,
                fileName: invoice.fileName,
                documentType: 'invoice',
                contractorName: invoice.contractorName,
                invoiceId: invoice.id
            }) }).then(res => res.json()).catch(e => console.error(`Background Drive upload failed for ${invoiceId}:`, e));
        }

        // CRITICAL FIX: Store approval date as UTC
        return supabase.from('Invoice').update({
          status: 'approved',
          approvedDate: new Date().toISOString(), // Store as UTC
          approvedBy: user.email,
          approvalNotes: `Bulk approved by ${user.email}`,
          rejectionReason: null,
          pendingReason: null
        }).eq('id', invoiceId);
      });

      await Promise.all(approvalPromises);

      setSuccess(`Successfully approved ${selectedInvoices.size} invoices and queued them for Drive upload.`);
      setSelectedInvoices(new Set());
      setBulkApprovalDialog(false);
      loadPendingInvoices();
    } catch (err) {
      console.error('Error bulk approving:', err);
      setError('Failed to approve some invoices. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (invoice, reason, placeOnHold) => {
    setProcessingId(invoice.id);
    setError(null);
    setSuccess(null);

    try {
      await (await supabase.from('Invoice').update({
        status: 'rejected',
        rejectionReason: reason,
        pendingReason: null,
        approvalNotes: null
      }).eq('id', invoice.id)).data;

      if (placeOnHold) {
        const contractor = contractors.find(c => c.email === invoice.contractorEmail);
        if (contractor) {
          await (await supabase.from('User').update({
            needsInvoiceReview: true,
            invoiceReviewReason: `Invoice rejected: ${reason}`
          }).eq('id', contractor.id)).data;
        }
      }

      setSuccess(`Invoice "${invoice.fileName}" has been rejected.`);
      setRejectionDialog({ open: false, invoice: null });
      loadPendingInvoices();
    } catch (err) {
      console.error('Error rejecting invoice:', err);
      setError('Failed to reject invoice. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleEditNotes = async (invoice, newNotes) => {
    setProcessingId(invoice.id);
    setError(null);
    setSuccess(null);

    try {
      await (await supabase.from('Invoice').update({
        pendingReason: newNotes
      }).eq('id', invoice.id)).data;

      setSuccess('Invoice notes updated successfully.');
      setEditNotesDialog({ open: false, invoice: null });
      loadPendingInvoices();
    } catch (err) {
      console.error('Error updating notes:', err);
      setError('Failed to update notes. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (invoice) => {
    setProcessingId(invoice.id);
    setError(null);
    setSuccess(null);

    try {
      await (await supabase.from('Invoice').delete().eq('id', invoice.id));

      setSuccess(`Invoice "${invoice.fileName}" has been deleted.`);
      setDeleteDialog({ open: false, invoice: null });
      loadPendingInvoices();
    } catch (err) {
      console.error('Error deleting invoice:', err);
      setError('Failed to delete invoice. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRename = async (invoice, newName) => {
    setProcessingId(invoice.id);
    setError(null);
    setSuccess(null);

    try {
      await supabase.from('Invoice').update({ fileName: newName.trim() }).eq('id', invoice.id);
      setSuccess(`Invoice renamed to "${newName}".`);
      setRenameDialog({ open: false, invoice: null });
      loadPendingInvoices();
    } catch (err) {
      console.error('Error renaming invoice:', err);
      setError('Failed to rename invoice. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleBulkRename = async (renames) => {
    setProcessingId('bulk-rename');
    setError(null);
    setSuccess(null);

    try {
      const promises = Object.entries(renames).map(async ([id, newName]) => {
        const inv = invoices.find(i => i.id === id);
        if (inv && inv.fileName !== newName && newName.trim()) {
          return supabase.from('Invoice').update({ fileName: newName.trim() }).eq('id', id);
        }
        return Promise.resolve();
      });
      await Promise.all(promises);
      
      setSuccess('Invoices renamed successfully.');
      setBulkRenameDialog(false);
      loadPendingInvoices();
    } catch (err) {
      console.error('Error bulk renaming invoices:', err);
      setError('Failed to rename invoices. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  const toggleSelectInvoice = (invoiceId) => {
    const newSelected = new Set(selectedInvoices);
    if (newSelected.has(invoiceId)) {
      newSelected.delete(invoiceId);
    } else {
      newSelected.add(invoiceId);
    }
    setSelectedInvoices(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedInvoices.size === filteredAndSortedInvoices.length) {
      setSelectedInvoices(new Set());
    } else {
      setSelectedInvoices(new Set(filteredAndSortedInvoices.map(inv => inv.id)));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 p-6">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading pending invoices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Pending Invoices</h1>
          <p className="text-gray-600 mt-1">Review and approve contractor invoices</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {filteredAndSortedInvoices.length > 0 && (
            <Button variant="outline" onClick={() => setBulkRenameDialog(true)}>
              <Edit className="w-4 h-4 mr-2" />
              Bulk Rename Filtered
            </Button>
          )}
          {selectedInvoices.size > 0 && (
            <Button
              onClick={() => setBulkApprovalDialog(true)}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Approve Selected ({selectedInvoices.size})
            </Button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {success && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search invoices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Project Filter */}
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {uniqueProjects.map(project => (
                  <SelectItem key={project} value={project}>{project}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* M2 PM Filter */}
            <Select value={m2PmFilter} onValueChange={setM2PmFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All M2 PMs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All M2 PMs</SelectItem>
                {uniqueM2PMs.map(pm => (
                  <SelectItem key={pm} value={pm}>{pm}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Velo PM Filter */}
            <Select value={veloPmFilter} onValueChange={setVeloPmFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Velo PMs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Velo PMs</SelectItem>
                {uniqueVeloPMs.map(pm => (
                  <SelectItem key={pm} value={pm}>{pm}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select value={sortConfig} onValueChange={setSortConfig}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_date_desc">Newest First</SelectItem>
                <SelectItem value="created_date_asc">Oldest First</SelectItem>
                <SelectItem value="contractor_asc">Contractor A-Z</SelectItem>
                <SelectItem value="amount_desc">Highest Amount</SelectItem>
                <SelectItem value="amount_asc">Lowest Amount</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Clear Filters */}
          {(searchTerm || projectFilter !== 'all' || m2PmFilter !== 'all' || veloPmFilter !== 'all') && (
            <div className="mt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setProjectFilter('all');
                  setM2PmFilter('all');
                  setVeloPmFilter('all');
                }}
              >
                Clear All Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>Showing {filteredAndSortedInvoices.length} of {invoices.length} pending invoices</span>
        {filteredAndSortedInvoices.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSelectAll}
          >
            <Checkbox 
              checked={selectedInvoices.size === filteredAndSortedInvoices.length}
              className="mr-2"
            />
            Select All
          </Button>
        )}
      </div>

      {/* Invoice List */}
      {filteredAndSortedInvoices.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {invoices.length === 0 ? 'All caught up!' : 'No matching invoices'}
            </h3>
            <p className="text-gray-600">
              {invoices.length === 0
                ? 'There are no pending invoices to review.'
                : 'Try adjusting your filters to see more results.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredAndSortedInvoices.map((invoice) => {
            const contractorInfo = getContractorInfo(invoice.contractorEmail);
            const isSelected = selectedInvoices.has(invoice.id);

            return (
              <Card key={invoice.id} className={`overflow-hidden transition-all ${isSelected ? 'ring-2 ring-blue-500' : ''}`}>
                <CardHeader className="bg-orange-50 border-b border-orange-100">
                  <div className="flex items-start gap-4">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelectInvoice(invoice.id)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {invoice.contractorName}
                          </CardTitle>
                          <p className="text-sm text-gray-600 mt-1">{invoice.contractorEmail}</p>
                          <p className="text-sm text-gray-600">Project: {contractorInfo.project}</p>
                        </div>
                        <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                          Pending Review
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-6">
                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <FileText className="w-4 h-4 mt-1 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500">File Name</p>
                          <p className="font-medium">{invoice.fileName}</p>
                        </div>
                      </div>

                      {invoice.weekEndingDate && (
                        <div className="flex items-start gap-2">
                          <Calendar className="w-4 h-4 mt-1 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500">Week Ending</p>
                            <p className="font-medium">{format(new Date(invoice.weekEndingDate), 'MMM d, yyyy')}</p>
                          </div>
                        </div>
                      )}

                      {invoice.totalAmount && (
                        <div className="flex items-start gap-2">
                          <DollarSign className="w-4 h-4 mt-1 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500">Amount</p>
                            <p className="font-medium">${invoice.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-start gap-2">
                        <Clock className="w-4 h-4 mt-1 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500">Submitted</p>
                          <p className="font-medium">{formatCentralTime(invoice.created_date)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {invoice.pendingReason && (
                        <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                          <p className="text-xs font-medium text-orange-800 mb-1">Requires Manual Review</p>
                          <p className="text-sm text-orange-700">{invoice.pendingReason}</p>
                        </div>
                      )}

                      {invoice.notes && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-xs font-medium text-blue-800 mb-1">Contractor Notes</p>
                          <p className="text-sm text-blue-700">{invoice.notes}</p>
                        </div>
                      )}

                      <div className="text-sm text-gray-600">
                        <p><strong>M2 PM:</strong> {contractorInfo.m2PM}</p>
                        <p><strong>Velo PM:</strong> {contractorInfo.veloPM}</p>
                        {invoice.daysWorked && (
                          <p><strong>Days Worked:</strong> {invoice.daysWorked}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2 pt-4 border-t">
                    <Button
                      onClick={() => setApprovalDialog({ open: true, invoice })}
                      disabled={processingId === invoice.id}
                      className="bg-green-600 hover:bg-green-700"
                      size="sm"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Approve
                    </Button>

                    <Button
                      onClick={() => setRejectionDialog({ open: true, invoice })}
                      disabled={processingId === invoice.id}
                      variant="outline"
                      className="border-red-200 text-red-600 hover:bg-red-50"
                      size="sm"
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Reject
                    </Button>

                    <Button
                      onClick={() => setRenameDialog({ open: true, invoice })}
                      disabled={processingId === invoice.id}
                      variant="outline"
                      size="sm"
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Rename
                    </Button>

                    <Button
                      onClick={() => setEditNotesDialog({ open: true, invoice })}
                      disabled={processingId === invoice.id}
                      variant="outline"
                      size="sm"
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Edit Notes
                    </Button>

                    <Button
                      onClick={() => setDeleteDialog({ open: true, invoice })}
                      disabled={processingId === invoice.id}
                      variant="outline"
                      className="border-gray-200 text-gray-600 hover:bg-gray-50"
                      size="sm"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>

                    {invoice.fileUrl && (
                      <Button
                        onClick={() => window.open(invoice.driveLink || invoice.fileUrl, '_blank')}
                        variant="outline"
                        size="sm"
                      >
                        <ExternalLink className="w-4 h-4 mr-1" />
                        View File
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      <ApprovalDialog
        open={approvalDialog.open}
        invoice={approvalDialog.invoice}
        onClose={() => setApprovalDialog({ open: false, invoice: null })}
        onConfirm={handleApprove}
        isProcessing={processingId === approvalDialog.invoice?.id}
      />

      <Dialog open={bulkApprovalDialog} onOpenChange={setBulkApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Approve Invoices</DialogTitle>
            <DialogDescription>
              You are about to approve {selectedInvoices.size} invoices. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkApprovalDialog(false)} disabled={processingId === 'bulk'}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkApprove}
              disabled={processingId === 'bulk'}
              className="bg-green-600 hover:bg-green-700"
            >
              {processingId === 'bulk' ? 'Approving...' : `Approve ${selectedInvoices.size} Invoices`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RejectionDialog
        open={rejectionDialog.open}
        invoice={rejectionDialog.invoice}
        onClose={() => setRejectionDialog({ open: false, invoice: null })}
        onConfirm={handleReject}
        isProcessing={processingId === rejectionDialog.invoice?.id}
      />

      <EditNotesDialog
        open={editNotesDialog.open}
        invoice={editNotesDialog.invoice}
        onClose={() => setEditNotesDialog({ open: false, invoice: null })}
        onConfirm={handleEditNotes}
        isProcessing={processingId === editNotesDialog.invoice?.id}
      />

      <DeleteDialog
        open={deleteDialog.open}
        invoice={deleteDialog.invoice}
        onClose={() => setDeleteDialog({ open: false, invoice: null })}
        onConfirm={handleDelete}
        isProcessing={processingId === deleteDialog.invoice?.id}
      />

      <RenameDialog
        open={renameDialog.open}
        invoice={renameDialog.invoice}
        onClose={() => setRenameDialog({ open: false, invoice: null })}
        onConfirm={handleRename}
        isProcessing={processingId === renameDialog.invoice?.id}
      />

      <BulkRenameDialog
        open={bulkRenameDialog}
        invoices={filteredAndSortedInvoices}
        onClose={() => setBulkRenameDialog(false)}
        onSave={handleBulkRename}
        isProcessing={processingId === 'bulk-rename'}
      />
    </div>
  );
}