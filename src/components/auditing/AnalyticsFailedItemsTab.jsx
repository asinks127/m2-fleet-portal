import React, { useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function AnalyticsFailedItemsTab({ responses, templateItems, audits }) {
    const failedStats = useMemo(() => {
        const failures = {};
        const auditIds = new Set(audits.map(a => a.id));
        
        responses.forEach(r => {
            if (!auditIds.has(r.auditId)) return; // Only include responses for filtered audits
            
            const val = (r.responseValue || '').toLowerCase();
            if (val === 'fail' || val === 'no' || val === 'needs review') {
                if (!failures[r.itemId]) failures[r.itemId] = { itemId: r.itemId, count: 0 };
                failures[r.itemId].count++;
            }
        });

        // Map to item text
        return Object.values(failures).map(f => {
            const item = templateItems.find(i => i.id === f.itemId);
            return {
                question: item ? item.question : 'Unknown Question',
                section: item ? item.sectionName : '-',
                count: f.count
            };
        }).sort((a,b) => b.count - a.count);

    }, [responses, templateItems, audits]);

    return (
        <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 bg-red-50 border-b">
                <h3 className="text-red-800 font-semibold">Most Frequently Failed Items</h3>
                <p className="text-sm text-red-600">Identify systemic issues by reviewing which checklist items fail most often.</p>
            </div>
            <Table>
                <TableHeader className="bg-gray-50">
                    <TableRow>
                        <TableHead>Checklist Item</TableHead>
                        <TableHead>Section</TableHead>
                        <TableHead className="text-right">Failure Count</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {failedStats.map((f, i) => (
                        <TableRow key={i}>
                            <TableCell className="font-medium">{f.question}</TableCell>
                            <TableCell className="text-gray-500">{f.section}</TableCell>
                            <TableCell className="text-right text-red-600 font-semibold">{f.count}</TableCell>
                        </TableRow>
                    ))}
                    {failedStats.length === 0 && (
                        <TableRow><TableCell colSpan={3} className="text-center py-8 text-gray-500">No failed items recorded in this view.</TableCell></TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}