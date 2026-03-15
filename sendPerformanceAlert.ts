import { supabase } from '../src/lib/supabaseClient';


export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();    const triggeringUser = await base44.auth.me();

    if (!triggeringUser) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const { technicianId, subject, body } = req.body;

    const managerEmails = [
        'lena@m2fleetcom.com', 'orville@m2fleetcom.com', 'steve@m2fleetcom.com',
        'austin@m2fleetcom.com', 'adam@m2fleetcom.com', 'jason@m2fleetcom.com'
    ];

    let technician = null;
    let logStatus = 'error';
    let logErrorMessage = 'An unknown error occurred.';

    try {
        if (!technicianId || !subject || !body) {
            throw new Error('Missing required parameters: technicianId, subject, or body.');
        }

        const allUsers = await supabase.from('User').select('*');
        technician = allUsers.find(u => u.id === technicianId);

        if (!technician) {
            throw new Error(`Technician with ID ${technicianId} not found.`);
        }

        const finalEmailBody = `
            <div style="font-family: sans-serif; line-height: 1.6;">
                <h2 style="color: #c0392b;">Performance Alert</h2>
                <p>This is an automated alert regarding a performance issue for technician <strong>${technician.displayName || technician.full_name}</strong> that requires your attention.</p>
                <div style="background: #f9f9f9; border: 1px solid #eee; padding: 15px; border-radius: 8px;">
                    <p><strong>Technician:</strong> ${technician.displayName || technician.full_name}</p>
                    <p><strong>M2 Project Manager:</strong> ${technician.m2PM || 'Not Assigned'}</p>
                    <p><strong>Velo Project Manager:</strong> ${technician.veloPM || 'Not Assigned'}</p>
                </div>
                <hr style="margin: 20px 0;">
                ${body}
                <p>Please review this issue and follow up with the technician as needed.</p>
                <p>This is an automated message from the M2 Fleet Portal.</p>
            </div>
        `;

        for (const email of managerEmails) {
            await /* TODO: Setup Resend */ resend.emails.send({
                to: email,
                subject: `Performance Alert: ${technician.displayName || technician.full_name} - ${subject}`,
                body: finalEmailBody,
                from_name: 'M2 Fleet Portal Alerts'
            });
        }
        
        logStatus = 'success';
        logErrorMessage = null;

    } catch (error) {
        console.error('Error in sendPerformanceAlert:', error);
        logErrorMessage = error.message;
        logStatus = 'error';
    } finally {
        // Always create an audit log
        await supabase.from('AlertLog').insert({
            technicianId: technicianId,
            technicianName: technician?.displayName || technician?.full_name || 'N/A',
            subject: subject,
            status: logStatus,
            errorMessage: logErrorMessage,
            sentTo: managerEmails,
            triggeredBy: triggeringUser.email
        });
    }

    // Return success to the frontend unless it's a parameter issue, 
    // because we have now logged the outcome.
    if (logStatus === 'error' && logErrorMessage.startsWith('Missing required parameters')) {
         return new Response(JSON.stringify({ success: false, error: logErrorMessage }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    
    return new Response(JSON.stringify({ success: true, logged: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
