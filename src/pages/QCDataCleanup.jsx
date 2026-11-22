import React, { useState, useMemo } from "react";
import { base44 } from "@/api/warrantyClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { AlertTriangle, Trash2, GitMerge, Star, RefreshCw, ChevronDown, ChevronRight, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

function fmtDate(d) {
  if (!d) return "—";
  try { return format(new Date(d), "MM/dd/yy"); } catch { return d; }
}

function normalizeName(name) {
  return (name || "").toLowerCase().replace(/[^a-z\s]/g, "").trim().replace(/\s+/g, " ");
}

function areDatesClose(d1, d2, daysTolerance = 3) {
  if (!d1 || !d2) return false;
  try {
    const diff = Math.abs(new Date(d1) - new Date(d2));
    return diff <= daysTolerance * 86400000;
  } catch { return false; }
}

function findDuplicateGroups(issues) {
  const used = new Set();
  const groups = [];

  for (let i = 0; i < issues.length; i++) {
    if (used.has(issues[i].id)) continue;
    const a = issues[i];
    const group = [a];

    for (let j = i + 1; j < issues.length; j++) {
      if (used.has(issues[j].id)) continue;
      const b = issues[j];

      const assetMatch = a.asset_number && b.asset_number &&
        a.asset_number.trim().toLowerCase() === b.asset_number.trim().toLowerCase();
      if (!assetMatch) continue;

      const techMatch = normalizeName(a.technician_name) === normalizeName(b.technician_name);
      const dateClose = areDatesClose(a.qc_event_date || a.date_received, b.qc_event_date || b.date_received);
      const caseMatch = a.case_number && b.case_number &&
        a.case_number.trim().toLowerCase() === b.case_number.trim().toLowerCase();

      if (caseMatch || (techMatch && dateClose)) {
        group.push(b);
        used.add(b.id);
      }
    }

    if (group.length > 1) {
      group.forEach(r => used.add(r.id));
      groups.push(group);
    }
  }

  return groups;
}

function mergeRecords(primary, others) {
  const merged = { ...primary };

  // Preserve notes from all records
  const allNotes = [primary.repair_notes, primary.qc_notes, primary.remote_qc_notes, primary.root_cause,
    ...others.flatMap(o => [o.repair_notes, o.qc_notes, o.remote_qc_notes, o.root_cause])
  ].filter(Boolean);
  const uniqueNotes = [...new Set(allNotes)];

  merged.qc_notes = uniqueNotes.join(" | ") || primary.qc_notes;
  merged.remote_qc_notes = uniqueNotes.join(" | ") || primary.remote_qc_notes;

  // Merge audit log
  const allAuditLogs = [primary.warranty_audit_log, ...others.map(o => o.warranty_audit_log)].filter(Boolean);
  merged.warranty_audit_log = allAuditLogs.join("\n---\n") || null;

  // Merge communication history
  let history = [];
  [primary, ...others].forEach(r => {
    try { history = history.concat(JSON.parse(r.communication_history || "[]")); } catch {}
  });
  merged.communication_history = JSON.stringify(history);

  // Prefer the earliest date
  const allDates = [primary, ...others].map(r => r.qc_event_date || r.date_received).filter(Boolean).sort();
  if (allDates[0]) merged.qc_event_date = allDates[0];

  // Prefer non-null fields from others if primary is missing
  for (const other of others) {
    for (const key of Object.keys(other)) {
      if (!merged[key] && other[key]) merged[key] = other[key];
    }
  }

  // Mark as deduped
  const dupIds = others.map(o => o.id).join(",");
  merged.duplicate_status = `merged_from:${dupIds}`;
  merged.dedupe_key = merged.dedupe_key || `${merged.asset_number}|${merged.install_service_date}|${normalizeName(merged.technician_name)}`;

  return merged;
}

