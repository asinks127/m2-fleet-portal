import { getAuthUser, supabase } from './_lib/supabaseServer.js';
import { Resend } from 'resend';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { surveyId, pmEmail, pmName, projectName, surveyLink, surveyToken, technicianIds } = req.body;

    if (!surveyId || !pmEmail || !surveyLink) {
      return res.status(400).json({ error: 'Missing required fields: surveyId, pmEmail, surveyLink' });
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return res.status(500).json({ error: 'RESEND_API_KEY not configured' });
    }

    const resend = new Resend(resendApiKey);

    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: 'M2 Fleet Communications <notifications@m2fleetcomportal.com>',
      to: [pmEmail],
      subject: `Contractor Performance Survey — ${projectName || 'Project'}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a365d;">M2 Fleet — Contractor Performance Survey</h2>
          <p>Hello ${pmName || 'Project Manager'},</p>
          <p>Please take a moment to rate the contractor(s) who worked on <strong>${projectName || 'your recent project'}</strong>.</p>
          <p>Your feedback helps us maintain quality standards and recognize top performers.</p>
          <div style="margin: 24px 0;">
            <a href="${surveyLink}" style="background-color: #1a365d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Complete Survey →
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">This survey link is unique to you. Estimated time: 2-3 minutes per contractor.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">M2 Fleet Communications Portal</p>
        </div>
      `,
    });

    if (emailError) {
      console.error('Resend email error:', emailError);
      return res.status(500).json({ error: 'Failed to send survey email', details: emailError });
    }

    const { error: updateError } = await supabase
      .from('VeloSurvey')
      .update({ 
        status: 'Sent', 
        sentDate: new Date().toISOString(),
        surveyToken: surveyToken 
      })
      .eq('id', surveyId);

    if (updateError) {
      console.error('Failed to update survey status:', updateError);
    }

    return res.status(200).json({ 
      success: true, 
      sent: true, 
      message: `Survey email sent to ${pmEmail}`,
      emailId: emailResult?.id 
    });

  } catch (error) {
    console.error('sendVeloSurvey error:', error);
    return res.status(500).json({ error: 'An unexpected error occurred. Please try again later.' });
  }
}
