import { supabase, getAuthUser } from './_lib/supabaseServer.js';
import { format } from 'date-fns';

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    try {        const user = await getAuthUser(req);

        if (!user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { startDate, endDate } = req.body;
        
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Start and End dates are required' });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        // Fetch all users (active and inactive) to map emails to names
        // Fetching in batches if necessary, but assuming < 2000 for now or using list without limit if possible.
        // default limit is usually 50. Let's ask for more.
        let allUsers = [];
        let page = 0;
        let hasMore = true;
        while(hasMore && page < 10) { // Safety break
             const users = await supabase.from('User').select('*').order('created_date', { ascending: false }).range(page * 1000, page * 1000 + 1000 - 1).then(r => r.data || []);
             allUsers = [...allUsers, ...users];
             if(users.length < 1000) hasMore = false;
             page++;
        }

        const userMap = new Map();
        allUsers.forEach(u => {
            const email = u.email?.toLowerCase();
            if (email) {
                userMap.set(email, {
                    name: u.displayName || u.full_name || 'Unknown',
                    business: u.business || ''
                });
            }
        });

        // Fetch invoices
        // We'll fetch a large number sorted by date to ensure we cover the range.
        // Ideally we would filter by date in the query, but to ensure we get "ALL" statuses and types,
        // and given we need to filter locally if the date query isn't perfect, let's fetch a good chunk.
        // If the date range is old, this simple list might miss them if we only fetch recent.
        // A better approach for a report is to filter by date in the database if possible.
        // Assuming .filter supports basic operators or we have to fetch all.
        // Let's try to fetch all invoices.
        let allInvoices = [];
        page = 0;
        hasMore = true;
        while(hasMore && page < 20) { // Cap at 20k invoices for safety
             const invoices = await supabase.from('Invoice').select('*').order('created_date', { ascending: false }).range(page * 1000, page * 1000 + 1000 - 1).then(r => r.data || []);
             allInvoices = [...allInvoices, ...invoices];
             if(invoices.length < 1000) hasMore = false;
             page++;
        }

        const filteredInvoices = allInvoices.filter(inv => {
            if (!inv.created_date) return false;
            const created = new Date(inv.created_date);
            return created >= start && created <= end;
        });

        // Enrich with contractor names
        const enriched = filteredInvoices.map(inv => {
            const email = inv.contractorEmail?.toLowerCase();
            const userInfo = userMap.get(email) || { name: inv.contractorName || 'Unknown', business: inv.businessName || '' };
            return {
                ...inv,
                contractorName: userInfo.name,
                businessName: userInfo.business,
                contractorEmail: email
            };
        });

        // Sort alphabetically by contractor name, then by date
        enriched.sort((a, b) => {
            const nameCompare = (a.contractorName || '').localeCompare(b.contractorName || '');
            if (nameCompare !== 0) return nameCompare;
            return new Date(a.created_date) - new Date(b.created_date);
        });

        // Generate CSV
        // Helper to escape CSV fields
        const escape = (field) => {
            if (field === null || field === undefined) return '';
            const stringField = String(field);
            if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
                return `"${stringField.replace(/"/g, '""')}"`;
            }
            return stringField;
        };

        const header = ['Contractor Name', 'Business Name', 'Email', 'Submission Date', 'Invoice Date', 'Week Ending', 'Amount', 'Status', 'Payment Status', 'File Name'];
        
        const rows = enriched.map(inv => [
            escape(inv.contractorName),
            escape(inv.businessName),
            escape(inv.contractorEmail),
            escape(format(new Date(inv.created_date), 'yyyy-MM-dd HH:mm')),
            escape(inv.invoiceDate),
            escape(inv.weekEndingDate),
            escape(inv.totalAmount || 0),
            escape(inv.status),
            escape(inv.paymentStatus),
            escape(inv.fileName)
        ]);

        const csvContent = [header.join(','), ...rows.map(r => r.join(','))].join('\n');

        return new Response(csvContent, {
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="Contractor_Invoices_Report_${startDate}_${endDate}.csv"`
            }
        });

    } catch (error) {
        console.error("Export error:", error);
        return res.status(500).json({ error: "An unexpected error occurred. Please try again later." });
    }
}
