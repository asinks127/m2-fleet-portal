import { supabase, getAuthUser } from './_lib/supabaseServer.js';

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
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });    
    try {
        // Authenticate the request to ensure only authorized users can export
        if (!(await getAuthUser(req))) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        // Fetch all necessary data
        const [ledgerResult, usersResult] = await Promise.all([
            supabase.from('PaymentLedger').select('*').order('billedDate', { ascending: false }),
            supabase.from('User').select('*')
        ]);
        const ledgerEntries = ledgerResult.data || [];
        const allUsers = usersResult.data || [];

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
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="payment_ledger.csv"');
        return res.status(200).send(csvContent);

    } catch (error) {
        console.error('Error exporting payment ledger:', error);
        return res.status(500).json({ error: "An unexpected error occurred. Please try again later." });
    }
}
