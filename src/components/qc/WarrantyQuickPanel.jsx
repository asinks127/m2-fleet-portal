import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/warrantyClient";

const warrantyQuickAction = (payload) => base44.functions.invoke('warrantyQuickAction', payload);
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, CalendarClock, PlayCircle, CheckCircle2, ShieldCheck, RotateCcw, Clock, User, Package } from "lucide-react";
import { format } from "date-fns";

const REPAIR_STATUS_COLORS = {
  not_started: "bg-gray-100 text-gray-700",
  qc_email_sent_pending: "bg-purple-100 text-purple-800",
  scheduled: "bg-blue-100 text-blue-800",
  in_progress: "bg-orange-100 text-orange-800",
  completed: "bg-yellow-100 text-yellow-800",
  verified: "bg-green-100 text-green-800",
  reopened: "bg-red-100 text-red-800",
};

const NEXT_ACTION_COLORS = {
  "Schedule Repair": "bg-blue-50 text-blue-800 border-blue-200",
  "Repair In Progress": "bg-orange-50 text-orange-800 border-orange-200",
  "Awaiting Completion": "bg-yellow-50 text-yellow-800 border-yellow-200",
  "Awaiting QC Verification": "bg-purple-50 text-purple-800 border-purple-200",
  "Closed": "bg-green-50 text-green-800 border-green-200",
  "Reopened - Immediate Attention": "bg-red-50 text-red-800 border-red-200",
};

function fmtDate(d) {
  if (!d) return "—";
  try { return format(new Date(d), "MMM d, yyyy"); } catch { return d; }
}

