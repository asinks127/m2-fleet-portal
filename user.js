import { supabase } from './_lib/supabaseServer.js';

export default async function handler(req, res) {
  try {
    const action = (req.body || {}).action || (req.query || {}).action;

    if (action === 'list') {
      const { data, error } = await supabase
        .from('User')
        .select('*')
        .order('full_name', { ascending: true });

      if (error) throw error;
      return json(res, 200, { data });
    }

    return json(res, 400, { error: 'Invalid action' });
  } catch (error) {
    console.error('user handler error:', error.message);
    return json(res, 500, { error: error.message });
  }
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}
