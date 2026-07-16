import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient.js';
import { Document, Page, pdfjs } from 'react-pdf';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Loader2, FileText, PenTool, CheckCircle2, AlertCircle, XCircle, ArrowLeft } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const FIELD_TYPES = {
  SIGNATURE: 'signature',
  TEXT: 'text',
  DATE: 'date',
  CHECKBOX: 'checkbox',
  EMAIL: 'email',
  COMPANY: 'company',
  NAME: 'name',
};

export default function SignerPage() {
  const { requestId, token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [session, setSession] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfError, setPdfError] = useState(null);
  const [fieldValues, setFieldValues] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [showDecline, setShowDecline] = useState(false);
  const [declining, setDeclining] = useState(false);
  const sigRefs = useRef({});
  const containerRef = useRef(null);
  const [pageWidth, setPageWidth] = useState(612);

  // Load signing session via RPC
  useEffect(() => {
    (async () => {
      try {
        const { data, error: rpcError } = await supabase.rpc('esign_load_signing_session', {
          p_token: token,
        });

        if (rpcError) throw new Error(rpcError.message);
        if (!data || data.success === false) {
          throw new Error(data?.error || 'Failed to load signing session');
        }

        setSession(data);

        // Generate signed URL for the PDF
        if (data.document?.sourcePdfPath) {
          const { data: urlData, error: urlErr } = await supabase.storage
            .from('esign-documents')
            .createSignedUrl(data.document.sourcePdfPath, 3600);

          if (urlErr) {
            setPdfError('Could not load the document PDF.');
          } else if (urlData?.signedUrl) {
            setPdfUrl(urlData.signedUrl);
          }
        }

        // Initialize field values with defaults
        const initial = {};
        (data.fields || []).forEach(f => {
          initial[f.id] = f.defaultValue || '';
        });
        setFieldValues(initial);
      } catch (e) {
        setError(e.message || 'An error occurred while loading your signing session.');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  // Track container width for responsive PDF scaling
  useEffect(() => {
    if (!containerRef.current) return;
    const update = () => {
      if (containerRef.current) {
        const w = Math.min(containerRef.current.clientWidth - 32, 850);
        setPageWidth(Math.max(w, 300));
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const handleFieldChange = useCallback((fieldId, value) => {
    setFieldValues(prev => ({ ...prev, [fieldId]: value }));
  }, []);

  const clearSignature = useCallback((fieldId) => {
    if (sigRefs.current[fieldId]) {
      sigRefs.current[fieldId].clear();
    }
    handleFieldChange(fieldId, '');
  }, [handleFieldChange]);

  const handleSubmit = async () => {
    // Validate required fields
    const fields = session?.fields || [];
    for (const f of fields) {
      if (f.required) {
        const val = fieldValues[f.id];
        if (f.type === FIELD_TYPES.SIGNATURE) {
          if (sigRefs.current[f.id] && sigRefs.current[f.id].isEmpty()) {
            setError(`Please complete the required field: ${f.label || 'Signature'}`);
            return;
          }
        } else if (!val || val.trim() === '') {
          setError(`Please fill in the required field: ${f.label || f.fieldName}`);
          return;
        }
      }
    }
    setError(null);
    setSubmitting(true);

    try {
      // Build field values array for the RPC
      const valuesArray = fields.map(f => {
        let value = fieldValues[f.id] || '';
        let signatureImage = null;

        if (f.type === FIELD_TYPES.SIGNATURE && sigRefs.current[f.id]) {
          const sig = sigRefs.current[f.id];
          if (!sig.isEmpty()) {
            signatureImage = sig.toDataURL('image/png');
            value = 'Signed';
          }
        }

        return {
          fieldId: f.id,
          value,
          signatureImage,
        };
      });

      const { data, error: rpcError } = await supabase.rpc('esign_submit_signing', {
        p_token: token,
        p_field_values: valuesArray,
      });

      if (rpcError) throw new Error(rpcError.message);
      if (!data || data.success === false) {
        throw new Error(data?.error || 'Failed to submit signature');
      }

      setSubmitResult(data);
      setSubmitted(true);
    } catch (e) {
      setError(e.message || 'An error occurred while submitting your signature.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = async () => {
    setDeclining(true);
    try {
      const { data, error: rpcError } = await supabase.rpc('esign_decline_document', {
        p_token: token,
        p_reason: 'Declined by signer',
      });

      if (rpcError) throw new Error(rpcError.message);
      if (!data || data.success === false) {
        throw new Error(data?.error || 'Failed to decline document');
      }

      setSubmitted(true);
      setSubmitResult({ documentStatus: 'declined' });
    } catch (e) {
      setError(e.message);
    } finally {
      setDeclining(false);
      setShowDecline(false);
    }
  };

  // --- Loading state ---
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-slate-700 mx-auto mb-4" />
          <p className="text-slate-600 text-lg">Loading your document…</p>
        </div>
      </div>
    );
  }

  // --- Error state ---
  if (error && !submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Unable to Load Document</h2>
            <p className="text-slate-600 mb-4">{error}</p>
            <p className="text-sm text-slate-400">
              If you believe this is an error, please contact M2 Fleet Communications.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Submitted / completed state ---
  if (submitted) {
    const isCompleted = submitResult?.documentStatus === 'completed';
    const isDeclined = submitResult?.documentStatus === 'declined';
    const awaiting = submitResult?.documentStatus === 'awaiting_others';

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            {isDeclined ? (
              <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            ) : (
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
            )}
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              {isDeclined ? 'Document Declined' : 'Signature Submitted!'}
            </h2>
            <p className="text-slate-600 mb-4">
              {isDeclined
                ? 'You have declined to sign this document.'
                : isCompleted
                ? 'All parties have signed. The document is now complete.'
                : awaiting
                ? 'Your signature has been recorded. We are waiting for other recipients to sign.'
                : 'Your signature has been submitted successfully.'}
            </p>
            {!isDeclined && (
              <p className="text-sm text-slate-400">
                You will receive a copy of the completed document via email once all parties have signed.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Signing form ---
  const fields = session?.fields || [];
  const doc = session?.document;
  const recip = session?.recipient;

  // Group fields by page
  const fieldsByPage = {};
  fields.forEach(f => {
    const p = f.pageNumber || 1;
    if (!fieldsByPage[p]) fieldsByPage[p] = [];
    fieldsByPage[p].push(f);
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-slate-700" />
            <div>
              <h1 className="text-lg font-semibold text-slate-900">{doc?.name || 'Document'}</h1>
              <p className="text-xs text-slate-500">
                For: {recip?.name || 'You'} {recip?.email ? `(${recip.email})` : ''}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDecline(true)}
            disabled={submitting}
          >
            Decline
          </Button>
        </div>
      </header>

      {error && (
        <div className="max-w-5xl mx-auto px-4 pt-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      <div ref={containerRef} className="max-w-5xl mx-auto px-4 py-6">
        {/* PDF Document */}
        {pdfUrl ? (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 mb-6 overflow-hidden">
            <Document
              file={pdfUrl}
              loading={<div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>}
              error={<div className="flex items-center justify-center py-20 text-red-500"><AlertCircle className="w-5 h-5 mr-2" /> Could not load PDF.</div>}
            >
              {Object.keys(fieldsByPage).sort((a, b) => a - b).map(pageNum => (
                <div key={pageNum} className="relative border-b border-slate-100 last:border-b-0">
                  <Page pageNumber={parseInt(pageNum)} width={pageWidth} renderTextLayer={false} renderAnnotationLayer={false} />
                  {/* Field overlays */}
                  {fieldsByPage[pageNum].map(field => (
                    <FieldOverlay
                      key={field.id}
                      field={field}
                      value={fieldValues[field.id]}
                      sigRef={el => { if (el) sigRefs.current[field.id] = el; }}
                      onChange={v => handleFieldChange(field.id, v)}
                      onClear={() => clearSignature(field.id)}
                      pageWidth={pageWidth}
                      originalWidth={doc?.pageWidth || 612}
                      originalHeight={doc?.pageHeight || 792}
                    />
                  ))}
                </div>
              ))}
            </Document>
          </div>
        ) : pdfError ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center text-red-600 mb-6">
            {pdfError} Please contact M2 Fleet to request a new signing link.
          </div>
        ) : (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        )}

        {/* Submit button */}
        {pdfUrl && (
          <div className="flex items-center justify-end gap-3 pb-8">
            <Button
              size="lg"
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-slate-900 hover:bg-slate-800 text-white"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  <PenTool className="w-4 h-4 mr-2" />
                  Sign & Submit
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Decline confirmation */}
      {showDecline && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDecline(false)}>
          <Card className="max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Decline to Sign?</h3>
              <p className="text-sm text-slate-600 mb-4">
                This will mark the document as declined. The sender will be notified. This action cannot be undone.
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowDecline(false)}>Cancel</Button>
                <Button variant="destructive" onClick={handleDecline} disabled={declining}>
                  {declining ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Yes, Decline'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// --- Field overlay component ---
function FieldOverlay({ field, value, sigRef, onChange, onClear, pageWidth, originalWidth, originalHeight }) {
  const scaleX = pageWidth / originalWidth;
  const scaleY = scaleX; // assume uniform scale
  const left = (field.x || 50) * scaleX;
  const top = (field.y || 50) * scaleY;
  const width = (field.width || 200) * scaleX;
  const height = (field.height || 40) * scaleY;

  const isSignature = field.type === FIELD_TYPES.SIGNATURE;

  return (
    <div
      className="absolute"
      style={{ left, top, width, height }}
    >
      {field.label && (
        <span className="absolute -top-5 left-0 text-xs text-slate-500 whitespace-nowrap">
          {field.label}{field.required && <span className="text-red-500"> *</span>}
        </span>
      )}
      {isSignature ? (
        <div className="w-full h-full border-2 border-dashed border-slate-300 rounded bg-white relative">
          <SignatureCanvas
            ref={sigRef}
            canvasProps={{ className: 'w-full h-full', style: { width: '100%', height: '100%' } }}
            onEnd={() => onChange('Signed')}
          />
          {value && (
            <button
              onClick={onClear}
              className="absolute top-0 right-0 text-xs text-red-500 hover:text-red-700 px-1"
            >
              Clear
            </button>
          )}
        </div>
      ) : field.type === FIELD_TYPES.CHECKBOX ? (
        <input
          type="checkbox"
          checked={value === true || value === 'true' || value === 'on'}
          onChange={e => onChange(e.target.checked)}
          className="w-5 h-5 mt-1"
        />
      ) : (
        <input
          type={field.type === FIELD_TYPES.DATE ? 'date' : field.type === FIELD_TYPES.EMAIL ? 'email' : 'text'}
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={field.label || field.fieldName}
          className="w-full h-full border-2 border-dashed border-slate-300 rounded bg-white/90 px-2 text-sm focus:border-slate-500 focus:outline-none"
        />
      )}
    </div>
  );
}
