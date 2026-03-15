import { supabase, getAuthUser } from './_lib/supabaseServer.js';

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
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });    
    try {
        if (!(await getAuthUser(req))) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const allUsers = await supabase.from('User').select('*');
        const contractors = allUsers.filter(user => 
            user.active && user.email && (
                user.email.toLowerCase().includes('.contractor@m2fleetcom.com') ||
                user.email.toLowerCase().includes('.contractor@smcinstallations.com')
            )
        );

        const headers = [
            'Technician Name',
            'Business',
            'Technician Phone',
            'Emergency Contact Name',
            'Emergency Contact Phone',
            'Emergency Contact Email'
        ];

        const csvRows = contractors.map(user => {
            const row = [
                user.displayName || user.full_name || user.email,
                user.business,
                user.phone,
                user.emergencyContactName,
                user.emergencyContactPhone,
                user.emergencyContactEmail
            ];
            return row.map(escapeCsvField).join(',');
        });

        const csvContent = [headers.join(','), ...csvRows].join('\n');

        return new Response(csvContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': 'attachment; filename="emergency_contacts.csv"'
            }
        });

    } catch (error) {
        console.error('Error exporting emergency contacts:', error);
        return res.status(500).json({ error: error.message });
    }
}
