import { supabase } from '../src/lib/supabaseClient';

export default export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  try {    
    if (req.method === 'OPTIONS') {
      return res.status(204).send(null);
    }

    const { documentId, recipients } = req.body.catch(() => ({}));

    if (!documentId || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return Response.json({ success: false, error: 'Missing documentId or recipients' }, { status: 400 });
    }

    const user = await base44.auth.me();
    // Allow admin or specific emails
    const adminEmails = [
       'lena@m2fleetcom.com', 'orville@m2fleetcom.com', 'steve@m2fleetcom.com',
       'austin@m2fleetcom.com', 'adam@m2fleetcom.com', 'jason@m2fleetcom.com', 'erica@m2fleetcom.com',
       'lowell@m2fleetcom.com'
    ];
    const userEmail = user?.email?.toLowerCase();
    
    // Check if user is admin or in allowed list
    if (!user || (user.role !== 'admin' && !adminEmails.includes(userEmail))) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const document = await supabase.from('SignableDocument').select('*').eq('id', documentId).single();
    if (!document) {
      return Response.json({ success: false, error: 'Document not found' }, { status: 404 });
    }
    
    const results = [];
    const APP_URL = req.headers.get("origin") || Deno.env.get("BASE44_APP_URL") || "https://base44.app"; 

    for (const recipient of recipients) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!recipient.name || !recipient.email || !emailRegex.test(recipient.email)) {
        results.push({ ...recipient, status: 'failed', error: 'Invalid name or email format' });
        continue;
      }
      
      try {
        const signatureToken = crypto.randomUUID();
        const baseUrl = APP_URL.replace(/\/$/, "");
        const signingUrl = `${baseUrl}/SignDocument?token=${signatureToken}`;

        // Construct payload safely - removing undefined/null for optional string fields
        // to avoid schema validation errors (type: "string" does not accept null)
        const requestData = {
          documentId: document.id,
          documentTitle: document.title,
          technicianName: recipient.name,
          technicianEmail: recipient.email,
          status: 'Sent',
          signatureToken: signatureToken,
        };
        
        if (recipient.technicianId) {
            requestData.technicianId = recipient.technicianId;
        }

        console.log(`Creating SignatureRequest for ${recipient.email}...`);
        
        try {
            await supabase.from('SignatureRequest').insert(requestData);
        } catch (dbError) {
            console.error('Database create error:', dbError);
            throw new Error(`Failed to create database record: ${dbError.message}`);
        }

        const emailBody = `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <p>Hello ${recipient.name},</p>
            <p>You have received a document from <strong>M2 Fleet Solutions</strong> that requires your signature: <strong>${document.title}</strong>.</p>
            <p>Please click the button below to review and sign:</p>
            <div style="margin: 25px 0;">
                <a href="${signingUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Sign Document</a>
            </div>
            <p style="font-size: 14px; color: #666;">Or copy and paste this link into your browser:</p>
            <p style="font-size: 12px; color: #888; background: #f9fafb; padding: 10px; border-radius: 4px; word-break: break-all;">${signingUrl}</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
            <p style="font-size: 12px; color: #999;">M2 Fleet Solutions Portal</p>
          </div>
        `;

        let emailStatus = 'sent_attempted';
        
        // Skip email for internal technicians (they use the dashboard)
        if (recipient.technicianId) {
             console.log(`Skipping email for internal technician: ${recipient.email}`);
             emailStatus = 'skipped_internal';
        } else {
            try {
              await /* TODO: Setup Resend */ resend.emails.send({
                to: recipient.email,
                subject: `Action Required: Sign Document - ${document.title}`,
                body: emailBody,
                from_name: "M2 Fleet Solutions"
              });
              emailStatus = 'sent_success';
            } catch (emailError) {
              console.warn(`Email sending failed for ${recipient.email}:`, emailError.message);
              emailStatus = 'sent_failed';
            }
        }

        results.push({ ...recipient, signingUrl, status: emailStatus });

      } catch (e) {
        console.error(`Error processing recipient ${recipient.email}:`, e);
        results.push({ ...recipient, status: 'failed', error: e.message });
      }
    }
    
    return Response.json({ success: true, results });

  } catch (error) {
    console.error('Critical error in sendSignatureRequest:', error);
    return Response.json({ success: false, error: error.message }, { status: 200 });
  }
}
