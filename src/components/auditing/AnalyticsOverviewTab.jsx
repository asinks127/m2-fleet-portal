import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { format } from 'date-fns';

export default function AnalyticsOverviewTab({ audits, correctiveActions, settings }) {
    const deptData = useMemo(() => {
        if (!settings) return [];
        const depts = {};
        audits.forEach(a => {
            const d = a.responsibleDepartment || a.module || 'Unknown';
            if (!depts[d]) depts[d] = { dept: d, total: 0, completed: 0, completedOnTime: 0, scoreSum: 0, scoreCount: 0, timelineSum: 0 };
            
            depts[d].total++;
            
            const isCompleted = a.status === 'Completed' || a.status === 'Closed';
            const isEscalated = a.escalated;
            const isOverdue = a.status === 'Overdue' || (a.dueDate && new Date(a.dueDate) < new Date() && !isCompleted);
            
            if (isCompleted) {
                depts[d].completed++;
                const compDate = a.completedDate ? new Date(a.completedDate) : new Date();
                const dueDate = a.dueDate ? new Date(a.dueDate) : new Date();
                if (compDate <= dueDate) {
                    depts[d].completedOnTime++;
                    depts[d].timelineSum += settings.valueCompletedOnTime;
                } else {
                    depts[d].timelineSum += settings.valueCompletedLate;
                }
            } else if (isEscalated) {
                depts[d].timelineSum += settings.valueEscalated;
            } else if (isOverdue) {
                depts[d].timelineSum += settings.valueOverdue;
            } else {
                depts[d].timelineSum += settings.valueOpen;
            }

            if (typeof a.compliancePercentage === 'number') {
                depts[d].scoreSum += a.compliancePercentage;
                depts[d].scoreCount++;
            }
        });

        return Object.values(depts).map(d => {
            const avgAuditScore = d.scoreCount ? (d.scoreSum / d.scoreCount) : 100;
            const onTimeRate = d.total ? (d.completedOnTime / d.total) * 100 : 0;
            const timelineScore = d.total ? (d.timelineSum / d.total) : 100;

            const blendedCompliance = Math.round(
                (avgAuditScore * (settings.weightAuditScore / 100)) +
                (onTimeRate * (settings.weightOnTime / 100)) +
                (timelineScore * (settings.weightPenalty / 100))
            );

            return {
                name: d.dept,
                compliance: blendedCompliance,
                completionRate: Math.round((d.completed / d.total) * 100) || 0
            };
        });
    }, [audits, settings]);

    const trendData = useMemo(() => {
        const months = {};
        audits.forEach(a => {
            if (!a.dueDate && !a.created_date) return;
            const targetDate = new Date(a.dueDate || a.created_date);
            const m = format(targetDate, 'MMM yy');
            if (!months[m]) months[m] = { month: m, failed: 0, escalated: 0, needsReview: 0, timestamp: targetDate.getTime() };
            
            if (a.result === 'Fail') months[m].failed++;
            if (a.result === 'Needs Review') months[m].needsReview++;
            if (a.escalated) months[m].escalated++;
        });
        
        return Object.values(months).sort((a,b) => a.timestamp - b.timestamp);
    }, [audits]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Compliance by Department</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={deptData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" tick={{fontSize: 12}} />
                                <YAxis tick={{fontSize: 12}} />
                                <RechartsTooltip />
                                <Legend wrapperStyle={{fontSize: '12px'}} />
                                <Bar dataKey="compliance" name="Compliance %" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="completionRate" name="Completion Rate %" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Audit Failure Trends</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trendData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="month" tick={{fontSize: 12}} />
                                <YAxis tick={{fontSize: 12}} />
                                <RechartsTooltip />
                                <Legend wrapperStyle={{fontSize: '12px'}} />
                                <Line type="monotone" dataKey="failed" name="Failed" stroke="#ef4444" strokeWidth={2} dot={{r:4}} />
                                <Line type="monotone" dataKey="escalated" name="Escalated" stroke="#f59e0b" strokeWidth={2} dot={{r:4}} />
                                <Line type="monotone" dataKey="needsReview" name="Needs Review" stroke="#6366f1" strokeWidth={2} dot={{r:4}} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}