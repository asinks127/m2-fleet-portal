import React, { useState, useEffect } from 'react';
import { exportEmergencyContacts } from '@/functions.js';
import { supabase } from '@/lib/supabaseClient.js';
import { Button } from '@/components/ui/button.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.jsx';
import { Loader2, AlertCircle, Download, PhoneCall } from 'lucide-react';

export default function EmergencyContactReport() {
    const [contractors, setContractors] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadContractors();
    }, []);

    const loadContractors = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const { data: allUsers, error } = await supabase
              .from('User')
              .select('*')
              .eq('active', true);

            if (error) throw error;

            const activeContractors = (allUsers || []).filter(user =>
                user.email && (
                    user.email.toLowerCase().includes('.contractor@m2fleetcom.com') ||
                    user.email.toLowerCase().includes('.contractor@smcinstallations.com')
                )
            );
            setContractors(activeContractors);
        } catch (err) {
            console.error('Failed to load contractors:', err);
            setError('Could not load contractor data. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleExport = async () => {
        setIsExporting(true);
        try {
            // Check if export function exists, otherwise just do basic CSV generation from state
            if (typeof exportEmergencyContacts === 'function') {
                const response = await exportEmergencyContacts();
                const blob = new Blob([response.data || response], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'emergency_contacts.csv';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                a.remove();
            } else {
               // Fallback client-side export
               const headers = ['Technician', 'Technician Phone', 'Emergency Contact', 'Emergency Phone', 'Emergency Email'];
               const rows = contractors.map(u => [
                  u.displayName || u.full_name || 'N/A',
                  u.phone || 'N/A',
                  u.emergencyContactName || 'N/A',
                  u.emergencyContactPhone || 'N/A',
                  u.emergencyContactEmail || 'N/A'
               ]);
               const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
               const blob = new Blob([csvContent], { type: 'text/csv' });
               const url = window.URL.createObjectURL(blob);
               const a = document.createElement('a');
               a.href = url;
               a.download = 'emergency_contacts.csv';
               document.body.appendChild(a);
               a.click();
               window.URL.revokeObjectURL(url);
               a.remove();
            }
        } catch (err) {
            console.error('Failed to export CSV:', err);
            setError('Could not export the report. Please try again.');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="p-6 space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-2xl">
                          <PhoneCall className="w-6 h-6" />
                          Emergency Contact List
                        </CardTitle>
                        <CardDescription>A report of all active technicians and their emergency contacts.</CardDescription>
                    </div>
                    <Button onClick={handleExport} disabled={isExporting}>
                        {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Download className="w-4 h-4 mr-2" />}
                        {isExporting ? 'Exporting...' : 'Export CSV'}
                    </Button>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center items-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                        </div>
                    ) : error ? (
                        <div className="text-center py-12 text-red-600">
                            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                            <p>{error}</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto border rounded-lg">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Technician</TableHead>
                                        <TableHead>Technician Phone</TableHead>
                                        <TableHead>Emergency Contact</TableHead>
                                        <TableHead>Emergency Phone</TableHead>
                                        <TableHead>Emergency Email</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {contractors.length > 0 ? contractors.map(user => (
                                        <TableRow key={user.id}>
                                            <TableCell className="font-medium">{user.displayName || user.full_name || 'N/A'}</TableCell>
                                            <TableCell>{user.phone || 'N/A'}</TableCell>
                                            <TableCell className="font-medium text-red-700">{user.emergencyContactName || 'N/A'}</TableCell>
                                            <TableCell className="text-red-700">{user.emergencyContactPhone || 'N/A'}</TableCell>
                                            <TableCell className="text-red-700">{user.emergencyContactEmail || 'N/A'}</TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-24 text-center">No active contractors found.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}