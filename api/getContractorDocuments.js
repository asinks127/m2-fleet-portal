import { supabase, getAuthUser } from './_lib/supabaseServer.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });


  try {
    const { data, error } = await supabase.from('ContractorDocument').select('*').order('created_at', { ascending: false }).limit(500); if (error) throw error; return res.status(200).json(data || []);
  } catch (error) {
    return res.status(500).json({ error: "An unexpected error occurred. Please try again later." });
  }
}
