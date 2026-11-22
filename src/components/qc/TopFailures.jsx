import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, X, Mail, AlertTriangle } from "lucide-react";
import { startOfWeek, subWeeks, startOfMonth, subMonths, format } from "date-fns";
import { isOpenIssue, isClosedIssue, isOverdueIssue } from "@/lib/qcUtils";

const REPORTING_CUTOFF = "2026-04-01";

const fmtDate = (d) => {
  if (!d) return "—";
  try {
    const s = String(d).split("T")[0];
    const [y, m, day] = s.split("-");
    return `${m}/${day}/${y}`;
  } catch { return d; }
};

const STATUS_COLORS = {
  pending_repair: "bg-red-100 text-red-800",
  scheduled: "bg-yellow-100 text-yellow-800",
  repaired: "bg-blue-100 text-blue-800",
  closed: "bg-green-100 text-green-800",
  qc_email_sent_pending: "bg-purple-100 text-purple-800",
  in_progress: "bg-orange-100 text-orange-800",
  verified: "bg-green-100 text-green-800",
  reopened: "bg-red-100 text-red-800",
};

function getIssueDate(issue) {
  return issue.qc_event_date || issue.date_received || (issue.created_date || "").split("T")[0] || "";
}

function getStatusLabel(issue) {
  if (issue.status === "closed" || issue.repair_status === "verified") return "Closed";
  if (issue.repair_status === "qc_email_sent_pending") return "Awaiting Response";
  if (issue.status === "repaired") return "Repaired";
  if (issue.status === "scheduled" || issue.repair_status === "scheduled") return "Scheduled";
  if (issue.repair_status === "in_progress") return "In Progress";
  if (issue.overdue_flag) return "Overdue";
  return "Open";
}

function getStatusClass(issue) {
  const label = getStatusLabel(issue);
  const map = {
    "Closed": "bg-green-100 text-green-800",
    "Awaiting Response": "bg-purple-100 text-purple-800",
    "Repaired": "bg-blue-100 text-blue-800",
    "Scheduled": "bg-yellow-100 text-yellow-800",
    "In Progress": "bg-orange-100 text-orange-800",
    "Overdue": "bg-red-200 text-red-900",
    "Open": "bg-red-100 text-red-800",
  };
  return map[label] || "bg-gray-100 text-gray-700";
}

function buildPeriodOptions() {
  const now = new Date();
  const options = [];
  // Last 3 months
  for (let i = 0; i < 3; i++) {
    const d = subMonths(now, i);
    options.push({
      type: "month",
      label: format(d, "MMMM yyyy"),
      start: format(startOfMonth(d), "yyyy-MM-dd"),
      end: i === 0 ? null : format(startOfMonth(subMonths(d, -1)), "yyyy-MM-dd"),
    });
  }
  // Last 2 weeks
  for (let i = 0; i < 2; i++) {
    const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 0 });
    const weekEnd = i === 0 ? null : format(startOfWeek(subWeeks(now, i - 1), { weekStartsOn: 0 }), "yyyy-MM-dd");
    options.push({
      type: "week",
      label: i === 0 ? "Current Week" : "Previous Week",
      start: format(weekStart, "yyyy-MM-dd"),
      end: weekEnd,
    });
  }
  return options;
}

