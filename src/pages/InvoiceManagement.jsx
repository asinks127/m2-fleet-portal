import React, { useState, useEffect, useMemo } from 'react';
import { User, Invoice } from '@/api/entities.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Select, SelectContent, SelectItem, SelectValue, SelectTrigger } from '@/components/ui/select.jsx';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils/index.js';
import {
  CheckCircle,
  XCircle,
  Clock,
  Search,
  FileText,
  Eye,
  Calendar,
  DollarSign,
  Phone,
  MapPin,
  Download,
  Trash2,
  Edit
} from 'lucide-react';
import { format, startOfWeek, addDays } from 'date-fns';
import { Calendar as CalendarComponent } from '@/components/ui/calendar.jsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.jsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Label } from '@/components/ui/label.jsx';
import { supabase } from '@/lib/supabaseClient.js'; // Added for fetching current user
import ExportReportDialog from '@/components/invoices/ExportReportDialog';

export default function InvoiceManagement() {
  const [contractors, setContractors] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [selectedContractor, setSelectedContractor] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [isLoading, setIsLoading] = useState(true);
  const [showWeeklyReport, setShowWeeklyReport] = useState(false);

  // Added state for delete and edit dialogs, and processing/feedback
  const [deleteDialog, setDeleteDialog] = useState({ open: false, invoice: null });
  const [editNotesDialog, setEditNotesDialog] = useState({ open: false, invoice: null });
  // Added state for editing week ending date
  const [editDateDialog, setEditDateDialog] = useState({ open: false, invoice: null });
  const [exportDialog, setExportDialog] = useState({ open: false, contractor: null });
  const [newWeekEndingDate, setNewWeekEndingDate] = useState('');

  const [processingId, setProcessingId] = useState(null);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null); // Added state for current user

  // Date range state for weekly report
  const [reportDateRange, setReportDateRange] = useState(() => {
    const now = new Date();
    const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
    const wednesday = addDays(currentWeekStart, 2);
    wednesday.setHours(0, 0, 0, 0);
    const sunday = addDays(currentWeekStart, 6);
    sunday.setHours(23, 59, 59, 999);
    return { from: wednesday, to: sunday };
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setSuccess(null);
    setError(null);
    try {
      const [userData, invoiceData, meData] = await Promise.all([ // Fetched current user
        User.list(),
        Invoice.list('-created_date', 1000),
        (supabase.auth.getUser().then(res => res.data.user)), // Fetch current user
      ]);
      setContractors(userData);
      setInvoices(invoiceData);
      setCurrentUser(meData); // Set the current user
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load data.');
    } finally {
      setIsLoading(false);
    }
  };

  // Added handlers for delete and update
  const handleDeleteInvoice = async (invoice) => {
    setProcessingId(invoice.id);
    setSuccess(null);
    setError(null);
    try {
      await Invoice.delete(invoice.id);
      setSuccess('Invoice deleted successfully.');
      setDeleteDialog({ open: false, invoice: null });
      await loadData();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      setError('Failed to delete invoice');
    } finally {
      setProcessingId(null);
    }
  };

  const handleUpdateNotes = async (invoice, newNotes) => {
    setProcessingId(invoice.id);
    setSuccess(null);
    setError(null);
    try {
      await Invoice.update(invoice.id, {
        notes: newNotes || null
      });
      setSuccess('Notes updated successfully.');
      setEditNotesDialog({ open: false, invoice: null });
      await loadData();
    } catch (error) {
      console.error('Error updating notes:', error);
      setError('Failed to update notes');
    } finally {
      setProcessingId(null);
    }
  };

  const handleClearNotes = async (invoice) => {
    if (!confirm(`Clear all notes for invoice "${invoice.fileName}"?`)) {
      return;
    }

    setProcessingId(invoice.id);
    setSuccess(null);
    setError(null);
    try {
      await Invoice.update(invoice.id, {
        notes: null
      });
      setSuccess('Notes cleared successfully.');
      await loadData();
    } catch (error) {
      console.error('Error clearing notes:', error);
      setError('Failed to clear notes');
    } finally {
      setProcessingId(null);
    }
  };

  const handleUpdateWeekEndingDate = async (invoice, newDate) => {
    setProcessingId(invoice.id);
    setSuccess(null);
    setError(null);
    try {
      // The `newDate` is expected to be in 'YYYY-MM-DD' format from the input type="date".
      // Assuming the backend handles this string directly or can parse it.
      await Invoice.update(invoice.id, {
        weekEndingDate: newDate || null // Pass null if date is empty
      });
      setSuccess('Week ending date updated successfully.');
      setEditDateDialog({ open: false, invoice: null });
      await loadData();
    } catch (error) {
      console.error('Error updating week ending date:', error);
      setError('Failed to update week ending date');
    } finally {
      setProcessingId(null);
    }
  };

  const handleApprove = async (invoice) => {
    if (!currentUser) {
      setError('Could not identify user. Please refresh and try again.');
      return;
    }
    setProcessingId(invoice.id);
    setError(null);
    setSuccess(null);

    const promptMessage = invoice.status === 'rejected' 
      ? 'Optional: Add a note about why this previously rejected invoice is now being approved:'
      : 'Optional: Add approval notes:';
    const reason = prompt(promptMessage);

    if (reason === null) { // User clicked cancel on prompt
      setProcessingId(null);
      return;
    }

    try {
      await Invoice.update(invoice.id, {
        status: 'approved',
        approvedDate: new Date().toISOString(),
        approvedBy: currentUser.email,
        approvalNotes: reason || `Approved by ${currentUser.email}`,
        rejectionReason: null,
        pendingReason: null
      });

      setSuccess('Invoice has been approved successfully.');
      await loadData(); // Reload data to reflect changes
    } catch (error) {
      console.error('Error approving invoice:', error);
      setError('Failed to approve invoice.');
    } finally {
      setProcessingId(null);
    }
  };

  // Filter contractors who have invoices (exclude inactive)
  const contractorsWithInvoices = contractors
    .filter(user => {
      const email = user.email?.toLowerCase() || '';
      const isContractor = email.includes('.contractor@m2fleetcom.com') ||
                           email.includes('.contractor@smcinstallations.com');
      if (!isContractor) return false;
      
      // Exclude inactive contractors
      if (user.active === false) return false;

      const hasInvoices = invoices.some(inv => inv.contractorEmail === user.email);
      if (!hasInvoices) return false;

      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const name = (user.displayName || user.full_name || '').toLowerCase();
        const email = (user.email || '').toLowerCase();
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

  // Get invoices for selected contractor
  const selectedContractorInvoices = selectedContractor
    ? invoices
        .filter(inv => {
          if (inv.contractorEmail !== selectedContractor.email) return false;
          if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
          return true;
        })
        .sort((a, b) => {
          if (sortBy === 'newest') {
            return new Date(b.created_date) - new Date(a.created_date);
          } else if (sortBy === 'oldest') {
            return new Date(a.created_date) - new Date(b.created_date);
          }
          return 0;
        })
    : [];

  // Calculate stats for selected contractor
  const selectedStats = selectedContractor ? {
    total: invoices.filter(inv => inv.contractorEmail === selectedContractor.email).length,
    pending: invoices.filter(inv => inv.contractorEmail === selectedContractor.email && inv.status === 'pending').length,
    approved: invoices.filter(inv => inv.contractorEmail === selectedContractor.email && inv.status === 'approved').length,
    totalAmount: invoices
      .filter(inv => inv.contractorEmail === selectedContractor.email && inv.status === 'approved')
      .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0)
  } : null;

  // Calculate weekly report data using selected date range
  const weeklyReportData = useMemo(() => {
    const complianceStart = reportDateRange.from;
    const complianceEnd = reportDateRange.to;

    if (!complianceStart || !complianceEnd) {
      return { period: { start: null, end: null }, contractors: [] };
    }

    // Get invoices submitted in the selected period
    const weeklyInvoices = invoices.filter(inv => {
      if (!inv.created_date) return false;
      const createdDate = new Date(inv.created_date);
      return createdDate >= complianceStart && createdDate <= complianceEnd;
    });

    // Group by contractor
    const contractorGroups = {};
    weeklyInvoices.forEach(inv => {
      const email = inv.contractorEmail;
      if (!contractorGroups[email]) {
        const contractor = contractors.find(c => c.email === email);
        contractorGroups[email] = {
          contractor: contractor || { email, displayName: inv.contractorName },
          invoices: []
        };
      }
      contractorGroups[email].invoices.push(inv);
    });

    return {
      period: { start: complianceStart, end: complianceEnd },
      contractors: Object.values(contractorGroups).sort((a, b) =>
        (a.contractor.displayName || a.contractor.full_name || '').localeCompare(
          b.contractor.displayName || b.contractor.full_name || ''
        )
      )
    };
  }, [invoices, contractors, reportDateRange]);

  const exportWeeklyReport = () => {
    const headers = [
      'Contractor Name', 'Business', 'Project', 'M2 PM', 'Invoice File',
      'Week Ending', 'Amount', 'Days Worked', 'Status',
      'Contractor Notes', 'Admin Notes', 'Submitted Date'
    ];

    const rows = [];
    weeklyReportData.contractors.forEach(({ contractor, invoices: contractorInvoices }) => {
      contractorInvoices.forEach(inv => {
        rows.push([
          contractor.displayName || contractor.full_name || 'N/A',
          contractor.business || 'N/A',
          contractor.project || 'N/A',
          contractor.m2PM || 'N/A',
          inv.fileName || 'N/A',
          inv.weekEndingDate ? format(new Date(inv.weekEndingDate), 'MM/dd/yyyy') : 'N/A',
          inv.totalAmount != null ? `$${inv.totalAmount.toFixed(2)}` : 'N/A',
          inv.daysWorked != null ? inv.daysWorked : 'N/A',
          inv.status || 'N/A',
          inv.notes || '',
          inv.approvalNotes || '',
          format(new Date(inv.created_date), 'MM/dd/yyyy HH:mm')
        ]);
      });
    });

    const csvContent = [
      headers.map(h => `"${h}"`).join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-report-${format(reportDateRange.from, 'yyyy-MM-dd')}-to-${format(reportDateRange.to, 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  const resetToCurrentWeek = () => {
    const now = new Date();
    const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
    const wednesday = addDays(currentWeekStart, 2);
    wednesday.setHours(0, 0, 0, 0);
    const sunday = addDays(currentWeekStart, 6);
    sunday.setHours(23, 59, 59, 999);
    setReportDateRange({ from: wednesday, to: sunday });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-orange-100 text-orange-800">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="p-6 border-b bg-white">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <FileText className="w-8 h-8" />
              Invoice Management
            </h1>
            <p className="text-gray-600 mt-1">Select a contractor to view their invoices</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowWeeklyReport(!showWeeklyReport)}
            >
              <Calendar className="w-4 h-4 mr-2" />
              Weekly Report ({weeklyReportData.contractors.length})
            </Button>
            <Link to={createPageUrl('ContractorAccounting')}>
              <Button>
                <DollarSign className="w-4 h-4 mr-2" />
                Accounting View
              </Button>
            </Link>
            <Link to={createPageUrl('PendingInvoices')}>
              <Button variant="outline">
                <Clock className="w-4 h-4 mr-2" />
                Review Pending
              </Button>
            </Link>
            <Link to={createPageUrl('InvoiceHistory')}>
              <Button variant="outline">
                <FileText className="w-4 h-4 mr-2" />
                View History
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 mx-6 mt-4 rounded-md">
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 mx-6 mt-4 rounded-md">
          {error}
        </div>
      )}

      {/* Weekly Report Modal/Panel */}
      {showWeeklyReport && (
        <div className="bg-blue-50 border-b border-blue-200 p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col gap-4 mb-4">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Invoice Submission Report
                  </h2>
                  <p className="text-gray-600 mt-1">
                    {reportDateRange.from && reportDateRange.to ? (
                      <>
                        {format(reportDateRange.from, 'MMMM d')} - {format(reportDateRange.to, 'MMMM d, yyyy')}
                      </>
                    ) : (
                      'Select a date range'
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={exportWeeklyReport} variant="outline" disabled={weeklyReportData.contractors.length === 0}>
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                  </Button>
                  <Button onClick={() => setShowWeeklyReport(false)} variant="ghost">
                    Close
                  </Button>
                </div>
              </div>

              {/* Date Range Selector */}
              <div className="flex items-center gap-4 bg-white p-4 rounded-lg border">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">From:</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
                        <Calendar className="mr-2 h-4 w-4" />
                        {reportDateRange.from ? format(reportDateRange.from, 'MMM d, yyyy') : 'Pick start date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={reportDateRange.from}
                        onSelect={(date) => {
                          if (date) {
                            date.setHours(0, 0, 0, 0); // Set to start of the day
                            setReportDateRange({ ...reportDateRange, from: date });
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">To:</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
                        <Calendar className="mr-2 h-4 w-4" />
                        {reportDateRange.to ? format(reportDateRange.to, 'MMM d, yyyy') : 'Pick end date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={reportDateRange.to}
                        onSelect={(date) => {
                          if (date) {
                            date.setHours(23, 59, 59, 999); // Set to end of the day
                            setReportDateRange({ ...reportDateRange, to: date });
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <Button onClick={resetToCurrentWeek} variant="outline" size="sm">
                  Reset to Current Week (Wed-Sun)
                </Button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm max-h-96 overflow-y-auto">
              {weeklyReportData.contractors.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No invoices submitted during this period</p>
                </div>
              ) : (
                <div className="divide-y">
                  {weeklyReportData.contractors.map(({ contractor, invoices: contractorInvoices }) => (
                    <div key={contractor.email} className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {contractor.displayName || contractor.full_name}
                          </h3>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 mt-1">
                            {contractor.business && <span>Business: {contractor.business}</span>}
                            {contractor.project && <span>Project: {contractor.project}</span>}
                            {contractor.m2PM && <span>PM: {contractor.m2PM}</span>}
                          </div>
                        </div>
                        <Badge variant="outline">
                          {contractorInvoices.length} invoice{contractorInvoices.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        {contractorInvoices.map(inv => (
                          <div key={inv.id} className="bg-gray-50 rounded p-3 text-sm">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                  <span className="font-medium">{inv.fileName}</span>
                                  {getStatusBadge(inv.status)}
                                  {inv.autoApproved && (
                                    <Badge variant="outline" className="text-xs">Auto-Approved</Badge>
                                  )}
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600 mb-2">
                                  {inv.weekEndingDate && (
                                    <div>Week Ending: {format(new Date(inv.weekEndingDate), 'MM/dd/yyyy')}</div>
                                  )}
                                  {inv.totalAmount != null && (
                                    <div>Amount: ${inv.totalAmount.toFixed(2)}</div>
                                  )}
                                  {inv.daysWorked != null && (
                                    <div>Days: {inv.daysWorked}</div>
                                  )}
                                  <div>Submitted: {format(new Date(inv.created_date), 'MM/dd/yyyy')}</div>
                                </div>

                                {inv.notes && (
                                  <div className="text-xs p-2 bg-blue-50 border border-blue-200 rounded mb-1">
                                    <strong className="text-blue-900">Contractor Notes:</strong>
                                    <span className="text-blue-800 ml-1">{inv.notes}</span>
                                  </div>
                                )}
                                {inv.approvalNotes && (
                                  <div className="text-xs p-2 bg-green-50 border border-green-200 rounded">
                                    <strong className="text-green-900">Admin Notes:</strong>
                                    <span className="text-green-800 ml-1">{inv.approvalNotes}</span>
                                  </div>
                                )}
                              </div>

                              {inv.fileUrl && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => window.open(inv.fileUrl, '_blank')}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Two Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Contractor List */}
        <div className="w-80 border-r bg-gray-50 flex flex-col">
          <div className="p-4 border-b bg-white">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search contractors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-gray-500">Loading...</div>
            ) : contractorsWithInvoices.length === 0 ? (
              <div className="p-4 text-center text-gray-500">No contractors found</div>
            ) : (
              <div className="divide-y">
                {contractorsWithInvoices.map(contractor => {
                  const contractorInvoiceCount = invoices.filter(inv => inv.contractorEmail === contractor.email).length;
                  const pendingCount = invoices.filter(inv => inv.contractorEmail === contractor.email && inv.status === 'pending').length;
                  const isSelected = selectedContractor?.email === contractor.email;

                  return (
                    <button
                      key={contractor.id}
                      onClick={() => setSelectedContractor(contractor)}
                      className={`w-full text-left p-4 hover:bg-white transition-colors ${
                        isSelected ? 'bg-white border-l-4 border-blue-600' : ''
                      }`}
                    >
                      <div className="font-medium text-gray-900">
                        {contractor.displayName || contractor.full_name || contractor.email}
                      </div>
                      {contractor.business && (
                        <div className="text-sm text-gray-600 mt-1">{contractor.business}</div>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          {contractorInvoiceCount} invoice{contractorInvoiceCount !== 1 ? 's' : ''}
                        </Badge>
                        {pendingCount > 0 && (
                          <Badge className="text-xs bg-orange-100 text-orange-800">
                            {pendingCount} pending
                          </Badge>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Invoice Details */}
        <div className="flex-1 overflow-y-auto bg-white">
          {!selectedContractor ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg">Select a contractor to view their invoices</p>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* Contractor Header */}
              <Card>
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-2xl">
                        {selectedContractor.displayName || selectedContractor.full_name}
                      </CardTitle>
                      {selectedContractor.business && (
                        <p className="text-gray-600 mt-1">{selectedContractor.business}</p>
                      )}
                      <div className="flex gap-4 mt-3 text-sm text-gray-600">
                        {selectedContractor.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="w-4 h-4" />
                            {selectedContractor.phone}
                          </div>
                        )}
                        {selectedContractor.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {selectedContractor.location}
                          </div>
                        )}
                        {selectedContractor.weeklyPay && (
                          <div className="flex items-center gap-1">
                            <DollarSign className="w-4 h-4" />
                            ${selectedContractor.weeklyPay}/week
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setExportDialog({ open: true, contractor: selectedContractor })}
                      className="bg-white hover:bg-gray-50"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Payment Report
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Total</p>
                      <p className="text-2xl font-bold text-gray-900">{selectedStats.total}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Pending</p>
                      <p className="text-2xl font-bold text-orange-600">{selectedStats.pending}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Approved</p>
                      <p className="text-2xl font-bold text-green-600">{selectedStats.approved}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total</p>
                      <p className="text-2xl font-bold text-gray-900">
                        ${selectedStats.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Filters */}
              <div className="flex gap-4">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Invoice List */}
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  Showing {selectedContractorInvoices.length} of {selectedStats.total} invoices
                </p>

                <div className="space-y-4">
                  {selectedContractorInvoices.length === 0 ? (
                    <Card>
                      <CardContent className="p-8 text-center">
                        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-600">
                          No invoices match the current filter
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    selectedContractorInvoices.map((invoice) => (
                      <Card key={invoice.id}>
                        <CardContent className="p-6">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="font-semibold text-gray-900">{invoice.fileName}</h3>
                                {getStatusBadge(invoice.status)}
                                {invoice.autoApproved && (
                                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                                    Auto-Approved
                                  </Badge>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                                <div>
                                  <span className="font-medium">Submitted:</span>
                                  <br />
                                  {format(new Date(invoice.created_date), 'MMM d, yyyy')}
                                </div>
                                {invoice.weekEndingDate && (
                                  <div>
                                    <span className="font-medium">Week Ending:</span>
                                    <br />
                                    {format(new Date(invoice.weekEndingDate), 'MMM d, yyyy')}
                                  </div>
                                )}
                                {invoice.totalAmount != null && (
                                  <div>
                                    <span className="font-medium">Amount:</span>
                                    <br />
                                    ${invoice.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                  </div>
                                )}
                                {invoice.status === 'approved' && invoice.approvedDate && (
                                  <div>
                                    <span className="font-medium">Approved:</span>
                                    <br />
                                    {format(new Date(invoice.approvedDate), 'MMM d, yyyy')}
                                  </div>
                                )}
                              </div>
                              
                              {invoice.notes && (
                                <div className="mt-3 p-3 bg-blue-50 rounded border">
                                  <p className="text-sm text-gray-800">
                                    <strong>Notes:</strong> {invoice.notes}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex gap-2">
                            {invoice.fileUrl && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(invoice.fileUrl, '_blank')}
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                View
                              </Button>
                            )}

                            {(invoice.status === 'pending' || invoice.status === 'rejected') && (
                                <Button
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700"
                                    onClick={() => handleApprove(invoice)}
                                    disabled={processingId === invoice.id || !currentUser}
                                >
                                    <CheckCircle className="w-4 h-4 mr-1" />
                                    {processingId === invoice.id ? 'Approving...' : 'Approve'}
                                </Button>
                            )}
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditDateDialog({ open: true, invoice });
                                setNewWeekEndingDate(invoice.weekEndingDate ? format(new Date(invoice.weekEndingDate), 'yyyy-MM-dd') : '');
                              }}
                              disabled={processingId === invoice.id}
                            >
                              <Calendar className="w-4 h-4 mr-2" />
                              Edit Date
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditNotesDialog({ open: true, invoice })}
                              disabled={processingId === invoice.id}
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Edit Notes
                            </Button>

                            {invoice.notes && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleClearNotes(invoice)}
                                disabled={processingId === invoice.id}
                                className="text-orange-600 border-orange-200 hover:bg-orange-50"
                              >
                                <XCircle className="w-4 h-4 mr-2" />
                                Clear Notes
                              </Button>
                            )}
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeleteDialog({ open: true, invoice })}
                              disabled={processingId === invoice.id}
                              className="text-red-600 border-red-200 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={() => setDeleteDialog({ open: false, invoice: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Invoice</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteDialog.invoice?.fileName}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, invoice: null })} disabled={processingId === deleteDialog.invoice?.id}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleDeleteInvoice(deleteDialog.invoice)}
              disabled={processingId === deleteDialog.invoice?.id}
            >
              {processingId === deleteDialog.invoice?.id ? 'Deleting...' : 'Delete Invoice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Week Ending Date Dialog */}
      <Dialog open={editDateDialog.open} onOpenChange={() => setEditDateDialog({ open: false, invoice: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Week Ending Date</DialogTitle>
            <DialogDescription>
              Change the work period for invoice: {editDateDialog.invoice?.fileName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="newWeekEndingDateInput">Week Ending Date</Label>
              <Input
                id="newWeekEndingDateInput"
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
              onClick={() => setEditDateDialog({ open: false, invoice: null })}
              disabled={processingId === editDateDialog.invoice?.id}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleUpdateWeekEndingDate(editDateDialog.invoice, newWeekEndingDate)}
              disabled={processingId === editDateDialog.invoice?.id || !newWeekEndingDate}
            >
              {processingId === editDateDialog.invoice?.id ? 'Saving...' : 'Save Date'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Notes Dialog */}
      <EditNotesDialog
        open={editNotesDialog.open}
        invoice={editNotesDialog.invoice}
        onClose={() => setEditNotesDialog({ open: false, invoice: null })}
        onConfirm={handleUpdateNotes}
        isProcessing={processingId === editNotesDialog.invoice?.id}
      />

      {/* Export Report Dialog */}
      <ExportReportDialog
        isOpen={exportDialog.open}
        onClose={() => setExportDialog({ open: false, contractor: null })}
        contractor={exportDialog.contractor}
      />
    </div>
  );
}

// Edit Notes Dialog Component
function EditNotesDialog({ open, invoice, onClose, onConfirm, isProcessing }) {
  const [notes, setNotes] = useState('');

  React.useEffect(() => {
    if (open && invoice) {
      setNotes(invoice.notes || '');
    } else {
      setNotes('');
    }
  }, [open, invoice]);

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Invoice Notes</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p>Editing notes for: <strong>{invoice.fileName}</strong></p>
          <div>
            <Label htmlFor="invoiceNotes">Contractor Notes</Label>
            <Textarea
              id="invoiceNotes"
              placeholder="Add or update notes about this invoice..."
              rows={5}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isProcessing}
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
            {isProcessing ? 'Saving...' : 'Save Notes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}