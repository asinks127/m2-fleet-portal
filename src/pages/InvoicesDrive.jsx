import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Invoice, User } from '@/api/entities.js';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert.jsx';
import { AlertCircle, Loader2, CheckCircle, ShieldAlert, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import FileBrowser from '../components/drive/FileBrowser';
import { supabase } from '@/lib/supabaseClient.js';
import { Button } from '@/components/ui/button.jsx';

export default function InvoicesDrive() {
  const [items, setItems] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [driveStatus, setDriveStatus] = useState(null);
  const [isCheckingDrive, setIsCheckingDrive] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const [projectFilter, setProjectFilter] = useState('all');
  const [m2PmFilter, setM2PmFilter] = useState('all');
  const [veloPmFilter, setVeloPmFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState('name_asc');

  const buildFileSystem = useCallback((invoices, users) => {
    try {
      const root = {}; 

      const userMap = users.reduce((acc, user) => {
        if (user.email) {
          acc[user.email.toLowerCase()] = user;
        }
        return acc;
      }, {});

      invoices.forEach(invoice => {
        const currentUser = userMap[invoice.contractorEmail?.toLowerCase()];
        // CORRECTED: Use the correct field 'business' and prioritize 'displayName' for consistent folder naming.
        const contractorName = currentUser?.displayName || currentUser?.business || currentUser?.full_name || invoice.contractorName || 'Unfiled';
        
        // Extract year from ISO date string directly to avoid timezone issues
        const year = invoice.invoiceDate ? invoice.invoiceDate.split('-')[0] : 'Unknown_Year';

        if (!root[contractorName]) {
          root[contractorName] = {
            user: currentUser || null,
            years: {}
          };
        }
        if (!root[contractorName].years[year]) {
          root[contractorName].years[year] = [];
        }
        root[contractorName].years[year].push({
          id: invoice.id,
          name: invoice.fileName,
          type: 'file',
          data: invoice
        });
      });
      
      const fileSystem = Object.keys(root).sort().map(contractorName => ({
        id: contractorName,
        name: contractorName,
        type: 'folder',
        user: root[contractorName].user,
        children: Object.keys(root[contractorName].years).sort((a, b) => b - a).map(year => ({
          id: `${contractorName}_${year}`,
          name: year,
          type: 'folder',
          children: root[contractorName].years[year]
        }))
      }));

      return fileSystem;
    } catch (err) {
      console.error('Error building file system:', err);
      return [];
    }
  }, []);

  const loadDriveData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('Loading invoices drive data...');
      
      // FIX: The most resilient fetch strategy. Sort by the approval date to ensure
      // that recently approved invoices are always fetched, regardless of their original creation date.
      const [allInvoices, allUsers] = await Promise.all([
        Invoice.list('-approvedDate', 5000), // Fetch by approved date descending
        User.list('-created_date', 1000)
      ]);
      
      // Filter for approved invoices on the client side for maximum reliability.
      const approvedInvoices = (allInvoices || []).filter(inv => inv.status === 'approved');
      console.log('Approved invoices found:', approvedInvoices.length);
      
      const contractorList = (allUsers || []).map(u => ({ 
        id: u.id, 
        name: u.displayName || u.business || u.full_name,
        email: u.email,
        project: u.project || null, 
        m2PM: u.m2PM || null, 
        veloPM: u.veloPM || null,
        endDate: u.endDate || null,
      }));
      setContractors(contractorList);
      
      const fileSystem = buildFileSystem(approvedInvoices, allUsers);
      console.log('Built file system with', fileSystem.length, 'contractor folders');
      setItems(fileSystem);
      
    } catch (err) {
      console.error('Detailed error loading drive data:', err);
      setError(`Failed to load invoice data: ${err.message}. Please check the browser console for details.`);
    } finally {
      setIsLoading(false);
    }
  }, [buildFileSystem]);

  useEffect(() => {
    loadDriveData();
    checkDriveConnection();
  }, [loadDriveData]);

  const checkDriveConnection = async () => {
    setIsCheckingDrive(true);
    try {
      const response = await /* FIXME: Unconverted base44 call */ supabase.functions.invoke('testDriveConnection');
      setDriveStatus(response.data);
    } catch (err) {
      console.error('Failed to check drive connection:', err);
    } finally {
      setIsCheckingDrive(false);
    }
  };

  const handleSyncInvoices = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const response = await /* FIXME: Unconverted base44 call */ supabase.functions.invoke('syncInvoicesToDrive');
      const data = response.data;
      if (data.success) {
        setSyncResult({
          type: 'success',
          message: `${data.message} ${data.remaining > 0 ? `(${data.remaining} more to go - click again)` : ''}`
        });
        // Reload data to reflect changes
        loadDriveData();
      } else {
        setSyncResult({
          type: 'error',
          message: data.error || 'Sync failed'
        });
      }
    } catch (err) {
      setSyncResult({
        type: 'error',
        message: 'Failed to invoke sync function: ' + err.message
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const projects = useMemo(() => {
    try {
      return ['all', ...new Set(contractors.map(c => c.project).filter(Boolean)).sort()];
    } catch (err) {
      return ['all'];
    }
  }, [contractors]);

  const m2Pms = useMemo(() => {
    try {
      return ['all', ...new Set(contractors.map(c => c.m2PM).filter(Boolean)).sort()];
    } catch (err) {
      return ['all'];
    }
  }, [contractors]);

  const veloPms = useMemo(() => {
    try {
      return ['all', ...new Set(contractors.map(c => c.veloPM).filter(Boolean)).sort()];
    } catch (err) {
      return ['all'];
    }
  }, [contractors]);

  const displayItems = useMemo(() => {
    try {
      let filteredItems = items.filter(item => {
        if (!item.user) return true;
        
        const projectMatch = projectFilter === 'all' || item.user.project === projectFilter;
        const m2PmMatch = m2PmFilter === 'all' || item.user.m2PM === m2PmFilter;
        const veloPmMatch = veloPmFilter === 'all' || item.user.veloPM === veloPmFilter;
        
        return projectMatch && m2PmMatch && veloPmMatch;
      });

      const [key, direction] = sortConfig.split('_');
      filteredItems.sort((a, b) => {
        const valA = key === 'name' ? a.name : a.user?.[key];
        const valB = key === 'name' ? b.name : b.user?.[key];
        
        let comparison = 0;
        if (key === 'endDate') {
          const dateA = valA ? new Date(valA).getTime() : 0;
          const dateB = valB ? new Date(valB).getTime() : 0;
          comparison = dateA - dateB;
        } else {
          comparison = (valA || '').toString().localeCompare((valB || '').toString());
        }
        
        return direction === 'asc' ? comparison : -comparison;
      });

      return filteredItems;
    } catch (err) {
      console.error('Error filtering items:', err);
      return [];
    }
  }, [items, projectFilter, m2PmFilter, veloPmFilter, sortConfig]);

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 h-full flex flex-col bg-gray-50">
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Invoices Drive</h1>
          <p className="text-gray-600 mt-1">Browse, manage, and organize approved invoices.</p>
        </div>
        <Button 
          className="bg-blue-600 hover:bg-blue-700 text-white shadow-md gap-2"
          onClick={() => window.open('https://drive.google.com/drive/folders/0AG5XubOTYKLFUk9PVA', '_blank')}
        >
           <ExternalLink className="w-4 h-4" />
           Open Google Drive Folder
        </Button>
      </div>

      {/* Drive Connection Status Alert */}
      {driveStatus && driveStatus.accessStatus !== 'success' && (
        <Alert variant="destructive" className="mb-6 bg-red-50 border-red-200 text-red-800">
          <ShieldAlert className="h-5 w-5" />
          <div className="ml-2">
            <AlertTitle className="font-bold">Google Drive Configuration Issue</AlertTitle>
            <AlertDescription className="mt-2 text-sm">
              {driveStatus.accessStatus === 'not_shared_drive' ? (
                 <div className="mb-3 font-semibold text-red-900">
                    CRITICAL: The configured folder is a regular "My Drive" folder, not a "Shared Drive". 
                    Service Accounts cannot upload to regular folders due to storage quotas.
                    <br/><br/>
                    Solution: Create a new "Shared Drive" (Team Drive) in Google Workspace and move the folder there.
                 </div>
              ) : (
                <p className="mb-2">
                    The system cannot upload files to the Google Drive folder. This is likely because the Service Account has not been granted permission.
                </p>
              )}
              <div className="bg-white p-3 rounded border border-red-300 text-xs font-mono mb-2 flex justify-between items-center gap-2">
                <div>
                  <p className="font-bold text-gray-500 mb-1">Service Account Email (Share folder with this):</p>
                  <p className="select-all break-all">{driveStatus.serviceAccountEmail}</p>
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => {
                    navigator.clipboard.writeText(driveStatus.serviceAccountEmail);
                    alert('Email copied!');
                  }}
                  className="h-8 shrink-0"
                >
                  <Copy className="w-3 h-3 mr-1" /> Copy
                </Button>
              </div>
              <p className="mb-2 break-all">
                <strong>Error Details:</strong> {driveStatus.errorDetails || 'Access Denied'}
              </p>
              
              {(driveStatus.errorDetails?.match(/https:\/\/[^\s]+/) || [])[0] && (
                <div className="mb-3">
                  <a 
                    href={(driveStatus.errorDetails.match(/https:\/\/[^\s]+/) || [])[0]} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
                  >
                    Click Here to Enable Drive API →
                  </a>
                </div>
              )}

              <p>
                <strong>Action Required:</strong>{' '}
                {(driveStatus.errorDetails?.includes('disabled') || driveStatus.errorDetails?.includes('not been used')) ? (
                  <span>
                    Click the button above to enable the Drive API. Wait 1-2 minutes after enabling, then click "Re-check Drive Connection".
                  </span>
                ) : (
                  <span>
                    Go to the Google Drive folder <code>{driveStatus.rootFolderId}</code> and share it with the email above (Editor access).
                  </span>
                )}
              </p>
            </AlertDescription>
          </div>
        </Alert>
      )}

      {driveStatus && driveStatus.accessStatus === 'success' && (
        <div className="mb-6">
           <Alert className="bg-green-50 border-green-200 text-green-800">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription>
               <div className="flex justify-between items-center mb-2">
                   <span>Google Drive Connected: <strong>{driveStatus.folderName}</strong> (Write Access Confirmed)</span>
                   <span className="text-xs opacity-70">ID: {driveStatus.rootFolderId}</span>
               </div>
               <div className="text-xs border-t border-green-200 pt-2 mt-2">
                  <span className="font-semibold mr-2">Service Account:</span>
                  <span className="font-mono select-all">{driveStatus.serviceAccountEmail}</span>
               </div>
            </AlertDescription>
          </Alert>
        </div>
      )}
      
      <div className="mb-4 flex justify-end gap-2">
        <Button 
            onClick={handleSyncInvoices} 
            disabled={isSyncing} 
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
        >
          {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {isSyncing ? 'Syncing...' : 'Sync Missing Invoices to Drive'}
        </Button>

        <Button variant="outline" onClick={checkDriveConnection} disabled={isCheckingDrive} className="text-sm gap-2">
          {isCheckingDrive ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertCircle className="h-4 w-4" />}
          {isCheckingDrive ? 'Checking...' : 'Check Connection'}
        </Button>
      </div>

      {syncResult && (
        <Alert className={`mb-4 ${syncResult.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {syncResult.type === 'success' ? <CheckCircle className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-red-600" />}
          <AlertDescription>{syncResult.message}</AlertDescription>
        </Alert>
      )}

      <div className="mb-4 bg-white p-4 rounded-lg shadow-sm border flex flex-col lg:flex-row gap-4 flex-wrap">
        <div className="w-full lg:w-auto lg:min-w-[180px]">
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger><SelectValue placeholder="Filter by project" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.filter(p => p !== 'all').map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full lg:w-auto lg:min-w-[180px]">
          <Select value={m2PmFilter} onValueChange={setM2PmFilter}>
            <SelectTrigger><SelectValue placeholder="Filter by M2 PM" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All M2 PMs</SelectItem>
              {m2Pms.filter(p => p !== 'all').map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full lg:w-auto lg:min-w-[180px]">
          <Select value={veloPmFilter} onValueChange={setVeloPmFilter}>
            <SelectTrigger><SelectValue placeholder="Filter by Velo PM" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Velo PMs</SelectItem>
              {veloPms.filter(p => p !== 'all').map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full lg:w-auto lg:min-w-[180px]">
          <Select value={sortConfig} onValueChange={setSortConfig}>
            <SelectTrigger><SelectValue placeholder="Sort by..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="name_asc">Name (A-Z)</SelectItem>
              <SelectItem value="name_desc">Name (Z-A)</SelectItem>
              <SelectItem value="endDate_desc">End Date (Newest)</SelectItem>
              <SelectItem value="endDate_asc">End Date (Oldest)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex-1 relative flex flex-col min-h-[400px]">
        {isLoading && items.length === 0 && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 rounded-lg backdrop-blur-sm border border-gray-200 shadow-sm">
            <div className="flex items-center space-x-2 bg-white p-4 rounded-lg shadow-lg">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="text-gray-600 font-medium">Loading Drive...</span>
            </div>
          </div>
        )}
        <FileBrowser
          initialItems={displayItems}
          isLoading={isLoading}
          onUpdate={(currentPath) => {
            loadDriveData();
            // FileBrowser will maintain its path state internally
          }}
          contractors={contractors}
        />
      </div>
    </div>
  );
}