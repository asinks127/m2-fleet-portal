import { supabase } from './_lib/supabaseServer.js';
import { Resend } from 'resend';

const RESEND_KEY = process.env.RESEND_API_KEY;
const resend = RESEND_KEY ? new Resend(RESEND_KEY) : null;

// Fallback FROM for unverified domains — uses Resend's test domain.
// Once m2fleetcom.com is verified at resend.com/domains, switch to 'surveys@m2fleetcom.com'.
const FROM_ADDRESS = RESEND_KEY ? 'M2 Fleet Portal <onboarding@resend.dev>' : null;

async function sendSurveyEmail(survey) {
  if (!resend) {
    return { sent: false, error: 'Resend not configured — RESEND_API_KEY missing' };
  }
  if (!survey.veloPMEmail) {
    return { sent: false, error: 'No PM email address' };
  }
  if (!survey.surveyLink) {
    return { sent: false, error: 'No survey link' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: survey.veloPMEmail,
      subject: `Velo Performance Survey: ${survey.projectName}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
<h2 style="color:#1a1a2e">Velo Performance Survey</h2>
<p>Hi ${survey.veloPM || 'Project Manager'},</p>
<p>You have a new performance survey for <strong>${survey.projectName}</strong>.</p>
<p>Click below to rate the M2 technicians who worked on this project.</p>
<p style="margin:24px 0">
<a href="${survey.surveyLink}" style="background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block">Complete Survey</a>
</p>
<p style="color:#666;font-size:14px">Link: <a href="${survey.surveyLink}">${survey.surveyLink}</a></p>
<hr style="margin:24px 0;border:none;border-top:1px solid #eee"/>
<p style="color:#999;font-size:12px">M2 Fleet Communications Portal</p>
</div>`,
    });

    if (error) {
      return { sent: false, error: error.message || 'Resend API error' };
    }

    return { sent: true, data };
  } catch (e) {
    return { sent: false, error: e.message };
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { action, ...payload } = req.body || {};

    switch (action) {
      case 'create_survey': {
        const surveyRow = {
          projectName: payload.projectName,
          veloPM: payload.veloPM,
          veloPMEmail: payload.veloPMEmail,
          technicianIds: payload.technicianIds,
          surveyToken: payload.surveyToken,
          surveyLink: payload.surveyLink,
          status: 'pending_send',
          surveyType: payload.surveyType || 'manual',
          autoTriggered: payload.autoTriggered || false,
          sentDate: payload.sentDate || new Date().toISOString(),
        };

        const { data: survey, error } = await supabase
          .from('VeloSurvey')
          .insert(surveyRow)
          .select()
          .single();

        if (error) throw error;

        const emailResult = await sendSurveyEmail(survey);

        if (emailResult.sent) {
          await supabase
            .from('VeloSurvey')
            .update({ status: 'sent', sentDate: new Date().toISOString() })
            .eq('id', survey.id);
        }

        return res.status(201).json({
          success: true,
          survey,
          emailSent: emailResult.sent,
          emailError: emailResult.error || undefined,
        });
      }

      case 'send_pending': {
        const { data: surveys, error: surveyError } = await supabase
          .from('VeloSurvey')
          .select('*')
          .eq('status', 'pending_send');

        if (surveyError) throw surveyError;
        if (!surveys || surveys.length === 0) {
          return res.status(200).json({ success: true, sent: 0, message: 'No pending surveys' });
        }

        let sent = 0;
        const errors = [];

        for (const survey of surveys) {
          const emailResult = await sendSurveyEmail(survey);
          if (emailResult.sent) {
            await supabase
              .from('VeloSurvey')
              .update({ status: 'sent', sentDate: new Date().toISOString() })
              .eq('id', survey.id);
            sent++;
          } else {
            errors.push(`Survey ${survey.id} → ${survey.veloPMEmail}: ${emailResult.error}`);
          }
        }

        return res.status(200).json({
          success: true,
          sent,
          total: surveys.length,
          errors: errors.length > 0 ? errors : undefined,
        });
      }

      case 'delete_survey': {
        const { error } = await supabase.from('VeloSurvey').delete().eq('id', payload.id);
        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      case 'delete_response': {
        const { error } = await supabase.from('VeloSurveyResponse').delete().eq('id', payload.id);
        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      case 'add_pm': {
        const { data, error } = await supabase
          .from('velo_project_managers')
          .insert({ name: payload.name, email: payload.email, company: payload.company || null, notes: payload.notes || null })
          .select().single();
        if (error) throw error;
        return res.status(201).json({ success: true, pm: data });
      }

      case 'delete_pm': {
        const { error } = await supabase.from('velo_project_managers').delete().eq('id', payload.id);
        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (error) {
    console.error('createVeloSurvey error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
