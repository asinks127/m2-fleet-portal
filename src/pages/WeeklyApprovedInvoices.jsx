import React, { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx';
import { Calendar as CalendarComponent } from '@/components/ui/calendar.jsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.jsx';
import { Loader2, Download, Calendar, CheckCircle, Clock, XCircle, Building2, AlertTriangle, UserX } from 'lucide-react';
import { startOfWeek, endOfWeek, format, subWeeks, addDays, parseISO } from 'date-fns';

// Helper to convert a date to Central Time using browser API
const toCentralTime = (date) => {
  // Ensure it's a valid Date object
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return new Date(NaN); // Return an invalid date
  }

  // Create a date formatter for Central Time
  const centralFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false // Use 24-hour format for easier parsing
  });
  
  const parts = centralFormatter.formatToParts(date);
  const dateObj = {};
  parts.forEach(({ type, value }) => {
    dateObj[type] = value;
  });
  
  // Create a new date using Central Time components.
  return new Date(
    parseInt(dateObj.year),
    parseInt(dateObj.month) - 1, // Month is 0-indexed
    parseInt(dateObj.day),
    parseInt(dateObj.hour),
    parseInt(dateObj.minute),
    parseInt(dateObj.second)
  );
};

export default function WeeklyApprovedInvoices() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [dateMode, setDateMode] = useState('preset'); // 'preset' or 'custom'
  const [customDateRange, setCustomDateRange] = useState({ from: undefined, to: undefined });
  const [showDatePicker, setShowDatePicker] = useState(false);

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => (await supabase.from('Invoice').select('*') /* TODO: restore sorting/limit '-created_date', 2000 */).data,
    initialData: [],
  });

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await supabase.from('User').select('*')).data,
    initialData: [],
  });

  const isLoading = invoicesLoading || usersLoading;

  // Helper function to determine company
  const getContractorCompany = (contractor) => {
    if (!contractor?.email) return 'M2 FLEET COMMUNICATIONS';
    
    const email = contractor.email.toLowerCase();
    const project = contractor.project?.toLowerCase() || '';
    
    // Check if project is VLOCAL first (highest priority)
    if (project.includes('vlocal')) {
      return 'SMC INSTALLATIONS';
    }
    // Specific exception: Andres Arguello goes to M2 Fleet
    else if (email === 'aarguello.contractor@smcinstallations.com') {
      return 'M2 FLEET COMMUNICATIONS';
    }
    // Check specific email exceptions
    else if (email === 'mmclaughlin.contractor@m2fleetcom.com') {
      return 'SMC INSTALLATIONS';
    }
    // Fall back to email domain check
    else if (email.includes('.contractor@smcinstallations.com')) {
      return 'SMC INSTALLATIONS';
    }
    
    return 'M2 FLEET COMMUNICATIONS';
  };

  // Get active contractors
  const activeContractors = useMemo(() => 
    users.filter(user =>
      user.active &&
      user.email &&
      (user.email.toLowerCase().includes('.contractor@m2fleetcom.com') ||
       user.email.toLowerCase().includes('.contractor@smcinstallations.com'))
    ), [users]
  );

  // Calculate the date range based on mode
  const { compliancePeriodStart, compliancePeriodEnd, weekLabel } = useMemo(() => {
    if (dateMode === 'custom' && customDateRange.from && customDateRange.to) {
      // Custom date range
      const start = new Date(customDateRange.from);
      start.setHours(0, 0, 0, 0);
      
      const end = new Date(customDateRange.to);
      end.setHours(23, 59, 59, 999);
      
      const label = `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
      
      return { 
        compliancePeriodStart: start, 
        compliancePeriodEnd: end, 
        weekLabel: label 
      };
    } else {
      // Preset week mode
      const today = new Date();
      const referenceDateForPeriod = subWeeks(today, weekOffset);
      
      // Convert the reference date to a Date object whose local components reflect Central Time.
      const centralReference = toCentralTime(referenceDateForPeriod);
      
      // Get Monday of the week based on Central Time reference
      const mondayOfWeek = startOfWeek(centralReference, { weekStartsOn: 1 });
      
      // Compliance period starts Wednesday at midnight Central Time
      const start = addDays(mondayOfWeek, 2); // Wednesday
      start.setHours(0, 0, 0, 0);
      
      // Compliance period ends Sunday at 11:59:59 PM Central Time
      const end = endOfWeek(centralReference, { weekStartsOn: 1 }); // Sunday
      end.setHours(23, 59, 59, 999);
      
      // Label shows the Monday-Sunday range (what contractors see)
      const displayStart = mondayOfWeek;
      const displayEnd = end;
      const label = `${format(displayStart, 'MMM d')} - ${format(displayEnd, 'MMM d, yyyy')}`;
      
      return { 
        compliancePeriodStart: start, 
        compliancePeriodEnd: end, 
        weekLabel: label 
      };
    }
  }, [weekOffset, dateMode, customDateRange]);

  // Get invoices submitted during the compliance period
  const invoicesInPeriod = useMemo(() => {
    console.log('=== INVOICE FILTERING DEBUG ===');
    console.log('Compliance Period:', {
      start: format(compliancePeriodStart, 'yyyy-MM-dd HH:mm:ss'),
      end: format(compliancePeriodEnd, 'yyyy-MM-dd HH:mm:ss')
    });
    
    const filtered = invoices.filter(inv => {
      if (!inv.created_date) {
        console.log('❌ No created_date:', inv.fileName);
        return false;
      }
      
      try {
        // Parse the date more carefully
        const submittedDateUTC = parseISO(inv.created_date);
        
        if (isNaN(submittedDateUTC.getTime())) {
          console.log('❌ Invalid date:', inv.created_date, inv.fileName);
          return false;
        }

        // Convert to Central Time for comparison
        const submittedDateCentral = toCentralTime(submittedDateUTC);
        
        const isInRange = submittedDateCentral >= compliancePeriodStart && submittedDateCentral <= compliancePeriodEnd;
        
        if (inv.contractorName?.toLowerCase().includes('benjamin') || inv.contractorName?.toLowerCase().includes('sanders')) {
          console.log('🔍 Benjamin Sanders Invoice:', {
            name: inv.contractorName,
            fileName: inv.fileName,
            created_date: inv.created_date,
            submittedDate: format(submittedDateCentral, 'yyyy-MM-dd HH:mm:ss'),
            isInRange,
            status: inv.status
          });
        }
        
        return isInRange;
      } catch (error) {
        console.error("Error parsing invoice date:", error, inv);
        return false;
      }
    });
    
    console.log(`Total invoices in period: ${filtered.length}`);
    console.log('===========================');
    
    return filtered;
  }, [invoices, compliancePeriodStart, compliancePeriodEnd]);

  // Process invoices - only keep the LATEST invoice per contractor (no duplicates)
  // Only show approved or pending invoices
  const processedInvoices = useMemo(() => {
    const invoicesByContractor = new Map();

    // Group invoices by contractor email, keeping only the most recent
    invoicesInPeriod.forEach(inv => {
      const email = inv.contractorEmail?.toLowerCase().trim();
      if (!email) return;

      // Only process approved or pending invoices
      if (inv.status !== 'approved' && inv.status !== 'pending') return;

      const existingInvoice = invoicesByContractor.get(email);
      
      // Keep the most recently created invoice
      if (!existingInvoice || new Date(inv.created_date) > new Date(existingInvoice.created_date)) {
        invoicesByContractor.set(email, inv);
      }
    });

    return Array.from(invoicesByContractor.values());
  }, [invoicesInPeriod]);

  // Separate contractors by company and sort alphabetically
  const { smcData, m2Data } = useMemo(() => {
    const smc = { approved: [], pending: [], missing: [] };
    const m2 = { approved: [], pending: [], missing: [] };

    // Process submitted invoices
    processedInvoices.forEach(inv => {
      const contractor = activeContractors.find(c => c.email?.toLowerCase() === inv.contractorEmail?.toLowerCase());
      const company = getContractorCompany(contractor || { email: inv.contractorEmail });
      
      const data = {
        ...inv,
        contractorCompany: company,
        contractor: contractor
      };

      if (inv.status === 'approved') {
        if (company === 'SMC INSTALLATIONS') {
          smc.approved.push(data);
        } else {
          m2.approved.push(data);
        }
      } else if (inv.status === 'pending') {
        if (company === 'SMC INSTALLATIONS') {
          smc.pending.push(data);
        } else {
          m2.pending.push(data);
        }
      }
    });

    // Find missing contractors
    // FIX: Use invoicesInPeriod to determine if a contractor submitted anything at all in the period
    // This aligns the UI's 'missing' count with the broader definition of submission used in the CSV.
    const submittedEmails = new Set(invoicesInPeriod.map(inv => inv.contractorEmail?.toLowerCase().trim()));
    
    activeContractors.forEach(contractor => {
      const email = contractor.email?.toLowerCase().trim();
      if (!email || submittedEmails.has(email)) return;

      const company = getContractorCompany(contractor);
      const data = {
        contractor,
        contractorName: contractor.displayName || contractor.full_name,
        contractorEmail: contractor.email,
        status: 'missing'
      };

      if (company === 'SMC INSTALLATIONS') {
        smc.missing.push(data);
      } else {
        m2.missing.push(data);
      }
    });

    // Sort all arrays alphabetically by contractor name
    const sortByName = (a, b) => {
      const nameA = a.contractorName || a.contractor?.displayName || a.contractor?.full_name || '';
      const nameB = b.contractorName || b.contractor?.displayName || b.contractor?.full_name || '';
      return nameA.localeCompare(nameB);
    };

    smc.approved.sort(sortByName);
    smc.pending.sort(sortByName);
    smc.missing.sort(sortByName);
    m2.approved.sort(sortByName);
    m2.pending.sort(sortByName);
    m2.missing.sort(sortByName);

    return { smcData: smc, m2Data: m2 };
  }, [processedInvoices, activeContractors, invoicesInPeriod]);

  // Calculate totals
  const totals = useMemo(() => {
    const smcApprovedTotal = smcData.approved.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    const smcPendingTotal = smcData.pending.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    const m2ApprovedTotal = m2Data.approved.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    const m2PendingTotal = m2Data.pending.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);

    return {
      smc: {
        approved: smcApprovedTotal,
        pending: smcPendingTotal,
        total: smcApprovedTotal + smcPendingTotal
      },
      m2: {
        approved: m2ApprovedTotal,
        pending: m2PendingTotal,
        total: m2ApprovedTotal + m2PendingTotal
      },
      grand: {
        approved: smcApprovedTotal + m2ApprovedTotal,
        pending: smcPendingTotal + m2PendingTotal,
        total: smcApprovedTotal + smcPendingTotal + m2ApprovedTotal + m2PendingTotal
      }
    };
  }, [smcData, m2Data]);

  const handleDownload = async () => {
    try {
      const response = await fetch('/api/exportWeeklyReport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: format(compliancePeriodStart, 'yyyy-MM-dd'),
          endDate: format(compliancePeriodEnd, 'yyyy-MM-dd')
        })
      });
      const data = await response.json();

      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-report-${format(compliancePeriodStart, 'yyyy-MM-dd')}-to-${format(compliancePeriodEnd, 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      console.error('Error downloading report:', error);
      alert('Failed to download report. Please try again.');
    }
  };

  const InvoiceTable = ({ data, title, companyName }) => (
    <Card className="mb-6">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            <span>{companyName}</span>
          </div>
          <Badge variant="outline" className="text-lg px-4 py-1">
            Total: ${totals[title].total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {/* Approved Invoices */}
        {data.approved.length > 0 && (
          <div className="border-b">
            <div className="bg-green-50 px-6 py-3 font-semibold text-green-900 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Approved ({data.approved.length})
              </span>
              <span>${totals[title].approved.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contractor</TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>Submitted Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.approved.map((inv, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{inv.contractorName}</TableCell>
                    <TableCell>{inv.businessName || 'N/A'}</TableCell>
                    <TableCell>{format(parseISO(inv.created_date), 'MMM d, yyyy h:mm a')}</TableCell>
                    <TableCell className="text-right font-semibold">
                      ${(inv.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pending Invoices */}
        {data.pending.length > 0 && (
          <div className="border-b">
            <div className="bg-yellow-50 px-6 py-3 font-semibold text-yellow-900 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Pending Review ({data.pending.length})
              </span>
              <span>${totals[title].pending.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contractor</TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>Submitted Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.pending.map((inv, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{inv.contractorName}</TableCell>
                    <TableCell>{inv.businessName || 'N/A'}</TableCell>
                    <TableCell>{format(parseISO(inv.created_date), 'MMM d, yyyy h:mm a')}</TableCell>
                    <TableCell className="text-right font-semibold">
                      ${(inv.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Missing Invoices */}
        {data.missing.length > 0 && (
          <div>
            <div className="bg-red-50 px-6 py-3 font-semibold text-red-900 flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              Missing Submissions ({data.missing.length})
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contractor</TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>PM</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.missing.map((item, idx) => (
                  <TableRow key={idx} className="bg-red-50/50">
                    <TableCell className="font-medium">{item.contractorName}</TableCell>
                    <TableCell>{item.contractor?.business || 'N/A'}</TableCell>
                    <TableCell>{item.contractor?.project || 'N/A'}</TableCell>
                    <TableCell>{item.contractor?.m2PM || 'N/A'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Weekly Invoice Report</h1>
          <p className="text-gray-600 mt-1">Review approved, pending, and missing invoices by company</p>
        </div>
        <Button onClick={handleDownload} className="gap-2">
          <Download className="w-4 h-4" />
          Download CSV
        </Button>
      </div>

      {/* Date Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Report Period</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Date Mode Toggle */}
            <div className="flex gap-2">
              <Button
                variant={dateMode === 'preset' ? 'default' : 'outline'}
                onClick={() => setDateMode('preset')}
              >
                Preset Weeks
              </Button>
              <Button
                variant={dateMode === 'custom' ? 'default' : 'outline'}
                onClick={() => setDateMode('custom')}
              >
                Custom Range
              </Button>
            </div>

            {/* Preset Week Selector */}
            {dateMode === 'preset' && (
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setWeekOffset(prev => prev + 1)}>
                  ← Previous Week
                </Button>
                <Select value={weekOffset.toString()} onValueChange={(val) => setWeekOffset(parseInt(val))}>
                  <SelectTrigger className="w-64">
                    <SelectValue>{weekLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">This Week</SelectItem>
                    <SelectItem value="1">Last Week</SelectItem>
                    <SelectItem value="2">2 Weeks Ago</SelectItem>
                    <SelectItem value="3">3 Weeks Ago</SelectItem>
                    <SelectItem value="4">4 Weeks Ago</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => setWeekOffset(prev => Math.max(0, prev - 1))} disabled={weekOffset === 0}>
                  Next Week →
                </Button>
              </div>
            )}

            {/* Custom Date Range Picker */}
            {dateMode === 'custom' && (
              <div className="flex items-center gap-2">
                <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-80">
                      <Calendar className="mr-2 h-4 w-4" />
                      {customDateRange.from && customDateRange.to ? (
                        `${format(customDateRange.from, 'MMM d, yyyy')} - ${format(customDateRange.to, 'MMM d, yyyy')}`
                      ) : (
                        'Select date range'
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="range"
                      selected={customDateRange}
                      onSelect={(range) => {
                        setCustomDateRange(range || { from: undefined, to: undefined });
                        if (range?.from && range?.to) {
                          setShowDatePicker(false);
                        }
                      }}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* Compliance Period Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900 font-medium mb-2">
                📅 Reporting Period (Submission Dates)
              </p>
              <p className="text-blue-800">
                <strong>From:</strong> {format(compliancePeriodStart, 'EEEE, MMMM d, yyyy')} at 12:00 AM
              </p>
              <p className="text-blue-800">
                <strong>Through:</strong> {format(compliancePeriodEnd, 'EEEE, MMMM d, yyyy')} at 11:59 PM
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Approved</p>
                <p className="text-2xl font-bold text-green-600">
                  ${totals.grand.approved.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-300" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Pending Review</p>
                <p className="text-2xl font-bold text-yellow-600">
                  ${totals.grand.pending.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <Clock className="w-8 h-8 text-yellow-300" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Missing</p>
                <p className="text-2xl font-bold text-red-600">
                  {smcData.missing.length + m2Data.missing.length}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-300" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SMC Installations */}
      <InvoiceTable data={smcData} title="smc" companyName="SMC INSTALLATIONS" />

      {/* M2 Fleet Communications */}
      <InvoiceTable data={m2Data} title="m2" companyName="M2 FLEET COMMUNICATIONS" />

      {/* Missing Submissions List */}
      {(smcData.missing.length > 0 || m2Data.missing.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserX className="w-5 h-5 text-red-600" />
              Missing Submissions ({smcData.missing.length + m2Data.missing.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-x-8 gap-y-4">
              <div>
                <h4 className="font-semibold text-gray-800 mb-2 pb-2 border-b">
                  SMC Installations ({smcData.missing.length})
                </h4>
                {smcData.missing.length > 0 ? (
                  <ul className="space-y-1 text-sm text-gray-700">
                    {smcData.missing.map(item => (
                      <li key={item.contractorEmail}>{item.contractorName}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">All contractors submitted.</p>
                )}
              </div>
              <div>
                <h4 className="font-semibold text-gray-800 mb-2 pb-2 border-b">
                  M2 Fleet Communications ({m2Data.missing.length})
                </h4>
                {m2Data.missing.length > 0 ? (
                  <ul className="space-y-1 text-sm text-gray-700">
                    {m2Data.missing.map(item => (
                      <li key={item.contractorEmail}>{item.contractorName}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">All contractors submitted.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Debug Info (only visible in console) */}
      {console.log('SMC Data:', smcData)}
      {console.log('M2 Data:', m2Data)}
      {console.log('Totals:', totals)}
    </div>
  );
}