import React, { useState, useEffect } from 'react';
import { AutomationSetting } from '@/api/entities.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Loader2, CheckCircle, Info, Copy, Settings, RefreshCw, CloudUpload } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils/index.js';

const INVOICE_WEBHOOK_KEY = 'invoiceApprovedWebhookUrl';

export default function AutomationSettings() {
    const [webhookUrl, setWebhookUrl] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [settingId, setSettingId] = useState(null);
    const [status, setStatus] = useState({ message: '', type: '' });
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncResults, setSyncResults] = useState(null);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setIsLoading(true);
        try {
            const settings = await AutomationSetting.filter({ key: INVOICE_WEBHOOK_KEY });
            if (settings.length > 0) {
                setWebhookUrl(settings[0].value);
                setSettingId(settings[0].id);
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            setStatus({ message: 'Failed to load settings.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        setStatus({ message: '', type: '' });
        try {
            if (settingId) {
                // Update existing setting
                await AutomationSetting.update(settingId, { value: webhookUrl });
            } else {
                // Create new setting
                const newSetting = await AutomationSetting.create({
                    key: INVOICE_WEBHOOK_KEY,
                    value: webhookUrl,
                    description: 'Webhook URL to send approved invoice data to for services like Zapier.'
                });
                setSettingId(newSetting.id);
            }
            setStatus({ message: 'Settings saved successfully!', type: 'success' });
        } catch (error) {
            console.error('Error saving settings:', error);
            setStatus({ message: 'Failed to save settings. Please try again.', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSyncToDrive = async () => {
        setIsSyncing(true);
        setSyncResults(null);
        setStatus({ message: '', type: '' });
        try {
            const response = await fetch('/api/syncContractorDocumentsToDrive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            const result = await response.json();
            
            if (result.success) {
                setSyncResults(result);
                setStatus({ message: `Sync complete! ${result.success} documents uploaded, ${result.failed} failed.`, type: 'success' });
            } else {
                setStatus({ message: result.error || 'Sync failed', type: 'error' });
            }
        } catch (error) {
            setStatus({ message: 'Failed to sync documents. Please try again.', type: 'error' });
        } finally {
            setIsSyncing(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setStatus({ message: 'Example JSON copied to clipboard!', type: 'info' });
        setTimeout(() => setStatus({ message: '', type: '' }), 3000);
    };

    const exampleJson = {
        "fileName": "Invoice_John_Doe.pdf",
        "fileUrl": "https://example.com/path/to/invoice.pdf",
        "contractorName": "John Doe",
        "businessName": "Doe's Installations",
        "approvedDate": new Date().toISOString(),
        "totalAmount": 1500.00,
        "weekEndingDate": "2025-09-07"
    };

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin" /></div>;
    }

    return (
        <div className="p-6 space-y-6 max-w-4xl mx-auto">
            <div className="flex items-center gap-3">
                 <Settings className="w-8 h-8" />
                 <div>
                    <h1 className="text-3xl font-bold text-gray-900">Automation Settings</h1>
                    <p className="text-gray-600 mt-1">Connect the M2 Portal to other services like Google Drive via webhooks.</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CloudUpload className="w-5 h-5" />
                        Google Drive Sync
                    </CardTitle>
                    <CardDescription>
                        Manually sync all contractor documents to Google Drive. Documents are organized by contractor name and document type. 
                        Automatic sync runs daily at 3:00 AM.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                        <Button onClick={handleSyncToDrive} disabled={isSyncing} className="flex items-center gap-2">
                            {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            {isSyncing ? 'Syncing...' : 'Sync All Documents to Drive'}
                        </Button>
                        <span className="text-sm text-gray-500">
                            This may take a few minutes depending on the number of documents.
                        </span>
                    </div>
                    
                    {syncResults && (
                        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                            <h4 className="font-semibold mb-2">Sync Results:</h4>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-green-600">{syncResults.success}</div>
                                    <div className="text-gray-600">Uploaded</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-red-600">{syncResults.failed}</div>
                                    <div className="text-gray-600">Failed</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-gray-400">{syncResults.skipped}</div>
                                    <div className="text-gray-600">Skipped</div>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Invoice Approval Automation</CardTitle>
                    <CardDescription>
                        When an invoice is approved, its data will be sent to the URL below. 
                        You can use services like <a href="https://zapier.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">Zapier</a> or <a href="https://www.make.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">Make.com</a> to catch this data and send it to Google Drive.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label htmlFor="webhookUrl">Webhook URL</Label>
                        <Input
                            id="webhookUrl"
                            placeholder="Paste your webhook URL from Zapier or Make.com here"
                            value={webhookUrl}
                            onChange={(e) => setWebhookUrl(e.target.value)}
                        />
                    </div>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        Save URL
                    </Button>
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle>How to Set Up with Zapier</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                    <p>1. In Zapier, create a new Zap and choose **"Webhooks by Zapier"** as the trigger.</p>
                    <p>2. Select the event **"Catch Hook"** and click Continue.</p>
                    <p>3. Zapier will give you a "Custom Webhook URL". Copy it and paste it into the field above, then save.</p>
                    <p>4. Go to the <Link to={createPageUrl("PendingInvoices")} className="underline font-medium">Pending Invoices page</Link> in this app and approve an invoice to send test data.</p>
                    <p>5. Back in Zapier, click "Test trigger". You should see the invoice data.</p>
                    <p>6. For the Action step, choose **"Google Drive"** and the event **"Upload File"**.</p>
                    <p>7. In the "File" field, select the **`File Url`** from the webhook data. This tells Google Drive to download the file from the provided link.</p>
                    <p>8. You can customize the file name and folder path using data from the webhook (e.g., set the folder to `contractorName`).</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Example Data Sent</CardTitle>
                    <CardDescription>When an invoice is approved, we send a JSON object like this to your webhook:</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="relative bg-gray-900 text-white p-4 rounded-lg">
                        <Button variant="ghost" size="icon" className="absolute top-2 right-2 text-gray-400 hover:text-white" onClick={() => copyToClipboard(JSON.stringify(exampleJson, null, 2))}>
                            <Copy className="w-4 h-4" />
                        </Button>
                        <pre><code>{JSON.stringify(exampleJson, null, 2)}</code></pre>
                    </div>
                </CardContent>
            </Card>

            {status.message && (
                <Alert className={`${status.type === 'error' ? 'border-red-500 text-red-700' : 'border-green-500 text-green-700'}`}>
                   {status.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <Info className="h-4 w-4" />}
                  <AlertDescription>{status.message}</AlertDescription>
                </Alert>
            )}

        </div>
    );
}
