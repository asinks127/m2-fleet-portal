import React, { useState, useMemo } from "react";
import { base44 } from "@/api/warrantyClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, X, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, XCircle, Copy } from "lucide-react";
import {
  computeDataQualityStatus, getMissingFields,
  isValidRecord, isWarrantyIssue, isDamageClaim, isOpenIssue, isOverdueIssue
} from "../lib/qcUtils";
import { format } from "date-fns";

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmtDate = (d) => {
  if (!d) return "—";
  try { return format(new Date(d), "MM/dd/yy"); } catch { return d; }
};

function exclusionReason(issue) {
  const dqs = computeDataQualityStatus(issue);
  if (dqs === "duplicate") return "Duplicate record (duplicate_status flag)";
  if (issue.data_status === "archived") return "Archived";
  if (issue.data_status === "legacy_review") return "Legacy / needs review";
  const missing = getMissingFields(issue);
  if (missing.length) return `Incomplete — missing: ${missing.join(", ")}`;
  if (issue.parse_status === "needs_review") return "Parse status: needs_review";
  if (issue.parse_status === "duplicate_suspected") return "Parse status: duplicate_suspected";
  return "Unknown";
}

const DQS_CONFIG = {
  valid:        { label: "Valid",        color: "bg-green-100 text-green-800" },
  needs_review: { label: "Needs Review", color: "bg-yellow-100 text-yellow-800" },
  incomplete:   { label: "Incomplete",   color: "bg-red-100 text-red-800" },
  duplicate:    { label: "Duplicate",    color: "bg-gray-100 text-gray-700" },
};

function DQSBadge({ status }) {
  const cfg = DQS_CONFIG[status] || DQS_CONFIG.needs_review;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>;
}

// ─── Drill-down Modal ────────────────────────────────────────────────────────

