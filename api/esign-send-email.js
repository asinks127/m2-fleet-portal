import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

transporter.verify((error) => {
  if (error) {
    console.error('SMTP connection error:', error.message);
  } else {
    console.log('SMTP server ready for esign emails');
  }
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  try {
    const body = await new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => { data += chunk; });
      req.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
      req.on('error', reject);
    });

    const { to, subject, signingUrl, recipientName, message, documentName } = body;

    if (!to || !subject || !signingUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing required fields: to, subject, signingUrl' }));
      return;
    }

    const name = recipientName || 'there';
    const doc = documentName || 'a document';
    const bodyText = message || `Hello ${name},

You have been asked to sign ${doc}.

Please review and sign the document at your earliest convenience using the link below:

${signingUrl}

Thank you,
M2 Fleet Communications`;

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
