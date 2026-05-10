import { getAuthUser } from './_lib/supabaseServer.js';
export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });


  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: "prompt is required" });

  return res.status(200).json({
    success: true,
    image_url: null,
    provider: "stub",
    message: "Image endpoint is active. Wire a real image provider/API key on Monday."
  });
}
