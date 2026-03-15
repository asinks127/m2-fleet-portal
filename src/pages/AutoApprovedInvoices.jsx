
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { Card, CardContent, CardHeader } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import {
  Zap,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Info,
  ExternalLink
} from 'lucide-react';
import {
  startOfWeek,
  endOfWeek,
  format,
  addWeeks,
  subWeeks,
  isWithinInterval,
  parseISO
} from 'date-fns';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx';

export default function AutoApprovedInvoices() {
  const [autoApprovedInvoices, setAutoApprovedInvoices] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const weekStartsOn = 1; // Set week start to Monday (0 for Sunday, 1 for Monday, ..., 5 for Friday)

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [
        { data: invoices, error: invError },
        { data: users, error: userError }
      ] = await Promise.all([
        supabase.from('Invoice')
          .select('*')
          .eq('autoApproved', true)
          .order('approvedDate', { ascending: false })
          .limit(2000),
        supabase.from('User').select('*')
      ]);

      if (invError) throw invError;
      if (userError) throw userError;

      const weekStart = startOfWeek(selectedDate, { weekStartsOn });
      const weekEnd = endOfWeek(selectedDate, { weekStartsOn });

      const filteredInvoices = invoices.filter(inv => {
        if (!inv.approvedDate) return false;
        const approvedDate = parseISO(inv.approvedDate);
        return isWithinInterval(approvedDate, { start: weekStart, end: weekEnd });
      });

      const enhancedInvoices = filteredInvoices.map(inv => {
        const contractor = users.find(u => u.email === inv.contractorEmail) || {};
        return {
          ...inv,
          expectedWeeklyPay: contractor.weeklyPay || null,
          contractorProject: contractor.project || 'N/A',
          m2PM: contractor.m2PM || 'N/A',
          veloPM: contractor.veloPM || 'N/A',
        };
      });

      enhancedInvoices.sort((a, b) => (a.contractorName || '').localeCompare(b.contractorName || ''));
      setAutoApprovedInvoices(enhancedInvoices);
    } catch (err) {
      console.error("Failed to load auto-approved invoices:", err);
      setError("Could not load auto-approved invoice data. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, weekStartsOn]); // Added weekStartsOn to dependencies for completeness, though it's constant

  useEffect(() => {
    loadData();
  }, [selectedDate, loadData]);

  const weekStart = useMemo(() => startOfWeek(selectedDate, { weekStartsOn }), [selectedDate, weekStartsOn]);
  const weekEnd = useMemo(() => endOfWeek(selectedDate, { weekStartsOn }), [selectedDate, weekStartsOn]);

  const handlePreviousWeek = () => setSelectedDate(subWeeks(selectedDate, 1));
  const handleNextWeek = () => setSelectedDate(addWeeks(selectedDate, 1));
  const handleToday = () => setSelectedDate(new Date());

  const handleExport = () => {
    if (autoApprovedInvoices.length === 0) return;

    const headers = [
      'Contractor Name', 'Project', 'M2 PM', 'Velo PM', 'File Name',
      'Total Amount', 'Expected Weekly Pay', 'Approved Date', 'Week Ending'
    ];

    const csvData = autoApprovedInvoices.map(invoice => ({
      'Contractor Name': invoice.contractorName || 'N/A',
      'Project': invoice.contractorProject || 'N/A',
      'M2 PM': invoice.m2PM || 'N/A',
      'Velo PM': invoice.veloPM || 'N/A',
      'File Name': invoice.fileName || 'N/A',
      'Total Amount': `$${(invoice.totalAmount || 0).toLocaleString()}`,
      'Expected Weekly Pay': invoice.expectedWeeklyPay ? `$${invoice.expectedWeeklyPay.toLocaleString()}` : 'Not Set',
      'Approved Date': invoice.approvedDate ? format(parseISO(invoice.approvedDate), 'MMM d, yyyy') : 'N/A',
      'Week Ending': format(weekEnd, 'MMM d, yyyy')
    }));

    const csvRows = csvData.map(row => headers.map(header => `"${String(row[header] === null || row[header] === undefined ? '' : row[header]).replace(/"/g, '""')}"`).join(','));
    const csvContent = [headers.join(','), ...csvRows].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auto-approved-invoices-${format(weekStart, 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-gray-600">Loading Auto-Approved Invoices...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Zap className="w-8 h-8 text-purple-500" />
            Auto-Approved Invoices Report
          </h1>
          <p className="text-gray-600 mt-1">Review all invoices approved automatically by the AI system.</p>
        </div>
        <Button
          onClick={handleExport}
          disabled={autoApprovedInvoices.length === 0}
          variant="outline"
        >
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={handlePreviousWeek}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-xl font-semibold text-center">
              {format(weekStart, 'MMM d, yyyy')} - {format(weekEnd, 'MMM d, yyyy')}
            </h2>
            <Button variant="outline" size="icon" onClick={handleNextWeek}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <Button variant="outline" onClick={handleToday}>
            This Week
          </Button>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {autoApprovedInvoices.length === 0 ? (
            <div className="text-center py-16">
              <Info className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold">No Auto-Approved Invoices Found</h3>
              <p className="text-gray-500 mt-1">There were no invoices automatically approved during this week.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contractor</TableHead>
                  <TableHead>Project Info</TableHead>
                  <TableHead>Invoice Details</TableHead>
                  <TableHead>Expected vs Actual</TableHead>
                  <TableHead>View</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {autoApprovedInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{invoice.contractorName}</div>
                        <div className="text-sm text-gray-500">{invoice.contractorEmail}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div><strong>Project:</strong> {invoice.contractorProject}</div>
                        <div><strong>M2 PM:</strong> {invoice.m2PM}</div>
                        <div><strong>Velo PM:</strong> {invoice.veloPM}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{invoice.fileName}</div>
                        <div className="text-sm text-gray-500">
                          Amount: <strong>${(invoice.totalAmount || 0).toLocaleString()}</strong>
                        </div>
                        <div className="text-sm text-gray-500">
                          Approved: {invoice.approvedDate ? format(parseISO(invoice.approvedDate), 'MMM d, yyyy') : 'N/A'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {invoice.expectedWeeklyPay ? (
                          <>
                            <div><strong>Expected:</strong> ${invoice.expectedWeeklyPay.toLocaleString()}</div>
                            <div><strong>Actual:</strong> ${(invoice.totalAmount || 0).toLocaleString()}</div>
                            <div className={`font-medium ${
                              (invoice.totalAmount || 0) >= invoice.expectedWeeklyPay
                                ? 'text-green-600'
                                : 'text-red-600'
                            }`}>
                              <strong>Difference:</strong> ${((invoice.totalAmount || 0) - invoice.expectedWeeklyPay).toFixed(2)}
                            </div>
                          </>
                        ) : (
                          <div className="text-gray-500">Expected pay not set</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {invoice.fileUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(invoice.fileUrl, '_blank')}
                            disabled={!invoice.fileUrl}
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            View
                          </Button>
                        )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
