import React, { useState, useMemo } from "react";
import { base44 } from "@/api/warrantyClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, Clock, AlertTriangle, Download, Search, Calendar, User } from "lucide-react";
import { format, parseISO, isAfter, isBefore, startOfDay } from "date-fns";

const STATUS_COLORS = {
  pending_repair: "bg-red-100 text-red-700",
  scheduled: "bg-yellow-100 text-yellow-700",
  repaired: "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-gray-600",
};

const REPAIR_STATUS_COLORS = {
  not_started: "bg-red-100 text-red-700",
  qc_email_sent_pending: "bg-yellow-100 text-yellow-700",
  scheduled: "bg-blue-100 text-blue-700",
  in_progress: "bg-purple-100 text-purple-700",
  completed: "bg-teal-100 text-teal-700",
  verified: "bg-green-100 text-green-700",
  reopened: "bg-orange-100 text-orange-700",
};

function fmtDate(d) {
  if (!d) return "—";
  try { return format(parseISO(d), "MM/dd/yyyy"); } catch { return d; }
}

function isResolved(issue) {
  return issue.status === "closed" || issue.status === "repaired" || issue.repair_status === "verified";
}

function getResolvedDate(issue) {
  return issue.date_closed || issue.repair_completed_date || issue.repair_verification_date || issue.date_repaired || null;
}

function getResolvedBy(issue) {
  return issue.repair_completed_by || issue.qc_verified_by || issue.last_status_changed_by || null;
}

