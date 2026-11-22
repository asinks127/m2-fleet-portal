import { supabase } from '../_lib/supabaseServer.js';

export default async function handler(req, res) {
  try {
    const { token } = req.body || {};

    if (!token) {
      return res.status(400).json({ success: false, error: 'Missing token' });
    }

    // 1. Find the SignatureRequest by token
    const { data: sigReq, error: sigError } = await supabase
      .from('SignatureRequest')
      .select('*')
      .eq('signaturetoken', token)
      .single();

    if (sigError || !sigReq) {
      console.log('[getSigningSession] Token not found:', token);
      return res.json({ success: false, error: 'Invalid signing link' });
    }

    const isCompleted = sigReq.status === 'Completed';

    if (sigReq.status === 'Declined') {
      return res.json({
        success: true,
        documentStatus: 'declined',
        document: { title: sigReq.documenttitle }
      });
    }

    // 2. Get the SignableDocument for PDF path and fields
    const { data: doc, error: docError } = await supabase
      .from('SignableDocument')
      .select('*')
      .eq('id', sigReq.documentid)
      .single();

    if (docError || !doc) {
      console.log('[getSigningSession] SignableDocument not found:', sigReq.documentid);
      if (isCompleted) {
        return res.json({
          success: true,
          documentStatus: 'completed',
          document: { title: sigReq.documenttitle }
        });
      }
      return res.json({ success: false, error: 'Document not found' });
    }

    // 3. Parse completed field values from signaturedata
    let completedValues = {};
    if (isCompleted && sigReq.signaturedata) {
      try {
        const raw = typeof sigReq.signaturedata === 'string'
          ? JSON.parse(sigReq.signaturedata)
          : sigReq.signaturedata;
        if (Array.isArray(raw)) {
          raw.forEach(item => {
            if (item && item.fieldId) {
              completedValues[item.fieldId] = {
                value: item.value || '',
                signatureImage: item.signatureImage || null,
              };
            }
          });
        } else if (raw && typeof raw === 'object') {
          // Convert flat object to include signatureImage if present
          const mapped = {};
          for (const [key, val] of Object.entries(raw)) {
            mapped[key] = typeof val === 'object' ? val : { value: val || '', signatureImage: null };
          }
          completedValues = mapped;
        }
      } catch (e) {
        console.log('[getSigningSession] Could not parse signaturedata:', e.message);
      }
    }

    // 4. Parse signature fields from content JSON or signaturefields column
    let fields = [];
    try {
      if (doc.content) {
        const parsed = typeof doc.content === 'string' ? JSON.parse(doc.content) : doc.content;
        if (parsed.signatureFields && Array.isArray(parsed.signatureFields)) {
          fields = parsed.signatureFields.map((f, i) => {
            const fieldId = f.id || `field_${i}`;
            return {
              id: fieldId,
              type: f.type || "signature",
              pageNumber: f.page || f.pageNumber || 1,
              x: f.x || 0,
              y: f.y || 0,
              width: (f.width || 12) >= 100 ? Math.min(((f.width || 12) / 612) * 100, 18) : (f.width || 12),
              height: (f.height || 4) > 50 ? ((f.height || 4) / 792) * 100 : (f.height || 4),
              label: f.label || "Sign Here",
              required: f.required !== false,
              defaultValue: isCompleted ? (completedValues[fieldId] || completedValues[f.label] || '') : '',
            };
          });
        }
      } else if (doc.signaturefields) {
        const rawFields = typeof doc.signaturefields === "string"
          ? JSON.parse(doc.signaturefields)
          : doc.signaturefields;
        fields = (rawFields || []).map(f => ({
          ...f,
          pageNumber: f.pageNumber || f.page || 1,
          defaultValue: isCompleted ? (completedValues[f.id] || completedValues[f.label] || '') : '',
        }));
      }
    } catch (e) {
      fields = [];
    }

    // 5. Determine PDF source path
    let sourcePdfPath = null;
    if (doc.fileUrl) {
      const match = doc.fileUrl.match(/\/storage\/v1\/object\/public\/esign-documents\/(.+)/);
      if (match) {
        sourcePdfPath = match[1];
      }
    }
    if (!sourcePdfPath && doc.originalfileurl) {
      sourcePdfPath = doc.originalfileurl;
    }

    // 6. Build session
    const session = {
      success: true,
      document: {
        id: doc.id,
        title: doc.title || sigReq.documenttitle,
        sourcePdfPath,
      },
      fields,
      requestId: sigReq.id,
      technicianName: sigReq.technicianname,
      documentStatus: sigReq.status,
      signedAt: sigReq.signedat || null,
      pageWidth: 612,
      pageHeight: 792
    };

    console.log('[getSigningSession] Session loaded:', doc.title, 'fields:', fields.length, 'status:', sigReq.status);
    return res.json(session);
  } catch (e) {
    console.error('[getSigningSession] Error:', e);
    return res.status(500).json({ success: false, error: e.message });
  }
}
