import { getAuthUser } from './_lib/supabaseServer.js';
export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });


  const { text, fields } = req.body || {};

  return res.status(200).json({
    success: true,
    extracted: {},
    input_preview: String(text || "").slice(0, 200),
    requested_fields: Array.isArray(fields) ? fields : [],
    provider: "stub",
    message: "Extraction endpoint is active. Add production extraction model/config on Monday."
  });
}
