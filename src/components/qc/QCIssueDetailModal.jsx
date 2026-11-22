import React, { useState } from "react";
import { base44 } from "@/api/warrantyClient";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save, ShieldCheck, AlertTriangle, Package, User, Calendar, Wrench } from "lucide-react";

const REPAIR_STATUSES = [
  { value: "not_started",           label: "Not Started" },
  { value: "qc_email_sent_pending", label: "QC Email Sent – Pending" },
  { value: "scheduled",             label: "Scheduled" },
  { value: "in_progress",           label: "In Progress" },
  { value: "completed",             label: "Completed" },
  { value: "verified",              label: "Verified" },
  { value: "reopened",              label: "Reopened" },
];

const COMPLETION_REQUIRED_STATUSES = ["completed", "verified"];

const RESOLUTION_OUTCOMES = [
  { value: "fully_resolved",    label: "Fully Resolved" },
  { value: "partially_resolved", label: "Partially Resolved" },
  { value: "failed_reopened",   label: "Failed / Reopened" },
];

const REPAIR_STATUS_COLORS = {
  not_started:           "bg-gray-100 text-gray-700",
  qc_email_sent_pending: "bg-purple-100 text-purple-800",
  scheduled:             "bg-blue-100 text-blue-800",
  in_progress: "bg-orange-100 text-orange-800",
  completed:   "bg-yellow-100 text-yellow-800",
  verified:    "bg-green-100 text-green-800",
  reopened:    "bg-red-100 text-red-800",
};

const STATUS_COLORS = {
  pending_repair: "bg-red-100 text-red-800",
  scheduled:      "bg-yellow-100 text-yellow-800",
  repaired:       "bg-blue-100 text-blue-800",
  closed:         "bg-green-100 text-green-800",
};

function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

function getNextAction(repairStatus, qcVerified) {
  if (qcVerified) return null;
  switch (repairStatus) {
    case "not_started":
    case "": return { label: "Schedule Repair", color: "bg-blue-100 text-blue-800" };
    case "scheduled":   return { label: "Complete Repair", color: "bg-orange-100 text-orange-800" };
    case "in_progress": return { label: "Complete Repair", color: "bg-orange-100 text-orange-800" };
    case "completed":   return { label: "Verify Repair", color: "bg-yellow-100 text-yellow-800" };
    case "reopened":    return { label: "Follow Up Required", color: "bg-red-100 text-red-800" };
    default: return null;
  }
}

