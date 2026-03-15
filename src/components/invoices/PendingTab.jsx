import React, { useState, useEffect, useMemo } from 'react';
import { sendToWebhook, updatePaymentLedger } from '@/functions.js';
import { Invoice, User, AutomationSetting } from '@/api/entities.js';
import { supabase } from '@/lib/supabaseClient.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Input } from '@/components/ui/input.jsx';
import {
  CheckCircle,
  XCircle,
  FileText,
  Calendar,
  User as UserIcon,
  DollarSign,
  Clock,
  ExternalLink,
  Search,
  AlertCircle,
  MessageSquare,
  Edit
} from 'lucide-react';

// Helper to format date in Central Time
const formatDateCT = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    return new Date(dateString).toLocaleDateString();
  }
};

const formatDateOnlyCT = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      timeZone: 'America/Chicago',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch (e) {
    return new Date(dateString).toLocaleDateString();
  }
};
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { Label } from '@/components/ui/label.jsx';

export default function PendingTab() {
  const [invoices, setInvoices] = useState([]);
  const [recentlyApproved, setRecentlyApproved] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  // Filter and sort states
  const [searchTerm, setSearchTerm] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [m2PmFilter, setM2PmFilter] = useState('all');
  const [veloPmFilter, setVeloPmFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState('created_date_desc');

  // Dialog states
  const [approvalDialog, setApprovalDialog] = useState({ open: false, invoice: null });
  const [rejectionDialog, setRejectionDialog] = useState({ open: false, invoice: null });
  const [editNotesDialog, setEditNotesDialog] = useState({ open: false, invoice: null });
  const [renameDialog, setRenameDialog] = useState({ open: false, invoice: null });
  const [bulkRenameDialog, setBulkRenameDialog] = useState(false);

  useEffect(() => {
    loadPendingInvoices();
  }, []);

  const loadPendingInvoices = async () => {
    try {
      const [pendingInvoices, approvedInvoices, contractorData] = await Promise.all([
        Invoice.filter({ status: 'pending' }, '-created_date'),
        Invoice.filter({ status: 'approved' }, '-approvedDate', 10),
        User.list()
      ]);

      setInvoices(pendingInvoices);
      setRecentlyApproved(approvedInvoices);
      setContractors(contractorData);
    } catch (error) {
      console.error('Error loading invoices:', error);
      setError('Failed to load invoices');
    } finally {
      setIsLoading(false);
    }
  };

  const projects = useMemo(() => {
    try {
      if (!Array.isArray(contractors)) return ['all'];
      const projectList = contractors
        .map(u => u && u.project ? String(u.project) : null)
        .filter(p => p && p.trim() !== '');
      return ['all', ...new Set(projectList)].sort();
    } catch (err) {
      return ['all'];
    }
  }, [contractors]);

  const m2Pms = useMemo(() => {
    try {
      if (!Array.isArray(contractors)) return ['all'];
      const pmList = contractors
        .map(u => u && u.m2PM ? String(u.m2PM) : null)
        .filter(p => p && p.trim() !== '');
      return ['all', ...new Set(pmList)].sort();
    } catch (err) {
      return ['all'];
    }
  }, [contractors]);

  const veloPms = useMemo(() => {
    try {
      if (!Array.isArray(contractors)) return ['all'];
      const pmList = contractors
        .map(u => u && u.veloPM ? String(u.veloPM) : null)
        .filter(p => p && p.trim() !== '');
      return ['all', ...new Set(pmList)].sort();
    } catch (err) {
      return ['all'];
    }
  }, [contractors]);

  const filteredInvoices = useMemo(() => {
    const getContractorInfo = (invoice) => {
      return contractors.find(c => c.email === invoice.contractorEmail) || {};
    };

    let filtered = invoices.filter(invoice => {
      const contractor = getContractorInfo(invoice);

      const searchMatch = invoice.contractorName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          invoice.fileName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          contractor.business?.toLowerCase().includes(searchTerm.toLowerCase());

      const userProject = contractor.project ? String(contractor.project) : '';
      const userM2PM = contractor.m2PM ? String(contractor.m2PM) : '';
      const userVeloPM = contractor.veloPM ? String(contractor.veloPM) : '';

      const projectMatch = projectFilter === 'all' || userProject === projectFilter;
      const m2PmMatch = m2PmFilter === 'all' || userM2PM === m2PmFilter;
      const veloPmMatch = veloPmFilter === 'all' || userVeloPM === veloPmFilter;

      return searchMatch && projectMatch && m2PmMatch && veloPmMatch;
    });

    const [key, direction] = sortConfig.split('_');
    filtered.sort((a, b) => {
      let valA, valB;

      if (key === 'contractorName') {
        valA = a.contractorName || '';
        valB = b.contractorName || '';
      } else if (key === 'project' || key === 'm2PM' || key === 'veloPM') {
        const contractorA = getContractorInfo(a);
        const contractorB = getContractorInfo(b);
        valA = contractorA[key] || '';
        valB = contractorB[key] || '';
      } else if (key === 'created_date') {
        valA = new Date(a.created_date).getTime();
        valB = new Date(b.created_date).getTime();
      } else {
        valA = a[key] || '';
        valB = b[key] || '';
      }

      let comparison = 0;
      if (key === 'created_date') {
        comparison = valA - valB;
      } else {
        comparison = valA.toString().localeCompare(valB.toString());
      }

      return direction === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [invoices, contractors, searchTerm, projectFilter, m2PmFilter, veloPmFilter, sortConfig]);

  const getContractorInfo = (invoice) => {
    return contractors.find(c => c.email === invoice.contractorEmail) || {};
  };

  const handleApprove = (invoice) => {
    setApprovalDialog({ open: true, invoice });
  };

  const confirmApproval = async (invoice, approvalNotes) => {
    setProcessingId(invoice.id);
    setError(null);

    try {
      const approvedDate = new Date().toISOString();
      const approvedBy = 'system';

      const invoiceUpdateData = {
        status: 'approved',
        approvedDate: approvedDate,
        approvedBy: approvedBy,
        approvalNotes: approvalNotes || null
      };

      await Invoice.update(invoice.id, invoiceUpdateData);

      const contractor = contractors.find(c => c.email === invoice.contractorEmail);
      if (contractor?.needsInvoiceReview) {
        await User.update(contractor.id, {
          needsInvoiceReview: false,
          invoiceReviewReason: null
        });
      }

      const updatedInvoice = { ...invoice, ...invoiceUpdateData };

      try {
        const settings = await AutomationSetting.filter({ key: 'invoiceApprovedWebhookUrl' });
        if (settings.length > 0 && settings[0].value) {
          const webhookUrl = settings[0].value;
          const payload = {
            fileName: updatedInvoice.fileName,
            fileUrl: updatedInvoice.fileUrl,
            contractorName: updatedInvoice.contractorName,
            businessName: contractor?.business || '',
            approvedDate: updatedInvoice.approvedDate,
            totalAmount: updatedInvoice.totalAmount,
            weekEndingDate: updatedInvoice.weekEndingDate,
          };
          sendToWebhook({ webhookUrl, payload });
        }
      } catch (webhookError) {
        console.error("Failed to send webhook:", webhookError);
      }

      await updatePaymentLedger({ invoice: updatedInvoice });

      setSuccess('Invoice approved and ledger updated.');
      setApprovalDialog({ open: false, invoice: null });
      loadPendingInvoices();
    } catch (error) {
      console.error('Error approving invoice:', error);
      setError('Failed to approve invoice');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = (invoice) => {
    setRejectionDialog({ open: true, invoice });
  };

  const confirmRejection = async (invoice, reason, placeOnHold) => {
    if (!reason.trim()) {
      setError("Rejection reason cannot be empty.");
      return;
    }
    setProcessingId(invoice.id);
    setError(null);

    try {
      await Invoice.update(invoice.id, {
        status: 'rejected',
        rejectionReason: reason,
        approvedDate: new Date().toISOString()
      });

      if (placeOnHold) {
        const contractor = contractors.find(c => c.email === invoice.contractorEmail);
        if (contractor) {
          await User.update(contractor.id, {
            needsInvoiceReview: true,
            invoiceReviewReason: `Invoice rejected: ${reason}`
          });
        }
      }

      setSuccess('Invoice rejected successfully.');
      setRejectionDialog({ open: false, invoice: null });
      loadPendingInvoices();
    } catch (error) {
      console.error('Error rejecting invoice:', error);
      setError('Failed to reject invoice');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRename = async (invoice, newName) => {
    setProcessingId(invoice.id);
    try {
      await Invoice.update(invoice.id, { fileName: newName });
      setSuccess('Invoice renamed successfully.');
      setRenameDialog({ open: false, invoice: null });
      loadPendingInvoices();
    } catch (error) {
      console.error('Error renaming invoice:', error);
      setError('Failed to rename invoice');
    } finally {
      setProcessingId(null);
    }
  };

  const handleBulkRename = async (renames) => {
    setProcessingId('bulk-rename');
    try {
      const promises = Object.entries(renames).map(([id, newName]) => {
        const inv = invoices.find(i => i.id === id);
        if (inv && inv.fileName !== newName && newName.trim()) {
          return Invoice.update(id, { fileName: newName.trim() });
        }
        return Promise.resolve();
      });
      await Promise.all(promises);
      setSuccess('Invoices renamed successfully.');
      setBulkRenameDialog(false);
      loadPendingInvoices();
    } catch (error) {
      console.error('Error bulk renaming invoices:', error);
      setError('Failed to rename invoices');
    } finally {
      setProcessingId(null);
    }
  };

  const handleUpdatePendingReason = async (invoice, newReason) => {
    setProcessingId(invoice.id);
    try {
      await Invoice.update(invoice.id, {
        pendingReason: newReason || null
      });
      setSuccess('Manual review notes updated successfully.');
      setEditNotesDialog({ open: false, invoice: null });
      await loadPendingInvoices();
    } catch (error) {
      console.error('Failed to update pending reason:', error);
      setError('Failed to update notes.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleUnapprove = async (invoice) => {
    setProcessingId(invoice.id);
    setError(null);

    try {
      const reason = prompt('Please provide a reason for unapproving this invoice:');
      if (!reason) {
        setProcessingId(null);
        return;
      }

      await Invoice.update(invoice.id, {
        status: 'pending',
        pendingReason: `Unapproved: ${reason}`,
        approvedDate: null,
        approvedBy: null
      });

      setSuccess('Invoice has been unapproved and moved back to pending status.');
      loadPendingInvoices();
    } catch (error) {
      console.error('Error unapproving invoice:', error);
      setError('Failed to unapprove invoice');
    } finally {
      setProcessingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded w-64"></div>
        {Array(5).fill(0).map((_, i) => (
          <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters and Search */}
      <div className="flex justify-end mb-2">
        <Button variant="outline" onClick={() => setBulkRenameDialog(true)} disabled={filteredInvoices.length === 0}>
          <Edit className="w-4 h-4 mr-2" />
          Bulk Rename Filtered
        </Button>
      </div>
      <div className="bg-white p-4 rounded-lg shadow-sm border flex flex-col lg:flex-row gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search by contractor, filename, or business..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="w-full lg:w-auto lg:min-w-[180px]">
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger><SelectValue placeholder="Filter by project" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.filter(p => p !== 'all').map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full lg:w-auto lg:min-w-[180px]">
          <Select value={m2PmFilter} onValueChange={setM2PmFilter}>
            <SelectTrigger><SelectValue placeholder="Filter by M2 PM" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All M2 PMs</SelectItem>
              {m2Pms.filter(p => p !== 'all').map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full lg:w-auto lg:min-w-[180px]">
          <Select value={veloPmFilter} onValueChange={setVeloPmFilter}>
            <SelectTrigger><SelectValue placeholder="Filter by Velo PM" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Velo PMs</SelectItem>
              {veloPms.filter(p => p !== 'all').map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full lg:w-auto lg:min-w-[180px]">
          <Select value={sortConfig} onValueChange={setSortConfig}>
            <SelectTrigger><SelectValue placeholder="Sort by..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="created_date_desc">Date Submitted (Newest)</SelectItem>
              <SelectItem value="created_date_asc">Date Submitted (Oldest)</SelectItem>
              <SelectItem value="contractorName_asc">Contractor Name (A-Z)</SelectItem>
              <SelectItem value="contractorName_desc">Contractor Name (Z-A)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Pending Invoices List */}
      {filteredInvoices.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">All caught up!</h3>
            <p className="text-gray-600">
              {invoices.length === 0
                ? 'There are no pending invoices to review.'
                : 'No invoices match your current filters.'
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {filteredInvoices.map((invoice) => {
            const contractor = getContractorInfo(invoice);
            return (
              <Card key={invoice.id} className="overflow-hidden">
                <CardHeader className="bg-orange-50 border-b border-orange-100">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div>
                      <CardTitle className="flex items-center space-x-2">
                        <UserIcon className="w-5 h-5 text-gray-600" />
                        <span>{invoice.contractorName}</span>
                      </CardTitle>
                      <p className="text-sm text-gray-600 mt-1">{invoice.contractorEmail}</p>
                      {contractor.project && (
                        <p className="text-sm text-gray-600">Project: {contractor.project}</p>
                      )}
                    </div>
                    <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                      <Clock className="w-3 h-3 mr-1" />
                      Pending Review
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-6">
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="flex items-center space-x-2">
                      <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-500">File Name</p>
                        <p className="font-medium text-gray-900 break-all">{invoice.fileName}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-500">Week Ending</p>
                        <p className="font-medium text-gray-900">
                          {invoice.weekEndingDate
                            ? formatDateOnlyCT(invoice.weekEndingDate)
                            : 'Not specified'
                          }
                        </p>
                      </div>
                    </div>

                    {invoice.totalAmount && (
                      <div className="flex items-center space-x-2">
                        <DollarSign className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-gray-500">Amount</p>
                          <p className="font-medium text-gray-900">${invoice.totalAmount}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-500">Submitted</p>
                        <p className="font-medium text-gray-900">
                          {formatDateOnlyCT(invoice.created_date)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Pending Reason */}
                  {invoice.pendingReason && (
                    <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-orange-800">Requires Manual Review</p>
                            <p className="text-sm text-orange-700 mt-1">{invoice.pendingReason}</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-orange-700 hover:bg-orange-100"
                          onClick={() => setEditNotesDialog({ open: true, invoice })}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Contractor Notes */}
                  {invoice.notes && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <MessageSquare className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-blue-800">Contractor Notes</p>
                          <p className="text-sm text-blue-700 mt-1 whitespace-pre-wrap">{invoice.notes}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Project Manager Info */}
                  {(contractor.m2PM || contractor.veloPM) && (
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                      <div className="grid sm:grid-cols-2 gap-4 text-sm">
                        {contractor.m2PM && (
                          <div>
                            <span className="text-gray-600">M2 PM:</span>
                            <span className="font-medium text-gray-900 ml-2">{contractor.m2PM}</span>
                          </div>
                        )}
                        {contractor.veloPM && (
                          <div>
                            <span className="text-gray-600">Velo PM:</span>
                            <span className="font-medium text-gray-900 ml-2">{contractor.veloPM}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 w-full">
                    <div className="flex flex-wrap gap-3">
                      <Button
                        onClick={() => handleApprove(invoice)}
                        disabled={processingId === invoice.id}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        {processingId === invoice.id ? 'Processing...' : 'Approve'}
                      </Button>

                      <Button
                        variant="outline"
                        onClick={() => handleReject(invoice)}
                        disabled={processingId === invoice.id}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRenameDialog({ open: true, invoice })}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Rename
                      </Button>
                      {invoice.fileUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(invoice.driveLink || invoice.fileUrl, '_blank')}
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          View File
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Recently Approved Section */}
      {recentlyApproved.length > 0 && (
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Recently Approved Invoices</h2>
          <p className="text-gray-600 mb-6">Need to correct a mistake? You can unapprove recently approved invoices.</p>

          <div className="grid gap-4">
            {recentlyApproved.map((invoice) => {
              const contractor = getContractorInfo(invoice);
              return (
                <Card key={`approved-${invoice.id}`} className="overflow-hidden border-green-200">
                  <CardHeader className="bg-green-50 border-b border-green-100">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                      <div>
                        <CardTitle className="flex items-center space-x-2">
                          <UserIcon className="w-5 h-5 text-gray-600" />
                          <span>{invoice.contractorName}</span>
                        </CardTitle>
                        <p className="text-sm text-gray-600 mt-1">{invoice.contractorEmail}</p>
                        {contractor.project && (
                          <p className="text-sm text-gray-600">Project: {contractor.project}</p>
                        )}
                      </div>
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Approved
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="p-6">
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-500">File Name</p>
                          <p className="font-medium text-gray-900">{invoice.fileName}</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-500">Approved Date</p>
                          <p className="font-medium text-gray-900">
                            {invoice.approvedDate
                              ? formatDateCT(invoice.approvedDate)
                              : 'N/A'
                            }
                          </p>
                        </div>
                      </div>

                      {invoice.totalAmount && (
                        <div className="flex items-center space-x-2">
                          <DollarSign className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-sm text-gray-500">Amount</p>
                            <p className="font-medium text-gray-900">${invoice.totalAmount}</p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-500">Originally Submitted</p>
                          <p className="font-medium text-gray-900">
                            {formatDateOnlyCT(invoice.created_date)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="flex space-x-3">
                        <Button
                          variant="outline"
                          onClick={() => handleUnapprove(invoice)}
                          disabled={processingId === invoice.id}
                          className="text-orange-600 border-orange-200 hover:bg-orange-50"
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          {processingId === invoice.id ? 'Processing...' : 'Unapprove'}
                        </Button>
                      </div>

                      {invoice.fileUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(invoice.driveLink || invoice.fileUrl, '_blank')}
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          View File
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Dialogs */}
      <EditNotesDialog
        open={editNotesDialog.open}
        invoice={editNotesDialog.invoice}
        onClose={() => setEditNotesDialog({ open: false, invoice: null })}
        onConfirm={handleUpdatePendingReason}
        isProcessing={processingId === editNotesDialog.invoice?.id}
      />

      <ApprovalDialog
        open={approvalDialog.open}
        invoice={approvalDialog.invoice}
        onClose={() => setApprovalDialog({ open: false, invoice: null })}
        onConfirm={confirmApproval}
        isProcessing={processingId === approvalDialog.invoice?.id}
      />

      <RejectionDialog
        open={rejectionDialog.open}
        invoice={rejectionDialog.invoice}
        onClose={() => setRejectionDialog({ open: false, invoice: null })}
        onConfirm={confirmRejection}
        isProcessing={processingId === rejectionDialog.invoice?.id}
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
        invoices={filteredInvoices}
        onClose={() => setBulkRenameDialog(false)}
        onSave={handleBulkRename}
        isProcessing={processingId === 'bulk-rename'}
      />
    </div>
  );
}

// Helper Dialog Components
function EditNotesDialog({ open, invoice, onClose, onConfirm, isProcessing }) {
  const [notes, setNotes] = React.useState('');

  React.useEffect(() => {
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
            <Label htmlFor="editPendingReason">Notes</Label>
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

function ApprovalDialog({ open, invoice, onClose, onConfirm, isProcessing }) {
  const [approvalNotes, setApprovalNotes] = React.useState('');

  React.useEffect(() => {
    if (open) {
      setApprovalNotes('');
    }
  }, [open]);

  const handleSubmit = () => {
    onConfirm(invoice, approvalNotes);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve Invoice</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Approving "{invoice?.fileName}" for {invoice?.contractorName}
          </p>
          <div>
            <Label htmlFor="approval-notes" className="text-sm font-medium text-gray-700">
              Approval Notes (Optional):
            </Label>
            <Textarea
              id="approval-notes"
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              placeholder="Add any notes about this approval..."
              className="mt-1"
              rows={4}
            />
          </div>
          <div className="flex justify-end space-x-3">
            <Button variant="outline" onClick={onClose} disabled={isProcessing}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isProcessing}
              className="bg-green-600 hover:bg-green-700"
            >
              {isProcessing ? 'Processing...' : 'Approve Invoice'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RejectionDialog({ open, invoice, onClose, onConfirm, isProcessing }) {
  const [reason, setReason] = React.useState('');
  const [placeOnHold, setPlaceOnHold] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setReason('');
      setPlaceOnHold(false);
    }
  }, [open]);

  const handleSubmit = () => {
    onConfirm(invoice, reason, placeOnHold);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject Invoice</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Rejecting "{invoice?.fileName}" for {invoice?.contractorName}
          </p>
          <div>
            <Label htmlFor="rejection-reason">Reason for Rejection *</Label>
            <Textarea
              id="rejection-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide a clear reason for the rejection..."
              className="mt-1"
              rows={4}
            />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="place-on-hold"
              checked={placeOnHold}
              onCheckedChange={setPlaceOnHold}
            />
            <Label htmlFor="place-on-hold" className="text-sm font-medium leading-none">
              Require manual review of next invoice
            </Label>
          </div>
          <div className="flex justify-end space-x-3">
            <Button variant="outline" onClick={onClose} disabled={isProcessing}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isProcessing || !reason.trim()}
              variant="destructive"
            >
              {isProcessing ? 'Processing...' : 'Reject Invoice'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RenameDialog({ open, invoice, onClose, onConfirm, isProcessing }) {
  const [fileName, setFileName] = React.useState('');

  React.useEffect(() => {
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
  const [renames, setRenames] = React.useState({});

  React.useEffect(() => {
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
                <span className="text-gray-500">{formatDateOnlyCT(inv.created_date)}</span>
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