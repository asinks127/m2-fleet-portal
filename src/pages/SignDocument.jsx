import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getSignatureRequestData, generateSignedPdf, proxyPdf } from '@/functions.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { Loader2, CheckCircle, XCircle, FileSignature, Download, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, MousePointer } from 'lucide-react';
import { format } from 'date-fns';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Signature Drawing Modal
const SignatureModal = ({ isOpen, onClose, onSave }) => {
    const canvasRef = useRef(null);
    const ctxRef = useRef(null);
    const isDrawing = useRef(false);
    const hasContent = useRef(false);

    useEffect(() => {
        if (!isOpen) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.width = 500;
        canvas.height = 200;
        const ctx = canvas.getContext('2d');
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctxRef.current = ctx;
        hasContent.current = false;
    }, [isOpen]);

    const getPos = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    };

    const startDrawing = (e) => {
        if (e.cancelable) e.preventDefault();
        const { x, y } = getPos(e);
        ctxRef.current.beginPath();
        ctxRef.current.moveTo(x, y);
        isDrawing.current = true;
        hasContent.current = true;
    };

    const draw = (e) => {
        if (!isDrawing.current) return;
        if (e.cancelable) e.preventDefault();
        const { x, y } = getPos(e);
        ctxRef.current.lineTo(x, y);
        ctxRef.current.stroke();
    };

    const stopDrawing = () => {
        if (isDrawing.current) {
            ctxRef.current.closePath();
            isDrawing.current = false;
        }
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        hasContent.current = false;
    };

    const handleSave = () => {
        if (!hasContent.current) {
            alert('Please draw your signature first.');
            return;
        }
        const dataUrl = canvasRef.current.toDataURL('image/png');
        onSave(dataUrl);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
                <h3 className="text-lg font-semibold mb-4">Draw Your Signature</h3>
                <div className="border-2 border-gray-300 rounded-lg mb-4">
                    <canvas
                        ref={canvasRef}
                        className="w-full h-48 rounded cursor-crosshair"
                        style={{ touchAction: 'none' }}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                    />
                </div>
                <div className="flex justify-between">
                    <Button variant="outline" onClick={clearCanvas}>Clear</Button>
                    <div className="space-x-2">
                        <Button variant="outline" onClick={onClose}>Cancel</Button>
                        <Button onClick={handleSave}>Apply Signature</Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Helper Components
const LoadingScreen = () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
            <CardContent className="p-8 text-center">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Document</h2>
                <p className="text-gray-600">Please wait while we load your document...</p>
            </CardContent>
        </Card>
    </div>
);

const ErrorScreen = ({ message }) => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
            <CardContent className="p-8 text-center">
                <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-gray-900 mb-2">Error</h2>
                <p className="text-red-600 mb-4">{message}</p>
                <Button onClick={() => window.location.reload()}>Try Again</Button>
            </CardContent>
        </Card>
    </div>
);

const SuccessScreen = ({ pdfUrl }) => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
            <CardContent className="p-8 text-center">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-gray-900 mb-2">Document Signed Successfully!</h2>
                <p className="text-gray-600 mb-4">Your document has been securely signed and submitted.</p>
                {pdfUrl && (
                    <Button asChild className="mb-4">
                        <a href={pdfUrl} target="_blank" rel="noopener noreferrer">View Signed Document</a>
                    </Button>
                )}
                <div className="text-sm text-gray-500 mt-4">You can now close this window.</div>
            </CardContent>
        </Card>
    </div>
);

