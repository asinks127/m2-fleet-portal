import React, { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/warrantyClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ArrowLeft, Edit2, Save, AlertTriangle, CheckCircle2, Link2 } from "lucide-react";
import {
  isValidRecord, issueMatchesSearch,
  isWarrantyIssue, isDamageClaim, isOpenIssue, isClosedIssue, isOverdueIssue,
  TIME_FRAMES, resolveDateRange, filterIssuesByDateRange
} from "../lib/qcUtils";
import TechProfileHeader from "../components/technicians/TechProfileHeader";
import TechKPICards from "../components/technicians/TechKPICards";
import TechIssueTable from "../components/technicians/TechIssueTable";

const EQUIPMENT_OPTIONS = ["Samsara", "Geotab", "Zonar", "AIM4", "Cameras", "Printers", "ELD", "Asset Tracking", "Dashcam", "GPS"];

// TIME_FRAMES imported from qcUtils

const STATUS_COLORS = {
  pending_repair: "bg-yellow-100 text-yellow-800",
  scheduled:      "bg-blue-100 text-blue-800",
  repaired:       "bg-emerald-100 text-emerald-800",
  closed:         "bg-gray-100 text-gray-500",
};

const fmtDate = (d) => {
  if (!d) return "—";
  try { return format(new Date(d), "MM/dd/yy"); } catch { return d; }
};

const TABS = [
  { key: "overview",   label: "Overview" },
  { key: "history",    label: "Warranty / QC History" },
  { key: "equipment",  label: "Equipment / Skills" },
  { key: "notes",      label: "Notes" },
  { key: "admin",      label: "Admin / Relink" },
];

