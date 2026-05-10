import { supabase } from './_lib/supabaseServer.js';

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { surveyToken } = req.body || {};
    if (!surveyToken) {
      return res.status(400).json({ success: false, error: 'Survey token is required' });
    }

    const { data: surveys, error: surveyErr } = await supabase
      .from('VeloSurvey')
      .select('*')
      .eq('surveyToken', surveyToken)
      .limit(1);

    if (surveyErr) throw surveyErr;
    if (!surveys || surveys.length === 0) {
      return res.status(404).json({ success: false, error: 'Invalid or expired survey token' });
    }

    const survey = surveys[0];
    const techIds = Array.isArray(survey.technicianIds) ? survey.technicianIds : [];

    if (techIds.length === 0) {
      return res.status(200).json({
        success: true,
        survey: {
          id: survey.id,
          projectName: survey.projectName,
          surveyToken: survey.surveyToken,
        },
        technicians: [],
      });
    }

    const { data: technicians, error: techErr } = await supabase
      .from('User')
      .select('id,email,full_name,displayName')
      .in('id', techIds);

    if (techErr) throw techErr;

    return res.status(200).json({
      success: true,
      survey: {
        id: survey.id,
        projectName: survey.projectName,
        surveyToken: survey.surveyToken,
      },
      technicians: (technicians || []).map((tech) => ({
        id: tech.id,
        full_name: tech.full_name,
        email: tech.email,
        displayName: tech.displayName || tech.full_name || tech.email,
      })),
    });
  } catch (error) {
    console.error('Error in getVeloSurveyData:', error);
    return res.status(500).json({ success: false, error: 'Failed to load survey data' });
  }
}
