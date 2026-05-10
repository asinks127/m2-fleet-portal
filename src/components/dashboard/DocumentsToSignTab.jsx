import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { FileSignature, Loader2, PenTool } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

// Helper to convert UTC to Central Time for display
function formatCentralTime(utcDateString) {
  if (!utcDateString) return 'N/A';
  try {
    const utcDate = new Date(utcDateString);
    if (isNaN(utcDate.getTime())) return 'Invalid Date';
    return utcDate.toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }) + ' CT';
  } catch (error) {
    return 'Invalid Date';
  }
}

export default function DocumentsToSignTab({ user }) {
    const [documents, setDocuments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

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
                
                // Filter locally for status 'Sent' or 'Viewed'
                const pendingDocs = allRequests.filter(req => 
                    req.status === 'Sent' || req.status === 'Viewed'
                ).sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

                setDocuments(pendingDocs);
            } catch (error) {
                console.error('Error fetching documents to sign:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDocuments();
    }, [user]);

    const handleSign = (requestId) => {
        // Navigate to SignDocument page with internal ID
        window.location.href = `/SignDocument?id=${requestId}`;
    };

    // Always show the card so users know where to look
    return (
        <Card className="border-blue-200 bg-blue-50/30 mb-6">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2 text-blue-800">
                    <FileSignature className="w-5 h-5" />
                    Documents Requiring Your Signature
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => window.location.reload()} className="h-8 w-8 p-0">
                     <Loader2 className={`w-4 h-4 text-blue-600 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                ) : documents.length === 0 ? (
                    <div className="text-center py-6 bg-white/50 rounded-lg border border-dashed border-blue-200">
                        <p className="text-gray-500 text-sm">No documents currently waiting for your signature.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {documents.map(doc => (
                            <div key={doc.id} className="bg-white p-4 rounded-lg shadow-sm border border-blue-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div>
                                    <h3 className="font-medium text-gray-900">{doc.documentTitle}</h3>
                                    <p className="text-sm text-gray-500">
                                        Received: {formatCentralTime(doc.created_date)}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    {doc.status === 'Viewed' && (
                                        <Badge variant="outline" className="text-blue-600 border-blue-200">
                                            Viewed
                                        </Badge>
                                    )}
                                    <Button 
                                        onClick={() => handleSign(doc.id)}
                                        className="bg-blue-600 hover:bg-blue-700 text-white"
                                        size="sm"
                                    >
                                        <PenTool className="w-4 h-4 mr-2" />
                                        Sign Now
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}