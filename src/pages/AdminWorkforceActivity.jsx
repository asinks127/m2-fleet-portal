import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { getWorkforceActivity } from '@/functions/getWorkforceActivity';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { AlertTriangle, Clock, UserCheck, Timer, Download } from 'lucide-react';

export default function AdminWorkforceActivity() {
    const { user } = useAuth();
    const [dateRange, setDateRange] = useState('7days');
    const [selectedUser, setSelectedUser] = useState('all');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');

    const allowedEmails = ['austin@m2fleetcom.com', 'orville@m2fleetcom.com'];
    const isAuthorized = user && allowedEmails.includes(user.email?.toLowerCase());

    const { data, isLoading } = useQuery({
        queryKey: ['workforceActivity'],
        queryFn: async () => {
            const res = await getWorkforceActivity({});
            return res.data?.logs || [];
        },
        enabled: !!isAuthorized,
        refetchInterval: 60000
    });

    if (!isAuthorized) {
        return (
            <div className="p-8 text-center flex flex-col items-center justify-center min-h-[60vh]">
                <AlertTriangle className="h-16 w-16 text-red-500 mb-4" />
                <h2 className="text-3xl font-bold text-gray-900">Access Denied</h2>
                <p className="text-gray-500 mt-2 text-lg">You do not have permission to view workforce activity.</p>
            </div>
        );
    }

    if (isLoading) {
        return <div className="p-8 text-center text-gray-500 mt-20 animate-pulse">Loading real-time activity data...</div>;
    }

    const logs = data || [];

    // Filter logic
    const filteredLogs = logs.filter(log => {
        const matchUser = selectedUser === 'all' || log.userEmail === selectedUser;
        const logDate = new Date(log.sessionStart);
        let matchDate = false;
        
        if (dateRange === 'custom') {
            const start = customStartDate ? startOfDay(new Date(customStartDate)) : new Date(0);
            const end = customEndDate ? endOfDay(new Date(customEndDate)) : new Date('2100-01-01');
            matchDate = logDate >= start && logDate <= end;
        } else {
            const now = new Date();
            let startDate;
            if (dateRange === 'today') startDate = startOfDay(now);
            else if (dateRange === '7days') startDate = subDays(now, 7);
            else if (dateRange === '30days') startDate = subDays(now, 30);
            else startDate = new Date(0); // all time
            
            matchDate = logDate >= startDate;
        }

        return matchUser && matchDate;
    });

    const uniqueUsers = Array.from(new Set(logs.map(l => l.userEmail)));

    // Aggregates
    const totalActive = filteredLogs.reduce((acc, log) => acc + (log.activeSeconds || 0), 0);
    const totalIdle = filteredLogs.reduce((acc, log) => acc + (log.idleSeconds || 0), 0);
    const totalDuration = filteredLogs.reduce((acc, log) => acc + (log.durationSeconds || 0), 0);
    const sessionCount = filteredLogs.length;

    const formatTime = (seconds) => {
        if (!seconds) return '0h 0m';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return `${h}h ${m}m`;
    };

    const downloadReport = () => {
        const headers = ['Date', 'User', 'First Login', 'Session End', 'Total Duration', 'Active Time', 'Idle Time'];
        const csvRows = filteredLogs.map(log => {
            return [
                log.activityDate,
                log.userName || log.userEmail,
                format(new Date(log.sessionStart), 'yyyy-MM-dd HH:mm:ss'),
                log.sessionEnd ? format(new Date(log.sessionEnd), 'yyyy-MM-dd HH:mm:ss') : (log.lastActivityAt ? format(new Date(log.lastActivityAt), 'yyyy-MM-dd HH:mm:ss') : ''),
                formatTime(log.durationSeconds),
                formatTime(log.activeSeconds),
                formatTime(log.idleSeconds)
            ].join(',');
        });
        
        const summaryRow = [
            'TOTALS',
            '',
            '',
            '',
            formatTime(totalDuration),
            formatTime(totalActive),
            formatTime(totalIdle)
        ].join(',');

        const csvContent = [headers.join(','), ...csvRows, summaryRow].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Workforce_Activity_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Workforce Activity Dashboard</h1>
                    <p className="text-gray-500 mt-1">Real-time tracking for authorized personnel only.</p>
                </div>
                <Button onClick={downloadReport} className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg transition-all hover:scale-105">
                    <Download className="w-4 h-4" /> Export Report
                </Button>
            </div>

            <div className="flex flex-wrap gap-4 bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                <div className="w-full sm:w-64">
                    <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Filter by User</label>
                    <Select value={selectedUser} onValueChange={setSelectedUser}>
                        <SelectTrigger className="bg-gray-50 border-transparent focus:bg-white transition-colors">
                            <SelectValue placeholder="All Users" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Tracked Users</SelectItem>
                            {uniqueUsers.map(email => (
                                <SelectItem key={email} value={email}>{email}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="w-full sm:w-64">
                    <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Time Range</label>
                    <Select value={dateRange} onValueChange={setDateRange}>
                        <SelectTrigger className="bg-gray-50 border-transparent focus:bg-white transition-colors">
                            <SelectValue placeholder="7 Days" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="today">Today</SelectItem>
                            <SelectItem value="7days">Last 7 Days</SelectItem>
                            <SelectItem value="30days">Last 30 Days</SelectItem>
                            <SelectItem value="all">All Time</SelectItem>
                            <SelectItem value="custom">Custom Range</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                {dateRange === 'custom' && (
                    <>
                        <div className="w-full sm:w-auto">
                            <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Start Date</label>
                            <Input 
                                type="date" 
                                value={customStartDate}
                                onChange={e => setCustomStartDate(e.target.value)}
                            />
                        </div>
                        <div className="w-full sm:w-auto">
                            <label className="text-sm font-semibold text-gray-700 mb-1.5 block">End Date</label>
                            <Input 
                                type="date" 
                                value={customEndDate}
                                onChange={e => setCustomEndDate(e.target.value)}
                            />
                        </div>
                    </>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-l-4 border-l-blue-500 shadow-md hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-gray-500 flex items-center gap-2 uppercase tracking-wider">
                            <Clock className="w-4 h-4 text-blue-500" /> Total Logged-In
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-extrabold text-gray-900">{formatTime(totalDuration)}</div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-green-500 shadow-md hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-gray-500 flex items-center gap-2 uppercase tracking-wider">
                            <UserCheck className="w-4 h-4 text-green-500" /> Active Working Time
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-extrabold text-green-600">{formatTime(totalActive)}</div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-amber-500 shadow-md hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-gray-500 flex items-center gap-2 uppercase tracking-wider">
                            <Timer className="w-4 h-4 text-amber-500" /> Idle Time
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-extrabold text-amber-600">{formatTime(totalIdle)}</div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-purple-500 shadow-md hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-gray-500 flex items-center gap-2 uppercase tracking-wider">
                            <AlertTriangle className="w-4 h-4 text-purple-500" /> Total Sessions
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-extrabold text-gray-900">{sessionCount}</div>
                    </CardContent>
                </Card>
            </div>

            <Card className="shadow-lg border-gray-200 overflow-hidden">
                <CardHeader className="bg-gray-50 border-b border-gray-100">
                    <CardTitle className="text-lg">Detailed Session Logs</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-50/50">
                                    <TableHead className="font-semibold text-gray-700">User</TableHead>
                                    <TableHead className="font-semibold text-gray-700">Date</TableHead>
                                    <TableHead className="font-semibold text-gray-700">Login Time</TableHead>
                                    <TableHead className="font-semibold text-gray-700">Last Activity</TableHead>
                                    <TableHead className="font-semibold text-gray-700">Total Time</TableHead>
                                    <TableHead className="font-semibold text-green-700">Active</TableHead>
                                    <TableHead className="font-semibold text-amber-700">Idle</TableHead>
                                    <TableHead className="font-semibold text-gray-700">Platform</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredLogs.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-8 text-gray-500 italic">No activity logs found for the selected criteria.</TableCell>
                                    </TableRow>
                                )}
                                {filteredLogs.map(log => (
                                    <TableRow key={log.id} className="hover:bg-blue-50/30 transition-colors">
                                        <TableCell className="font-medium">{log.userName || log.userEmail}</TableCell>
                                        <TableCell>{log.activityDate}</TableCell>
                                        <TableCell>{format(new Date(log.sessionStart), 'hh:mm a')}</TableCell>
                                        <TableCell>{log.lastActivityAt ? format(new Date(log.lastActivityAt), 'hh:mm a') : '-'}</TableCell>
                                        <TableCell className="font-medium text-gray-700">{formatTime(log.durationSeconds)}</TableCell>
                                        <TableCell className="font-semibold text-green-600">{formatTime(log.activeSeconds)}</TableCell>
                                        <TableCell className="font-semibold text-amber-600">{formatTime(log.idleSeconds)}</TableCell>
                                        <TableCell className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded inline-block mt-2 ml-2">{log.deviceType}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}