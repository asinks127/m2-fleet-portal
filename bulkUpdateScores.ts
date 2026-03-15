import { supabase } from '../src/lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();    
    try {
        const base44Admin = base44.asServiceRole;

        // Ensure the caller is an authenticated admin
        const user = await base44.auth.me();
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Unauthorized: Admin access required.' });
        }

        // Fetch all users
        const allUsers = await base44Admin.entities.User.list();

        // Filter for active contractors
        const activeContractors = allUsers.filter(u => 
            u.email && (
              u.email.toLowerCase().includes('.contractor@m2fleetcom.com') || 
              u.email.toLowerCase().includes('.contractor@smcinstallations.com')
            ) &&
            u.active !== false
        );

        if (activeContractors.length === 0) {
            return new Response(JSON.stringify({ success: true, message: 'No active contractors found to update.', count: 0 }));
        }

        // Create a list of update promises
        const updatePromises = activeContractors.map(tech => 
            base44Admin.entities.User.update(tech.id, {
                velocitiScore: 90,
                avgQcScore: 90
            })
        );

        // Execute all updates in parallel
        await Promise.all(updatePromises);

        return new Response(JSON.stringify({ 
            success: true, 
            message: `Successfully updated scores for ${activeContractors.length} technicians.`,
            count: activeContractors.length
        }), { 
            status: 200, 
            headers: { 'Content-Type': 'application/json' } 
        });

    } catch (error) {
        console.error('Error in bulkUpdateScores function:', error);
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message || 'An internal server error occurred.' 
        }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
}
