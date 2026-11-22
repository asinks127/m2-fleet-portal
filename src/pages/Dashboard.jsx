import { isLiveWarrantySession } from '../../shared/warrantyContract.js';
import React from "react";
import { base44 } from "@/api/warrantyClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, MapPin, Shield, TrendingUp, Clock, AlertCircle, CheckCircle, FileWarning, Archive, Activity, Wrench, ShieldCheck, Search, ClipboardList } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { format, subDays } from "date-fns";
import StatsCard from "../components/dashboard/StatsCard";
import RecentActivity from "../components/dashboard/RecentActivity";
import TopPerformers from "../components/dashboard/TopPerformers";
import WarrantyOverview from "../components/dashboard/WarrantyOverview";
import { isValidRecord, isActiveWarrantyIssue, buildDataBreakdown, isClosedIssue } from "../lib/qcUtils";

function fmtDur(seconds) {
  if (!seconds || seconds < 60) return seconds ? `${seconds}s` : '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}
function getDurSeconds(session) {
  if (session.duration_seconds != null) return session.duration_seconds;
  return (session.duration_minutes || 0) * 60;
}
function fmtTime(dt) {
  if (!dt) return "—";
  try { return format(new Date(dt), "MM/dd hh:mm a"); } catch { return dt; }
}

function isAdminUser(user) {
  return user?.email?.toLowerCase() === 'steve@m2fleetcom.com';
}

function SessionTrackerEmbed() {
  const [dateFilter, setDateFilter] = React.useState("7");
  const [activeTab, setActiveTab] = React.useState("summary");

  const { data: sessions = [], isLoading, refetch } = useQuery({
    queryKey: ["userSessions-dashboard"],
    queryFn: async () => {
      const res = await base44.functions.invoke('getAllSessions', {});
      return res?.data?.sessions || [];
    },
    refetchInterval: 60000,
  });

  const cutoff = subDays(new Date(), parseInt(dateFilter)).toISOString();
  const filtered = sessions.filter(s => (s.session_start || "") >= cutoff);
  const activeSessions = filtered.filter(s => isLiveWarrantySession(s));

  const byUser = {};
  for (const s of filtered) {
    if (!byUser[s.user_email]) byUser[s.user_email] = { name: s.user_name || s.user_email, email: s.user_email, sessions: [], totalSeconds: 0, activeSeconds: 0, idleSeconds: 0 };
    byUser[s.user_email].sessions.push(s);
    byUser[s.user_email].totalSeconds += getDurSeconds(s);
    byUser[s.user_email].activeSeconds += (s.active_seconds || 0);
    byUser[s.user_email].idleSeconds += (s.idle_seconds || 0);
  }
  const userList = Object.values(byUser).sort((a, b) => b.totalSeconds - a.totalSeconds);

  const dailyMap = {};
  for (const s of filtered) {
    const day = (s.session_start || "").slice(0, 10);
    if (!day) continue;
    const key = `${day}__${s.user_email}`;
    if (!dailyMap[key]) dailyMap[key] = { day, email: s.user_email, name: s.user_name || s.user_email, sessions: 0, totalSeconds: 0, activeSeconds: 0, idleSeconds: 0 };
    dailyMap[key].sessions++;
    dailyMap[key].totalSeconds += getDurSeconds(s);
    dailyMap[key].activeSeconds += (s.active_seconds || 0);
    dailyMap[key].idleSeconds += (s.idle_seconds || 0);
  }
  const dailyRows = Object.values(dailyMap).sort((a, b) => b.day.localeCompare(a.day) || a.name.localeCompare(b.name));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {[{ id: "summary", label: "User Summary" }, { id: "daily", label: "Daily Report" }, { id: "log", label: "Session Log" }].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === t.id ? "bg-white shadow text-blue-700" : "text-gray-500 hover:text-gray-700"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <select value={dateFilter} onChange={e => setDateFilter(e.target.value)}
            className="border border-gray-200 rounded px-2 py-1 text-xs">
            <option value="1">Last 24h</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
          <button onClick={refetch} className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">Refresh</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 border border-green-100 rounded-lg p-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-green-600 flex-shrink-0" />
          <div><p className="text-xl font-bold text-green-700">{activeSessions.length}</p><p className="text-xs text-gray-500">Active Now</p></div>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <div><p className="text-xl font-bold text-blue-700">{userList.length}</p><p className="text-xs text-gray-500">Unique Users</p></div>
        </div>
        <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-purple-600 flex-shrink-0" />
          <div><p className="text-xl font-bold text-purple-700">{filtered.length}</p><p className="text-xs text-gray-500">Sessions</p></div>
        </div>
      </div>

      {activeTab === "summary" && (
        <div className="overflow-x-auto">
          {isLoading ? <p className="text-center text-sm text-gray-400 py-4">Loading...</p> : userList.length === 0 ? <p className="text-center text-sm text-gray-400 py-4">No sessions recorded.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-3 py-2 text-left">User</th>
                <th className="px-3 py-2 text-left">Sessions</th>
                <th className="px-3 py-2 text-left">Total Time</th>
                <th className="px-3 py-2 text-left">Active</th>
                <th className="px-3 py-2 text-left">Idle</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {userList.map(u => {
                  const active = u.sessions.some(s => isLiveWarrantySession(s));
                  const lastSeen = u.sessions.reduce((l, s) => (s.last_seen > l ? s.last_seen : l), "");
                  return (
                    <tr key={u.email} className="hover:bg-gray-50">
                      <td className="px-3 py-2"><p className="font-medium text-gray-900">{u.name}</p><p className="text-xs text-gray-400">{u.email}</p></td>
                      <td className="px-3 py-2">{u.sessions.length}</td>
                      <td className="px-3 py-2 font-semibold text-blue-700">{fmtDur(u.totalSeconds)}</td>
                      <td className="px-3 py-2 font-medium text-green-700">{fmtDur(u.activeSeconds)}</td>
                      <td className="px-3 py-2 text-amber-600">{fmtDur(u.idleSeconds)}</td>
                      <td className="px-3 py-2">{active ? <Badge className="bg-green-100 text-green-800 text-xs">🟢 Active</Badge> : <Badge variant="outline" className="text-xs text-gray-500">Offline</Badge>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === "daily" && (
        <div className="overflow-x-auto">
          {isLoading ? <p className="text-center text-sm text-gray-400 py-4">Loading...</p> : dailyRows.length === 0 ? <p className="text-center text-sm text-gray-400 py-4">No data.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">User</th>
                <th className="px-3 py-2 text-left">Sessions</th>
                <th className="px-3 py-2 text-left">Total</th>
                <th className="px-3 py-2 text-left">Active</th>
                <th className="px-3 py-2 text-left">Idle</th>
                <th className="px-3 py-2 text-left">Active %</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {dailyRows.map((row, i) => {
                  const pct = row.totalSeconds > 0 ? Math.round((row.activeSeconds / row.totalSeconds) * 100) : 0;
                  const showDate = i === 0 || dailyRows[i - 1].day !== row.day;
                  return (
                    <tr key={`${row.day}-${row.email}`} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-700">{showDate ? row.day : <span className="text-gray-300">↓</span>}</td>
                      <td className="px-3 py-2"><p className="font-medium text-gray-900">{row.name}</p><p className="text-xs text-gray-400">{row.email}</p></td>
                      <td className="px-3 py-2 text-gray-500">{row.sessions}</td>
                      <td className="px-3 py-2 font-semibold text-blue-700">{fmtDur(row.totalSeconds)}</td>
                      <td className="px-3 py-2 font-medium text-green-700">{fmtDur(row.activeSeconds)}</td>
                      <td className="px-3 py-2 text-amber-600">{fmtDur(row.idleSeconds)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} /></div>
                          <span className="text-xs text-gray-600">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === "log" && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-3 py-2 text-left">User</th>
              <th className="px-3 py-2 text-left">Start</th>
              <th className="px-3 py-2 text-left">End</th>
              <th className="px-3 py-2 text-left">Duration</th>
              <th className="px-3 py-2 text-left">Status</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.slice(0, 100).map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">{s.user_name || s.user_email}</td>
                  <td className="px-3 py-2 text-gray-500">{fmtTime(s.session_start)}</td>
                  <td className="px-3 py-2 text-gray-500">{isLiveWarrantySession(s) ? "—" : fmtTime(s.session_end)}</td>
                  <td className="px-3 py-2 font-medium">{fmtDur(getDurSeconds(s))}</td>
                  <td className="px-3 py-2">{isLiveWarrantySession(s) ? <Badge className="bg-green-100 text-green-800 text-xs">Active</Badge> : <Badge variant="outline" className="text-xs">Done</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [user, setUser] = React.useState(null);
  React.useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);

  const [backfilling, setBackfilling] = React.useState(false);
  const [backfillResult, setBackfillResult] = React.useState(null);
  const [backfillingClaims, setBackfillingClaims] = React.useState(false);
  const [backfillClaimsResult, setBackfillClaimsResult] = React.useState(null);
  const [backfillingWarrantyEmails, setBackfillingWarrantyEmails] = React.useState(false);
  const [backfillWarrantyEmailsResult, setBackfillWarrantyEmailsResult] = React.useState(null);
  const [classifying, setClassifying] = React.useState(false);
  const [classifyResult, setClassifyResult] = React.useState(null);
  const [fixingPlaceholders, setFixingPlaceholders] = React.useState(false);
  const [markingOldWarranties, setMarkingOldWarranties] = React.useState(false);
  const [markOldWarrantiesResult, setMarkOldWarrantiesResult] = React.useState(null);
  const [fixingWarrantyRecords, setFixingWarrantyRecords] = React.useState(false);
  const [fixWarrantyRecordsResult, setFixWarrantyRecordsResult] = React.useState(null);
  const [fixPlaceholderResult, setFixPlaceholderResult] = React.useState(null);

  const runBackfillProjects = async () => {
    setBackfilling(true);
    setBackfillResult(null);
    try {
      const res = await base44.functions.invoke('backfillProjects', {});
      setBackfillResult(res.data);
    } catch (e) {
      setBackfillResult({ error: e.message });
    }
    setBackfilling(false);
  };

  const runBackfillWarrantyClaims = async () => {
    setBackfillingClaims(true);
    setBackfillClaimsResult(null);
    let totalCreated = 0, totalSkipped = 0, offset = 0, page = 0;
    try {
      while (true) {
        const res = await base44.functions.invoke('backfillWarrantyClaims', { offset });
        const data = res.data;
        totalCreated += data.created || 0;
        totalSkipped += data.skipped || 0;
        page++;
        setBackfillClaimsResult({ created: totalCreated, skipped: totalSkipped, pages: page, inProgress: data.hasMore });
        if (!data.hasMore) break;
        offset = data.nextOffset;
        await new Promise(r => setTimeout(r, 1000));
      }
      setBackfillClaimsResult({ created: totalCreated, skipped: totalSkipped, pages: page, inProgress: false });
    } catch (e) {
      setBackfillClaimsResult({ error: e.message, created: totalCreated, skipped: totalSkipped });
    }
    setBackfillingClaims(false);
  };

  const runBackfillAllWarrantyEmails = async () => {
    setBackfillingWarrantyEmails(true);
    setBackfillWarrantyEmailsResult(null);
    let totalCreated = 0, totalSkipped = 0, pageToken = null, page = 0;
    try {
      while (true) {
        const payload = pageToken ? { pageToken } : {};
        const res = await base44.functions.invoke('backfillAllWarrantyEmails', payload);
        const data = res.data;
        totalCreated += data.created || 0;
        totalSkipped += data.skipped || 0;
        page++;
        setBackfillWarrantyEmailsResult({ created: totalCreated, skipped: totalSkipped, pages: page, inProgress: data.hasMore });
        if (data.rateLimited) {
          // Wait 30s before retrying the same page
          await new Promise(r => setTimeout(r, 30000));
          continue; // retry without advancing pageToken
        }
        if (!data.hasMore || !data.nextPageToken) break;
        pageToken = data.nextPageToken;
      }
      setBackfillWarrantyEmailsResult({ created: totalCreated, skipped: totalSkipped, pages: page, inProgress: false });
    } catch (e) {
      setBackfillWarrantyEmailsResult({ error: e.message, created: totalCreated, skipped: totalSkipped });
    }
    setBackfillingWarrantyEmails(false);
  };

  const runFixPlaceholderTechs = async () => {
    setFixingPlaceholders(true);
    setFixPlaceholderResult(null);
    try {
      const res = await base44.functions.invoke('fixPlaceholderTechNames', {});
      setFixPlaceholderResult(res.data);
    } catch (e) {
      setFixPlaceholderResult({ error: e.message });
    }
    setFixingPlaceholders(false);
  };

  const runFixExistingWarrantyRecords = async () => {
    if (!window.confirm('Fix all existing warranty records? This will clean up doubled field values, rebuild titles, initialize communication history, and mark duplicates.')) return;
    setFixingWarrantyRecords(true);
    setFixWarrantyRecordsResult(null);
    try {
      const res = await base44.functions.invoke('fixExistingWarrantyRecords', {});
      setFixWarrantyRecordsResult(res.data);
    } catch (e) {
      setFixWarrantyRecordsResult({ error: e.message });
    }
    setFixingWarrantyRecords(false);
  };

  const runMarkOldWarrantiesRepaired = async () => {
    if (!window.confirm('Mark all warranty returns before Jan 1, 2026 as Repaired? This cannot be undone.')) return;
    setMarkingOldWarranties(true);
    setMarkOldWarrantiesResult(null);
    let totalUpdated = 0;
    try {
      while (true) {
        const res = await base44.functions.invoke('markOldWarrantiesRepaired', {});
        const data = res.data;
        totalUpdated += data.updated || 0;
        setMarkOldWarrantiesResult({ updated: totalUpdated, remaining: data.remaining, inProgress: data.hasMore });
        if (!data.hasMore) break;
        await new Promise(r => setTimeout(r, 1000));
      }
    } catch (e) {
      setMarkOldWarrantiesResult({ error: e.message, updated: totalUpdated });
    }
    setMarkingOldWarranties(false);
  };

  const runBackfillClassification = async () => {
    setClassifying(true);
    setClassifyResult(null);
    try {
      const res = await base44.functions.invoke('backfillClassification', {});
      setClassifyResult(res.data);
    } catch (e) {
      setClassifyResult({ error: e.message });
    }
    setClassifying(false);
  };

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => base44.entities.Technician.list(),
  });

  const { data: serviceCalls = [] } = useQuery({
    queryKey: ['serviceCalls'],
    queryFn: () => base44.entities.ServiceCall.list('-service_date'),
  });

  const { data: warrantyClaims = [] } = useQuery({
    queryKey: ['warrantyClaims'],
    queryFn: () => base44.entities.WarrantyClaim.list('-claim_date'),
  });

  const { data: qcIssues = [] } = useQuery({
    queryKey: ['qcIssues-dashboard'],
    queryFn: () => base44.entities.QCIssue.list('-created_date'),
  });

  const activeTechs = technicians.filter(t => t.status === 'active').length;
  const totalMileage = serviceCalls.reduce((sum, call) => sum + (call.miles_driven || 0), 0);

  // Standardized counts using shared filter definitions
  const validIssues = qcIssues.filter(isValidRecord);
  const activeWarrantyIssues = validIssues.filter(isActiveWarrantyIssue);
  const pendingWarranties = activeWarrantyIssues.length;
  const techsWithOpenIssues = new Set(activeWarrantyIssues.map(i => i.technician_id).filter(Boolean)).size;
  const avgIssuesPerTech = techsWithOpenIssues > 0 ? (activeWarrantyIssues.length / techsWithOpenIssues).toFixed(1) : '0';
  const weightedTotal = validIssues.reduce((s, i) => s + (i.issue_weight || 0), 0).toFixed(1);
  const pendingRepairCount = validIssues.filter(i => i.status === 'pending_repair').length;
  const repairedCount = validIssues.filter(isClosedIssue).length;

  const breakdown = buildDataBreakdown(qcIssues);

  const thisWeekCalls = serviceCalls.filter(call => {
    const callDate = new Date(call.service_date);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return callDate >= weekAgo;
  });

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Overview of your service operations</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="flex flex-col items-end gap-1">
            <Button
              variant="outline"
              onClick={runBackfillProjects}
              disabled={backfilling || backfillingClaims}
              className="border-orange-300 text-orange-700 hover:bg-orange-50"
            >
              {backfilling ? 'Running...' : 'Backfill Projects'}
            </Button>
            {backfillResult && (
              <span className="text-xs text-gray-500">
                {backfillResult.error
                  ? `Error: ${backfillResult.error}`
                  : `✓ linked: ${backfillResult.linked}, created: ${backfillResult.created}, skipped: ${backfillResult.skipped}, unlinked left: ${backfillResult.unlinked_remaining ?? '?'}`
                }
              </span>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <Button
              variant="outline"
              onClick={runBackfillWarrantyClaims}
              disabled={backfillingClaims || backfilling || backfillingWarrantyEmails}
              className="border-purple-300 text-purple-700 hover:bg-purple-50"
            >
              {backfillingClaims ? 'Creating...' : 'Backfill Warranty Claims'}
            </Button>
            {backfillClaimsResult && (
              <span className="text-xs text-gray-500">
                {backfillClaimsResult.error
                  ? `Error: ${backfillClaimsResult.error} (created: ${backfillClaimsResult.created ?? 0})`
                  : backfillClaimsResult.inProgress
                    ? `⏳ Page ${backfillClaimsResult.pages}… created: ${backfillClaimsResult.created}, skipped: ${backfillClaimsResult.skipped}`
                    : `✓ Done (${backfillClaimsResult.pages} pages) — created: ${backfillClaimsResult.created}, skipped: ${backfillClaimsResult.skipped}`
                }
              </span>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <Button
              variant="outline"
              onClick={runBackfillAllWarrantyEmails}
              disabled={backfillingWarrantyEmails || backfilling || backfillingClaims}
              className="border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              {backfillingWarrantyEmails ? 'Scanning...' : 'Backfill All Warranty Emails'}
            </Button>
            {backfillWarrantyEmailsResult && (
              <span className="text-xs text-gray-500">
                {backfillWarrantyEmailsResult.error
                  ? `Error: ${backfillWarrantyEmailsResult.error} (created: ${backfillWarrantyEmailsResult.created ?? 0})`
                  : backfillWarrantyEmailsResult.inProgress
                    ? `⏳ Page ${backfillWarrantyEmailsResult.pages}… created: ${backfillWarrantyEmailsResult.created}, skipped: ${backfillWarrantyEmailsResult.skipped}`
                    : `✓ Done (${backfillWarrantyEmailsResult.pages} pages) — created: ${backfillWarrantyEmailsResult.created}, skipped: ${backfillWarrantyEmailsResult.skipped}`
                }
              </span>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <Button
              variant="outline"
              onClick={runFixPlaceholderTechs}
              disabled={fixingPlaceholders}
              className="border-red-300 text-red-700 hover:bg-red-50"
            >
              {fixingPlaceholders ? 'Fixing...' : 'Fix Placeholder Techs'}
            </Button>
            {fixPlaceholderResult && (
              <span className="text-xs text-gray-500">
                {fixPlaceholderResult.error ? `Error: ${fixPlaceholderResult.error}` : `✓ cleared: ${fixPlaceholderResult.updated}`}
              </span>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <Button
              variant="outline"
              onClick={runFixExistingWarrantyRecords}
              disabled={fixingWarrantyRecords}
              className="border-indigo-300 text-indigo-700 hover:bg-indigo-50"
            >
              {fixingWarrantyRecords ? 'Fixing...' : 'Fix Existing Warranty Records'}
            </Button>
            {fixWarrantyRecordsResult && (
              <span className="text-xs text-gray-500">
                {fixWarrantyRecordsResult.error
                  ? `Error: ${fixWarrantyRecordsResult.error}`
                  : `✓ ${fixWarrantyRecordsResult.message}`
                }
              </span>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <Button
              variant="outline"
              onClick={runMarkOldWarrantiesRepaired}
              disabled={markingOldWarranties}
              className="border-teal-300 text-teal-700 hover:bg-teal-50"
            >
              {markingOldWarranties ? 'Marking...' : 'Mark Pre-2026 Warranties Repaired'}
            </Button>
            {markOldWarrantiesResult && (
              <span className="text-xs text-gray-500">
                {markOldWarrantiesResult.error
                  ? `Error: ${markOldWarrantiesResult.error}`
                  : `✓ updated: ${markOldWarrantiesResult.updated}`
                }
              </span>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <Button
              variant="outline"
              onClick={runBackfillClassification}
              disabled={classifying}
              className="border-green-300 text-green-700 hover:bg-green-50"
            >
              {classifying ? 'Classifying...' : 'Backfill Classification'}
            </Button>
            {classifyResult && (
              <span className="text-xs text-gray-500">
                {classifyResult.error ? `Error: ${classifyResult.error}` : `✓ classified: ${classifyResult.updated}`}
              </span>
            )}
          </div>
          <Link to={createPageUrl("ServiceCalls")}>
            <Button className="bg-blue-600 hover:bg-blue-700 shadow-md ripple">
              <MapPin className="w-4 h-4 mr-2" />
              New Service Call
            </Button>
          </Link>
        </div>
      </div>

      {/* Data quality breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-3 flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
            <Archive className="w-4 h-4 text-gray-500" />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">{breakdown.total}</p>
            <p className="text-xs text-gray-500">Total Records</p>
          </div>
        </div>
        <div className="bg-white border border-green-200 rounded-lg p-3 flex items-center gap-3">
          <div className="w-8 h-8 bg-green-50 rounded-full flex items-center justify-center">
            <CheckCircle className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <p className="text-lg font-bold text-green-700">{breakdown.valid}</p>
            <p className="text-xs text-gray-500">Valid Records</p>
          </div>
        </div>
        <div className="bg-white border border-yellow-200 rounded-lg p-3 flex items-center gap-3">
          <div className="w-8 h-8 bg-yellow-50 rounded-full flex items-center justify-center">
            <FileWarning className="w-4 h-4 text-yellow-600" />
          </div>
          <div>
            <p className="text-lg font-bold text-yellow-700">{breakdown.needsReview}</p>
            <p className="text-xs text-gray-500">Needs Review</p>
          </div>
        </div>
        <div className="bg-white border border-red-200 rounded-lg p-3 flex items-center gap-3">
          <div className="w-8 h-8 bg-red-50 rounded-full flex items-center justify-center">
            <Archive className="w-4 h-4 text-red-500" />
          </div>
          <div>
            <p className="text-lg font-bold text-red-600">{breakdown.legacy}</p>
            <p className="text-xs text-gray-500">Legacy Records</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Active Technicians"
          value={activeTechs}
          icon={Users}
          color="blue"
          subtitle={`${technicians.length} total`}
        />
        <StatsCard
          title="Techs w/ Open Issues"
          value={techsWithOpenIssues}
          icon={Users}
          color="orange"
          subtitle={`Avg ${avgIssuesPerTech} issues/tech`}
        />
        <StatsCard
          title="This Week"
          value={thisWeekCalls.length}
          icon={Clock}
          color="green"
          subtitle="Service calls"
        />
        <StatsCard
          title="Weighted Issues"
          value={weightedTotal}
          icon={TrendingUp}
          color="purple"
          subtitle="Sum of issue weights"
        />
        <StatsCard
          title="Pending Repair"
          value={pendingRepairCount}
          icon={AlertCircle}
          color="orange"
          subtitle="Status: pending_repair"
        />
        <StatsCard
          title="Repaired / Closed"
          value={repairedCount}
          icon={CheckCircle}
          color="green"
          subtitle="Resolved valid records"
        />
        <StatsCard
          title="Pending Warranties"
          value={pendingWarranties}
          icon={AlertCircle}
          color="red"
          subtitle="Active · valid records only"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <RecentActivity serviceCalls={serviceCalls.slice(0, 5)} />
        <TopPerformers serviceCalls={serviceCalls} technicians={technicians} />
      </div>

      <WarrantyOverview warrantyClaims={warrantyClaims} />

      {/* Admin Section — visible to admins and steve */}
      {user && isAdminUser(user) && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-t pt-6">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">Admin Section</h2>
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Admin Tools", href: "/admin-tools", icon: Wrench, color: "bg-orange-50 border-orange-200 text-orange-700" },
              { label: "Session Tracker", href: "/admin-sessions", icon: Clock, color: "bg-blue-50 border-blue-200 text-blue-700" },
              { label: "QC Data Cleanup", href: "/qc-data-cleanup", icon: AlertCircle, color: "bg-red-50 border-red-200 text-red-700" },
              { label: "Data Quality", href: "/qc-data-quality", icon: ShieldCheck, color: "bg-green-50 border-green-200 text-green-700" },
            ].map(({ label, href, icon: Icon, color }) => (
              <Link key={href} to={href} className={`flex items-center gap-2 p-3 border rounded-lg text-sm font-medium transition-all hover:shadow-sm ${color}`}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </Link>
            ))}
          </div>

          {/* Session Tracker embedded */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="w-4 h-4 text-green-600" />
                  User Session Tracker
                </CardTitle>
                <Link to="/admin-sessions" className="text-xs text-blue-600 hover:underline">Full page →</Link>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <SessionTrackerEmbed />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}