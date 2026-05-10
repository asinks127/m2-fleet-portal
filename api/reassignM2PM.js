import { supabase, getAuthUser } from './_lib/supabaseServer.js';

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    try {        
        // This is a powerful admin function. Ensure the user is an admin.
        const user = await getAuthUser(req);
        if (!user || user.role !== 'admin') {
            return res.status(401).json({ success: false, error: 'Unauthorized: Admin access required.' });
        }

        
        const allUsers = await supabase.from('User').select('*').then(r => r.data || []);

        let updatedCount = 0;
        const updatePromises = [];

        for (const u of allUsers) {
            // Be very specific with the name to avoid accidental changes.
            if (u.m2PM === 'Adam McCormack') {
                updatePromises.push(
                    supabase.from('User').update({ m2PM: 'Austin Sinks' }).eq('id', u.id)
                );
                updatedCount++;
            }
        }

        // Run all updates in parallel for efficiency.
        if (updatePromises.length > 0) {
            await Promise.all(updatePromises);
        }

        return res.status(200).json({ 
            success: true, 
            message: `Migration complete. ${updatedCount} technician(s) were reassigned from Adam McCormack to Austin Sinks.`,
            count: updatedCount
        });

    } catch (error) {
        console.error('Error in reassignM2PM function:', error);
        return res.status(500).json({ 
            success: false, 
            error: error.message || 'An internal server error occurred.' 
        });
    }
}
