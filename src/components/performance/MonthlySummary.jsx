import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { format, startOfMonth, endOfMonth, subMonths, isSameMonth } from 'date-fns';
import { Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function MonthlySummary({ users = [], inspections = [], callLogs = [] }) {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

  // Generate last 12 months options
  const monthOptions = useMemo(() => {
    const options = [];
    for (let i = 0; i < 12; i++) {
      const d = subMonths(new Date(), i);
      options.push({
        value: format(d, 'yyyy-MM'),
        label: format(d, 'MMMM yyyy')
      });
    }
    return options;
  }, []);

  const summaryData = useMemo(() => {
    const [year, month] = selectedMonth.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);

    // Filter data for selected month
    const monthInspections = inspections.filter(i => {
      const d = new Date(i.inspectionDate);
      return d >= monthStart && d <= monthEnd;
    });

    const monthCalls = callLogs.filter(c => {
      const d = new Date(c.callDate);
      return d >= monthStart && d <= monthEnd;
    });

    // Aggregate by user
    const userStats = users.map(user => {
      const userInspections = monthInspections.filter(i => i.technicianId === user.id);
      const userCalls = monthCalls.filter(c => c.technicianId === user.id);
      
      const avgScore = userInspections.length > 0
        ? Math.round(userInspections.reduce((sum, i) => sum + (i.score || 0), 0) / userInspections.length)
        : null;

      return {
        ...user,
        stats: {
          inspectionCount: userInspections.length,
          avgScore,
          callCount: userCalls.length
        }
      };
    }).filter(u => u.stats.inspectionCount > 0 || u.stats.callCount > 0); // Only show active users

    // Sort by Avg Score desc, then Name
    return userStats.sort((a, b) => {
      if ((b.stats.avgScore || 0) !== (a.stats.avgScore || 0)) {
        return (b.stats.avgScore || 0) - (a.stats.avgScore || 0);
      }
      return (a.displayName || a.full_name || '').localeCompare(b.displayName || b.full_name || '');
    });
  }, [selectedMonth, users, inspections, callLogs]);

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const [year, month] = selectedMonth.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    const monthLabel = format(date, 'MMMM yyyy');

    doc.setFontSize(18);
    doc.text(`Performance Summary - ${monthLabel}`, 14, 20);
    
    doc.setFontSize(11);
    doc.text(`Generated on ${format(new Date(), 'MMM d, yyyy')}`, 14, 30);

    const tableColumn = ["Technician", "Project", "Inspections", "Avg QC Score", "Calls Logged"];
    const tableRows = summaryData.map(user => [
      user.displayName || user.full_name || user.email,
      user.project || 'N/A',
      user.stats.inspectionCount,
      user.stats.avgScore !== null ? `${user.stats.avgScore}%` : 'N/A',
      user.stats.callCount
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235] }
    });

    doc.save(`Performance_Summary_${selectedMonth}.pdf`);
  };

  const getScoreColor = (score) => {
    if (score === null) return 'bg-gray-100 text-gray-500';
    if (score >= 90) return 'bg-green-100 text-green-800';
    if (score >= 70) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Monthly Performance Summary</CardTitle>
        <div className="flex gap-3">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select Month" />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExportPDF} disabled={summaryData.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Technician</TableHead>
                <TableHead>Project</TableHead>
                <TableHead className="text-center">Inspections</TableHead>
                <TableHead className="text-center">Avg QC Score</TableHead>
                <TableHead className="text-center">Calls Logged</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaryData.length > 0 ? (
                summaryData.map(user => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.displayName || user.full_name || user.email}
                    </TableCell>
                    <TableCell>{user.project || 'N/A'}</TableCell>
                    <TableCell className="text-center">{user.stats.inspectionCount}</TableCell>
                    <TableCell className="text-center">
                      <Badge className={getScoreColor(user.stats.avgScore)}>
                        {user.stats.avgScore !== null ? `${user.stats.avgScore}%` : 'N/A'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{user.stats.callCount}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    No activity found for this month.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}