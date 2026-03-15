
import { Resend } from 'npm:resend@3.2.0';

// Initialize Resend
const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

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

        return new Response(JSON.stringify({
            success: true,
            message: 'Test email sent successfully via Resend!'
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Resend test email error:', error);
        
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
