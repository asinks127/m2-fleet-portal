export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    return res.status(200).json({ success: true, delivered: false, message: 'Webhook delivery stubbed.' });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Internal error' });
  }
}
