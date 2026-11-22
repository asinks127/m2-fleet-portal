import { supabase } from './_lib/supabaseServer.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  try {
    const body = await new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => { data += chunk; });
      req.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Invalid JSON')); }
      });
      req.on('error', reject);
    });

    const { action, id, data } = body;

    let result;
    switch (action) {
      case 'create':
        result = await supabase
          .from('SignableDocument')
          .insert([data])
          .select();
        break;
      case 'update':
        if (!id) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'id required for update' }));
          return;
        }
        result = await supabase
          .from('SignableDocument')
          .update(data)
          .eq('id', id)
          .select();
        break;
      case 'delete':
        if (!id) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'id required for delete' }));
          return;
        }
        result = await supabase
          .from('SignableDocument')
          .delete()
          .eq('id', id)
          .select();
        break;
      default:
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Unknown action: ${action}` }));
        return;
    }

    if (result.error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: result.error.message || 'Database error' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: result.data }));
  } catch (error) {
    console.error('saveSignableDocument error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
}
