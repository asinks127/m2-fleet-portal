import { supabase } from '../_lib/supabaseServer.js';
import { getAuthUser } from '../_lib/supabaseServer.js';

function auth(req) { return getAuthUser(req); }
function classify(subject = '', body = '') {
  const text = `${subject} ${body}`.toLowerCase();
  if (/unavailab|out of office|pto|vacation|sick|cannot work|can't work|not available/.test(text)) return 'tech_unavailability';
  if (/schedule|scheduling|reschedule|upcoming work|work request|assign|appointment|task/.test(text)) return 'pending_request';
  return 'other';
}
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!(await auth(req))) return res.status(401).json({ error: 'Unauthorized' });
  const body = req.body || {};
  if (body.action === 'status') {
    const { data, error } = await supabase.from('SchedulingEmail').update({ status: body.status, updated_at: new Date().toISOString() }).eq('id', body.id).select().single();
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json(data);
  }
  if (body.action === 'sync') return res.status(200).json({ configured: true, message: 'Use the connected scheduling@m2fleetcom.com Gmail mailbox to sync pending scheduling requests and technician unavailability notices.' });
  const { data, error } = await supabase.from('SchedulingEmail').select('*').order('received_at', { ascending: false }).limit(250);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ messages: (data || []).map((row) => ({ ...row, category: row.category || classify(row.subject, row.body_text) })) });
}
