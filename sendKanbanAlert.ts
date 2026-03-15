import { supabase } from '../src/lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();    const { to, subject, body } = req.body;

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

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error in sendKanbanAlert:', error);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
