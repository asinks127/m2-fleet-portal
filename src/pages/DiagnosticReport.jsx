import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import {
  AlertTriangle,
  CheckCircle,
  FileText,
  Calendar,
  RefreshCw,
  Download
} from 'lucide-react';
import {
  startOfWeek,
  endOfWeek,
  addDays,
  format
} from 'date-fns';

import { Calendar as CalendarComponent } from '@/components/ui/calendar.jsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';

// Helper to convert UTC to Central Time using browser Intl API
const toCentralTime = (utcDateString) => {
  if (!utcDateString) return null;
  try {
    const utcDate = new Date(utcDateString);
    if (isNaN(utcDate.getTime())) return null;
    
    // Convert to Central Time using Intl API
    const centralString = utcDate.toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    // Parse the formatted string back to a Date object in local timezone
    // This represents the Central Time moment
    const [datePart, timePart] = centralString.split(', ');
    const [month, day, year] = datePart.split('/');
    const [hour, minute, second] = timePart.split(':');
    
    return new Date(year, month - 1, day, hour, minute, second);
  } catch (error) {
    console.error('Error converting to Central Time:', error);
    return null;
  }
};

export default function DiagnosticReport() {
  const [isLoading, setIsLoading] = useState(true);
  const [diagnostics, setDiagnostics] = useState(null);
  const [rawData, setRawData] = useState({ invoices: [], users: [] });
  const [dateRangeType, setDateRangeType] = useState('this_week');
  const [customDateRange, setCustomDateRange] = useState({ from: undefined, to: undefined });
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    runDiagnostics();
  }, [dateRangeType, customDateRange]);

  const getDateRange = () => {
    const now = new Date();
    const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday

    switch (dateRangeType) {
      case 'this_week':
        const complianceStart = addDays(currentWeekStart, 2); // Wednesday
        complianceStart.setHours(0, 0, 0, 0);
        const complianceEnd = endOfWeek(now, { weekStartsOn: 1 }); // Sunday
        complianceEnd.setHours(23, 59, 59, 999);
        return { start: complianceStart, end: complianceEnd };

      case 'last_week':
        const lastWeekStart = addDays(currentWeekStart, -7);
        const lastWeekWed = addDays(lastWeekStart, 2);
        lastWeekWed.setHours(0, 0, 0, 0);
        const lastWeekNow = addDays(now, -7);
        const lastWeekSun = endOfWeek(lastWeekNow, { weekStartsOn: 1 });
        lastWeekSun.setHours(23, 59, 59, 999);
        return { start: lastWeekWed, end: lastWeekSun };

      case 'full_week':
        const weekStart = new Date(currentWeekStart);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
        weekEnd.setHours(23, 59, 59, 999);
        return { start: weekStart, end: weekEnd };

      case 'custom':
        if (customDateRange.from && customDateRange.to) {
          const start = new Date(customDateRange.from);
          start.setHours(0, 0, 0, 0);
          const end = new Date(customDateRange.to);
          end.setHours(23, 59, 59, 999);
          return { start, end };
        }
        const fallbackStart = addDays(currentWeekStart, 2);
        fallbackStart.setHours(0, 0, 0, 0);
        const fallbackEnd = endOfWeek(now, { weekStartsOn: 1 });
        fallbackEnd.setHours(23, 59, 59, 999);
        return { start: fallbackStart, end: fallbackEnd };

      default:
        const defaultStart = addDays(currentWeekStart, 2);
        defaultStart.setHours(0, 0, 0, 0);
        const defaultEnd = endOfWeek(now, { weekStartsOn: 1 });
        defaultEnd.setHours(23, 59, 59, 999);
        return { start: defaultStart, end: defaultEnd };
    }
  };

  const runDiagnostics = async () => {
    setIsLoading(true);
    try {
      const [allInvoices, allUsers] = await Promise.all([
        (await supabase.from('Invoice').select('*') /* TODO: restore sorting/limit '-created_date', 5000 */).data,
        (await supabase.from('User').select('*') /* TODO: restore sorting/limit '-created_date', 2000 */).data
      ]);

      setRawData({ invoices: allInvoices, users: allUsers });

      const { start: complianceStart, end: complianceEnd } = getDateRange();

      const activeContractors = allUsers.filter(user =>
        user.active !== false &&
        user.email &&
        (user.email.toLowerCase().includes('.contractor@m2fleetcom.com') ||
         user.email.toLowerCase().includes('.contractor@smcinstallations.com'))
      );

      const invoicesSubmittedThisWeek = allInvoices.filter(inv => {
        if (!inv.created_date) return false;
        try {
          const submittedCentral = toCentralTime(inv.created_date);
          if (!submittedCentral) return false;
          return submittedCentral >= complianceStart && submittedCentral <= complianceEnd;
        } catch (error) {
          console.error("Error parsing created_date for invoice:", inv.id, error);
          return false;
        }
      });

      const submittedEmailsMap = new Map();
      invoicesSubmittedThisWeek.forEach(inv => {
        if (inv.contractorEmail) {
          const normalizedEmail = inv.contractorEmail.toLowerCase().trim();
          if (!submittedEmailsMap.has(normalizedEmail)) {
            submittedEmailsMap.set(normalizedEmail, []);
          }
          submittedEmailsMap.get(normalizedEmail).push({
            fileName: inv.fileName,
            submittedDate: inv.created_date,
            weekEndingDate: inv.weekEndingDate
          });
        }
      });

      const missingContractors = [];
      const submittedContractors = [];
      
      activeContractors.forEach(contractor => {
        if (!contractor.email) return;
        const normalizedEmail = contractor.email.toLowerCase().trim();
        
        if (submittedEmailsMap.has(normalizedEmail)) {
          submittedContractors.push({
            name: contractor.displayName || contractor.full_name || contractor.email,
            email: contractor.email,
            invoices: submittedEmailsMap.get(normalizedEmail)
          });
        } else {
          missingContractors.push({
            name: contractor.displayName || contractor.full_name || contractor.email,
            email: contractor.email,
            project: contractor.project,
            active: contractor.active
          });
        }
      });

      const statusBreakdown = {
        pending: allInvoices.filter(inv => inv.status === 'pending').length,
        approved: allInvoices.filter(inv => inv.status === 'approved').length,
        rejected: allInvoices.filter(inv => inv.status === 'rejected').length,
        total: allInvoices.length
      };

      const approvedThisWeek = invoicesSubmittedThisWeek.filter(inv => inv.status === 'approved');
      const totalAmountThisWeek = approvedThisWeek.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
      
      const totalAmountAllTime = allInvoices
        .filter(inv => inv.status === 'approved')
        .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);

      const duplicates = [];
      const seen = new Map();
      allInvoices.forEach(inv => {
        const key = `${inv.contractorEmail?.toLowerCase()}_${inv.fileName?.toLowerCase()}_${inv.weekEndingDate}`;
        if (key && seen.has(key)) {
          duplicates.push({
            original: seen.get(key),
            duplicate: inv
          });
        } else if (key) {
          seen.set(key, inv);
        }
      });

      const dataIssues = [];
      allInvoices.forEach(inv => {
        if (!inv.contractorEmail) {
          dataIssues.push({ type: 'Missing Email', invoice: inv });
        }
        if (!inv.weekEndingDate) {
          dataIssues.push({ type: 'Missing Week Ending Date', invoice: inv });
        }
        if (!inv.created_date) {
          dataIssues.push({ type: 'Missing Created Date', invoice: inv });
        }
        if (inv.status === 'approved' && (!inv.totalAmount || inv.totalAmount <= 0)) {
          dataIssues.push({ type: 'Approved with No Amount or Zero Amount', invoice: inv });
        }
      });

      setDiagnostics({
        compliancePeriod: {
          start: complianceStart,
          end: complianceEnd
        },
        contractors: {
          total: activeContractors.length,
          submitted: submittedEmailsMap.size,
          missing: missingContractors.length,
          submittedList: submittedContractors,
          missingList: missingContractors
        },
        invoices: {
          thisWeek: invoicesSubmittedThisWeek.length,
          uniqueContractorsThisWeek: submittedEmailsMap.size,
          statusBreakdown,
          duplicates: duplicates.length,
          duplicatesList: duplicates,
          dataIssues: dataIssues.length,
          dataIssuesList: dataIssues
        },
        amounts: {
          thisWeekApproved: totalAmountThisWeek,
          allTimeApproved: totalAmountAllTime,
          averageInvoice: approvedThisWeek.length > 0 
            ? totalAmountThisWeek / approvedThisWeek.length 
            : 0
        }
      });

      console.log('===== DIAGNOSTIC DEBUG =====');
      console.log('Period:', {
        type: dateRangeType,
        start: format(complianceStart, 'yyyy-MM-dd HH:mm:ss') + ' CT',
        end: format(complianceEnd, 'yyyy-MM-dd HH:mm:ss') + ' CT'
      });
      console.log('Total active contractors:', activeContractors.length);
      console.log('Contractors who SUBMITTED:', submittedContractors.length);
      console.log('Contractors MISSING:', missingContractors.length);
      console.log('===================================');

    } catch (error) {
      console.error('Error running diagnostics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const exportDiagnostics = () => {
    const data = JSON.stringify(diagnostics, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagnostics-${new Date().toISOString()}.json`;
    a.click();
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="flex items-center space-x-2">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-gray-600">Running diagnostics...</span>
        </div>
      </div>
    );
  }

  if (!diagnostics) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Failed to load diagnostic data</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-orange-600" />
            Diagnostic Report
          </h1>
          <p className="text-gray-600 mt-1">Data accuracy check - Find discrepancies in reports</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={runDiagnostics} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={exportDiagnostics}>
            <Download className="w-4 h-4 mr-2" />
            Export JSON
          </Button>
        </div>
      </div>

      {/* Date Range Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select Reporting Period</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="dateRangeType" className="text-sm font-medium mb-2 block">Period Type</label>
              <Select value={dateRangeType} onValueChange={setDateRangeType}>
                <SelectTrigger id="dateRangeType">
                  <SelectValue placeholder="Select a period type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="this_week">This Week (Wed - Sun) - Compliance Window</SelectItem>
                  <SelectItem value="last_week">Last Week (Wed - Sun) - Compliance Window</SelectItem>
                  <SelectItem value="full_week">Full Week (Mon - Sun) - All Submissions</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {dateRangeType === 'custom' && (
              <div>
                <label className="text-sm font-medium mb-2 block">Custom Date Range</label>
                <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
                  <PopoverTrigger asChild>
                    <Button
                      id="date"
                      variant={"outline"}
                      className={`w-full justify-start text-left font-normal ${!customDateRange.from && "text-muted-foreground"}`}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {customDateRange.from ? (
                        customDateRange.to ? (
                          <>
                            {format(customDateRange.from, 'MMM d, yyyy')} -{" "}
                            {format(customDateRange.to, 'MMM d, yyyy')}
                          </>
                        ) : (
                          format(customDateRange.from, 'MMM d, yyyy')
                        )
                      ) : (
                        <span>Select date range</span>
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
          </div>
        </CardContent>
      </Card>

      {/* Compliance Period Display */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Active Reporting Period
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-2">Reports are checking this time period (Central Time):</p>
            <p className="font-bold text-lg text-blue-900">
              {format(diagnostics.compliancePeriod.start, 'EEEE, MMMM d, yyyy h:mm a')} Central
            </p>
            <p className="text-gray-600">to</p>
            <p className="font-bold text-lg text-blue-900">
              {format(diagnostics.compliancePeriod.end, 'EEEE, MMMM d, yyyy h:mm a')} Central
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">Active Contractors</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{diagnostics.contractors.total}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">Submitted in Period</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{diagnostics.contractors.submitted}</p>
            <p className="text-sm text-gray-500 mt-1">
              ({diagnostics.invoices.thisWeek} invoices total)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">Missing in Period</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-600">{diagnostics.contractors.missing}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">Total Approved ($)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">
              ${diagnostics.amounts.thisWeekApproved.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-sm text-gray-500 mt-1">For selected period</p>
          </CardContent>
        </Card>
      </div>

      {/* Data Quality Issues */}
      {diagnostics.invoices.dataIssues > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <AlertTriangle className="w-5 h-5" />
              Data Quality Issues ({diagnostics.invoices.dataIssues})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {diagnostics.invoices.dataIssuesList.slice(0, 10).map((issue, idx) => (
                <div key={idx} className="bg-white p-3 rounded border border-orange-200">
                  <Badge variant="outline" className="mb-2">{issue.type}</Badge>
                  <p className="text-sm">
                    <strong>Invoice:</strong> {issue.invoice.fileName || 'No filename'}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Contractor:</strong> {issue.invoice.contractorEmail || 'No email'}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Created:</strong> {issue.invoice.created_date ? format(new Date(issue.invoice.created_date), 'MMM d, yyyy') : 'Unknown'}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>ID:</strong> {issue.invoice.id ? issue.invoice.id.slice(-8) : 'Unknown'}
                  </p>
                </div>
              ))}
              {diagnostics.invoices.dataIssuesList.length > 10 && (
                <p className="text-sm text-gray-600 text-center mt-2">
                  ...and {diagnostics.invoices.dataIssuesList.length - 10} more issues
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Duplicates */}
      {diagnostics.invoices.duplicates > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="w-5 h-5" />
              Potential Duplicate Invoices ({diagnostics.invoices.duplicates})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-700 mb-4">
              These invoices have the same contractor, filename, and week ending date:
            </p>
            <div className="space-y-3">
              {diagnostics.invoices.duplicatesList.slice(0, 5).map((dup, idx) => (
                <div key={idx} className="bg-white p-3 rounded border border-red-200">
                  <p className="font-medium">{dup.original.fileName || 'Unknown Filename'}</p>
                  <p className="text-sm text-gray-600">{dup.original.contractorEmail || 'Unknown Contractor'}</p>
                  <p className="text-sm text-gray-600">Week Ending: {dup.original.weekEndingDate || 'Unknown'}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-gray-50 p-2 rounded">
                      <p className="font-medium">Original:</p>
                      <p>{dup.original.created_date ? format(new Date(dup.original.created_date), 'MMM d, yyyy h:mm a') : 'Unknown Date'}</p>
                      <p>ID: {dup.original.id ? dup.original.id.slice(-8) : 'Unknown'}</p>
                    </div>
                    <div className="bg-gray-50 p-2 rounded">
                      <p className="font-medium">Duplicate:</p>
                      <p>{dup.duplicate.created_date ? format(new Date(dup.duplicate.created_date), 'MMM d, yyyy h:mm a') : 'Unknown Date'}</p>
                      <p>ID: {dup.duplicate.id ? dup.duplicate.id.slice(-8) : 'Unknown'}</p>
                    </div>
                  </div>
                </div>
              ))}
              {diagnostics.invoices.duplicatesList.length > 5 && (
                <p className="text-sm text-gray-600 text-center mt-2">
                  ...and {diagnostics.invoices.duplicatesList.length - 5} more duplicates
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Invoice Status Breakdown (All Time)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-orange-600">
                {diagnostics.invoices.statusBreakdown.pending}
              </p>
              <p className="text-sm text-gray-600 mt-1">Pending</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">
                {diagnostics.invoices.statusBreakdown.approved}
              </p>
              <p className="text-sm text-gray-600 mt-1">Approved</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-red-600">
                {diagnostics.invoices.statusBreakdown.rejected}
              </p>
              <p className="text-sm text-gray-600 mt-1">Rejected</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-600">
                {diagnostics.invoices.statusBreakdown.total}
              </p>
              <p className="text-sm text-gray-600 mt-1">Total</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Who Submitted */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Contractors Who Submitted ({diagnostics.contractors.submitted})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {diagnostics.contractors.submittedList.map((contractor, idx) => (
              <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-green-50 rounded border border-green-200">
                <div className="mb-2 sm:mb-0">
                  <p className="font-medium text-gray-900">{contractor.name}</p>
                  <p className="text-sm text-gray-600">{contractor.email}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {contractor.invoices.map((inv, invIdx) => (
                    <Badge key={invIdx} className="bg-green-100 text-green-800 flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      <span className="truncate max-w-[150px]">{inv.fileName || 'Invoice'}</span>
                      <span className="text-xs">({format(new Date(inv.submittedDate), 'MM/dd')})</span>
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Who's Missing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            Contractors Missing in Period ({diagnostics.contractors.missing})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {diagnostics.contractors.missingList.map((contractor, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-orange-50 rounded border border-orange-200">
                <div>
                  <p className="font-medium text-gray-900">{contractor.name}</p>
                  <p className="text-sm text-gray-600">{contractor.email}</p>
                  {contractor.project && (
                    <p className="text-xs text-gray-500">Project: {contractor.project}</p>
                  )}
                </div>
                <Badge variant="outline" className={contractor.active === false ? 'bg-gray-100' : 'bg-orange-100 text-orange-800'}>
                  {contractor.active === false ? 'Inactive' : 'Active'}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}