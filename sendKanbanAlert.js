import { supabase, getAuthUser } from './_lib/supabaseServer.js';

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });    const { to, subject, body } = req.body;

    try {
        if (!to || !subject || !body) {
            throw new Error('Missing required parameters: to, subject, or body.');
        }

        await /* TODO: Setup Resend */ resend.emails.send({
            to,
            subject: `M2 Kanban Alert: ${subject}`,
            body,
            from_name: 'M2 Fleet Kanban Board'
        });

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('Error in sendKanbanAlert:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
