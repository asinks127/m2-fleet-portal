import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient.js';
import { createPageUrl } from '@/utils/index.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Loader2, ShieldAlert, ShieldCheck, ShieldOff, Download, Upload, ExternalLink } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

export default function ComplianceDashboard() {
  const [complianceData, setComplianceData] = useState({
    workersComp: { expired: [], expiringSoon: [], missing: [], compliant: [] }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [uploadingFor, setUploadingFor] = useState(null);
  const fileInputRef = useRef(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch users and workers comp records
      const [users, wcRecords] = await Promise.all([
        (await supabase.from('User').select('*')).data,
        (await supabase.from('WorkersCompRecord').select('*')).data
      ]);

      // Show notification about auto-processing
      const autoProcessedRecords = wcRecords.filter(record => 
        record.notes && record.notes.includes('Auto-imported from uploaded document')
      );
      
      if (autoProcessedRecords.length > 0) {
        console.log(`Found ${autoProcessedRecords.length} auto-processed insurance records from uploaded documents`);
      }

      const activeContractors = users.filter(u => u.active !== false && u.email && (u.email.includes('.contractor@')));

      // Process Workers Comp
      const wcData = processRecords(activeContractors, wcRecords);

      setComplianceData({ workersComp: wcData });

    } catch (error) {
      console.error("Error loading compliance data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const processRecords = (contractors, records) => {
    const today = new Date();
    const processed = { expired: [], expiringSoon: [], missing: [], compliant: [] };
    const recordMap = new Map(records.map(r => [r.userEmail.toLowerCase(), r]));

    contractors.forEach(contractor => {
      const record = recordMap.get(contractor.email.toLowerCase());
      if (!record) {
        processed.missing.push({ user: contractor });
        return;
      }

      const expDate = new Date(record.expirationDate);
      const daysUntilExp = differenceInDays(expDate, today);

      const recordInfo = { user: contractor, record };
      if (daysUntilExp < 0) {
        processed.expired.push(recordInfo);
      } else if (daysUntilExp <= 30) {
        processed.expiringSoon.push(recordInfo);
      } else {
        processed.compliant.push(recordInfo);
      }
    });

    return processed;
  };

  const handleUploadClick = (userId) => {
    setUploadingFor(userId);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingFor) return;

    try {
      setIsLoading(true);
      const { data: uploadData, error: uploadError } = await supabase.storage.from('documents').upload(file.name, file);
      
      if (uploadError) throw uploadError;

      const file_url = uploadData.path;
      
      const { data: doc, error: docError } = await supabase.from('ContractorDocument').insert({
        contractorId: uploadingFor,
        fileName: file.name,
        fileUrl: file_url,
        mimeType: file.type,
        folder: 'Workers Comp',
        uploadedBy: (await supabase.auth.getUser()).data.user?.email,
        uploadDate: new Date().toISOString()
      }).select().single();

      if (docError) throw docError;

      // Trigger processing
      await (await fetch('/api/processInsuranceDocument', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documentId: doc.id }) })).json();
      
      await loadData();
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploadingFor(null);
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };
  
  const ComplianceTable = ({ title, items, columns, icon, showActions = false }) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">{icon}{title} ({items.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map(c => <TableHead key={c}>{c}</TableHead>)}
              {showActions && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length > 0 ? items.map((item, idx) => (
              <TableRow key={idx}>
                <TableCell>
                  <Link 
                    to={createPageUrl('ContractorProfile') + `?id=${item.user.id}&tab=documents`}
                    className="text-blue-600 hover:underline cursor-pointer"
                  >
                    {item.user.displayName || item.user.full_name}
                  </Link>
                </TableCell>
                {item.record && <TableCell>{item.record.provider}</TableCell>}
                {item.record && <TableCell>{format(new Date(item.record.expirationDate), 'MM/dd/yyyy')}</TableCell>}
                {item.record && <TableCell>{differenceInDays(new Date(item.record.expirationDate), new Date())} days</TableCell>}
                {!item.record && <TableCell colSpan={columns.length - 1} className="text-center">-</TableCell>}
                {showActions && (
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      {item.record?.documentUrl && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(item.record.documentUrl, '_blank')}
                            title="View COI"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            title="Download COI"
                          >
                            <a href={item.record.documentUrl} download>
                              <Download className="w-4 h-4" />
                            </a>
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUploadClick(item.user.id)}
                        title="Upload new COI"
                      >
                        <Upload className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            )) : <TableRow><TableCell colSpan={columns.length + (showActions ? 1 : 0)} className="text-center h-24">None</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  if (isLoading) {
      return <div className="p-6 flex justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }
  
  const wc = complianceData.workersComp;

  return (
    <div className="p-6 space-y-6">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={handleFileChange}
      />
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Compliance Dashboard</h1>
        <p className="text-gray-600 mt-1">
          Monitor contractor Workers' Compensation compliance status. 
          <span className="text-blue-600 text-sm ml-2">
            💡 Insurance documents uploaded to "Workers Comp" folders are automatically processed
          </span>
        </p>
      </div>
      
      <div className="grid md:grid-cols-4 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-green-600">Total Compliant</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{wc.compliant.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-red-600">Total Expired</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{wc.expired.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-orange-500">Expiring Soon (30d)</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{wc.expiringSoon.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-yellow-500">Missing Records</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{wc.missing.length}</p></CardContent>
        </Card>
      </div>

      <div className="space-y-6">
          <h2 className="text-2xl font-semibold border-b pb-2">Workers' Compensation</h2>
          <div className="grid lg:grid-cols-2 gap-6">
             <ComplianceTable title="Expired Policies" items={wc.expired} columns={['Technician', 'Provider', 'Expired On', 'Days Past']} icon={<ShieldAlert className="text-red-600"/>} showActions />
             <ComplianceTable title="Policies Expiring Soon" items={wc.expiringSoon} columns={['Technician', 'Provider', 'Expires On', 'Days Left']} icon={<ShieldCheck className="text-orange-500"/>} showActions />
          </div>
          <div className="grid lg:grid-cols-2 gap-6 mt-6">
            <ComplianceTable title="Missing Policies" items={wc.missing} columns={['Technician']} icon={<ShieldOff className="text-yellow-500"/>} showActions />
            <ComplianceTable title="Compliant Policies" items={wc.compliant} columns={['Technician', 'Provider', 'Expires On', 'Days Left']} icon={<ShieldCheck className="text-green-600"/>} showActions />
          </div>
      </div>

    </div>
  );
}