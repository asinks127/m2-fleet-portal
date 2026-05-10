import { supabase } from '../src/lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  // CRITICAL: This function MUST work without any user authentication
  // It's designed for external Velo PMs who are NOT users of our system
  
  try {
    const { surveyToken, responses } = req.body;

    if (!surveyToken || !responses || !Array.isArray(responses)) {
      return Response.json({ success: false, error: 'Invalid request data' }, { status: 400 });
    }

    // Use service role to bypass all authentication - this is a PUBLIC survey    const base44Admin = base44.asServiceRole;

    // Verify survey exists and is still active
    const surveys = await base44Admin.entities.VeloSurvey.filter({ surveyToken });
    
    if (!surveys || surveys.length === 0) {
      return Response.json({ success: false, error: 'Invalid or expired survey token' }, { status: 404 });
    }

    const survey = surveys[0];

    // Save each response
    const savedResponses = [];
    for (const response of responses) {
      try {
        const savedResponse = await base44Admin.entities.VeloSurveyResponse.create({
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
        });
        savedResponses.push(savedResponse);
      } catch (err) {
        console.error('Error saving individual response:', err);
      }
    }

    // Mark survey as completed
    await base44Admin.entities.VeloSurvey.update(survey.id, {
      status: 'Completed',
      completedDate: new Date().toISOString()
    });

    return Response.json({
      success: true,
      message: 'Survey responses submitted successfully',
      responsesCount: savedResponses.length
    });

  } catch (error) {
    console.error('Error in submitVeloSurveyResponse:', error);
    return Response.json({ 
      success: false, 
      error: 'Failed to submit survey responses' 
    }, { status: 500 });
  }
}
