import React, { useState, useEffect } from 'react';
import { sendDocusignDocument } from '@/functions.js';
import { supabase } from '@/lib/supabaseClient.js';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Send, Loader2, Link2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';

export default function DocusignDashboard() {
    const [templates, setTemplates] = useState([]);
    const [envelopes, setEnvelopes] = useState([]);
    const [contractors, setContractors] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // State for sending (now stores objects instead of just IDs)
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [selectedRecipient, setSelectedRecipient] = useState(null);

    // State for new template link
    const [newTemplateName, setNewTemplateName] = useState('');
    const [newDocusignTemplateId, setNewDocusignTemplateId] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [
              { data: tpls, error: tplError },
              { data: envs, error: envError },
              { data: cons, error: conError }
            ] = await Promise.all([
                supabase.from('DocusignTemplate').select('*').order('created_date', { ascending: false }),
                supabase.from('DocusignEnvelope').select('*').order('created_date', { ascending: false }),
                supabase.from('User').select('id, full_name, displayName, email, active, role').neq('role', 'admin')
            ]);
            
            if (tplError) throw tplError;
            if (envError) throw envError;
            if (conError) throw conError;

            setTemplates(tpls || []);
            setEnvelopes(envs || []);
            setContractors((cons || []).filter(c => c.active !== false));
        } catch (err) {
            setError(`Failed to load data: ${err.message || err}`);
        } finally {
            setIsLoading(false);
        }
    };

    // Function to handle linking existing DocuSign templates
    const handleLinkTemplate = async (e) => {
        e.preventDefault();
        if (!newTemplateName || !newDocusignTemplateId) {
            setError('Please provide a name and a DocuSign Template ID.');
            setSuccess('');
            return;
        }
        setIsProcessing(true);
        setError('');
        setSuccess('');

        try {
            const { error: insertError } = await supabase.from('DocusignTemplate').insert({
                name: newTemplateName,
                docusignTemplateId: newDocusignTemplateId,
            });
            if (insertError) throw insertError;
            
            setSuccess('Template linked successfully!');
            setNewTemplateName('');
            setNewDocusignTemplateId('');
            loadData(); // Reload data to show the newly linked template
        } catch (err) {
            setError(`Template linking failed: ${err.message || err}`);
            setSuccess('');
        } finally {
            setIsProcessing(false);
        }
    };

    // New function as per outline
    const handleSendDocument = async () => {
        if (!selectedTemplate || !selectedRecipient) {
            setError('Please select both a template and recipient.');
            setSuccess('');
            return;
        }

        setIsProcessing(true); // Using existing isProcessing for loading
        setError(''); // Clear previous error
        setSuccess(''); // Clear previous success

        try {
            const { data } = await sendDocusignDocument({
                templateId: selectedTemplate.id,
                recipientEmail: selectedRecipient.email,
                recipientName: selectedRecipient.full_name || selectedRecipient.displayName || selectedRecipient.email
            });

            if (data.success) {
                setSuccess('Document sent successfully!');
                setError('');
                setSelectedTemplate(null);
                setSelectedRecipient(null);
                loadData(); // Reload all data to show the new envelope
            } else {
                setError(data.error || 'Failed to send document.');
                setSuccess('');
            }
        } catch (error) {
            setError(error.message || 'Failed to send document.');
            setSuccess('');
        } finally {
            setIsProcessing(false);
        }
    };

    const getStatusBadge = (status) => {
        const colors = {
            sent: 'bg-blue-100 text-blue-800',
            delivered: 'bg-yellow-100 text-yellow-800',
            completed: 'bg-green-100 text-green-800',
            signed: 'bg-green-100 text-green-800',
            declined: 'bg-red-100 text-red-800',
            voided: 'bg-gray-100 text-gray-800',
            default: 'bg-gray-100 text-gray-800'
        };
        return colors[status.toLowerCase()] || colors.default;
    };
    
    if (isLoading) {
        return <div className="p-6 flex justify-center items-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;
    }

    return (
        <div className="p-6 space-y-6">
            <h1 className="text-3xl font-bold text-gray-900">DocuSign Paperwork Center</h1>
            
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            {success && <Alert className="border-green-300 bg-green-50"><AlertDescription>{success}</AlertDescription></Alert>}

            <div className="grid lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>1. Link Existing DocuSign Template</CardTitle>
                        <CardDescription>Make your DocuSign templates available in this app by linking them.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleLinkTemplate} className="space-y-4">
                            <div>
                                <label htmlFor="template-name" className="font-medium">Template Name (in App)</label>
                                <Input 
                                    id="template-name" 
                                    placeholder="e.g., Independent Contractor Agreement" 
                                    value={newTemplateName} 
                                    onChange={e => setNewTemplateName(e.target.value)} 
                                    required 
                                />
                            </div>
                            <div>
                                <label htmlFor="template-id" className="font-medium">DocuSign Template ID</label>
                                <Input 
                                    id="template-id" 
                                    placeholder="Paste the Template ID from DocuSign here" 
                                    value={newDocusignTemplateId} 
                                    onChange={e => setNewDocusignTemplateId(e.target.value)} 
                                    required 
                                />
                            </div>
                            <Button type="submit" disabled={isProcessing} className="w-full">
                                {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2 className="w-4 h-4 mr-2" />}
                                Link Template
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>2. Send a Document</CardTitle>
                        <CardDescription>Select a linked template and a contractor to send a document for signature.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="font-medium">Select Template</label>
                            <Select 
                                value={selectedTemplate?.id || ''} 
                                onValueChange={value => setSelectedTemplate(templates.find(t => t.id === value) || null)}
                            >
                                <SelectTrigger><SelectValue placeholder="Choose a document template..." /></SelectTrigger>
                                <SelectContent>{templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="font-medium">Select Contractor</label>
                            <Select 
                                value={selectedRecipient?.id || ''} 
                                onValueChange={value => setSelectedRecipient(contractors.find(c => c.id === value) || null)}
                            >
                                <SelectTrigger><SelectValue placeholder="Choose a contractor..." /></SelectTrigger>
                                <SelectContent>{contractors.map(c => <SelectItem key={c.id} value={c.id}>{c.displayName || c.full_name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <Button 
                            onClick={handleSendDocument}
                            disabled={isProcessing || !selectedTemplate || !selectedRecipient}
                            className="w-full"
                        >
                            {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                            Send for Signature
                        </Button>
                    </CardContent>
                </Card>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Sent Document Status</CardTitle>
                    <CardDescription>Track the status of all documents sent for signature.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Contractor</TableHead>
                                <TableHead>Document</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Sent Date</TableHead>
                                <TableHead>Completed Date</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {envelopes.length > 0 ? envelopes.map(env => (
                                <TableRow key={env.id}>
                                    <TableCell>{env.recipientName}</TableCell>
                                    <TableCell>{env.templateName}</TableCell>
                                    <TableCell><Badge className={getStatusBadge(env.status)}>{env.status}</Badge></TableCell>
                                    <TableCell>{new Date(env.sentDate).toLocaleString()}</TableCell>
                                    <TableCell>{env.completedDate ? new Date(env.completedDate).toLocaleString() : 'N/A'}</TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan={5} className="text-center">No documents have been sent yet.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}