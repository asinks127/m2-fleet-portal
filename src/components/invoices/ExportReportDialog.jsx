import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Loader2, FileDown } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import { format, subDays } from 'date-fns';

export default function ExportReportDialog({ isOpen, onClose, contractor }) {
    const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async () => {
        if (!contractor) return;

        setIsExporting(true);
        try {
            const { data } = await (await fetch('/api/exportContractorReport', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                contractorId: contractor.id,
                startDate,
                endDate
            }) })).json();

            // The function returns arraybuffer for the PDF
            const blob = new Blob([data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Statement_${contractor.displayName || 'Contractor'}_${startDate}_to_${endDate}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            
            onClose();
        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to generate report. Please try again.');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>Export Contractor Statement</DialogTitle>
                    <DialogDescription>
                        Generate a PDF statement of all invoices (Paid, Open, Pending) for {contractor?.displayName}.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Start Date</Label>
                        <Input 
                            type="date" 
                            value={startDate} 
                            onChange={(e) => setStartDate(e.target.value)} 
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>End Date</Label>
                        <Input 
                            type="date" 
                            value={endDate} 
                            onChange={(e) => setEndDate(e.target.value)} 
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isExporting}>
                        Cancel
                    </Button>
                    <Button onClick={handleExport} disabled={isExporting}>
                        {isExporting ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <FileDown className="w-4 h-4 mr-2" />
                                Export PDF
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}