export default function SignDocument() {
    const [signatureRequest, setSignatureRequest] = useState(null);
    const [document, setDocument] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [isSigning, setIsSigning] = useState(false);
    const [isSigned, setIsSigned] = useState(false);
    const [finalPdfUrl, setFinalPdfUrl] = useState('');

    // PDF rendering state
    const [pdfDoc, setPdfDoc] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [scale, setScale] = useState(1.2);
    const [pdfLoading, setPdfLoading] = useState(true);
    const canvasRef = useRef(null);
    const containerRef = useRef(null);

    // Signature placement state
    const [signatureImage, setSignatureImage] = useState(null);
    const [signaturePlacement, setSignaturePlacement] = useState(null); // { page, x, y, width, height }
    const [showSignatureModal, setShowSignatureModal] = useState(false);
    const [isPlacingSignature, setIsPlacingSignature] = useState(false);

    // Agreement state
    const [typedName, setTypedName] = useState('');
    const [agreed, setAgreed] = useState(false);
    const [validationErrors, setValidationErrors] = useState({});

    // Load signature request data
    useEffect(() => {
        const loadData = async () => {
            const params = new URLSearchParams(window.location.search);
            const token = params.get('token');
            const id = params.get('id');

            if (!token && !id) {
                setError('No signature token or ID provided. This link is invalid.');
                setIsLoading(false);
                return;
            }

            try {
                const payload = token ? { signatureToken: token } : { signatureRequestId: id };
                const { data } = await getSignatureRequestData(payload);

                if (data.success) {
                    setSignatureRequest(data.signatureRequest);
                    setDocument(data.document);
                    setTypedName(data.signatureRequest.technicianName || '');
                } else {
                    setError(data.error || 'Failed to load document data.');
                }
            } catch (err) {
                console.error('Error loading signature request:', err);
                setError(err.message || 'Failed to load signature request.');
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, []);

    // Load PDF document via proxy to avoid CORS
    useEffect(() => {
        if (!document?.originalFileUrl) return;

        const loadPdf = async () => {
            setPdfLoading(true);
            try {
                // Use our proxy to fetch PDF with proper CORS headers
                const response = await proxyPdf({ fileUrl: document.originalFileUrl });
                
                if (!response.data?.success || !response.data?.data) {
                    throw new Error('Failed to load PDF via proxy');
                }
                
                // Convert base64 back to ArrayBuffer
                const binaryString = atob(response.data.data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                
                const loadingTask = pdfjsLib.getDocument({ data: bytes.buffer });
                const pdf = await loadingTask.promise;
                setPdfDoc(pdf);
                setTotalPages(pdf.numPages);
                setCurrentPage(1);
            } catch (err) {
                console.error('Error loading PDF:', err);
                // Don't set error - we'll fall back to iframe
                setPdfDoc(null);
            } finally {
                setPdfLoading(false);
            }
        };

        loadPdf();
    }, [document?.originalFileUrl]);

    // Render current page
    const renderPage = useCallback(async () => {
        if (!pdfDoc || !canvasRef.current) return;

        try {
            const page = await pdfDoc.getPage(currentPage);
            const viewport = page.getViewport({ scale });
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');

            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            // Draw signature if placed on this page
            if (signaturePlacement && signaturePlacement.page === currentPage && signatureImage) {
                const img = new Image();
                img.onload = () => {
                    context.drawImage(
                        img,
                        signaturePlacement.x,
                        signaturePlacement.y,
                        signaturePlacement.width,
                        signaturePlacement.height
                    );
                };
                img.src = signatureImage;
            }
        } catch (err) {
            console.error('Error rendering page:', err);
        }
    }, [pdfDoc, currentPage, scale, signaturePlacement, signatureImage]);

    useEffect(() => {
        renderPage();
    }, [renderPage]);

    // Handle canvas click to place signature
    const handleCanvasClick = (e) => {
        if (!isPlacingSignature || !signatureImage) return;

        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        // Default signature size
        const sigWidth = 200;
        const sigHeight = 80;

        setSignaturePlacement({
            page: currentPage,
            x: x - sigWidth / 2,
            y: y - sigHeight / 2,
            width: sigWidth,
            height: sigHeight
        });

        setIsPlacingSignature(false);
    };

    const handleSaveSignature = (dataUrl) => {
        setSignatureImage(dataUrl);
        // Auto-enable placing mode if PDF is loaded
        if (pdfDoc) {
            setIsPlacingSignature(true);
        }
    };

    const removeSignature = () => {
        setSignatureImage(null);
        setSignaturePlacement(null);
        setIsPlacingSignature(false);
    };

    const validateAndSign = () => {
        const errors = {};

        if (!typedName.trim()) {
            errors.typedName = 'Please type your full name.';
        }

        // Only require placement if we have PDF.js rendering working
        if (!signatureImage) {
            errors.signature = 'Please draw your signature.';
        } else if (pdfDoc && !signaturePlacement) {
            errors.signature = 'Please place your signature on the document.';
        }

        if (!agreed) {
            errors.agreement = 'You must agree to the terms.';
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSign = async () => {
        setError('');

        if (!validateAndSign()) return;

        setIsSigning(true);

        try {
            const response = await generateSignedPdf({
                signatureRequestId: signatureRequest.id,
                typedName: typedName.trim(),
                signatureData: signatureImage,
                signaturePlacement: signaturePlacement,
                fieldValues: {},
                signerIpAddress: ''
            });

            if (response.data?.success) {
                setFinalPdfUrl(response.data.pdfUrl);
                setIsSigned(true);
            } else {
                setError(response.data?.error || 'Failed to complete signature.');
            }
        } catch (err) {
            console.error('Error submitting signature:', err);
            setError(err.message || 'An error occurred while signing.');
        } finally {
            setIsSigning(false);
        }
    };

    // Conditional rendering
    if (isLoading) return <LoadingScreen />;
    if (error && !document) return <ErrorScreen message={error} />;
    if (isSigned) return <SuccessScreen pdfUrl={finalPdfUrl} />;

    const isPdf = document?.documentType === 'pdf' && document?.originalFileUrl;

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col">
            <header className="bg-white shadow-md p-4">
                <div className="max-w-6xl mx-auto">
                    <h1 className="text-2xl font-bold text-gray-800">{document?.title}</h1>
                    <p className="text-gray-600">Sent to: {signatureRequest?.technicianEmail}</p>
                </div>
            </header>

            <main className="flex-1 p-4 md:p-6">
                <div className="max-w-6xl mx-auto">
                    {error && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* PDF Viewer */}
                        <div className="lg:col-span-2">
                            <Card>
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                        <CardTitle className="text-lg">Document</CardTitle>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setScale(s => Math.max(0.5, s - 0.2))}
                                            >
                                                <ZoomOut className="w-4 h-4" />
                                            </Button>
                                            <span className="text-sm text-gray-600">{Math.round(scale * 100)}%</span>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setScale(s => Math.min(2, s + 0.2))}
                                            >
                                                <ZoomIn className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {isPdf ? (
                                        <>
                                            {pdfLoading ? (
                                                <div className="flex items-center justify-center h-96">
                                                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                                                </div>
                                            ) : pdfDoc ? (
                                                <div ref={containerRef} className="overflow-auto bg-gray-200 rounded-lg" style={{ maxHeight: '70vh' }}>
                                                    <div className="flex justify-center p-4 relative">
                                                        <div className="relative">
                                                            <canvas
                                                                ref={canvasRef}
                                                                onClick={handleCanvasClick}
                                                                className={`shadow-lg bg-white ${isPlacingSignature ? 'cursor-crosshair ring-4 ring-blue-400 ring-opacity-50' : 'cursor-default'}`}
                                                                style={{ maxWidth: '100%', height: 'auto' }}
                                                            />
                                                            {isPlacingSignature && (
                                                                <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium animate-pulse">
                                                                    👆 Click anywhere to place your signature
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                // Fallback to iframe if PDF.js fails - show signature will be placed at default location
                                                <div className="relative">
                                                    <iframe
                                                        src={`https://docs.google.com/viewer?url=${encodeURIComponent(document.originalFileUrl)}&embedded=true`}
                                                        className="w-full rounded-lg border-0"
                                                        style={{ height: '70vh' }}
                                                        title={document?.title}
                                                    />
                                                    {signatureImage && (
                                                        <div className="absolute bottom-4 left-4 right-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                                                            ⚠️ Direct signature placement is not available. Your signature will be placed at the signature line automatically.
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Page Navigation */}
                                            {totalPages > 1 && (
                                                <div className="flex items-center justify-center gap-4 mt-4">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                        disabled={currentPage === 1}
                                                    >
                                                        <ChevronLeft className="w-4 h-4" />
                                                    </Button>
                                                    <span className="text-sm">
                                                        Page {currentPage} of {totalPages}
                                                    </span>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                        disabled={currentPage === totalPages}
                                                    >
                                                        <ChevronRight className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="p-8 prose max-w-none bg-white rounded-lg border" style={{ minHeight: '400px' }}>
                                            {document?.content ? (
                                                <div dangerouslySetInnerHTML={{ __html: document.content }} />
                                            ) : (
                                                <p className="text-gray-500">No document content available.</p>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Signature Panel */}
                        <div className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Sign Document</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {/* Step 1: Draw Signature */}
                                    <div>
                                        <Label className="font-medium">Step 1: Create Your Signature</Label>
                                        {signatureImage ? (
                                            <div className="mt-2 p-2 border rounded-lg bg-gray-50">
                                                <img src={signatureImage} alt="Your signature" className="max-h-20 mx-auto" />
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={removeSignature}
                                                    className="w-full mt-2 text-red-600"
                                                >
                                                    Remove Signature
                                                </Button>
                                            </div>
                                        ) : (
                                            <Button
                                                variant="outline"
                                                className="w-full mt-2"
                                                onClick={() => setShowSignatureModal(true)}
                                            >
                                                <FileSignature className="w-4 h-4 mr-2" />
                                                Draw Signature
                                            </Button>
                                        )}
                                    </div>

                                    {/* Step 2: Place Signature */}
                                    {signatureImage && isPdf && pdfDoc && (
                                        <div>
                                            <Label className="font-medium">Step 2: Place on Document</Label>
                                            {signaturePlacement ? (
                                                <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                                                    ✓ Signature placed on page {signaturePlacement.page}
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            setSignaturePlacement(null);
                                                            setIsPlacingSignature(true);
                                                        }}
                                                        className="w-full mt-2"
                                                    >
                                                        Reposition
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className={`mt-2 p-3 rounded-lg text-sm ${isPlacingSignature ? 'bg-blue-50 border border-blue-200 text-blue-800' : 'bg-yellow-50 border border-yellow-200 text-yellow-800'}`}>
                                                    {isPlacingSignature ? (
                                                        <>
                                                            <MousePointer className="w-4 h-4 inline mr-1" />
                                                            Click on the document where you want to place your signature
                                                        </>
                                                    ) : (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="w-full"
                                                            onClick={() => setIsPlacingSignature(true)}
                                                        >
                                                            Click to Place Signature
                                                        </Button>
                                                    )}
                                                </div>
                                            )}
                                            {validationErrors.signature && (
                                                <p className="text-sm text-red-600 mt-1">{validationErrors.signature}</p>
                                            )}
                                        </div>
                                    )}

                                    {/* Step 3: Type Name */}
                                    <div>
                                        <Label htmlFor="typedName" className="font-medium">
                                            {isPdf && pdfDoc ? 'Step 3' : 'Step 2'}: Type Your Full Name
                                        </Label>
                                        <Input
                                            id="typedName"
                                            value={typedName}
                                            onChange={(e) => setTypedName(e.target.value)}
                                            className={`mt-2 ${validationErrors.typedName ? 'border-red-500' : ''}`}
                                            placeholder="Your full name"
                                        />
                                        {validationErrors.typedName && (
                                            <p className="text-sm text-red-600 mt-1">{validationErrors.typedName}</p>
                                        )}
                                    </div>

                                    {/* Agreement */}
                                    <div className="pt-4 border-t">
                                        <div className="flex items-start gap-2">
                                            <Checkbox
                                                id="agreement"
                                                checked={agreed}
                                                onCheckedChange={setAgreed}
                                                className={validationErrors.agreement ? 'border-red-500' : ''}
                                            />
                                            <Label htmlFor="agreement" className="text-sm text-gray-600 leading-tight">
                                                I agree that my electronic signature is legally binding.
                                            </Label>
                                        </div>
                                        {validationErrors.agreement && (
                                            <p className="text-sm text-red-600 mt-1">{validationErrors.agreement}</p>
                                        )}
                                    </div>

                                    {/* Submit */}
                                    <Button
                                        className="w-full bg-blue-600 hover:bg-blue-700"
                                        size="lg"
                                        onClick={handleSign}
                                        disabled={isSigning}
                                    >
                                        {isSigning ? (
                                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                        ) : (
                                            <FileSignature className="w-5 h-5 mr-2" />
                                        )}
                                        Sign and Submit
                                    </Button>
                                </CardContent>
                            </Card>

                            {/* Download Original */}
                            {document?.originalFileUrl && (
                                <Button variant="outline" className="w-full" asChild>
                                    <a href={document.originalFileUrl} download target="_blank" rel="noopener noreferrer">
                                        <Download className="w-4 h-4 mr-2" />
                                        Download Original
                                    </a>
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* Signature Modal */}
            <SignatureModal
                isOpen={showSignatureModal}
                onClose={() => setShowSignatureModal(false)}
                onSave={handleSaveSignature}
            />
        </div>
    );
}