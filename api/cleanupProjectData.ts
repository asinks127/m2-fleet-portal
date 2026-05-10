import { supabase } from '../src/lib/supabaseClient';

// Helper function to normalize project names
const normalizeProject = (name) => {
    if (!name) return 'Unassigned';
    const lowerName = name.toLowerCase().trim();
    if (lowerName.includes('sunbelt')) return 'Sunbelt';
    if (lowerName.includes('ford')) return 'Ford';
    if (lowerName.includes('velociti')) return 'Velociti';
    if (lowerName.includes('samsara')) return 'Samsara';
    if (lowerName.includes('pepsi')) return 'PepsiCo';
    if (lowerName.includes('sysco')) return 'Sysco';
    if (lowerName.includes('internal')) return 'Internal';
    return name; // Return original if no match
};

// Helper function to normalize PM names
const normalizePm = (name) => {
    if (!name) return null;
    const lowerName = name.toLowerCase().trim();
    if (lowerName.includes('austin')) return 'Austin';
    if (lowerName.includes('orville')) return 'Orville';
    if (lowerName.includes('lena')) return 'Lena';
    if (lowerName.includes('steve')) return 'Steve';
    if (lowerName.includes('adam')) return 'Adam';
    if (lowerName.includes('jason')) return 'Jason';
    if (lowerName.includes('erica')) return 'Erica';
    return name; // Return original if no match
};

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
    // This is a powerful function, ensure it's called by an admin
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const users = await supabase.from('User').select('*');
        let updatedCount = 0;

        for (const u of users) {
            const updatePayload = {};

            const normalizedProject = normalizeProject(u.project);
            if (normalizedProject !== u.project) {
                updatePayload.project = normalizedProject;
            }

            const normalizedM2PM = normalizePm(u.m2PM);
            if (normalizedM2PM !== u.m2PM) {
                updatePayload.m2PM = normalizedM2PM;
            }

            const normalizedVeloPM = normalizePm(u.veloPM);
            if (normalizedVeloPM !== u.veloPM) {
                updatePayload.veloPM = normalizedVeloPM;
            }

            if (Object.keys(updatePayload).length > 0) {
                await supabase.from('User').update(updatePayload).eq('id', u.id);
                updatedCount++;
            }
        }

        return new Response(JSON.stringify({ success: true, message: `Cleanup complete. ${updatedCount} technician profiles were standardized.` }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Error during data cleanup:', error);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