function DrillDown({ title, records, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-semibold text-gray-900 text-base">{title}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{records.length} record{records.length !== 1 ? "s" : ""}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-auto flex-1">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr className="text-xs text-gray-500 uppercase border-b">
                <th className="px-4 py-2 text-left">QC Date</th>
                <th className="px-4 py-2 text-left">Asset #</th>
                <th className="px-4 py-2 text-left">Technician</th>
                <th className="px-4 py-2 text-left">Customer</th>
                <th className="px-4 py-2 text-left">Project</th>
                <th className="px-4 py-2 text-left">Issue Type</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">DQ Status</th>
                <th className="px-4 py-2 text-left">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.length === 0 && (
                <tr><td colSpan={9} className="text-center py-10 text-gray-400">No records</td></tr>
              )}
              {records.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">{fmtDate(r.qc_event_date || r.date_received)}</td>
                  <td className="px-4 py-2 font-medium text-gray-800">{r.asset_number || <span className="text-red-400 italic">missing</span>}</td>
                  <td className="px-4 py-2">{r.technician_name || <span className="text-red-400 italic">missing</span>}</td>
                  <td className="px-4 py-2 text-gray-600">{r.customer || "—"}</td>
                  <td className="px-4 py-2 text-gray-600 text-xs">{r.work_order_name || "—"}</td>
                  <td className="px-4 py-2 text-xs capitalize">{(r.issue_type || "").replace(/_/g, " ") || <span className="text-red-400 italic">missing</span>}</td>
                  <td className="px-4 py-2 text-xs capitalize">{(r.status || "").replace(/_/g, " ") || "—"}</td>
                  <td className="px-4 py-2"><DQSBadge status={computeDataQualityStatus(r)} /></td>
                  <td className="px-4 py-2 text-xs text-gray-500 max-w-[180px] truncate" title={exclusionReason(r)}>
                    {computeDataQualityStatus(r) !== "valid" ? exclusionReason(r) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Clickable metric tile ────────────────────────────────────────────────────

function MetricTile({ label, value, sublabel, color = "text-gray-900", records, onDrill }) {
  return (
    <div
      className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all group"
      onClick={() => records && onDrill(label, records)}
    >
      <p className={`text-3xl font-bold ${color} group-hover:text-blue-600 transition-colors`}>{value}</p>
      <p className="text-sm font-medium text-gray-700 mt-1">{label}</p>
      {sublabel && <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>}
      {records && <p className="text-xs text-blue-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Click to drill down →</p>}
    </div>
  );
}

// ─── Collapsible group table ─────────────────────────────────────────────────

function GroupTable({ title, rows, onDrill }) {
  const [open, setOpen] = useState(true);
  return (
    <Card>
      <CardHeader className="pb-0 pt-4 px-4 cursor-pointer" onClick={() => setOpen(o => !o)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-gray-700">{title}</CardTitle>
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </CardHeader>
      {open && (
        <CardContent className="p-0 pt-3">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase border-b">
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2 text-right">Valid</th>
                  <th className="px-4 py-2 text-right">Incomplete</th>
                  <th className="px-4 py-2 text-right">Needs Review</th>
                  <th className="px-4 py-2 text-right">Duplicates</th>
                  <th className="px-4 py-2 text-right">Open</th>
                  <th className="px-4 py-2 text-right">Warranties</th>
                  <th className="px-4 py-2 text-right">Overdue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-8 text-gray-400">No data</td></tr>
                )}
                {rows.map(row => (
                  <tr key={row.name} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-800 max-w-[200px] truncate">{row.name || "—"}</td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => onDrill(row.name + " — All", row.all)} className="text-blue-600 hover:underline font-semibold">{row.all.length}</button>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => onDrill(row.name + " — Valid", row.valid)} className="text-green-700 hover:underline font-semibold">{row.valid.length}</button>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {row.incomplete.length > 0
                        ? <button onClick={() => onDrill(row.name + " — Incomplete", row.incomplete)} className="text-red-600 hover:underline font-semibold">{row.incomplete.length}</button>
                        : <span className="text-gray-400">0</span>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {row.needs_review.length > 0
                        ? <button onClick={() => onDrill(row.name + " — Needs Review", row.needs_review)} className="text-yellow-700 hover:underline font-semibold">{row.needs_review.length}</button>
                        : <span className="text-gray-400">0</span>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {row.duplicate.length > 0
                        ? <button onClick={() => onDrill(row.name + " — Duplicates", row.duplicate)} className="text-gray-500 hover:underline font-semibold">{row.duplicate.length}</button>
                        : <span className="text-gray-400">0</span>}
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-orange-700">{row.open}</td>
                    <td className="px-4 py-2 text-right font-medium text-purple-700">{row.warranty}</td>
                    <td className="px-4 py-2 text-right font-medium text-red-600">{row.overdue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function QCDataAudit() {
  const [drill, setDrill] = useState(null); // { title, records }

  const { data: issues = [], isLoading, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["qcIssues-audit"],
    queryFn: () => base44.entities.QCIssue.list("-created_date"),
  });

  const annotated = useMemo(() =>
    issues.map(i => ({ ...i, _dqs: computeDataQualityStatus(i) })),
    [issues]
  );

  // Top-level buckets
  const all       = annotated;
  const valid     = annotated.filter(i => i._dqs === "valid");
  const invalid   = annotated.filter(i => i._dqs !== "valid");
  const incomplete  = annotated.filter(i => i._dqs === "incomplete");
  const needsReview = annotated.filter(i => i._dqs === "needs_review");
  const duplicates  = annotated.filter(i => i._dqs === "duplicate");
  const excluded    = invalid; // anything not valid is excluded from metrics

  // Derived from valid only
  const openIssues    = valid.filter(isOpenIssue);
  const warranties    = valid.filter(isWarrantyIssue);
  const damageRecords = valid.filter(isDamageClaim);
  const overdueIssues = valid.filter(isOverdueIssue);

  // Group by technician
  const byTech = useMemo(() => {
    const map = {};
    for (const i of annotated) {
      const key = i.technician_name || "(No Technician)";
      if (!map[key]) map[key] = [];
      map[key].push(i);
    }
    return Object.entries(map)
      .sort((a, b) => b[1].length - a[1].length)
      .map(([name, recs]) => ({
        name,
        all: recs,
        valid:        recs.filter(r => r._dqs === "valid"),
        incomplete:   recs.filter(r => r._dqs === "incomplete"),
        needs_review: recs.filter(r => r._dqs === "needs_review"),
        duplicate:    recs.filter(r => r._dqs === "duplicate"),
        open:         recs.filter(r => r._dqs === "valid" && isOpenIssue(r)).length,
        warranty:     recs.filter(r => r._dqs === "valid" && isWarrantyIssue(r)).length,
        overdue:      recs.filter(r => r._dqs === "valid" && isOverdueIssue(r)).length,
      }));
  }, [annotated]);

  // Group by customer
  const byCustomer = useMemo(() => {
    const map = {};
    for (const i of annotated) {
      const key = i.customer || "(No Customer)";
      if (!map[key]) map[key] = [];
      map[key].push(i);
    }
    return Object.entries(map)
      .sort((a, b) => b[1].length - a[1].length)
      .map(([name, recs]) => ({
        name,
        all: recs,
        valid:        recs.filter(r => r._dqs === "valid"),
        incomplete:   recs.filter(r => r._dqs === "incomplete"),
        needs_review: recs.filter(r => r._dqs === "needs_review"),
        duplicate:    recs.filter(r => r._dqs === "duplicate"),
        open:         recs.filter(r => r._dqs === "valid" && isOpenIssue(r)).length,
        warranty:     recs.filter(r => r._dqs === "valid" && isWarrantyIssue(r)).length,
        overdue:      recs.filter(r => r._dqs === "valid" && isOverdueIssue(r)).length,
      }));
  }, [annotated]);

  // Group by project
  const byProject = useMemo(() => {
    const map = {};
    for (const i of annotated) {
      const key = i.work_order_name || "(No Project)";
      if (!map[key]) map[key] = [];
      map[key].push(i);
    }
    return Object.entries(map)
      .sort((a, b) => b[1].length - a[1].length)
      .map(([name, recs]) => ({
        name,
        all: recs,
        valid:        recs.filter(r => r._dqs === "valid"),
        incomplete:   recs.filter(r => r._dqs === "incomplete"),
        needs_review: recs.filter(r => r._dqs === "needs_review"),
        duplicate:    recs.filter(r => r._dqs === "duplicate"),
        open:         recs.filter(r => r._dqs === "valid" && isOpenIssue(r)).length,
        warranty:     recs.filter(r => r._dqs === "valid" && isWarrantyIssue(r)).length,
        overdue:      recs.filter(r => r._dqs === "valid" && isOverdueIssue(r)).length,
      }));
  }, [annotated]);

  // Exclusion reason breakdown
  const exclusionBreakdown = useMemo(() => {
    const map = {};
    for (const i of excluded) {
      const reason = exclusionReason(i);
      if (!map[reason]) map[reason] = [];
      map[reason].push(i);
    }
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
  }, [excluded]);

  const onDrill = (title, records) => setDrill({ title, records });

  if (isLoading) return (
    <div className="p-8 text-center text-gray-400">
      <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
      Loading audit data…
    </div>
  );

  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : "—";

  return (
    <>
      {drill && <DrillDown title={drill.title} records={drill.records} onClose={() => setDrill(null)} />}

      <div className="p-6 md:p-8 space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">QC Data Audit Dashboard</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Verify reported counts. Click any number to see the exact records behind it.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">Last updated: {lastUpdated}</span>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-1" /> Refresh
            </Button>
          </div>
        </div>

        {/* ── Section 1: Record counts ─────────────────────────────── */}
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Record Counts</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricTile label="Total Raw Records"   value={all.length}        color="text-gray-900"  records={all}        onDrill={onDrill} />
            <MetricTile label="Valid Records"        value={valid.length}      color="text-green-700" records={valid}      onDrill={onDrill} sublabel="Used in all metrics" />
            <MetricTile label="Excluded Records"     value={excluded.length}   color="text-red-600"   records={excluded}   onDrill={onDrill} sublabel="Not counted anywhere" />
            <MetricTile label="Duplicates"           value={duplicates.length} color="text-gray-500"  records={duplicates} onDrill={onDrill} />
          </div>
        </div>

        {/* ── Section 2: Valid record breakdown ───────────────────── */}
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Valid Record Breakdown (counted in metrics)</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricTile label="Open Issues"     value={openIssues.length}    color="text-orange-600" records={openIssues}    onDrill={onDrill} />
            <MetricTile label="Warranties"      value={warranties.length}    color="text-purple-600" records={warranties}    onDrill={onDrill} />
            <MetricTile label="Damage Claims"   value={damageRecords.length} color="text-orange-700" records={damageRecords} onDrill={onDrill} />
            <MetricTile label="Overdue"         value={overdueIssues.length} color="text-red-600"    records={overdueIssues} onDrill={onDrill} />
          </div>
        </div>

        {/* ── Section 3: Exclusion breakdown ──────────────────────── */}
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Why Records Are Excluded</h2>
          <Card>
            <CardContent className="p-0">
              {exclusionBreakdown.length === 0 ? (
                <div className="py-8 text-center text-gray-400">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-400" />
                  All records are valid — nothing excluded!
                </div>
              ) : (
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-xs text-gray-500 uppercase border-b">
                      <th className="px-4 py-2 text-left">Exclusion Reason</th>
                      <th className="px-4 py-2 text-right">Count</th>
                      <th className="px-4 py-2 text-right">% of All</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {exclusionBreakdown.map(([reason, recs]) => (
                      <tr key={reason} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-gray-700">{reason}</td>
                        <td className="px-4 py-2.5 text-right">
                          <button onClick={() => onDrill(reason, recs)} className="text-blue-600 hover:underline font-semibold">{recs.length}</button>
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-500 text-xs">
                          {all.length > 0 ? ((recs.length / all.length) * 100).toFixed(1) : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Section 4: DQ flag breakdown ────────────────────────── */}
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Data Quality Flag Breakdown</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Valid",        records: valid,       color: "text-green-700",  icon: CheckCircle2,  bg: "border-green-200 bg-green-50" },
              { label: "Incomplete",   records: incomplete,  color: "text-red-600",    icon: XCircle,       bg: "border-red-200 bg-red-50" },
              { label: "Needs Review", records: needsReview, color: "text-yellow-700", icon: AlertTriangle, bg: "border-yellow-200 bg-yellow-50" },
              { label: "Duplicate",    records: duplicates,  color: "text-gray-600",   icon: Copy,          bg: "border-gray-200 bg-gray-50" },
            ].map(({ label, records, color, icon: Icon, bg }) => (
              <div
                key={label}
                className={`border rounded-xl p-4 cursor-pointer hover:shadow-md transition-all group ${bg}`}
                onClick={() => onDrill(label + " Records", records)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`w-4 h-4 ${color}`} />
                  <p className={`text-2xl font-bold ${color}`}>{records.length}</p>
                </div>
                <p className="text-sm font-medium text-gray-700">{label}</p>
                <p className="text-xs text-blue-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Drill down →</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Section 5-7: Group tables ────────────────────────────── */}
        <GroupTable title="By Technician" rows={byTech}     onDrill={onDrill} />
        <GroupTable title="By Customer"   rows={byCustomer} onDrill={onDrill} />
        <GroupTable title="By Project"    rows={byProject}  onDrill={onDrill} />

      </div>
    </>
  );
}