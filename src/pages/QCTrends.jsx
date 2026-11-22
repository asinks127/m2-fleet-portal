import React, { useState, useMemo } from "react";
import { base44 } from "@/api/warrantyClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { Download, TrendingUp } from "lucide-react";
import { subDays, format, startOfWeek } from "date-fns";
import { isValidRecord, isActiveWarrantyIssue } from "../lib/qcFilters";

const COLORS = ['#3b82f6', '#f97316', '#8b5cf6', '#22c55e', '#ef4444', '#eab308', '#06b6d4'];

export default function QCTrends() {
  const [period, setPeriod] = useState("90");
  const [techFilter, setTechFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");

  const { data: issues = [], isLoading } = useQuery({
    queryKey: ['qcIssues'],
    queryFn: () => base44.entities.QCIssue.list('-created_date'),
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => base44.entities.Technician.list(),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.WarrantyProject.list(),
  });

  // Apply validity gate first, then time/tech/project filters
  const filtered = useMemo(() => {
    const cutoff = subDays(new Date(), parseInt(period));
    return issues.filter(i => {
      if (!isValidRecord(i)) return false;
      const dateStr = i.qc_event_date || i.install_service_date || i.date_received;
      const d = dateStr ? new Date(dateStr) : new Date(i.created_date);
      const inPeriod = d >= cutoff;
      const byTech = techFilter === 'all' || i.technician_id === techFilter;
      const byProject = projectFilter === 'all' || i.project_id === projectFilter;
      return inPeriod && byTech && byProject;
    });
  }, [issues, period, techFilter, projectFilter]);

  // Issues over time (weekly)
  const weeklyData = useMemo(() => {
    const buckets = {};
    for (const issue of filtered) {
      const d = new Date(issue.qc_event_date || issue.date_received || issue.created_date);
      const week = format(startOfWeek(d), 'MM/dd');
      buckets[week] = (buckets[week] || 0) + 1;
    }
    return Object.entries(buckets).sort((a, b) => new Date(a[0]) - new Date(b[0])).map(([week, count]) => ({ week, count }));
  }, [filtered]);

  // Category breakdown
  const LEGACY_CAT_MAP = {
    camera_positioning: 'Installation Quality',
    mirror_adjustment: 'Installation Quality',
    mounting: 'Installation Quality',
    connection_issue: 'Functional Failure',
    equipment_missing: 'Functional Failure',
    installation_quality: 'Installation Quality',
    other: 'Verification Failure',
  };
  const categoryData = useMemo(() => {
    const map = {};
    for (const issue of filtered) {
      const cat = issue.qc_category
        || LEGACY_CAT_MAP[issue.auto_category]
        || LEGACY_CAT_MAP[issue.final_category]
        || LEGACY_CAT_MAP[issue.issue_category]
        || 'Unclassified';
      map[cat] = (map[cat] || 0) + 1;
    }
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  // Top technicians by weighted score
  const techData = useMemo(() => {
    const map = {};
    for (const issue of filtered) {
      if (issue.technician_name) {
        map[issue.technician_name] = (map[issue.technician_name] || 0) + (issue.issue_weight || 1.5);
      }
    }
    return Object.entries(map).map(([name, score]) => ({ name, score: parseFloat(score.toFixed(2)) })).sort((a, b) => b.score - a.score).slice(0, 10);
  }, [filtered]);

  // Status breakdown
  const statusData = useMemo(() => {
    const map = {};
    for (const issue of filtered) {
      map[issue.status] = (map[issue.status] || 0) + 1;
    }
    return Object.entries(map).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }));
  }, [filtered]);

  const exportCSV = () => {
    const rows = filtered.map(i => [
      i.qc_event_date || i.date_received || i.created_date,
      i.technician_name,
      i.work_order_name,
      i.customer,
      i.final_category || i.auto_category || i.issue_category,
      i.status,
      i.warranty_return_required ? 'Yes' : 'No',
      i.repeat_issue ? 'Yes' : 'No',
      i.overdue_flag ? 'Yes' : 'No',
      i.days_open
    ]);
    const header = ['Date', 'Technician', 'Work Order', 'Customer', 'Category', 'Status', 'Warranty Return', 'Repeat', 'Overdue', 'Days Open'];
    const csv = [header, ...rows].map(r => r.map(c => `"${c ?? ''}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'qc_trends.csv'; a.click();
  };

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading...</div>;

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">QC Trends & Reports</h1>
          <p className="text-gray-500 mt-1">Analytics and performance trends over time</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="60">Last 60 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="180">Last 6 months</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Select value={techFilter} onValueChange={setTechFilter}>
             <SelectTrigger className="w-40"><SelectValue placeholder="All Techs" /></SelectTrigger>
             <SelectContent>
               <SelectItem value="all">All Technicians</SelectItem>
               {technicians.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
             </SelectContent>
           </Select>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
             <SelectTrigger className="w-44"><SelectValue placeholder="All Projects" /></SelectTrigger>
             <SelectContent>
               <SelectItem value="all">All Projects</SelectItem>
               {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.project_name}</SelectItem>)}
             </SelectContent>
           </Select>
          <Button variant="outline" onClick={exportCSV}>
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="Total Issues" value={filtered.length} />
        <SummaryCard label="Weighted Score" value={filtered.reduce((s, i) => s + (i.issue_weight || 1.5), 0).toFixed(1)} />
        <SummaryCard label="Warranty Returns" value={filtered.filter(i => i.warranty_return_required && !i.is_documentation_only).length} />
        <SummaryCard label="Overdue" value={filtered.filter(i => i.overdue_flag).length} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Issues Over Time (Weekly)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Issues by Category</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={categoryData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
                <Tooltip />
                <Bar dataKey="value" fill="#f97316" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Top Technicians by Weighted Score</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={techData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
                <Tooltip formatter={(v) => [v, 'Weighted Score']} />
                <Bar dataKey="score" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Status Breakdown</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <Card>
      <CardContent className="p-4 text-center">
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500 mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}