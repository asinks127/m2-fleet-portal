// POST /api/updateTechnicianStats — recompute operational stats for one technician.
// Body: { technician_id }
import { getAuthUser } from '../_lib/supabaseServer.js';
import { recalcTechnicianStats } from './_warranty/warrantyService.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const body = typeof req.body === 'object' ? req.body : {};
    const technician_id = body.technician_id;
    if (!technician_id) return res.status(400).json({ error: 'Missing technician_id' });

    const stats = await recalcTechnicianStats(technician_id);
    return res.status(200).json({ updated: true, technician_id, stats });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
