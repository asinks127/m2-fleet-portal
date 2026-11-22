import { supabase } from './_lib/supabaseServer.js';
import { Resend } from 'resend';

const RESEND_KEY = process.env.RESEND_API_KEY;
const resend = RESEND_KEY ? new Resend(RESEND_KEY) : null;

async function sendSurveyEmail(survey) {
  if (!resend) {
    console.error('Resend not configured');
    return { sent: false, error: 'Resend not configured' };
  }
  if (!survey.surveyLink) {
    return { sent: false, error: 'No survey link' };
  }
  if (!survey.veloPMEmail) {
    return { sent: false, error: 'No PM email address' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'M2 Fleet Portal <notifications@m2fleetcomportal.com>',
      to: survey.veloPMEmail,
      subject: `Velo Performance Survey: ${survey.projectName || 'Project'}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
<h2 style="color:#1a1a2e">Velo Performance Survey</h2>
<p>Hi ${survey.veloPM || 'Project Manager'},</p>
<p>You have a new performance survey for <strong>${survey.projectName || 'your project'}</strong>.</p>
<p>Please click below to rate the M2 technicians who worked on this project.</p>
<p style="margin:24px 0">
<a href="${survey.surveyLink}" style="background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block">Complete Survey</a>
</p>
<p style="color:#666;font-size:14px">Link: <a href="${survey.surveyLink}">${survey.surveyLink}</a></p>
<hr style="margin:24px 0;border:none;border-top:1px solid #eee"/>
<p style="color:#999;font-size:12px">M2 Fleet Communications Portal</p>
</div>`,
    });

    if (error) {
      console.error('Resend error:', error);
      return { sent: false, error: error.message };
    }

    console.log(`Survey email sent to ${survey.veloPMEmail}: ${data?.id}`);
    return { sent: true, data };
  } catch (e) {
    console.error('sendSurveyEmail error:', e);
    return { sent: false, error: e.message };
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { id, veloPM, veloPMEmail, projectName, surveyLink } = req.body || {};

    let survey;

    if (id) {
      const { data, error } = await supabase
        .from('VeloSurvey')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        return res.status(404).json({ success: false, error: 'Survey not found' });
      }

      survey = data;

      // Ensure survey has a link — use the one from the request if the DB row is missing it
      if (!survey.surveyLink && surveyLink) {
        await supabase.from('VeloSurvey').update({ surveyLink }).eq('id', survey.id);
        survey.surveyLink = surveyLink;
      }
    } else if (veloPMEmail && surveyLink) {
      survey = { veloPM, veloPMEmail, projectName, surveyLink };
    } else {
      return res.status(400).json({ success: false, error: 'Missing required fields. Provide id OR veloPMEmail + surveyLink' });
    }

    console.log(`Sending survey email to ${survey.veloPMEmail} for "${survey.projectName}"`);

    const result = await sendSurveyEmail(survey);

    if (result.sent) {
      await supabase
        .from('VeloSurvey')
        .update({ status: 'sent', sentDate: new Date().toISOString() })
        .eq('id', survey.id);

      return res.status(200).json({ success: true, message: 'Survey email sent' });
    }

    return res.status(500).json({ success: false, error: result.error });
  } catch (error) {
    console.error('velo-survey-webhook error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
