// /api/insuranceDoc — mint a short-lived signed URL for a stored policy document (admin only)
// GET  ?policy_id=<uuid>   (preferred — resolves the policy's stored document)
// POST { policy_id } or { path }  (direct path also supported)
import { supabase, getAuthUser } from '../_lib/supabaseServer.js';

function isAdminAuth(user) {
  if (!user) return false;
  const email = (user.email || '').toLowerCase();
  const metaRole = user.user_metadata?.role || user.app_metadata?.role;
  if (metaRole === 'admin') return true;
  if (email.endsWith('@m2fleetcom.com') && !email.includes('.contractor@')) return true;
  return ['tjserota@gmail.com', 'zo-test@m2fleetcom.com'].includes(email);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!isAdminAuth(user)) return res.status(403).json({ error: 'Forbidden — admin only' });

  try {
    let path = null;
    if (req.method === 'GET') {
      const url = new URL(req.url, 'http://localhost');
      const policyId = url.searchParams.get('policy_id');
      if (!policyId) return res.status(400).json({ error: 'policy_id required' });
      const { data: policy, error } = await supabase
        .from('InsurancePolicy')
        .select('document_bucket, document_path, document_name')
        .eq('id', policyId)
        .single();
      if (error) throw error;
      if (!policy?.document_path) return res.status(404).json({ error: 'No certificate uploaded for this policy yet' });
      path = policy.document_path;
    } else if (req.method === 'POST') {
      const b = req.body || {};
      if (b.policy_id) {
        const { data: policy, error } = await supabase
          .from('InsurancePolicy')
          .select('document_bucket, document_path, document_name')
          .eq('id', b.policy_id)
          .single();
        if (error) throw error;
        if (!policy?.document_path) return res.status(404).json({ error: 'No certificate uploaded for this policy yet' });
        path = policy.document_path;
      } else if (b.path) {
        path = b.path;
      } else {
        return res.status(400).json({ error: 'policy_id or path required' });
      }
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const bucket = 'insurance-docs';
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 300); // 5 minutes
    if (error) throw error;
    return res.status(200).json({ signedUrl: data.signedUrl, path });
  } catch (error) {
    console.error('[insuranceDoc] error:', error);
    return res.status(500).json({ error: error.message || 'Document link failed' });
  }
}
