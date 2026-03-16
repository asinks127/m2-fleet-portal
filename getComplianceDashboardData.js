import { supabase, getAuthUser } from './_lib/supabaseServer.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const [{ data: users, error: usersError }, { data: wcRecords, error: wcError }, { data: certs, error: certsError }] = await Promise.all([
      supabase.from('User').select('*'),
      supabase.from('WorkersCompRecord').select('*'),
      supabase.from('SafetyCertification').select('*')
    ]);

    if (usersError) throw usersError;
    if (wcError) throw wcError;
    if (certsError) throw certsError;

    return res.status(200).json({
      data: {
        users: users || [],
        wcRecords: wcRecords || [],
        certifications: certs || []
      },
      error: null
    });
  } catch (error) {
    console.error('Error in getComplianceDashboardData:', error);
    return res.status(500).json({
      data: null,
      error: {
        message: error.message || 'Failed to fetch compliance data'
      }
    });
  }
}
