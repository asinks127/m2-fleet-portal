import { supabase } from './_lib/supabaseServer.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const action = url.searchParams.get('action') || 'list';
    const body = req.body || {};

    if (action === 'list') {
      let query = supabase.from('SignatureRequest').select('*').order('created_at', { ascending: false });

      if (body.technicianemail) {
        query = query.eq('technicianemail', body.technicianemail);
      }
      if (body.technicianid) {
        query = query.eq('technicianid', body.technicianid);
      }
      if (body.documentid) {
        query = query.eq('documentid', body.documentid);
      }
      if (body.status) {
        query = query.eq('status', body.status);
      }

      const { data, error } = await query;
      if (error) return json(res, 400, { error: error.message });

      return json(res, 200, { data });
    }

    if (action === 'get' && body.id) {
      const { data, error } = await supabase
        .from('SignatureRequest')
        .select('*')
        .eq('id', body.id)
        .single();

      if (error) return json(res, 400, { error: error.message });
      return json(res, 200, { data });
    }

    if (action === 'delete' && body.id) {
      const { error } = await supabase
        .from('SignatureRequest')
        .delete()
        .eq('id', body.id);

      if (error) return json(res, 400, { error: error.message });
      return json(res, 200, { success: true });
    }

    return json(res, 400, { error: 'Invalid action' });
  } catch (error) {
    console.error('signatureRequest error:', error);
    return json(res, 500, { error: error.message });
  }
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}
