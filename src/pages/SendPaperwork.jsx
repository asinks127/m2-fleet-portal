import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Search, Send, Users, FileText, Plus, X, Check, AlertCircle, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const DOCUMENT_TYPES = [
    { value: 'onboarding', label: 'Onboarding Documents' },
    { value: 'safety', label: 'Safety Documents' },
    { value: 'agreement', label: 'Agreements' },
    { value: 'tax', label: 'Tax Documents' },
    { value: 'background', label: 'Background Check' },
    { value: 'ach', label: 'ACH / Payment' },
    { value: 'other', label: 'Other' }
];

export default function SendPaperwork() {
    const [step, setStep] = useState(1);
    const [packetName, setPacketName] = useState('');
    const [documentType, setDocumentType] = useState('onboarding');
    const [message, setMessage] = useState('');
    const [dueDate, setDueDate] = useState('');
    
    const [availableDocs, setAvailableDocs] = useState([]);
    const [selectedDocIds, setSelectedDocIds] = useState([]);
    const [docSearch, setDocSearch] = useState('');
    
    const [contractors, setContractors] = useState([]);
    const [selectedContractorIds, setSelectedContractorIds] = useState([]);
    const [contractorSearch, setContractorSearch] = useState('');
    const [sendToAll, setSendToAll] = useState(false);
    
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadDocuments();
        loadContractors();
    }, []);

    const loadDocuments = async () => {
        try {
            const docs = await base44.entities.SignableDocument.list({}, '-created_date', 100);
            setAvailableDocs(docs || []);
        } catch (err) {
            console.error('Error loading documents:', err);
        }
    };

    const loadContractors = async () => {
        try {
            const users = await base44.entities.User.list({ role: 'contractor' }, 'displayName', 500);
            setContractors(users || []);
        } catch (err) {
            console.error('Error loading contractors:', err);
        }
    };

    const filteredDocs = availableDocs.filter(d => 
        (d.title || d.name || '').toLowerCase().includes(docSearch.toLowerCase())
    );

    const filteredContractors = contractors.filter(c => {
        const name = (c.displayName || c.full_name || c.email || '').toLowerCase();
        const email = (c.email || '').toLowerCase();
        const search = contractorSearch.toLowerCase();
        return name.includes(search) || email.includes(search);
    });

    const toggleDoc = (docId) => {
        setSelectedDocIds(prev => 
            prev.includes(docId) 
                ? prev.filter(id => id !== docId)
                : [...prev, docId]
        );
    };

    const toggleContractor = (contractorId) => {
        setSelectedContractorIds(prev =>
            prev.includes(contractorId)
                ? prev.filter(id => id !== contractorId)
                : [...prev, contractorId]
        );
    };

    const handleSend = async () => {
        setIsLoading(true);
        setError(null);
        
        try {
            const recipientIds = sendToAll ? contractors.map(c => c.id) : selectedContractorIds;
            
            if (!recipientIds.length) {
                setError('Please select at least one contractor');
                setIsLoading(false);
                return;
            }

            const payload = {
                packetName: packetName || `Paperwork Packet - ${format(new Date(), 'MM/dd/yyyy')}`,
                documentIds: selectedDocIds,
                recipientIds: recipientIds,
                documentType,
                message,
                dueDate: dueDate || null
            };

            const result = await base44.functions.invoke('sendPaperworkPacket', payload);
            const data = result.output || result;
            
            if (data.error) {
                setError(data.error);
            } else {
                setResults(data.results);
                setStep(4);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const resetForm = () => {
        setStep(1);
        setPacketName('');
        setDocumentType('onboarding');
        setMessage('');
        setDueDate('');
        setSelectedDocIds([]);
        setSelectedContractorIds([]);
        setSendToAll(false);
        setResults(null);
        setError(null);
    };

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link to={createPageUrl('AdminPaperworkDashboard')}>
                    <Button variant="ghost" size="sm">← Back</Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold">Send Paperwork Packet</h1>
                    <p className="text-gray-500 text-sm">Send documents to contractors for signing</p>
                </div>
            </div>

            {/* Progress Steps */}
            <div className="flex items-center gap-4">
                {[1, 2, 3].map(s => (
                    <React.Fragment key={s}>
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm
                            ${step >= s ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                            {step > s ? <Check className="w-4 h-4" /> : s}
                        </div>
                        <span className={`text-sm ${step >= s ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                            {s === 1 ? 'Select Docs' : s === 2 ? 'Choose Recipients' : 'Review & Send'}
                        </span>
                        {s < 3 && <div className={`flex-1 h-px ${step > s ? 'bg-blue-600' : 'bg-gray-200'}`} />}
                    </React.Fragment>
                ))}
            </div>

            {/* Step 1: Select Documents */}
            {step === 1 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Step 1: Select Documents</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Packet Name</Label>
                                <Input 
                                    value={packetName} 
                                    onChange={e => setPacketName(e.target.value)}
                                    placeholder="e.g., Q2 Safety Update"
                                />
                            </div>
                            <div>
                                <Label>Document Type</Label>
                                <select 
                                    className="w-full border rounded-md p-2"
                                    value={documentType}
                                    onChange={e => setDocumentType(e.target.value)}
                                >
                                    {DOCUMENT_TYPES.map(t => (
                                        <option key={t.value} value={t.value}>{t.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <Label>Search Documents</Label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <Input 
                                    className="pl-9"
                                    placeholder="Search by title..."
                                    value={docSearch}
                                    onChange={e => setDocSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                            {filteredDocs.length === 0 ? (
                                <p className="p-4 text-center text-gray-500 text-sm">No documents found</p>
                            ) : filteredDocs.map(doc => (
                                <div 
                                    key={doc.id}
                                    className={`p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50
                                        ${selectedDocIds.includes(doc.id) ? 'bg-blue-50' : ''}`}
                                    onClick={() => toggleDoc(doc.id)}
                                >
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center
                                        ${selectedDocIds.includes(doc.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                                        {selectedDocIds.includes(doc.id) && <Check className="w-3 h-3 text-white" />}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-medium text-sm">{doc.title || doc.name}</p>
                                        <p className="text-xs text-gray-500">{doc.documentType || 'General'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <p className="text-sm text-gray-500">
                            {selectedDocIds.length} document{selectedDocIds.length !== 1 ? 's' : ''} selected
                        </p>

                        <div className="flex justify-end">
                            <Button onClick={() => setStep(2)} disabled={selectedDocIds.length === 0}>
                                Next: Choose Recipients →
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Step 2: Choose Recipients */}
            {step === 2 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Step 2: Choose Recipients</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="checkbox"
                                    checked={sendToAll}
                                    onChange={e => {
                                        setSendToAll(e.target.checked);
                                        if (e.target.checked) setSelectedContractorIds([]);
                                    }}
                                    className="w-4 h-4"
                                />
                                <span className="text-sm font-medium">Send to all contractors ({contractors.length})</span>
                            </label>
                        </div>

                        {!sendToAll && (
                            <>
                                <div>
                                    <Label>Search Contractors</Label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <Input 
                                            className="pl-9"
                                            placeholder="Search by name or email..."
                                            value={contractorSearch}
                                            onChange={e => setContractorSearch(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="border rounded-lg divide-y max-h-80 overflow-y-auto">
                                    {filteredContractors.length === 0 ? (
                                        <p className="p-4 text-center text-gray-500 text-sm">No contractors found</p>
                                    ) : filteredContractors.map(c => (
                                        <div 
                                            key={c.id}
                                            className={`p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50
                                                ${selectedContractorIds.includes(c.id) ? 'bg-blue-50' : ''}`}
                                            onClick={() => toggleContractor(c.id)}
                                        >
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center
                                                ${selectedContractorIds.includes(c.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                                                {selectedContractorIds.includes(c.id) && <Check className="w-3 h-3 text-white" />}
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-medium text-sm">{c.displayName || c.full_name || c.email}</p>
                                                <p className="text-xs text-gray-500">{c.email} · {c.project || 'No project'}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <p className="text-sm text-gray-500">
                                    {selectedContractorIds.length} contractor{selectedContractorIds.length !== 1 ? 's' : ''} selected
                                </p>
                            </>
                        )}

                        <div className="flex justify-between">
                            <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
                            <Button onClick={() => setStep(3)} disabled={!sendToAll && selectedContractorIds.length === 0}>
                                Next: Review →
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Step 3: Review & Send */}
            {step === 3 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Step 3: Review & Send</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="font-medium text-gray-500">Packet Name</p>
                                <p>{packetName || `(Auto: Paperwork Packet - ${format(new Date(), 'MM/dd/yyyy')})`}</p>
                            </div>
                            <div>
                                <p className="font-medium text-gray-500">Document Type</p>
                                <p>{DOCUMENT_TYPES.find(t => t.value === documentType)?.label}</p>
                            </div>
                            <div>
                                <p className="font-medium text-gray-500">Documents</p>
                                <p>{selectedDocIds.length} document(s) selected</p>
                            </div>
                            <div>
                                <p className="font-medium text-gray-500">Recipients</p>
                                <p>
                                    {sendToAll 
                                        ? `All contractors (${contractors.length})`
                                        : `${selectedContractorIds.length} contractor(s) selected`
                                    }
                                </p>
                            </div>
                            {dueDate && (
                                <div>
                                    <p className="font-medium text-gray-500">Due Date</p>
                                    <p>{format(new Date(dueDate), 'MM/dd/yyyy')}</p>
                                </div>
                            )}
                        </div>

                        <div>
                            <Label>Message to Contractors (optional)</Label>
                            <textarea
                                className="w-full border rounded-md p-2 text-sm"
                                rows={3}
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                placeholder="Add a note for the contractors..."
                            />
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                {error}
                            </div>
                        )}

                        <div className="flex justify-between">
                            <Button variant="outline" onClick={() => setStep(2)}>← Back</Button>
                            <Button onClick={handleSend} disabled={isLoading}>
                                {isLoading ? (
                                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</>
                                ) : (
                                    <><Send className="w-4 h-4 mr-2" />Send Paperwork</>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Step 4: Results */}
            {step === 4 && results && (
                <Card>
                    <CardHeader>
                        <CardTitle>Paperwork Sent Successfully</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center gap-2 text-green-800">
                                <Check className="w-5 h-5" />
                                <p className="font-medium">Sent to {results.sent?.length || 0} recipients</p>
                            </div>
                        </div>

                        {results.sent?.length > 0 && (
                            <div>
                                <p className="font-medium text-sm mb-2">Sent to:</p>
                                <div className="space-y-1 max-h-40 overflow-y-auto">
                                    {results.sent.map((r, i) => (
                                        <div key={i} className="flex items-center gap-2 text-sm">
                                            <Mail className="w-3 h-3 text-gray-400" />
                                            <span className="text-gray-600">{r.recipient}</span>
                                            <span className="text-gray-400">·</span>
                                            <span className="text-gray-500">{r.document}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {results.failed?.length > 0 && (
                            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <p className="font-medium text-yellow-800">Failed: {results.failed.length}</p>
                                {results.failed.map((f, i) => (
                                    <p key={i} className="text-sm text-yellow-700">{f.recipient}: {f.error}</p>
                                ))}
                            </div>
                        )}

                        <div className="flex justify-between">
                            <Button variant="outline" onClick={resetForm}>Send Another Packet</Button>
                            <Link to={createPageUrl('AdminPaperworkDashboard')}>
                                <Button>View Dashboard →</Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}