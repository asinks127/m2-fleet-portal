import { getAuthUser } from './_lib/supabaseServer.js';
export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });


  const { to, message } = req.body || {};
  if (!to || !message) {
    return res.status(400).json({ error: "to and message are required" });
  }

  try {
    return res.status(200).json({
      success: true,
      queued: true,
      provider: "stub",
      message: "SMS endpoint is active. Configure Twilio on Monday for live delivery."
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to queue sms" });
  }
}
