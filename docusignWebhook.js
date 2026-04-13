export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    return res.status(200).json({ received: true, message: 'Webhook acknowledged.' });
  } catch (error) {
    return res.status(500).json({ error: "An unexpected error occurred. Please try again later." });
  }
}