function AuditTimeline({ log }) {
  let entries = [];
  try { entries = JSON.parse(log || "[]"); } catch { entries = []; }
  if (entries.length === 0) return <p className="text-xs text-gray-400 italic">No activity yet.</p>;
  return (
    <div className="space-y-2">
      {[...entries].reverse().map((e, i) => (
        <div key={i} className="flex gap-2 text-xs">
          <div className="w-1 rounded bg-blue-200 shrink-0 mt-0.5" style={{ minHeight: 28 }} />
          <div>
            <span className="font-semibold text-gray-700">{e.action}</span>
            {e.notes && <span className="text-gray-500 ml-1">— {e.notes.slice(0, 80)}</span>}
            <div className="text-gray-400">{e.user} · {e.timestamp ? fmtDate(e.timestamp.split("T")[0]) : "—"}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function WarrantyQuickPanel({ issue, projectName, onClose, onUpdated }) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(null);
  const [repairAction, setRepairAction] = useState(issue.repair_action_taken || "");
  const [reopenReason, setReopenReason] = useState("");
  const [showReopenForm, setShowReopenForm] = useState(false);
  const [error, setError] = useState("");

  const run = async (action, extra = {}) => {
    setError("");
    setLoading(action);
    const res = await warrantyQuickAction({ issue_id: issue.id, action, extra });
    setLoading(null);
    if (res.data?.error) { setError(res.data.error); return; }
    queryClient.invalidateQueries({ queryKey: ["qcIssues"] });
    onUpdated?.();
  };

  const nextAction = issue.next_action_needed || (
    issue.qc_verified ? "Closed" :
    !issue.repair_status || issue.repair_status === "not_started" ? "Schedule Repair" :
    issue.repair_status === "scheduled" ? "Repair In Progress" :
    issue.repair_status === "in_progress" ? "Awaiting Completion" :
    issue.repair_status === "completed" ? "Awaiting QC Verification" :
    issue.repair_status === "reopened" ? "Reopened - Immediate Attention" : "Schedule Repair"
  );

  const isClosed = issue.status === "closed" || issue.repair_status === "verified";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-orange-500 text-white p-4 flex items-start justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-4 h-4" />
              <span className="font-bold text-sm">Warranty Return</span>
              {issue.overdue_flag && <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded font-semibold">OVERDUE</span>}
            </div>
            <h2 className="text-lg font-bold">{issue.work_order_name || "QC Issue"}</h2>
            <p className="text-red-100 text-xs mt-0.5">{issue.asset_number && `Asset: ${issue.asset_number}`} {issue.date_received && `· Received: ${fmtDate(issue.date_received)}`}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 p-4 space-y-4">
          {/* Status row */}
          <div className="flex flex-wrap gap-2 items-center">
            {issue.repair_status && (
              <span className={`text-xs font-semibold px-2 py-1 rounded ${REPAIR_STATUS_COLORS[issue.repair_status] || "bg-gray-100"}`}>
                {issue.repair_status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
              </span>
            )}
            <span className={`text-xs font-semibold px-2 py-1 rounded border ${NEXT_ACTION_COLORS[nextAction] || "bg-gray-50 text-gray-700 border-gray-200"}`}>
              ▶ {nextAction}
            </span>
            {issue.reopen_count > 0 && (
              <span className="text-xs font-semibold px-2 py-1 rounded bg-red-100 text-red-700">Reopened ×{issue.reopen_count}</span>
            )}
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-2 text-sm bg-gray-50 rounded-lg p-3">
            <div><span className="text-xs text-gray-500">Technician</span><p className="font-medium">{issue.technician_name || "—"}</p></div>
            <div><span className="text-xs text-gray-500">Project</span><p className="font-medium">{projectName || "—"}</p></div>
            <div><span className="text-xs text-gray-500">Customer</span><p className="font-medium">{issue.customer || "—"}</p></div>
            <div><span className="text-xs text-gray-500">Days Open</span><p className={`font-bold ${issue.days_open > 5 ? "text-red-600" : "text-gray-900"}`}>{issue.days_open ?? "—"}</p></div>
          </div>

          {/* Issue summary */}
          {(issue.issue_summary_clean || issue.qc_notes) && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
              <p className="text-xs font-semibold text-red-600 uppercase mb-1">Issue Summary</p>
              <p>{issue.issue_summary_clean || issue.qc_notes?.slice(0, 300)}</p>
            </div>
          )}

          {issue.post_install_notes && (
            <div className="bg-gray-50 border rounded-lg p-3 text-sm text-gray-700">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Post Install Notes</p>
              <p>{issue.post_install_notes.slice(0, 300)}</p>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Corrective Action / Repair Notes</p>
            <textarea
              value={repairAction}
              onChange={e => setRepairAction(e.target.value)}
              rows={3}
              placeholder="Describe what was done..."
              className="w-full text-sm border border-input rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => run("update_fields", { repair_action_taken: repairAction })}>
              Save Notes
            </Button>
          </div>

          {/* Completed / verified details */}
          {issue.repair_completed_by && (
            <div className="text-xs text-gray-600 bg-yellow-50 rounded p-2">
              <span className="font-semibold">Completed by:</span> {issue.repair_completed_by} · {fmtDate(issue.repair_completed_date)}
            </div>
          )}
          {issue.qc_verified && (
            <div className="text-xs text-green-800 bg-green-50 rounded p-2">
              <span className="font-semibold">✓ Verified by:</span> {issue.qc_verified_by} · {fmtDate(issue.qc_verification_date)}
            </div>
          )}
          {issue.reopened_reason && (
            <div className="text-xs text-red-800 bg-red-50 rounded p-2">
              <span className="font-semibold">Reopen reason:</span> {issue.reopened_reason}
            </div>
          )}

          {error && <p className="text-red-600 text-sm bg-red-50 rounded p-2">{error}</p>}

          {/* Quick action buttons */}
          {!isClosed && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Quick Actions</p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm" variant="outline"
                  className="h-9 text-xs gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50"
                  disabled={loading === "schedule"}
                  onClick={() => run("schedule")}
                >
                  <CalendarClock className="w-3.5 h-3.5" />
                  {loading === "schedule" ? "..." : "Schedule Repair"}
                </Button>
                <Button
                  size="sm" variant="outline"
                  className="h-9 text-xs gap-1.5 border-orange-200 text-orange-700 hover:bg-orange-50"
                  disabled={loading === "start"}
                  onClick={() => run("start")}
                >
                  <PlayCircle className="w-3.5 h-3.5" />
                  {loading === "start" ? "..." : "Start Repair"}
                </Button>
                <Button
                  size="sm" variant="outline"
                  className="h-9 text-xs gap-1.5 border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                  disabled={loading === "complete"}
                  onClick={() => run("complete", { repair_action_taken: repairAction })}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {loading === "complete" ? "..." : "Mark Completed"}
                </Button>
                <Button
                  size="sm"
                  className="h-9 text-xs gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                  disabled={loading === "verify" || issue.repair_status !== "completed"}
                  onClick={() => run("verify")}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {loading === "verify" ? "..." : "Mark Verified"}
                </Button>
              </div>
            </div>
          )}

          {/* Reopen */}
          {(isClosed || issue.repair_status === "verified" || issue.repair_status === "completed") && (
            <div>
              {!showReopenForm ? (
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-red-200 text-red-700 hover:bg-red-50 w-full" onClick={() => setShowReopenForm(true)}>
                  <RotateCcw className="w-3.5 h-3.5" /> Reopen Issue
                </Button>
              ) : (
                <div className="space-y-2 border border-red-200 rounded-lg p-3 bg-red-50">
                  <p className="text-xs font-semibold text-red-700">Reason for reopening (required)</p>
                  <Input value={reopenReason} onChange={e => setReopenReason(e.target.value)} placeholder="Describe why..." className="h-8 text-sm" />
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="h-8 text-xs flex-1" onClick={() => setShowReopenForm(false)}>Cancel</Button>
                    <Button size="sm" className="h-8 text-xs flex-1 bg-red-600 hover:bg-red-700 text-white" disabled={!reopenReason || loading === "reopen"} onClick={() => run("reopen", { reopened_reason: reopenReason })}>
                      {loading === "reopen" ? "..." : "Confirm Reopen"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Audit timeline */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Activity Log</p>
            <AuditTimeline log={issue.warranty_audit_log} />
          </div>
        </div>
      </div>
    </div>
  );
}