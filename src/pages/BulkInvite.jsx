
import React, { useState } from 'react';
import { User } from '@/api/entities.js';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils/index.js';
import { Upload, FileText, UserPlus, Copy, Check, Loader2, ArrowLeft } from 'lucide-react';

// A more flexible CSV parser that handles common column name variations
function parseCSV(text) {
  const lines = text.split(/\r?\n/);
  if (lines.length === 0 || !lines[0].trim()) {
      throw new Error('CSV file is empty or missing header.');
  }
  const header = lines[0].split(',').map(h => h.trim());
  
  // Find the name and email columns with flexible matching
  const nameCol = header.findIndex(h => 
    h.toLowerCase().includes('name') || 
    h.toLowerCase() === 'fullname' || 
    h.toLowerCase() === 'full_name'
  );
  const emailCol = header.findIndex(h => 
    h.toLowerCase().includes('email')
  );
  
  if (nameCol === -1 || emailCol === -1) {
    throw new Error('CSV must contain a name column (e.g., "Name", "fullName", "Full Name") and an email column (e.g., "Email", "email").');
  }
  
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    // Added .replace(/"/g, '') to handle quoted values in CSV
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    if (values[nameCol] && values[emailCol]) { // Only add if both name and email values are present
      rows.push({
        fullName: values[nameCol],
        email: values[emailCol]
      });
    }
  }
  return rows;
}

export default function BulkInvite() {
  const [file, setFile] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copiedStates, setCopiedStates] = useState({});

  const handleFileChange = (event) => {
    const f = event.target.files[0];
    if (f && f.type === 'text/csv') {
      setFile(f);
      setError(null);
    } else {
      setError('Please upload a valid CSV file.');
      setFile(null);
    }
  };

  const processFile = async () => {
    if (!file) {
      setError('Please select a file first.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setCandidates([]);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target.result;
        const parsedData = parseCSV(text);

        if (parsedData.length === 0) {
          throw new Error('No valid user data found in the CSV file after parsing.');
        }

        const emails = parsedData.map(p => p.email.toLowerCase());
        const existingUsers = await User.filter({ email: { $in: emails } });
        const existingEmails = new Set(existingUsers.map(u => u.email.toLowerCase()));

        const candidatesWithStatus = parsedData.map(candidate => ({
          ...candidate,
          status: existingEmails.has(candidate.email.toLowerCase()) ? 'Already Exists' : 'Ready to Invite'
        }));
        
        setCandidates(candidatesWithStatus);
      } catch (err) {
        setError(`Failed to process file: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsText(file);
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedStates(prev => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setCopiedStates(prev => ({ ...prev, [id]: false }));
    }, 2000);
  };

  return (
    <div className="p-6 space-y-6">
      <Link to={createPageUrl('TechRoster')}>
        <Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Roster</Button>
      </Link>
        
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <UserPlus className="w-6 h-6" />
            Bulk Invite Helper
          </CardTitle>
          <CardDescription>
            Streamline inviting multiple technicians. Upload a CSV, and we'll check for duplicates and prepare the data for you to quickly invite them.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 border rounded-lg bg-gray-50/50">
            <h3 className="font-semibold text-lg mb-2">Step 1: Prepare Your CSV</h3>
            <p className="text-sm text-gray-600 mb-3">
              Your CSV should have columns for names and emails. Common column names like "Name", "Full Name", "Email", "Email Address" will work automatically.
            </p>
            <a href="data:text/csv;charset=utf-8,Name,Email%0AJohn%20Doe,john.doe.contractor@m2fleetcom.com%0AJane%20Smith,jane.smith.contractor@m2fleetcom.com" download="invite_template.csv">
                <Button variant="outline">
                    <FileText className="w-4 h-4 mr-2"/>
                    Download Template
                </Button>
            </a>
          </div>

          <div className="p-4 border rounded-lg bg-gray-50/50">
            <h3 className="font-semibold text-lg mb-2">Step 2: Upload & Process</h3>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex-1 w-full">
                <Label htmlFor="csv-upload" className="sr-only">Upload CSV</Label>
                <Input id="csv-upload" type="file" accept=".csv" onChange={handleFileChange} />
              </div>
              <Button onClick={processFile} disabled={isLoading || !file}>
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                {isLoading ? 'Processing...' : 'Process File'}
              </Button>
            </div>
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          </div>

          {candidates.length > 0 && (
            <div className="space-y-4">
              <div className="p-4 border-2 rounded-lg bg-blue-50 border-blue-200">
                <h3 className="font-semibold text-lg mb-2 text-blue-800">Step 3: Invite Technicians</h3>
                <div className="flex gap-4 items-start">
                    <div className="text-blue-600 pt-1">
                        <UserPlus className="w-8 h-8"/>
                    </div>
                    <div>
                        <p className="font-semibold text-gray-900">
                            The official "Invite User" button is located in the main portal header at the very top of your screen.
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                            For each technician below, click that main 'Invite User' button, then use the copy buttons to quickly fill out the invitation form. This is the fastest and most secure way to invite your team.
                        </p>
                    </div>
                </div>
              </div>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Full Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {candidates.map((candidate, index) => (
                      <TableRow key={index}>
                        <TableCell>{candidate.fullName}</TableCell>
                        <TableCell>{candidate.email}</TableCell>
                        <TableCell>
                          <Badge variant={candidate.status === 'Ready to Invite' ? 'default' : 'secondary'}>
                            {candidate.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                            {candidate.status === 'Ready to Invite' && (
                                <div className="flex gap-2 justify-end">
                                    <Button size="sm" variant="outline" onClick={() => handleCopy(candidate.fullName, `${index}-name`)}>
                                        {copiedStates[`${index}-name`] ? <Check className="w-4 h-4 text-green-500"/> : <Copy className="w-4 h-4"/>}
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => handleCopy(candidate.email, `${index}-email`)}>
                                        {copiedStates[`${index}-email`] ? <Check className="w-4 h-4 text-green-500"/> : <Copy className="w-4 h-4"/>}
                                    </Button>
                                </div>
                            )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
