import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

const GMAIL_USER = process.env.GMAIL_USER || 'austin@m2fleetcom.com';
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || '';

function escapeHtml(s: string): string {
  return String(s || '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!GMAIL_APP_PASSWORD) {
    return res.status(500).json({ error: 'GMAIL_APP_PASSWORD environment variable not set' });
  }

  const { to, subject, signingUrl, recipientName, fromName, message } = req.body || {};

  if (!to || !signingUrl || !subject) {
    return res.status(400).json({ error: 'Missing required fields: to, subject, signingUrl' });
  }

  const name = recipientName || 'there';
  const msg = message || '';
  const sender = fromName || 'M2 Fleet';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #1e3a5f; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 22px;">M2 Fleet Communications</h1>
        <p style="color: #a8c4e0; margin: 5px 0 0; font-size: 14px;">Electronic Signature Request</p>
      </div>
      <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px; color: #333;">Hello ${escapeHtml(name)},</p>
        ${msg ? `<p style="font-size: 14px; color: #555; background: #eff6ff; padding: 12px; border-radius: 6px; border-left: 4px solid #3b82f6;">${escapeHtml(msg)}</p>` : ''}
        <p style="font-size: 15px; color: #333;">
          You have a document that requires your electronic signature. Please click the button below to review and sign the document.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${escapeHtml(signingUrl)}"
             style="background: #2563eb; color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">
            Review &amp; Sign Document
          </a>
        </div>
        <p style="font-size: 13px; color: #666; margin-top: 20px;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${escapeHtml(signingUrl)}" style="color: #2563eb; word-break: break-all;">${escapeHtml(signingUrl)}</a>
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">
        <p style="font-size: 12px; color: #999;">
          This is an automated message from the M2 Fleet Communications e-Signature system.
        </p>
      </div>
    </div>
  `;

  const text = `Hello ${name},\n\nYou have a document that requires your electronic signature.\n\n${msg ? msg + '\n\n' : ''}To review and sign, visit:\n${signingUrl}\n\n— M2 Fleet Communications`;

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD,
      },
    });

    const info = await transporter.sendMail({
      from: `${sender} <${GMAIL_USER}>`,
      to,
      subject,
      html,
      text,
    });

    return res.status(200).json({ success: true, id: info.messageId });
  } catch (e: any) {
    console.error('Email send error:', e);
    return res.status(500).json({ error: 'Email send failed', detail: e?.message || String(e) });
  }
}
