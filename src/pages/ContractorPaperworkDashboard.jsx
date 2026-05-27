import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, FileText, CheckCircle, Clock, AlertCircle, Eye, PenTool, Download, FileSignature, RotateCcw, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function ContractorPaperworkDashboard() {
    const [user, setUser] = useState(null);
    const [pendingDocs, setPendingDocs] = useState([]);
    const [completedDocs, setCompletedDocs] = useState([]);
    const [needsCorrectionDocs, setNeedsCorrectionDocs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadUser = async () => {
            const u = await base44.auth.user();
            if (u) {
                setUser(u);
                await loadDocuments(u);
            }
        };
        loadUser();
    }, []);

    const loadDocuments = async (u) => {
        setLoading(true);
        try {
            const requests = await base44.entities.SignatureRequest.list(
                { technicianEmail: u.email },
                '-created_date',
                100
            );

            const pending = [];
            const completed = [];
            const needsCorrection = [];

            for (const req of (requests || [])) {
                if (req.status === 'Correction Requested') {
                    needsCorrection.push(req);
                } else if (req.status === 'Signed' || req.status === 'Approved') {
                    completed.push(req);
                } else {
                    pending.push(req);
                }
            }

            setPendingDocs(pending);
            setCompletedDocs(completed);
            setNeedsCorrectionDocs(needsCorrection);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'Sent':
                return <Badge variant="outline" className="text-blue-600 border-blue-300"><Clock className="w-3 h-3 mr-1" />Sent</Badge>;
            case 'Viewed':
                return <Badge variant="outline" className="text-yellow-600 border-yellow-300"><Eye className="w-3 h-3 mr-1" />Viewed</Badge>;
            case 'Needs Review':
                return <Badge className="bg-orange-100 text-orange-700"><Eye className="w-3 h-3 mr-1" />Needs Review</Badge>;
            case 'Correction Requested':
                return <Badge className="bg-red-100 text-red-700"><RotateCcw className="w-3 h-3 mr-1" />Correction Requested</Badge>;
            case 'Signed':
                return <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />Signed</Badge>;
            case 'Rejected':
                return <Badge className="bg-red-100 text-red-700"><AlertCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const DocCard = ({ doc, showCorrectionNotes = false }) => (
        <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <FileText className="w-4 h-4 text-gray-400" />
                            <h3 className="font-medium">{doc.documentTitle || doc.documentType}</h3>
                            {getStatusBadge(doc.status)}
                        </div>
                        
                        <div className="text-sm text-gray-500 space-y-1">
                            <p>Packet: {doc.packetName || 'N/A'}</p>
                            <p>Sent: {doc.sentDate ? format(new Date(doc.sentDate), 'MMM d, yyyy') : 'N/A'}</p>
                            {doc.dueDate && <p className="text-orange-600">Due: {format(new Date(doc.dueDate), 'MMM d, yyyy')}</p>}
                            {doc.signedAt && <p className="text-green-600">Signed: {format(new Date(doc.signedAt), 'MMM d, yyyy')}</p>}
                        </div>

                        {showCorrectionNotes && doc.correctionNotes && (
                            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                                <div className="flex items-start gap-2">
                                    <MessageSquare className="w-4 h-4 text-red-600 mt-0.5" />
                                    <div>
                                        <p className="font-medium text-red-800 text-sm">Correction Requested:</p>
                                        <p className="text-red-700 text-sm">{doc.correctionNotes}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-2">
                        {doc.status === 'Sent' || doc.status === 'Viewed' || doc.status === 'Needs Review' ? (
                            <Link to={createPageUrl('SignDocument') + `?id=${doc.id}`}>
                                <Button size="sm">
                                    <PenTool className="w-4 h-4 mr-1" />Sign Document
                                </Button>
                            </Link>
                        ) : doc.status === 'Correction Requested' ? (
                            <Link to={createPageUrl('SignDocument') + `?id=${doc.id}&correct=true`}>
                                <Button size="sm" variant="destructive">
                                    <RotateCcw className="w-4 h-4 mr-1" />Correct & Resubmit
                                </Button>
                            </Link>
                        ) : null}

                        {doc.signedPdfUrl && (
                            <a href={doc.signedPdfUrl} target="_blank" rel="noopener noreferrer">
                                <Button variant="outline" size="sm">
                                    <Download className="w-4 h-4 mr-1" />Download
                                </Button>
                            </a>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold">My Documents & Paperwork</h1>
                <p className="text-gray-500 text-sm">Review, sign, and track your required paperwork</p>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4">
                <Card>
                    <CardContent className="p-4 text-center">
                        <p className="text-3xl font-bold text-yellow-600">{pendingDocs.length}</p>
                        <p className="text-xs text-gray-500">Awaiting Action</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 text-center">
                        <p className="text-3xl font-bold text-green-600">{completedDocs.length}</p>
                        <p className="text-xs text-gray-500">Completed</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 text-center">
                        <p className="text-3xl font-bold text-red-600">{needsCorrectionDocs.length}</p>
                        <p className="text-xs text-gray-500">Needs Correction</p>
                    </CardContent>
                </Card>
            </div>

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    <AlertCircle className="w-4 h-4 inline mr-2" />
                    {error}
                </div>
            )}

            <Tabs defaultValue="pending">
                <TabsList>
                    <TabsTrigger value="pending">
                        Pending <Badge className="ml-2">{pendingDocs.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="correction">
                        Needs Correction <Badge className="ml-2 bg-red-100 text-red-700">{needsCorrectionDocs.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="completed">
                        Completed <Badge className="ml-2 bg-green-100 text-green-700">{completedDocs.length}</Badge>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="pending" className="mt-4">
                    {pendingDocs.length === 0 ? (
                        <Card>
                            <CardContent className="p-8 text-center text-gray-500">
                                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                                <p className="font-medium">All caught up!</p>
                                <p className="text-sm">No pending documents at this time.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-3">
                            {pendingDocs.map(doc => (
                                <DocCard key={doc.id} doc={doc} />
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="correction" className="mt-4">
                    {needsCorrectionDocs.length === 0 ? (
                        <Card>
                            <CardContent className="p-8 text-center text-gray-500">
                                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                                <p className="font-medium">No corrections needed</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-3">
                            {needsCorrectionDocs.map(doc => (
                                <DocCard key={doc.id} doc={doc} showCorrectionNotes />
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="completed" className="mt-4">
                    {completedDocs.length === 0 ? (
                        <Card>
                            <CardContent className="p-8 text-center text-gray-500">
                                <FileText className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                                <p className="font-medium">No completed documents yet</p>
                                <p className="text-sm">Completed documents will appear here once signed.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-3">
                            {completedDocs.map(doc => (
                                <DocCard key={doc.id} doc={doc} />
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}