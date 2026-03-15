import { supabase, getAuthUser } from './_lib/supabaseServer.js';

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {    
    // Verify user is authenticated
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Fetch all necessary data using service role for admin access
    const [users, wcRecords] = await Promise.all([
      supabase.from('User').select('*'),
      supabase.from('WorkersCompRecord').select('*')
    ]);

    return Response.json({
      data: {
        users,
        wcRecords
      },
      error: null
    });

  } catch (error) {
    console.error('Error in getComplianceDashboardData:', error);
    return Response.json({
      data: null,
      error: {
        message: error.message || 'Failed to fetch compliance data',
        stack: error.stack
      }
    }, { status: 500 });
  }
}
