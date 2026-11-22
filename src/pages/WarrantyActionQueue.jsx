import React, { useState, useMemo } from "react";
import { base44 } from "@/api/warrantyClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, RefreshCw, AlertTriangle, CheckCircle2, ShieldCheck, Clock } from "lucide-react";
import WarrantyQuickPanel from "../components/qc/WarrantyQuickPanel";
import { isValidRecord, computeNextAction, issueMatchesSearch, isOpenIssue, isOverdueIssue, isDamageClaim, getPrimaryTechnicians } from "../lib/qcUtils";
import { format, subDays } from "date-fns";
import { useToast } from "@/components/ui/use-toast";

const warrantyQuickAction = (payload) => base44.functions.invoke('warrantyQuickAction', payload);

const REPAIR_STATUS_COLORS = {
  not_started: "bg-gray-100 text-gray-600",
  scheduled: "bg-blue-100 text-blue-800",
  in_progress: "bg-orange-100 text-orange-800",
  completed: "bg-yellow-100 text-yellow-800",
  verified: "bg-green-100 text-green-800",
  reopened: "bg-red-100 text-red-800",
};

const NEXT_ACTION_COLORS = {
  "Schedule Repair": "bg-blue-100 text-blue-800",
  "Repair In Progress": "bg-orange-100 text-orange-800",
  "Awaiting Completion": "bg-yellow-100 text-yellow-800",
  "Awaiting QC Verification": "bg-purple-100 text-purple-800",
  "Closed": "bg-green-100 text-green-800",
  "Reopened - Immediate Attention": "bg-red-100 text-red-800",
};

const QUICK_FILTERS = [
  { key: "all", label: "All Returns" },
  { key: "open", label: "Open" },
  { key: "needs_scheduling", label: "Needs Scheduling" },
  { key: "awaiting_verification", label: "Awaiting Verification" },
  { key: "reopened", label: "Reopened" },
  { key: "overdue", label: "Overdue" },
  { key: "damage", label: "Damage Claims" },
  { key: "last7", label: "Last 7 Days" },
  { key: "closed_last7", label: "Closed Last 7 Days" },
];

function fmtDate(d) {
  if (!d) return "—";
  try { return format(new Date(d), "MM/dd/yy"); } catch { return d; }
}

function UrgencyBadge({ issue }) {
  const na = computeNextAction(issue);
  if (issue.repair_status === "reopened") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800"><AlertTriangle className="w-3 h-3" /> Reopened</span>;
  if (isOverdueIssue(issue)) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800"><Clock className="w-3 h-3" /> Overdue</span>;
  if (isDamageClaim(issue)) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-orange-100 text-orange-800">⚠️ Damage</span>;
  if (na === "Closed") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800"><CheckCircle2 className="w-3 h-3" /> Closed</span>;
  return null;
}

