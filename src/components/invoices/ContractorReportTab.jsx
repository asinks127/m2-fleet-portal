import React, { useState } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { FileDown, Loader2, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import { format, subDays } from 'date-fns';

export default function ContractorReportTab() {
    const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const { data } = await (await fetch('/api/exportContractorInvoicesReport', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                startDate,
                endDate
            }) })).json();

            const blob = new Blob([data], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Contractor_Invoices_Report_${startDate}_to_${endDate}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            
        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to generate report. Please try again.');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="p-6">
            <Card className="max-w-2xl mx-auto">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileDown className="w-6 h-6 text-blue-600" />
                        Contractor Invoices Report
                    </CardTitle>
                    <CardDescription>
                        Generate a CSV report of invoices submitted within a date range. 
                        Includes all active and inactive technicians, sorted alphabetically.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                <Calendar className="w-4 h-4" /> Start Date
                            </Label>
                            <Input 
                                type="date" 
                                value={startDate} 
                                onChange={(e) => setStartDate(e.target.value)} 
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                <Calendar className="w-4 h-4" /> End Date
                            </Label>
                            <Input 
                                type="date" 
                                value={endDate} 
                                onChange={(e) => setEndDate(e.target.value)} 
                            />
                        </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800">
                        <p className="font-medium mb-1">Report Details:</p>
                        <ul className="list-disc list-inside space-y-1 ml-1">
                            <li>Includes invoices from <strong>ALL</strong> technicians (Active & Inactive).</li>
                            <li>Filtered by <strong>Submission Date</strong>.</li>
                            <li>Sorted <strong>Alphabetically</strong> by Contractor Name.</li>
                            <li>Format: <strong>CSV</strong> (Excel compatible).</li>
                        </ul>
                    </div>

                    <Button 
                        onClick={handleExport} 
                        disabled={isExporting} 
                        className="w-full md:w-auto"
                        size="lg"
                    >
                        {isExporting ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Generating Report...
                            </>
                        ) : (
                            <>
                                <FileDown className="w-4 h-4 mr-2" />
                                Download CSV Report
                            </>
                        )}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}