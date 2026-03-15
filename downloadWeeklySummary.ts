import { supabase } from '../src/lib/supabaseClient';

import { format, startOfWeek, endOfWeek, subWeeks } from 'npm:date-fns@2.30.0';

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

        console.log('Generating weekly summary CSV download...');
        
        // Get date range for last week (Sunday to Saturday)
        const today = new Date();
        const lastWeekDate = subWeeks(today, 1);
        const weekStart = startOfWeek(lastWeekDate, { weekStartsOn: 0 }); // Start of the last week (Sunday 00:00:00.000)
        const weekEnd = endOfWeek(lastWeekDate, { weekStartsOn: 0 });   // End of the last week (Saturday 23:59:59.999)
        
        // FIXED: Filter by submission date (created_date) instead of weekEndingDate
        const [allUsers, fetchedInvoices] = await Promise.all([
            supabase.from('User').select('*'),
            base44.asServiceRole.entities.Invoice.list('-created_date', 2000) // Fetch recent invoices, assuming 2000 is enough to cover a week
        ]);

        const invoicesInPeriod = fetchedInvoices.filter(inv => {
            if (!inv.created_date) return false;
            const submittedDate = new Date(inv.created_date);
            if (isNaN(submittedDate.getTime())) return false; // Check for invalid date
            return submittedDate >= weekStart && submittedDate <= weekEnd;
        });

        const activeContractors = allUsers.filter(user => 
            user.active !== false && 
            user.email && 
            (user.email.toLowerCase().includes('.contractor@m2fleetcom.com') || 
             user.email.toLowerCase().includes('.contractor@smcinstallations.com'))
        );

        const submittedEmails = new Set(invoicesInPeriod.map(inv => inv.contractorEmail.toLowerCase()));
        
        const missingContractors = activeContractors.filter(
            contractor => !submittedEmails.has(contractor.email?.toLowerCase())
        );

        const pending = invoicesInPeriod.filter(inv => inv.status === 'pending');
        const approved = invoicesInPeriod.filter(inv => inv.status === 'approved');
        
        // Prepare CSV data
        const csvData = [];
        
        // Summary section
        csvData.push(['WEEKLY INVOICE SUMMARY']);
        csvData.push([`Report Period: ${format(weekStart, 'MMM d, yyyy')} - ${format(weekEnd, 'MMM d, yyyy')}`]);
        csvData.push([`Generated: ${format(new Date(), 'MMM d, yyyy h:mm a')}`]);
        csvData.push(['']);
        
        // Summary stats
        csvData.push(['SUMMARY STATISTICS']);
        csvData.push(['Metric', 'Count', 'Total Amount']);
        csvData.push(['Active Contractors', activeContractors.length, '']);
        csvData.push(['Contractors Who Submitted', submittedEmails.size, '']);
        csvData.push(['Missing Submissions', missingContractors.length, '']);
        csvData.push(['Approved Invoices', approved.length, `$${approved.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0).toLocaleString()}`]);
        csvData.push(['Pending Invoices', pending.length, `$${pending.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0).toLocaleString()}`]);
        csvData.push(['']);
        
        // Approved invoices detail
        csvData.push(['APPROVED INVOICES']);
        csvData.push(['Contractor Name', 'Business', 'Project', 'Amount', 'Approved Date', 'Auto-Approved']);
        approved.forEach(inv => {
            const contractor = activeContractors.find(c => c.email.toLowerCase() === inv.contractorEmail.toLowerCase());
            csvData.push([
                inv.contractorName,
                contractor?.business || 'N/A',
                contractor?.project || 'N/A',
                `$${(inv.totalAmount || 0).toLocaleString()}`,
                inv.approvedDate ? format(new Date(inv.approvedDate), 'MMM d, yyyy') : 'N/A',
                inv.autoApproved ? 'Yes' : 'No'
            ]);
        });
        csvData.push(['']);
        
        // Pending invoices detail
        csvData.push(['PENDING INVOICES']);
        csvData.push(['Contractor Name', 'Business', 'Project', 'Amount', 'Submitted Date', 'Pending Reason']);
        pending.forEach(inv => {
            const contractor = activeContractors.find(c => c.email.toLowerCase() === inv.contractorEmail.toLowerCase());
            csvData.push([
                inv.contractorName,
                contractor?.business || 'N/A',
                contractor?.project || 'N/A',
                `$${(inv.totalAmount || 0).toLocaleString()}`,
                format(new Date(inv.created_date), 'MMM d, yyyy'),
                inv.pendingReason || 'Manual review required'
            ]);
        });
        csvData.push(['']);
        
        // Missing contractors
        csvData.push(['CONTRACTORS NOT SUBMITTED']);
        csvData.push(['Contractor Name', 'Business', 'Project', 'QC Assignment', 'Weekly Pay']);
        missingContractors.forEach(contractor => {
            csvData.push([
                contractor.displayName || contractor.full_name || 'N/A',
                contractor.business || 'N/A',
                contractor.project || 'N/A',
                contractor.qcAssignment || 'N/A',
                contractor.weeklyPay ? `$${contractor.weeklyPay}` : 'N/A'
            ]);
        });
        
        // Convert to CSV format
        const csvContent = csvData.map(row => 
            row.map(field => escapeCsvField(field)).join(',')
        ).join('\n');

        return new Response(csvContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="weekly-invoice-summary-${format(weekEnd, 'yyyy-MM-dd')}.csv"`
            }
        });

    } catch (error) {
        console.error('Error generating weekly summary CSV:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
}
