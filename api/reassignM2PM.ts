import { supabase } from '../src/lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

    try {        
        // This is a powerful admin function. Ensure the user is an admin.
        const user = await base44.auth.me();
        if (!user || user.role !== 'admin') {
            return Response.json({ success: false, error: 'Unauthorized: Admin access required.' }, { status: 401 });
        }

        const base44Admin = base44.asServiceRole;

        const allUsers = await base44Admin.entities.User.list();

        let updatedCount = 0;
        const updatePromises = [];

        for (const u of allUsers) {
            // Be very specific with the name to avoid accidental changes.
            if (u.m2PM === 'Adam McCormack') {
                updatePromises.push(
                    base44Admin.entities.User.update(u.id, { m2PM: 'Austin Sinks' })
                );
                updatedCount++;
            }
        }

        // Run all updates in parallel for efficiency.
        if (updatePromises.length > 0) {
            await Promise.all(updatePromises);
        }

        return new Response(JSON.stringify({ 
            success: true, 
            message: `Migration complete. ${updatedCount} technician(s) were reassigned from Adam McCormack to Austin Sinks.`,
            count: updatedCount
        }), { 
            status: 200, 
            headers: { 'Content-Type': 'application/json' } 
        });

    } catch (error) {
        console.error('Error in reassignM2PM function:', error);
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message || 'An internal server error occurred.' 
        }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
}
