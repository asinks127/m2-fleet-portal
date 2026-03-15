import React, { useState, useEffect } from 'react';
import { sendSignatureRequest } from '@/functions.js';
import { User } from '@/api/entities.js';
import { Button } from '@/components/ui/button.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Loader2, Send, Plus, Trash2, CheckCircle, Clipboard, AlertCircle, Search } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';

function SentStatusScreen({ results, onDone }) {
  const [copiedStates, setCopiedStates] = useState({});

  const copyToClipboard = (text, email) => {
    navigator.clipboard.writeText(text);
    setCopiedStates(prev => ({ ...prev, [email]: true }));
    setTimeout(() => {
      setCopiedStates(prev => ({ ...prev, [email]: false }));
    }, 2000);
  };
  
  return (
    <div>
      <DialogHeader className="mb-4">
        <DialogTitle className="flex items-center gap-2">
          <CheckCircle className="w-6 h-6 text-green-500" />
          <span>Requests Sent Successfully</span>
        </DialogTitle>
      </DialogHeader>
      
      <div className="space-y-4 max-h-[50vh] overflow-y-auto p-1">
        <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
                We've attempted to email the links. If a recipient doesn't receive the email, you can copy the link below and send it to them manually.
            </AlertDescription>
        </Alert>
        
        {results.map((result, index) => (
          <div key={index} className="p-3 border rounded-lg bg-gray-50">
            <p className="font-semibold">{result.name}</p>
            <p className="text-sm text-gray-600">{result.email}</p>
            
            {result.signingUrl ? (
                <div className="flex items-center gap-2 mt-2">
                  <Input readOnly value={result.signingUrl} className="text-xs h-8 bg-white" />
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => copyToClipboard(result.signingUrl, result.email)}
                  >
                    {copiedStates[result.email] ? <CheckCircle className="w-4 h-4 text-green-500"/> : <Clipboard className="w-4 h-4" />}
                  </Button>
                </div>
            ) : (
                <p className="text-sm text-red-600 mt-1">Failed to generate link: {result.error}</p>
            )}
          </div>
        ))}
      </div>

      <DialogFooter className="mt-6">
        <Button onClick={onDone}>Done</Button>
      </DialogFooter>
    </div>
  );
}


