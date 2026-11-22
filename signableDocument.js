import { supabase } from './_lib/supabaseServer.js';

export default async function handler(req, res) {
  try {
    const { action, id, title, content, fileUrl, originalfileurl, documenttype, status, isactive } = req.body || {};

    switch (action) {
      case 'list': {
        const { data, error } = await supabase
          .from('SignableDocument')
          .select('*')
          .order('created_date', { ascending: false });

        if (error) {
          return res.status(400).json({ error: error.message });
        }
        return res.json({ data });
      }

      case 'create': {
        const insertData = {
          title,
          content: content || '',
          fileUrl: fileUrl || null,
          originalfileurl: originalfileurl || null,
          documenttype: documenttype || 'text',
          status: status || 'pending',
          isactive: isactive || 'true',
        };

        const { data, error } = await supabase
          .from('SignableDocument')
          .insert(insertData)
          .select()
          .single();

        if (error) {
          return res.status(400).json({ error: error.message });
        }
        return res.json({ data });
      }

      case 'update': {
        if (!id) {
          return res.status(400).json({ error: 'Missing document ID' });
        }

        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (content !== undefined) updateData.content = content;
        if (fileUrl !== undefined) updateData.fileUrl = fileUrl;
        if (originalfileurl !== undefined) updateData.originalfileurl = originalfileurl;
        if (documenttype !== undefined) updateData.documenttype = documenttype;
        if (status !== undefined) updateData.status = status;
        if (isactive !== undefined) updateData.isactive = isactive;


        const { data, error } = await supabase
          .from('SignableDocument')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          return res.status(400).json({ error: error.message });
        }
        return res.json({ data });
      }

      case 'delete': {
        if (!id) {
          return res.status(400).json({ error: 'Missing document ID' });
        }

        const { error } = await supabase
          .from('SignableDocument')
          .delete()
          .eq('id', id);

        if (error) {
          return res.status(400).json({ error: error.message });
        }
        return res.json({ success: true });
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error('signableDocument API error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
