import { supabase } from '../src/lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  // CRITICAL: This function MUST work without any user authentication
  // It's designed for external Velo PMs who are NOT users of our system
  
  try {
    const { surveyToken } = req.body;

    if (!surveyToken) {
      return Response.json({ success: false, error: 'Survey token is required' }, { status: 400 });
    }

    // Use service role to bypass all authentication - this is a PUBLIC survey    const base44Admin = base44.asServiceRole;

    // Find survey by token
    const surveys = await base44Admin.entities.VeloSurvey.filter({ surveyToken });
    
    if (!surveys || surveys.length === 0) {
      return Response.json({ success: false, error: 'Invalid or expired survey token' }, { status: 404 });
    }

    const survey = surveys[0];

    // Get only the specific technicians for this survey
    const techIds = survey.technicianIds || [];
    if (techIds.length === 0) {
      return Response.json({ success: false, error: 'No technicians are assigned to this survey.' }, { status: 404 });
    }
    
    const technicians = await base44Admin.entities.User.filter({
      id: { $in: techIds }
    });


    return Response.json({
      success: true,
      survey: {
        id: survey.id,
        projectName: survey.projectName,
        surveyToken: survey.surveyToken
      },
      technicians: technicians.map(tech => ({
        id: tech.id,
        full_name: tech.full_name,
        email: tech.email,
        displayName: tech.full_name || tech.email
      }))
    });

  } catch (error) {
    console.error('Error in getVeloSurveyData:', error);
    return Response.json({ 
      success: false, 
      error: 'Failed to load survey data' 
    }, { status: 500 });
  }
}