export default function SendDocumentDialog({ template, open, onOpenChange, onSent }) {
  const [recipients, setRecipients] = useState([{ name: '', email: '' }]);
  const [selectedTechIds, setSelectedTechIds] = useState([]);
  const [allTechs, setAllTechs] = useState([]);
  const [techSearch, setTechSearch] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [sendMethod, setSendMethod] = useState('internal');
  const [sentResults, setSentResults] = useState(null);

  useEffect(() => {
    if (open) {
      loadTechnicians();
      setRecipients([{ name: '', email: '' }]);
      setSelectedTechIds([]);
      setError('');
      setSendMethod('internal');
      setSentResults(null);
    }
  }, [open]);

  const loadTechnicians = async () => {
    try {
      const users = await User.list();
      const technicians = users.filter(user => 
        user.email && 
        (user.email.includes('.contractor@m2fleetcom.com') || user.email.includes('.contractor@smcinstallations.com') || user.email.toLowerCase() === 'tjserota@gmail.com')
      );
      setAllTechs(technicians);
    } catch (error) {
      console.error('Error loading technicians:', error);
    }
  };

  const handleRecipientChange = (index, field, value) => {
    const newRecipients = [...recipients];
    newRecipients[index][field] = value;
    setRecipients(newRecipients);
    if (error) setError('');
  };

  const addRecipient = () => {
    setRecipients([...recipients, { name: '', email: '' }]);
  };

  const removeRecipient = (index) => {
    if (recipients.length > 1) {
      const newRecipients = recipients.filter((_, i) => i !== index);
      setRecipients(newRecipients);
    }
  };

  const handleTechSelection = (techId) => {
    setSelectedTechIds(prev => prev.includes(techId) ? prev.filter(id => id !== techId) : [...prev, techId]);
  };

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const filteredTechs = allTechs.filter(tech => {
    const search = techSearch.toLowerCase();
    const name = (tech.displayName || tech.full_name || '').toLowerCase();
    const email = (tech.email || '').toLowerCase();
    return name.includes(search) || email.includes(search);
  });

  const handleSend = async () => {
    let finalRecipients = [];

    if (sendMethod === 'internal') {
      if (selectedTechIds.length === 0) {
        setError('Please select at least one technician.');
        return;
      }
      finalRecipients = selectedTechIds.map(techId => {
        const tech = allTechs.find(t => t.id === techId);
        return { name: tech.displayName || tech.full_name || tech.email, email: tech.email, technicianId: tech.id };
      });
    } else {
      const validRecipients = recipients.filter(r => r.name.trim() && r.email.trim());
      if (validRecipients.length === 0) {
        setError('Please enter at least one recipient with a valid name and email.');
        return;
      }
      for (const recipient of validRecipients) {
        if (!validateEmail(recipient.email)) {
          setError(`Invalid email format: ${recipient.email}.`);
          return;
        }
      }
      finalRecipients = validRecipients.map(r => ({ ...r, technicianId: null }));
    }
    
    setIsSending(true);
    setError('');

    try {
      const { data, error: apiError } = await sendSignatureRequest({
        documentId: template.id,
        recipients: finalRecipients,
      });

      if (apiError || !data?.success) {
        throw new Error(apiError?.message || data?.error || 'An unknown error occurred.');
      }
      
      setSentResults(data.results);
      onSent();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleDialogClose = () => {
      setSentResults(null);
      onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="max-w-2xl">
        {sentResults ? (
            <SentStatusScreen results={sentResults} onDone={handleDialogClose} />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Send Document: {template?.title}</DialogTitle>
            </DialogHeader>
            
            <div className="py-4">
              <Tabs value={sendMethod} onValueChange={setSendMethod} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="internal">Send to Current Technicians</TabsTrigger>
                  <TabsTrigger value="external">Send to External Recipients</TabsTrigger>
                </TabsList>
                
                <TabsContent value="internal" className="mt-4">
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                      Select the technicians you want to send this document to. They will receive a notification on their dashboard.
                    </p>
                    
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                        <Input
                            placeholder="Search technicians..."
                            className="pl-9"
                            value={techSearch}
                            onChange={(e) => setTechSearch(e.target.value)}
                        />
                    </div>
                    
                    <div className="border rounded-md max-h-60 overflow-y-auto p-2 space-y-2">
                        {filteredTechs.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-4">No technicians found.</p>
                        ) : (
                            filteredTechs.map(tech => (
                                <div key={tech.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer border border-transparent hover:border-gray-200" onClick={() => handleTechSelection(tech.id)}>
                                    <Checkbox 
                                        id={`tech-${tech.id}`} 
                                        checked={selectedTechIds.includes(tech.id)}
                                        onCheckedChange={() => handleTechSelection(tech.id)}
                                    />
                                    <Label htmlFor={`tech-${tech.id}`} className="flex-1 cursor-pointer">
                                        <div className="font-medium text-gray-900">{tech.displayName || tech.full_name || 'Unknown Name'}</div>
                                        <div className="text-xs text-gray-500">{tech.email}</div>
                                    </Label>
                                </div>
                            ))
                        )}
                    </div>
                    
                    <div className="flex justify-between items-center text-sm text-gray-500 pt-2 border-t">
                        <span>{selectedTechIds.length} technician{selectedTechIds.length !== 1 ? 's' : ''} selected</span>
                        <div className="flex gap-2">
                            {selectedTechIds.length > 0 && (
                                <Button variant="ghost" size="sm" onClick={() => setSelectedTechIds([])} className="h-8 text-xs">
                                    Deselect All
                                </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => setSelectedTechIds(filteredTechs.map(t => t.id))} className="h-8 text-xs">
                                Select All Filtered
                            </Button>
                        </div>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="external" className="mt-4">
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                      Enter the details for external recipients who don't have accounts in the portal.
                    </p>
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                      {recipients.map((recipient, index) => (
                        <div key={index} className="flex items-end gap-2 p-3 border rounded-lg bg-gray-50">
                          <div className="grid grid-cols-2 gap-2 flex-grow">
                            <div>
                              <Label htmlFor={`name-${index}`} className="text-xs">Full Name *</Label>
                              <Input id={`name-${index}`} placeholder="e.g., John Doe" value={recipient.name} onChange={(e) => handleRecipientChange(index, 'name', e.target.value)} required />
                            </div>
                            <div>
                              <Label htmlFor={`email-${index}`} className="text-xs">Email Address *</Label>
                              <Input id={`email-${index}`} type="email" placeholder="e.g., john.doe@example.com" value={recipient.email} onChange={(e) => handleRecipientChange(index, 'email', e.target.value)} className={!validateEmail(recipient.email) && recipient.email.length > 0 ? 'border-red-300' : ''} required />
                              {!validateEmail(recipient.email) && recipient.email.length > 0 && (
                                <p className="text-xs text-red-600 mt-1">Please enter a valid email address</p>
                              )}
                            </div>
                          </div>
                          {recipients.length > 1 && (<Button variant="ghost" size="icon" onClick={() => removeRecipient(index)} className="text-red-500"><Trash2 className="w-4 h-4" /></Button>)}
                        </div>
                      ))}
                    </div>
                    <Button variant="outline" size="sm" onClick={addRecipient} className="flex items-center gap-2"><Plus className="w-4 h-4" /> Add Another Recipient</Button>
                  </div>
                </TabsContent>
              </Tabs>

              {error && (
                <Alert variant="destructive" className="mt-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleSend} disabled={isSending}>
                {isSending ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</>) : (<><Send className="w-4 h-4 mr-2" />Send</>)}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}