import React, { useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function AnalyticsEntitiesTab({ audits, correctiveActions }) {
    const contractorStats = useMemo(() => {
        const stats = {};
        audits.forEach(a => {
            if (a.relatedContractorId) {
                const id = a.relatedContractorId; // In reality, you'd join with User to get name
                if (!stats[id]) stats[id] = { id, audits: 0, failures: 0, cas: 0, scores: [] };
                stats[id].audits++;
                if (a.result === 'Fail') stats[id].failures++;
                if (typeof a.compliancePercentage === 'number') stats[id].scores.push(a.compliancePercentage);
            }
        });
        
        correctiveActions.forEach(ca => {
            const audit = audits.find(a => a.id === ca.auditId);
            if (audit && audit.relatedContractorId) {
                if (stats[audit.relatedContractorId]) stats[audit.relatedContractorId].cas++;
            }
        });

        return Object.values(stats).sort((a,b) => b.audits - a.audits);
    }, [audits, correctiveActions]);

    const projectStats = useMemo(() => {
        const stats = {};
        audits.forEach(a => {
            if (a.relatedProjectId) {
                const id = a.relatedProjectId;
                if (!stats[id]) stats[id] = { id, audits: 0, failures: 0, cas: 0, scores: [] };
                stats[id].audits++;
                if (a.result === 'Fail') stats[id].failures++;
                if (typeof a.compliancePercentage === 'number') stats[id].scores.push(a.compliancePercentage);
            }
        });
        
        correctiveActions.forEach(ca => {
            const audit = audits.find(a => a.id === ca.auditId);
            if (audit && audit.relatedProjectId) {
                if (stats[audit.relatedProjectId]) stats[audit.relatedProjectId].cas++;
            }
        });

        return Object.values(stats).sort((a,b) => b.audits - a.audits);
    }, [audits, correctiveActions]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 bg-gray-50 border-b font-semibold">Contractor History</div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Contractor Reference</TableHead>
                            <TableHead className="text-right">Audits</TableHead>
                            <TableHead className="text-right">Avg Score</TableHead>
                            <TableHead className="text-right">CAs</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {contractorStats.map((s, i) => (
                            <TableRow key={i}>
                                <TableCell className="font-medium text-xs text-gray-500 truncate max-w-[150px]">{s.id}</TableCell>
                                <TableCell className="text-right">{s.audits}</TableCell>
                                <TableCell className="text-right font-medium">{s.scores.length ? Math.round(s.scores.reduce((a,b)=>a+b,0)/s.scores.length) + '%' : '-'}</TableCell>
                                <TableCell className="text-right text-orange-600 font-semibold">{s.cas}</TableCell>
                            </TableRow>
                        ))}
                        {contractorStats.length === 0 && (
                            <TableRow><TableCell colSpan={4} className="text-center py-8 text-gray-500">No contractor-linked audits found.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 bg-gray-50 border-b font-semibold">Project History</div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Project Reference</TableHead>
                            <TableHead className="text-right">Audits</TableHead>
                            <TableHead className="text-right">Avg Score</TableHead>
                            <TableHead className="text-right">CAs</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {projectStats.map((s, i) => (
                            <TableRow key={i}>
                                <TableCell className="font-medium text-xs text-gray-500 truncate max-w-[150px]">{s.id}</TableCell>
                                <TableCell className="text-right">{s.audits}</TableCell>
                                <TableCell className="text-right font-medium">{s.scores.length ? Math.round(s.scores.reduce((a,b)=>a+b,0)/s.scores.length) + '%' : '-'}</TableCell>
                                <TableCell className="text-right text-orange-600 font-semibold">{s.cas}</TableCell>
                            </TableRow>
                        ))}
                        {projectStats.length === 0 && (
                            <TableRow><TableCell colSpan={4} className="text-center py-8 text-gray-500">No project-linked audits found.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}