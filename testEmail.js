
import { Resend } from 'resend';

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    console.log('=== testEmail function with Resend started ===');    
    try {
        const { testEmail } = req.body;
        
        console.log('Sending Resend test email to:', testEmail);

        await resend.emails.send({
            from: 'M2 Fleet Portal Test <notifications@m2fleetcom.com>',
            to: testEmail,
            subject: 'Test Email from M2 Fleet Portal (via Resend)',
            html: `
                <h2>Email Test Successful!</h2>
                <p>If you received this email, the <strong>Resend API integration</strong> is working correctly.</p>
                <p>Test sent at: ${new Date().toISOString()}</p>
            `,
        });

        console.log('Resend test email sent successfully');

        return res.status(200).json({
            success: true,
            message: 'Test email sent successfully via Resend!'
        });

    } catch (error) {
        console.error('Resend test email error:', error);
        
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}
