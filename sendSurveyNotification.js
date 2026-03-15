import { supabase, getAuthUser } from './_lib/supabaseServer.js';

import { Resend } from 'resend';

// Initialize Resend with the API key from environment variables
const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    try {
        // First, ensure the call is coming from an authenticated user within our app
        const user = await getAuthUser(req);
        if (!user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { to, subject, body, from_name } = req.body;

        if (!to || !subject || !body) {
            return res.status(400).json({ success: false, error: 'Missing required parameters: to, subject, body' });
        }

        // Use Resend to send the email
        await resend.emails.send({
            from: `${from_name || 'M2 Fleet Portal'} <notifications@m2fleetcom.com>`,
            to,
            subject,
            html: body,
        });

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('Error in sendSurveyNotification function with Resend:', error);
        const errorMessage = error.response ? await error.response.text() : error.message;
        return res.status(500).json({ success: false, error: errorMessage });
    }
}
