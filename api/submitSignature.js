import { supabase } from '../_lib/supabaseServer.js';

export default async function handler(req, res) {
  try {
    const { token, field_values } = req.body || {};

    if (!token) {
      return res.status(400).json({ success: false, error: 'Missing token' });
    }

    // 1. Find the SignatureRequest
    const { data: sigReq, error: sigError } = await supabase
      .from('SignatureRequest')
      .select('*')
      .eq('signaturetoken', token)
      .single();

    if (sigError || !sigReq) {
      return res.json({ success: false, error: 'Invalid signing session' });
    }

    // 2. Update SignatureRequest with submitted values
    const { error: updateError } = await supabase
      .from('SignatureRequest')
      .update({
        status: 'Completed',
        signaturedata: field_values ? JSON.stringify(field_values) : null,
        signedat: new Date().toISOString(),
      })
      .eq('id', sigReq.id);

    if (updateError) {
      console.error('[submitSignature] Update error:', updateError);
      return res.status(500).json({ success: false, error: 'Failed to record signature' });
    }

    console.log('[submitSignature] Signature recorded for:', sigReq.technicianname);

    return res.json({
      success: true,
      documentStatus: 'completed',
      requestId: sigReq.id,
    });
  } catch (e) {
    console.error('[submitSignature] Error:', e);
    return res.status(500).json({ success: false, error: e.message });
  }
}
