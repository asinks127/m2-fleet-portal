import { supabase, getAuthUser } from './_lib/supabaseServer.js';

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // CRITICAL: This function MUST work without any user authentication
  // It's designed for external Velo PMs who are NOT users of our system
  
  try {
    const { surveyToken } = req.body;

    if (!surveyToken) {
      return res.status(400).json({ success: false, error: 'Survey token is required' });
    }

    // Use service role to bypass all authentication - this is a PUBLIC survey    
    // Find survey by token
    const surveys = await supabase.from('VeloSurvey').select('*').match({ surveyToken }).then(r => r.data || []);
    
    if (!surveys || surveys.length === 0) {
      return res.status(404).json({ success: false, error: 'Invalid or expired survey token' });
    }

    const survey = surveys[0];

    // Get only the specific technicians for this survey
    const techIds = survey.technicianIds || [];
    if (techIds.length === 0) {
      return res.status(404).json({ success: false, error: 'No technicians are assigned to this survey.' });
    }
    
    const technicians = await supabase.from('User').select('*').match({
      id: { $in: techIds }
    }).then(r => r.data || []);


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
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to load survey data' 
    });
  }
}
