// POST /api/backfillCustomerProject — ported warranty maintenance function.
import { getAuthUser } from '../_lib/supabaseServer.js';
import { backfillCustomerProject } from './_warranty/maintenance.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const body = typeof req.body === 'object' ? req.body : {};
    const result = await backfillCustomerProject(body);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
