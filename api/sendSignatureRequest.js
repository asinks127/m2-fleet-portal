import crypto from 'node:crypto';
import { supabase, getAuthUser } from '../_lib/supabaseServer.js';
import { Resend } from 'resend';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  console.log('[sendSignature] REQUEST received');

  try {
    const { documentId, recipients } = req.body || {};
    console.log('[sendSignature] docId:', documentId, 'recipients:', recipients?.length);

    if (!documentId || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ success: false, error: 'Missing documentId or recipients' });
    }

    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    console.log('[sendSignature] Auth OK:', user.email);

    const { data: document, error: documentError } = await supabase
      .from('SignableDocument')
      .select('*')
      .eq('id', documentId)
      .single();

    if (documentError) {
      console.error('[sendSignature] Doc lookup error:', documentError.message);
      return res.status(500).json({ success: false, error: documentError.message });
    }
    if (!document) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }
    console.log('[sendSignature] Document found:', document.title);

    const appUrl = (req.headers.origin || process.env.APP_URL || 'https://www.m2fleetcomportal.com').replace(/\/$/, '');

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error('[sendSignature] RESEND_API_KEY not set in env');
      return res.status(500).json({ success: false, error: 'Email service not configured (missing RESEND_API_KEY)' });
    }
    const resend = new Resend(resendApiKey);

    const results = [];

    for (const recipient of recipients) {
      console.log('[sendSignature] Processing:', recipient.email);

      if (!recipient?.name || !recipient?.email) {
        results.push({ ...recipient, status: 'failed', error: 'Missing name or email' });
        continue;
      }

      try {
        const signaturetoken = crypto.randomUUID();

        const payload = {
          documentid: document.id,
          documenttitle: document.title,
          technicianname: recipient.name,
          technicianemail: recipient.email,
          status: 'Sent',
          signaturetoken,
        };
        if (recipient.technicianid) payload.technicianid = recipient.technicianid;

        const { data: insertedRecord, error: insertError } = await supabase
          .from('SignatureRequest')
          .insert(payload)
          .select('id')
          .single();

        if (insertError) {
          console.error('[sendSignature] Supabase insert error:', insertError.message);
          throw insertError;
        }

        const requestId = insertedRecord?.id;
        const signingUrl = `${appUrl}/sign/${requestId}/${signaturetoken}`;

        console.log('[sendSignature] SignatureRequest created, id:', requestId, 'for:', recipient.email);

        const isInternal = !!recipient.technicianid;
        if (isInternal) {
          console.log('[sendSignature] Skipping email (internal):', recipient.email);
          results.push({ ...recipient, signingUrl, status: 'created_internal' });
        } else {
          const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #1a1a1a;">Document Ready for Signature</h2>
              <p>Hello ${recipient.name},</p>
              <p>You have a document from <strong>M2 Fleet Solutions</strong> that requires your signature:</p>
              <p style="font-weight: bold; font-size: 16px;">${document.title}</p>
              <div style="margin: 30px 0;">
                <a href="${signingUrl}" style="display: inline-block; padding: 14px 28px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Sign Document</a>
              </div>
              <p style="font-size: 14px; color: #666;">Or copy this link into your browser:</p>
              <p style="font-size: 12px; color: #888; background: #f9fafb; padding: 10px; border-radius: 4px; word-break: break-all;">${signingUrl}</p>
              <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
              <p style="font-size: 12px; color: #999;">M2 Fleet Solutions Portal</p>
            </div>
          `;

          console.log('[sendSignature] Sending Resend email to:', recipient.email);
          const { data: emailData, error: emailError } = await resend.emails.send({
            from: 'M2 Fleet Portal <notifications@m2fleetcomportal.com>',
            to: [recipient.email],
            subject: `Action Required: Sign Document - ${document.title}`,
            html: emailHtml,
          });

          if (emailError) {
            console.error('[sendSignature] Resend error for', recipient.email, ':', JSON.stringify(emailError));
            results.push({ ...recipient, signingUrl, status: 'email_failed', error: emailError.message });
          } else {
            console.log('[sendSignature] Resend OK for', recipient.email, 'id:', emailData?.id);
            results.push({ ...recipient, signingUrl, status: 'sent', emailId: emailData?.id });
          }
        }
      } catch (err) {
        console.error('[sendSignature] Error processing', recipient.email, ':', err.message);
        results.push({ ...recipient, status: 'failed', error: err.message });
      }
    }

    console.log('[sendSignature] Done. Results:', JSON.stringify(results).substring(0, 500));
    return res.status(200).json({ success: true, results });

  } catch (error) {
    console.error('[sendSignature] Critical error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
