import { supabase } from '../src/lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  try {    
    // Verify user is authenticated
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
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
