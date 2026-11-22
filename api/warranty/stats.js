// GET /api/warranty/stats — warranty statistics
import { getAuthUser, supabase } from '../../_lib/supabaseServer.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const [{ count: claimCount }, { count: issueCount }, { count: technicianCount }, { data: recentClaims }] = await Promise.all([
    supabase.from('WarrantyClaim').select('id', { count: 'exact', head: true }),
    supabase.from('QCIssue').select('id', { count: 'exact', head: true }),
    supabase.from('Technician').select('id', { count: 'exact', head: true }),
    supabase.from('WarrantyClaim').select('*').order('claim_date', { ascending: false }).limit(10),
  ]);
  return res.status(200).json({
    configured: Boolean(process.env.GMAIL_WARRANTY_USER && process.env.GMAIL_WARRANTY_APP_PASSWORD),
    total_warranty_claims: claimCount || 0,
    total_qc_issues: issueCount || 0,
    total_technicians: technicianCount || 0,
    recent_claims: recentClaims || [],
  });
}