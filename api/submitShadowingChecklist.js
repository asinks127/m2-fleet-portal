import { supabase, getAuthUser } from './_lib/supabaseServer.js';

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });    const { checklistToken, checklistData } = req.body;

    if (!checklistToken || !checklistData) {
        return res.status(400).json({ 
            success: false, 
            error: 'Missing required data.' 
        });
    }

    try {
        // Get the checklist by token
        const checklists = await supabase.from('ShadowingChecklist').select('*').match({ 
            checklistToken 
        }).then(r => r.data || []);
        
        if (!checklists || checklists.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Invalid checklist token.' 
            });
        }
        
        const checklist = checklists[0];
        
        if (checklist.workflowStatus === 'completed_by_trainer') {
            return res.status(400).json({ 
                success: false, 
                error: 'This checklist has already been completed.' 
            });
        }

        // Update the checklist with lead tech's input
        const updateData = {
            ...checklistData,
            workflowStatus: 'completed_by_trainer',
            completedByTrainerDate: new Date().toISOString()
        };

        await supabase.from('ShadowingChecklist').update(updateData).eq('id', checklist.id);

        // Send notification back to QC team
        const qcEmails = ['rmiller.contractor@m2fleetcom.com', 'choffman.contractor@m2fleetcom.com'];
        
        const emailBody = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #16a34a;">Shadowing Checklist Completed</h2>
                
                <p>A shadowing checklist has been completed by the assigned Lead Tech and is ready for your review:</p>
                
                <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 15px 0;">
                    <strong>Contractor:</strong> ${checklist.contractorName}<br>
                    <strong>Completed by (Lead Tech):</strong> ${checklist.trainerName} (${checklist.trainerEmail})<br>
                    <strong>Completed on:</strong> ${new Date().toLocaleDateString()}
                </div>
                
                <p>Please log into the M2 Fleet Portal and go to <strong>People → Shadowing Dashboard</strong> to review and approve this checklist.</p>
                
                <p>The checklist is now waiting for final QC approval before the contractor can move to the insurance and contract setup phase.</p>
                
                <p>Thank you!</p>
            </div>
        `;

        // Send to both QC managers
        for (const email of qcEmails) {
            await /* TODO: Setup Resend */ resend.emails.send({
                to: email,
                subject: `Shadowing Checklist Ready for Review - ${checklist.contractorName}`,
                body: emailBody,
                from_name: 'M2 Fleet Portal'
            });
        }

        return res.status(200).json({ 
            success: true, 
            message: 'Checklist submitted successfully.' 
        });

    } catch (error) {
        console.error('Error submitting shadowing checklist:', error);
        return res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
}
