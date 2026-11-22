import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, AlertTriangle, TrendingDown, TrendingUp, Calendar, Package } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval, format } from "date-fns";

export default function QCReports({ qcIssues, technicians }) {
  const [timePeriod, setTimePeriod] = useState("all");
  const [selectedTech, setSelectedTech] = useState("all");

  const getDateRange = () => {
    const now = new Date();
    switch (timePeriod) {
      case "week":
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case "month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "year":
        return { start: startOfYear(now), end: endOfYear(now) };
      default:
        return null;
    }
  };

  const filterIssuesByDate = (issues) => {
    const range = getDateRange();
    if (!range) return issues;
    
    return issues.filter(issue => {
      const issueDate = new Date(issue.install_service_date);
      return isWithinInterval(issueDate, range);
    });
  };

  const filterIssuesByTech = (issues) => {
    if (selectedTech === "all") return issues;
    return issues.filter(issue => issue.technician_id === selectedTech);
  };

  const filteredIssues = filterIssuesByTech(filterIssuesByDate(qcIssues));

  const techIssueCount = technicians.map(tech => {
    const issues = filteredIssues.filter(issue => issue.technician_id === tech.id);
    const pendingIssues = issues.filter(issue => issue.status === 'pending_repair').length;
    const repairedIssues = issues.filter(issue => issue.status === 'repaired' || issue.status === 'closed').length;
    const warrantyReturns = issues.filter(issue => issue.warranty_return_required).length;
    
    const categoryBreakdown = {};
    issues.forEach(issue => {
      const cat = issue.issue_category || 'other';
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
    });

    const customerBreakdown = {};
    issues.forEach(issue => {
      const customer = issue.work_order_name || 'Unknown';
      customerBreakdown[customer] = (customerBreakdown[customer] || 0) + 1;
    });

    return {
      ...tech,
      totalIssues: issues.length,
      pendingIssues,
      repairedIssues,
      warrantyReturns,
      categoryBreakdown,
      customerBreakdown,
      issues
    };
  }).filter(tech => selectedTech === "all" || tech.id === selectedTech)
    .sort((a, b) => b.totalIssues - a.totalIssues);

  const downloadReport = () => {
    const range = getDateRange();
    const periodLabel = timePeriod === "all" ? "All Time" : 
                       timePeriod === "week" ? `Week of ${format(range.start, 'MMM d, yyyy')}` :
                       timePeriod === "month" ? format(range.start, 'MMMM yyyy') :
                       format(range.start, 'yyyy');

    const csvContent = [
      [`QC Issues Report - ${periodLabel}`],
      [''],
      ['Technician', 'Total Issues', 'Pending', 'Repaired', 'Warranty Returns', 'Most Common Issue', 'Top Customer'],
      ...techIssueCount.map(tech => {
        const mostCommon = Object.entries(tech.categoryBreakdown).sort((a, b) => b[1] - a[1])[0];
        const topCustomer = Object.entries(tech.customerBreakdown).sort((a, b) => b[1] - a[1])[0];
        return [
          tech.full_name,
          tech.totalIssues,
          tech.pendingIssues,
          tech.repairedIssues,
          tech.warrantyReturns,
          mostCommon ? `${mostCommon[0].replace('_', ' ')} (${mostCommon[1]})` : 'N/A',
          topCustomer ? `${topCustomer[0]} (${topCustomer[1]})` : 'N/A'
        ];
      }),
      [''],
      ['Detailed Issues'],
      ['Date', 'Technician', 'Customer', 'Asset #', 'Issue', 'Category', 'Warranty Return', 'Status'],
      ...filteredIssues.map(issue => [
        format(new Date(issue.install_service_date), 'MM/dd/yyyy'),
        issue.technician_name || 'N/A',
        issue.work_order_name || 'N/A',
        issue.asset_number || 'N/A',
        issue.qc_notes?.substring(0, 100) || 'N/A',
        issue.issue_category?.replace('_', ' ') || 'N/A',
        issue.warranty_return_required ? 'Yes' : 'No',
        issue.status?.replace('_', ' ') || 'N/A'
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `qc-report-${timePeriod}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const totalIssues = filteredIssues.length;
  const pendingTotal = filteredIssues.filter(i => i.status === 'pending_repair').length;
  const repairedTotal = filteredIssues.filter(i => i.status === 'repaired' || i.status === 'closed').length;
  const warrantyReturnsTotal = filteredIssues.filter(i => i.warranty_return_required).length;
  const warrantyOpen = filteredIssues.filter(i => i.warranty_return_required && i.status !== 'closed').length;
  const warrantyCompletedNotVerified = filteredIssues.filter(i => i.warranty_return_required && i.repair_status === 'completed' && !i.qc_verified).length;
  const warrantyVerified = filteredIssues.filter(i => i.warranty_return_required && i.qc_verified).length;
  const warrantyReopened = filteredIssues.filter(i => i.warranty_return_required && i.repair_status === 'reopened').length;

  return (
    <div className="space-y-6">
      <Card className="material-card shadow-md">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle>Report Filters</CardTitle>
            <div className="flex flex-wrap gap-3">
              <Select value={timePeriod} onValueChange={setTimePeriod}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="year">This Year</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedTech} onValueChange={setSelectedTech}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Technicians</SelectItem>
                  {technicians.map(tech => (
                    <SelectItem key={tech.id} value={tech.id}>
                      {tech.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="material-card shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              {timePeriod === "all" ? "Total QC Issues" : 
               timePeriod === "week" ? "This Week" :
               timePeriod === "month" ? "This Month" : "This Year"}
            </CardTitle>
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{totalIssues}</div>
            <p className="text-xs text-gray-500 mt-1">
              {selectedTech === "all" ? "All technicians" : technicians.find(t => t.id === selectedTech)?.full_name}
            </p>
          </CardContent>
        </Card>

        <Card className="material-card shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Pending Repairs</CardTitle>
            <TrendingUp className="h-5 w-5 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{pendingTotal}</div>
            <p className="text-xs text-gray-500 mt-1">Needs attention</p>
          </CardContent>
        </Card>

        <Card className="material-card shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Resolved</CardTitle>
            <TrendingDown className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{repairedTotal}</div>
            <p className="text-xs text-gray-500 mt-1">Completed</p>
          </CardContent>
        </Card>

        <Card className="material-card shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Warranty Returns</CardTitle>
            <Package className="h-5 w-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{warrantyReturnsTotal}</div>
            <p className="text-xs text-gray-500 mt-1">Return required</p>
          </CardContent>
        </Card>
      </div>

      {/* Warranty Resolution Summary */}
      {warrantyReturnsTotal > 0 && (
        <Card className="material-card shadow-md border-purple-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Package className="w-4 h-4 text-purple-600" /> Warranty Resolution Tracking</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-purple-700">{warrantyReturnsTotal}</div>
                <div className="text-xs text-gray-500 mt-1">Total Warranty Returns</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-orange-600">{warrantyOpen}</div>
                <div className="text-xs text-gray-500 mt-1">Open</div>
              </div>
              <div className="bg-indigo-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-indigo-600">{warrantyCompletedNotVerified}</div>
                <div className="text-xs text-gray-500 mt-1">Completed (Not Verified)</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-600">{warrantyVerified}</div>
                <div className="text-xs text-gray-500 mt-1">Verified Resolutions</div>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-red-600">{warrantyReopened}</div>
                <div className="text-xs text-gray-500 mt-1">Reopened Issues</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6" style={{display:'none'}}></div>

      <Card className="material-card shadow-md">
        <CardHeader className="border-b">
          <div className="flex justify-between items-center">
            <CardTitle>Issues by Technician</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadReport}
              className="ripple"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Report
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Technician</TableHead>
                <TableHead className="text-center">Total Issues</TableHead>
                <TableHead className="text-center">Pending</TableHead>
                <TableHead className="text-center">Repaired</TableHead>
                <TableHead className="text-center">Warranty Returns</TableHead>
                <TableHead>Most Common Issue</TableHead>
                <TableHead>Top Customer</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {techIssueCount.map((tech) => {
                const mostCommon = Object.entries(tech.categoryBreakdown).sort((a, b) => b[1] - a[1])[0];
                const topCustomer = Object.entries(tech.customerBreakdown).sort((a, b) => b[1] - a[1])[0];
                return (
                  <TableRow key={tech.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                          {tech.full_name.charAt(0)}
                        </div>
                        {tech.full_name}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-gray-100">
                        {tech.totalIssues}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-orange-100 text-orange-800">
                        {tech.pendingIssues}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-green-100 text-green-800">
                        {tech.repairedIssues}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-purple-100 text-purple-800">
                        {tech.warrantyReturns}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {mostCommon ? (
                        <span className="text-sm">
                          {mostCommon[0].replace('_', ' ')} ({mostCommon[1]})
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {topCustomer ? (
                        <span className="text-sm truncate block max-w-xs">
                          {topCustomer[0]} ({topCustomer[1]})
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">N/A</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {techIssueCount.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    No QC issues found for the selected filters
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedTech !== "all" && techIssueCount.length > 0 && (
        <Card className="material-card shadow-md">
          <CardHeader className="border-b">
            <CardTitle>Issue Category Breakdown for {techIssueCount[0].full_name}</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(techIssueCount[0].categoryBreakdown).map(([category, count]) => (
                <div key={category} className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">{count}</div>
                  <div className="text-sm text-gray-600 mt-1">{category.replace('_', ' ')}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}