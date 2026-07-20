import nodemailer from 'nodemailer';

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;
  _transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
  console.log('SMTP transporter created for', process.env.GMAIL_USER);
  return _transporter;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  try {
    const body = req.body || {};

    const { to, subject, signingUrl, recipientName, message, documentName } = body;

    if (!to || !subject || !signingUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing required fields: to, subject, signingUrl' }));
      return;
    }

    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'GMAIL_USER or GMAIL_APP_PASSWORD environment variable not set' }));
      return;
    }

    const name = recipientName || 'there';
    const doc = documentName || 'a document';
    const bodyText = message || `Hello ${name},\n\nYou have been asked to sign ${doc}.\n\nPlease review and sign the document at your earliest convenience using the link below:\n\n${signingUrl}\n\nThank you,\nM2 Fleet Communications`;

    const htmlBody = message ? message : `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Document Signature Request</h2>
        <p>Hello ${name},</p>
        <p>You have been asked to sign <strong>${doc}</strong>.</p>
        <p>Please review and sign the document at your earliest convenience by clicking the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${signingUrl}" style="background-color: #2563eb; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-size: 16px; display: inline-block;">Review &amp; Sign Document</a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="color: #6b7280;">${signingUrl}</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #9ca3af; font-size: 12px;">This is an automated message from M2 Fleet Communications. Please do not reply to this email.</p>
      </div>`;

    const transporter = getTransporter();
    const mailOptions = {
      from: `"M2 Fleet Communications" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      text: bodyText,
      html: htmlBody,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('E-sign email sent:', info.messageId, 'to:', to);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, messageId: info.messageId }));
  } catch (error) {
    console.error('Failed to send e-sign email:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Failed to send email', details: error.message }));
  }
}
