import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient.js';
import { db, storage } from '@/config/firebase.js';
import { 
  doc, 
  getDoc, 
  updateDoc, 
  Timestamp,
  collection,
  addDoc,
} from 'firebase/firestore';
import { Document, Page, pdfjs } from 'react-pdf';
import { 
  PenTool, Type, Calendar, Check, ChevronLeft, ChevronRight,
  Loader2, AlertCircle, CheckCircle, Clock, FileText, User,
  Building, Mail, Phone, List, CheckSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog.jsx';
import { Progress } from '@/components/ui/progress.jsx';
import { toast } from 'sonner';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

import { 
  FIELD_TYPES, 
  DOCUMENT_STATUS,
  SIGNER_STATUS,
  AUDIT_EVENTS,
  createAuditEntry,
} from '@/lib/documentSigning/models.js';

const FIELD_COLORS = {
  [FIELD_TYPES.SIGNATURE]: '#3b82f6',
  [FIELD_TYPES.INITIALS]: '#8b5cf6',
  [FIELD_TYPES.TEXT]: '#10b981',
  [FIELD_TYPES.DATE]: '#f59e0b',
  [FIELD_TYPES.CHECKBOX]: '#ef4444',
  [FIELD_TYPES.DROPDOWN]: '#ec4899',
  [FIELD_TYPES.FULL_NAME]: '#06b6d4',
  [FIELD_TYPES.EMAIL]: '#84cc16',
  [FIELD_TYPES.COMPANY]: '#f97316',
};

export default function SignerPage() {
  const { requestId, token } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [request, setRequest] = useState(null);
  const [signer, setSigner] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  
  // Field values
  const [fieldValues, setFieldValues] = useState({});
  const [signatures, setSignatures] = useState({}); // Signature pad data
  const [initials, setInitials] = useState({}); // Initials data
  
  // Signature pad
  const [activeSignatureField, setActiveSignatureField] = useState(null);
  const [activeInitialField, setActiveInitialField] = useState(null);
  const signatureCanvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  
  // Audit
  const [auditEntries, setAuditEntries] = useState([]);

  // Load document request
  useEffect(() => {
    async function loadDocument() {
      if (!db) {
        setError('Document signing system not configured');
        setLoading(false);
        return;
      }

      try {
        // Get the request
        const requestRef = doc(db, 'documentRequests', requestId);
        const requestSnap = await getDoc(requestRef);
        
        if (!requestSnap.exists()) {
          setError('Document not found');
          setLoading(false);
          return;
        }

        const requestData = requestSnap.data();
        
        // Find the signer with matching token
        const matchingSigner = requestData.signers.find(s => s.signingToken === token);
        
        if (!matchingSigner) {
          setError('Invalid signing link');
          setLoading(false);
          return;
        }

        // Check if already signed
        if (matchingSigner.status === 'signed') {
          setCompleted(true);
        }

        // Check if expired
        if (requestData.expiresAt && requestData.expiresAt.toDate() < new Date()) {
          setError('This document has expired');
          setLoading(false);
          return;
        }

        // Check if voided
        if (requestData.status === DOCUMENT_STATUS.VOIDED) {
          setError('This document has been voided');
          setLoading(false);
          return;
        }

        // Update signer status to viewed if pending
        if (matchingSigner.status === SIGNER_STATUS.PENDING || matchingSigner.status === SIGNER_STATUS.SENT) {
          const updatedSigners = requestData.signers.map(s => 
            s.id === matchingSigner.id 
              ? { ...s, status: SIGNER_STATUS.VIEWED, viewedAt: Timestamp.now() }
              : s
          );
          
          await updateDoc(requestRef, { 
            signers: updatedSigners,
            status: DOCUMENT_STATUS.VIEWED,
            updatedAt: Timestamp.now(),
          });
          
          matchingSigner.status = SIGNER_STATUS.VIEWED;
          matchingSigner.viewedAt = new Date();
        }

        setRequest(requestData);
        setSigner(matchingSigner);

        // Initialize field values with prefilled values
        const initialValues = {};
        requestData.fields.forEach(field => {
          if (field.prefilledValue) {
            initialValues[field.id] = field.prefilledValue;
          }
        });
        setFieldValues(initialValues);

        // Add audit entry
        await addAuditEntry(requestId, {
          event: AUDIT_EVENTS.DOCUMENT_VIEWED,
          signerId: matchingSigner.id,
          signerEmail: matchingSigner.email,
          signerName: matchingSigner.name,
        });

      } catch (err) {
        console.error('Error loading document:', err);
        setError('Failed to load document');
      } finally {
        setLoading(false);
      }
    }

    loadDocument();
  }, [requestId, token]);

  // Field handling
  function getFieldsForCurrentSigner() {
    if (!request || !signer) return [];
    return request.fields.filter(f => f.signerId === signer.id);
  }

  function getFieldsForPage(pageNum) {
    return getFieldsForCurrentSigner().filter(f => f.pageNumber === pageNum);
  }

  function isFieldCompleted(field) {
    if (field.type === FIELD_TYPES.SIGNATURE || field.type === FIELD_TYPES.INITIALS) {
      return !!(signatures[field.id] || initials[field.id]);
    }
    return fieldValues[field.id] !== undefined && fieldValues[field.id] !== '';
  }

  function getCompletedFieldCount() {
    const fields = getFieldsForCurrentSigner();
    return fields.filter(isFieldCompleted).length;
  }

  function getTotalFieldCount() {
    return getFieldsForCurrentSigner().length;
  }

  function getProgressPercentage() {
    const total = getTotalFieldCount();
    if (total === 0) return 100;
    return Math.round((getCompletedFieldCount() / total) * 100);
  }

  function canSubmit() {
    const fields = getFieldsForCurrentSigner();
    const requiredFields = fields.filter(f => f.required);
    return requiredFields.every(isFieldCompleted);
  }

  // Signature pad drawing
  useEffect(() => {
    if (!activeSignatureField && !activeInitialField) return;

    const canvas = signatureCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#1e40af';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    let lastX = 0;
    let lastY = 0;

    function startDrawing(e) {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
      const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
      setIsDrawing(true);
      [lastX, lastY] = [x, y];
    }

    function draw(e) {
      if (!isDrawing) return;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
      const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
      
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(x, y);
      ctx.stroke();
      [lastX, lastY] = [x, y];
    }

    function stopDrawing() {
      setIsDrawing(false);
    }

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stopDrawing);

    return () => {
      canvas.removeEventListener('mousedown', startDrawing);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stopDrawing);
      canvas.removeEventListener('mouseout', stopDrawing);
      canvas.removeEventListener('touchstart', startDrawing);
      canvas.removeEventListener('touchmove', draw);
      canvas.removeEventListener('touchend', stopDrawing);
    };
  }, [activeSignatureField, activeInitialField, isDrawing]);

  function clearSignature() {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function saveSignature() {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    
    const dataUrl = canvas.toDataURL('image/png');
    
    if (activeSignatureField) {
      setSignatures({ ...signatures, [activeSignatureField.id]: dataUrl });
      setActiveSignatureField(null);
    } else if (activeInitialField) {
      setInitials({ ...initials, [activeInitialField.id]: dataUrl });
      setActiveInitialField(null);
    }
    
    clearSignature();
    toast.success('Signature saved');
  }

  // Typed signature
  function useTypedSignature(field) {
    const name = signer?.name || 'Your Name';
    setSignatures({ ...signatures, [field.id]: name });
    toast.success('Signature added');
  }

  function useTypedInitials(field) {
    const name = signer?.name || 'Name';
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();
    setInitials({ ...initials, [field.id]: initials });
    toast.success('Initials added');
  }

  // Update field value
  function updateFieldValue(fieldId, value) {
    setFieldValues({ ...fieldValues, [fieldId]: value });
  }

  // Submit signed document
  async function handleSubmit() {
    if (!canSubmit()) {
      toast.error('Please complete all required fields');
      return;
    }

    setSaving(true);

    try {
      const requestRef = doc(db, 'documentRequests', request.id);
      
      // Update field values in request
      const updatedFields = request.fields.map(field => {
        const value = fieldValues[field.id] || '';
        const signature = signatures[field.id] || null;
        const initial = initials[field.id] || null;
        
        return {
          ...field,
          value,
          signature,
          initial,
          completedAt: Timestamp.now(),
        };
      });

      // Update signer status
      const updatedSigners = request.signers.map(s => 
        s.id === signer.id 
          ? { 
              ...s, 
              status: SIGNER_STATUS.SIGNED, 
              signedAt: Timestamp.now() 
            }
          : s
      );

      // Check if all signers have signed
      const allSigned = updatedSigners.every(s => s.status === SIGNER_STATUS.SIGNED);
      const nextSignerIndex = request.signers.findIndex(s => s.status !== SIGNER_STATUS.SIGNED);

      await updateDoc(requestRef, {
        fields: updatedFields,
        signers: updatedSigners,
        status: allSigned ? DOCUMENT_STATUS.COMPLETED : DOCUMENT_STATUS.SIGNED,
        currentSignerOrder: nextSignerIndex === -1 ? request.signers.length : nextSignerIndex,
        updatedAt: Timestamp.now(),
        ...(allSigned && { completedAt: Timestamp.now() }),
      });

      // Add audit entry
      await addAuditEntry(requestId, {
        event: AUDIT_EVENTS.DOCUMENT_SIGNED,
        signerId: signer.id,
        signerEmail: signer.email,
        signerName: signer.name,
      });

      if (allSigned) {
        // TODO: Generate signed PDF and send completion emails
        await addAuditEntry(requestId, {
          event: AUDIT_EVENTS.DOCUMENT_COMPLETED,
        });
      } else {
        // Send email to next signer
        const nextSigner = updatedSigners[nextSignerIndex];
        if (nextSigner) {
          // TODO: Send email notification
        }
      }

      setCompleted(true);
      toast.success('Document signed successfully!');

    } catch (err) {
      console.error('Error submitting document:', err);
      toast.error('Failed to submit document');
    } finally {
      setSaving(false);
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading document...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  // Completed state
  if (completed) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Document Signed</h1>
          <p className="text-gray-600 mb-6">
            You have successfully signed "{request?.name}". A copy will be sent to your email.
          </p>
          <div className="bg-white rounded-lg border p-4 text-left">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Document</span>
              <span className="font-medium">{request?.name}</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Signed</span>
              <span className="font-medium">{new Date().toLocaleDateString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Status</span>
              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">Completed</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const signerFields = getFieldsForCurrentSigner();
  const pageFields = getFieldsForPage(currentPage);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <FileText className="w-5 h-5 text-gray-400" />
              <div>
                <h1 className="font-semibold text-gray-900">{request?.name}</h1>
                <p className="text-sm text-gray-500">
                  Signing as: {signer?.name} ({signer?.role || 'Signer'})
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-sm text-gray-500">Progress</div>
                <div className="font-medium">{getCompletedFieldCount()} / {getTotalFieldCount()} fields</div>
              </div>
              <div className="w-24">
                <Progress value={getProgressPercentage()} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <PenTool className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-900">Please complete the following fields</h3>
              <p className="text-sm text-blue-700 mt-1">
                Fill in all required fields (marked with *) and click Submit when done.
                Required fields are highlighted.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* PDF Viewer */}
          <div className="flex-1">
            <div className="bg-white rounded-lg border shadow-sm">
              {/* Page navigation */}
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-gray-600">
                  Page {currentPage} of {request?.pdfPageCount || 1}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(request?.pdfPageCount || 1, currentPage + 1))}
                  disabled={currentPage === (request?.pdfPageCount || 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              {/* PDF content */}
              <div className="p-4 overflow-auto" style={{ maxHeight: '70vh' }}>
                <div className="relative inline-block mx-auto">
                  <Document file={request?.originalPdfUrl}>
                    <Page
                      pageNumber={currentPage}
                      scale={scale}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                    />
                  </Document>

                  {/* Render clickable fields */}
                  {pageFields.map(field => {
                    const isCompleted = isFieldCompleted(field);
                    const isRequired = field.required;
                    
                    return (
                      <div
                        key={field.id}
                        className={`absolute cursor-pointer transition-all ${
                          isCompleted ? 'ring-2 ring-green-500' : isRequired ? 'ring-2 ring-orange-400' : ''
                        }`}
                        style={{
                          left: field.position.x * scale,
                          top: field.position.y * scale,
                          width: field.width * scale,
                          height: field.height * scale,
                          backgroundColor: isCompleted ? '#10b98120' : FIELD_COLORS[field.type] + '30',
                          borderColor: isCompleted ? '#10b981' : FIELD_COLORS[field.type],
                          borderWidth: 2,
                          borderStyle: 'solid',
                          borderRadius: 4,
                        }}
                        onClick={() => {
                          if (field.type === FIELD_TYPES.SIGNATURE) {
                            setActiveSignatureField(field);
                          } else if (field.type === FIELD_TYPES.INITIALS) {
                            setActiveInitialField(field);
                          }
                        }}
                      >
                        {/* Show value or placeholder */}
                        {field.type === FIELD_TYPES.SIGNATURE && signatures[field.id] ? (
                          <img 
                            src={signatures[field.id]} 
                            alt="Signature" 
                            className="w-full h-full object-contain p-1"
                          />
                        ) : field.type === FIELD_TYPES.INITIALS && initials[field.id] ? (
                          <div className="w-full h-full flex items-center justify-center text-xs font-bold p-1">
                            {initials[field.id]}
                          </div>
                        ) : fieldValues[field.id] ? (
                          <div className="w-full h-full flex items-center justify-center text-xs p-1 truncate">
                            {fieldValues[field.id]}
                          </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs p-1 text-gray-600">
                            {field.label}
                            {isRequired && '*'}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Fields panel */}
          <div className="w-full lg:w-80 space-y-4">
            <div className="bg-white rounded-lg border shadow-sm p-4">
              <h3 className="font-medium mb-4">Your Fields</h3>
              <div className="space-y-3">
                {signerFields.map(field => (
                  <div
                    key={field.id}
                    className={`p-3 rounded-lg border ${
                      isFieldCompleted(field) 
                        ? 'border-green-300 bg-green-50' 
                        : field.required 
                          ? 'border-orange-300 bg-orange-50' 
                          : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">
                        {field.label}
                        {field.required && <span className="text-red-500">*</span>}
                      </span>
                      <span className="text-xs text-gray-400">P{field.pageNumber}</span>
                    </div>

                    {/* Signature field */}
                    {field.type === FIELD_TYPES.SIGNATURE && (
                      <div className="space-y-2">
                        {signatures[field.id] ? (
                          <img 
                            src={signatures[field.id]} 
                            alt="Signature" 
                            className="h-12 w-full border rounded bg-white p-1"
                          />
                        ) : (
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              className="flex-1"
                              onClick={() => setActiveSignatureField(field)}
                            >
                              <PenTool className="w-3 h-3 mr-1" />
                              Draw
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="flex-1"
                              onClick={() => useTypedSignature(field)}
                            >
                              <Type className="w-3 h-3 mr-1" />
                              Type
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Initials field */}
                    {field.type === FIELD_TYPES.INITIALS && (
                      <div className="space-y-2">
                        {initials[field.id] ? (
                          <div className="h-8 w-full border rounded bg-white flex items-center justify-center font-bold">
                            {initials[field.id]}
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              className="flex-1"
                              onClick={() => setActiveInitialField(field)}
                            >
                              <PenTool className="w-3 h-3 mr-1" />
                              Draw
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="flex-1"
                              onClick={() => useTypedInitials(field)}
                            >
                              <Type className="w-3 h-3 mr-1" />
                              Type
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Text fields */}
                    {[FIELD_TYPES.TEXT, FIELD_TYPES.FULL_NAME, FIELD_TYPES.COMPANY, FIELD_TYPES.TITLE, FIELD_TYPES.PHONE, FIELD_TYPES.CUSTOM].includes(field.type) && (
                      <Input
                        value={fieldValues[field.id] || ''}
                        onChange={(e) => updateFieldValue(field.id, e.target.value)}
                        placeholder={field.label}
                        className="h-8"
                      />
                    )}

                    {/* Email field */}
                    {field.type === FIELD_TYPES.EMAIL && (
                      <Input
                        type="email"
                        value={fieldValues[field.id] || ''}
                        onChange={(e) => updateFieldValue(field.id, e.target.value)}
                        placeholder="email@example.com"
                        className="h-8"
                      />
                    )}

                    {/* Date field */}
                    {field.type === FIELD_TYPES.DATE && (
                      <Input
                        type="date"
                        value={fieldValues[field.id] || new Date().toISOString().split('T')[0]}
                        onChange={(e) => updateFieldValue(field.id, e.target.value)}
                        className="h-8"
                      />
                    )}

                    {/* Checkbox field */}
                    {field.type === FIELD_TYPES.CHECKBOX && (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={fieldValues[field.id] === true}
                          onChange={(e) => updateFieldValue(field.id, e.target.checked)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-gray-600">Checked</span>
                      </label>
                    )}

                    {/* Dropdown field */}
                    {field.type === FIELD_TYPES.DROPDOWN && field.options && (
                      <Select
                        value={fieldValues[field.id] || ''}
                        onValueChange={(v) => updateFieldValue(field.id, v)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options.map((option, i) => (
                            <SelectItem key={i} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Submit button */}
            <Button
              className="w-full h-12 text-lg"
              onClick={handleSubmit}
              disabled={!canSubmit() || saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Submit Signature
                </>
              )}
            </Button>

            {!canSubmit() && (
              <p className="text-sm text-center text-orange-600">
                Please complete all required fields
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Signature pad modal */}
      <Dialog 
        open={!!activeSignatureField || !!activeInitialField} 
        onOpenChange={() => {
          setActiveSignatureField(null);
          setActiveInitialField(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {activeSignatureField ? 'Add Your Signature' : 'Add Your Initials'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <canvas
              ref={signatureCanvasRef}
              width={400}
              height={activeSignatureField ? 150 : 80}
              className="w-full border-2 border-gray-300 rounded-lg bg-white cursor-crosshair touch-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={clearSignature}>
              Clear
            </Button>
            <Button onClick={saveSignature}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
