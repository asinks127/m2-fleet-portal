import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, FileText, CheckCircle, AlertCircle, Eye, Search, Check, XCircle, RotateCcw, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function PaperworkReviewQueue() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [reviewNotes, setReviewNotes] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        loadRequests();
    }, []);

    const loadRequests = async () => {
        setLoading(true);
        try {
            const all = await base44.entities.SignatureRequest.list({}, '-created_date', 200);
            const needsReview = (all || []).filter(r => r.status === 'Needs Review' || r.status === 'Correction Requested');
            setRequests(needsReview);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleReview = async (action) => {
        if (!selectedRequest) return;
        setIsProcessing(true);
        
        try {
            const result = await base44.functions.invoke('reviewDocument', {
                signatureRequestId: selectedRequest.id,
                action,
                notes: reviewNotes
            });
            
            const data = result.output || result;
            if (data.success) {
                setSelectedRequest(null);
                setReviewNotes('');
                await loadRequests();
            } else {
                setError(data.error || 'Action failed');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const filteredRequests = requests.filter(r => {
        const search = searchTerm.toLowerCase();
        return (r.technicianName || '').toLowerCase().includes(search) ||
               (r.technicianEmail || '').toLowerCase().includes(search) ||
               (r.documentTitle || '').toLowerCase().includes(search);
    });

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Paperwork Review Queue</h1>
                <p className="text-gray-500 text-sm">Review and approve contractor signed documents</p>
            </div>

            <Card>
                <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input 
                                className="pl-9"
                                placeholder="Search by contractor name or email..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Badge className="bg-orange-100 text-orange-700">
                            <Eye className="w-3 h-3 mr-1" />{filteredRequests.length} pending review
                        </Badge>
                    </div>
                </CardContent>
            </Card>

            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
            ) : filteredRequests.length === 0 ? (
                <Card>
                    <CardContent className="p-8 text-center text-gray-500">
                        <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                        <p className="font-medium">All caught up!</p>
                        <p className="text-sm">No documents need review at this time.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {filteredRequests.map(req => (
                        <Card key={req.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <FileText className="w-5 h-5 text-gray-400" />
                                            <div>
                                                <h3 className="font-medium">{req.documentTitle || req.documentType}</h3>
                                                <p className="text-sm text-gray-500">
                                                    From: {req.technicianName || req.technicianEmail}
                                                </p>
                                            </div>
                                            <Badge className={req.status === 'Correction Requested' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}>
                                                {req.status}
                                            </Badge>
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-500">
                                            <div>
                                                <span className="font-medium">Sent:</span> {req.sentDate ? format(new Date(req.sentDate), 'MM/dd/yy') : 'N/A'}
                                            </div>
                                            <div>
                                                <span className="font-medium">Signed:</span> {req.signedAt ? format(new Date(req.signedAt), 'MM/dd/yy h:mm a') : 'N/A'}
                                            </div>
                                            <div>
                                                <span className="font-medium">Signed By:</span> {req.signedByName || req.signedBy || 'Unknown'}
                                            </div>
                                            <div>
                                                <span className="font-medium">Type:</span> {req.documentType || 'General'}
                                            </div>
                                        </div>

                                        {req.correctionNotes && (
                                            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                                                <p className="text-red-700 text-sm"><span className="font-medium">Previous notes:</span> {req.correctionNotes}</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        {req.originalFileUrl && (
                                            <a href={req.originalFileUrl} target="_blank" rel="noopener noreferrer">
                                                <Button variant="outline" size="sm">
                                                    <ExternalLink className="w-4 h-4 mr-1" />View Original
                                                </Button>
                                            </a>
                                        )}
                                        <Button size="sm" onClick={() => { setSelectedRequest(req); setReviewNotes(''); }}>
                                            <Eye className="w-4 h-4 mr-1" />Review
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Review Dialog */}
            <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Review Document</DialogTitle>
                    </DialogHeader>
                    
                    {selectedRequest && (
                        <div className="space-y-4">
                            <div className="p-4 bg-gray-50 rounded-lg">
                                <p className="font-medium">{selectedRequest.documentTitle || selectedRequest.documentType}</p>
                                <p className="text-sm text-gray-500">
                                    From: {selectedRequest.technicianName || selectedRequest.technicianEmail}
                                </p>
                                <p className="text-sm text-gray-500">
                                    Signed: {selectedRequest.signedAt ? format(new Date(selectedRequest.signedAt), 'MMMM d, yyyy h:mm a') : 'N/A'}
                                </p>
                            </div>

                            <div>
                                <label className="font-medium text-sm">Review Notes (optional)</label>
                                <Textarea
                                    rows={3}
                                    value={reviewNotes}
                                    onChange={e => setReviewNotes(e.target.value)}
                                    placeholder="Add notes for the contractor..."
                                    className="mt-1"
                                />
                            </div>

                            {error && (
                                <div className="p-3 bg-red-50 text-red-700 text-sm rounded">
                                    {error}
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter className="gap-2">
                        <Button
                            variant="destructive"
                            onClick={() => handleReview('reject')}
                            disabled={isProcessing}
                        >
                            <XCircle className="w-4 h-4 mr-1" />Reject
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => handleReview('request_correction')}
                            disabled={isProcessing}
                        >
                            <RotateCcw className="w-4 h-4 mr-1" />Request Correction
                        </Button>
                        <Button
                            onClick={() => handleReview('approve')}
                            disabled={isProcessing}
                        >
                            <CheckCircle className="w-4 h-4 mr-1" />Approve & File
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}