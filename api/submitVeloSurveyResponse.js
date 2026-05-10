import { supabase, getAuthUser } from './_lib/supabaseServer.js';

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // CRITICAL: This function MUST work without any user authentication
  // It's designed for external Velo PMs who are NOT users of our system
  
  try {
    const { surveyToken, responses } = req.body;

    if (!surveyToken || !responses || !Array.isArray(responses)) {
      return res.status(400).json({ success: false, error: 'Invalid request data' });
    }

    // Use service role to bypass all authentication - this is a PUBLIC survey    
    // Verify survey exists and is still active
    const surveys = await supabase.from('VeloSurvey').select('*').match({ surveyToken }).then(r => r.data || []);
    
    if (!surveys || surveys.length === 0) {
      return res.status(404).json({ success: false, error: 'Invalid or expired survey token' });
    }

    const survey = surveys[0];

    // Save each response
    const savedResponses = [];
    for (const response of responses) {
      try {
        const savedResponse = await supabase.from('VeloSurveyResponse').insert({
          surveyId: survey.id,
          technicianId: response.technicianId,
          technicianName: response.technicianName,
          communicationSkills: response.communicationSkills,
          availability: response.availability,
          installQuality: response.installQuality,
          reliability: response.reliability,
          problemSolving: response.problemSolving,
          safetyCompliance: response.safetyCompliance,
          overallPerformance: response.overallPerformance,
          additionalNotes: response.additionalNotes || ''
        }).select().single().then(r => r.data);
        savedResponses.push(savedResponse);
      } catch (err) {
        console.error('Error saving individual response:', err);
      }
    }

    // Mark survey as completed
    await supabase.from('VeloSurvey').update({
      status: 'Completed',
      completedDate: new Date().toISOString()
    }).eq('id', survey.id);

    return res.status(200).json({
      success: true,
      message: 'Survey responses submitted successfully',
      responsesCount: savedResponses.length
    });

  } catch (error) {
    console.error('Error in submitVeloSurveyResponse:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to submit survey responses' 
    });
  }
}
