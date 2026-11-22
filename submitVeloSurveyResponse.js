import { supabase } from './_lib/supabaseServer.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { surveyToken, responses } = req.body;
    if (!surveyToken || !Array.isArray(responses) || responses.length === 0) {
      return res.status(400).json({ error: 'surveyToken and responses[] are required' });
    }

    const { data: survey, error: surveyError } = await supabase
      .from('VeloSurvey')
      .select('*')
      .eq('surveyToken', surveyToken)
      .single();

    if (surveyError || !survey) {
      return res.status(404).json({ error: 'Survey not found or invalid token' });
    }

    if (survey.status === 'Completed') {
      return res.status(400).json({ error: 'This survey has already been completed' });
    }

    const savedResponses = [];

    for (const response of responses) {
      if (!response.technicianId || !response.technicianName) continue;

      const scoreFields = ['communicationSkills', 'availability', 'installQuality', 'reliability', 'problemSolving', 'safetyCompliance', 'overallPerformance'];
      const validScores = scoreFields.filter(f => typeof response[f] === 'number' && response[f] >= 1 && response[f] <= 5);
      const calculatedScore = validScores.length > 0
        ? Math.round((validScores.reduce((sum, f) => sum + response[f], 0) / validScores.length) * 100) / 100
        : null;

      const { data: saved, error: insertError } = await supabase
        .from('VeloSurveyResponse')
        .insert({
          surveyId: survey.id,
          technicianId: response.technicianId,
          technicianName: response.technicianName,
          communicationSkills: response.communicationSkills ?? null,
          availability: response.availability ?? null,
          installQuality: response.installQuality ?? null,
          reliability: response.reliability ?? null,
          problemSolving: response.problemSolving ?? null,
          safetyCompliance: response.safetyCompliance ?? null,
          overallPerformance: response.overallPerformance ?? null,
          additionalNotes: response.additionalNotes || '',
          calculatedScore: calculatedScore
        })
        .select()
        .single();

      if (insertError) {
        console.error('Insert response error:', insertError);
        continue;
      }

      savedResponses.push(saved);
    }

    await supabase
      .from('VeloSurvey')
      .update({ status: 'Completed', completedDate: new Date().toISOString() })
      .eq('id', survey.id);

    return res.status(200).json({
      success: true,
      surveyId: survey.id,
      responses: savedResponses,
    });

  } catch (error) {
    console.error('submitVeloSurveyResponse error:', error);
    return res.status(500).json({ error: 'An unexpected error occurred. Please try again later.' });
  }
}
