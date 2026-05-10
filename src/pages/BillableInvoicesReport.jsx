import React, { useState, useEffect, useMemo } from 'react';
import { Invoice } from '@/entities/Invoice';
import { User } from '@/entities/User';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import {
  FileText,
  Calendar,
  Download,
  ArrowLeft,
  DollarSign,
  Search,
  PieChart,
  Filter
} from 'lucide-react';

export default function BillableInvoicesReport() {
  const [invoices, setInvoices] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [dateRange, setDateRange] = useState({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [billableFilter, setBillableFilter] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [invoiceData, userData] = await Promise.all([
        Invoice.list('-created_date', 5000),
        User.list()
      ]);
      setInvoices(invoiceData);
      setContractors(userData);
    } catch (error) {
      console.error('Error loading report data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getContractorInfo = (email) => {
    return contractors.find(c => c.email === email) || {};
  };

  // Filter invoices by date and filters
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      // Date filter (using created_date for submission date, or weekEndingDate if preferred. We'll use created_date here)
      const invDate = new Date(inv.created_date);
      if (dateRange.from && invDate < dateRange.from) return false;
      if (dateRange.to && invDate > dateRange.to) return false;

      // Billable filter
      const isBillable = inv.billable !== false;
      if (billableFilter === 'billable' && !isBillable) return false;
      if (billableFilter === 'non-billable' && isBillable) return false;

      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const contractor = getContractorInfo(inv.contractorEmail);
        const nameMatch = (inv.contractorName || '').toLowerCase().includes(search);
        const fileMatch = (inv.fileName || '').toLowerCase().includes(search);
        const pmMatch = (contractor.m2PM || '').toLowerCase().includes(search);
        if (!nameMatch && !fileMatch && !pmMatch) return false;
      }

      return true;
    }).sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  }, [invoices, dateRange, billableFilter, searchTerm, contractors]);

  // Aggregate stats
  const stats = useMemo(() => {
    let billableCount = 0;
    let nonBillableCount = 0;
    let billableAmount = 0;
    let nonBillableAmount = 0;

    filteredInvoices.forEach(inv => {
      const amount = inv.totalAmount || 0;
      if (inv.billable !== false) {
        billableCount++;
        billableAmount += amount;
      } else {
        nonBillableCount++;
        nonBillableAmount += amount;
      }
    });

    return {
      totalCount: filteredInvoices.length,
      totalAmount: billableAmount + nonBillableAmount,
      billableCount,
      nonBillableCount,
      billableAmount,
      nonBillableAmount
    };
  }, [filteredInvoices]);

  const handleExport = () => {
    const headers = [
      'Submitted Date', 'Week Ending', 'Contractor', 'Business', 'Project', 'M2 PM',
      'File Name', 'Status', 'Billable', 'Amount', 'Days Worked'
    ];

    const rows = filteredInvoices.map(inv => {
      const contractor = getContractorInfo(inv.contractorEmail);
      return [
        format(new Date(inv.created_date), 'MM/dd/yyyy'),
        inv.weekEndingDate ? format(new Date(inv.weekEndingDate), 'MM/dd/yyyy') : 'N/A',
        inv.contractorName || 'N/A',
        contractor.business || 'N/A',
        contractor.project || 'N/A',
        contractor.m2PM || 'N/A',
        inv.fileName || 'N/A',
        inv.status || 'N/A',
        inv.billable !== false ? 'Yes' : 'No',
        inv.totalAmount || 0,
        inv.daysWorked || 0
      ];
    });

    const csvContent = [
      headers.map(h => `"${h}"`).join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `billable-invoices-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  const presetDateRanges = [
    { label: 'This Month', getValue: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
    { label: 'Last Month', getValue: () => {
        const lastMonth = subMonths(new Date(), 1);
        return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
    }}
  ];

  if (isLoading) {
    return <div className="p-6 text-center text-gray-500">Loading report data...</div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-start">
        <div>
          <Link to={createPageUrl('ReportsHub')} className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Reports Hub
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <PieChart className="w-8 h-8" />
            Billable Invoices Report
          </h1>
          <p className="text-gray-600 mt-1">Review and export invoices categorized by billable status</p>
        </div>
        <Button onClick={handleExport} className="bg-green-600 hover:bg-green-700" disabled={filteredInvoices.length === 0}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <Card className="bg-white shadow-sm border border-gray-200">
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Date Range Start */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">From Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal bg-white">
                      <Calendar className="mr-2 h-4 w-4" />
                      {dateRange.from ? format(dateRange.from, 'MMM d, yyyy') : 'Pick start date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={dateRange.from}
                      onSelect={(date) => {
                        if (date) {
                          date.setHours(0, 0, 0, 0);
                          setDateRange({ ...dateRange, from: date });
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Date Range End */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">To Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal bg-white">
                      <Calendar className="mr-2 h-4 w-4" />
                      {dateRange.to ? format(dateRange.to, 'MMM d, yyyy') : 'Pick end date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={dateRange.to}
                      onSelect={(date) => {
                        if (date) {
                          date.setHours(23, 59, 59, 999);
                          setDateRange({ ...dateRange, to: date });
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Billable Filter */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Billing Status</label>
                <Select value={billableFilter} onValueChange={setBillableFilter}>
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder="All Invoices" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Invoices</SelectItem>
                    <SelectItem value="billable">Billable Only</SelectItem>
                    <SelectItem value="non-billable">Non-Billable Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Search */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Search</label>
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Contractor, PM, file..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 bg-white"
                  />
                </div>
              </div>

            </div>
          </div>
          
          <div className="flex gap-2 pt-2">
            {presetDateRanges.map(preset => (
              <Button 
                key={preset.label}
                variant="secondary" 
                size="sm" 
                onClick={() => setDateRange(preset.getValue())}
                className="text-xs"
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-blue-50 border-blue-100">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-blue-800">Total Invoices</p>
                <p className="text-3xl font-bold text-blue-900 mt-2">{stats.totalCount}</p>
                <p className="text-sm text-blue-700 mt-1">${stats.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-100">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-green-800">Billable</p>
                <p className="text-3xl font-bold text-green-900 mt-2">{stats.billableCount}</p>
                <p className="text-sm text-green-700 mt-1">${stats.billableAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-50 border-gray-200">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-800">Non-Billable</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.nonBillableCount}</p>
                <p className="text-sm text-gray-700 mt-1">${stats.nonBillableAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="p-3 bg-gray-200 rounded-full">
                <Filter className="w-6 h-6 text-gray-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoice Records ({filteredInvoices.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredInvoices.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No invoices found for the selected criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3">Contractor</th>
                    <th className="px-4 py-3">File Name</th>
                    <th className="px-4 py-3">Submitted</th>
                    <th className="px-4 py-3">Week Ending</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Billing</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredInvoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {inv.contractorName}
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate" title={inv.fileName}>
                        {inv.fileName}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {format(new Date(inv.created_date), 'MMM d, yyyy')}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {inv.weekEndingDate ? format(new Date(inv.weekEndingDate), 'MMM d, yyyy') : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="capitalize text-xs">
                          {inv.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={inv.billable !== false ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-700 border-gray-200'}>
                          {inv.billable !== false ? 'Billable' : 'Non-Billable'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {inv.totalAmount != null ? `$${inv.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}