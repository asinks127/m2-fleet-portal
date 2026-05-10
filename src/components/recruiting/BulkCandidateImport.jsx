
import React, { useState } from 'react';
import { Candidate } from '@/api/entities.js';
import { UploadFile, ExtractDataFromUploadedFile } from '@/api/integrations.js';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Progress } from '@/components/ui/progress.jsx';
import { Upload, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

export default function BulkCandidateImport({ jobs, onSuccess, onCancel }) {
  const [selectedJobId, setSelectedJobId] = useState('');
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0]; // Use optional chaining
    if (selectedFile) {
      if (selectedFile.type === 'text/csv' || selectedFile.name.endsWith('.csv')) {
        setFile(selectedFile);
        setError(null);
      } else {
        setError('Please select a CSV file.');
        setFile(null);
      }
    }
  };

  const handleImport = async () => {
    if (!file || !selectedJobId) {
      setError('Please select both a job and a CSV file.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProgress(10);

    try {
      // Upload the file first
      const { file_url } = await UploadFile({ file });
      setProgress(30);

      // Define the expected CSV structure
      const candidateSchema = {
        type: "array",
        items: {
          type: "object",
          properties: {
            "Full Name": { type: "string" },
            "Email": { type: "string" },
            "Phone": { type: "string" },
            "Source": { type: "string" },
            "Resume URL": { type: "string" },
            "Notes": { type: "string" }
          },
          required: ["Full Name", "Email"]
        }
      };

      // Extract data from CSV
      const extractResult = await ExtractDataFromUploadedFile({
        file_url,
        json_schema: candidateSchema
      });

      setProgress(60);

      if (extractResult.status === 'error') {
        throw new Error(extractResult.details || 'Failed to process CSV file');
      }

      const candidateData = extractResult.output;
      if (!Array.isArray(candidateData) || candidateData.length === 0) {
        throw new Error('No valid candidate data found in the CSV file');
      }

      // Import candidates
      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      for (let i = 0; i < candidateData.length; i++) {
        try {
          const candidate = candidateData[i];
          await Candidate.create({
            jobOpeningId: selectedJobId,
            fullName: candidate["Full Name"],
            email: candidate["Email"],
            phone: candidate["Phone"] || '',
            resumeUrl: candidate["Resume URL"] || '',
            source: candidate["Source"] || 'CSV Import',
            notes: candidate["Notes"] || '',
            stage: 'New Applicant'
          });
          successCount++;
        } catch (err) {
          errorCount++;
          errors.push(`Row ${i + 1}: ${err.message}`);
        }
        
        setProgress(60 + ((i + 1) / candidateData.length) * 35);
      }

      setProgress(100);
      setResults({
        total: candidateData.length,
        success: successCount,
        errors: errorCount,
        errorDetails: errors.slice(0, 5) // Show only first 5 errors
      });

    } catch (err) {
      console.error('Import error:', err);
      setError(err.message || 'Failed to import candidates');
    } finally {
      setIsProcessing(false);
    }
  };

  if (results) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold">Import Complete!</h3>
        </div>
        
        <div className="bg-gray-50 p-4 rounded-lg space-y-2">
          <p><strong>Total candidates processed:</strong> {results.total}</p>
          <p><strong>Successfully imported:</strong> {results.success}</p>
          {results.errors > 0 && (
            <p><strong>Failed to import:</strong> {results.errors}</p>
          )}
        </div>

        {results.errorDetails.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Import Errors:</strong>
              <ul className="list-disc list-inside mt-2">
                {results.errorDetails.map((error, index) => (
                  <li key={index} className="text-sm">{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end gap-3">
          <Button onClick={onSuccess}>Done</Button>
        </div>
      </div>
    );
  }

  // Filter for only open jobs for the import
  const openJobs = jobs.filter(job => job.status === 'Open');

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div>
        <Label htmlFor="job-select">Select Job Opening *</Label>
        <Select value={selectedJobId} onValueChange={setSelectedJobId}>
          <SelectTrigger>
            <SelectValue placeholder="Choose which job these candidates are applying for..." />
          </SelectTrigger>
          <SelectContent>
            {openJobs.map(job => (
              <SelectItem key={job.id} value={job.id}>
                {job.title} - {job.location}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {openJobs.length === 0 && (
          <p className="text-sm text-red-600 mt-1">
            No open job positions available. Please create a job opening first.
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="csv-file">Upload CSV File *</Label>
        <div className="mt-2">
          <Input
            id="csv-file"
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            disabled={isProcessing}
          />
        </div>
        {file && (
          <p className="text-sm text-gray-600 mt-1">
            Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
          </p>
        )}
      </div>

      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <h4 className="font-semibold text-blue-900 mb-2">Expected CSV Format:</h4>
        <p className="text-sm text-blue-800 mb-2">Your CSV should have these columns (case-sensitive):</p>
        <div className="text-sm font-mono bg-white p-2 rounded border">
          Full Name, Email, Phone, Source, Resume URL, Notes
        </div>
        <p className="text-xs text-blue-700 mt-2">
          Only "Full Name" and "Email" are required. For "Resume URL", include direct links to uploaded resumes or leave blank.
        </p>
      </div>

      {isProcessing && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Processing candidates...</span>
          </div>
          <Progress value={progress} className="w-full" />
          <p className="text-sm text-gray-600 text-center">{Math.round(progress)}% complete</p>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isProcessing}>
          Cancel
        </Button>
        <Button 
          onClick={handleImport} 
          disabled={!file || !selectedJobId || isProcessing || openJobs.length === 0}
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Import Candidates
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