export default function QCIssueDetailModal({ issue, onClose }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    repair_action_taken:  issue.repair_action_taken || issue.repair_notes || "",
    repair_status:        issue.repair_status || "",
    repair_completed_by:  issue.repair_completed_by || "",
    repair_completed_date: issue.repair_completed_date || "",
    qc_verified:          issue.qc_verified || false,
    qc_verified_by:       issue.qc_verified_by || "",
    qc_verification_date: issue.qc_verification_date || "",
    resolution_outcome:   issue.resolution_outcome || "",
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    // Strip empty strings so they don't overwrite existing values with blanks
    const payload = Object.fromEntries(
      Object.entries(form).filter(([, v]) => v !== "" || typeof v === "boolean")
    );
    await base44.entities.QCIssue.update(issue.id, payload);
    // Immediately update the cache so the table reflects changes without waiting for refetch
    queryClient.setQueryData(["qcIssues"], (old) =>
      old ? old.map(i => i.id === issue.id ? { ...i, ...payload } : i) : old
    );
    queryClient.invalidateQueries({ queryKey: ["qcIssues"] });
    setSaving(false);
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 1000);
  };

  const displayCustomer = issue.customer || (() => {
    const from = issue.source_email_from || "";
    return from.includes("<") ? from.split("<")[0].trim().replace(/"/g, "") : from;
  })();

  const fmtDate = (d) => {
    if (!d) return "—";
    try { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); } catch { return d; }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-6 overflow-y-auto" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b bg-gradient-to-r from-red-50 to-orange-50 rounded-t-xl">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
              <h2 className="text-lg font-bold text-gray-900 truncate">{issue.work_order_name || "QC Issue"}</h2>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[issue.status] || "bg-gray-100 text-gray-700"}`}>
                {issue.status?.replace(/_/g, " ")}
              </span>
              {issue.warranty_return_required && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800 border border-red-300">
                  <Package className="w-3 h-3" /> ⚠ Warranty Return
                </span>
              )}
            </div>
            <div className="flex gap-4 text-xs text-gray-500 flex-wrap">
              <span className="flex items-center gap-1"><User className="w-3 h-3" />{issue.technician_name || "—"}</span>
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{fmtDate(issue.date_received || issue.source_email_date)}</span>
              {displayCustomer && <span className="font-medium text-gray-700">{displayCustomer}</span>}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-200 ml-3 shrink-0">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Warranty pinned panel */}
          {issue.warranty_return_required && (
            <div className="rounded-lg border-2 border-red-300 bg-red-50 p-3 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-red-600" />
                <span className="text-sm font-bold text-red-800">Warranty Return Required</span>
              </div>
              {form.repair_status && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${REPAIR_STATUS_COLORS[form.repair_status] || "bg-gray-100 text-gray-700"}`}>
                  {REPAIR_STATUSES.find(s => s.value === form.repair_status)?.label || form.repair_status}
                </span>
              )}
              {(() => {
                const next = getNextAction(form.repair_status, form.qc_verified);
                return next ? (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${next.color}`}>
                    <Wrench className="w-3 h-3" /> Next: {next.label}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800">
                    <ShieldCheck className="w-3 h-3" /> ✓ Fully Verified
                  </span>
                );
              })()}
            </div>
          )}

          {/* QC Notes read-only */}
          {(issue.qc_notes || issue.remote_qc_notes) && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
              <p className="font-semibold text-red-900 mb-1 text-xs uppercase tracking-wide">Remote QC Notes</p>
              {issue.qc_notes || issue.remote_qc_notes}
            </div>
          )}

          {/* Corrective action */}
          <Field label="Corrective Action / Repair Notes">
            <textarea
              value={form.repair_action_taken}
              onChange={e => set("repair_action_taken", e.target.value)}
              rows={3}
              placeholder="Describe what was done to fix the issue..."
              className="w-full text-sm border border-input rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>

          {/* Warranty Resolution section */}
          {issue.warranty_return_required && (
            <div className="border-2 border-orange-200 rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-50 to-amber-50">
                <ShieldCheck className="w-4 h-4 text-orange-600" />
                <span className="text-sm font-semibold text-orange-800">Warranty Resolution</span>
              </div>
              <div className="p-4 space-y-3 bg-white">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Repair Status">
                    <Select value={form.repair_status} onValueChange={v => set("repair_status", v)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>{REPAIR_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Resolution Outcome">
                    <Select value={form.resolution_outcome} onValueChange={v => set("resolution_outcome", v)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>{RESOLUTION_OUTCOMES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Completed By">
                      <Input value={form.repair_completed_by} onChange={e => set("repair_completed_by", e.target.value)} placeholder="Name..." className="h-8 text-sm" />
                    </Field>
                    <Field label="Completed Date">
                      <Input type="date" value={form.repair_completed_date} onChange={e => set("repair_completed_date", e.target.value)} className="h-8 text-sm" />
                    </Field>
                  </div>
                <div className="flex items-center gap-3 pt-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">QC Verified</label>
                  <button
                    onClick={() => set("qc_verified", !form.qc_verified)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.qc_verified ? "bg-green-500" : "bg-gray-300"}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${form.qc_verified ? "translate-x-[18px]" : "translate-x-[3px]"}`} />
                  </button>
                  {form.qc_verified && <span className="text-xs text-green-600 font-medium">Verified ✓</span>}
                </div>
                {form.qc_verified && (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Verified By">
                      <Input value={form.qc_verified_by} onChange={e => set("qc_verified_by", e.target.value)} placeholder="Name..." className="h-8 text-sm" />
                    </Field>
                    <Field label="Verification Date">
                      <Input type="date" value={form.qc_verification_date} onChange={e => set("qc_verification_date", e.target.value)} className="h-8 text-sm" />
                    </Field>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t bg-gray-50 rounded-b-xl">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className={`flex-1 gap-2 ${saved ? "bg-green-600 hover:bg-green-700" : ""}`}>
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : saved ? "Saved ✓" : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}