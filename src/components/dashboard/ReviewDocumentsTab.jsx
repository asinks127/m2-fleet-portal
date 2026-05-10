import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Loader2, FileSignature, PenTool, CheckCircle, Clock, FileText, Download } from 'lucide-react';

export default function ReviewDocumentsTab({ user }) {
    const [documents, setDocuments] = useState([]);
    const [signedDocuments, setSignedDocuments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchDocuments = async () => {
            if (!user) return;
            
            setIsLoading(true);
            try {
                // Use backend function to ensure we get all documents regardless of entity permissions
                const response = await (await fetch('/api/getContractorDocuments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                    targetUserId: user.id,
                    targetUserEmail: user.email
                }) })).json();

                const allRequests = response.data.signatureRequests || [];
                
                // Pending documents (Sent or Viewed)
                const pendingDocs = allRequests.filter(req => 
                    req.status === 'Sent' || req.status === 'Viewed'
                ).sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

                // Completed documents (Signed)
                const completedDocs = allRequests.filter(req => 
                    req.status === 'Signed' || req.status === 'Declined'
                ).sort((a, b) => new Date(b.signedAt || b.created_date) - new Date(a.signedAt || a.created_date));

                setDocuments(pendingDocs);
                setSignedDocuments(completedDocs);
            } catch (error) {
                console.error('Error fetching documents to sign:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDocuments();
    }, [user]);

    const handleSign = (requestId) => {
        window.location.href = `/SignDocument?id=${requestId}`;
    };

    // Helper to format date
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            return new Date(dateString).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
            });
        } catch (e) {
            return dateString;
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
                <p className="text-gray-500">Loading your documents...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Pending Documents Section */}
            <Card className="border-blue-200 bg-blue-50/30">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-blue-800">
                        <FileSignature className="w-5 h-5" />
                        Action Required: Documents to Sign
                    </CardTitle>
                    <CardDescription>
                        Please review and sign the following documents as soon as possible.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {documents.length === 0 ? (
                        <div className="text-center py-8 bg-white/50 rounded-lg border border-dashed border-blue-200">
                            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                            <h3 className="font-medium text-gray-900">All caught up!</h3>
                            <p className="text-gray-500 text-sm">You have no pending documents to sign.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {documents.map(doc => (
                                <div key={doc.id} className="bg-white p-4 rounded-lg shadow-sm border border-blue-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-md transition-shadow">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-blue-100 rounded-full mt-1">
                                            <PenTool className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-gray-900 text-lg">{doc.documentTitle}</h3>
                                            <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                                                <Clock className="w-4 h-4" />
                                                <span>Sent: {formatDate(doc.created_date)}</span>
                                                {doc.status === 'Viewed' && (
                                                    <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
                                                        Viewed
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <Button 
                                        onClick={() => handleSign(doc.id)}
                                        className="bg-blue-600 hover:bg-blue-700 text-white w-full md:w-auto shadow-sm"
                                        size="lg"
                                    >
                                        <PenTool className="w-4 h-4 mr-2" />
                                        Sign Document
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Signed History Section */}
            {signedDocuments.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-gray-500" />
                            Completed Documents
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-1 divide-y divide-gray-100">
                            {signedDocuments.map(doc => (
                                <div key={doc.id} className="py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div className="flex items-center gap-3">
                                        {doc.status === 'Signed' ? (
                                            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                                        ) : (
                                            <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center">
                                                <span className="text-xs text-gray-500">x</span>
                                            </div>
                                        )}
                                        <div>
                                            <p className="font-medium text-gray-900">{doc.documentTitle}</p>
                                            <p className="text-sm text-gray-500">
                                                {doc.status === 'Signed' ? `Signed on ${formatDate(doc.signedAt)}` : `Status: ${doc.status}`}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    {doc.status === 'Signed' && doc.signedPdfUrl && (
                                        <a href={doc.signedPdfUrl} target="_blank" rel="noopener noreferrer">
                                            <Button variant="outline" size="sm">
                                                <Download className="w-4 h-4 mr-2" />
                                                Download PDF
                                            </Button>
                                        </a>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}