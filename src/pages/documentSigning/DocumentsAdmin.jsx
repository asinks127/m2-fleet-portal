import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { db } from '@/config/firebase.js';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  updateDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, Plus, Search, Filter, Download, Trash2, Eye, Send, 
  MoreHorizontal, Clock, CheckCircle, XCircle, AlertCircle, Users,
  PenTool, Copy, RotateCcw, Building, Calendar, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger 
} from '@/components/ui/dropdown.jsx';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from '@/components/ui/dialog.jsx';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import { toast } from 'sonner';

import { 
  DOCUMENT_STATUS, 
  DOCUMENT_TYPES,
  FIELD_TYPES,
} from '@/lib/documentSigning/models.js';

const STATUS_CONFIG = {
  [DOCUMENT_STATUS.DRAFT]: { color: 'gray', icon: Clock, label: 'Draft' },
  [DOCUMENT_STATUS.SENT]: { color: 'blue', icon: Send, label: 'Sent' },
  [DOCUMENT_STATUS.VIEWED]: { color: 'yellow', icon: Eye, label: 'Viewed' },
  [DOCUMENT_STATUS.SIGNED]: { color: 'purple', icon: PenTool, label: 'Partially Signed' },
  [DOCUMENT_STATUS.COMPLETED]: { color: 'green', icon: CheckCircle, label: 'Completed' },
  [DOCUMENT_STATUS.DECLINED]: { color: 'red', icon: XCircle, label: 'Declined' },
  [DOCUMENT_STATUS.VOIDED]: { color: 'gray', icon: XCircle, label: 'Voided' },
  [DOCUMENT_STATUS.EXPIRED]: { color: 'orange', icon: AlertCircle, label: 'Expired' },
};

