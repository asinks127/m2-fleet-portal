import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

// Initialize Resend with API key from environment
const resend = new Resend(process.env.RESEND_API_KEY);

// Initialize Supabase admin client
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export default async function handler(req: any, res: any) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { mentionedEmail, mentionedName, senderName, messageContent, channelName, messageId } = req.body;

    if (!mentionedEmail) {
      return res.status(400).json({ error: 'Missing mentionedEmail' });
    }

    // Check if user has opted out of notifications (optional feature)
    if (supabase) {
      const { data: userPrefs } = await supabase
        .from('User')
        .select('notification_preferences')
        .eq('email', mentionedEmail.toLowerCase())
        .single();
      
      const prefs = userPrefs?.notification_preferences;
      if (prefs && prefs.disableMentionNotifications) {
        return res.status(200).json({ success: true, skipped: 'User opted out' });
      }
    }

    // Build email content
    const truncatedContent = messageContent && messageContent.length > 300 
      ? messageContent.substring(0, 300) + '...' 
      : messageContent || '';

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; padding: 24px; border-radius: 8px 8px 0 0; }
            .content { background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none; }
            .message-box { background: white; border-left: 4px solid #3b82f6; padding: 16px; margin: 16px 0; border-radius: 0 8px 8px 0; }
            .footer { text-align: center; padding: 20px; color: #64748b; font-size: 14px; }
            .btn { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2 style="margin: 0;">💬 You were mentioned in Team Messaging</h2>
            </div>
            <div class="content">
              <p>Hi ${mentionedName || 'there'},</p>
              <p><strong>${senderName || 'Someone'}</strong> mentioned you in <strong>#${channelName || 'general'}</strong>:</p>
              <div class="message-box">
                <p style="margin: 0; white-space: pre-wrap;">${truncatedContent}</p>
              </div>
              <p style="margin-top: 24px;">
                <a href="https://m23for3-15-portal-live-austin1.zocomputer.io/messaging" class="btn">View Message</a>
              </p>
            </div>
            <div class="footer">
              <p>M2 Fleet Portal • Team Messaging</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send email via Resend
    const result = await resend.emails.send({
      from: 'M2 Fleet Messaging <notifications@m2fleetcom.com>',
      to: mentionedEmail,
      subject: `${senderName || 'Someone'} mentioned you in #${channelName || 'general'}`,
      html: emailHtml,
    });

    console.log('Mention notification sent:', result);

    return res.status(200).json({ success: true, emailId: result.data?.id });
  } catch (error: any) {
    console.error('Error sending mention notification:', error);
    return res.status(500).json({ error: error?.message || 'Failed to send notification' });
  }
}
