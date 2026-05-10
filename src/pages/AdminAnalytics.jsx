import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Cell } from 'recharts';
import { Users, Activity, MousePointerClick, Clock } from 'lucide-react';
import { format, subDays, parseISO } from 'date-fns';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export default function AdminAnalytics() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['appActivityLogs'],
    queryFn: () => base44.entities.AppActivityLog.list('-lastActivityAt', 5000),
  });

  const { pageUsage, uniqueUsers, recentActivity, topUsers, unusedPages } = useMemo(() => {
    if (!logs.length) return { pageUsage: [], uniqueUsers: 0, recentActivity: [], topUsers: [], unusedPages: [] };

    const pageCount = {};
    const userSet = new Set();
    const userCount = {};
    const dailyActivity = {};

    // Initialize last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = format(subDays(new Date(), i), 'MMM dd');
      dailyActivity[d] = 0;
    }

    logs.forEach(log => {
      if (log.pageName) {
        const cleanPageName = log.pageName.replace('/', '') || 'Home';
        pageCount[cleanPageName] = (pageCount[cleanPageName] || 0) + 1;
      }
      
      if (log.userEmail) {
        userSet.add(log.userEmail);
        userCount[log.userEmail] = (userCount[log.userEmail] || 0) + 1;
      }

      if (log.lastActivityAt) {
        const dateKey = format(parseISO(log.lastActivityAt), 'MMM dd');
        if (dailyActivity[dateKey] !== undefined) {
          dailyActivity[dateKey] += 1;
        }
      }
    });

    const sortedPages = Object.entries(pageCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const knownPages = ['MyTeam', 'QCBoard', 'Messaging', 'InvoicesHub', 'TechRoster', 'ProjectKanbanBoard', 'Performance', 'VeloSurveyDashboard', 'CallLogsReport', 'ComplianceDashboard', 'SafetyAdmin', 'EmergencyContactReport', 'AuditingDashboard', 'AuditList', 'AuditTemplates', 'ResourceSearch', 'ReportsHub', 'DelayReviewDashboard', 'Calendar'];
    
    const usedPageNames = new Set(sortedPages.map(p => p.name));
    const unused = knownPages.filter(p => !usedPageNames.has(p) && !usedPageNames.has('/' + p));

    const sortedUsers = Object.entries(userCount)
      .map(([email, count]) => ({ email, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const activityTimeline = Object.entries(dailyActivity).map(([date, count]) => ({
      date,
      actions: count
    }));

    return {
      pageUsage: sortedPages,
      uniqueUsers: userSet.size,
      recentActivity: activityTimeline,
      topUsers: sortedUsers,
      unusedPages: unused
    };
  }, [logs]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-gray-500 font-medium">Crunching usage data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">App Usage Analytics</h1>
          <p className="text-gray-500 mt-1">Real-time metrics based on {logs.length} activity logs</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-gray-500">Total Interactions</CardTitle>
            <MousePointerClick className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{logs.length}</div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-gray-500">Active Users</CardTitle>
            <Users className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{uniqueUsers}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-gray-500">Pages Accessed</CardTitle>
            <Activity className="w-4 h-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{pageUsage.length}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-gray-500">Unused Features</CardTitle>
            <Clock className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{unusedPages.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Most Used Pages</CardTitle>
            <CardDescription>Top 10 pages by total interactions</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pageUsage.slice(0, 10)} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e5e7eb" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={120} tick={{fontSize: 12, fill: '#4b5563'}} />
                <Tooltip cursor={{fill: '#f3f4f6'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                  {pageUsage.slice(0, 10).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Activity Timeline</CardTitle>
            <CardDescription>Interactions over the last 7 days</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={recentActivity} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{fontSize: 12, fill: '#4b5563'}} />
                <YAxis tick={{fontSize: 12, fill: '#4b5563'}} />
                <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Line type="monotone" dataKey="actions" stroke="#8b5cf6" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm h-full">
          <CardHeader>
            <CardTitle>Most Active Users</CardTitle>
            <CardDescription>Top users by total recorded interactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topUsers.map((user, index) => (
                <div key={user.email} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                      {index + 1}
                    </div>
                    <span className="font-medium text-gray-700">{user.email}</span>
                  </div>
                  <span className="font-semibold text-gray-900 bg-gray-100 px-3 py-1 rounded-full text-sm">{user.count} actions</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm h-full">
          <CardHeader>
            <CardTitle>Underutilized Features</CardTitle>
            <CardDescription>Major app sections with zero recent activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {unusedPages.length > 0 ? unusedPages.map(page => (
                <span key={page} className="px-3 py-1.5 bg-red-50 text-red-700 text-sm font-medium rounded-md border border-red-100 flex items-center">
                  <Clock className="w-3 h-3 mr-1.5 opacity-70" />
                  {page}
                </span>
              )) : (
                <div className="flex flex-col items-center justify-center py-8 text-center text-gray-500 w-full">
                  <Activity className="w-8 h-8 text-green-400 mb-2 opacity-50" />
                  <p>All monitored features have recent activity!</p>
                  <p className="text-sm mt-1">Your team is actively using the entire platform.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}