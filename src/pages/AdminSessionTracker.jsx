import { isLiveWarrantySession } from '../../shared/warrantyContract.js';
import React, { useEffect, useState, useMemo } from "react";
import { base44 } from "@/api/warrantyClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, subDays } from "date-fns";
import { Clock, Users, Activity } from "lucide-react";

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
  // fallback for old records that only have duration_minutes
  return (session.duration_minutes || 0) * 60;
}

function fmtTime(dt) {
  if (!dt) return "—";
  try { return format(new Date(dt), "MM/dd hh:mm a"); } catch { return dt; }
}

export default function AdminSessionTracker() {
  const [user, setUser] = useState(null);
  const [dateFilter, setDateFilter] = useState("7");
  const [activeTab, setActiveTab] = useState("summary");

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: sessions = [], isLoading, refetch } = useQuery({
    queryKey: ["userSessions"],
    queryFn: async () => {
      const res = await base44.functions.invoke('getAllSessions', {});
      return res?.data?.sessions || [];
    },
    refetchInterval: 30000,
    enabled: !!user && user.role === 'admin',
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

  // Daily report: group by date + user
  const dailyRows = useMemo(() => {
    const map = {};
    for (const s of filtered) {
      const day = (s.session_start || "").slice(0, 10);
      if (!day) continue;
      const key = `${day}__${s.user_email}`;
      if (!map[key]) map[key] = { day, email: s.user_email, name: s.user_name || s.user_email, sessions: 0, totalSeconds: 0, activeSeconds: 0, idleSeconds: 0 };
      map[key].sessions++;
      map[key].totalSeconds += getDurSeconds(s);
      map[key].activeSeconds += (s.active_seconds || 0);
      map[key].idleSeconds += (s.idle_seconds || 0);
    }
    return Object.values(map).sort((a, b) => b.day.localeCompare(a.day) || a.name.localeCompare(b.name));
  }, [filtered]);

  if (!user) return <div className="p-8 text-center text-gray-400">Loading...</div>;
  if (user.role !== "admin") return <div className="p-8 text-center text-red-500">Access denied — admin only.</div>;

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Session Tracker</h1>
          <p className="text-gray-500 mt-1">Admin only — user activity log</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="1">Last 24 hours</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
          <button onClick={refetch} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Refresh</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {[{ id: "summary", label: "User Summary" }, { id: "daily", label: "Daily Report" }, { id: "log", label: "Session Log" }].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === t.id ? "bg-white shadow text-blue-700" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeSessions.length}</p>
              <p className="text-xs text-gray-500">Currently Active</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{userList.length}</p>
              <p className="text-xs text-gray-500">Unique Users</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{filtered.length}</p>
              <p className="text-xs text-gray-500">Total Sessions</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-user summary */}
      {activeTab === "summary" && <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Time by User</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center text-gray-400">Loading...</div>
          ) : userList.length === 0 ? (
            <div className="p-6 text-center text-gray-400">No sessions recorded yet.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-2 text-left">User</th>
                  <th className="px-4 py-2 text-left">Sessions</th>
                  <th className="px-4 py-2 text-left">Total Time</th>
                  <th className="px-4 py-2 text-left">Active</th>
                  <th className="px-4 py-2 text-left">Idle</th>
                  <th className="px-4 py-2 text-left">Last Seen</th>
                  <th className="px-4 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {userList.map(u => {
                  const active = u.sessions.some(s => isLiveWarrantySession(s));
                  const lastSeen = u.sessions.reduce((latest, s) => (s.last_seen > latest ? s.last_seen : latest), "");
                  return (
                    <tr key={u.email} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-sm text-gray-900">{u.name}</p>
                        <p className="text-xs text-gray-400">{u.email}</p>
                      </td>
                      <td className="px-4 py-3 text-sm">{u.sessions.length}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-blue-700">{fmtDur(u.totalSeconds)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-green-700">{fmtDur(u.activeSeconds)}</td>
                      <td className="px-4 py-3 text-sm text-amber-600">{fmtDur(u.idleSeconds)}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{fmtTime(lastSeen)}</td>
                      <td className="px-4 py-3">
                        {active
                          ? <Badge className="bg-green-100 text-green-800 text-xs">🟢 Active</Badge>
                          : <Badge variant="outline" className="text-xs text-gray-500">Offline</Badge>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>}

      {/* Daily Report */}
      {activeTab === "daily" && <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Daily Report — Active & Idle Time per User</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center text-gray-400">Loading...</div>
          ) : dailyRows.length === 0 ? (
            <div className="p-6 text-center text-gray-400">No data for this period.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">User</th>
                  <th className="px-4 py-2 text-left">Sessions</th>
                  <th className="px-4 py-2 text-left">Total Time</th>
                  <th className="px-4 py-2 text-left">Active</th>
                  <th className="px-4 py-2 text-left">Idle</th>
                  <th className="px-4 py-2 text-left">Active %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dailyRows.map((row, i) => {
                  const pct = row.totalSeconds > 0 ? Math.round((row.activeSeconds / row.totalSeconds) * 100) : 0;
                  const showDate = i === 0 || dailyRows[i - 1].day !== row.day;
                  return (
                    <tr key={`${row.day}-${row.email}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-700">
                        {showDate ? row.day : <span className="text-gray-300">↓</span>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">{row.name}</p>
                        <p className="text-xs text-gray-400">{row.email}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{row.sessions}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-blue-700">{fmtDur(row.totalSeconds)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-green-700">{fmtDur(row.activeSeconds)}</td>
                      <td className="px-4 py-3 text-sm text-amber-600">{fmtDur(row.idleSeconds)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-600">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>}

      {/* Session log */}
      {activeTab === "log" && <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Session Log</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-2 text-left">User</th>
                <th className="px-4 py-2 text-left">Start</th>
                <th className="px-4 py-2 text-left">End</th>
                <th className="px-4 py-2 text-left">Duration</th>
                <th className="px-4 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.slice(0, 100).map(s => (
                <tr key={s.id} className="hover:bg-gray-50 text-sm">
                  <td className="px-4 py-2">{s.user_name || s.user_email}</td>
                  <td className="px-4 py-2 text-gray-500">{fmtTime(s.session_start)}</td>
                  <td className="px-4 py-2 text-gray-500">{isLiveWarrantySession(s) ? "—" : fmtTime(s.session_end)}</td>
                  <td className="px-4 py-2 font-medium">{fmtDur(getDurSeconds(s))}</td>
                  <td className="px-4 py-2">
                    {isLiveWarrantySession(s)
                      ? <Badge className="bg-green-100 text-green-800 text-xs">Active</Badge>
                      : <Badge variant="outline" className="text-xs">Done</Badge>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>}
    </div>
  );
}