export default function WarrantyActionQueue() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState("open");
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [search, setSearch] = useState("");
  const [byProject, setByProject] = useState("all");
  const [byTech, setByTech] = useState("all");
  const [selectedRows, setSelectedRows] = useState([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Bulk action state
  const [bulkRepairTechId, setBulkRepairTechId] = useState("");
  const [bulkScheduler, setBulkScheduler] = useState("");
  const [bulkScheduledDate, setBulkScheduledDate] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkRepairStatus, setBulkRepairStatus] = useState("");
  const [bulkClaimType, setBulkClaimType] = useState("");
  const [bulkRepairNotes, setBulkRepairNotes] = useState("");

  const { data: issues = [], isLoading, refetch } = useQuery({
    queryKey: ["qcIssues"],
    queryFn: () => base44.entities.QCIssue.list("-date_received"),
  });
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: () => base44.entities.WarrantyProject.list() });
  const { data: technicians = [] } = useQuery({ queryKey: ["technicians"], queryFn: () => base44.entities.Technician.list() });

  const projectMap = useMemo(() => { const m = {}; for (const p of projects) m[p.id] = p.project_name; return m; }, [projects]);
  const techMap = useMemo(() => { const m = {}; for (const t of technicians) m[t.id] = t.full_name; return m; }, [technicians]);
  const primaryTechs = useMemo(() => getPrimaryTechnicians(technicians), [technicians]);

  const warrantyIssues = useMemo(() => issues.filter(i => isValidRecord(i) && i.warranty_return_required), [issues]);

  const filtered = useMemo(() => {
    let list = warrantyIssues;
    const ago7 = subDays(new Date(), 7).toISOString().split("T")[0];
    switch (activeFilter) {
      case "open": list = list.filter(isOpenIssue); break;
      case "needs_scheduling": list = list.filter(i => !i.repair_status || i.repair_status === "not_started"); break;
      case "awaiting_verification": list = list.filter(i => computeNextAction(i) === "Awaiting QC Verification"); break;
      case "reopened": list = list.filter(i => i.repair_status === "reopened"); break;
      case "overdue": list = list.filter(isOverdueIssue); break;
      case "damage": list = list.filter(isDamageClaim); break;
      case "last7": list = list.filter(i => (i.qc_event_date || i.date_received || "") >= ago7); break;
      case "closed_last7": list = list.filter(i => i.status === "closed" && (i.date_closed || "") >= ago7); break;
      default: break;
    }
    if (search) list = list.filter(i => issueMatchesSearch(i, search, projectMap));
    if (byProject !== "all") list = list.filter(i => i.project_id === byProject);
    if (byTech !== "all") list = list.filter(i => i.technician_id === byTech);
    return list;
  }, [warrantyIssues, activeFilter, search, byProject, byTech, projectMap]);

  const metrics = useMemo(() => ({
    total:               warrantyIssues.length,
    open:                warrantyIssues.filter(isOpenIssue).length,
    awaitingVerification: warrantyIssues.filter(i => computeNextAction(i) === "Awaiting QC Verification").length,
    damage:              warrantyIssues.filter(isDamageClaim).length,
    reopened:            warrantyIssues.filter(i => i.repair_status === "reopened").length,
    overdue:             warrantyIssues.filter(isOverdueIssue).length,
  }), [warrantyIssues]);

  const toggleRow = (id) => setSelectedRows(r => r.includes(id) ? r.filter(x => x !== id) : [...r, id]);
  const toggleAll = () => setSelectedRows(selectedRows.length === filtered.length ? [] : filtered.map(i => i.id));

  const handleBulkApply = async () => {
    if (selectedRows.length === 0) return;
    setBulkLoading(true);

    const repairTech = bulkRepairTechId ? technicians.find(t => t.id === bulkRepairTechId) : null;

    for (const id of selectedRows) {
      const fields = {};
      if (bulkRepairTechId && repairTech) {
        fields.assigned_repair_technician_id = repairTech.id;
        fields.assigned_repair_technician_name = repairTech.full_name;
        fields.assigned_repair_tech = repairTech.full_name;
      }
      if (bulkScheduler) fields.assigned_scheduler = bulkScheduler;
      if (bulkScheduledDate) {
        fields.repair_scheduled_for = bulkScheduledDate;
        fields.repair_status = 'scheduled';
        fields.status = 'scheduled';
      }
      if (bulkStatus) fields.status = bulkStatus;
      if (bulkRepairStatus) fields.repair_status = bulkRepairStatus;
      if (bulkClaimType) { fields.claim_type = bulkClaimType; if (bulkClaimType === 'damage') fields.issue_type = 'damage_claim'; }
      if (bulkRepairNotes) fields.repair_notes = bulkRepairNotes;
      if (Object.keys(fields).length > 0) {
        await base44.entities.QCIssue.update(id, fields);
      }
    }

    queryClient.invalidateQueries({ queryKey: ["qcIssues"] });
    setSelectedRows([]);
    setBulkRepairTechId(""); setBulkScheduler(""); setBulkScheduledDate("");
    setBulkStatus(""); setBulkRepairStatus(""); setBulkClaimType(""); setBulkRepairNotes("");
    toast({ title: "Bulk update complete", description: `Updated ${selectedRows.length} issues.` });
    setBulkLoading(false);
  };

  const handleBulkClose = async () => {
    if (selectedRows.length === 0) return;
    setBulkLoading(true);
    for (const id of selectedRows) {
      await base44.entities.QCIssue.update(id, { status: 'closed', date_closed: new Date().toISOString().split('T')[0] });
    }
    queryClient.invalidateQueries({ queryKey: ["qcIssues"] });
    setSelectedRows([]);
    toast({ title: "Closed", description: `${selectedRows.length} issues closed.` });
    setBulkLoading(false);
  };

  const IssueRow = ({ issue }) => {
    const na = computeNextAction(issue);
    const projName = projectMap[issue.project_id] || issue.work_order_name || "—";
    const cat = (issue.qc_category || issue.final_category || issue.auto_category || "").replace(/_/g, " ");
    const isDamage = isDamageClaim(issue);
    return (
      <tr className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedIssue(issue)}>
        <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
          <input type="checkbox" checked={selectedRows.includes(issue.id)} onChange={() => toggleRow(issue.id)} className="rounded" />
        </td>
        <td className="px-3 py-2 text-xs text-gray-500">{fmtDate(issue.qc_event_date || issue.date_received)}</td>
        <td className="px-3 py-2 text-sm font-medium text-blue-700">{issue.technician_name || "—"}</td>
        <td className="px-3 py-2 text-sm text-gray-700">{projName}</td>
        <td className="px-3 py-2 text-sm text-gray-700">{issue.customer || "—"}</td>
        <td className="px-3 py-2 text-sm font-semibold">{issue.asset_number || "—"}</td>
        <td className="px-3 py-2 text-xs text-gray-600 capitalize">{cat || "—"}</td>
        <td className="px-3 py-2">
          {isDamage
            ? <Badge className="bg-orange-100 text-orange-800 text-xs">⚠️ Damage</Badge>
            : <Badge className="bg-blue-100 text-blue-800 text-xs">Warranty</Badge>}
        </td>
        <td className="px-3 py-2">
          {issue.repair_status && <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${REPAIR_STATUS_COLORS[issue.repair_status]}`}>{issue.repair_status.replace(/_/g, " ")}</span>}
        </td>
        <td className="px-3 py-2">
          {issue.qc_verified ? <ShieldCheck className="w-4 h-4 text-green-600" /> : <span className="text-xs text-gray-400">No</span>}
        </td>
        <td className="px-3 py-2 text-sm font-bold">
          <span className={issue.days_open > 5 ? "text-red-600" : "text-gray-700"}>{issue.days_open ?? "—"}</span>
        </td>
        <td className="px-3 py-2">
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${NEXT_ACTION_COLORS[na] || "bg-gray-100 text-gray-700"}`}>{na}</span>
        </td>
        <td className="px-3 py-2"><UrgencyBadge issue={issue} /></td>
      </tr>
    );
  };

  if (isLoading) return <div className="p-8 text-center text-gray-400">Loading...</div>;
  const selectedIssueWithLatest = selectedIssue ? (issues.find(i => i.id === selectedIssue.id) || selectedIssue) : null;

  return (
    <>
      {selectedIssueWithLatest && (
        <WarrantyQuickPanel
          issue={selectedIssueWithLatest}
          projectName={projectMap[selectedIssueWithLatest.project_id] || selectedIssueWithLatest.work_order_name}
          onClose={() => setSelectedIssue(null)}
          onUpdated={() => { queryClient.invalidateQueries({ queryKey: ["qcIssues"] }); setSelectedIssue(null); }}
        />
      )}

      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Package className="w-6 h-6 text-red-500" /> Warranty Action Queue</h1>
            <p className="text-gray-500 text-sm mt-0.5">QCIssue is the master record — click any row to act</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => refetch()}><RefreshCw className="w-4 h-4" /></Button>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {[
            { label: "Total", value: metrics.total, color: "text-gray-900" },
            { label: "Open", value: metrics.open, color: "text-orange-600" },
            { label: "Awaiting Verify", value: metrics.awaitingVerification, color: "text-purple-600" },
            { label: "Damage Claims", value: metrics.damage, color: "text-orange-700" },
            { label: "Reopened", value: metrics.reopened, color: "text-red-600" },
            { label: "Overdue", value: metrics.overdue, color: "text-red-600" },
          ].map(m => (
            <Card key={m.label} className="text-center py-3">
              <CardContent className="p-0">
                <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
                <p className="text-xs text-gray-500">{m.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick filters */}
        <div className="flex flex-wrap gap-2">
          {QUICK_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${activeFilter === f.key ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search + filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <Input placeholder="Search tech, asset, customer, notes..." value={search} onChange={e => setSearch(e.target.value)} className="h-8 text-sm w-64" />
          <Select value={byProject} onValueChange={setByProject}>
            <SelectTrigger className="h-8 text-xs w-44"><SelectValue placeholder="By Project" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.project_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={byTech} onValueChange={setByTech}>
            <SelectTrigger className="h-8 text-xs w-44"><SelectValue placeholder="By Technician" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Technicians</SelectItem>
              {primaryTechs.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-xs text-gray-500">{filtered.length} issues</span>
        </div>

        {/* Bulk actions */}
        {selectedRows.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-blue-800">{selectedRows.length} selected</span>
              <button onClick={() => setSelectedRows([])} className="text-xs text-gray-500 hover:text-gray-700">Clear selection</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Repair Technician</label>
                <Select value={bulkRepairTechId} onValueChange={setBulkRepairTechId}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Assign repair tech" /></SelectTrigger>
                  <SelectContent>
                    {primaryTechs.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Scheduler</label>
                <Input placeholder="Scheduler name..." value={bulkScheduler} onChange={e => setBulkScheduler(e.target.value)} className="h-8 text-xs" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Scheduled Date</label>
                <Input type="date" value={bulkScheduledDate} onChange={e => setBulkScheduledDate(e.target.value)} className="h-8 text-xs" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Status</label>
                <Select value={bulkStatus} onValueChange={setBulkStatus}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Set status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending_repair">Pending Repair</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="repaired">Repaired</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Repair Status</label>
                <Select value={bulkRepairStatus} onValueChange={setBulkRepairStatus}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Repair status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_started">Not Started</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="reopened">Reopened</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Claim Type</label>
                <Select value={bulkClaimType} onValueChange={setBulkClaimType}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Claim type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warranty">Warranty</SelectItem>
                    <SelectItem value="damage">Damage Claim</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-gray-500 block mb-1">Repair Notes</label>
                <Input placeholder="Add repair notes..." value={bulkRepairNotes} onChange={e => setBulkRepairNotes(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700" disabled={bulkLoading} onClick={handleBulkApply}>
                {bulkLoading ? "Applying..." : "Apply to Selected"}
              </Button>
              <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" disabled={bulkLoading} onClick={handleBulkClose}>
                {bulkLoading ? "..." : "Bulk Close"}
              </Button>
            </div>
          </div>
        )}

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <th className="px-3 py-2 w-8">
                      <input type="checkbox" checked={selectedRows.length === filtered.length && filtered.length > 0} onChange={toggleAll} className="rounded" />
                    </th>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Tech</th>
                    <th className="px-3 py-2 text-left">Project</th>
                    <th className="px-3 py-2 text-left">Customer</th>
                    <th className="px-3 py-2 text-left">Asset #</th>
                    <th className="px-3 py-2 text-left">Category</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-left">Repair Status</th>
                    <th className="px-3 py-2 text-left">Verified</th>
                    <th className="px-3 py-2 text-left">Days</th>
                    <th className="px-3 py-2 text-left">Next Action</th>
                    <th className="px-3 py-2 text-left">Urgency</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0
                    ? <tr><td colSpan={13} className="text-center py-10 text-gray-400">No warranty issues match this filter 🎉</td></tr>
                    : filtered.map(issue => <IssueRow key={issue.id} issue={issue} />)
                  }
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}