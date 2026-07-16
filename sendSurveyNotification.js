import { getAuthUser } from './_lib/supabaseServer.js';
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { to, pmName, projectName, surveyLink } = req.body;
    if (!to || !pmName || !projectName || !surveyLink) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <p>Hi ${pmName},</p>
  <p>M2 Fleet would like to invite you to rate the performance of your technician(s) on the <strong>${projectName}</strong> project. This should take about 2 minutes.</p>
  <p style="margin: 24px 0;">
    <a href="${surveyLink}" style="background: #1a56db; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Take the Survey</a>
  </p>
  <p style="color: #666; font-size: 13px;">Or copy and paste this link:</p>
  <p style="color: #1a56db; font-size: 12px;">${surveyLink}</p>
  <p style="margin-top: 32px;">Thank you for your time,<br><strong>M2 Fleet Scheduling</strong></p>
</body>
</html>`;

    await transporter.sendMail({
      from: '"M2 Fleet Scheduling" <scheduling@m2fleetcom.com>',
      to,
      subject: `Technician Performance Survey — ${projectName}`,
      html,
    });

    return res.status(200).json({ success: true, sent: true });
  } catch (error) {
    console.error('sendSurveyNotification error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
