import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, CheckCircle, Clock, AlertCircle, FileText, PenTool, Download, User, CheckSquare } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const ONBOARDING_ITEMS = [
    { id: 'bg_check', label: 'Background Check Authorization', folder: 'Background Check Documents', required: true },
    { id: 'w9', label: 'W-9', folder: 'Tax Documents', required: true },
    { id: 'ein_statement', label: 'EIN Statement from the IRS', folder: 'Tax Documents', required: true },
    { id: 'contractor_agreement', label: 'Independent Contractor Agreement', folder: 'Agreements', required: true },
    { id: 'ach_auth', label: 'ACH Authorization Form', folder: 'ACH / Payment Documents', required: true }
];

const SAFETY_ITEMS = [
    { id: 'initial_safety', label: 'Initial Safety Document', folder: 'Safety Documents', required: true },
    { id: 'safety_standards', label: 'Acknowledgment of Safety Standards', folder: 'Safety Documents', required: true }
];

export default function FirstMeetingChecklist() {
    const [user, setUser] = useState(null);
    const [contractor, setContractor] = useState(null);
    const [contractorId, setContractorId] = useState(null);
    const [items, setItems] = useState([...ONBOARDING_ITEMS, ...SAFETY_ITEMS]);
    const [checklistStatus, setChecklistStatus] = useState({});
    const [loading, setLoading] = useState(true);
    const [isSigning, setIsSigning] = useState(false);
    const [signatureData, setSignatureData] = useState(null);
    const [typedName, setTypedName] = useState('');
    const [signedDocument, setSignedDocument] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        const init = async () => {
            const u = await base44.auth.user();
            if (u) {
                setUser(u);
                setContractorId(u.id);
                setTypedName(u.displayName || u.full_name || u.email || '');
                await loadChecklistData(u);
            }
        };
        init();
    }, []);

    const loadChecklistData = async (u) => {
        setLoading(true);
        try {
            // Load existing signature requests for this contractor
            const requests = await base44.entities.SignatureRequest.list(
                { technicianEmail: u.email },
                '-created_date',
                100
            );

            const status = {};
            
            for (const item of [...ONBOARDING_ITEMS, ...SAFETY_ITEMS]) {
                // Find matching signed/filed document
                const filed = requests.find(r => 
                    r.status === 'Signed' && 
                    (r.documentType === item.id || r.documentTitle?.toLowerCase().includes(item.label.toLowerCase()))
                );
                
                if (filed) {
                    status[item.id] = {
                        status: 'Completed',
                        initials: filed.signedByName?.charAt(0) || 'Y',
                        date: filed.signedAt,
                        documentId: filed.id
                    };
                } else {
                    // Check if sent
                    const sent = requests.find(r => 
                        (r.status === 'Sent' || r.status === 'Viewed' || r.status === 'Needs Review') &&
                        (r.documentType === item.id || r.documentTitle?.toLowerCase().includes(item.label.toLowerCase()))
                    );
                    
                    if (sent) {
                        status[item.id] = {
                            status: sent.status === 'Needs Review' ? 'Needs Review' : 'Sent',
                            initials: null,
                            date: null,
                            documentId: sent.id
                        };
                    } else {
                        status[item.id] = {
                            status: 'Not Started',
                            initials: null,
                            date: null,
                            documentId: null
                        };
                    }
                }
            }
            
            setChecklistStatus(status);
        } catch (err) {
            console.error('Error loading checklist:', err);
        } finally {
            setLoading(false);
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'Completed':
                return <CheckCircle className="w-4 h-4 text-green-600" />;
            case 'Sent':
            case 'Viewed':
                return <Clock className="w-4 h-4 text-yellow-600" />;
            case 'Needs Review':
                return <AlertCircle className="w-4 h-4 text-orange-600" />;
            default:
                return <Circle className="w-4 h-4 text-gray-400" />;
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'Completed':
                return <Badge className="bg-green-100 text-green-700">Completed</Badge>;
            case 'Sent':
            case 'Viewed':
                return <Badge variant="outline" className="text-yellow-600 border-yellow-300">Sent</Badge>;
            case 'Needs Review':
                return <Badge className="bg-orange-100 text-orange-700">Needs Review</Badge>;
            case 'Not Started':
                return <Badge variant="outline" className="text-gray-400">Not Started</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const completionCount = Object.values(checklistStatus).filter(s => s.status === 'Completed').length;
    const totalCount = items.length;
    const completionPct = Math.round((completionCount / totalCount) * 100);

    const handleFinalSign = async () => {
        if (!signatureData && !typedName) {
            setError('Please provide a signature');
            return;
        }

        setIsSigning(true);
        setError(null);

        try {
            // Create a signed checklist record
            const contractorName = (user?.displayName || user?.full_name || user?.email || 'Unknown').replace(/\s+/g, '');
            
            // Mark all completed items
            const completedItems = items.filter(item => checklistStatus[item.id]?.status === 'Completed');
            const dateStr = new Date().toISOString().split('T')[0];
            
            for (const item of completedItems) {
                // Create contractor document record for each completed item
                await base44.entities.ContractorDocument.create({
                    contractorId: user.id,
                    contractorEmail: user.email,
                    contractorName: user.displayName || user.full_name || user.email,
                    documentTitle: item.label,
                    documentType: item.id,
                    folder: item.folder,
                    fileName: `${contractorName}_${item.id}_${dateStr}.pdf`,
                    status: 'Filed',
                    signedAt: checklistStatus[item.id].date || new Date().toISOString(),
                    signedBy: user.email,
                    tags: ['signed', 'checklist', item.folder.toLowerCase().replace(/\s+/g, '_')]
                });
            }

            // Create a master checklist document record
            await base44.entities.ContractorDocument.create({
                contractorId: user.id,
                contractorEmail: user.email,
                contractorName: user.displayName || user.full_name || user.email,
                documentTitle: 'First Meeting Checklist - Signed',
                documentType: 'first_meeting_checklist',
                folder: 'Onboarding Documents',
                fileName: `${contractorName}_FirstMeetingChecklist_${dateStr}.pdf`,
                status: 'Filed',
                signedAt: new Date().toISOString(),
                signedBy: user.email,
                signatureData: signatureData,
                typedName: typedName,
                tags: ['signed', 'checklist', 'onboarding']
            });

            setSignedDocument({
                fileName: `${contractorName}_FirstMeetingChecklist_${dateStr}.pdf`,
                signedAt: new Date().toISOString()
            });
        } catch (err) {
            setError(err.message);
        } finally {
            setIsSigning(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-3xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold">First Meeting Checklist</h1>
                <p className="text-gray-500 text-sm">Complete and sign all required documents during your first meeting</p>
            </div>

            {/* Progress */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Overall Completion</span>
                        <span className="text-sm font-bold">{completionPct}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                            className="bg-green-500 h-2 rounded-full transition-all"
                            style={{ width: `${completionPct}%` }}
                        />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{completionCount} of {totalCount} items completed</p>
                </CardContent>
            </Card>

            {signedDocument ? (
                <Card>
                    <CardContent className="p-6 text-center">
                        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                        <h2 className="text-xl font-bold mb-2">Checklist Completed!</h2>
                        <p className="text-gray-500 mb-4">
                            Your signed checklist has been filed successfully.
                        </p>
                        <p className="text-sm font-mono bg-gray-100 p-2 rounded inline-block">
                            {signedDocument.fileName}
                        </p>
                        <div className="mt-4">
                            <Link to={createPageUrl('ContractorPaperworkDashboard')}>
                                <Button variant="outline">View My Documents →</Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* Onboarding Documents */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <User className="w-5 h-5" />
                                New Contractor Paperwork
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {ONBOARDING_ITEMS.map(item => {
                                    const itemStatus = checklistStatus[item.id] || { status: 'Not Started' };
                                    return (
                                        <div key={item.id} className="flex items-center gap-4 p-3 border rounded-lg">
                                            <div className="flex items-center gap-3 flex-1">
                                                {getStatusIcon(itemStatus.status)}
                                                <div>
                                                    <p className="font-medium text-sm">{item.label}</p>
                                                    {itemStatus.date && (
                                                        <p className="text-xs text-gray-500">
                                                            Completed: {format(new Date(itemStatus.date), 'MM/dd/yyyy')}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            {getStatusBadge(itemStatus.status)}
                                            {itemStatus.status === 'Completed' && itemStatus.initials && (
                                                <span className="text-sm text-gray-500">Initials: {itemStatus.initials}</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Safety Documents */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <FileText className="w-5 h-5" />
                                Safety Paperwork
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {SAFETY_ITEMS.map(item => {
                                    const itemStatus = checklistStatus[item.id] || { status: 'Not Started' };
                                    return (
                                        <div key={item.id} className="flex items-center gap-4 p-3 border rounded-lg">
                                            <div className="flex items-center gap-3 flex-1">
                                                {getStatusIcon(itemStatus.status)}
                                                <div>
                                                    <p className="font-medium text-sm">{item.label}</p>
                                                    {itemStatus.date && (
                                                        <p className="text-xs text-gray-500">
                                                            Completed: {format(new Date(itemStatus.date), 'MM/dd/yyyy')}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            {getStatusBadge(itemStatus.status)}
                                            {itemStatus.status === 'Completed' && itemStatus.initials && (
                                                <span className="text-sm text-gray-500">Initials: {itemStatus.initials}</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Final Signature */}
                    {completionPct === 100 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <PenTool className="w-5 h-5" />
                                    Final Contractor Signature
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <p className="text-sm text-gray-600">
                                    By signing below, I confirm that I have completed all required onboarding and safety paperwork, 
                                    and that all information provided is accurate to the best of my knowledge.
                                </p>

                                <div className="border rounded-lg p-4 space-y-3">
                                    <div>
                                        <label className="font-medium text-sm">Printed Name</label>
                                        <Input 
                                            value={typedName}
                                            onChange={e => setTypedName(e.target.value)}
                                            placeholder="Type your full name"
                                            className="mt-1"
                                        />
                                    </div>
                                    
                                    <div>
                                        <label className="font-medium text-sm">Signature</label>
                                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 mt-1 text-center">
                                            <p className="text-sm text-gray-400">
                                                Click to sign with your mouse or touch screen
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {error && (
                                    <div className="p-3 bg-red-50 text-red-700 text-sm rounded">
                                        {error}
                                    </div>
                                )}

                                <Button 
                                    onClick={handleFinalSign} 
                                    disabled={isSigning || !typedName}
                                    className="w-full"
                                >
                                    {isSigning ? (
                                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing...</>
                                    ) : (
                                        <><CheckCircle className="w-4 h-4 mr-2" />Sign & Submit Checklist</>
                                    )}
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
}

// Simple Circle icon component
function Circle({ className }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" />
        </svg>
    );
}