import { supabase } from '../src/lib/supabaseClient';

// Helper to escape CSV fields for safe export
const escapeCsvField = (field) => {
    const str = String(field === null || field === undefined ? '' : field);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
};

// Helper to format currency consistently
const formatCurrency = (value) => {
  return (value || 0).toFixed(2);
};

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();    
    try {
        // Authenticate the request to ensure only authorized users can export
        if (!(await base44.auth.isAuthenticated())) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401, headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // Fetch all necessary data
        const [ledgerEntries, allUsers] = await Promise.all([
            base44.asServiceRole.entities.PaymentLedger.list('-billedDate'),
            supabase.from('User').select('*')
        ]);

        const userMap = new Map(allUsers.map(user => [user.email?.toLowerCase(), user]));

        // Function to get the full name, falling back to email if needed
        const getRealContractorName = (technicianEmail) => {
            const lowercasedEmail = technicianEmail?.toLowerCase();
            const user = userMap.get(lowercasedEmail);
            return user?.displayName || user?.full_name || (technicianEmail ? technicianEmail.split('@')[0].replace('.', ' ') : 'Unknown Contractor');
        };

        // Define CSV headers
        const headers = [
            'Technician Name',
            'Job',
            'Invoice #',
            'Billed Date',
            'Billed Amount',
            'Payment Amount',
            'Payment Date',
            'Outstanding Amount'
        ];

        // Map ledger data to CSV rows
        const csvRows = ledgerEntries.map(entry => {
            const billedAmount = entry.amount || 0;
            const paymentAmount = entry.payment || 0;
            const outstandingAmount = billedAmount - paymentAmount;

            const row = [
                getRealContractorName(entry.technicianEmail),
                entry.job,
                entry.invoiceNumber,
                entry.billedDate ? new Date(entry.billedDate).toLocaleDateString() : 'N/A',
                formatCurrency(billedAmount),
                formatCurrency(paymentAmount),
                entry.paymentDate ? new Date(entry.paymentDate).toLocaleDateString() : 'N/A',
                formatCurrency(outstandingAmount)
            ];
            return row.map(escapeCsvField).join(',');
        });

        // Combine headers and rows into a single CSV string
        const csvContent = [headers.join(','), ...csvRows].join('\n');

        // Return the CSV file as a downloadable response
        return new Response(csvContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': 'attachment; filename="payment_ledger.csv"'
            }
        });

    } catch (error) {
        console.error('Error exporting payment ledger:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
}
