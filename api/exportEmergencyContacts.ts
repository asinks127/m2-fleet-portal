import { supabase } from '../src/lib/supabaseClient';

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
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
}
