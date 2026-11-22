import React, { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronUp, ChevronDown, Search, X } from "lucide-react";
import { format } from "date-fns";
import { issueMatchesSearch, classifyClaimType } from "../../lib/qcUtils";

const STATUS_COLORS = {
  pending_repair: "bg-yellow-100 text-yellow-800",
  scheduled:      "bg-blue-100 text-blue-800",
  repaired:       "bg-emerald-100 text-emerald-800",
  closed:         "bg-gray-100 text-gray-500",
};

const REPAIR_STATUS_COLORS = {
  not_started: "bg-gray-50 text-gray-400",
  scheduled:   "bg-blue-50 text-blue-600",
  in_progress: "bg-orange-50 text-orange-600",
  completed:   "bg-yellow-50 text-yellow-700",
  verified:    "bg-green-50 text-green-700",
  reopened:    "bg-red-50 text-red-600",
};

const SEVERITY_COLORS = {
  low:      "bg-green-50 text-green-600",
  medium:   "bg-yellow-50 text-yellow-600",
  high:     "bg-orange-50 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

const CLAIM_COLORS = {
  warranty: "bg-purple-100 text-purple-700",
  damage:   "bg-red-100 text-red-700",
};

const fmtDate = (d) => {
  if (!d) return "—";
  try { return format(new Date(d), "MM/dd/yy"); } catch { return d; }
};

function SortTh({ col, label, sortBy, sortDir, onSort, className = "" }) {
  const active = sortBy === col;
  return (
    <th onClick={() => onSort(col)}
      className={`px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-900 select-none whitespace-nowrap bg-gray-50 border-b border-gray-100 ${className}`}>
      <span className="flex items-center gap-1">
        {label}
        {active ? (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <span className="w-3 h-3" />}
      </span>
    </th>
  );
}

const PAGE_SIZE = 25;

export default function TechIssueTable({ issues }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [claimFilter, setClaimFilter] = useState("all");
  const [sortBy, setSortBy] = useState("qc_event_date");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);

  const handleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("desc"); }
    setPage(1);
  };

  const filtered = useMemo(() => {
    return issues.filter(i => {
      if (statusFilter !== "all" && i.status !== statusFilter) return false;
      const ct = classifyClaimType(i);
      if (claimFilter !== "all" && ct !== claimFilter) return false;
      return issueMatchesSearch(i, search);
    });
  }, [issues, search, statusFilter, claimFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortBy] ?? "";
      const bv = b[sortBy] ?? "";
      if (typeof av === "number") return sortDir === "asc" ? av - bv : bv - av;
      return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [filtered, sortBy, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const resetFilters = () => { setSearch(""); setStatusFilter("all"); setClaimFilter("all"); setPage(1); };
  const hasFilters = search || statusFilter !== "all" || claimFilter !== "all";

  return (
    <div className="space-y-3">
      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            placeholder="Search issues…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 transition-all"
          />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
          <option value="all">All Statuses</option>
          <option value="pending_repair">Pending Repair</option>
          <option value="scheduled">Scheduled</option>
          <option value="repaired">Repaired</option>
          <option value="closed">Closed</option>
        </select>
        <select value={claimFilter} onChange={e => { setClaimFilter(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
          <option value="all">All Claim Types</option>
          <option value="warranty">Warranty</option>
          <option value="damage">Damage</option>
          <option value="none">None</option>
        </select>
        {hasFilters && (
          <button onClick={resetFilters} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-3.5 h-3.5" /> Reset
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400">{filtered.length} issue{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <SortTh col="qc_event_date" label="Date" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <SortTh col="asset_number" label="Asset #" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <SortTh col="customer" label="Customer" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <SortTh col="work_order_name" label="Work Order" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <SortTh col="claim_type" label="Claim" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <SortTh col="qc_category" label="Category" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <SortTh col="status" label="Status" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <SortTh col="repair_status" label="Repair" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <SortTh col="severity" label="Severity" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-100">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paged.map(issue => {
                const ct = classifyClaimType(issue);
                return (
                  <tr key={issue.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs text-gray-500 tabular-nums">{fmtDate(issue.qc_event_date)}</td>
                    <td className="px-3 py-2.5 font-semibold text-gray-900 whitespace-nowrap">{issue.asset_number || "—"}</td>
                    <td className="px-3 py-2.5 text-gray-700 max-w-[140px] truncate">{issue.customer || "—"}</td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs max-w-[140px] truncate">{issue.work_order_name || "—"}</td>
                    <td className="px-3 py-2.5">
                      {ct && ct !== "none" ? (
                        <Badge className={`text-xs ${CLAIM_COLORS[ct] || "bg-gray-100 text-gray-600"}`}>{ct}</Badge>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                      {(issue.qc_category || "").replace(/_/g, " ") || "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge className={`text-xs ${STATUS_COLORS[issue.status] || "bg-gray-100 text-gray-500"}`}>
                        {(issue.status || "").replace(/_/g, " ") || "—"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      {issue.repair_status ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${REPAIR_STATUS_COLORS[issue.repair_status] || "bg-gray-50 text-gray-400"}`}>
                          {issue.repair_status.replace(/_/g, " ")}
                        </span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      {issue.severity ? (
                        <Badge className={`text-xs ${SEVERITY_COLORS[issue.severity] || ""}`}>{issue.severity}</Badge>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-400 max-w-[200px] truncate">
                      {issue.issue_summary_clean || issue.remote_qc_notes || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {paged.length === 0 && (
          <div className="py-16 text-center">
            <Search className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No issues match your filters.</p>
            {hasFilters && <button onClick={resetFilters} className="text-xs text-blue-500 hover:underline mt-1">Clear filters</button>}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-50 flex items-center justify-between bg-gray-50/50">
            <span className="text-xs text-gray-400">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length}
            </span>
            <div className="flex gap-1">
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${p === page ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-100"}`}>
                  {p}
                </button>
              ))}
              {totalPages > 7 && page < totalPages && (
                <button onClick={() => setPage(totalPages)} className="w-7 h-7 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100">{totalPages}</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}