import React, { useState } from "react";
import { base44 } from "@/api/warrantyClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, Save, ChevronDown, ChevronUp } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const REPAIR_STATUSES = [
  { value: "not_started",          label: "Not Started" },
  { value: "qc_email_sent_pending", label: "QC Email Sent – Pending" },
  { value: "scheduled",            label: "Scheduled" },
  { value: "in_progress",          label: "In Progress" },
  { value: "completed",            label: "Completed" },
  { value: "verified",             label: "Verified" },
  { value: "reopened",             label: "Reopened" },
];

// Statuses that require completion fields
const COMPLETION_REQUIRED_STATUSES = ["completed", "verified"];

const RESOLUTION_OUTCOMES = [
  { value: "fully_resolved", label: "Fully Resolved" },
  { value: "partially_resolved", label: "Partially Resolved" },
  { value: "failed_reopened", label: "Failed / Reopened" },
];

export default function WarrantyResolutionPanel({ qcIssue }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    repair_status: qcIssue.repair_status || "",
    repair_action_taken: qcIssue.repair_action_taken || "",
    repair_completed_by: qcIssue.repair_completed_by || "",
    repair_completed_date: qcIssue.repair_completed_date || "",
    qc_verified: qcIssue.qc_verified || false,
    qc_verified_by: qcIssue.qc_verified_by || "",
    qc_verification_date: qcIssue.qc_verification_date || "",
    resolution_outcome: qcIssue.resolution_outcome || "",
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.QCIssue.update(qcIssue.id, form);
    queryClient.invalidateQueries({ queryKey: ["qcIssues"] });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const repairStatusLabel = REPAIR_STATUSES.find(s => s.value === form.repair_status)?.label;
  const outcomeLabel = RESOLUTION_OUTCOMES.find(s => s.value === form.resolution_outcome)?.label;

  return (
    <div className="mt-3 border-2 border-orange-200 rounded-lg overflow-hidden">
      {/* Header / toggle */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-orange-50 to-amber-50 hover:from-orange-100 hover:to-amber-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-orange-600" />
          <span className="text-sm font-semibold text-orange-800">Warranty Resolution</span>
          {repairStatusLabel && (
            <span className="text-xs bg-orange-100 border border-orange-200 text-orange-700 px-2 py-0.5 rounded-full">{repairStatusLabel}</span>
          )}
          {outcomeLabel && (
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
              form.resolution_outcome === "fully_resolved"
                ? "bg-green-100 border-green-200 text-green-700"
                : form.resolution_outcome === "failed_reopened"
                ? "bg-red-100 border-red-200 text-red-700"
                : "bg-yellow-100 border-yellow-200 text-yellow-700"
            }`}>{outcomeLabel}</span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-orange-500" /> : <ChevronDown className="w-4 h-4 text-orange-500" />}
      </button>

      {open && (
        <div className="p-4 bg-white space-y-4">
          {/* Row 1: repair status + outcome */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Repair Status</label>
              <Select value={form.repair_status} onValueChange={v => set("repair_status", v)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select status..." />
                </SelectTrigger>
                <SelectContent>
                  {REPAIR_STATUSES.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Resolution Outcome</label>
              <Select value={form.resolution_outcome} onValueChange={v => set("resolution_outcome", v)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select outcome..." />
                </SelectTrigger>
                <SelectContent>
                  {RESOLUTION_OUTCOMES.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Repair action taken */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Repair Action Taken</label>
            <textarea
              value={form.repair_action_taken}
              onChange={e => set("repair_action_taken", e.target.value)}
              rows={3}
              placeholder="Describe what was done to fix the issue..."
              className="w-full text-sm border border-input rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Row 2: completed by + date — only shown for completion statuses */}
          {COMPLETION_REQUIRED_STATUSES.includes(form.repair_status) && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Repair Completed By</label>
              <Input
                value={form.repair_completed_by}
                onChange={e => set("repair_completed_by", e.target.value)}
                placeholder="Technician name..."
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Repair Completed Date</label>
              <Input
                type="date"
                value={form.repair_completed_date}
                onChange={e => set("repair_completed_date", e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
          )}

          {/* QC Verification */}
          <div className="border-t pt-3 space-y-3">
            <div className="flex items-center gap-3">
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
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Verified By</label>
                  <Input
                    value={form.qc_verified_by}
                    onChange={e => set("qc_verified_by", e.target.value)}
                    placeholder="Name..."
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Verification Date</label>
                  <Input
                    type="date"
                    value={form.qc_verification_date}
                    onChange={e => set("qc_verification_date", e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Save */}
          <div className="pt-1">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className={`w-full text-sm gap-2 ${saved ? "bg-green-600 hover:bg-green-700" : ""}`}
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "Saving..." : saved ? "Saved ✓" : "Save Warranty Resolution"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}