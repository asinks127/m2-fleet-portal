import { supabase } from '../src/lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();    
    try {
        const { checklistId, trainerEmail, trainerName } = req.body;

        if (!checklistId || !trainerEmail || !trainerName) {
            return new Response(JSON.stringify({ 
                success: false, 
                error: 'Missing required parameters: checklistId, trainerEmail, or trainerName' 
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Try to get the checklist using filter instead of get for better compatibility
        let checklist;
        try {
            const checklists = await base44.asServiceRole.entities.ShadowingChecklist.filter({ id: checklistId });
            checklist = checklists && checklists.length > 0 ? checklists[0] : null;
        } catch (filterError) {
            console.error('Error filtering checklist:', filterError);
            // Fallback to get method
            try {
                checklist = await supabase.from('ShadowingChecklist').select('*').eq('id', checklistId).single();
            } catch (getError) {
                console.error('Error getting checklist:', getError);
                checklist = null;
            }
        }
        
        if (!checklist) {
            return new Response(JSON.stringify({ 
                success: false, 
                error: 'Checklist not found' 
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Generate a secure token for the checklist
        const checklistToken = crypto.randomUUID();
        
        // Update the checklist with lead tech info and token
        await supabase.from('ShadowingChecklist').update({
            trainerEmail,
            trainerName,
            checklistToken,
            workflowStatus: 'sent_to_trainer',
            sentToTrainerDate: new Date().eq('id', checklistId).toISOString()
        });

        // Create the checklist URL
        const baseUrl = req.headers.get('origin') || 'https://preview--m2-fleet-communications-portal-767c8ae8.base44.app';
        const checklistUrl = `${baseUrl}/ShadowingChecklistResponse?token=${checklistToken}`;

        const emailBody = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">Shadowing Checklist Assignment</h2>
                
                <p>Hello ${trainerName},</p>
                
                <p>You have been assigned as the Lead Tech to complete a shadowing checklist for:</p>
                <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 15px 0;">
                    <strong>Contractor:</strong> ${checklist.contractorName}<br>
                    <strong>Email:</strong> ${checklist.contractorEmail}
                </div>
                
                <p>Please complete the shadowing checklist by clicking the link below. This checklist tracks the 8 required steps for new contractor onboarding:</p>
                
                <ul style="margin: 20px 0;">
                    <li>Safety Orientation Complete</li>
                    <li>Tools and Equipment Review</li>
                    <li>Has All Required Tools</li>
                    <li>First Installation Shadowed</li>
                    <li>Quality Standards Review</li>
                    <li>Is Punctual and Reliable</li>
                    <li>Independent Install Observed</li>
                    <li>Final QC Approval (will be completed by QC team)</li>
                </ul>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${checklistUrl}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                        Complete Shadowing Checklist
                    </a>
                </div>
                
                <p style="color: #6b7280; font-size: 14px;">
                    This checklist link is secure and unique to this assignment. Once you complete it, 
                    it will be sent back to the QC team for final approval.
                </p>
                
                <p>Thank you!</p>
                
                <p>M2 Fleet QC Team</p>
            </div>
        `;

        // Send the email
        await /* TODO: Setup Resend */ resend.emails.send({
            to: trainerEmail,
            subject: `Shadowing Checklist Assignment - ${checklist.contractorName}`,
            body: emailBody,
            from_name: 'M2 Fleet QC Team'
        });

        return new Response(JSON.stringify({
            success: true,
            message: 'Checklist sent successfully to lead tech',
            checklistUrl: checklistUrl
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error sending shadowing checklist:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Internal server error'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