export default function DocumentsAdmin() {
  const navigate = useNavigate();
  
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState([]);
  const [requests, setRequests] = useState([]);
  const [bulkSends, setBulkSends] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  
  // Modals
  const [showBulkSendModal, setShowBulkSendModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      if (!db) {
        console.warn('Firebase not configured');
        setLoading(false);
        return;
      }

      // Load templates
      const templatesQuery = query(
        collection(db, 'documentTemplates'),
        orderBy('createdAt', 'desc'),
        limit(100)
      );
      const templatesSnap = await getDocs(templatesQuery);
      setTemplates(templatesSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // Load requests
      const requestsQuery = query(
        collection(db, 'documentRequests'),
        orderBy('createdAt', 'desc'),
        limit(100)
      );
      const requestsSnap = await getDocs(requestsQuery);
      setRequests(requestsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // Load bulk sends
      const bulkQuery = query(
        collection(db, 'bulkSends'),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      const bulkSnap = await getDocs(bulkQuery);
      setBulkSends(bulkSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  }

  // Filters
  const filteredRequests = useMemo(() => {
    let filtered = requests;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(r => 
        r.name?.toLowerCase().includes(q) ||
        r.contractorName?.toLowerCase().includes(q) ||
        r.signers?.some(s => s.name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q))
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(r => r.documentType === typeFilter);
    }

    return filtered;
  }, [requests, searchQuery, statusFilter, typeFilter]);

  // Stats
  const stats = useMemo(() => ({
    total: requests.length,
    pending: requests.filter(r => ['sent', 'viewed', 'signed'].includes(r.status)).length,
    completed: requests.filter(r => r.status === DOCUMENT_STATUS.COMPLETED).length,
    expired: requests.filter(r => r.status === DOCUMENT_STATUS.EXPIRED).length,
  }), [requests]);

  // Actions
  async function voidDocument(requestId) {
    if (!confirm('Are you sure you want to void this document?')) return;

    try {
      await updateDoc(doc(db, 'documentRequests', requestId), {
        status: DOCUMENT_STATUS.VOIDED,
        updatedAt: Timestamp.now(),
      });
      toast.success('Document voided');
      loadData();
    } catch (error) {
      console.error('Error voiding document:', error);
      toast.error('Failed to void document');
    }
  }

  async function resendDocument(requestId) {
    try {
      // TODO: Call resend API endpoint
      toast.success('Document resent');
    } catch (error) {
      toast.error('Failed to resend document');
    }
  }

  async function deleteTemplate(templateId) {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await deleteDoc(doc(db, 'documentTemplates', templateId));
      toast.success('Template deleted');
      loadData();
    } catch (error) {
      toast.error('Failed to delete template');
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  // Firebase not configured
  if (!db) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-medium text-yellow-800">Document Signing Not Configured</h3>
          <p className="text-sm text-yellow-700 mt-1">
            Please add Firebase configuration to enable document signing features.
            Go to Settings → Advanced → Secrets and add:
          </p>
          <ul className="text-sm text-yellow-700 mt-2 list-disc list-inside">
            <li>VITE_FIREBASE_API_KEY</li>
            <li>VITE_FIREBASE_AUTH_DOMAIN</li>
            <li>VITE_FIREBASE_PROJECT_ID</li>
            <li>VITE_FIREBASE_STORAGE_BUCKET</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Document Signing</h1>
          <p className="text-gray-500">Manage templates, send documents for signature, track status</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowBulkSendModal(true)}>
            <Users className="w-4 h-4 mr-2" />
            Bulk Send
          </Button>
          <Button onClick={() => navigate('/documents/templates/new')}>
            <Plus className="w-4 h-4 mr-2" />
            New Template
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-500">Total Documents</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-500">Pending</div>
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-500">Completed</div>
          <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-500">Expired</div>
          <div className="text-2xl font-bold text-orange-600">{stats.expired}</div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="documents" className="w-full">
        <TabsList>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Sends</TabsTrigger>
        </TabsList>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4 items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents..."
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(DOCUMENT_TYPES).map(([key, type]) => (
                  <SelectItem key={key} value={type}>{type.replace('_', ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Documents Table */}
          <div className="bg-white rounded-lg border">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Document</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Recipient</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Status</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Sent</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Expires</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        No documents found
                      </td>
                    </tr>
                  ) : (
                    filteredRequests.map(request => {
                      const status = STATUS_CONFIG[request.status] || STATUS_CONFIG[DOCUMENT_STATUS.DRAFT];
                      const StatusIcon = status.icon;
                      
                      return (
                        <tr key={request.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-gray-400" />
                              <div>
                                <div className="font-medium text-gray-900">{request.name}</div>
                                <div className="text-xs text-gray-500">{request.documentType}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <div className="font-medium text-gray-900">{request.contractorName || '-'}</div>
                              <div className="text-xs text-gray-500">
                                {request.signers?.map(s => s.email).join(', ') || '-'}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge 
                              variant="outline"
                              className={`bg-${status.color}-50 text-${status.color}-700 border-${status.color}-200`}
                            >
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {status.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {request.createdAt?.toDate?.()?.toLocaleDateString() || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {request.expiresAt?.toDate?.()?.toLocaleDateString() || '-'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setSelectedRequest(request)}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                {request.status === DOCUMENT_STATUS.SENT && (
                                  <DropdownMenuItem onClick={() => resendDocument(request.id)}>
                                    <RotateCcw className="w-4 h-4 mr-2" />
                                    Resend
                                  </DropdownMenuItem>
                                )}
                                {request.status !== DOCUMENT_STATUS.COMPLETED && request.status !== DOCUMENT_STATUS.VOIDED && (
                                  <DropdownMenuItem 
                                    onClick={() => voidDocument(request.id)}
                                    className="text-red-600"
                                  >
                                    <XCircle className="w-4 h-4 mr-2" />
                                    Void
                                  </DropdownMenuItem>
                                )}
                                {request.status === DOCUMENT_STATUS.COMPLETED && request.signedPdfUrl && (
                                  <DropdownMenuItem onClick={() => window.open(request.signedPdfUrl, '_blank')}>
                                    <Download className="w-4 h-4 mr-2" />
                                    Download Signed
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {templates.length === 0 ? (
              <div className="col-span-3 text-center py-12 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No templates yet. Create your first template to get started.</p>
                <Button className="mt-4" onClick={() => navigate('/documents/templates/new')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Template
                </Button>
              </div>
            ) : (
              templates.map(template => (
                <div 
                  key={template.id} 
                  className="bg-white rounded-lg border p-4 hover:border-blue-300 transition-colors cursor-pointer"
                  onClick={() => navigate(`/documents/templates/${template.id}`)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-600" />
                      <h3 className="font-medium">{template.name}</h3>
                    </div>
                    <Badge variant="outline">{template.documentType}</Badge>
                  </div>
                  <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                    {template.description || 'No description'}
                  </p>
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>{template.fields?.length || 0} fields</span>
                    <span>{template.signers?.length || 0} signers</span>
                    <span>Used {template.usageCount || 0}x</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        {/* Bulk Sends Tab */}
        <TabsContent value="bulk" className="space-y-4">
          <div className="bg-white rounded-lg border">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Bulk Send</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Template</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Recipients</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Progress</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Sent</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {bulkSends.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        No bulk sends yet
                      </td>
                    </tr>
                  ) : (
                    bulkSends.map(bulk => (
                      <tr key={bulk.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{bulk.id}</td>
                        <td className="px-4 py-3">{bulk.templateName}</td>
                        <td className="px-4 py-3">{bulk.totalRecipients}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-green-500"
                                style={{ width: `${(bulk.stats?.completed || 0) / bulk.totalRecipients * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500">
                              {bulk.stats?.completed || 0}/{bulk.totalRecipients}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {bulk.createdAt?.toDate?.()?.toLocaleDateString() || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Request Details Modal */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Document Details</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500">Document Name</label>
                  <p className="font-medium">{selectedRequest.name}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Status</label>
                  <p>
                    <Badge>
                      {STATUS_CONFIG[selectedRequest.status]?.label || selectedRequest.status}
                    </Badge>
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Sent</label>
                  <p>{selectedRequest.createdAt?.toDate?.()?.toLocaleString() || '-'}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Expires</label>
                  <p>{selectedRequest.expiresAt?.toDate?.()?.toLocaleDateString() || '-'}</p>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-500">Signers</label>
                <div className="mt-2 space-y-2">
                  {selectedRequest.signers?.map((signer, i) => (
                    <div key={signer.id} className="flex items-center justify-between bg-gray-50 rounded p-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs">
                          {i + 1}
                        </span>
                        <div>
                          <div className="font-medium">{signer.name}</div>
                          <div className="text-xs text-gray-500">{signer.email}</div>
                        </div>
                      </div>
                      <Badge variant="outline">
                        {STATUS_CONFIG[signer.status]?.label || signer.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
