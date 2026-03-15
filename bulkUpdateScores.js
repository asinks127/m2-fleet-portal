import { supabase, getAuthUser } from './_lib/supabaseServer.js';

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });    
    try {
        
        // Ensure the caller is an authenticated admin
        const user = await getAuthUser(req);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Unauthorized: Admin access required.' });
        }

        // Fetch all users
        const allUsers = await supabase.from('User').select('*').then(r => r.data || []);

        // Filter for active contractors
        const activeContractors = allUsers.filter(u => 
            u.email && (
              u.email.toLowerCase().includes('.contractor@m2fleetcom.com') || 
              u.email.toLowerCase().includes('.contractor@smcinstallations.com')
            ) &&
            u.active !== false
        );

        if (activeContractors.length === 0) {
            return res.status(200).json({ success: true, message: 'No active contractors found to update.', count: 0 }));
        }

        // Create a list of update promises
        const updatePromises = activeContractors.map(tech => 
            supabase.from('User').update({
                velocitiScore: 90,
                avgQcScore: 90
            }).eq('id', tech.id)
        );

        // Execute all updates in parallel
        await Promise.all(updatePromises);

        return new Response(JSON.stringify({ 
            success: true, 
            message: `Successfully updated scores for ${activeContractors.length} technicians.`,
            count: activeContractors.length
        });

    } catch (error) {
        console.error('Error in bulkUpdateScores function:', error);
        return res.status(500).json({ 
            success: false, 
            error: error.message || 'An internal server error occurred.' 
        });
    }
}
