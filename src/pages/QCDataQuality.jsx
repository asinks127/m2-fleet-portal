import React, { useState, useMemo } from "react";
import { base44 } from "@/api/warrantyClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, AlertTriangle, XCircle, Copy, RefreshCw, CheckCircle2, Edit2, Save, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { computeDataQualityStatus, getMissingFields } from "../lib/qcUtils";

const STATUS_CONFIG = {
  valid:        { label: "Valid",        color: "bg-green-100 text-green-800",  icon: CheckCircle2,   bg: "bg-green-50  border-green-200" },
  needs_review: { label: "Needs Review", color: "bg-yellow-100 text-yellow-800", icon: AlertTriangle, bg: "bg-yellow-50 border-yellow-200" },
  incomplete:   { label: "Incomplete",   color: "bg-red-100 text-red-800",      icon: XCircle,        bg: "bg-red-50   border-red-200" },
  duplicate:    { label: "Duplicate",    color: "bg-gray-100 text-gray-700",    icon: Copy,           bg: "bg-gray-50  border-gray-200" },
};

const ISSUE_TYPES = ["qc_issue", "warranty_return", "damage_claim", "documentation_issue"];

const fmtDate = (d) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); } catch { return d; }
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.needs_review;
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>;
}

function InlineEdit({ issue, technicians, onSave, onCancel }) {
  const missing = getMissingFields(issue);
  const [form, setForm] = useState({
    asset_number: issue.asset_number || "",
    qc_event_date: issue.qc_event_date || "",
    issue_type: issue.issue_type || "",
    technician_id: issue.technician_id || "",
    technician_name: issue.technician_name || "",
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const selectedTech = technicians.find(t => t.id === form.technician_id);

  return (
    <tr className="bg-blue-50 border-t border-blue-200">
      <td colSpan={8} className="px-4 py-3">
        <div className="flex flex-wrap gap-3 items-end">
          {(missing.includes("asset_number") || !issue.asset_number) && (
            <div>
              <label className="text-xs text-gray-500 block mb-1">Asset Number *</label>
              <Input value={form.asset_number} onChange={e => set("asset_number", e.target.value)} className="h-8 text-xs w-36" placeholder="Asset #" />
            </div>
          )}
          {(missing.includes("qc_event_date") || !issue.qc_event_date) && (
            <div>
              <label className="text-xs text-gray-500 block mb-1">QC Event Date *</label>
              <Input type="date" value={form.qc_event_date} onChange={e => set("qc_event_date", e.target.value)} className="h-8 text-xs w-40" />
            </div>
          )}
          {(missing.includes("issue_type") || !issue.issue_type) && (
            <div>
              <label className="text-xs text-gray-500 block mb-1">Issue Type *</label>
              <Select value={form.issue_type} onValueChange={v => set("issue_type", v)}>
                <SelectTrigger className="h-8 text-xs w-44"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {ISSUE_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {missing.includes("technician") && (
            <div>
              <label className="text-xs text-gray-500 block mb-1">Technician *</label>
              <Select value={form.technician_id} onValueChange={v => {
                const t = technicians.find(t => t.id === v);
                set("technician_id", v);
                if (t) set("technician_name", t.full_name);
              }}>
                <SelectTrigger className="h-8 text-xs w-48"><SelectValue placeholder="Assign technician" /></SelectTrigger>
                <SelectContent>
                  {technicians.filter(t => t.status !== "inactive").map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex gap-2 ml-auto">
            <Button size="sm" className="h-8 bg-blue-600 hover:bg-blue-700 text-xs" onClick={() => onSave(form)}>
              <Save className="w-3.5 h-3.5 mr-1" /> Save
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onCancel}>
              <X className="w-3.5 h-3.5 mr-1" /> Cancel
            </Button>
          </div>
        </div>
      </td>
    </tr>
  );
}

export default function QCDataQuality() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState("all_invalid");
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const { data: issues = [], isLoading, refetch } = useQuery({
    queryKey: ["qcIssues-quality"],
    queryFn: () => base44.entities.QCIssue.list("-created_date"),
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ["technicians"],
    queryFn: () => base44.entities.Technician.list(),
  });

  const annotated = useMemo(() =>
    issues.map(i => ({ ...i, _dqs: computeDataQualityStatus(i), _missing: getMissingFields(i) })),
    [issues]
  );

  const summary = useMemo(() => {
    const counts = { valid: 0, needs_review: 0, incomplete: 0, duplicate: 0 };
    for (const i of annotated) counts[i._dqs] = (counts[i._dqs] || 0) + 1;
    return { ...counts, total: annotated.length };
  }, [annotated]);

  const displayed = useMemo(() => {
    if (filterStatus === "all_invalid") return annotated.filter(i => i._dqs !== "valid");
    if (filterStatus === "all") return annotated;
    return annotated.filter(i => i._dqs === filterStatus);
  }, [annotated, filterStatus]);

  const handleSave = async (issue, formData) => {
    setSaving(true);
    const payload = {};
    if (formData.asset_number)   payload.asset_number   = formData.asset_number;
    if (formData.qc_event_date)  payload.qc_event_date  = formData.qc_event_date;
    if (formData.issue_type)     payload.issue_type     = formData.issue_type;
    if (formData.technician_id)  payload.technician_id  = formData.technician_id;
    if (formData.technician_name) payload.technician_name = formData.technician_name;
    // Clear needs_review if we've fixed the fields
    if (issue.parse_status === "needs_review") {
      const wouldBeValid = !getMissingFields({ ...issue, ...payload }).length;
      if (wouldBeValid) payload.parse_status = "ok";
    }
    await base44.entities.QCIssue.update(issue.id, payload);
    queryClient.invalidateQueries({ queryKey: ["qcIssues-quality"] });
    queryClient.invalidateQueries({ queryKey: ["qcIssues"] });
    toast({ title: "Record updated", description: "Data quality status will refresh automatically." });
    setEditingId(null);
    setSaving(false);
  };

  const handleMarkArchived = async (id) => {
    await base44.entities.QCIssue.update(id, { data_status: "archived" });
    queryClient.invalidateQueries({ queryKey: ["qcIssues-quality"] });
    toast({ title: "Record archived" });
  };

  if (isLoading) return <div className="p-8 text-center text-gray-400">Loading...</div>;

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-blue-600" /> Data Quality Review
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Only <strong>valid</strong> records count in metrics. Fix incomplete or flagged records here.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { key: "total",        label: "Total",        value: summary.total,        color: "text-gray-900" },
          { key: "valid",        label: "Valid",         value: summary.valid,        color: "text-green-700" },
          { key: "incomplete",   label: "Incomplete",    value: summary.incomplete,   color: "text-red-600" },
          { key: "needs_review", label: "Needs Review",  value: summary.needs_review, color: "text-yellow-700" },
          { key: "duplicate",    label: "Duplicates",    value: summary.duplicate,    color: "text-gray-600" },
        ].map(m => {
          const cfg = STATUS_CONFIG[m.key];
          return (
            <Card
              key={m.key}
              className={`cursor-pointer transition-all ${filterStatus === m.key ? "ring-2 ring-blue-500" : "hover:shadow-md"}`}
              onClick={() => setFilterStatus(m.key === "total" ? "all" : m.key)}
            >
              <CardContent className="p-4 text-center">
                <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{m.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: "all_invalid", label: `All Non-Valid (${(summary.incomplete || 0) + (summary.needs_review || 0) + (summary.duplicate || 0)})` },
          { key: "incomplete",   label: `Incomplete (${summary.incomplete || 0})` },
          { key: "needs_review", label: `Needs Review (${summary.needs_review || 0})` },
          { key: "duplicate",    label: `Duplicates (${summary.duplicate || 0})` },
          { key: "all",          label: `All Records (${summary.total})` },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilterStatus(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filterStatus === f.key ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Validation rules reference */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-800">
        <strong>Validation rules:</strong> A record is <strong>valid</strong> when it has: asset_number · qc_event_date · issue_type · non-placeholder technician (id or name) · no duplicate flag · not archived/legacy · parse_status = ok.
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-gray-700">
            {displayed.length} record{displayed.length !== 1 ? "s" : ""} shown
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase border-b">
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Asset #</th>
                  <th className="px-4 py-2 text-left">Technician</th>
                  <th className="px-4 py-2 text-left">QC Date</th>
                  <th className="px-4 py-2 text-left">Issue Type</th>
                  <th className="px-4 py-2 text-left">Customer</th>
                  <th className="px-4 py-2 text-left">Missing Fields</th>
                  <th className="px-4 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayed.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-gray-400">
                      <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-400" />
                      No records in this category 🎉
                    </td>
                  </tr>
                )}
                {displayed.map(issue => (
                  <React.Fragment key={issue.id}>
                    <tr className={`border-b hover:bg-gray-50 ${editingId === issue.id ? "bg-blue-50/40" : ""}`}>
                      <td className="px-4 py-2.5"><StatusBadge status={issue._dqs} /></td>
                      <td className="px-4 py-2.5">
                        {issue.asset_number
                          ? <span className="font-medium text-gray-900">{issue.asset_number}</span>
                          : <span className="text-red-500 text-xs italic">missing</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        {issue.technician_name
                          ? <span className="text-gray-700">{issue.technician_name}</span>
                          : <span className="text-red-500 text-xs italic">missing</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        {issue.qc_event_date
                          ? <span className="text-gray-600 text-xs">{fmtDate(issue.qc_event_date)}</span>
                          : <span className="text-red-500 text-xs italic">missing</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        {issue.issue_type
                          ? <span className="text-xs text-gray-600 capitalize">{issue.issue_type.replace(/_/g, " ")}</span>
                          : <span className="text-red-500 text-xs italic">missing</span>}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">{issue.customer || "—"}</td>
                      <td className="px-4 py-2.5">
                        {issue._missing.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {issue._missing.map(f => (
                              <span key={f} className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs">{f}</span>
                            ))}
                          </div>
                        ) : (
                          issue._dqs === "needs_review"
                            ? <span className="text-xs text-yellow-700">parse_status / data_status</span>
                            : issue._dqs === "duplicate"
                              ? <span className="text-xs text-gray-500">duplicate flag</span>
                              : <span className="text-xs text-green-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-1.5">
                          {issue._dqs !== "duplicate" && issue._dqs !== "valid" && (
                            <Button
                              size="sm" variant="outline"
                              className="h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                              onClick={() => setEditingId(editingId === issue.id ? null : issue.id)}
                            >
                              <Edit2 className="w-3 h-3 mr-1" />
                              {editingId === issue.id ? "Cancel" : "Fix"}
                            </Button>
                          )}
                          {issue._dqs !== "valid" && (
                            <Button
                              size="sm" variant="ghost"
                              className="h-7 text-xs text-gray-400 hover:text-red-600"
                              onClick={() => handleMarkArchived(issue.id)}
                              title="Archive this record"
                            >
                              Archive
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {editingId === issue.id && (
                      <InlineEdit
                        issue={issue}
                        technicians={technicians}
                        onSave={(formData) => handleSave(issue, formData)}
                        onCancel={() => setEditingId(null)}
                      />
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}