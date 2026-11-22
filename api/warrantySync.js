// GET/POST /api/warrantySync — email ingestion for the warranty flow.
// POST { mode: 'sync'|'backfill', start_date, end_date, max }
// sync: last 48h of scheduling@m2fleetcom.com; backfill: custom date range.
// GET: configuration + last-run status.
import { getAuthUser } from '../_lib/supabaseServer.js';
import { syncWarrantyEmails, warrantySyncState } from './_warranty/warrantyService.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    return res.status(200).json({
      configured: Boolean(process.env.GMAIL_WARRANTY_USER && process.env.GMAIL_WARRANTY_APP_PASSWORD),
      mailbox: process.env.GMAIL_WARRANTY_USER || null,
      ...warrantySyncState,
    });
  }

  try {
    const body = typeof req.body === 'object' ? req.body : {};
    const result = await syncWarrantyEmails({
      mode: body.mode || 'sync',
      start_date: body.start_date,
      end_date: body.end_date,
      max: body.max || 100,
    });
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
