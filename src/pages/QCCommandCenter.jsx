import React, { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/warrantyClient";
import { useToast } from "@/components/ui/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, Package, Inbox, Calendar, CheckCircle, Trash2, Search, X } from "lucide-react";
import { format, startOfWeek, startOfMonth, subDays } from "date-fns";
import FastFilterBar from "../components/qc/FastFilterBar";
import GroupedQCView from "../components/qc/GroupedQCView";
import QCSummaryWidgets from "../components/qc/QCSummaryWidgets";
import { isValidRecord, isOpenIssue, isClosedIssue, isOverdueIssue, isWarrantyIssue } from "../lib/qcUtils";
import QCIssueDetailModal from "../components/qc/QCIssueDetailModal";
import DateRangeFilter, { filterByDate } from "../components/qc/DateRangeFilter";
import WarrantyResolutionPanel from "../components/qc/WarrantyResolutionPanel";
import TopFailures from "../components/qc/TopFailures";

const STATUS_COLORS = {
  pending_repair:        "bg-red-100 text-red-800",
  scheduled:             "bg-yellow-100 text-yellow-800",
  repaired:              "bg-blue-100 text-blue-800",
  closed:                "bg-green-100 text-green-800",
  not_started:           "bg-gray-100 text-gray-700",
  qc_email_sent_pending: "bg-purple-100 text-purple-800",
  in_progress:           "bg-orange-100 text-orange-800",
  completed:             "bg-yellow-100 text-yellow-800",
  verified:              "bg-green-100 text-green-800",
  reopened:              "bg-red-100 text-red-800",
};

function StatusBadge({ status, repairStatus }) {
  const display = repairStatus || status;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[display] || "bg-gray-100 text-gray-700"}`}>{display?.replace(/_/g, " ") || "—"}</span>;
}

function Th({ children, className = "" }) {
  return <th className={`px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50 ${className}`}>{children}</th>;
}
function Td({ children, className = "" }) {
  return <td className={`px-3 py-2 text-sm text-gray-700 ${className}`}>{children}</td>;
}

function PaginatedTable({ columns, rows, emptyText = "No issues found" }) {
  const [page, setPage] = useState(0);
  const pageSize = 100;
  const totalPages = Math.ceil(rows.length / pageSize);
  const paginated = rows.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead><tr>{columns.map(c => <Th key={c.key}>{c.label}</Th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {paginated.length === 0 ? (
              <tr><td colSpan={columns.length} className="text-center py-8 text-gray-400 text-sm">{emptyText}</td></tr>
            ) : paginated.map(row => (
              <tr key={row.id} className="hover:bg-gray-50">
                {columns.map(c => <Td key={c.key}>{c.render ? c.render(row) : (row[c.key] ?? "—")}</Td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 border-t text-xs text-gray-500">
          <span>{rows.length} total · Page {page + 1} of {totalPages}</span>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => p - 1)} disabled={page === 0} className="px-2 py-1 border rounded disabled:opacity-40 hover:bg-gray-50">Prev</button>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1} className="px-2 py-1 border rounded disabled:opacity-40 hover:bg-gray-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, colorClass }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClass}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function TableCard({ title, count, children }) {
  return (
    <Card>
      <CardHeader className="pb-0 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          <Badge variant="outline">{count}</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0 pt-3">{children}</CardContent>
    </Card>
  );
}

const categories = [
  "camera_positioning", "mirror_adjustment", "mounting",
  "connection_issue", "equipment_missing", "installation_quality", "other"
];

const fmtDate = (d) => {
  if (!d) return "—";
  try {
    const s = String(d).split('T')[0];
    const [y, m, day] = s.split('-');
    return `${m}/${day}/${y}`;
  } catch { return d; }
};

const catDisplay = (issue) => {
  const c = issue.final_category || issue.auto_category || issue.issue_category || "";
  return c.replace(/_/g, " ") || "—";
};

const DEFAULT_FILTERS = {
  search: "", technician: "all", customer: "all", category: "all",
  severity: "all", warranty: "all", status: "all", project: "all",
  overdue: "all", needsReview: "all"
};

const DEFAULT_DATE_RANGE = { preset: "all", customStart: "", customEnd: "" };

export default function QCCommandCenter() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [dateRange, setDateRange] = useState(DEFAULT_DATE_RANGE);
  const [viewMode, setViewMode] = useState("table");
  const [groupBy, setGroupBy] = useState("technician");
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [backfillingQCDates, setBackfillingQCDates] = useState(false);
  const [backfillingCustomerProject, setBackfillingCustomerProject] = useState(false);

  const handleBackfillCustomerProject = async () => {
    setBackfillingCustomerProject(true);
    try {
      const res = await base44.functions.invoke('backfillCustomerProject', {});
      toast({ title: `Backfill complete: ${res.updated} issues updated` });
    } catch (err) {
      toast({ title: 'Backfill in progress', description: 'System is rate-limited. Please wait a few minutes and try again.', variant: 'destructive' });
    } finally {
      setBackfillingCustomerProject(false);
    }
  };

  const handleBackfillQCEventDate = async () => {
    setBackfillingQCDates(true);
    try {
      const res = await base44.functions.invoke('backfillQCEventDate', {});
      toast({ title: `QC Event Date backfill: ${res.updated} updated, ${res.skipped} skipped` });
    } catch (err) {
      toast({ title: 'Backfill in progress', description: 'System is rate-limited. Please wait a few minutes and try again.', variant: 'destructive' });
    } finally {
      setBackfillingQCDates(false);
    }
  };

  const { data: issues = [], isLoading } = useQuery({
    queryKey: ["qcIssues"],
    queryFn: () => base44.entities.QCIssue.list("-created_date"),
  });
  const { data: technicians = [] } = useQuery({
    queryKey: ["technicians"],
    queryFn: () => base44.entities.Technician.list(),
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => base44.entities.WarrantyProject.list(),
  });

  const customers = useMemo(() => [...new Set(issues.map(i => i.customer).filter(Boolean))].sort(), [issues]);
  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v }));
  const resetFilters = () => setFilters({ ...DEFAULT_FILTERS });

  const projectMap = useMemo(() => {
    const m = {};
    for (const p of projects) m[p.id] = p.project_name;
    return m;
  }, [projects]);

  // Apply global date range filter first (uses install/service date or qc_event_date)
  const dateFiltered = useMemo(() => filterByDate(issues, dateRange), [issues, dateRange]);

  const filtered = useMemo(() => {
    const result = dateFiltered.filter(issue => {
      // Exclude records marked as duplicates
      if (issue.duplicate_status && issue.duplicate_status.startsWith('duplicate_of_')) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const projectName = (projectMap[issue.project_id] || "").toLowerCase();
        const haystack = [
          issue.technician_name, issue.asset_number, issue.work_order_name,
          issue.customer, projectName
        ].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filters.technician !== "all" && issue.technician_id !== filters.technician) return false;
      if (filters.customer !== "all" && issue.customer !== filters.customer) return false;
      if (filters.category !== "all") {
        const c = issue.final_category || issue.auto_category || issue.issue_category;
        if (c !== filters.category) return false;
      }
      if (filters.severity !== "all" && issue.severity !== filters.severity) return false;
      if (filters.warranty === "yes" && !issue.warranty_return_required) return false;
      if (filters.warranty === "no" && issue.warranty_return_required) return false;
      if (filters.status !== "all" && issue.status !== filters.status) return false;
      if (filters.project !== "all" && issue.project_id !== filters.project) return false;
      if (filters.overdue === "yes" && !issue.overdue_flag) return false;
      if (filters.needsReview === "yes" && issue.parse_status !== "needs_review" && issue.parse_status !== "duplicate_suspected") return false;
      return true;
    });
    // Sort by qc_event_date (newest to oldest)
    result.sort((a, b) => {
      const dateA = a.qc_event_date || a.date_received || a.created_date || "";
      const dateB = b.qc_event_date || b.date_received || b.created_date || "";
      return dateB.localeCompare(dateA);
    });
    return result;
  }, [dateFiltered, filters, projectMap]);

  const now = new Date();
  const weekStart = startOfWeek(now).toISOString().split("T")[0];
  const monthStart = startOfMonth(now).toISOString().split("T")[0];
  const getD = i => i.qc_event_date || i.date_received || i.created_date?.split("T")[0] || "";

  // Apply validity gate for all reporting metrics and tables
  const validFiltered = useMemo(() => filtered.filter(isValidRecord), [filtered]);

  const metrics = {
    open:        validFiltered.filter(isOpenIssue).length,
    overdue:     validFiltered.filter(isOverdueIssue).length,
    warranty:    validFiltered.filter(isWarrantyIssue).length,
    thisWeek:    validFiltered.filter(i => getD(i) >= weekStart).length,
    thisMonth:   validFiltered.filter(i => getD(i) >= monthStart).length,
    needsReview: filtered.filter(i => i.parse_status === "needs_review" || i.parse_status === "duplicate_suspected").length,
  };

  // Open issues: show ALL non-duplicate open issues (not gated by isValidRecord so new emails appear)
  const openIssues     = filtered.filter(isOpenIssue);
  const resolvedIssues = validFiltered.filter(isClosedIssue);
  const warrantyIssues = validFiltered.filter(isWarrantyIssue);
  const overdueIssues  = validFiltered.filter(isOverdueIssue);
  const needsReviewIssues = filtered.filter(i => i.parse_status === "needs_review" || i.parse_status === "duplicate_suspected");
  const recentIssues = [...validFiltered].slice(0, 50);

  const openModal = (issue) => setSelectedIssue(issue);

  const handleDeleteIssue = async (issueId) => {
    if (!window.confirm('Are you sure you want to delete this issue? This cannot be undone.')) return;
    setDeletingId(issueId);
    try {
      await base44.entities.QCIssue.delete(issueId);
      queryClient.invalidateQueries({ queryKey: ['qcIssues'] });
      toast({ title: 'Issue deleted' });
    } catch (err) {
      const msg = err.message || 'Unknown error';
      if (msg.includes('not found')) {
        toast({ title: 'Issue not found', description: 'This record may have already been deleted.', variant: 'destructive' });
      } else {
        toast({ title: 'Error deleting issue', description: msg, variant: 'destructive' });
      }
    } finally {
      setDeletingId(null);
    }
  };

  // Column definitions — Failure Date is always first, primary sort column
  const openCols = [
    { key: "qc_event_date", label: "Failure Date", render: r => (
      <span className="font-semibold text-gray-900">{fmtDate(r.qc_event_date || r.date_received)}</span>
    )},
    { key: "technician_name", label: "Technician", render: r => (
      <button onClick={() => openModal(r)} className="text-blue-600 hover:underline font-medium text-left">
        {r.technician_name || "—"}
      </button>
    )},
    { key: "asset_number", label: "Asset #" },
    { key: "project", label: "Project", render: r => projectMap[r.project_id] || r.customer || "—" },
    { key: "install_service_date", label: "Install Date", render: r => fmtDate(r.install_service_date) },
    { key: "status", label: "Status", render: r => <StatusBadge status={r.status} repairStatus={r.repair_status} /> },
    { key: "warranty_return_required", label: "Warranty", render: r => r.warranty_return_required ? <Badge className="text-xs bg-purple-100 text-purple-800">Yes</Badge> : "No" },
    { key: "days_open", label: "Days Open", render: r => r.days_open ?? "—" },
    { key: "delete", label: "", render: r => (
      <button
        onClick={() => handleDeleteIssue(r.id)}
        disabled={deletingId === r.id}
        className="text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
        title="Delete issue"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    )},
  ];

  const overdueCols = [
    { key: "qc_event_date", label: "Failure Date", render: r => <span className="font-semibold text-gray-900">{fmtDate(r.qc_event_date || r.date_received)}</span> },
    { key: "technician_name", label: "Technician" },
    { key: "asset_number", label: "Asset #" },
    { key: "project", label: "Project", render: r => projectMap[r.project_id] || r.customer || "—" },
    { key: "status", label: "Status", render: r => <StatusBadge status={r.status} repairStatus={r.repair_status} /> },
    { key: "days_open", label: "Days Open", render: r => <span className="font-semibold text-red-600">{r.days_open ?? "—"}</span> },
  ];

  const reviewCols = [
    { key: "qc_event_date", label: "Failure Date", render: r => fmtDate(r.qc_event_date || r.date_received) },
    { key: "technician_name", label: "Technician" },
    { key: "asset_number", label: "Asset #" },
    { key: "parse_confidence", label: "Confidence", render: r => {
      const c = r.parse_confidence;
      const cls = c === "high" ? "bg-green-100 text-green-800" : c === "medium" ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800";
      return c ? <Badge className={`text-xs ${cls}`}>{c}</Badge> : "—";
    }},
    { key: "status", label: "Status", render: r => <StatusBadge status={r.status} /> },
  ];

  if (isLoading) return <div className="p-8 text-center text-gray-400">Loading...</div>;

  return (
    <>
    {selectedIssue && <QCIssueDetailModal issue={selectedIssue} onClose={() => setSelectedIssue(null)} />}
    <DateRangeFilter dateRange={dateRange} setDateRange={setDateRange} />

    {/* Global Search Bar */}
    <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-2 shadow-sm">
      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by technician, asset #, project, status..."
          value={filters.search}
          onChange={e => setFilter("search", e.target.value)}
          className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        {filters.search && (
          <button onClick={() => setFilter("search", "")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>

    <FastFilterBar
      filters={filters}
      setFilter={setFilter}
      technicians={technicians}
      customers={customers}
      projects={projects}
    />
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">QC Command Center</h1>
          <p className="text-gray-500 mt-1">Sorted by failure date (newest first) · {filtered.length} records</p>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setViewMode("table")}
              className={`px-3 py-1 text-xs font-medium rounded border transition-all ${viewMode === "table" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"}`}
            >
              Table View
            </button>
            <button
              onClick={() => setViewMode("grouped")}
              className={`px-3 py-1 text-xs font-medium rounded border transition-all ${viewMode === "grouped" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"}`}
            >
              Grouped View
            </button>
          </div>
          {viewMode === "grouped" && (
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setGroupBy("technician")}
                className={`px-3 py-1 text-xs font-medium rounded border transition-all ${groupBy === "technician" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"}`}
              >
                By Technician
              </button>
              <button
                onClick={() => setGroupBy("customer")}
                className={`px-3 py-1 text-xs font-medium rounded border transition-all ${groupBy === "customer" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"}`}
              >
                By Customer
              </button>
              <button
                onClick={() => setGroupBy("project")}
                className={`px-3 py-1 text-xs font-medium rounded border transition-all ${groupBy === "project" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"}`}
              >
                By Project
              </button>
            </div>
          )}
        </div>
        <button
          onClick={handleBackfillCustomerProject}
          disabled={backfillingCustomerProject || backfillingQCDates}
          className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded border text-gray-600 disabled:opacity-50"
        >
          {backfillingCustomerProject ? 'Backfilling...' : 'Backfill Customer/Project'}
        </button>
        <button
          onClick={handleBackfillQCEventDate}
          disabled={backfillingQCDates || backfillingCustomerProject}
          className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded border text-gray-600 disabled:opacity-50"
        >
          {backfillingQCDates ? 'Backfilling...' : 'Backfill QC Event Dates'}
        </button>
      </div>



      {/* Summary Widgets */}
      <QCSummaryWidgets
        issues={validFiltered}
        technicians={technicians}
        customers={customers}
        projects={projects}
        projectMap={projectMap}
        onFilterClick={(key, value) => {
          setFilter(key, value);
          setViewMode("table");
        }}
      />

      {/* Top Failures Panel */}
      <TopFailures issues={issues} projectMap={projectMap} />

      {/* View Mode */}
      {viewMode === "grouped" ? (
        <>
          <GroupedQCView
            issues={validFiltered}
            groupBy={groupBy}
            onModalOpen={openModal}
            projectMap={projectMap}
          />
        </>
      ) : (
        <>
          <TableCard title="Open Issues" count={openIssues.length}>
            <p className="px-4 pb-2 text-xs text-gray-400">Click a technician or customer name to open the detail panel</p>
            <PaginatedTable columns={openCols} rows={openIssues} emptyText="No open issues 🎉" />
          </TableCard>
        </>
      )}
    </div>
    </>
  );
}