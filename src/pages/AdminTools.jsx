import React, { useState, useEffect } from "react";
import { base44 } from "@/api/warrantyClient";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Merge, RefreshCw, CheckCircle, Users, Activity, ShieldCheck, Link2, GitMerge, Mail, Download } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const mergeTechnicians = (payload) => base44.functions.invoke('mergeTechnicians', payload);
const bulkRecalcTechStats = (payload) => base44.functions.invoke('bulkRecalcTechStats', payload);
const backfillAllWarrantyEmails = (payload) => base44.functions.invoke('backfillAllWarrantyEmails', payload);

const MATCH_TYPE_LABELS = { name: "Same Name", phone: "Same Phone", email: "Same Email" };
const MATCH_TYPE_COLORS = { name: "bg-orange-100 text-orange-800", phone: "bg-purple-100 text-purple-800", email: "bg-blue-100 text-blue-800" };

export default function AdminTools() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [duplicates, setDuplicates] = useState(null);
  const [loadingDupes, setLoadingDupes] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [primaryId, setPrimaryId] = useState("");
  const [previewData, setPreviewData] = useState(null);
  const [merging, setMerging] = useState(false);
  const [recalcLoading, setRecalcLoading] = useState(false);
  const [health, setHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [backfillRunning, setBackfillRunning] = useState(false);
  const [backfillLog, setBackfillLog] = useState([]);
  const [backfillDone, setBackfillDone] = useState(false);

  useEffect(() => { loadHealth(); }, []);

  const loadHealth = async () => {
    setHealthLoading(true);
    try {
      const res = await mergeTechnicians({ action: 'health_summary' });
      setHealth(res.data);
    } catch (e) {
      console.error(e);
    }
    setHealthLoading(false);
  };

  const mergeAll = async () => {
    if (!duplicates || duplicates.length === 0) return;
    setMerging(true);
    let totalRelinked = 0;
    for (const group of duplicates) {
      const sorted = [...group.techs].sort((a, b) => (b.qc_issue_count_total || 0) - (a.qc_issue_count_total || 0));
      const primary_id = sorted[0].id;
      const duplicate_ids = sorted.slice(1).map(t => t.id);
      if (!duplicate_ids.length) continue;
      try {
        const res = await mergeTechnicians({ action: 'merge', primary_id, duplicate_ids, dry_run: false });
        totalRelinked += res.data?.total_issues_relinked || 0;
      } catch (e) {
        console.error('Merge failed for group', group.match_value, e.message);
      }
    }
    toast({ title: "All duplicates merged", description: `${duplicates.length} groups merged, ${totalRelinked} issues relinked.` });
    queryClient.invalidateQueries({ queryKey: ["technicians"] });
    queryClient.invalidateQueries({ queryKey: ["qcIssues"] });
    setSelectedGroup(null);
    setPreviewData(null);
    await findDuplicates();
    await loadHealth();
    setMerging(false);
  };

  const findDuplicates = async () => {
    setLoadingDupes(true);
    setDuplicates(null);
    setSelectedGroup(null);
    setPreviewData(null);
    try {
      const res = await mergeTechnicians({ action: 'find_duplicates' });
      setDuplicates(res.data?.duplicates || []);
      if (res.data?.duplicates?.length === 0) {
        toast({ title: "No duplicates found", description: "All technician records look clean." });
      }
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setLoadingDupes(false);
  };

  const selectGroup = (group) => {
    setSelectedGroup(group);
    setPreviewData(null);
    const sorted = [...group.techs].sort((a, b) => (b.qc_issue_count_total || 0) - (a.qc_issue_count_total || 0));
    setPrimaryId(sorted[0]?.id || "");
  };

  const previewMerge = async () => {
    if (!selectedGroup || !primaryId) return;
    const dupIds = selectedGroup.techs.filter(t => t.id !== primaryId).map(t => t.id);
    try {
      const res = await mergeTechnicians({ action: 'preview_merge', primary_id: primaryId, duplicate_ids: dupIds });
      setPreviewData(res.data);
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const executeMerge = async () => {
    if (!selectedGroup || !primaryId) return;
    setMerging(true);
    const dupIds = selectedGroup.techs.filter(t => t.id !== primaryId).map(t => t.id);
    try {
      const res = await mergeTechnicians({ action: 'merge', primary_id: primaryId, duplicate_ids: dupIds, dry_run: false });
      toast({ title: "Merge complete", description: `${res.data?.total_issues_relinked || 0} issues relinked to ${res.data?.primary_name}.` });
      queryClient.invalidateQueries({ queryKey: ["technicians"] });
      queryClient.invalidateQueries({ queryKey: ["qcIssues"] });
      setSelectedGroup(null);
      setPreviewData(null);
      await findDuplicates();
      await loadHealth();
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setMerging(false);
  };

  const runBackfill = async () => {
    setBackfillRunning(true);
    setBackfillDone(false);
    setBackfillLog([]);
    let pageToken = null;
    let totalCreated = 0;
    let totalSkipped = 0;
    let batchNum = 0;

    while (true) {
      batchNum++;
      try {
        const res = await backfillAllWarrantyEmails(pageToken ? { pageToken } : {});
        const data = res.data;
        totalCreated += data.created || 0;
        totalSkipped += data.skipped || 0;
        setBackfillLog(prev => [...prev, `Batch ${batchNum}: +${data.created} new, ${data.skipped} skipped${data.rateLimited ? ' ⚠️ rate limited' : ''}`]);

        if (data.rateLimited) {
          setBackfillLog(prev => [...prev, 'Rate limited — waiting 30s before continuing...']);
          await new Promise(r => setTimeout(r, 30000));
          // retry same page token
          continue;
        }

        if (!data.hasMore || !data.nextPageToken) break;
        pageToken = data.nextPageToken;
        // Small pause between batches
        await new Promise(r => setTimeout(r, 2000));
      } catch (e) {
        setBackfillLog(prev => [...prev, `Error: ${e.message}`]);
        break;
      }
    }

    setBackfillLog(prev => [...prev, `✅ Done! ${totalCreated} new records created, ${totalSkipped} already existed.`]);
    setBackfillDone(true);
    setBackfillRunning(false);
    queryClient.invalidateQueries({ queryKey: ["qcIssues"] });
  };

  const runBulkRecalc = async () => {
    setRecalcLoading(true);
    try {
      const res = await bulkRecalcTechStats({});
      toast({ title: "Recalc complete", description: `Updated ${res.data?.updated} of ${res.data?.total} technicians.` });
      queryClient.invalidateQueries({ queryKey: ["technicians"] });
      await loadHealth();
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setRecalcLoading(false);
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Admin Tools</h1>
        <p className="text-gray-500 mt-1">Technician deduplication, data cleanup, and bulk recalculation</p>
      </div>

      {/* Health Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="w-4 h-4 text-blue-600" /> Technician Health Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          {healthLoading ? (
            <p className="text-sm text-gray-400">Loading...</p>
          ) : health ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <HealthTile label="Total Records" value={health.total} color="text-gray-700" icon={<Users className="w-4 h-4" />} />
              <HealthTile label="Primary (Active)" value={health.primary} color="text-green-700" icon={<ShieldCheck className="w-4 h-4" />} />
              <HealthTile label="Merged" value={health.merged} color="text-gray-400" icon={<GitMerge className="w-4 h-4" />} />
              <HealthTile label="Needs Review" value={health.needs_review} color="text-yellow-600" icon={<AlertTriangle className="w-4 h-4" />} />
              <HealthTile label="Dup Candidates" value={health.duplicate_candidates} color="text-orange-600" icon={<Merge className="w-4 h-4" />} />
              <HealthTile label="Issues → Non-Primary" value={health.issues_linked_to_non_primary} color={health.issues_linked_to_non_primary > 0 ? "text-red-600" : "text-green-600"} icon={<Link2 className="w-4 h-4" />} />
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={loadHealth}>Load Summary</Button>
          )}
        </CardContent>
      </Card>

      {/* Gmail Backfill */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="w-4 h-4 text-green-600" /> Backfill Missing Warranty Emails from Gmail
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Scans the <strong>scheduling@m2fleetcom.com</strong> inbox for all emails with subject <em>"Warranty Return Required"</em> since Jan 2025
            and imports any that aren't already in the app. Runs in batches of 5 to avoid rate limits.
          </p>
          <Button
            onClick={runBackfill}
            disabled={backfillRunning}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Download className={`w-4 h-4 mr-2 ${backfillRunning ? 'animate-bounce' : ''}`} />
            {backfillRunning ? 'Backfilling...' : 'Run Gmail Backfill'}
          </Button>
          {backfillLog.length > 0 && (
            <div className="bg-gray-900 text-green-300 text-xs font-mono rounded-lg p-4 max-h-48 overflow-y-auto space-y-1">
              {backfillLog.map((line, i) => <div key={i}>{line}</div>)}
              {backfillRunning && <div className="animate-pulse">Running...</div>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Recalc */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <RefreshCw className="w-4 h-4 text-blue-600" /> Bulk Recalculate Technician Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">Recalculates QC scores, warranty counts, and all stats for every technician from live QCIssue data. Excludes needs_review and legacy records.</p>
          <Button onClick={runBulkRecalc} disabled={recalcLoading} className="bg-blue-600 hover:bg-blue-700">
            <RefreshCw className={`w-4 h-4 mr-2 ${recalcLoading ? "animate-spin" : ""}`} />
            {recalcLoading ? "Recalculating..." : "Recalculate All Technicians"}
          </Button>
        </CardContent>
      </Card>

      {/* Duplicate Technician Finder */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4 text-orange-600" /> Technician Duplicate Finder & Merge Tool
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">Detects duplicates by matching normalized name, phone number, and email. Select a primary record, preview affected issues, then merge.</p>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={findDuplicates} disabled={loadingDupes} variant="outline">
              {loadingDupes ? "Scanning..." : "Scan for Duplicates"}
            </Button>
            {duplicates && duplicates.length > 0 && (
              <Button onClick={mergeAll} disabled={merging} className="bg-orange-600 hover:bg-orange-700 text-white">
                {merging ? "Merging All..." : `Merge All ${duplicates.length} Groups`}
              </Button>
            )}
          </div>

          {duplicates !== null && duplicates.length === 0 && (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
              <CheckCircle className="w-4 h-4" /> No duplicate technician records found.
            </div>
          )}

          {duplicates && duplicates.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-orange-700">{duplicates.length} duplicate group(s) found:</p>
              {duplicates.map(group => (
                <div
                  key={group.group_key}
                  className={`border rounded-lg p-3 cursor-pointer transition-colors ${selectedGroup?.group_key === group.group_key ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                  onClick={() => selectGroup(group)}
                >
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Badge className={`text-xs ${MATCH_TYPE_COLORS[group.match_type] || 'bg-gray-100 text-gray-700'}`}>
                        {MATCH_TYPE_LABELS[group.match_type] || group.match_type}
                      </Badge>
                      <span className="font-medium text-sm text-gray-900">"{group.match_value}"</span>
                      <span className="text-xs text-gray-500">({group.count} records)</span>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {group.techs.map(t => (
                        <Badge key={t.id} variant="outline" className="text-xs">
                          {t.full_name} ({t.qc_issue_count_total || 0})
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedGroup && (
            <div className="border border-blue-200 rounded-lg p-4 bg-blue-50 space-y-4">
              <p className="font-semibold text-blue-800 text-sm">
                Merge group: "{selectedGroup.match_value}"
                <Badge className={`ml-2 text-xs ${MATCH_TYPE_COLORS[selectedGroup.match_type]}`}>{MATCH_TYPE_LABELS[selectedGroup.match_type]}</Badge>
              </p>
              <div>
                <p className="text-xs text-gray-600 mb-2 font-medium">Select primary record — all others will be merged into it and hidden from operational lists:</p>
                <div className="space-y-2">
                  {selectedGroup.techs.map(t => (
                    <label key={t.id} className="flex items-center gap-3 cursor-pointer p-2 rounded-md hover:bg-white">
                      <input
                        type="radio"
                        name="primary_tech"
                        value={t.id}
                        checked={primaryId === t.id}
                        onChange={() => setPrimaryId(t.id)}
                      />
                      <span className="text-sm font-medium">{t.full_name}</span>
                      <Badge variant="outline" className="text-xs">{t.qc_issue_count_total || 0} issues</Badge>
                      <Badge className={`text-xs ${t.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{t.status}</Badge>
                      {t.phone && <span className="text-xs text-gray-400">{t.phone}</span>}
                      {primaryId === t.id && <Badge className="text-xs bg-blue-600 text-white">PRIMARY</Badge>}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={previewMerge}>Preview Impact</Button>
                <Button
                  size="sm"
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                  disabled={merging || !primaryId}
                  onClick={executeMerge}
                >
                  {merging ? "Merging..." : `Merge ${selectedGroup.count - 1} Duplicate(s)`}
                </Button>
                <Button size="sm" variant="ghost" className="text-gray-500" onClick={() => { setSelectedGroup(null); setPreviewData(null); }}>Cancel</Button>
              </div>

              {previewData && (
                <div className="bg-white border border-gray-200 rounded p-3 text-sm space-y-1">
                  <p className="font-semibold text-gray-700">Merge Preview:</p>
                  <p className="text-gray-600">Primary → <strong>{selectedGroup.techs.find(t => t.id === primaryId)?.full_name}</strong></p>
                  {previewData.issues_to_relink?.map(r => (
                    <p key={r.technician_id} className="text-gray-500">
                      → {r.issue_count} issues relinked from <strong>{r.technician_name || r.technician_id}</strong>
                    </p>
                  ))}
                  <p className="text-orange-700 font-medium mt-2">
                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                    Duplicate records will be set to: inactive, is_primary=false, profile_status=merged.
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function HealthTile({ label, value, color, icon }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
      <div className={`flex justify-center mb-1 ${color}`}>{icon}</div>
      <p className={`text-2xl font-bold ${color}`}>{value ?? '—'}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}