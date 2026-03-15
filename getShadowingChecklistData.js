import { supabase, getAuthUser } from './_lib/supabaseServer.js';

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });    const { checklistToken } = req.body;

    if (!checklistToken) {
        return res.status(400).json({ 
            success: false, 
            error: 'Checklist token is required.' 
        });
    }

    try {
        // Fetch checklist by token
        const checklists = await supabase.from('ShadowingChecklist').select('*').match({ 
            checklistToken 
        }).then(r => r.data || []);
        
        if (!checklists || checklists.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Checklist not found or token is invalid.' 
            });
        }
        
        const checklist = checklists[0];

        // Check if checklist is already completed
        if (checklist.workflowStatus === 'completed_by_trainer') {
            return res.status(400).json({ 
                success: false, 
                error: 'This checklist has already been completed.' 
            });
        }

        return res.status(200).json({
            success: true,
            checklist
        });

    } catch (error) {
        console.error('Error in getShadowingChecklistData function:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'An internal error occurred.'
        });
    }
}
