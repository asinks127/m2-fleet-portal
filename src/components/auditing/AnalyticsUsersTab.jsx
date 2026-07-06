import React, { useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { differenceInDays } from 'date-fns';

export default function AnalyticsUsersTab({ audits, settings }) {
    const userStats = useMemo(() => {
        if (!settings) return [];
        const users = {};
        const today = new Date();
        audits.forEach(a => {
            const u = a.assignedAuditor || 'Unassigned';
            if (!users[u]) users[u] = { user: u, total: 0, completed: 0, overdue: 0, escalated: 0, overdueIn30Days: 0 };
            users[u].total++;
            
            const isCompleted = a.status === 'Completed' || a.status === 'Closed';
            if (isCompleted) users[u].completed++;
            if (a.status === 'Overdue') {
                users[u].overdue++;
                if (a.dueDate && differenceInDays(today, new Date(a.dueDate)) <= settings.userAtRiskDays) {
                    users[u].overdueIn30Days++;
                }
            }
            if (a.escalated) users[u].escalated++;
        });

        return Object.values(users).map(u => {
            const completionRate = u.total > 0 ? (u.completed / u.total) * 100 : 0;
            const isAtRisk = u.total > 0 && (completionRate < settings.userAtRiskCompletionRate || u.overdueIn30Days >= settings.userAtRiskOverdueCount);
            return { ...u, completionRate, isAtRisk };
        }).sort((a,b) => b.total - a.total);
    }, [audits, settings]);

    return (
        <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
            <Table>
                <TableHeader className="bg-gray-50">
                    <TableRow>
                        <TableHead>Auditor / Owner</TableHead>
                        <TableHead className="text-right">Total Assigned</TableHead>
                        <TableHead className="text-right">Completed</TableHead>
                        <TableHead className="text-right">Completion Rate</TableHead>
                        <TableHead className="text-right">Overdue</TableHead>
                        <TableHead className="text-right">Escalations</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {userStats.map(u => (
                        <TableRow key={u.user} className={u.isAtRisk ? 'bg-red-50/50' : ''}>
                            <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                    {u.user}
                                    {u.isAtRisk && <Badge variant="destructive" className="text-[10px] py-0 h-4"><AlertTriangle className="w-3 h-3 mr-1"/>At Risk</Badge>}
                                </div>
                            </TableCell>
                            <TableCell className="text-right">{u.total}</TableCell>
                            <TableCell className="text-right">{u.completed}</TableCell>
                            <TableCell className="text-right font-semibold text-blue-600">{Math.round(u.completionRate)}%</TableCell>
                            <TableCell className={`text-right font-semibold ${u.overdue > 0 ? 'text-yellow-600' : 'text-gray-500'}`}>{u.overdue}</TableCell>
                            <TableCell className={`text-right font-semibold ${u.escalated > 0 ? 'text-red-600' : 'text-gray-500'}`}>{u.escalated}</TableCell>
                        </TableRow>
                    ))}
                    {userStats.length === 0 && (
                        <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-500">No auditor data found.</TableCell></TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}