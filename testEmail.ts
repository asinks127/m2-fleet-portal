import { Resend } from 'resend';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  try {
    const { testEmail: toEmail } = req.body || {};

    if (!toEmail) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: 'Missing testEmail address' }));
      return;
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || apiKey === 're_123456789' || apiKey === 'your_resend_key') {
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: false,
        error: 'RESEND_API_KEY is not configured. Add a real Resend API key at Settings > Advanced as RESEND_API_KEY to send test emails.',
      }));
      return;
    }

    const resend = new Resend(apiKey);
    console.log('Sending Resend test email to:', toEmail);

    const result = await resend.emails.send({
      from: 'M2 Fleet Portal Test <notifications@m2fleetcom.com>',
      to: toEmail,
      subject: 'Test Email from M2 Fleet Portal (via Resend)',
      html: `
          <h2>Email Test Successful!</h2>
          <p>If you received this email, the <strong>Resend API integration</strong> is working correctly.</p>
          <p>Test sent at: ${new Date().toISOString()}</p>
        `,
    });

    console.log('Resend test email sent:', result);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      success: true,
      message: 'Test email sent successfully via Resend!',
      id: result?.id || result?.data?.id,
    }));
  } catch (error) {
    console.error('Resend test email error:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, error: error?.message || 'Email send failed' }));
  }
}
