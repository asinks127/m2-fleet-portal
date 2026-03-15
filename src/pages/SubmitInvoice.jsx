import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Progress } from '@/components/ui/progress.jsx';
import {
  Upload,
  FileText,
  Camera,
  CheckCircle,
  AlertCircle,
  Calendar,
  DollarSign
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils/index.js';
import { format, startOfWeek, endOfWeek } from 'date-fns';

// Helper to get current time as ISO string (store in UTC, display will convert)
const getCurrentTimeInCT = () => {
  return new Date().toISOString();
};

// Helper to format current time in Central Time using browser Intl API
const formatCentralTime = (date = new Date()) => {
  try {
    const centralString = date.toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    return centralString + ' CT';
  } catch (error) {
    console.error('Error formatting date:', error);
    return format(date, 'MMM d, yyyy h:mm a');
  }
};

// Generate the current work week (Monday to Sunday) - what contractors see
const getCurrentWorkPeriod = () => {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 }); // Sunday
  
  return {
    value: format(weekEnd, 'yyyy-MM-dd'), // Store Sunday as the week ending date
    label: `Week of ${format(weekStart, 'MMMM d')} - ${format(weekEnd, 'MMMM d, yyyy')}`
  };
};

export default function SubmitInvoice() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    workPeriod: getCurrentWorkPeriod().value,
    totalAmount: '',
    daysWorked: '',
    notes: ''
  });

  const currentPeriod = getCurrentWorkPeriod();

  React.useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = (await supabase.auth.getUser()).data.user;
      setUser(currentUser);
    } catch (error) {
      console.error('Error loading user:', error);
      setError('Could not load your user profile. Please try refreshing the page.');
    }
  };

  const handleFileSelection = (selectedFiles) => {
    if (!selectedFiles || selectedFiles.length === 0) {
      return;
    }
    
    const validFiles = Array.from(selectedFiles);

    const MAX_FILE_SIZE_MB = 50;
    const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

    const oversizedFiles = validFiles.filter(file => file.size > MAX_FILE_SIZE_BYTES);
    if (oversizedFiles.length > 0) {
      setError(`Some files are too large. Maximum file size is ${MAX_FILE_SIZE_MB}MB per file.`);
      return;
    }

    setFiles([...files, ...validFiles]);
    setError(null);
  };

  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const uploadFileWithRetry = async (file, maxRetries = 3) => {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Upload attempt ${attempt} for file: ${file.name}`);
        const uploadResult = await supabase.storage.from('documents').upload( file .file.name,  file .file);
        console.log(`Upload successful on attempt ${attempt}`);
        return uploadResult.file_url;
      } catch (error) {
        console.error(`Upload attempt ${attempt} failed:`, error);
        lastError = error;

        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    throw lastError;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // DIAGNOSTIC LOG - If you see this in console, you're running the NEW code
    console.log('🚀 SUBMIT INVOICE - NEW CODE VERSION 2.0 - NO PROFILE CHECKS', new Date().toISOString());
    console.log('Current form data:', formData);
    console.log('Files selected:', files.length);
    
    if (!files.length) {
      setError('Please select at least one file to upload.');
      return;
    }

    if (!formData.workPeriod) {
      setError('Please select the work period for this invoice.');
      return;
    }

    if (!formData.daysWorked || parseFloat(formData.daysWorked) <= 0) {
      setError('Please enter a valid number of days worked.');
      return;
    }

    // Check for duplicate invoices before processing
    try {
      console.log('Checking for duplicate invoices...');

      // 1. "Concerned Family Member" Check: Are you trying to upload the same file twice in this batch?
      const fileNamesInBatch = files.map(f => f.name.toLowerCase());
      const uniqueNamesInBatch = new Set(fileNamesInBatch);
      if (fileNamesInBatch.length !== uniqueNamesInBatch.size) {
        setError('It looks like you have selected the same file multiple times in this upload. Please remove duplicate files from your selection before submitting.');
        return;
      }

      // 2. Fetch existing invoices for this week
      const existingInvoices = await (await supabase.from('Invoice').select('*').match({
        contractorEmail: user?.email,
        weekEndingDate: formData.workPeriod
      })).data;

      console.log(`Found ${existingInvoices.length} existing invoices for this period`);

      // 3. "Concerned Family Member" Check: Have you submitted this file before?
      for (const file of files) {
        // Case-insensitive check for stricter matching
        const duplicate = existingInvoices.find(inv => 
          inv.fileName.toLowerCase() === file.name.toLowerCase() && 
          inv.status !== 'rejected' // Allow resubmission ONLY if the previous one was explicitly rejected
        );

        if (duplicate) {
          const weekEndingFormatted = format(new Date(formData.workPeriod), 'MMM d, yyyy');
          setError(
            `Double Check: We found a "${file.name}" already submitted for the week ending ${weekEndingFormatted}. ` +
            `It is currently marked as "${duplicate.status}". ` +
            `To prevent confusion, we cannot accept duplicates unless the previous one was rejected.`
          );
          return;
        }
      }

      console.log('No duplicates found, proceeding with submission...');
    } catch (checkError) {
      console.error('Error checking for duplicates:', checkError);
      setError('Failed to check for duplicate invoices. Please try again or contact support.');
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const totalFiles = files.length;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(((i + 0.25) / totalFiles) * 100);

        let file_url;
        try {
          file_url = await uploadFileWithRetry(file, 3);
        } catch (uploadError) {
          console.error('File Upload Error:', uploadError);
          let detail = 'Please check your internet connection and try again.';
          if (uploadError.message && uploadError.message.toLowerCase().includes('network')) {
            detail = 'A network error occurred during upload. This can happen with large files or an unstable connection. Please try again.';
          } else if (uploadError.message) {
            detail = `Details: ${uploadError.message}`;
          }
          throw new Error(`Failed to upload the file "${file.name}". ${detail}`);
        }

        setUploadProgress(((i + 0.5) / totalFiles) * 100);

        const status = 'pending';
        const pendingReason = 'Awaiting manual review and approval';

        setUploadProgress(((i + 0.75) / totalFiles) * 100);

        const contractorName = user?.displayName || user?.business || user?.full_name || user?.email;

        const invoice = await supabase.from('Invoice').insert({
          contractorName: contractorName,
          contractorEmail: user?.email,
          businessName: user?.business,
          fileName: file.name,
          fileUrl: file_url,
          mimeType: file.type,
          invoiceDate: getCurrentTimeInCT(),
          weekEndingDate: formData.workPeriod,
          totalAmount: formData.totalAmount ? parseFloat(formData.totalAmount) : undefined,
          daysWorked: formData.daysWorked ? parseFloat(formData.daysWorked) : undefined,
          status: status,
          autoApproved: false,
          approvedDate: undefined,
          rejectionReason: undefined,
          pendingReason: pendingReason,
          notes: formData.notes
        }).select().single();

        // Upload to Google Drive in the background
        fetch('/api/uploadToDrive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          fileUrl: file_url,
          fileName: file.name,
          documentType: 'invoice',
          contractorName: contractorName,
          invoiceId: invoice.id
        }) }).then(res => res.json()).then(result => {
          console.log('Invoice uploaded to Google Drive:', result);
        }).catch(err => {
          console.warn('Google Drive upload failed (non-blocking):', err);
        });

        setUploadProgress(((i + 1) / totalFiles) * 100);
      }

      console.log(`✅ Successfully submitted ${files.length} invoice(s) at ${new Date().toISOString()}`);
      setSuccess(true);
      setFiles([]);
      setFormData({
        workPeriod: getCurrentWorkPeriod().value,
        totalAmount: '',
        daysWorked: '',
        notes: ''
      });

    } catch (error) {
      console.error('Error submitting invoice:', error);
      setError(error.message || 'An unknown error occurred during submission. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      handleFileSelection(droppedFiles);
    }
  };

  if (success) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          <Card className="text-center border-2 border-green-200 bg-green-50">
            <CardContent className="p-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500 rounded-full mb-4">
                <CheckCircle className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Invoice Submitted Successfully!</h2>
              <p className="text-gray-700 mb-2 font-medium">
                Your invoice is now <span className="text-orange-600">pending review</span>.
              </p>
              <p className="text-sm text-gray-600 mb-4">
                Submitted at: {formatCentralTime()}
              </p>
              <p className="text-gray-600 mb-6">
                You'll receive an email notification once it's been reviewed and approved. This typically takes 1-2 business days.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-900">
                  <strong>What's next?</strong> Your invoice will be reviewed by our team. Once approved, it will be processed for payment according to our standard payment schedule.
                </p>
              </div>
              <div className="flex gap-3 justify-center">
                <Button
                  onClick={() => setSuccess(false)}
                  variant="outline"
                  className="bg-white"
                >
                  Submit Another Invoice
                </Button>
                <Button onClick={() => navigate(createPageUrl('ContractorDashboard'))} className="bg-blue-600 hover:bg-blue-700">
                  Back to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Submit Invoice</h1>
          <p className="text-gray-600 mt-1">Upload your weekly timesheet for the current work week</p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 h-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* File Upload */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Upload className="w-5 h-5" />
                  <span>Upload Files</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer"
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('file-input').click()}
                >
                  <Camera className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <h3 className="font-medium text-gray-900 mb-2">Drop files here or click to upload</h3>
                  <p className="text-sm text-gray-500">
                    Supports all file types (PDF, images, Excel, Word, etc.)
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Maximum 50MB per file
                  </p>
                </div>

                <input
                  id="file-input"
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx,.txt"
                  onChange={(e) => handleFileSelection(e.target.files)}
                  className="hidden"
                />

                {/* File List */}
                {files.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-900">Selected Files:</h4>
                    {files.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <FileText className="w-5 h-5 text-blue-500" />
                          <div>
                            <p className="font-medium text-gray-900">{file.name}</p>
                            <p className="text-sm text-gray-500">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Invoice Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5" />
                  <span>Invoice Details</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="workPeriod" className="text-base font-semibold">
                    Work Period *
                  </Label>
                  <p className="text-sm text-gray-500 mb-2">Submit your invoice for this work week (Monday - Sunday)</p>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="font-medium text-blue-900">{currentPeriod.label}</p>
                    <p className="text-xs text-blue-700 mt-1">Your invoice should cover work completed during this week</p>
                  </div>
                  <input type="hidden" name="workPeriod" value={formData.workPeriod} />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="daysWorked">Number of Days Worked *</Label>
                    <Input
                      id="daysWorked"
                      type="number"
                      step="1"
                      min="1"
                      max="7"
                      placeholder="5"
                      value={formData.daysWorked}
                      onChange={(e) => setFormData({...formData, daysWorked: e.target.value})}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="totalAmount">Total Amount</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        id="totalAmount"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        className="pl-9"
                        value={formData.totalAmount}
                        onChange={(e) => setFormData({...formData, totalAmount: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Any additional information about this invoice..."
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Upload Progress */}
          {isUploading && (
            <Card>
              <CardContent className="p-6">
                <div className="text-center mb-4">
                  <h3 className="font-medium text-gray-900">Submitting Your Invoice...</h3>
                  <p className="text-sm text-gray-600">Please don't close this page</p>
                </div>
                <Progress value={uploadProgress} className="w-full" />
                <p className="text-sm text-gray-500 text-center mt-2">
                  {Math.round(uploadProgress)}% complete
                </p>
              </CardContent>
            </Card>
          )}

          {/* Submit Button */}
          <div className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(createPageUrl('ContractorDashboard'))}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isUploading || files.length === 0 || !formData.workPeriod}
              className="bg-green-600 hover:bg-green-700"
            >
              {isUploading ? 'Submitting...' : 'Submit Invoice'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}