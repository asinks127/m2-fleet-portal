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
  INITIALS: 'initials',
  TEXT: 'text',
  DATE: 'date',
  CHECKBOX: 'checkbox',
  DROPDOWN: 'dropdown',
  FULL_NAME: 'full_name',
  EMAIL: 'email',
  COMPANY: 'company',
  TITLE: 'title',
  PHONE: 'phone',
  EIN: 'ein',
  NUMBER: 'number',
  AMOUNT: 'amount',
  CUSTOM: 'custom',
};

export default function SignerPage() {
  const { requestId, token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [session, setSession] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfError, setPdfError] = useState(null);
  const [fieldValues, setFieldValues] = useState({});
  const [sigImages, setSigImages] = useState({});
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
        const resp = await fetch('/api/getSigningSession', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await resp.json();

        if (!resp.ok) throw new Error(data?.error || 'Failed to load signing session');
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

        // Initialize field values with defaults (value string + _sigImage for signatures)
        const initial = {};
        const sigImages = {};
        (data.fields || []).forEach(f => {
          const dv = f.defaultValue;
          if (dv && typeof dv === 'object' && dv.value !== undefined) {
            initial[f.id] = dv.value || '';
            if (dv.signatureImage) sigImages[f.id] = dv.signatureImage;
          } else {
            initial[f.id] = dv || '';
          }
        });
        setFieldValues(initial);
        setSigImages(sigImages);
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
    const unsigned = [];
    for (const f of fields) {
      const val = fieldValues[f.id];
      if (f.type === FIELD_TYPES.SIGNATURE) {
        if (!sigRefs.current[f.id] || sigRefs.current[f.id].isEmpty()) {
          unsigned.push(f.label || `Signature ${unsigned.length + 1}`);
        }
      } else if (f.type === FIELD_TYPES.CHECKBOX) {
        if (f.required && !val) {
          setError(`Please check the required field: ${f.label || f.fieldName}`);
          return;
        }
      } else if (f.required && (!val || val.trim() === '')) {
        setError(`Please fill in the required field: ${f.label || f.fieldName}`);
        return;
      }
    }
    if (unsigned.length > 0) {
      setError(`Please sign all highlighted areas before submitting. Missing: ${unsigned.join(', ')}`);
      return;
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

      const resp = await fetch('/api/submitSignature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, field_values: valuesArray }),
      });
      const data = await resp.json();

      if (!resp.ok) throw new Error(data?.error || 'Failed to submit signature');
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
      const resp = await fetch('/api/submitSignature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, decline: true }),
      });
      const data = await resp.json();

      if (!resp.ok) throw new Error(data?.error || 'Failed to decline document');
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
  const originalPageWidth = session?.originalPageWidth || 612;
  const originalPageHeight = session?.originalPageHeight || 792;
  const recip = session?.recipient;
  const readOnly = String(session?.documentStatus || '').toLowerCase() === 'completed' || submitted;

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
          {readOnly ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-md">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-700">Document Completed</span>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDecline(true)}
              disabled={submitting}
            >
              Decline
            </Button>
          )}
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
                      originalWidth={originalPageWidth}
                      originalHeight={originalPageHeight}
                      readOnly={readOnly}
                      sigImage={sigImages[field.id]}
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
        {pdfUrl && fields.length > 0 && !readOnly && (
          <div className="flex items-center justify-between pb-8">
            <div className="text-sm">
              {Object.values(fieldValues).filter(v => v).length} of {fields.length} fields completed
            </div>
            <Button
              size="lg"
              onClick={handleSubmit}
              disabled={submitting || fields.some(f => f.type === FIELD_TYPES.SIGNATURE && !fieldValues[f.id]) || fields.some(f => f.required && f.type !== FIELD_TYPES.SIGNATURE && !fieldValues[f.id])}
              className="bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-50"
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
      {showDecline && !readOnly && (
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

// --- Field input component for non-signature fields ---
function FieldInput({ field, value, onChange }) {
  const isCheckbox = field.type === FIELD_TYPES.CHECKBOX;
  const isDropdown = field.type === FIELD_TYPES.DROPDOWN;

  if (isCheckbox) {
    return (
      <div className="flex items-center justify-center h-full">
        <input
          type="checkbox"
          checked={value === 'true' || value === true}
          onChange={(e) => onChange(String(e.target.checked))}
          className="w-5 h-5 accent-yellow-600 cursor-pointer"
        />
      </div>
    );
  }

  if (isDropdown && field.options && field.options.length > 0) {
    return (
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-full bg-transparent border-none text-sm text-slate-800 focus:outline-none cursor-pointer"
        placeholder="Select..."
      >
        <option value="" disabled>{field.label || 'Select...'}</option>
        {field.options.map((opt, i) => (
          <option key={i} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }

  const inputType = field.type === FIELD_TYPES.DATE ? 'date' :
                    field.type === FIELD_TYPES.NUMBER || field.type === FIELD_TYPES.AMOUNT ? 'number' :
                    field.type === FIELD_TYPES.EMAIL ? 'email' :
                    field.type === FIELD_TYPES.PHONE ? 'tel' :
                    'text';

  const placeholder = field.type === FIELD_TYPES.DATE ? 'MM/DD/YYYY' :
                      field.type === FIELD_TYPES.AMOUNT ? '$0.00' :
                      field.label || 'Enter value...';

  return (
    <input
      type={inputType}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-full bg-transparent border-none text-sm text-slate-800 focus:outline-none px-1"
      step={field.type === FIELD_TYPES.AMOUNT ? '0.01' : undefined}
    />
  );
}

// --- Field overlay component ---
function FieldOverlay({ field, value, sigRef, onChange, onClear, pageWidth, originalWidth, originalHeight, readOnly, sigImage }) {
  const docAspect = originalWidth && originalHeight ? originalHeight / originalWidth : 792 / 612;
  const renderedHeight = pageWidth * docAspect;

  // x,y are always percentages (0-100), convert to pixels relative to rendered PDF
  const scale = pageWidth / originalWidth;
  const left = ((field.x || 0) / 100) * pageWidth;
  const top = ((field.y || 0) / 100) * renderedHeight;
  const isSignature = field.type === FIELD_TYPES.SIGNATURE;
  const isSigned = value && value !== '';

  if (readOnly && !isSigned) return null;

  // In readOnly mode, auto-fit width to content. In edit mode, use template percentage.
  const rawWidth = field.width || 12;
  const maxWidthPct = isSignature ? 15 : (field.type === FIELD_TYPES.INITIALS ? 10 : (field.type === FIELD_TYPES.CHECKBOX ? 4 : 15));
  const cappedWidth = Math.min(rawWidth, maxWidthPct);
  const maxWidth = (cappedWidth / 100) * pageWidth;
  const width = readOnly ? 'auto' : maxWidth;
  const height = ((field.height || 4) / 100) * renderedHeight;

  // For readOnly signature fields, use the passed-in signature image URL

  function renderFieldInput() {
    if (readOnly) {
      if (isSignature) {
        if (sigImage) {
          return (
            <div className="flex items-center justify-center h-full">
              <img src={sigImage} alt="Signature" className="max-h-full max-w-full object-contain" />
            </div>
          );
        }
        return (
          <div className="flex items-center justify-center h-full">
            <span className="text-sm font-medium text-slate-700">Signed</span>
          </div>
        );
      }
      if (field.type === FIELD_TYPES.CHECKBOX) {
        return (
          <div className="flex items-center justify-center h-full">
            <span className="text-sm">{value === 'true' || value === true ? '☑' : '☐'}</span>
          </div>
        );
      }
      return (
        <div className="flex items-center h-full px-1">
          <span className={`text-sm whitespace-nowrap ${value ? 'text-slate-800' : 'text-gray-300 italic'}`}>{value || '—'}</span>
        </div>
      );
    }

    // ---- Edit mode below ----
    if (isSignature) {
      return (
        <SignatureCanvas
          ref={sigRef}
          canvasProps={{
            className: 'w-full h-full',
            style: { width: '100%', height: '100%', cursor: 'crosshair' }
          }}
          onEnd={() => onChange('Signed')}
          penColor="#1e40af"
          backgroundColor="transparent"
        />
      );
    }

    const placeholderMap = {
      [FIELD_TYPES.TEXT]: 'Type text…',
      [FIELD_TYPES.INITIALS]: 'Initials',
      [FIELD_TYPES.FULL_NAME]: 'Full name',
      [FIELD_TYPES.EMAIL]: 'email@example.com',
      [FIELD_TYPES.COMPANY]: 'Company name',
      [FIELD_TYPES.TITLE]: 'Title',
      [FIELD_TYPES.PHONE]: '(555) 123-4567',
      [FIELD_TYPES.EIN]: 'XX-XXXXXXX',
      [FIELD_TYPES.NUMBER]: '0',
      [FIELD_TYPES.AMOUNT]: '0.00',
      [FIELD_TYPES.CUSTOM]: 'Enter value…',
    };

    const placeholder = placeholderMap[field.type] || 'Enter value…';

    if (field.type === FIELD_TYPES.CHECKBOX) {
      return (
        <div className="flex items-center justify-center h-full">
          <input
            type="checkbox"
            checked={value === 'true' || value === true}
            onChange={e => onChange(e.target.checked ? 'true' : '')}
            className="w-5 h-5 cursor-pointer"
          />
        </div>
      );
    }

    if (field.type === FIELD_TYPES.DROPDOWN) {
      const options = field.options || [];
      return (
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full h-full bg-transparent text-sm text-slate-800 outline-none appearance-none cursor-pointer"
          style={{ padding: '0 8px' }}
        >
          <option value="">Select…</option>
          {options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }

    const inputType = field.type === FIELD_TYPES.DATE
      ? 'date'
      : field.type === FIELD_TYPES.NUMBER || field.type === FIELD_TYPES.AMOUNT
      ? 'number'
      : 'text';

    const step = field.type === FIELD_TYPES.AMOUNT ? '0.01' : undefined;
    const pattern = field.type === FIELD_TYPES.EIN ? '[0-9]{2}-[0-9]{7}' : undefined;

    return (
      <input
        type={inputType}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        step={step}
        pattern={pattern}
        className="w-full h-full bg-transparent text-sm text-slate-800 outline-none"
        style={{ padding: '0 8px' }}
      />
    );
  }

  const minHeight = isSignature ? 60 : field.type === FIELD_TYPES.CHECKBOX ? 24 : 28;

  return (
    <div
      className="absolute group z-10"
      style={{ left, top, maxWidth: width === 'auto' ? maxWidth : undefined, width, height: Math.max(height, minHeight) }}
    >
      <div className={`relative w-full h-full rounded transition-all ${
        readOnly
          ? (isSigned ? 'border-2 border-yellow-400 bg-yellow-100/70' : 'border-0 bg-transparent')
          : isSigned
          ? 'border-2 border-green-500 bg-green-100/60'
          : 'border-2 border-yellow-400 bg-yellow-100/70'
      }`}>
        {/* Label */}
        {readOnly ? (
          <div className="absolute -top-5 left-0 text-[10px] font-medium whitespace-nowrap text-gray-400 uppercase tracking-wide">
            {field.label || field.type}
          </div>
        ) : (
          <div className={`absolute -top-6 left-0 text-xs font-bold whitespace-nowrap ${isSigned ? 'text-green-600' : 'text-yellow-700'}`}>
            {isSigned ? '✓ FILLED' : field.label || field.type}
          </div>
        )}

        {/* Field input area */}
        <div className="w-full h-full flex items-center">
          {renderFieldInput()}
        </div>

        {/* Clear button */}
        {isSigned && !readOnly && (
          <button
            onClick={onClear}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow"
            title="Clear field"
          >
            ×
          </button>
        )}

        {/* Pulsating indicator */}
        {!isSigned && field.type !== FIELD_TYPES.SIGNATURE && !readOnly && (
          <div className="absolute inset-0 border-2 border-yellow-400 rounded animate-pulse pointer-events-none" />
        )}
      </div>
    </div>
  );
}
