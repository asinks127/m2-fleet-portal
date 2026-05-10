import React, { useState, useEffect } from 'react';
import { User, Invoice, PaymentLedger } from '@/api/entities.js';
import { Card, CardContent } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import { Label } from '@/components/ui/label.jsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog.jsx';
import {
  CheckCircle,
  XCircle,
  Search,
  FileText,
  Eye,
  Phone,
  MapPin,
  Mail,
  Edit,
  Plus,
  ChevronDown,
  Receipt,
  CreditCard,
  Loader2,
  Upload, // New import
  ExternalLink, // New import
  X // New import for toast close
} from 'lucide-react';
import { format } from 'date-fns';

// New Imports
import UploadInvoiceDialog from '../components/invoices/UploadInvoiceDialog';
import EditInvoiceDialog from '../components/invoices/EditInvoiceDialog';
import ExportReportDialog from '../components/invoices/ExportReportDialog';
import { supabase } from '@/lib/supabaseClient.js';

const DEMO_CURRENT_USER = {
  id: '22222222-2222-4222-8222-222222222222',
  email: 'pm.west@m2fleetcom.com',
  user_metadata: { full_name: 'Casey Walker', role: 'pm' }
};

export default function ContractorAccounting() {
  const [contractors, setContractors] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [selectedContractor, setSelectedContractor] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('transactions');
  const [isLoading, setIsLoading] = useState(true);

  // Transaction filters (QB-style)
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [transactionSearch, setTransactionSearch] = useState('');

  // Payment dialog states
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('check');
  const [paymentReference, setPaymentReference] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Invoice detail dialog states
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceDialogSuccessMessage, setInvoiceDialogSuccessMessage] = useState(null);
  const [invoiceDialogErrorMessage, setInvoiceDialogErrorMessage] = useState(null);

  // Added state for editing week ending date and general processing indicator
  const [editDateDialog, setEditDateDialog] = useState({ open: false, invoice: null });
  const [newWeekEndingDate, setNewWeekEndingDate] = useState('');
  const [processingId, setProcessingId] = useState(null); // Used for indicating ongoing operations on specific items

  // New states for Upload and Edit Invoice Dialogs
  const [uploadDialog, setUploadDialog] = useState({ open: false, contractor: null });
  const [editDialog, setEditDialog] = useState({ open: false, invoice: null });
  const [exportDialog, setExportDialog] = useState({ open: false, contractor: null });
  const [toastMessage, setToastMessage] = useState({ type: '', message: '' }); // For general page success/error toasts
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    supabase.auth.getUser()
      .then(({ data }) => setCurrentUser(data?.user || DEMO_CURRENT_USER))
      .catch(() => setCurrentUser(DEMO_CURRENT_USER));
    loadData();
  }, []);

  const loadData = async () => {
    setToastMessage({ type: '', message: '' }); // Clear any existing toast messages on data load
    try {
      const [userData, invoiceData] = await Promise.all([
        User.list(),
        Invoice.list('-created_at', 1000)
      ]);
      setContractors(userData);
      setInvoices(invoiceData);
      setInvoiceDialogSuccessMessage(null); // Clear messages on data reload
      setInvoiceDialogErrorMessage(null);
    } catch (error) {
      console.error('Error loading data:', error);
      setToastMessage({ type: 'error', message: 'Failed to load data.' });
    } finally {
      setIsLoading(false);
    }
  };

  // Filter contractors
  const activeContractors = contractors
    .filter(user => {
      const email = user.email?.toLowerCase() || '';
      const isContractor = email.includes('.contractor@m2fleetcom.com') || 
                          email.includes('.contractor@smcinstallations.com');
      if (!isContractor || user.active === false) return false;

      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const name = (user.displayName || user.full_name || '').toLowerCase();
        const business = (user.business || '').toLowerCase();
        return name.includes(search) || email.includes(search) || business.includes(search);
      }

      return true;
    })
    .sort((a, b) => {
      const nameA = a.displayName || a.full_name || a.email || '';
      const nameB = b.displayName || b.full_name || b.email || '';
      return nameA.localeCompare(nameB);
    });

  // Calculate financial summary
  const financialSummary = selectedContractor ? {
    openBalance: invoices
      .filter(inv => 
        inv.contractorEmail === selectedContractor.email && 
        inv.status === 'approved' && 
        inv.paymentStatus !== 'paid'
      )
      .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0),
    overdue: invoices
      .filter(inv => {
        if (inv.contractorEmail !== selectedContractor.email) return false;
        if (inv.status !== 'approved' || inv.paymentStatus === 'paid') return false;
        if (!inv.weekEndingDate) return false;
        const dueDate = new Date(inv.weekEndingDate);
        dueDate.setDate(dueDate.getDate() + 14); // Due 14 days after week ending
        return dueDate < new Date();
      })
      .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0),
    totalPaid: invoices
      .filter(inv => 
        inv.contractorEmail === selectedContractor.email && 
        inv.paymentStatus === 'paid'
      )
      .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0)
  } : null;

  // Get filtered transactions
  const transactions = selectedContractor
    ? invoices
        .filter(inv => {
          if (inv.contractorEmail !== selectedContractor.email) return false;
          
          // Type filter
          if (typeFilter !== 'all') {
            if (typeFilter === 'invoices') {
              // All invoices are returned for this type filter
            } else if (typeFilter === 'pending' && inv.status !== 'pending') {
              return false; // Only show invoices with status 'pending' (pending review)
            }
          }
          
          // Status filter
          if (statusFilter !== 'all') {
            if (statusFilter === 'pending') { // Corresponds to 'Open' status in UI
              if (inv.status !== 'approved' || inv.paymentStatus === 'paid') return false;
            } else if (statusFilter === 'approved') { // Corresponds to 'Paid' status in UI
              if (inv.paymentStatus !== 'paid') return false;
            } else if (statusFilter === 'rejected') { // Corresponds to 'Voided' status in UI
              if (inv.status !== 'rejected') return false;
            }
          }
          
          if (transactionSearch) {
            const search = transactionSearch.toLowerCase();
            const fileName = (inv.fileName || '').toLowerCase();
            const notes = (inv.notes || '').toLowerCase();
            if (!fileName.includes(search) && !notes.includes(search)) return false;
          }
          
          return true;
        })
        .sort((a, b) => new Date(b.created_at || b.created_date || 0) - new Date(a.created_at || a.created_date || 0))
    : [];

  const getStatusBadge = (invoice) => {
    // First check payment status
    if (invoice.paymentStatus === 'paid') {
      return <Badge className="bg-green-100 text-green-800">Paid</Badge>;
    }
    
    // Then check approval status
    if (invoice.status === 'approved') {
      // Approved but not paid = Open
      if (invoice.weekEndingDate) {
        const dueDate = new Date(invoice.weekEndingDate);
        dueDate.setDate(dueDate.getDate() + 14); // Due 14 days after week ending
        if (dueDate < new Date()) {
          return <Badge className="bg-red-100 text-red-800">Overdue</Badge>;
        }
      }
      return <Badge className="bg-orange-100 text-orange-800">Open</Badge>;
    }
    
    if (invoice.status === 'pending') {
      return <Badge className="bg-blue-100 text-blue-800">Pending Review</Badge>;
    }
    
    if (invoice.status === 'rejected') {
      return <Badge className="bg-gray-100 text-gray-800">Voided</Badge>;
    }
    
    return <Badge variant="outline">Draft</Badge>;
  };

  const handleReceivePayment = (invoice) => {
    setSelectedInvoiceForPayment(invoice);
    setPaymentAmount((invoice.totalAmount || 0).toString());
    setShowPaymentDialog(true);
  };

  const processPayment = async () => {
    if (!selectedInvoiceForPayment || !paymentAmount) return;
    
    setIsProcessingPayment(true);
    try {
      const numericAmount = Number(paymentAmount || 0);
      await Invoice.update(selectedInvoiceForPayment.id, {
        paymentStatus: 'paid',
        paymentDate: paymentDate,
        paymentMethod: paymentMethod,
        paymentReference: paymentReference,
        approvalNotes: `${selectedInvoiceForPayment.approvalNotes || ''}\nPayment recorded: ${paymentMethod} ${paymentReference ? `#${paymentReference}` : ''} on ${paymentDate}`.trim()
      });

      await PaymentLedger.create({
        invoiceId: selectedInvoiceForPayment.id,
        contractorEmail: selectedInvoiceForPayment.contractorEmail,
        contractorName: selectedInvoiceForPayment.contractorName,
        amount: numericAmount,
        paymentDate,
        paymentMethod,
        paymentReference,
        status: 'paid',
        notes: `Recorded by ${currentUser?.email || 'demo-user'}`
      });

      await loadData();
      
      setShowPaymentDialog(false);
      setSelectedInvoiceForPayment(null);
      setPaymentAmount('');
      setPaymentReference('');
      setToastMessage({ type: 'success', message: `Payment recorded for invoice #${selectedInvoiceForPayment.id.slice(-6)}.` });
    } catch (error) {
      console.error('Error processing payment:', error);
      setToastMessage({ type: 'error', message: 'Failed to process payment.' });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const viewInvoiceDetails = (invoice) => {
    setSelectedInvoice(invoice);
    setInvoiceDialogSuccessMessage(null); // Clear any previous messages
    setInvoiceDialogErrorMessage(null);
    setShowInvoiceDialog(true);
  };

  const handleUpdateWeekEndingDate = async (invoice, newDate) => {
    if (!invoice || !newDate) return;

    setProcessingId(invoice.id);
    setInvoiceDialogSuccessMessage(null);
    setInvoiceDialogErrorMessage(null);
    try {
      await Invoice.update(invoice.id, {
        weekEndingDate: newDate
      });
      setInvoiceDialogSuccessMessage('Week ending date updated successfully.');
      setEditDateDialog({ open: false, invoice: null });
      setNewWeekEndingDate('');
      await loadData(); // Reload data to reflect the change
      setToastMessage({ type: 'success', message: 'Week ending date updated successfully.' });
    } catch (error) {
      console.error('Error updating week ending date:', error);
      setInvoiceDialogErrorMessage('Failed to update week ending date.');
      setToastMessage({ type: 'error', message: 'Failed to update week ending date.' });
    } finally {
      setProcessingId(null);
    }
  };

  // Handler for clearing notes
  const handleClearNotes = async (invoice) => {
    if (!confirm(`Clear all notes for invoice #${invoice.id.slice(-6)}? This action cannot be undone.`)) {
      return;
    }

    setProcessingId(invoice.id);
    setInvoiceDialogSuccessMessage(null);
    setInvoiceDialogErrorMessage(null);
    try {
      await Invoice.update(invoice.id, {
        notes: null
      });
      setInvoiceDialogSuccessMessage('Notes cleared successfully.');
      await loadData(); // Reload data to reflect changes
      setToastMessage({ type: 'success', message: 'Notes cleared successfully.' });
    } catch (error) {
      console.error('Error clearing notes:', error);
      setInvoiceDialogErrorMessage('Failed to clear notes.');
      setToastMessage({ type: 'error', message: 'Failed to clear notes. Please try again.' });
    } finally {
      setProcessingId(null);
    }
  };

  // Handlers for Upload/Edit Invoice Dialogs
  const handleUploadSuccess = (message) => {
    loadData();
    setUploadDialog({ open: false, contractor: null });
    setToastMessage({ type: 'success', message: message || 'Invoice uploaded successfully.' });
    // Auto-hide toast after 5 seconds
    setTimeout(() => setToastMessage({ type: '', message: '' }), 5000);
  };

  const handleEditSuccess = (message) => {
    loadData();
    setEditDialog({ open: false, invoice: null });
    setToastMessage({ type: 'success', message: message || 'Invoice updated successfully.' });
    // If the invoice being edited was also open in the detail dialog, close it to avoid stale data
    if (selectedInvoice && editDialog.invoice && selectedInvoice.id === editDialog.invoice.id) {
        setShowInvoiceDialog(false); 
    }
    // Auto-hide toast after 5 seconds
    setTimeout(() => setToastMessage({ type: '', message: '' }), 5000);
  };

  const handleApproveInvoice = async (invoice) => {
    if (!currentUser) {
        setToastMessage({ type: 'error', message: 'User session not found. Please refresh.' });
        return;
    }

    if (!confirm(`Are you sure you want to approve invoice #${invoice.id.slice(-6)} for $${(invoice.totalAmount || 0).toLocaleString()}?`)) {
        return;
    }

    setProcessingId(invoice.id);
    try {
        await Invoice.update(invoice.id, {
            status: 'approved',
            approvedBy: currentUser.email,
            approvedDate: new Date().toISOString(),
            approvalNotes: 'Approved via Contractor Accounting'
        });
        setToastMessage({ type: 'success', message: 'Invoice approved successfully.' });
        await loadData();
    } catch (error) {
        console.error('Error approving invoice:', error);
        setToastMessage({ type: 'error', message: 'Failed to approve invoice.' });
    } finally {
        setProcessingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar (QB-style) */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <h1 className="text-xl font-semibold">Contractor Accounting</h1>
              <div className="relative max-w-md flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search contractors..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            {selectedContractor && (
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setExportDialog({ open: true, contractor: selectedContractor })}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Report
                </Button>
                <Button variant="outline" size="sm">
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Contractor
                </Button>
                <Button 
                  size="sm" 
                  onClick={() => setUploadDialog({ open: true, contractor: selectedContractor })} 
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Invoice
                </Button>
                <Button size="sm" className="bg-green-600 hover:bg-green-700">
                  <Plus className="w-4 h-4 mr-2" />
                  New transaction
                  <ChevronDown className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Left Sidebar - Contractor List */}
        <div className="w-80 bg-white border-r h-[calc(100vh-73px)] overflow-y-auto">
          <div className="p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Active Contractors</h2>
            <div className="space-y-1">
              {isLoading ? (
                <p className="text-sm text-gray-500 py-4 text-center">Loading...</p>
              ) : activeContractors.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">No contractors found</p>
              ) : (
                activeContractors.map(contractor => {
                  const isSelected = selectedContractor?.id === contractor.id;
                  const contractorInvoices = invoices.filter(inv => inv.contractorEmail === contractor.email);
                  const pendingCount = contractorInvoices.filter(inv => inv.status === 'pending').length;

                  return (
                    <button
                      key={contractor.id}
                      onClick={() => setSelectedContractor(contractor)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                        isSelected 
                          ? 'bg-blue-50 text-blue-900 font-medium' 
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">
                            {contractor.displayName || contractor.full_name || contractor.email}
                          </p>
                          {contractor.business && (
                            <p className="text-xs text-gray-500 truncate mt-0.5">
                              {contractor.business}
                            </p>
                          )}
                        </div>
                        {pendingCount > 0 && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            {pendingCount}
                          </Badge>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto h-[calc(100vh-73px)]">
          {!selectedContractor ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg text-gray-600">Select a contractor to view details</p>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* Contractor Header Card (QB-style) */}
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    {/* Left Side - Contractor Info */}
                    <div className="flex gap-4">
                      {/* Avatar */}
                      <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl font-semibold">
                        {(selectedContractor.displayName || selectedContractor.full_name || 'C')[0].toUpperCase()}
                      </div>
                      
                      {/* Details */}
                      <div className="space-y-3">
                        <div>
                          <h2 className="text-2xl font-semibold">
                            {selectedContractor.displayName || selectedContractor.full_name}
                          </h2>
                          {selectedContractor.business && (
                            <p className="text-gray-600">{selectedContractor.business}</p>
                          )}
                        </div>

                        {/* Contact Icons */}
                        <div className="flex gap-4 text-sm">
                          {selectedContractor.email && (
                            <a 
                              href={`mailto:${selectedContractor.email}`}
                              className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
                            >
                              <Mail className="w-4 h-4" />
                              {selectedContractor.email}
                            </a>
                          )}
                          {selectedContractor.phone && (
                            <div className="flex items-center gap-1 text-gray-600">
                              <Phone className="w-4 h-4" />
                              {selectedContractor.phone}
                            </div>
                          )}
                          {selectedContractor.location && (
                            <div className="flex items-center gap-1 text-gray-600">
                              <MapPin className="w-4 h-4" />
                              {selectedContractor.location}
                            </div>
                          )}
                        </div>

                        {/* Addresses */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500 text-xs uppercase font-medium mb-1">Billing Address</p>
                            <p className="text-gray-700">{selectedContractor.location || 'Not set'}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 text-xs uppercase font-medium mb-1">Project</p>
                            <p className="text-gray-700">{selectedContractor.project || 'Not assigned'}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Side - Financial Summary */}
                    <Card className="w-72">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Open Balance</span>
                            <span className={`text-lg font-semibold ${
                              financialSummary.openBalance > 0 ? 'text-orange-600' : 'text-gray-900'
                            }`}>
                              ${financialSummary.openBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Overdue</span>
                            <span className={`text-lg font-semibold ${
                              financialSummary.overdue > 0 ? 'text-red-600' : 'text-gray-900'
                            }`}>
                              ${financialSummary.overdue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="pt-3 border-t">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">Total Paid (All Time)</span>
                              <span className="text-lg font-semibold text-green-600">
                                ${financialSummary.totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>

              {/* Tabs (QB-style) */}
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-white border-b w-full justify-start rounded-none h-auto p-0">
                  <TabsTrigger 
                    value="transactions" 
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-4 py-3"
                  >
                    Transaction List
                  </TabsTrigger>
                  <TabsTrigger 
                    value="details" 
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-4 py-3"
                  >
                    Contractor Details
                  </TabsTrigger>
                  <TabsTrigger 
                    value="notes" 
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-4 py-3"
                  >
                    Notes
                  </TabsTrigger>
                </TabsList>

                {/* Transaction List Tab */}
                <TabsContent value="transactions" className="mt-0">
                  <div className="bg-white rounded-lg shadow-sm border">
                    {/* Toolbar (QB-style) */}
                    <div className="p-4 border-b bg-gray-50">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="w-[180px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All types</SelectItem>
                              <SelectItem value="invoices">Invoices</SelectItem>
                              <SelectItem value="pending">Pending Review</SelectItem>
                            </SelectContent>
                          </Select>

                          <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[150px]">
                              <SelectValue>
                                {statusFilter === 'all' && 'All status'}
                                {statusFilter === 'pending' && 'Open'}
                                {statusFilter === 'approved' && 'Paid'}
                                {statusFilter === 'rejected' && 'Voided'}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All status</SelectItem>
                              <SelectItem value="pending">Open</SelectItem>
                              <SelectItem value="approved">Paid</SelectItem>
                              <SelectItem value="rejected">Voided</SelectItem>
                            </SelectContent>
                          </Select>

                          <Select value={dateFilter} onValueChange={setDateFilter}>
                            <SelectTrigger className="w-[150px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All dates</SelectItem>
                              <SelectItem value="this_month">This month</SelectItem>
                              <SelectItem value="last_month">Last month</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="relative w-64">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input
                            placeholder="Search transactions..."
                            value={transactionSearch}
                            onChange={(e) => setTransactionSearch(e.target.value)}
                            className="pl-9"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Transaction Table (QB-style) */}
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b text-xs text-gray-600 uppercase">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium">Date</th>
                            <th className="px-4 py-3 text-left font-medium">Type</th>
                            <th className="px-4 py-3 text-left font-medium">No.</th>
                            <th className="px-4 py-3 text-left font-medium">Customer/Project</th>
                            <th className="px-4 py-3 text-left font-medium">Memo</th>
                            <th className="px-4 py-3 text-right font-medium">Amount</th>
                            <th className="px-4 py-3 text-center font-medium">Status</th>
                            <th className="px-4 py-3 text-center font-medium">Actions</th> {/* Updated column title */}
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {transactions.length === 0 ? (
                            <tr>
                              <td colSpan="8" className="px-4 py-12 text-center text-gray-500">
                                <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                                No transactions found
                              </td>
                            </tr>
                          ) : (
                            transactions.map((invoice) => (
                              <tr key={invoice.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm">
                                  {format(new Date(invoice.created_at || invoice.created_date), 'MM/dd/yyyy')}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  <div className="flex items-center gap-2">
                                    <Receipt className="w-4 h-4 text-gray-400" />
                                    Invoice
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-sm text-blue-600 font-medium cursor-pointer hover:underline" onClick={() => viewInvoiceDetails(invoice)}>
                                  {invoice.id.slice(-6)}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  {selectedContractor.project || selectedContractor.business || 'N/A'}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                                  {invoice.notes || invoice.fileName}
                                </td>
                                <td className="px-4 py-3 text-sm text-right font-medium">
                                  ${(invoice.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {getStatusBadge(invoice)}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <div className="flex justify-center gap-1">
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      onClick={() => setEditDialog({ open: true, invoice })}
                                      title="Edit Invoice"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                    {invoice.status === 'pending' ? (
                                      <Button
                                        size="sm"
                                        className="bg-green-600 hover:bg-green-700 text-white"
                                        onClick={() => handleApproveInvoice(invoice)}
                                        disabled={processingId === invoice.id}
                                        title="Approve Invoice"
                                      >
                                        {processingId === invoice.id ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                            <CheckCircle className="w-3 h-3 mr-1" />
                                        )}
                                        Approve
                                      </Button>
                                    ) : invoice.status === 'approved' && invoice.paymentStatus !== 'paid' ? (
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        onClick={() => handleReceivePayment(invoice)}
                                        title="Receive Payment"
                                      >
                                        <CreditCard className="w-3 h-3 mr-1" />
                                        Receive
                                      </Button>
                                    ) : (
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => viewInvoiceDetails(invoice)}
                                        title="View Invoice Details"
                                      >
                                        <Eye className="w-4 h-4" />
                                      </Button>
                                    )}
                                    {invoice.fileUrl && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => { e.stopPropagation(); window.open(invoice.fileUrl, '_blank'); }}
                                        title="View Attached Document"
                                      >
                                        <ExternalLink className="w-4 h-4" />
                                      </Button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {transactions.length > 0 && (
                      <div className="px-4 py-3 border-t bg-gray-50 text-sm text-gray-600">
                        Showing {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Contractor Details Tab */}
                <TabsContent value="details" className="mt-0">
                  <Card>
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-sm text-gray-600">Business Name</Label>
                            <p className="mt-1 font-medium">{selectedContractor.business || 'Not set'}</p>
                          </div>
                          <div>
                            <Label className="text-sm text-gray-600">Weekly Pay Target</Label>
                            <p className="mt-1 font-medium">
                              {selectedContractor.weeklyPay ? `$${selectedContractor.weeklyPay}` : 'Not set'}
                            </p>
                          </div>
                          <div>
                            <Label className="text-sm text-gray-600">M2 Project Manager</Label>
                            <p className="mt-1 font-medium">{selectedContractor.m2PM || 'Not assigned'}</p>
                          </div>
                          <div>
                            <Label className="text-sm text-gray-600">Velo Project Manager</Label>
                            <p className="mt-1 font-medium">{selectedContractor.veloPM || 'Not assigned'}</p>
                          </div>
                          <div>
                            <Label className="text-sm text-gray-600">Start Date</Label>
                            <p className="mt-1 font-medium">
                              {selectedContractor.startDate 
                                ? format(new Date(selectedContractor.startDate), 'MMM d, yyyy')
                                : 'Not set'}
                            </p>
                          </div>
                          <div>
                            <Label className="text-sm text-gray-600">Contract End Date</Label>
                            <p className="mt-1 font-medium">
                              {selectedContractor.endDate 
                                ? format(new Date(selectedContractor.endDate), 'MMM d, yyyy')
                                : 'Not set'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Notes Tab */}
                <TabsContent value="notes" className="mt-0">
                  <Card>
                    <CardContent className="p-6">
                      <p className="text-gray-500 text-center py-8">
                        Notes feature coming soon - add internal notes about this contractor.
                      </p>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </div>

      {/* Receive Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Receive Payment</DialogTitle>
            <DialogDescription>
              Record a payment for invoice #{selectedInvoiceForPayment?.id.slice(-6)}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Payment Date</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>

            <div>
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Credit Card</SelectItem>
                  <SelectItem value="ach">ACH/Wire</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Reference Number (optional)</Label>
              <Input
                placeholder="Check # or transaction ID"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
              />
            </div>

            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">
                Invoice total: ${(selectedInvoiceForPayment?.totalAmount || 0).toFixed(2)}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)} disabled={isProcessingPayment}>
              Cancel
            </Button>
            <Button onClick={processPayment} disabled={isProcessingPayment || !paymentAmount}>
              {isProcessingPayment ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Save Payment'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Detail Dialog */}
      <Dialog open={showInvoiceDialog} onOpenChange={(open) => {
        setShowInvoiceDialog(open);
        if (!open) { // Clear messages when dialog closes
          setInvoiceDialogSuccessMessage(null);
          setInvoiceDialogErrorMessage(null);
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Invoice Details</DialogTitle>
          </DialogHeader>
          
          {selectedInvoice && (
            <div className="space-y-4">
              {invoiceDialogSuccessMessage && (
                <div className="bg-green-100 text-green-800 p-3 rounded-md text-sm">
                  {invoiceDialogSuccessMessage}
                </div>
              )}
              {invoiceDialogErrorMessage && (
                <div className="bg-red-100 text-red-800 p-3 rounded-md text-sm">
                  {invoiceDialogErrorMessage}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-gray-600">Invoice Number</Label>
                  <p className="font-medium">#{selectedInvoice.id.slice(-6)}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-600">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedInvoice)}</div>
                </div>
                <div>
                  <Label className="text-sm text-gray-600">Date Submitted</Label>
                  <p className="font-medium">{format(new Date(selectedInvoice.created_at || selectedInvoice.created_date), 'MMM d, yyyy')}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-600">Week Ending</Label>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">
                      {selectedInvoice.weekEndingDate 
                        ? format(new Date(selectedInvoice.weekEndingDate), 'MMM d, yyyy')
                        : 'N/A'}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditDateDialog({ open: true, invoice: selectedInvoice });
                        setNewWeekEndingDate(selectedInvoice.weekEndingDate || '');
                      }}
                      className="text-orange-600 hover:text-orange-700 h-auto p-1"
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-sm text-gray-600">Amount</Label>
                  <p className="text-lg font-bold">
                    ${(selectedInvoice.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-gray-600">Days Worked</Label>
                  <p className="font-medium">{selectedInvoice.daysWorked || 'N/A'}</p>
                </div>
              </div>

              {selectedInvoice.notes && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm text-gray-600">Notes</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleClearNotes(selectedInvoice)}
                      disabled={processingId === selectedInvoice.id}
                      className="text-orange-600 hover:text-orange-700 h-auto p-1"
                    >
                      {processingId === selectedInvoice.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4 mr-1" />
                      )}
                      Clear
                    </Button>
                  </div>
                  <p className="mt-1 p-3 bg-blue-50 rounded border border-blue-200 text-sm">
                    {selectedInvoice.notes}
                  </p>
                </div>
              )}

              {selectedInvoice.fileUrl && (
                <div>
                  <Label className="text-sm text-gray-600">Attachment</Label>
                  <Button
                    variant="outline"
                    className="mt-1"
                    onClick={() => window.open(selectedInvoice.fileUrl, '_blank')}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    View Document
                  </Button>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvoiceDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Week Ending Date Dialog */}
      <Dialog open={editDateDialog.open} onOpenChange={(open) => {
        setEditDateDialog({ open: open, invoice: null });
        if (!open) {
          setNewWeekEndingDate('');
          setInvoiceDialogSuccessMessage(null); // Clear messages when this dialog closes
          setInvoiceDialogErrorMessage(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Week Ending Date</DialogTitle>
            <DialogDescription>
              Change the work period for this invoice ({editDateDialog.invoice?.id.slice(-6)})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="newWeekEndingDate">Week Ending Date</Label>
              <Input
                id="newWeekEndingDate"
                type="date"
                value={newWeekEndingDate}
                onChange={(e) => setNewWeekEndingDate(e.target.value)}
                disabled={processingId === editDateDialog.invoice?.id}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setEditDateDialog({ open: false, invoice: null });
                setNewWeekEndingDate('');
              }}
              disabled={processingId === editDateDialog.invoice?.id}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleUpdateWeekEndingDate(editDateDialog.invoice, newWeekEndingDate)}
              disabled={processingId === editDateDialog.invoice?.id || !newWeekEndingDate}
            >
              {processingId === editDateDialog.invoice?.id ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Date'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Invoice Dialog */}
      <UploadInvoiceDialog
        isOpen={uploadDialog.open}
        onClose={() => setUploadDialog({ open: false, contractor: null })}
        contractor={uploadDialog.contractor}
        onSuccess={handleUploadSuccess}
      />

      {/* Edit Invoice Dialog */}
      <EditInvoiceDialog
        isOpen={editDialog.open}
        onClose={() => setEditDialog({ open: false, invoice: null })}
        invoice={editDialog.invoice}
        onSuccess={handleEditSuccess}
      />

      {/* Export Report Dialog */}
      <ExportReportDialog
        isOpen={exportDialog.open}
        onClose={() => setExportDialog({ open: false, contractor: null })}
        contractor={exportDialog.contractor}
      />

      {/* Toast Notification */}
      {toastMessage.message && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg flex items-center gap-3 z-50 animate-slide-in-right ${
            toastMessage.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toastMessage.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <XCircle className="w-5 h-5" />
          )}
          <span>{toastMessage.message}</span>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setToastMessage({ type: '', message: '' })} 
            className="ml-2 text-white hover:bg-white/20"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}