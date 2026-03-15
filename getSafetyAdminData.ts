import { supabase } from '../src/lib/supabaseClient';

const qcEmails = [
    'rmiller.contractor@m2fleetcom.com',
    'choffman.contractor@m2fleetcom.com'
];

const adminEmails = [
    'lena@m2fleetcom.com', 'orville@m2fleetcom.com', 'steve@m2fleetcom.com',
    'austin@m2fleetcom.com', 'adam@m2fleetcom.com', 'jason@m2fleetcom.com', 'erica@m2fleetcom.com',
    'lowell@m2fleetcom.com', 'secretary@m2fleetcom.com'
];

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
    const user = await base44.auth.me();
    if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized: Not logged in' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const userEmail = user.email.toLowerCase();
    const isQC = qcEmails.includes(userEmail);
    const isAdmin = adminEmails.includes(userEmail) || user.role === 'admin';

    if (!isQC && !isAdmin) {
        return new Response(JSON.stringify({ error: 'Forbidden: Insufficient permissions' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    try {
        const [messageData, allUsers, workersCompData, certData] = await Promise.all([
            supabase.from('SafetyMessage').select('*'),
            supabase.from('User').select('*'),
            supabase.from('WorkersCompRecord').select('*'),
            supabase.from('SafetyCertification').select('*')
        ]);

        const responsePayload = {
            messages: messageData,
            users: allUsers,
            workersCompRecords: workersCompData,
            certifications: certData
        };

        return new Response(JSON.stringify(responsePayload), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error fetching safety data in backend function:', error);
        return new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
