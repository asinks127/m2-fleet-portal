import { supabase } from '../src/lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();    const { checklistToken } = req.body;

    if (!checklistToken) {
        return new Response(JSON.stringify({ 
            success: false, 
            error: 'Checklist token is required.' 
        }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        // Fetch checklist by token
        const checklists = await base44.asServiceRole.entities.ShadowingChecklist.filter({ 
            checklistToken 
        });
        
        if (!checklists || checklists.length === 0) {
            return new Response(JSON.stringify({ 
                success: false, 
                error: 'Checklist not found or token is invalid.' 
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        const checklist = checklists[0];

        // Check if checklist is already completed
        if (checklist.workflowStatus === 'completed_by_trainer') {
            return new Response(JSON.stringify({ 
                success: false, 
                error: 'This checklist has already been completed.' 
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({
            success: true,
            checklist
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error in getShadowingChecklistData function:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'An internal error occurred.'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
