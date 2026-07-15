import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient.js';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { FileText, Loader2, CheckCircle2, AlertCircle, PenLine, Type, X } from 'lucide-react';

export default function SignDocument() {
  const { requestId, token } = useParams();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fieldValues, setFieldValues] = useState({});
  const [signing, setSigning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfBytes, setPdfBytes] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showSigPad, setShowSigPad] = useState(null); // fieldId being signed
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);

  // ---- Load signing session ----
  useEffect(() => {
    loadSession();
  }, [token]);

  const loadSession = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc('esign_load_signing_session', { p_token: token });
      if (rpcErr) throw new Error(rpcErr.message);
      if (!data || data.error) throw new Error(data?.error || 'Invalid signing link');

      setSession(data);

      // Load the original PDF for preview + finalization
      const pdfPath = data?.document?.sourcePdfPath;
      if (pdfPath) {
        const { data: fileData, error: dlErr } = await supabase.storage
          .from('esign-documents').download(pdfPath);
        if (!dlErr && fileData) {
          const ab = await fileData.arrayBuffer();
          setPdfBytes(new Uint8Array(ab));
          const blob = new Blob([ab], { type: 'application/pdf' });
          setPdfUrl(URL.createObjectURL(blob));
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ---- Signature pad handlers ----
  const startDraw = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setDrawing(true);
  };

  const draw = (e) => {
    if (!drawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const endDraw = () => setDrawing(false);

  const clearSig = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const saveSig = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    // Check if canvas has content
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const hasContent = imgData.data.some((v, i) => i % 4 === 3 && v > 0);
    if (!hasContent) return;

    const dataUrl = canvas.toDataURL('image/png');
    setFieldValues({ ...fieldValues, [showSigPad]: dataUrl });
    setShowSigPad(null);
  };

  const useTypedSig = () => {
    const name = session?.recipient?.name || '';
    setFieldValues({ ...fieldValues, [showSigPad]: name });
    setShowSigPad(null);
  };

  // ---- Submit signing ----
  const handleSubmit = async () => {
    setSigning(true);
    try {
      // Validate required fields
      const requiredFields = (session?.fields || []).filter((f) => f.required);
      for (const f of requiredFields) {
        if (!fieldValues[f.id]) {
          throw new Error(`Please complete the required field: ${f.label || f.type}`);
        }
      }

      // Submit via RPC — convert fieldValues object to array format
      const fieldArray = Object.entries(fieldValues).map(([fieldId, value]) => ({
        fieldId,
        value,
        signatureImage: typeof value === 'string' && value.startsWith('data:image') ? value : null,
      }));
      const { data: result, error: rpcErr } = await supabase.rpc('esign_submit_signing', {
        p_token: token,
        p_field_values: fieldArray,
      });
      if (rpcErr) throw new Error(rpcErr.message);
      if (!result || result.error) throw new Error(result?.error || 'Submission failed');

      // If all recipients signed, finalize the PDF
      if (result.documentStatus === 'completed' && pdfBytes) {
        await finalizePdf(session?.document?.id);
      }

      setCompleted(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSigning(false);
    }
  };

  const finalizePdf = async (documentId) => {
    try {
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const pages = pdfDoc.getPages();

      // Get all field values for all recipients (from the completion RPC)
      const { data: compData } = await supabase.rpc('esign_get_completion_data', { p_document_id: documentId });
      const allFieldValues = compData?.field_values || [];
      const allRecipients = compData?.recipients || [];

      // Field values from completion RPC include positions (page, x, y, width, height, type)
      // so we can overlay them directly without needing a separate field map.
      for (const fv of allFieldValues) {
        const pageIdx = Math.min((fv.page || 1) - 1, pages.length - 1);
        const page = pages[pageIdx];
        if (!page) continue;

        const x = fv.x || 0;
        const y = page.getHeight() - (fv.y || 0) - (fv.height || 20);
        const value = fv.value || '';
        const type = fv.type;
        const sigData = fv.signature_image || value;

        if (type === 'signature' || type === 'initials') {
          // If value is a data URL (image), embed it
          if (sigData && sigData.startsWith('data:image')) {
            try {
              const base64 = sigData.split(',')[1];
              const imgBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
              const img = await pdfDoc.embedPng(imgBytes);
              page.drawImage(img, {
                x, y, width: fv.width || 200, height: fv.height || 40,
              });
            } catch {
              // Fallback: draw as text
              page.drawText(String(value).substring(0, 30), { x: x + 8, y: y + 10, size: 16, font: helvBold, color: rgb(0.1, 0.1, 0.3) });
            }
          } else {
            const fontSize = (fv.height || 40) * 0.55;
            page.drawText(String(value).substring(0, 30), { x: x + 8, y: y + (fv.height || 40) * 0.25, size: fontSize, font: helvBold, color: rgb(0.1, 0.1, 0.3) });
          }
        } else if (type === 'checkbox') {
          if (value === 'true' || value === true) {
            page.drawText('✓', { x: x + 4, y: y + 2, size: 16, font: helvBold, color: rgb(0, 0, 0) });
          }
        } else {
          page.drawText(String(value).substring(0, 80), { x: x + 4, y: y + 4, size: 11, font: helv, color: rgb(0, 0, 0) });
        }
      }

      // Add completion certificate page
      const certPage = pdfDoc.addPage([612, 792]);
      certPage.drawText('Electronic Signature Completion Record', { x: 80, y: 720, size: 16, font: helvBold, color: rgb(0, 0, 0) });
      certPage.drawText(`Document: ${session?.document?.name || 'Document'}`, { x: 80, y: 680, size: 11, font: helv, color: rgb(0.3, 0.3, 0.3) });
      certPage.drawText(`Completed: ${new Date().toLocaleString()}`, { x: 80, y: 660, size: 11, font: helv, color: rgb(0.3, 0.3, 0.3) });
      certPage.drawText(`Document ID: ${documentId}`, { x: 80, y: 640, size: 9, font: helv, color: rgb(0.5, 0.5, 0.5) });
      let certY = 600;
      for (const r of allRecipients) {
        certPage.drawText(`${r.name} (${r.email}) — Signed ${r.signed_at ? new Date(r.signed_at).toLocaleString() : ''}`,
          { x: 80, y: certY, size: 10, font: helv, color: rgb(0.2, 0.2, 0.2) });
        certY -= 20;
      }
      certPage.drawText('This document was electronically signed via the M2 Fleet Portal e-Signature system.', {
        x: 80, y: 80, size: 9, font: helv, color: rgb(0.5, 0.5, 0.5),
      });

      const finalizedBytes = await pdfDoc.save();
      const blob = new Blob([finalizedBytes], { type: 'application/pdf' });

      // Upload completed PDF (anon can upload to completed/ per storage policy)
      const path = `completed/${documentId}/signed.pdf`;
      const { error: upErr } = await supabase.storage
        .from('esign-documents').upload(path, blob, { contentType: 'application/pdf', upsert: true });
      if (upErr) throw upErr;

      const { data: urlData } = await supabase.storage.from('esign-documents').createSignedUrl(path, 86400 * 365 * 5);
      if (urlData?.signedUrl) {
        // Update document with signed PDF URL via RPC or direct update
        // anon can't update esign_documents directly (RLS), so we skip this
        // The admin dashboard can set it later, or the URL is derivable from the path
      }
    } catch (e) {
      console.error('PDF finalization error:', e);
      // Don't throw — the signing itself already succeeded
    }
  };

  // ---- Render ----
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-gray-500">Loading your document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl border p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Unable to Load Document</h2>
          <p className="text-gray-500 text-sm">{error}</p>
          <p className="text-xs text-gray-400 mt-4">
            This link may be expired, already used, or invalid. Please contact the sender.
          </p>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl border p-8 max-w-md text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Document Signed!</h2>
          <p className="text-gray-500 text-sm mb-4">
            Thank you, {session?.recipient?.name}. Your signature has been recorded.
          </p>
          <p className="text-xs text-gray-400">
            {session?.document?.name}
          </p>
          <p className="text-xs text-gray-400 mt-4">
            A copy of the completed document will be emailed to you shortly.
          </p>
        </div>
      </div>
    );
  }

  const fields = session?.fields || [];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="font-bold text-gray-900">{session?.document?.name}</h1>
              <p className="text-xs text-gray-500">Hello, {session?.recipient?.name}</p>
            </div>
          </div>
          <button
            onClick={handleSubmit}
            disabled={signing}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {signing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {signing ? 'Processing...' : 'Complete Signing'}
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {session?.document?.message && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
            <p className="font-medium mb-1">Message from sender:</p>
            <p>{session?.document?.message}</p>
          </div>
        )}

        {/* Fields to fill */}
        {fields.length > 0 ? (
          <div className="bg-white rounded-xl border p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Please complete the following fields:</h2>
            {fields.map((f, idx) => (
              <div key={f.id || idx} className="border-l-4 border-blue-300 pl-4 py-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {f.label || f.type} {f.required && <span className="text-red-500">*</span>}
                </label>

                {f.type === 'signature' || f.type === 'initials' ? (
                  <div>
                    {fieldValues[f.id] ? (
                      <div className="flex items-center gap-3">
                        {fieldValues[f.id].startsWith('data:image') ? (
                          <img src={fieldValues[f.id]} alt="Signature" className="border rounded h-16" />
                        ) : (
                          <span className="text-2xl italic font-bold text-gray-800 border-b px-4 py-1">
                            {fieldValues[f.id]}
                          </span>
                        )}
                        <button onClick={() => { const fv = { ...fieldValues }; delete fv[f.id]; setFieldValues(fv); }}
                          className="text-xs text-red-500 flex items-center gap-1">
                          <X className="w-3 h-3" /> Clear
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={() => setShowSigPad(f.id)}
                          className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 flex items-center gap-2">
                          <PenLine className="w-4 h-4" /> Draw Signature
                        </button>
                        <button onClick={() => setFieldValues({ ...fieldValues, [f.id]: session?.recipient?.name || '' })}
                          className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 flex items-center gap-2">
                          <Type className="w-4 h-4" /> Type Name
                        </button>
                      </div>
                    )}
                  </div>
                ) : f.type === 'checkbox' ? (
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={fieldValues[f.id] === 'true'}
                      onChange={(e) => setFieldValues({ ...fieldValues, [f.id]: e.target.checked ? 'true' : '' })}
                      className="w-5 h-5 rounded" />
                    <span className="text-sm text-gray-600">Check to agree</span>
                  </label>
                ) : (
                  <input
                    type={f.type === 'date' ? 'date' : f.type === 'email' ? 'email' : 'text'}
                    value={fieldValues[f.id] || ''}
                    onChange={(e) => setFieldValues({ ...fieldValues, [f.id]: e.target.value })}
                    className="w-full max-w-md border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder={f.placeholder || `Enter ${f.type}...`}
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border p-8 text-center text-gray-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No fields to fill. Click "Complete Signing" to proceed.</p>
          </div>
        )}

        {/* PDF preview */}
        {pdfUrl && (
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="border-b px-4 py-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-600">Document Preview</span>
            </div>
            <iframe src={pdfUrl} className="w-full" style={{ height: 600 }} title="Document" />
          </div>
        )}
      </div>

      {/* Signature pad modal */}
      {showSigPad && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold">Draw Your Signature</h3>
              <button onClick={() => setShowSigPad(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <canvas
                ref={canvasRef}
                width={460}
                height={200}
                className="border-2 border-gray-300 rounded-lg w-full touch-none cursor-crosshair bg-white"
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
              />
              <div className="flex justify-between mt-4">
                <button onClick={clearSig} className="px-3 py-2 border rounded-lg text-sm">Clear</button>
                <div className="flex gap-2">
                  <button onClick={useTypedSig} className="px-3 py-2 border rounded-lg text-sm">Type Instead</button>
                  <button onClick={saveSig} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">Save Signature</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