function TechDrillDown({ techName, issues, onClose, projectMap }) {
  const sorted = [...issues].sort((a, b) => getIssueDate(b).localeCompare(getIssueDate(a)));
  const open = issues.filter(isOpenIssue);
  const awaiting = issues.filter(i => i.repair_status === "qc_email_sent_pending");
  const overdue = issues.filter(isOverdueIssue);
  const closed = issues.filter(isClosedIssue);

  const emailBody = [
    `Technician: ${techName}`,
    "",
    `Open Failures (${open.length}):`,
    ...open.map(i => `  • Asset ${i.asset_number || "N/A"} — ${fmtDate(getIssueDate(i))} — ${projectMap[i.project_id] || i.customer || "Unknown"}`),
    "",
    awaiting.length > 0 ? `Awaiting Response (${awaiting.length}):` : null,
    ...awaiting.map(i => `  • Asset ${i.asset_number || "N/A"} — ${fmtDate(getIssueDate(i))}`),
    overdue.length > 0 ? `\nOverdue (${overdue.length}):` : null,
    ...overdue.map(i => `  • Asset ${i.asset_number || "N/A"} — ${fmtDate(getIssueDate(i))} — ${i.days_open ?? "?"} days open`),
  ].filter(l => l !== null).join("\n");

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{techName}</h2>
            <p className="text-sm text-gray-500">{issues.length} failures in period</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                const subject = encodeURIComponent(`QC Failures - ${techName}`);
                const body = encodeURIComponent(emailBody);
                window.open(`mailto:?subject=${subject}&body=${body}`);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
            >
              <Mail className="w-4 h-4" /> Compose Email
            </button>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex gap-4 px-4 py-3 border-b bg-gray-50 text-sm">
          <span className="text-red-700 font-semibold">{open.length} Open</span>
          <span className="text-purple-700 font-semibold">{awaiting.length} Awaiting Response</span>
          <span className="text-red-900 font-semibold">{overdue.length} Overdue</span>
          <span className="text-green-700 font-semibold">{closed.length} Closed</span>
        </div>

        <div className="overflow-y-auto flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Failure Date</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Install Date</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Asset #</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Project</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map(issue => (
                <tr key={issue.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">{fmtDate(getIssueDate(issue))}</td>
                  <td className="px-4 py-2 text-gray-500">{fmtDate(issue.install_service_date)}</td>
                  <td className="px-4 py-2 font-mono text-xs">{issue.asset_number || "—"}</td>
                  <td className="px-4 py-2 text-gray-700">{projectMap[issue.project_id] || issue.customer || "—"}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusClass(issue)}`}>
                      {getStatusLabel(issue)}
                    </span>
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

export default function TopFailures({ issues, projectMap }) {
  const periodOptions = useMemo(() => buildPeriodOptions(), []);
  const [selectedPeriod, setSelectedPeriod] = useState(periodOptions[0]);
  const [drillDown, setDrillDown] = useState(null);

  // Filter issues to reporting cutoff AND selected period
  const periodIssues = useMemo(() => {
    return issues.filter(issue => {
      const d = getIssueDate(issue);
      if (!d || d < REPORTING_CUTOFF) return false;
      if (d < selectedPeriod.start) return false;
      if (selectedPeriod.end && d >= selectedPeriod.end) return false;
      return true;
    });
  }, [issues, selectedPeriod]);

  // Group by technician
  const techRankings = useMemo(() => {
    const map = {};
    for (const issue of periodIssues) {
      const name = issue.technician_name || "Unknown";
      if (!map[name]) map[name] = { name, issues: [], open: 0, closed: 0, overdue: 0 };
      map[name].issues.push(issue);
      if (isOpenIssue(issue)) map[name].open++;
      if (isClosedIssue(issue)) map[name].closed++;
      if (isOverdueIssue(issue)) map[name].overdue++;
    }
    return Object.values(map).sort((a, b) => b.issues.length - a.issues.length);
  }, [periodIssues]);

  const drillTech = drillDown ? techRankings.find(t => t.name === drillDown) : null;

  return (
    <>
      {drillTech && (
        <TechDrillDown
          techName={drillTech.name}
          issues={drillTech.issues}
          onClose={() => setDrillDown(null)}
          projectMap={projectMap}
        />
      )}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <CardTitle className="text-base font-semibold">Top Failures by Technician</CardTitle>
              <Badge variant="outline" className="text-xs text-gray-500">Apr 1, 2026+</Badge>
            </div>
            <div className="flex flex-wrap gap-1">
              {periodOptions.map(opt => (
                <button
                  key={opt.label}
                  onClick={() => setSelectedPeriod(opt)}
                  className={`px-2.5 py-1 text-xs rounded-full border font-medium transition-all ${
                    selectedPeriod.label === opt.label
                      ? "bg-red-600 text-white border-red-600"
                      : "bg-white text-gray-600 border-gray-300 hover:border-red-400 hover:text-red-600"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-1">{periodIssues.length} failures in period · Click a technician to drill down</p>
        </CardHeader>
        <CardContent className="p-0">
          {techRankings.length === 0 ? (
            <p className="text-center py-8 text-gray-400 text-sm">No failures found for this period.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {techRankings.map((tech, idx) => (
                <div
                  key={tech.name}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer"
                  onClick={() => setDrillDown(tech.name)}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${
                      idx === 0 ? "bg-red-500" : idx === 1 ? "bg-orange-500" : idx === 2 ? "bg-yellow-500" : "bg-gray-400"
                    }`}>{idx + 1}</span>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{tech.name}</p>
                      <div className="flex gap-3 text-xs text-gray-500 mt-0.5">
                        <span className="text-red-600 font-medium">{tech.open} open</span>
                        {tech.overdue > 0 && <span className="text-red-800 font-semibold">{tech.overdue} overdue</span>}
                        <span className="text-green-600">{tech.closed} closed</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-gray-900">{tech.issues.length}</span>
                    <span className="text-xs text-gray-400">failures</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}