function GroupCard({ group, onMerge, onDeleteDuplicates, onMarkPrimary, merging }) {
  const [expanded, setExpanded] = useState(true);
  const [primaryId, setPrimaryId] = useState(group[0].id);

  const primary = group.find(r => r.id === primaryId) || group[0];
  const duplicates = group.filter(r => r.id !== primaryId);

  return (
    <Card className="border-orange-200">
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            <span className="font-semibold text-gray-800">Asset #{primary.asset_number}</span>
            <Badge className="bg-orange-100 text-orange-800 text-xs">{group.length} duplicates</Badge>
          </div>
          <div className="flex gap-2" onClick={e => e.stopPropagation()}>
            <Button size="sm" variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50 gap-1" disabled={merging}
              onClick={() => onMerge(primaryId, group)}>
              <GitMerge className="w-3.5 h-3.5" /> Merge into Primary
            </Button>
            <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 gap-1" disabled={merging}
              onClick={() => onDeleteDuplicates(primaryId, group)}>
              <Trash2 className="w-3.5 h-3.5" /> Delete Dupes
            </Button>
          </div>
        </div>
        <div className="text-xs text-gray-500 ml-6 mt-1">
          Tech: {primary.technician_name || "—"} | Date: {fmtDate(primary.qc_event_date)} | Customer: {primary.customer || "—"}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          <div className="space-y-2">
            {group.map(record => (
              <div key={record.id} className={`rounded-lg border p-3 text-sm ${record.id === primaryId ? "bg-blue-50 border-blue-300" : "bg-gray-50 border-gray-200"}`}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    {record.id === primaryId
                      ? <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700"><Star className="w-3 h-3" /> PRIMARY</span>
                      : <span className="text-xs text-gray-500 font-medium">Duplicate</span>}
                    <span className="text-xs text-gray-400 font-mono">{record.id.slice(0, 8)}…</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Created: {fmtDate(record.created_date)}</span>
                    {record.id !== primaryId && (
                      <Button size="sm" variant="ghost" className="text-blue-600 h-6 text-xs px-2"
                        onClick={() => setPrimaryId(record.id)}>
                        Set as Primary
                      </Button>
                    )}
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600">
                  <span><b>Asset:</b> {record.asset_number || "—"}</span>
                  <span><b>Date:</b> {fmtDate(record.qc_event_date || record.date_received)}</span>
                  <span><b>Status:</b> {record.status || "—"}</span>
                  <span><b>Source:</b> {record.issue_source || "—"}</span>
                </div>
                {record.qc_notes && (
                  <p className="mt-1.5 text-xs text-gray-500 truncate"><b>Notes:</b> {record.qc_notes}</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default function QCDataCleanup() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [merging, setMerging] = useState(false);
  const [done, setDone] = useState({ merged: 0, deleted: 0 });

  const { data: issues = [], isLoading, refetch } = useQuery({
    queryKey: ["qcIssues"],
    queryFn: () => base44.entities.QCIssue.list("-created_date"),
  });

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const activeIssues = useMemo(() => issues.filter(i =>
    i.data_status !== "archived" &&
    !String(i.duplicate_status || "").startsWith("duplicate_of_") &&
    !String(i.duplicate_status || "").startsWith("merged_from:")
  ), [issues]);

  const groups = useMemo(() => findDuplicateGroups(activeIssues), [activeIssues]);

  const handleMerge = async (primaryId, group) => {
    setMerging(true);
    const primary = group.find(r => r.id === primaryId);
    const others = group.filter(r => r.id !== primaryId);
    const mergedData = mergeRecords(primary, others);
    const { id, created_date, updated_date, created_by, ...updateFields } = mergedData;

    await base44.entities.QCIssue.update(primaryId, updateFields);
    await sleep(300);
    for (const dup of others) {
      await base44.entities.QCIssue.update(dup.id, {
        duplicate_status: `duplicate_of_${primaryId}`,
        data_status: "archived",
      });
      await sleep(300);
    }

    queryClient.invalidateQueries({ queryKey: ["qcIssues"] });
    setDone(d => ({ ...d, merged: d.merged + others.length }));
    toast({ title: "Merged", description: `${others.length} duplicate(s) archived into primary record.`, duration: 3000 });
    setMerging(false);
  };

  const handleDeleteDuplicates = async (primaryId, group) => {
    setMerging(true);
    const others = group.filter(r => r.id !== primaryId);
    const deletedIds = new Set(others.map(o => o.id));
    // Optimistically remove from cache immediately so UI updates without waiting
    queryClient.setQueryData(["qcIssues"], (old = []) => old.filter(r => !deletedIds.has(r.id)));
    for (const dup of others) {
      await base44.entities.QCIssue.delete(dup.id);
      await sleep(300);
    }
    queryClient.invalidateQueries({ queryKey: ["qcIssues"] });
    setDone(d => ({ ...d, deleted: d.deleted + others.length }));
    toast({ title: "Deleted", description: `${others.length} duplicate(s) deleted.`, duration: 3000 });
    setMerging(false);
  };

  const handleBulkMergeAll = async () => {
    setMerging(true);
    let totalMerged = 0;
    for (const group of groups) {
      const primary = group[0];
      const others = group.slice(1);
      const mergedData = mergeRecords(primary, others);
      const { id, created_date, updated_date, created_by, ...updateFields } = mergedData;
      await base44.entities.QCIssue.update(primary.id, updateFields);
      await sleep(400);
      for (const dup of others) {
        await base44.entities.QCIssue.update(dup.id, {
          duplicate_status: `duplicate_of_${primary.id}`,
          data_status: "archived",
        });
        await sleep(400);
      }
      totalMerged += others.length;
      await sleep(500); // extra pause between groups
    }
    queryClient.invalidateQueries({ queryKey: ["qcIssues"] });
    setDone(d => ({ ...d, merged: d.merged + totalMerged }));
    toast({ title: "Bulk merge complete", description: `${totalMerged} duplicates archived across ${groups.length} groups.`, duration: 3000 });
    setMerging(false);
  };

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <GitMerge className="w-6 h-6 text-orange-500" /> QC Data Cleanup
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Detect and merge duplicate QCIssue records</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          {groups.length > 0 && (
            <Button size="sm" className="bg-orange-600 hover:bg-orange-700 gap-1" disabled={merging} onClick={handleBulkMergeAll}>
              <GitMerge className="w-4 h-4" /> Bulk Merge All ({groups.length} groups)
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Records", value: activeIssues.length, color: "text-gray-900" },
          { label: "Duplicate Groups", value: groups.length, color: "text-orange-600" },
          { label: "Merged This Session", value: done.merged, color: "text-blue-600" },
          { label: "Deleted This Session", value: done.deleted, color: "text-red-600" },
        ].map(m => (
          <Card key={m.label} className="text-center py-3">
            <CardContent className="p-0">
              <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
              <p className="text-xs text-gray-500">{m.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {isLoading && <div className="text-center text-gray-400 py-10">Scanning for duplicates...</div>}

      {!isLoading && groups.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-400" />
          <p className="font-medium text-gray-600">No duplicates found!</p>
          <p className="text-sm mt-1">All {issues.length} QCIssue records appear unique.</p>
        </div>
      )}

      <div className="space-y-4">
        {groups.map((group, i) => (
          <GroupCard
            key={group.map(r => r.id).join("-")}
            group={group}
            onMerge={handleMerge}
            onDeleteDuplicates={handleDeleteDuplicates}
            onMarkPrimary={() => {}}
            merging={merging}
          />
        ))}
      </div>
    </div>
  );
}