export default function OpenIssuesReport() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [view, setView] = useState("all"); // all | open | resolved
  const [search, setSearch] = useState("");
  const [techFilter, setTechFilter] = useState("all");

  const { data: issues = [], isLoading } = useQuery({
    queryKey: ["qcIssues"],
    queryFn: () => base44.entities.QCIssue.list("-qc_event_date"),
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ["technicians"],
    queryFn: () => base44.entities.Technician.list(),
  });

  const primaryTechs = useMemo(() =>
    technicians.filter(t => t.is_active !== false && t.technician_profile_status !== "merged" && !String(t.full_name || "").includes("[MERGED]"))
      .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || "")),
    [technicians]
  );

  const filtered = useMemo(() => {
    let list = issues.filter(i => i.data_status !== "archived");

    // Date range — uses qc_event_date
    if (dateFrom) {
      const from = startOfDay(parseISO(dateFrom));
      list = list.filter(i => {
        const d = i.qc_event_date || i.date_received;
        return d && !isBefore(parseISO(d), from);
      });
    }
    if (dateTo) {
      const to = startOfDay(parseISO(dateTo));
      list = list.filter(i => {
        const d = i.qc_event_date || i.date_received;
        return d && !isAfter(parseISO(d), to);
      });
    }

    // View filter
    if (view === "open") list = list.filter(i => !isResolved(i));
    if (view === "resolved") list = list.filter(i => isResolved(i));

    // Technician filter
    if (techFilter !== "all") list = list.filter(i => i.technician_id === techFilter);

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(i =>
        [i.technician_name, i.asset_number, i.customer, i.work_order_name, i.case_number, i.issue_summary_clean, i.qc_notes]
          .some(f => f && String(f).toLowerCase().includes(q))
      );
    }

    return list;
  }, [issues, dateFrom, dateTo, view, techFilter, search]);

  const openCount = useMemo(() => filtered.filter(i => !isResolved(i)).length, [filtered]);
  const resolvedCount = useMemo(() => filtered.filter(i => isResolved(i)).length, [filtered]);

  const exportCSV = () => {
    const headers = ["Date", "Asset #", "Technician", "Customer", "Work Order", "Status", "Repair Status", "Resolved By", "Resolved Date", "Notes"];
    const rows = filtered.map(i => [
      i.qc_event_date || i.date_received || "",
      i.asset_number || "",
      i.technician_name || "",
      i.customer || "",
      i.work_order_name || "",
      i.status || "",
      i.repair_status || "",
      getResolvedBy(i) || "",
      getResolvedDate(i) || "",
      (i.issue_summary_clean || i.qc_notes || "").replace(/,/g, ";").replace(/\n/g, " "),
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `open-issues-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <div className="p-8 text-center text-gray-400">Loading...</div>;

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Open Issues Report</h1>
          <p className="text-gray-500 mt-1">Track what's been resolved, by whom, and what remains open</p>
        </div>
        <Button onClick={exportCSV} variant="outline" className="gap-2">
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-red-200">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-red-500 shrink-0" />
            <div>
              <p className="text-2xl font-bold text-red-600">{openCount}</p>
              <p className="text-sm text-gray-500">Still Open</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-500 shrink-0" />
            <div>
              <p className="text-2xl font-bold text-green-600">{resolvedCount}</p>
              <p className="text-sm text-gray-500">Resolved</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-200">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="w-8 h-8 text-blue-500 shrink-0" />
            <div>
              <p className="text-2xl font-bold text-blue-600">{filtered.length}</p>
              <p className="text-sm text-gray-500">Total in Range</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 flex items-center gap-1"><Calendar className="w-3 h-3" /> Date From</label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40 h-8 text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 flex items-center gap-1"><Calendar className="w-3 h-3" /> Date To</label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40 h-8 text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Show</label>
              <Select value={view} onValueChange={setView}>
                <SelectTrigger className="w-32 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Issues</SelectItem>
                  <SelectItem value="open">Open Only</SelectItem>
                  <SelectItem value="resolved">Resolved Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 flex items-center gap-1"><User className="w-3 h-3" /> Technician</label>
              <Select value={techFilter} onValueChange={setTechFilter}>
                <SelectTrigger className="w-44 h-8 text-sm"><SelectValue placeholder="All Technicians" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Technicians</SelectItem>
                  {primaryTechs.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Search</label>
              <div className="relative">
                <Search className="absolute left-2 top-1.5 w-3.5 h-3.5 text-gray-400" />
                <Input placeholder="Asset, tech, customer..." value={search} onChange={e => setSearch(e.target.value)} className="pl-7 w-48 h-8 text-sm" />
              </div>
            </div>
            {(dateFrom || dateTo || view !== "all" || techFilter !== "all" || search) && (
              <Button variant="ghost" size="sm" className="text-gray-400 h-8 mt-4"
                onClick={() => { setDateFrom(""); setDateTo(""); setView("all"); setTechFilter("all"); setSearch(""); }}>
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Status</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Date</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Asset #</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Technician</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Customer</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Work Order</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Repair Status</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Resolved By</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Resolved Date</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Issue Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(issue => {
                const resolved = isResolved(issue);
                const resolvedBy = getResolvedBy(issue);
                const resolvedDate = getResolvedDate(issue);
                return (
                  <tr key={issue.id} className={`hover:bg-gray-50 ${!resolved ? "bg-red-50/30" : ""}`}>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {resolved
                        ? <Badge className="bg-green-100 text-green-700 text-xs gap-1"><CheckCircle className="w-3 h-3" />Resolved</Badge>
                        : <Badge className="bg-red-100 text-red-700 text-xs gap-1"><AlertTriangle className="w-3 h-3" />Open</Badge>
                      }
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">{fmtDate(issue.qc_event_date || issue.date_received)}</td>
                    <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{issue.asset_number || "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-700">{issue.technician_name || "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-700 max-w-[140px] truncate">{issue.customer || "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600 max-w-[120px] truncate">{issue.work_order_name || "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {issue.repair_status
                        ? <Badge className={`text-xs ${REPAIR_STATUS_COLORS[issue.repair_status] || "bg-gray-100 text-gray-600"}`}>{issue.repair_status.replace(/_/g, " ")}</Badge>
                        : <span className="text-gray-400">—</span>
                      }
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {resolvedBy
                        ? <span className="text-green-700 font-medium">{resolvedBy}</span>
                        : <span className="text-gray-400">—</span>
                      }
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">{fmtDate(resolvedDate)}</td>
                    <td className="px-3 py-2 text-gray-600 max-w-[240px]">
                      <span className="line-clamp-2">{issue.issue_summary_clean || issue.qc_notes || "—"}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">No issues found for the selected filters.</div>
          )}
          {filtered.length > 0 && (
            <div className="px-4 py-2 border-t text-xs text-gray-400 bg-gray-50">{filtered.length} records shown</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}