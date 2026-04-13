import { getAuthUser } from './_lib/supabaseServer.js';
export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });


  try {
    const { fileUrl } = req.body || {};
    if (!fileUrl) return res.status(400).json({ error: 'Missing fileUrl parameter' });

    const response = await fetch(fileUrl);
    if (!response.ok) {
      return res.status(502).json({ error: 'Failed to fetch PDF' });
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    return res.status(200).json({
      success: true,
      data: base64,
      contentType: response.headers.get('content-type') || 'application/pdf'
    });
  } catch (error) {
    console.error('Proxy PDF error:', error);
    return res.status(500).json({ error: error.message || 'Proxy failed' });
  }
}
