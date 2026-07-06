import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, AlertTriangle, CheckCircle, Clock, TrendingDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

import { differenceInDays, isAfter } from 'date-fns';

export default function ExecutiveComplianceDashboard() {
    const { data: audits = [], isLoading: loadingAudits } = useQuery({ queryKey: ['audits'], queryFn: () => base44.entities.AuditRecord.filter({}) });
    const { data: correctiveActions = [] } = useQuery({ queryKey: ['correctiveActions'], queryFn: () => base44.entities.CorrectiveAction.filter({}) });
    const { data: settingsList = [], isLoading: loadingSettings } = useQuery({ queryKey: ['auditSettings'], queryFn: () => base44.entities.AuditSystemSetting.filter({}) });
    const { data: responses = [] } = useQuery({ queryKey: ['auditResponses'], queryFn: () => base44.entities.AuditResponse.filter({}) });
    const { data: templateItems = [] } = useQuery({ queryKey: ['auditTemplateItems'], queryFn: () => base44.entities.AuditTemplateItem.filter({}) });
    
    const settings = settingsList[0] || {
        passThreshold: 90, needsReviewThreshold: 80,
        weightAuditScore: 50, weightOnTime: 30, weightPenalty: 20,
        valueCompletedOnTime: 100, valueCompletedLate: 75, valueOpen: 50, valueOverdue: 25, valueEscalated: 0,
        riskModerate: 80, riskHigh: 70, repeatFailureCount: 3, repeatFailureDays: 60
    };
    
    const isLoading = loadingAudits || loadingSettings;

    const kpis = useMemo(() => {
        const completedWithScore = audits.filter(a => typeof a.compliancePercentage === 'number');
        const avgScore = completedWithScore.length ? Math.round(completedWithScore.reduce((sum, a) => sum + a.compliancePercentage, 0) / completedWithScore.length) : 0;
        
        const overdue = audits.filter(a => a.status === 'Overdue').length;
        const escalated = audits.filter(a => a.escalated).length;
        const openCAs = correctiveActions.filter(ca => ca.status === 'Open' || ca.status === 'In Progress');
        const overdueCAs = openCAs.filter(ca => ca.dueDate && new Date(ca.dueDate) < new Date());
        
        return { avgScore, overdue, escalated, openCAs: openCAs.length, overdueCAs: overdueCAs.length };
    }, [audits, correctiveActions]);

    const topRisks = useMemo(() => {
        const depts = {};
        audits.forEach(a => {
            const d = a.responsibleDepartment || a.module || 'Unknown';
            if (!depts[d]) depts[d] = { name: d, total: 0, completedOnTime: 0, scoreSum: 0, scoreCount: 0, timelineSum: 0 };
            depts[d].total++;
            
            const isCompleted = a.status === 'Completed' || a.status === 'Closed';
            if (isCompleted) {
                const compDate = a.completedDate ? new Date(a.completedDate) : new Date();
                const dueDate = a.dueDate ? new Date(a.dueDate) : new Date();
                if (compDate <= dueDate) {
                    depts[d].completedOnTime++;
                    depts[d].timelineSum += settings.valueCompletedOnTime;
                } else {
                    depts[d].timelineSum += settings.valueCompletedLate;
                }
            } else if (a.escalated) depts[d].timelineSum += settings.valueEscalated;
            else if (a.status === 'Overdue' || (a.dueDate && new Date(a.dueDate) < new Date())) depts[d].timelineSum += settings.valueOverdue;
            else depts[d].timelineSum += settings.valueOpen;

            if (typeof a.compliancePercentage === 'number') {
                depts[d].scoreSum += a.compliancePercentage;
                depts[d].scoreCount++;
            }
        });
        
        return Object.values(depts)
            .map(d => {
                const avgAuditScore = d.scoreCount ? (d.scoreSum / d.scoreCount) : 100;
                const onTimeRate = d.total ? (d.completedOnTime / d.total) * 100 : 0;
                const timelineScore = d.total ? (d.timelineSum / d.total) : 100;
                const blended = Math.round((avgAuditScore * (settings.weightAuditScore/100)) + (onTimeRate * (settings.weightOnTime/100)) + (timelineScore * (settings.weightPenalty/100)));
                
                let riskLevel = 'Low Risk';
                let fill = '#10b981';
                if (blended < settings.riskHigh) { riskLevel = 'Critical Risk'; fill = '#ef4444'; }
                else if (blended < settings.riskModerate) { riskLevel = 'High Risk'; fill = '#f97316'; }
                else if (blended < settings.passThreshold) { riskLevel = 'Moderate Risk'; fill = '#eab308'; }

                return { name: d.name, compliance: blended, riskLevel, fill };
            })
            .sort((a, b) => a.compliance - b.compliance)
            .slice(0, 5); 
    }, [audits, settings]);

    const repeatFailures = useMemo(() => {
        const failures = {};
        const today = new Date();
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - settings.repeatFailureDays);

        responses.forEach(r => {
            const audit = audits.find(a => a.id === r.auditId);
            if (!audit || !audit.completedDate) return;
            const completed = new Date(audit.completedDate);
            if (isAfter(completed, cutoff)) {
                const val = (r.responseValue || '').toLowerCase();
                if (val === 'fail' || val === 'no' || val === 'needs review') {
                    failures[r.itemId] = (failures[r.itemId] || 0) + 1;
                }
            }
        });

        return Object.entries(failures)
            .filter(([_, count]) => count >= settings.repeatFailureCount)
            .map(([itemId, count]) => {
                const item = templateItems.find(i => i.id === itemId);
                return { question: item ? item.question : 'Unknown Item', count };
            })
            .sort((a,b) => b.count - a.count);
    }, [responses, audits, templateItems, settings]);

    if (isLoading) return <div className="p-8 text-center text-gray-500 flex flex-col items-center"><Shield className="w-8 h-8 animate-pulse text-indigo-500 mb-4" /> Loading Executive View...</div>;

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Executive Compliance Dashboard</h1>
                <p className="text-gray-500 mt-1">High-level visibility into operational compliance and systemic risks.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="bg-gradient-to-br from-indigo-600 to-blue-700 text-white shadow-xl border-0">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-blue-100 text-sm font-medium">Overall Compliance</p>
                                <h3 className="text-4xl font-extrabold mt-2">{kpis.avgScore}%</h3>
                            </div>
                            <Shield className="w-10 h-10 text-blue-200/50" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-md">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-gray-500 text-sm font-medium">Overdue Audits</p>
                                <h3 className="text-3xl font-bold mt-2 text-yellow-600">{kpis.overdue}</h3>
                            </div>
                            <Clock className="w-8 h-8 text-yellow-500/50" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-md">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-gray-500 text-sm font-medium">Escalated Audits</p>
                                <h3 className="text-3xl font-bold mt-2 text-red-600">{kpis.escalated}</h3>
                            </div>
                            <AlertTriangle className="w-8 h-8 text-red-500/50" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-md">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-gray-500 text-sm font-medium">Corrective Action Risk</p>
                                <h3 className="text-3xl font-bold mt-2 text-orange-600">{kpis.openCAs} <span className="text-sm font-normal text-gray-500">Open</span></h3>
                                {kpis.overdueCAs > 0 && <p className="text-xs text-red-600 font-semibold mt-1">{kpis.overdueCAs} Overdue</p>}
                            </div>
                            <TrendingDown className="w-8 h-8 text-orange-500/50" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="shadow-md border-t-4 border-t-red-500">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                            Top Operational Risks (Lowest Compliance)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={topRisks} layout="vertical" margin={{ left: 40, right: 20, top: 20, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" domain={[0, 100]} />
                                    <YAxis dataKey="name" type="category" width={140} tick={{fill: '#4b5563', fontSize: 12, fontWeight: 500}} />
                                    <RechartsTooltip cursor={{fill: '#f3f4f6'}} content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            return (
                                                <div className="bg-white p-2 border shadow text-sm rounded">
                                                    <p className="font-semibold">{data.name}</p>
                                                    <p>Compliance: {data.compliance}%</p>
                                                    <p className="font-medium" style={{color: data.fill}}>{data.riskLevel}</p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }} />
                                    <Bar dataKey="compliance" name="Compliance %" radius={[0, 4, 4, 0]} barSize={30}>
                                        {topRisks.map((entry, index) => (
                                            <cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-md border-t-4 border-t-orange-500 overflow-hidden flex flex-col">
                    <CardHeader className="bg-orange-50/50">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <AlertTriangle className="w-5 h-5 text-orange-500" />
                            Systemic Issues: Repeat Failures
                        </CardTitle>
                        <p className="text-xs text-gray-500">Items failed {settings.repeatFailureCount}+ times in the last {settings.repeatFailureDays} days.</p>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 overflow-auto">
                        {repeatFailures.length > 0 ? (
                            <div className="divide-y">
                                {repeatFailures.map((rf, i) => (
                                    <div key={i} className="p-4 flex items-center justify-between hover:bg-gray-50">
                                        <p className="text-sm font-medium text-gray-900 pr-4">{rf.question}</p>
                                        <span className="shrink-0 bg-red-100 text-red-700 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                                            {rf.count} Failures
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 text-center text-gray-500 text-sm">
                                <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2 opacity-50" />
                                No repeat failures detected in this period.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}