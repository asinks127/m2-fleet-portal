import { supabase } from '../src/lib/supabaseClient';

import { format } from 'npm:date-fns@2.30.0';

// Helper to escape CSV fields
const escapeCsvField = (field) => {
    const str = String(field === null || field === undefined ? '' : field);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
};

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();    
    try {
        if (!(await base44.auth.isAuthenticated())) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401, headers: { 'Content-Type': 'application/json' }
            });
        }
        
        const { startDate, endDate } = req.body;

        if (!startDate || !endDate) {
            return new Response(JSON.stringify({ error: 'Start date and end date are required.' }), {
                status: 400, headers: { 'Content-Type': 'application/json' }
            });
        }

        const [allUsers, invoicesForPeriod] = await Promise.all([
            supabase.from('User').select('*'),
            base44.asServiceRole.entities.Invoice.list('-created_date', 5000)
        ]);

        const activeContractors = allUsers.filter(user => 
            user.active !== false && 
            user.email && 
            (user.email.toLowerCase().includes('.contractor@m2fleetcom.com') || 
             user.email.toLowerCase().includes('.contractor@smcinstallations.com'))
        );

        // FIXED: Filter by submission date (created_date) not weekEndingDate
        const invoicesInPeriod = invoicesForPeriod.filter(inv => {
            if (!inv.created_date) return false;
            const submittedDate = new Date(inv.created_date);
            if (isNaN(submittedDate.getTime())) return false; // Use getTime() to check for valid date object
            return submittedDate >= new Date(startDate) && submittedDate <= new Date(endDate);
        });

        const submittedEmails = new Set(invoicesInPeriod.map(inv => inv.contractorEmail.toLowerCase()));
        
        const nonCompliant = activeContractors.filter(
            contractor => !submittedEmails.has(contractor.email.toLowerCase())
        );

        const csvData = [];
        
        // Headers
        csvData.push([
            'Status',
            'Technician Name',
            'Business',
            'Project',
            'QC Assignment',
            'Invoice Submitted Date',
            'Invoice Amount',
            'Invoice Status'
        ]);

        // Submitted Invoices
        invoicesInPeriod.forEach(invoice => {
            const contractor = activeContractors.find(c => c.email.toLowerCase() === invoice.contractorEmail.toLowerCase());
            csvData.push([
                'Compliant',
                invoice.contractorName,
                contractor?.business || 'N/A',
                contractor?.project || 'N/A',
                contractor?.qcAssignment || 'N/A',
                format(new Date(invoice.created_date), 'yyyy-MM-dd'),
                invoice.totalAmount || 0,
                invoice.status
            ]);
        });

        // Non-compliant Contractors
        nonCompliant.forEach(contractor => {
            csvData.push([
                'Non-Compliant',
                contractor.displayName || contractor.full_name,
                contractor.business || 'N/A',
                contractor.project || 'N/A',
                contractor.qcAssignment || 'N/A',
                'N/A',
                'N/A',
                'Missing'
            ]);
        });
        
        const csvContent = csvData.map(row => 
            row.map(field => escapeCsvField(field)).join(',')
        ).join('\n');

        return new Response(csvContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="invoice-compliance-report-${endDate}.csv"`
            }
        });

    } catch (error) {
        console.error('Error exporting compliance report:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
}
