import { supabase, getAuthUser } from './_lib/supabaseServer.js';

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
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const user = await getAuthUser(req);
    if (!user) {
        return res.status(401).json({ error: 'Unauthorized: Not logged in' });
    }

    const userEmail = user.email.toLowerCase();
    const isQC = qcEmails.includes(userEmail);
    const isAdmin = adminEmails.includes(userEmail) || user.role === 'admin';

    if (!isQC && !isAdmin) {
        return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
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
        return res.status(500).json({ error: 'Internal Server Error', details: "See server logs for details" });
    }
}
