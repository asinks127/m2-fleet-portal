import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, BarChart, Bar } from 'recharts';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from 'date-fns';

export default function PerformanceTrends({ inspections = [], callLogs = [] }) {
  const chartData = useMemo(() => {
    // Generate last 6 months buckets
    const end = new Date();
    const start = subMonths(end, 5);
    const months = eachMonthOfInterval({ start, end });

    return months.map(date => {
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);
      const monthLabel = format(date, 'MMM yyyy');

      // Filter data for this month
      const monthInspections = inspections.filter(i => {
        const d = new Date(i.inspectionDate);
        return d >= monthStart && d <= monthEnd;
      });

      const monthCalls = callLogs.filter(c => {
        const d = new Date(c.callDate);
        return d >= monthStart && d <= monthEnd;
      });

      // Calculate stats
      const avgScore = monthInspections.length > 0
        ? Math.round(monthInspections.reduce((sum, i) => sum + (i.score || 0), 0) / monthInspections.length)
        : null;

      return {
        name: monthLabel,
        avgQCScore: avgScore,
        inspectionCount: monthInspections.length,
        callCount: monthCalls.length,
      };
    });
  }, [inspections, callLogs]);

  return (
    <div className="grid md:grid-cols-2 gap-6 mb-6">
      <Card>
        <CardHeader>
          <CardTitle>Average QC Score Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="avgQCScore" stroke="#2563eb" name="Avg QC Score" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity Volume</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="inspectionCount" fill="#16a34a" name="Inspections" />
                <Bar dataKey="callCount" fill="#f59e0b" name="Calls Logged" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}