export default function TechnicianProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("overview");
  const [timeFrame, setTimeFrame] = useState(TIME_FRAMES[1]);
  const [useCustom, setUseCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [editingEquipment, setEditingEquipment] = useState(false);
  const [equipmentValue, setEquipmentValue] = useState([]);

  const { data: tech, isLoading: techLoading } = useQuery({
    queryKey: ["technician", id],
    queryFn: () => base44.entities.Technician.filter({ id }),
    select: (data) => data[0],
    enabled: !!id,
  });

  const { data: allIssues = [], isLoading: issuesLoading } = useQuery({
    queryKey: ["qcIssues", "tech", id],
    queryFn: () => base44.entities.QCIssue.filter({ technician_id: id }),
    enabled: !!id,
  });

  const { data: nameMatchIssues = [] } = useQuery({
    queryKey: ["qcIssues", "techname", tech?.full_name],
    queryFn: async () => {
      if (!tech?.full_name) return [];
      const byName = await base44.entities.QCIssue.filter({ technician_name: tech.full_name });
      return byName.filter(i => i.technician_id !== id);
    },
    enabled: !!tech?.full_name,
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Technician.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technician", id] });
      queryClient.invalidateQueries({ queryKey: ["technicians"] });
      toast({ title: "Saved", description: "Technician profile updated." });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const relinkMutation = useMutation({
    mutationFn: (issueId) => base44.entities.QCIssue.update(issueId, { technician_id: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["qcIssues", "tech", id] });
      queryClient.invalidateQueries({ queryKey: ["qcIssues", "techname", tech?.full_name] });
      toast({ title: "Relinked", description: "Issue linked to this technician." });
    },
  });

  const handleSave = (formData, onDone) => {
    updateMutation.mutate(formData, { onSuccess: onDone });
  };

  // Date cutoff — resolved via shared qcUtils helper
  const { cutoffDate, cutoffEnd } = useMemo(
    () => resolveDateRange(useCustom ? null : timeFrame, useCustom ? customFrom : '', useCustom ? customTo : ''),
    [timeFrame, useCustom, customFrom, customTo]
  );

  // Valid + date-filtered issues (shared logic from qcUtils)
  const validIssues = useMemo(() => allIssues.filter(isValidRecord), [allIssues]);

  // Date filtering — uses shared filterIssuesByDateRange from qcUtils
  const filteredIssues = useMemo(
    () => filterIssuesByDateRange(validIssues, cutoffDate, cutoffEnd),
    [validIssues, cutoffDate, cutoffEnd]
  );

  const metrics = useMemo(() => ({
    total:      filteredIssues.length,
    warranties: filteredIssues.filter(isWarrantyIssue).length,
    damage:     filteredIssues.filter(isDamageClaim).length,
    open:       filteredIssues.filter(isOpenIssue).length,
    overdue:    filteredIssues.filter(isOverdueIssue).length,
    resolved:   filteredIssues.filter(isClosedIssue).length,
    verified:   filteredIssues.filter(i => i.qc_verified).length,
  }), [filteredIssues]);

  // Top categories
  const topCategories = useMemo(() => {
    const counts = {};
    filteredIssues.forEach(i => {
      const cat = i.qc_category || i.final_category || i.auto_category || "other";
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [filteredIssues]);

  const recentIssues = useMemo(() =>
    [...filteredIssues].sort((a, b) => (b.qc_event_date || "") > (a.qc_event_date || "") ? 1 : -1).slice(0, 6),
  [filteredIssues]);

  if (techLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );
  if (!tech) return (
    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
      <p className="text-lg font-medium mb-2">Technician not found</p>
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4 mr-1" /> Go back</Button>
    </div>
  );

  const hasUnlinked = nameMatchIssues.length > 0;

  return (
    <div className="min-h-screen bg-gray-50/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* Back nav */}
        <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-800 -ml-2" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Scorecards
        </Button>

        {/* Unlinked warning banner */}
        {hasUnlinked && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <span className="text-amber-800 font-medium">{nameMatchIssues.length} possible unlinked issue{nameMatchIssues.length !== 1 ? "s" : ""} found.</span>
            <button onClick={() => setActiveTab("admin")} className="text-amber-700 underline text-xs hover:text-amber-900 ml-auto">Review in Admin tab →</button>
          </div>
        )}

        {/* Header card */}
        <TechProfileHeader tech={tech} isSaving={updateMutation.isPending} onSave={handleSave} />

        {/* Tabs */}
        <div className="flex gap-0.5 bg-white border border-gray-100 shadow-sm p-1 rounded-xl w-full overflow-x-auto">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex-shrink-0 px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
                activeTab === t.key
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
              }`}>
              {t.label}
              {t.key === "admin" && hasUnlinked && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 bg-amber-400 text-white text-xs rounded-full font-bold leading-none">{nameMatchIssues.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Time Frame bar (overview + history) */}
        {["overview", "history"].includes(activeTab) && (
          <div className="flex flex-wrap items-center gap-1.5 bg-white border border-gray-100 shadow-sm rounded-xl px-4 py-3">
            <span className="text-xs font-medium text-gray-400 mr-1 uppercase tracking-wide">Period:</span>
            {TIME_FRAMES.map(tf => (
              <button key={tf.label}
                onClick={() => { setTimeFrame(tf); setUseCustom(false); }}
                className={`px-3 py-1 text-xs rounded-full border font-medium transition-all ${
                  !useCustom && timeFrame.label === tf.label
                    ? "bg-blue-600 text-white border-blue-600"
                    : "border-gray-200 text-gray-600 bg-white hover:border-blue-300 hover:text-blue-600"
                }`}>
                {tf.label}
              </button>
            ))}
            <button onClick={() => setUseCustom(true)}
              className={`px-3 py-1 text-xs rounded-full border font-medium transition-all ${
                useCustom ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 bg-white hover:border-blue-300"
              }`}>
              Custom
            </button>
            {useCustom && (
              <div className="flex items-center gap-2 ml-1">
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
                <span className="text-gray-300 text-xs">→</span>
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
            )}
          </div>
        )}

        {/* ── OVERVIEW ─────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div className="space-y-5">
            <TechKPICards metrics={metrics} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Technician details */}
              <Card className="shadow-sm border-gray-100">
                <CardHeader className="pb-2 pt-4 px-5">
                  <CardTitle className="text-sm font-semibold text-gray-700">Technician Details</CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-4 space-y-2.5">
                  {[
                    ["Phone", tech.phone],
                    ["Email", tech.email],
                    ["Market", tech.market],
                    ["Project Manager", tech.project_manager],
                    ["Employee ID", tech.employee_id],
                    ["Contractor ID", tech.contractor_id],
                    ["Specialty", tech.specialty],
                    ["Hire Date", fmtDate(tech.hire_date)],
                    ["Last QC Issue", fmtDate(tech.last_qc_issue_date)],
                    ["QC Score", tech.qc_score != null ? tech.qc_score : null],
                    ["Avg Days to Close", tech.avg_days_to_close != null ? tech.avg_days_to_close : null],
                  ].filter(([, v]) => v != null && v !== "" && v !== "—").map(([k, v]) => (
                    <div key={k} className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">{k}</span>
                      <span className="font-medium text-gray-800 text-right ml-4">{String(v)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Top categories */}
              <Card className="shadow-sm border-gray-100">
                <CardHeader className="pb-2 pt-4 px-5">
                  <CardTitle className="text-sm font-semibold text-gray-700">Top Issue Categories</CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-4 space-y-3">
                  {topCategories.length === 0 ? (
                    <p className="text-sm text-gray-400">No issues in this period.</p>
                  ) : topCategories.map(([cat, count]) => {
                    const pct = metrics.total > 0 ? Math.round((count / metrics.total) * 100) : 0;
                    return (
                      <div key={cat}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-600 capitalize">{cat.replace(/_/g, " ")}</span>
                          <span className="font-semibold text-gray-800">{count} <span className="text-gray-400 font-normal">({pct}%)</span></span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Recent issues */}
              <Card className="shadow-sm border-gray-100">
                <CardHeader className="pb-2 pt-4 px-5">
                  <CardTitle className="text-sm font-semibold text-gray-700">Recent Issues</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {recentIssues.length === 0 ? (
                    <p className="px-5 py-4 text-sm text-gray-400">No issues in this period.</p>
                  ) : recentIssues.map(issue => (
                    <div key={issue.id} className="px-5 py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {issue.asset_number || "No asset"}{issue.customer ? ` — ${issue.customer}` : ""}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">{fmtDate(issue.qc_event_date)} · {(issue.qc_category || issue.issue_type || "—").replace(/_/g, " ")}</p>
                        </div>
                        <Badge className={`text-xs flex-shrink-0 ${STATUS_COLORS[issue.status] || "bg-gray-100 text-gray-500"}`}>
                          {(issue.status || "").replace(/_/g, " ")}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ── HISTORY ──────────────────────────────────────────────── */}
        {activeTab === "history" && (
          <TechIssueTable issues={filteredIssues} />
        )}

        {/* ── EQUIPMENT ────────────────────────────────────────────── */}
        {activeTab === "equipment" && (
          <Card className="shadow-sm border-gray-100">
            <CardHeader className="pb-2 pt-4 px-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-gray-700">Equipment & Skills</CardTitle>
                {!editingEquipment ? (
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setEquipmentValue(tech.equipment_types || []); setEditingEquipment(true); }}>
                    <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700"
                      onClick={() => updateMutation.mutate({ equipment_types: equipmentValue }, { onSuccess: () => setEditingEquipment(false) })}
                      disabled={updateMutation.isPending}>
                      <Save className="w-3.5 h-3.5 mr-1" /> Save
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditingEquipment(false)}>Cancel</Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-6 pb-6 space-y-5">
              <div>
                <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide font-medium">Trained Equipment Types</p>
                {editingEquipment ? (
                  <div className="flex flex-wrap gap-2">
                    {EQUIPMENT_OPTIONS.map(opt => {
                      const selected = equipmentValue.includes(opt);
                      return (
                        <button key={opt} type="button"
                          onClick={() => setEquipmentValue(v => v.includes(opt) ? v.filter(x => x !== opt) : [...v, opt])}
                          className={`px-4 py-2 rounded-full text-sm border font-medium transition-all ${
                            selected ? "bg-blue-600 text-white border-blue-600 shadow-sm" : "border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600"
                          }`}>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {(tech.equipment_types || []).length > 0
                      ? tech.equipment_types.map(e => (
                          <span key={e} className="px-4 py-2 bg-blue-50 text-blue-800 text-sm font-medium rounded-full border border-blue-100">{e}</span>
                        ))
                      : <p className="text-sm text-gray-400">No equipment types recorded yet. Click Edit to add.</p>}
                  </div>
                )}
              </div>
              {tech.specialty && (
                <div className="pt-4 border-t border-gray-50">
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1.5">Specialty</p>
                  <p className="text-sm text-gray-700">{tech.specialty}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── NOTES ────────────────────────────────────────────────── */}
        {activeTab === "notes" && (
          <Card className="shadow-sm border-gray-100">
            <CardHeader className="pb-2 pt-4 px-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-gray-700">Admin Notes</CardTitle>
                {!editingNotes ? (
                  <Button variant="outline" size="sm" className="h-7 text-xs"
                    onClick={() => { setNotesValue(tech.notes || ""); setEditingNotes(true); }}>
                    <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700"
                      onClick={() => updateMutation.mutate({ notes: notesValue }, { onSuccess: () => setEditingNotes(false) })}
                      disabled={updateMutation.isPending}>
                      <Save className="w-3.5 h-3.5 mr-1" /> Save
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditingNotes(false)}>Cancel</Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              {editingNotes ? (
                <textarea
                  rows={8}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 transition-all resize-none"
                  value={notesValue}
                  onChange={e => setNotesValue(e.target.value)}
                  placeholder="Add internal notes about this technician…"
                  autoFocus
                />
              ) : tech.notes ? (
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{tech.notes}</p>
              ) : (
                <p className="text-sm text-gray-400 italic">No notes recorded. Click Edit to add internal notes.</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── ADMIN / RELINK ────────────────────────────────────────── */}
        {activeTab === "admin" && (
          <div className="space-y-4">
            {nameMatchIssues.length > 0 ? (
              <Card className="shadow-sm border-amber-200">
                <CardHeader className="pb-2 pt-4 px-6 bg-amber-50 rounded-t-xl">
                  <CardTitle className="text-sm flex items-center gap-2 text-amber-800">
                    <AlertTriangle className="w-4 h-4" />
                    {nameMatchIssues.length} Possible Unlinked Issue{nameMatchIssues.length !== 1 ? "s" : ""}
                  </CardTitle>
                  <p className="text-xs text-amber-600 mt-0.5">
                    These QC issues match the technician's name but are linked to a different (or no) technician ID.
                  </p>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-amber-50/60 border-b border-amber-100">
                          <th className="px-5 py-2.5 text-left text-xs font-semibold text-amber-700 uppercase tracking-wide">Date</th>
                          <th className="px-5 py-2.5 text-left text-xs font-semibold text-amber-700 uppercase tracking-wide">Asset #</th>
                          <th className="px-5 py-2.5 text-left text-xs font-semibold text-amber-700 uppercase tracking-wide">Customer</th>
                          <th className="px-5 py-2.5 text-left text-xs font-semibold text-amber-700 uppercase tracking-wide">Name on Record</th>
                          <th className="px-5 py-2.5 text-left text-xs font-semibold text-amber-700 uppercase tracking-wide">Current ID</th>
                          <th className="px-5 py-2.5 text-left text-xs font-semibold text-amber-700 uppercase tracking-wide">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-50">
                        {nameMatchIssues.map(issue => (
                          <tr key={issue.id} className="hover:bg-amber-50/40 transition-colors">
                            <td className="px-5 py-2.5 text-xs text-gray-500 tabular-nums">{fmtDate(issue.qc_event_date)}</td>
                            <td className="px-5 py-2.5 font-semibold text-gray-800">{issue.asset_number || "—"}</td>
                            <td className="px-5 py-2.5 text-gray-600">{issue.customer || "—"}</td>
                            <td className="px-5 py-2.5 text-gray-700">{issue.technician_name}</td>
                            <td className="px-5 py-2.5 text-xs text-gray-400 font-mono">{issue.technician_id ? issue.technician_id.slice(0, 8) + "…" : "None"}</td>
                            <td className="px-5 py-2.5">
                              <Button size="sm" variant="outline" className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                                onClick={() => relinkMutation.mutate(issue.id)}
                                disabled={relinkMutation.isPending}>
                                <Link2 className="w-3 h-3 mr-1" /> Relink to This Tech
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="shadow-sm border-gray-100">
                <CardContent className="py-12 text-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-600 mb-1">All records are correctly linked</p>
                  <p className="text-xs text-gray-400">No unlinked issues were found for this technician.</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

      </div>
    </div>
  );
}