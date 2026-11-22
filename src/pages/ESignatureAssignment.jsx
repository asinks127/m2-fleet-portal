import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FIELD_TYPES } from '@/lib/documentSigning/models.js';
import { supabase } from '@/lib/supabaseClient.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog.jsx';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select.jsx';
import { Document, Page, pdfjs } from 'react-pdf';
import { format } from 'date-fns';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Loader2, Send, FileText, CheckCircle, Clock, XCircle, Eye, Search, Upload, Plus, Trash2, Highlighter, PenTool, Hash, DollarSign, Calendar, CheckSquare, Type, ExternalLink } from 'lucide-react';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

export default function ESignatureAssignment() {
  const [contractors, setContractors] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [signatureRequests, setSignatureRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Assignment dialog
  const [assignDialog, setAssignDialog] = useState({ open: false, contractor: null });
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [availableTemplateId, setAvailableTemplateId] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);

  // Detail dialog
  const [detailDialog, setDetailDialog] = useState({ open: false, contractor: null });

  // Template builder state - FIXED destructured useState
  const [templateBuilderOpen, setTemplateBuilderOpen] = useState(false);
  const [templatePdfFile, setTemplatePdfFile] = useState(null);
  const [templatePdfUrl, setTemplatePdfUrl] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [signatureFields, setSignatureFields] = useState([]);
  const [templateIsSaving, setTemplateIsSaving] = useState(false);
  const [templatePdfPages, setTemplatePdfPages] = useState(0);
  const [templateScale, setTemplateScale] = useState(1.0);
  const [selectedFieldType, setSelectedFieldType] = useState(FIELD_TYPES.SIGNATURE);
  const typeLabels = {
    signature: 'Signature',
    initials: 'Initials',
    text: 'Text',
    date: 'Date',
    checkbox: 'Checkbox',
    dropdown: 'Dropdown',
    full_name: 'Full Name',
    email: 'Email',
    company: 'Company',
    title: 'Title',
    phone: 'Phone',
    ein: 'EIN',
    number: 'Number',
    amount: 'Amount',
    custom: 'Custom',
  };


  const loadData = async () => {
    setIsLoading(true);
    try {
      const [usersResp, templatesResp, requestsResp] = await Promise.all([
        fetch('/api/user?action=list'),
        fetch('/api/signableDocument', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'list' }) }),
        fetch('/api/signatureRequest?action=list'),
      ]);

      const users = (await usersResp.json()).data || [];
      const templatesData = (await templatesResp.json()).data || [];
      const requests = (await requestsResp.json()).data || [];

      const activeContractors = users.filter(u =>
        u.email && u.active !== false &&
        (u.email.includes('.contractor@') || u.email.toLowerCase() === 'tjserota@gmail.com')
      );

      setContractors(activeContractors);
      setTemplates(templatesData);
      setSignatureRequests(requests);
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setIsLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const getContractorRequests = (contractor) => {
    return signatureRequests.filter(r =>
      r.technicianemail === contractor.email ||
      r.technicianid === contractor.id
    );
  };

  const getStatusBadge = (requests) => {
    if (requests.length === 0) return <Badge variant="outline" className="bg-gray-100">Not Assigned</Badge>;

    const allSigned = requests.every(r => r.status === 'Signed' || r.status === 'Completed');
    const anySigned = requests.some(r => r.status === 'Signed' || r.status === 'Completed');
    const sent = requests.filter(r => r.status === 'Sent' || r.status === 'Viewed');

    if (allSigned) return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle className="w-3 h-3 mr-1" /> All Signed</Badge>;
    if (sent.length > 0) return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200"><Clock className="w-3 h-3 mr-1" /> {sent.length} Pending</Badge>;
    if (anySigned) return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Partially Signed</Badge>;
    return <Badge variant="outline">Assigned</Badge>;
  };


  const handlePdfUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setTemplatePdfFile(file);
    const url = URL.createObjectURL(file);
    setTemplatePdfUrl(url);
    setSignatureFields([]);
  };

  const handlePdfLoadSuccess = ({ numPages }) => {
    setTemplatePdfPages(numPages);
  };

  const handlePdfClick = (e, pageNum) => {
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const ft = selectedFieldType;
    const typeLabels = {
      signature: 'Signature',
      initials: 'Initials',
      text: 'Text',
      date: 'Date',
      checkbox: 'Checkbox',
      dropdown: 'Dropdown',
      full_name: 'Full Name',
      email: 'Email',
      company: 'Company',
      title: 'Title',
      phone: 'Phone',
      ein: 'EIN',
      number: 'Number',
      amount: 'Amount',
      custom: 'Custom',
    };
    const newField = {
      id: Date.now(),
      page: pageNum,
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100,
      width: ft === FIELD_TYPES.SIGNATURE ? 15 : ft === FIELD_TYPES.CHECKBOX ? 3 : ft === FIELD_TYPES.INITIALS ? 10 : 14,
      height: ft === FIELD_TYPES.SIGNATURE ? 5 : ft === FIELD_TYPES.CHECKBOX ? 2.5 : ft === FIELD_TYPES.INITIALS ? 4 : 3.5,
      type: ft,
      label: typeLabels[ft] || 'Field ' + (signatureFields.length + 1),
    };
    setSignatureFields(prev => [...prev, newField]);
  };

  const removeField = (id) => {
    setSignatureFields(prev => prev.filter(f => f.id !== id));
  };

  const openTemplateBuilder = () => {
    setTemplateBuilderOpen(true);
    setTemplatePdfFile(null);
    setTemplatePdfUrl("");
    setTemplateName("");
    setTemplateDescription("");
    setSignatureFields([]);
  };

  const handleSaveTemplate = async () => {
    if (!templatePdfFile) { alert("No PDF file selected. Please upload a document first."); return; }
    if (!templateName.trim()) { alert("Please enter a template name."); return; }
    setTemplateIsSaving(true);
    try {
      const { createTemplate } = await import('@/lib/documentSigning/esignService.js');
      const fields = signatureFields.map(sf => ({
        type: sf.type || 'signature',
        page: sf.page,
        x: sf.x,
        y: sf.y,
        width: sf.width || (sf.type === 'signature' || sf.type === 'initials' ? 15 : sf.type === "checkbox" ? 3 : 14),
        height: sf.height || (sf.type === 'signature' || sf.type === 'initials' ? 5 : sf.type === "checkbox" ? 2.5 : 3.5),
        label: sf.label || 'Sign Here',
        required: sf.type === 'signature' || sf.type === 'initials'
      }));

      const template = await createTemplate({
        name: templateName.trim(),
        description: templateDescription.trim(),
        pageCount: templatePdfPages,
        fields
      }, templatePdfFile);

      // Create a SignableDocument entry so it shows in the assignment dropdown
      const supabaseUrl = 'https://rrvvklsknrjzzfdhrrfo.supabase.co';
      const fileUrl = `${supabaseUrl}/storage/v1/object/public/esign-documents/${template.pdf_storage_path}`;
      
      // Pack extra data into content column as JSON (only columns that exist in SignableDocument table)
      const contentData = JSON.stringify({
        description: templateDescription.trim(),
        signatureFields: fields,
        pageCount: templatePdfPages
      });

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const resp = await fetch('/api/signableDocument', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'create',
          title: templateName.trim(),
          content: contentData,
          fileUrl: fileUrl,
          documenttype: 'pdf',
          status: 'active'
        })
      });

      const result = await resp.json();
      if (!resp.ok) {
        throw new Error(result.error || 'Failed to create assignable document');
      }

      setTemplateBuilderOpen(false);
      setTemplateName('');
      setTemplateDescription('');
      setTemplatePdfFile(null);
      setTemplatePdfUrl('');
      setSignatureFields([]);
      loadData();
    } catch (err) {
      console.error(err);
      alert("Failed to save template: " + err.message);
    } finally {
      setTemplateIsSaving(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedTemplate || !assignDialog.contractor) return;
    setIsSending(true);
    setSendResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const resp = await fetch('/api/sendSignatureRequest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          documentId: selectedTemplate,
          recipients: [{
            name: assignDialog.contractor.fullName || assignDialog.contractor.display_name || assignDialog.contractor.email,
            email: assignDialog.contractor.email,
            technicianId: assignDialog.contractor.id,
            technicianName: assignDialog.contractor.fullName || assignDialog.contractor.display_name,
          }],
        }),
      });
      const result = await resp.json();

      if (result.success) {
        setSendResult({ success: true, message: 'Template assigned and email sent!' });
        setTimeout(() => {
          setAssignDialog({ open: false, contractor: null });
          setSelectedTemplate('');
          setSendResult(null);
          loadData();
        }, 1500);
      } else {
        setSendResult({ success: false, message: result.error || 'Failed to assign' });
      }
    } catch (error) {
      setSendResult({ success: false, message: error.message });
    }
    setIsSending(false);
  };

  const filteredContractors = contractors.filter(c => {
    const name = (c.fullName || c.display_name || c.email || '').toLowerCase();
    const matchesSearch = name.includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase());
    const matchesProject = projectFilter === 'all' || c.project === projectFilter;
    const requests = getContractorRequests(c);
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'signed' && requests.length > 0 && requests.every(r => r.status === 'Signed' || r.status === 'Completed')) ||
      (statusFilter === 'pending' && requests.some(r => r.status === 'Sent' || r.status === 'Viewed')) ||
      (statusFilter === 'none' && requests.length === 0);
    return matchesSearch && matchesProject && matchesStatus;
  });

  const projects = [...new Set(contractors.map(c => c.project).filter(Boolean))];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">E-Signature Assignment</h1>
          <p className="text-gray-500 mt-1">Assign signature templates to contractors and track their status</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData}>
            <Loader2 className="w-4 h-4 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute mt-3 ml-3 text-gray-400" />
              <Input
                placeholder="Search contractors..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="signed">Signed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="none">Not Assigned</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold">{contractors.length}</div>
            <div className="text-sm text-gray-500">Total Contractors</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-green-600">
              {signatureRequests.filter(r => r.status === 'Signed' || r.status === 'Completed').length}
            </div>
            <div className="text-sm text-gray-500">Signed Documents</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-yellow-600">
              {signatureRequests.filter(r => r.status === 'Sent' || r.status === 'Viewed').length}
            </div>
            <div className="text-sm text-gray-500">Pending Signatures</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-blue-600">{templates.length}</div>
            <div className="text-sm text-gray-500">Available Templates</div>
          </CardContent>
        </Card>
      </div>

      {/* Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Templates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-1">
              <div className="text-sm text-gray-500">Available templates ({templates.length})</div>
              <Select value={availableTemplateId} onValueChange={setAvailableTemplateId}>
                <SelectTrigger className="w-full md:w-[360px]">
                  <SelectValue placeholder="View all available templates" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.title || t.name || t.fileName || 'Untitled template'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableTemplateId && (() => {
                const template = templates.find(t => t.id === availableTemplateId);
                return template ? (
                  <div className="text-xs text-gray-500">
                    {template.documenttype || template.type || 'PDF'}
                    {template.page_count ? ` · ${template.page_count} page${template.page_count === 1 ? '' : 's'}` : ''}
                  </div>
                ) : null;
              })()}
            </div>
            <Button variant="outline" size="sm" onClick={openTemplateBuilder}><Plus className="w-4 h-4 mr-1" /> Create Template</Button>
          </div>
        </CardContent>
      </Card>

      {/* Contractor Table */}
      <Card>
        <CardHeader>
          <CardTitle>Contractors ({filteredContractors.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm text-gray-500">
                  <th className="pb-3 pr-4">Contractor</th>
                  <th className="pb-3 pr-4">Email</th>
                  <th className="pb-3 pr-4">Project</th>
                  <th className="pb-3 pr-4">Documents</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredContractors.map(contractor => {
                  const requests = getContractorRequests(contractor);
                  return (
                    <tr key={contractor.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 pr-4">
                        <div className="font-medium">{contractor.fullName || contractor.display_name || 'Unknown'}</div>
                      </td>
                      <td className="py-3 pr-4 text-sm text-gray-600">{contractor.email}</td>
                      <td className="py-3 pr-4 text-sm">{contractor.project || '—'}</td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-1">
                          <FileText className="w-4 h-4 text-gray-400" />
                          <span className="text-sm">{requests.length}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4">{getStatusBadge(requests)}</td>
                      <td className="py-3 text-right">
                        <div className="flex gap-2 justify-end">
                          {requests.length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDetailDialog({ open: true, contractor })}
                            >
                              <Eye className="w-4 h-4 mr-1" /> Details
                            </Button>
                          )}
                          <Button
                            size="sm"
                            onClick={() => {
                              setAssignDialog({ open: true, contractor });
                              setSelectedTemplate('');
                              setSendResult(null);
                            }}
                          >
                            <Send className="w-4 h-4 mr-1" /> Assign
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredContractors.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-400">No contractors found matching filters</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Assign Dialog */}
      <Dialog open={assignDialog.open} onOpenChange={(v) => { if (!v) { setAssignDialog({ open: false, contractor: null }); setSendResult(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Template</DialogTitle>
            <DialogDescription>
              Send a document to{' '}
              <strong>{assignDialog.contractor?.fullName || assignDialog.contractor?.display_name || assignDialog.contractor?.email}</strong>
            </DialogDescription>
          </DialogHeader>

          {sendResult && (
            <div className={`p-3 rounded-md text-sm ${sendResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              {sendResult.message}
            </div>
          )}

          {!sendResult?.success && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Template</label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.title || t.fileName || 'Untitled'} ({t.documenttype || 'text'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => { setAssignDialog({ open: false, contractor: null }); setSendResult(null); }}>
                  Cancel
                </Button>
                <Button onClick={handleAssign} disabled={!selectedTemplate || isSending}>
                  {isSending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
                  Send for Signature
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailDialog.open} onOpenChange={(v) => { if (!v) setDetailDialog({ open: false, contractor: null }); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Documents for {detailDialog.contractor?.fullName || detailDialog.contractor?.display_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {getContractorRequests(detailDialog.contractor || {}).map(req => (
              <div key={req.id}
                className="border rounded-lg p-3 flex items-center justify-between cursor-pointer hover:bg-blue-50 transition-colors"
                onClick={() => window.open(`/sign/${req.id}/${req.signaturetoken}`, '_blank')}
                title="Click to view document">
                <div>
                  <div className="font-medium text-sm">{req.documenttitle}</div>
                  <div className="text-xs text-gray-500">
                    {req.created_date ? format(new Date(req.created_date), 'MMM d, yyyy h:mm a') : '—'}
                  </div>
                </div>
                <Badge className={
                  req.status === 'Signed' || req.status === 'Completed' ? 'bg-green-100 text-green-800' :
                  req.status === 'Viewed' ? 'bg-blue-100 text-blue-800' :
                  req.status === 'Sent' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }>
                  {req.status === 'Signed' && <CheckCircle className="w-3 h-3 mr-1" />}
                  {req.status === 'Sent' && <Clock className="w-3 h-3 mr-1" />}
                  {req.status}
                </Badge>
              </div>
            ))}
            {getContractorRequests(detailDialog.contractor || {}).length === 0 && (
              <div className="text-center text-gray-400 py-4">No documents assigned</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Template Builder Modal */}
      <Dialog open={templateBuilderOpen} onOpenChange={setTemplateBuilderOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Signature Template</DialogTitle>
            <DialogDescription>
              Upload a PDF, then click on the document to highlight signature areas in yellow.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="tpl-name">Template Name *</Label>
                <Input id="tpl-name" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="e.g. W-9 Form" />
              </div>
              <div>
                <Label htmlFor="tpl-desc">Description (optional)</Label>
                <Input id="tpl-desc" value={templateDescription} onChange={(e) => setTemplateDescription(e.target.value)} placeholder="Brief description" />
              </div>
            </div>

            {!templatePdfUrl ? (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-400 transition-colors">
                <Upload className="w-10 h-10 mx-auto text-gray-400 mb-3" />
                <p className="text-gray-600 mb-2">Upload a PDF template</p>
                <p className="text-xs text-gray-400 mb-4">PDF files only, max 10MB</p>
                <Input
                  type="file"
                  accept=".pdf"
                  onChange={handlePdfUpload}
                  className="max-w-xs mx-auto"
                />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between bg-blue-50 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-medium">{templatePdfFile?.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Button variant="outline" size="sm" onClick={() => setTemplateScale(s => Math.max(0.5, s - 0.1))}>−</Button>
                      <span className="w-12 text-center">{Math.round(templateScale * 100)}%</span>
                      <Button variant="outline" size="sm" onClick={() => setTemplateScale(s => Math.min(2.0, s + 0.1))}>+</Button>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { setTemplatePdfFile(null); setTemplatePdfUrl(''); setSignatureFields([]); setTemplatePdfPages(0); }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm text-gray-600 font-medium">Select field type, then click on the document:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { type: FIELD_TYPES.SIGNATURE, label: 'Signature', icon: '✍️', color: '#3b82f6' },
                      { type: FIELD_TYPES.INITIALS, label: 'Initials', icon: 'I', color: '#8b5cf6' },
                      { type: FIELD_TYPES.TEXT, label: 'Text', icon: 'T', color: '#10b981' },
                      { type: FIELD_TYPES.DATE, label: 'Date', icon: '📅', color: '#f59e0b' },
                      { type: FIELD_TYPES.CHECKBOX, label: 'Checkbox', icon: '☑️', color: '#ef4444' },
                      { type: FIELD_TYPES.DROPDOWN, label: 'Dropdown', icon: '▼', color: '#ec4899' },
                      { type: FIELD_TYPES.FULL_NAME, label: 'Name', icon: '👤', color: '#06b6d4' },
                      { type: FIELD_TYPES.EMAIL, label: 'Email', icon: '✉️', color: '#84cc16' },
                      { type: FIELD_TYPES.COMPANY, label: 'Company', icon: '🏢', color: '#f97316' },
                      { type: FIELD_TYPES.EIN, label: 'EIN', icon: '#', color: '#6366f1' },
                      { type: FIELD_TYPES.NUMBER, label: 'Number', icon: '#', color: '#14b8a6' },
                      { type: FIELD_TYPES.AMOUNT, label: 'Amount', icon: '$', color: '#f43f5e' },
                    ].map(ft => (
                      <button
                        key={ft.type}
                        type="button"
                        onClick={() => setSelectedFieldType(ft.type)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          selectedFieldType === ft.type
                            ? 'border-current shadow-sm'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        style={selectedFieldType === ft.type ? { borderColor: ft.color, backgroundColor: ft.color + '18', color: ft.color } : {}}
                      >
                        <span className="mr-1">{ft.icon}</span>{ft.label}
                      </button>
                    ))}
                  </div>
                  <div className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2 flex items-center gap-2">
                    <Highlighter className="w-3 h-3" />
                    Click on the document to place "{typeLabels[selectedFieldType] || 'Signature'}" field ({signatureFields.length} fields placed)
                  </div>
                </div>



                <div className="border rounded-lg overflow-auto bg-gray-100 flex justify-center" style={{ maxHeight: '60vh' }}>
                  <div style={{ transform: `scale(${templateScale})`, transformOrigin: 'top center' }}>
                    <Document key={`doc-${templatePdfPages}`} file={templatePdfUrl} onLoadSuccess={handlePdfLoadSuccess}>
                      {Array.from({ length: templatePdfPages }, (_, i) => i + 1).map(pageNum => (
                        <div key={pageNum} className="relative mb-4 shadow-lg">
                          <div className="absolute top-2 left-2 bg-gray-800 text-white text-xs px-2 py-0.5 rounded z-10">
                            Page {pageNum}
                          </div>
                          <div
                            onClick={(e) => handlePdfClick(e, pageNum)}
                            className="cursor-crosshair relative inline-block"
                          >
                            <Page pageNumber={pageNum} width={700} className="pointer-events-none" />
                            {signatureFields.filter(f => f.page === pageNum).map(field => {
                                const ftColors = {
                                  signature: { border: '#3b82f6', bg: '#bfdbfe', text: '#1e40af' },
                                  initials: { border: '#8b5cf6', bg: '#ddd6fe', text: '#5b21b6' },
                                  text: { border: '#10b981', bg: '#a7f3d0', text: '#065f46' },
                                  date: { border: '#f59e0b', bg: '#fde68a', text: '#92400e' },
                                  checkbox: { border: '#ef4444', bg: '#fecaca', text: '#991b1b' },
                                  dropdown: { border: '#ec4899', bg: '#fbcfe8', text: '#9d174d' },
                                  full_name: { border: '#06b6d4', bg: '#a5f3fc', text: '#155e75' },
                                  email: { border: '#84cc16', bg: '#d9f99d', text: '#3f6212' },
                                  company: { border: '#f97316', bg: '#fed7aa', text: '#9a3412' },
                                  title: { border: '#6b7280', bg: '#e5e7eb', text: '#374151' },
                                  phone: { border: '#8b5cf6', bg: '#e9d5ff', text: '#6b21a8' },
                                  ein: { border: '#6366f1', bg: '#c7d2fe', text: '#3730a3' },
                                  number: { border: '#14b8a6', bg: '#99f6e4', text: '#115e59' },
                                  amount: { border: '#f43f5e', bg: '#fecdd3', text: '#9f1239' },
                                  custom: { border: '#9ca3af', bg: '#f3f4f6', text: '#4b5563' },
                                };
                                const c = ftColors[field.type] || ftColors.signature;
                                const dispWPx = field.type === 'checkbox' ? 24 : Math.max((field.width || 18) * 7, 80);
                                const dispHPx = field.type === 'checkbox' ? 24 : Math.max((field.height || 3.5) * 7, 26);
                                const dispW = dispWPx + 'px';
                                const dispH = dispHPx + 'px';
                                return (
                                  <div
                                    key={field.id}
                                    className="absolute rounded cursor-pointer group z-10"
                                    style={{
                                      left: `${field.x}%`,
                                      top: `${field.y}%`,
                                      width: dispW,
                                      height: dispH,
                                      border: '2px solid ' + c.border,
                                      backgroundColor: c.bg + '99',
                                    }}
                                    onClick={(e) => { e.stopPropagation(); }}
                                  >
                                    <div className="flex items-center justify-center h-full">
                                      <span
                                        className="text-xs font-bold px-1.5 py-0.5 rounded whitespace-nowrap"
                                        style={{ backgroundColor: c.bg, color: c.text }}
                                      >
                                        {field.type === 'checkbox' ? '☑' : field.label}
                                      </span>
                                    </div>
                                    <button
                                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                      onClick={() => removeField(field.id)}
                                    >
                                      ×
                                    </button>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      ))}
                    </Document>
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateBuilderOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSaveTemplate}
              disabled={!templateName || !templatePdfUrl || templateIsSaving}
            >
              {templateIsSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : <>Save Template</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
