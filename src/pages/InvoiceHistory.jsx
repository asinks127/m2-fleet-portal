
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Calendar as CalendarComponent } from '@/components/ui/calendar.jsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.jsx';
import {
  FileText,
  Calendar,
  DollarSign,
  Search,
  ExternalLink,
  XCircle,
  CheckCircle,
  User,
  Filter,
  Download,
  Edit
} from 'lucide-react';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { Label } from '@/components/ui/label.jsx';

// Helper to convert UTC to Central Time for display using browser Intl API
const formatCentralTime = (utcDateString) => {
  if (!utcDateString) return 'N/A';
  try {
    const utcDate = new Date(utcDateString);
    if (isNaN(utcDate.getTime())) {
      return 'Invalid Date';
    }
    
    // Format using Intl API for Central Time - this properly converts UTC to Central
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
};

export default function InvoiceHistory() {
  const [invoices, setInvoices] = useState([]);
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [contractorFilter, setContractorFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ from: undefined, to: undefined });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [sortBy, setSortBy] = useState('created_desc');
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [unapproveDialog, setUnapproveDialog] = useState({ open: false, invoice: null });
  const [editNotesDialog, setEditNotesDialog] = useState({ open: false, invoice: null });

  const applyFilters = useCallback(() => {
    let filtered = [...invoices];

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(invoice =>
        invoice.fileName?.toLowerCase().includes(search) ||
        invoice.contractorName?.toLowerCase().includes(search) ||
        invoice.status?.toLowerCase().includes(search)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(invoice => invoice.status === statusFilter);
    }

    const isAdminUser = currentUser && (currentUser.role === 'admin' ||
      ['lena@m2fleetcom.com', 'orville@m2fleetcom.com', 'steve@m2fleetcom.com',
       'austin@m2fleetcom.com', 'adam@m2fleetcom.com', 'jason@m2fleetcom.com',
       'erica@m2fleetcom.com'].includes(currentUser.email?.toLowerCase()));

    if (isAdminUser && contractorFilter !== 'all') {
      filtered = filtered.filter(invoice => invoice.contractorEmail === contractorFilter);
    }

    if (dateRange?.from && dateRange?.to) {
      const startDate = startOfDay(dateRange.from);
      const endDate = endOfDay(dateRange.to);
      
      filtered = filtered.filter(invoice => {
        const invoiceDate = new Date(invoice.created_date);
        return isWithinInterval(invoiceDate, { start: startDate, end: endDate });
      });
    }

    const [sortField, sortOrder] = sortBy.split('_');
    filtered.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortField) {
        case 'created':
          aVal = a.created_date ? new Date(a.created_date) : new Date(0);
          bVal = b.created_date ? new Date(b.created_date) : new Date(0);
          break;
        case 'approved':
          aVal = a.approvedDate ? new Date(a.approvedDate) : new Date(0);
          bVal = b.approvedDate ? new Date(b.approvedDate) : new Date(0);
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
          aVal = a.created_date ? new Date(a.created_date) : new Date(0);
          bVal = b.created_date ? new Date(b.created_date) : new Date(0);
      }
      
      let comparison;
      if (typeof aVal === 'string' || typeof bVal === 'string') {
        comparison = String(aVal).localeCompare(String(bVal));
      } else {
        comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });

    setFilteredInvoices(filtered);
  }, [invoices, searchTerm, statusFilter, contractorFilter, dateRange, sortBy, currentUser]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const contractorParam = urlParams.get('contractor');
    if (contractorParam) {
      setContractorFilter(contractorParam);
      setDateRange({ from: undefined, to: undefined });
    }
  }, []);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const loadData = async () => {
    try {
      const user = (await supabase.auth.getUser()).data.user;
      setCurrentUser(user);

      const isAdmin = user.role === 'admin' ||
        ['lena@m2fleetcom.com', 'orville@m2fleetcom.com', 'steve@m2fleetcom.com',
         'austin@m2fleetcom.com', 'adam@m2fleetcom.com', 'jason@m2fleetcom.com',
         'erica@m2fleetcom.com'].includes(user.email?.toLowerCase());

      const urlParams = new URLSearchParams(window.location.search);
      const contractorParam = urlParams.get('contractor');

      let allInvoices;

      if (isAdmin) {
        if (contractorParam) {
          allInvoices = await (await supabase.from('Invoice').select('*').match({ contractorEmail: contractorParam })).data;
        } else {
          allInvoices = await (await supabase.from('Invoice').select('*') /* TODO: restore sorting/limit '-created_date', 5000 */).data;
        }
        const contractorData = await (await supabase.from('User').select('*')).data;
        setContractors(contractorData);
      } else {
        allInvoices = await (await supabase.from('Invoice').select('*').match(
          { contractorEmail: user.email },
          '-created_date'
        )).data;
        console.log('Loaded contractor invoices:', allInvoices.length);
      }

      setInvoices(allInvoices);
    } catch (error) {
      console.error('Error loading invoice history:', error);
      setError('Failed to load invoice data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnapprove = async (reason, placeOnHold) => {
    if (!unapproveDialog.invoice || !reason.trim()) return;

    setProcessingId(unapproveDialog.invoice.id);
    try {
      await (await supabase.from('Invoice').update({
        status: 'pending',
        pendingReason: `Unapproved: ${reason}`,
        approvedDate: null,
        approvedBy: null,
        approvalNotes: null
      }).eq('id', unapproveDialog.invoice.id)).data;

      if (placeOnHold) {
          const contractor = contractors.find(c => c.email === unapproveDialog.invoice.contractorEmail);
          if (contractor) {
              await (await supabase.from('User').update({
                  needsInvoiceReview: true,
                  invoiceReviewReason: `Invoice un-approved: ${reason}`
              }).eq('id', contractor.id)).data;
          }
      }

      setSuccess('Invoice has been unapproved and moved back to pending status.');
      setUnapproveDialog({ open: false, invoice: null });
      loadData();
    } catch (error) {
      console.error('Error unapproving invoice:', error);
      setError('Failed to unapprove invoice');
    } finally {
      setProcessingId(null);
    }
  };

  const handleApprove = async (invoice) => {
    setProcessingId(invoice.id);
    setError(null);
    setSuccess(null);

    let promptMessage = 'Optional: Add an approval note:';
    if (invoice.status === 'rejected') {
        promptMessage = 'Optional: Add a note about why this previously rejected invoice is now being approved:';
    } else if (invoice.status === 'pending') {
        promptMessage = 'Optional: Add a note for approving this pending invoice:';
    }
    
    const reason = prompt(promptMessage);

    if (reason === null) {
      setProcessingId(null);
      return;
    }

    try {
      await supabase.from('Invoice').update({
        status: 'approved',
        approvedDate: new Date().toISOString(),
        approvedBy: currentUser.email,
        approvalNotes: reason || `Approved by ${currentUser.email}`,
        rejectionReason: null,
        pendingReason: null
      }).eq('id', invoice.id);

      setSuccess('Invoice has been approved successfully.');
      loadData();
    } catch (error) {
      console.error('Error approving invoice:', error);
      setError('Failed to approve invoice.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleSaveNotes = async (invoiceToUpdate, newNotes) => {
    setProcessingId(invoiceToUpdate.id);
    try {
        await (await supabase.from('Invoice').update({
            approvalNotes: newNotes,
        }).eq('id', invoiceToUpdate.id)).data;
        setSuccess('Invoice notes updated successfully.');
        setEditNotesDialog({ open: false, invoice: null });
        loadData();
    } catch (error) {
        console.error('Error updating invoice notes:', error);
        setError('Failed to update invoice notes');
    } finally {
        setProcessingId(null);
    }
  };

  const handleExport = () => {
    if (filteredInvoices.length === 0) return;

    const headers = [
      'Contractor Name', 'Email', 'File Name', 'Status', 'Total Amount',
      'Submitted Date', 'Approved Date', 'Week Ending Date', 'Auto Approved', 'Contractor Notes', 'Approval Notes', 'Rejection Reason', 'Pending Reason'
    ];

    const csvData = filteredInvoices.map(invoice => [
      invoice.contractorName || 'N/A',
      invoice.contractorEmail || 'N/A',
      invoice.fileName || 'N/A',
      invoice.status || 'N/A',
      `$${(invoice.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      invoice.created_date ? formatCentralTime(invoice.created_date).replace(' CT', '') : 'N/A',
      invoice.approvedDate ? formatCentralTime(invoice.approvedDate).replace(' CT', '') : 'N/A',
      invoice.weekEndingDate ? format(new Date(invoice.weekEndingDate), 'yyyy-MM-dd') : 'N/A',
      invoice.autoApproved ? 'Yes' : 'No',
      invoice.notes || '',
      invoice.approvalNotes || '',
      invoice.rejectionReason || '',
      invoice.pendingReason || ''
    ]);

    const csvContent = [
      headers.map(h => `"${h}"`).join(','),
      ...csvData.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-history-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  const clearDateRange = () => {
    setDateRange({ from: undefined, to: undefined });
    setShowDatePicker(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-orange-100 text-orange-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const isAdmin = currentUser && (currentUser.role === 'admin' ||
    ['lena@m2fleetcom.com', 'orville@m2fleetcom.com', 'steve@m2fleetcom.com',
     'austin@m2fleetcom.com', 'adam@m2fleetcom.com', 'jason@m2fleetcom.com',
     'erica@m2fleetcom.com'].includes(currentUser.email?.toLowerCase()));

  const uniqueContractors = useMemo(() => {
    const contractorMap = new Map();
    invoices.forEach(inv => {
      if (inv.contractorEmail && !contractorMap.has(inv.contractorEmail)) {
        contractorMap.set(inv.contractorEmail, inv.contractorName || inv.contractorEmail);
      }
    });
    return Array.from(contractorMap.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [invoices]);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-64"></div>
          {Array(5).fill(0).map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {isAdmin ? 'All Invoice History' : 'My Invoice History'}
          </h1>
          <p className="text-gray-600 mt-1">
            {isAdmin
              ? 'View and manage all submitted invoices and their status'
              : 'View all your submitted invoices and their status'
            }
          </p>
        </div>
        <Button onClick={handleExport} disabled={filteredInvoices.length === 0}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV ({filteredInvoices.length})
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search invoices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>

            {isAdmin && (
              <Select value={contractorFilter} onValueChange={setContractorFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by contractor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Contractors</SelectItem>
                  {uniqueContractors.map(([email, name]) => (
                    <SelectItem key={email} value={email}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_desc">Newest First</SelectItem>
                <SelectItem value="created_asc">Oldest First</SelectItem>
                <SelectItem value="approved_desc">Recently Approved</SelectItem>
                <SelectItem value="contractor_asc">Contractor A-Z</SelectItem>
                <SelectItem value="amount_desc">Highest Amount</SelectItem>
                <SelectItem value="amount_asc">Lowest Amount</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-auto">
                  <Calendar className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, 'MMM d, yyyy')} - {format(dateRange.to, 'MMM d, yyyy')}
                      </>
                    ) : (
                      format(dateRange.from, 'MMM d, yyyy')
                    )
                  ) : (
                    'All Dates'
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="range"
                  selected={dateRange}
                  onSelect={(range) => {
                    setDateRange(range);
                    if (range?.from && range?.to) {
                        setShowDatePicker(false);
                    }
                  }}
                  numberOfMonths={2}
                  weekStartsOn={1}
                />
              </PopoverContent>
            </Popover>
            {(dateRange?.from || dateRange?.to) && (
              <Button variant="ghost" onClick={clearDateRange}>
                Clear Dates
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center text-sm text-gray-600">
        <span>
          Showing {filteredInvoices.length} of {invoices.length} invoices
        </span>
        {(searchTerm || statusFilter !== 'all' || contractorFilter !== 'all' || dateRange?.from) && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('all');
              setContractorFilter('all');
              setDateRange({ from: undefined, to: undefined });
              setSortBy('created_desc');
            }}
          >
            Clear All Filters
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold">{filteredInvoices.length}</p>
              </div>
              <FileText className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold">{filteredInvoices.filter(inv => inv.status === 'pending').length}</p>
              </div>
              <Calendar className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Approved</p>
                <p className="text-2xl font-bold">{filteredInvoices.filter(inv => inv.status === 'approved').length}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Value</p>
                <p className="text-2xl font-bold">
                  ${filteredInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {filteredInvoices.map((invoice) => {
          return (
            <Card key={invoice.id}>
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {isAdmin && (
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900">{invoice.contractorName}</span>
                        </div>
                      )}
                      <h3 className="font-semibold text-gray-900">{invoice.fileName}</h3>
                      <Badge className={getStatusColor(invoice.status)}>
                        {invoice.status}
                      </Badge>
                      {invoice.autoApproved && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                          Auto-Approved
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                      <span>Week: {invoice.weekEndingDate ? format(new Date(invoice.weekEndingDate), 'MMM d, yyyy') : 'N/A'}</span>
                      <span>Submitted: {formatCentralTime(invoice.created_date)}</span>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-4 text-sm text-gray-600 mb-3">
                      {invoice.totalAmount !== undefined && invoice.totalAmount !== null && (
                        <div>
                          <span className="font-medium">Amount:</span>
                          <br />
                          ${invoice.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      )}
                      {invoice.approvedDate && (
                        <div>
                          <span className="font-medium">Approved:</span>
                          <br />
                          {formatCentralTime(invoice.approvedDate)}
                        </div>
                      )}
                    </div>

                    {invoice.notes && (
                      <div className="mt-3 p-3 bg-gray-100 border border-gray-200 rounded">
                        <p className="text-sm text-gray-800">
                          <strong>Contractor Notes:</strong> {invoice.notes}
                        </p>
                      </div>
                    )}

                    {invoice.approvalNotes && (
                      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                        <p className="text-sm text-blue-800">
                          <strong>Approval Notes:</strong> {invoice.approvalNotes}
                        </p>
                      </div>
                    )}

                    {invoice.rejectionReason && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                        <p className="text-sm text-red-800">
                          <strong>Rejection Reason:</strong> {invoice.rejectionReason}
                        </p>
                      </div>
                    )}

                    {invoice.pendingReason && (
                      <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded">
                        <p className="text-sm text-orange-800">
                          <strong>Pending Reason:</strong> {invoice.pendingReason}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 flex-wrap justify-end">
                    {isAdmin && invoice.status === 'approved' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setUnapproveDialog({ open: true, invoice })}
                          className="text-orange-600 border-orange-200 hover:bg-orange-50"
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Unapprove
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditNotesDialog({ open: true, invoice })}
                          className="text-blue-600 border-blue-200 hover:bg-blue-50"
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Edit Notes
                        </Button>
                      </>
                    )}
                    
                    {isAdmin && (invoice.status === 'rejected' || invoice.status === 'pending') && (
                      <Button
                        size="sm"
                        onClick={() => handleApprove(invoice)}
                        disabled={processingId === invoice.id}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        {processingId === invoice.id ? 'Processing...' : 'Approve'}
                      </Button>
                    )}
                    
                    {invoice.fileUrl && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(invoice.fileUrl, '_blank')}
                        >
                          <ExternalLink className="w-4 h-4 mr-1" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = invoice.fileUrl;
                            link.download = invoice.fileName || 'invoice';
                            link.target = '_blank';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Download
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredInvoices.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No invoices found</h3>
              <p className="text-gray-600">
                {searchTerm || statusFilter !== 'all' || contractorFilter !== 'all' || dateRange?.from
                  ? 'Try adjusting your search terms or filters.'
                  : 'No invoices have been submitted yet.'
                }
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <UnapproveDialog
        open={unapproveDialog.open}
        invoice={unapproveDialog.invoice}
        onClose={() => setUnapproveDialog({ open: false, invoice: null })}
        onConfirm={handleUnapprove}
        isProcessing={processingId === unapproveDialog.invoice?.id}
      />

      <EditNotesDialog
        open={editNotesDialog.open}
        invoice={editNotesDialog.invoice}
        onClose={() => setEditNotesDialog({ open: false, invoice: null })}
        onConfirm={handleSaveNotes}
        isProcessing={processingId === editNotesDialog.invoice?.id}
      />
    </div>
  );
}

function EditNotesDialog({ open, invoice, onClose, onConfirm, isProcessing }) {
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open && invoice) {
      setNotes(invoice.approvalNotes || '');
    }
  }, [open, invoice]);

  const handleSubmit = () => {
    onConfirm(invoice, notes);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Invoice Notes</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Editing notes for: <strong>{invoice?.fileName}</strong> by {invoice?.contractorName}
          </p>
          <div>
            <Label htmlFor="invoice-notes">Approval Notes</Label>
            <Textarea
              id="invoice-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add or edit notes about this invoice approval..."
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
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isProcessing ? 'Saving...' : 'Save Notes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function UnapproveDialog({ open, invoice, onClose, onConfirm, isProcessing }) {
  const [reason, setReason] = useState('');
  const [placeOnHold, setPlaceOnHold] = useState(false);

  useEffect(() => {
    if (open) {
        setReason('');
        setPlaceOnHold(false);
    }
  }, [open]);

  const handleSubmit = () => {
    if (reason.trim()) {
      onConfirm(reason, placeOnHold);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unapprove Invoice</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to unapprove "{invoice?.fileName}"?
            This will move it back to pending status.
          </p>
          <div>
            <Label htmlFor="unapprove-reason">Reason for unapproving *</Label>
            <Textarea
              id="unapprove-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason for unapproving this invoice..."
              className="mt-1"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
                id="place-on-hold-unapprove"
                checked={placeOnHold}
                onCheckedChange={setPlaceOnHold}
            />
            <Label htmlFor="place-on-hold-unapprove" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Require manual review of next invoice
            </Label>
          </div>
          <div className="flex justify-end space-x-3">
            <Button variant="outline" onClick={onClose} disabled={isProcessing}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!reason.trim() || isProcessing}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isProcessing ? 'Processing...' : 'Unapprove Invoice'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
