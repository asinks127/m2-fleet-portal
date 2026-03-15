import { supabase } from '../src/lib/supabaseClient';

import { Resend } from 'npm:resend@3.2.0';

// Initialize Resend with the API key from environment variables
const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
    try {
        // First, ensure the call is coming from an authenticated user within our app
        const user = await base44.auth.me();
        if (!user) {
            return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        }

        const { to, subject, body, from_name } = req.body;

        if (!to || !subject || !body) {
            return new Response(JSON.stringify({ success: false, error: 'Missing required parameters: to, subject, body' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        // Use Resend to send the email
        await resend.emails.send({
            from: `${from_name || 'M2 Fleet Portal'} <notifications@m2fleetcom.com>`,
            to,
            subject,
            html: body,
        });

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error in sendSurveyNotification function with Resend:', error);
        const errorMessage = error.response ? await error.response.text() : error.message;
        return new Response(JSON.stringify({ success: false, error: errorMessage }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
