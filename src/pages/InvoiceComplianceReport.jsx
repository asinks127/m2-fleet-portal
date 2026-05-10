
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx';
import { CheckCircle, XCircle, Loader2, Download } from 'lucide-react';
import { startOfWeek, endOfWeek, format, subWeeks, addDays } from 'date-fns';

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
  // When 'new Date()' is called with YYYY, MM, DD, hh, mm, ss it constructs a date
  // in the local timezone. By supplying components that are already in Central Time,
  // we effectively create a Date object whose local time components *are* Central Time.
  // This allows direct comparison with other Date objects constructed this way.
  return new Date(
    parseInt(dateObj.year),
    parseInt(dateObj.month) - 1, // Month is 0-indexed
    parseInt(dateObj.day),
    parseInt(dateObj.hour),
    parseInt(dateObj.minute),
    parseInt(dateObj.second)
  );
};

export default function InvoiceComplianceReport() {
  const [invoices, setInvoices] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [sendingReport, setSendingReport] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(null);
  const [reportError, setReportError] = useState(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [invoiceData, userData] = await Promise.all([
          (await supabase.from('Invoice').select('*') /* TODO: restore sorting/limit '-created_date', 2000 */).data,
          (await supabase.from('User').select('*').match({ active: true })).data
        ]);
        setInvoices(invoiceData);
        setUsers(userData);
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // Calculate compliance period in Central Time
  const { compliancePeriodStart, compliancePeriodEnd, weekLabel } = useMemo(() => {
    const today = new Date();
    const referenceDateForPeriod = subWeeks(today, weekOffset);
    
    // Convert the reference date to a Date object whose local components reflect Central Time.
    // This allows date-fns functions to correctly manipulate the "Central Time" components.
    const centralReference = toCentralTime(referenceDateForPeriod);
    
    // Get Monday of the week in Central Time
    const mondayOfWeek = startOfWeek(centralReference, { weekStartsOn: 1 });
    
    // Compliance period starts Wednesday at midnight Central Time
    const complianceStart = addDays(mondayOfWeek, 2);
    complianceStart.setHours(0, 0, 0, 0); // Set to midnight based on its "local" Central Time components
    
    // Compliance period ends Sunday at 11:59:59 PM Central Time
    const complianceEnd = endOfWeek(centralReference, { weekStartsOn: 1 });
    complianceEnd.setHours(23, 59, 59, 999); // Set to end of day based on its "local" Central Time components

    // The week label also uses the "Central Time represented" dates
    const weekLabel = `${format(mondayOfWeek, 'MMM d')} - ${format(complianceEnd, 'MMM d, yyyy')}`;
    
    return { 
      compliancePeriodStart: complianceStart, 
      compliancePeriodEnd: complianceEnd,
      weekLabel 
    };
  }, [weekOffset]);

  const complianceData = useMemo(() => {
    if (users.length === 0) return [];

    const activeContractors = users.filter(user =>
      user.active &&
      user.email &&
      (user.email.toLowerCase().includes('.contractor@m2fleetcom.com') ||
       user.email.toLowerCase().includes('.contractor@smcinstallations.com'))
    );
    
    // Filter by submission date in Central Time
    const submittedEmails = new Set(
      invoices
        .filter(inv => {
          if (!inv.created_date) return false;
          try {
            // `inv.created_date` is expected to be an ISO 8601 string (UTC).
            // `new Date(string)` correctly parses it into a Date object representing UTC.
            const submittedUTC = new Date(inv.created_date);
            
            // Convert this UTC Date object to our custom 'Central Time represented' Date object
            const submittedCentral = toCentralTime(submittedUTC);
            
            // Check if submitted within the Central Time compliance window using the custom Date objects
            return submittedCentral >= compliancePeriodStart && submittedCentral <= compliancePeriodEnd;
          } catch {
            return false;
          }
        })
        .map(inv => inv.contractorEmail?.toLowerCase())
    );

    return activeContractors.map(contractor => ({
      ...contractor,
      submitted: submittedEmails.has(contractor.email?.toLowerCase()),
    })).sort((a, b) => (a.displayName || a.full_name || '').localeCompare(b.displayName || b.full_name || ''));
  }, [users, invoices, compliancePeriodStart, compliancePeriodEnd]);

  const handleSendCorrectedReport = async () => {
    if (weekOffset !== 1) {
      alert('Please select "Last Week" to send the corrected report.');
      return;
    }

    setSendingReport(true);
    setReportSuccess(null);
    setReportError(null);

    try {
      const response = await (await fetch('/api/sendCorrectedComplianceReport', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })).json();
      
      if (response.data.success) {
        setReportSuccess(
          `Corrected report sent successfully! ${response.data.compliant} compliant, ${response.data.nonCompliant} non-compliant out of ${response.data.total} total.`
        );
      } else {
        setReportError('Failed to send corrected report.');
      }
    } catch (error) {
      console.error('Error sending corrected report:', error);
      setReportError('Failed to send corrected report: ' + error.message);
    } finally {
      setSendingReport(false);
    }
  };

  const handleExport = () => {
    const headers = ['Contractor', 'Email', 'Project', 'M2 PM', 'Status'];
    const rows = complianceData.map(item => [
        `"${item.displayName || item.full_name || ''}"`,
        item.email,
        item.project || 'N/A',
        item.m2PM || 'N/A',
        item.submitted ? 'Submitted' : 'Missing'
    ].join(','));
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `compliance-report-${format(compliancePeriodStart, 'yyyy-MM-dd')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 mr-2 animate-spin" /> Loading Report...
      </div>
    );
  }

  const compliantCount = complianceData.filter(d => d.submitted).length;
  const nonCompliantCount = complianceData.filter(d => !d.submitted).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Invoice Compliance Report</h1>
          <p className="text-gray-600 mt-1">
            Track which contractors submitted invoices by the Sunday 11:59 PM Central Time deadline
          </p>
        </div>
        <div className="flex gap-2">
          {weekOffset === 1 && (
            <Button
              onClick={handleSendCorrectedReport}
              disabled={sendingReport}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {sendingReport ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  🔄 Send Corrected Report
                </>
              )}
            </Button>
          )}
          <Button onClick={handleExport} disabled={complianceData.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {reportSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          {reportSuccess}
        </div>
      )}
      
      {reportError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {reportError}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Select Week</CardTitle>
            <Select
              value={weekOffset.toString()}
              onValueChange={(val) => {
                setWeekOffset(parseInt(val));
                setReportSuccess(null);
                setReportError(null);
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select week" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">This Week</SelectItem>
                <SelectItem value="1">Last Week</SelectItem>
                <SelectItem value="2">2 Weeks Ago</SelectItem>
                <SelectItem value="3">3 Weeks Ago</SelectItem>
                <SelectItem value="4">4 Weeks Ago</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Viewing: <strong>{weekLabel}</strong> (Central Time)
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
            <p className="text-sm text-blue-900 font-medium mb-2">
              📅 Compliance Window (Central Time)
            </p>
            <p className="text-blue-800">
              <strong>Submissions counted from:</strong> {format(compliancePeriodStart, 'EEEE, MMMM d, yyyy')} at 12:00 AM Central
            </p>
            <p className="text-blue-800">
              <strong>Through:</strong> {format(compliancePeriodEnd, 'EEEE, MMMM d, yyyy')} at 11:59 PM Central
            </p>
            <p className="text-xs text-blue-700 mt-2">
              💡 <strong>One deadline for everyone:</strong> All invoices must be submitted by 11:59 PM Sunday Central Time, regardless of contractor location.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900">{complianceData.length}</div>
                  <div className="text-sm text-gray-600 mt-1">Total Active Contractors</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">{compliantCount}</div>
                  <div className="text-sm text-gray-600 mt-1">Compliant</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600">{nonCompliantCount}</div>
                  <div className="text-sm text-gray-600 mt-1">Non-Compliant</div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="bg-white rounded-lg shadow-md border overflow-hidden">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Contractor</TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>QC Assignment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {complianceData.map((contractor) => (
                  <TableRow key={contractor.id}>
                    <TableCell>
                      {contractor.submitted ? (
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Compliant
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800">
                          <XCircle className="w-4 h-4 mr-1" />
                          Missing
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{contractor.displayName || contractor.full_name}</p>
                      <p className="text-sm text-gray-500">{contractor.email}</p>
                    </TableCell>
                    <TableCell>{contractor.business || 'N/A'}</TableCell>
                    <TableCell>{contractor.project || 'N/A'}</TableCell>
                    <TableCell>{contractor.qcAssignment || 'N/A'}</TableCell>
                  </TableRow>
                ))}
                {complianceData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24">
                      No active contractors found for this period.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
