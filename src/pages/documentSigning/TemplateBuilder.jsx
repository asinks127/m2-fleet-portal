import React, { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { createTemplate, getTemplate } from '@/lib/documentSigning/esignService.js';
import { Document, Page, pdfjs } from 'react-pdf';
import { 
  PenTool, Type, Calendar, CheckSquare, List, User, Mail, Building, 
  ChevronDown, Move, Trash2, Save, Plus, X, Eye, Download,
  Loader2, AlertCircle, FileText, Users, Settings, ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Switch } from '@/components/ui/switch.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { toast } from 'sonner';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

import { 
  FIELD_TYPES, 
  DOCUMENT_TYPES, 
  DOCUMENT_STATUS,
  createTemplateField,
  createSigner,
  DEFAULT_FIELD_CONFIG,
} from '@/lib/documentSigning/models.js';

const FIELD_ICONS = {
  [FIELD_TYPES.SIGNATURE]: PenTool,
  [FIELD_TYPES.INITIALS]: PenTool,
  [FIELD_TYPES.TEXT]: Type,
  [FIELD_TYPES.DATE]: Calendar,
  [FIELD_TYPES.CHECKBOX]: CheckSquare,
  [FIELD_TYPES.DROPDOWN]: List,
  [FIELD_TYPES.FULL_NAME]: User,
  [FIELD_TYPES.EMAIL]: Mail,
  [FIELD_TYPES.COMPANY]: Building,
  [FIELD_TYPES.TITLE]: Type,
  [FIELD_TYPES.PHONE]: Type,
  [FIELD_TYPES.CUSTOM]: Type,
};

const FIELD_COLORS = {
  [FIELD_TYPES.SIGNATURE]: '#3b82f6',
  [FIELD_TYPES.INITIALS]: '#8b5cf6',
  [FIELD_TYPES.TEXT]: '#10b981',
  [FIELD_TYPES.DATE]: '#f59e0b',
  [FIELD_TYPES.CHECKBOX]: '#ef4444',
  [FIELD_TYPES.DROPDOWN]: '#ec4899',
  [FIELD_TYPES.FULL_NAME]: '#06b6d4',
  [FIELD_TYPES.EMAIL]: '#84cc16',
  [FIELD_TYPES.COMPANY]: '#f97316',
};

export default function TemplateBuilder({ onSave, onCancel, editTemplateId = null }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Template state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [documentType, setDocumentType] = useState(DOCUMENT_TYPES.CUSTOM);
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfPageCount, setPdfPageCount] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Fields state
  const [fields, setFields] = useState([]);
  const [selectedField, setSelectedField] = useState(null);
  const [draggedFieldType, setDraggedFieldType] = useState(null);
  
  // Signers state
  const [signers, setSigners] = useState([]);
  const [newSignerName, setNewSignerName] = useState('');
  const [newSignerRole, setNewSignerRole] = useState('');
  
  // Settings
  const [settings, setSettings] = useState({
    signingOrder: 'sequential',
    expirationDays: 30,
    remindDays: 3,
    allowTypedSignature: true,
    allowDrawnSignature: true,
  });
  
  // UI state
  const [scale, setScale] = useState(1.0);
  const [showFieldPanel, setShowFieldPanel] = useState(true);
  const [errors, setErrors] = useState({});
  
  const pageRefs = useRef({});
  const fileInputRef = useRef(null);

  // Load current user
  useEffect(() => {
    async function loadUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setCurrentUser(user);
      } catch (error) {
        console.error('Error loading user:', error);
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, []);

  // Load template if editing
  useEffect(() => {
    if (editTemplateId) {
      loadTemplate(editTemplateId);
    }
  }, [editTemplateId]);

  async function loadTemplate(templateId) {
    try {
      setLoading(true);
      const tmpl = await getTemplate(templateId);
      if (tmpl) {
        setName(tmpl.name);
        setDescription(tmpl.description || '');
        setDocumentType(tmpl.documentType || DOCUMENT_TYPES.CUSTOM);
        setPdfUrl(tmpl.originalPdfUrl);
        setFields(tmpl.fields || []);
        setSigners(tmpl.signers || []);
        setSettings(tmpl.settings || settings);
      }
    } catch (error) {
      console.error('Error loading template:', error);
      toast.error('Failed to load template');
    } finally {
      setLoading(false);
    }
  }

  // Handle PDF upload
  async function handlePdfUpload(event) {
    const file = event.target.files?.[0];
    if (!file || file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file');
      return;
    }

    setPdfFile(file);
    
    // Create local URL for preview
    const url = URL.createObjectURL(file);
    setPdfUrl(url);
    
    // Get page count
    try {
      const pdf = await pdfjs.getDocument(url).promise;
      setPdfPageCount(pdf.numPages);
    } catch (error) {
      console.error('Error loading PDF:', error);
      toast.error('Failed to load PDF');
    }
  }

  // Handle field drag and drop
  function handleFieldDragStart(type) {
    setDraggedFieldType(type);
  }

  function handleFieldDragEnd() {
    setDraggedFieldType(null);
  }

  function handlePageDrop(event, pageNumber) {
    event.preventDefault();
    if (!draggedFieldType) return;

    const pageRef = pageRefs.current[pageNumber];
    if (!pageRef) return;

    const rect = pageRef.getBoundingClientRect();
    const x = (event.clientX - rect.left) / scale;
    const y = (event.clientY - rect.top) / scale;

    // Check if we have signers
    if (signers.length === 0) {
      toast.error('Please add at least one signer before placing fields');
      return;
    }

    const newField = createTemplateField(
      draggedFieldType,
      pageNumber,
      { x, y },
      signers[0].id // Assign to first signer by default
    );

    setFields([...fields, newField]);
    setSelectedField(newField);
    setDraggedFieldType(null);
  }

  function handlePageDragOver(event) {
    event.preventDefault();
  }

  // Field manipulation
  function updateField(fieldId, updates) {
    setFields(fields.map(f => 
      f.id === fieldId ? { ...f, ...updates } : f
    ));
  }

  function deleteField(fieldId) {
    setFields(fields.filter(f => f.id !== fieldId));
    if (selectedField?.id === fieldId) {
      setSelectedField(null);
    }
  }

  // Field drag to reposition
  function handleFieldMouseDown(field, event) {
    event.stopPropagation();
    setSelectedField(field);

    const startX = event.clientX;
    const startY = event.clientY;
    const startPosX = field.position.x;
    const startPosY = field.position.y;

    function handleMouseMove(e) {
      const deltaX = (e.clientX - startX) / scale;
      const deltaY = (e.clientY - startY) / scale;
      
      updateField(field.id, {
        position: {
          x: Math.max(0, startPosX + deltaX),
          y: Math.max(0, startPosY + deltaY),
        }
      });
    }

    function handleMouseUp() {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }

  // Signers
  function addSigner() {
    if (!newSignerName.trim()) {
      toast.error('Please enter a signer name');
      return;
    }

    const signer = createSigner({
      name: newSignerName,
      role: newSignerRole || 'Signer',
      order: signers.length,
    });

    setSigners([...signers, signer]);
    setNewSignerName('');
    setNewSignerRole('');
  }

  function removeSigner(signerId) {
    setSigners(signers.filter(s => s.id !== signerId));
    // Unassign fields from this signer
    setFields(fields.map(f => 
      f.signerId === signerId ? { ...f, signerId: null } : f
    ));
  }

  // Save template
  async function handleSave() {
    // Validation
    const newErrors = {};
    if (!name.trim()) newErrors.name = 'Template name is required';
    if (!pdfUrl) newErrors.pdf = 'Please upload a PDF';
    if (signers.length === 0) newErrors.signers = 'At least one signer is required';
    if (fields.length === 0) newErrors.fields = 'At least one field is required';

    // Check that all fields are assigned
    const unassignedFields = fields.filter(f => !f.signerId);
    if (unassignedFields.length > 0) {
      newErrors.fields = `${unassignedFields.length} fields are not assigned to a signer`;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSaving(true);
    setErrors({});

    try {
      const templateData = {
        name,
        description,
        documentType,
        originalPdfUrl: pdfUrl,
        pdfPageCount,
        fields,
        signers: signers.map(s => ({ ...s })),
        settings,
        createdBy: currentUser?.id,
        isActive: true,
      };

      let savedTemplate;

      if (editTemplateId) {
        savedTemplate = await createTemplate(templateData, pdfFile, editTemplateId);
      } else {
        savedTemplate = await createTemplate(templateData, pdfFile);
      }

      toast.success('Template saved successfully');
      onSave?.(savedTemplate);

    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Failed to save template: ' + error.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-lg font-semibold">
              {editTemplateId ? 'Edit Template' : 'New Template'}
            </h1>
            <p className="text-sm text-gray-500">Create a document signing template</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowFieldPanel(!showFieldPanel)}>
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Template
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar - Fields & Signers */}
        <div className="w-80 bg-white border-r overflow-y-auto">
          <Tabs defaultValue="fields" className="w-full">
            <TabsList className="w-full rounded-none">
              <TabsTrigger value="fields" className="flex-1">Fields</TabsTrigger>
              <TabsTrigger value="signers" className="flex-1">Signers</TabsTrigger>
              <TabsTrigger value="settings" className="flex-1">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="fields" className="p-4 space-y-4">
              <p className="text-sm text-gray-500">
                Drag fields onto the document pages
              </p>
              
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(FIELD_TYPES).map(([key, type]) => {
                  const Icon = FIELD_ICONS[type] || Type;
                  const color = FIELD_COLORS[type] || '#6b7280';
                  
                  return (
                    <div
                      key={key}
                      draggable
                      onDragStart={() => handleFieldDragStart(type)}
                      onDragEnd={handleFieldDragEnd}
                      className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg cursor-grab hover:bg-gray-100 border border-gray-200"
                      style={{ borderLeftColor: color, borderLeftWidth: 3 }}
                    >
                      <Icon className="w-4 h-4" style={{ color }} />
                      <span className="text-sm">{DEFAULT_FIELD_CONFIG[type]?.label || type}</span>
                    </div>
                  );
                })}
              </div>

              {fields.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-medium mb-2">Placed Fields ({fields.length})</h3>
                  <div className="space-y-2">
                    {fields.map(field => (
                      <div
                        key={field.id}
                        className={`flex items-center justify-between p-2 rounded-lg border ${
                          selectedField?.id === field.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                        }`}
                        onClick={() => setSelectedField(field)}
                      >
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: FIELD_COLORS[field.type] }}
                          />
                          <span className="text-sm">{field.label || field.type}</span>
                          <span className="text-xs text-gray-400">P{field.pageNumber}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteField(field.id);
                          }}
                        >
                          <Trash2 className="w-3 h-3 text-gray-400" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="signers" className="p-4 space-y-4">
              {errors.signers && (
                <Alert variant="destructive">
                  <AlertCircle className="w-4 h-4" />
                  <AlertDescription>{errors.signers}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label>Signer Name</Label>
                <Input
                  value={newSignerName}
                  onChange={(e) => setNewSignerName(e.target.value)}
                  placeholder="e.g., Contractor, PM, Admin"
                />
              </div>

              <div className="space-y-2">
                <Label>Role (Optional)</Label>
                <Input
                  value={newSignerRole}
                  onChange={(e) => setNewSignerRole(e.target.value)}
                  placeholder="e.g., Signer, Reviewer"
                />
              </div>

              <Button onClick={addSigner} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add Signer
              </Button>

              {signers.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h3 className="font-medium">Signers ({signers.length})</h3>
                  {signers.map((signer, index) => (
                    <div
                      key={signer.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{signer.name}</span>
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                            #{index + 1}
                          </span>
                        </div>
                        {signer.role && (
                          <span className="text-xs text-gray-500">{signer.role}</span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSigner(signer.id)}
                      >
                        <Trash2 className="w-4 h-4 text-gray-400" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="settings" className="p-4 space-y-4">
              <div className="space-y-2">
                <Label>Signing Order</Label>
                <Select
                  value={settings.signingOrder}
                  onValueChange={(v) => setSettings({ ...settings, signingOrder: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sequential">Sequential (one at a time)</SelectItem>
                    <SelectItem value="parallel">Parallel (all at once)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Document Expires After (Days)</Label>
                <Input
                  type="number"
                  value={settings.expirationDays}
                  onChange={(e) => setSettings({ ...settings, expirationDays: parseInt(e.target.value) || 30 })}
                />
              </div>

              <div className="space-y-2">
                <Label>Reminder Interval (Days)</Label>
                <Input
                  type="number"
                  value={settings.remindDays}
                  onChange={(e) => setSettings({ ...settings, remindDays: parseInt(e.target.value) || 3 })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Allow Typed Signatures</Label>
                <Switch
                  checked={settings.allowTypedSignature}
                  onCheckedChange={(v) => setSettings({ ...settings, allowTypedSignature: v })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Allow Drawn Signatures</Label>
                <Switch
                  checked={settings.allowDrawnSignature}
                  onCheckedChange={(v) => setSettings({ ...settings, allowDrawnSignature: v })}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Center - PDF Preview */}
        <div className="flex-1 overflow-y-auto bg-gray-200 p-8">
          {errors.pdf && (
            <Alert variant="destructive" className="mb-4 max-w-3xl mx-auto">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{errors.pdf}</AlertDescription>
            </Alert>
          )}

          {!pdfUrl ? (
            <div className="flex flex-col items-center justify-center min-h-[600px] bg-white rounded-lg border-2 border-dashed border-gray-300">
              <FileText className="w-16 h-16 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Upload a PDF Document</h3>
              <p className="text-sm text-gray-500 mb-4">Drag and drop or click to browse</p>
              <Button onClick={() => fileInputRef.current?.click()}>
                <Plus className="w-4 h-4 mr-2" />
                Upload PDF
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={handlePdfUpload}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Controls */}
              <div className="flex items-center justify-center gap-4 mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setScale(Math.max(0.5, scale - 0.1))}
                >
                  -
                </Button>
                <span className="text-sm">{Math.round(scale * 100)}%</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setScale(Math.min(2, scale + 0.1))}
                >
                  +
                </Button>
              </div>

              {/* PDF Pages */}
              {Array.from({ length: pdfPageCount }, (_, i) => i + 1).map(pageNum => (
                <div
                  key={pageNum}
                  className="relative bg-white shadow-lg mx-auto"
                  style={{ width: 612 * scale, height: 792 * scale }}
                  ref={(el) => pageRefs.current[pageNum] = el}
                  onDrop={(e) => handlePageDrop(e, pageNum)}
                  onDragOver={handlePageDragOver}
                >
                  <Document file={pdfUrl}>
                    <Page
                      pageNumber={pageNum}
                      scale={scale}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                    />
                  </Document>

                  {/* Render fields for this page */}
                  {fields
                    .filter(f => f.pageNumber === pageNum)
                    .map(field => (
                      <div
                        key={field.id}
                        className={`absolute cursor-move ${
                          selectedField?.id === field.id ? 'ring-2 ring-blue-500' : ''
                        }`}
                        style={{
                          left: field.position.x * scale,
                          top: field.position.y * scale,
                          width: field.width * scale,
                          height: field.height * scale,
                          backgroundColor: FIELD_COLORS[field.type] + '20',
                          borderColor: FIELD_COLORS[field.type],
                          borderWidth: 2,
                          borderStyle: 'solid',
                          borderRadius: 4,
                        }}
                        onMouseDown={(e) => handleFieldMouseDown(field, e)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedField(field);
                        }}
                      >
                        <div 
                          className="text-xs p-1 text-center truncate"
                          style={{ color: FIELD_COLORS[field.type] }}
                        >
                          {field.label}
                        </div>
                      </div>
                    ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right sidebar - Field Properties */}
        {selectedField && (
          <div className="w-80 bg-white border-l overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Field Properties</h3>
              <Button variant="ghost" size="sm" onClick={() => setSelectedField(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Label</Label>
                <Input
                  value={selectedField.label}
                  onChange={(e) => updateField(selectedField.id, { label: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Assign to Signer</Label>
                <Select
                  value={selectedField.signerId || ''}
                  onValueChange={(v) => updateField(selectedField.id, { signerId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select signer" />
                  </SelectTrigger>
                  <SelectContent>
                    {signers.map(signer => (
                      <SelectItem key={signer.id} value={signer.id}>
                        {signer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label>Required</Label>
                <Switch
                  checked={selectedField.required}
                  onCheckedChange={(v) => updateField(selectedField.id, { required: v })}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>Width</Label>
                  <Input
                    type="number"
                    value={selectedField.width}
                    onChange={(e) => updateField(selectedField.id, { width: parseInt(e.target.value) || 100 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Height</Label>
                  <Input
                    type="number"
                    value={selectedField.height}
                    onChange={(e) => updateField(selectedField.id, { height: parseInt(e.target.value) || 30 })}
                  />
                </div>
              </div>

              {selectedField.type === FIELD_TYPES.DROPDOWN && (
                <div className="space-y-2">
                  <Label>Options (one per line)</Label>
                  <Textarea
                    value={(selectedField.options || []).join('\n')}
                    onChange={(e) => updateField(selectedField.id, { 
                      options: e.target.value.split('\n').filter(Boolean) 
                    })}
                    placeholder="Option 1&#10;Option 2&#10;Option 3"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Prefilled Value (Optional)</Label>
                <Input
                  value={selectedField.prefilledValue || ''}
                  onChange={(e) => updateField(selectedField.id, { prefilledValue: e.target.value })}
                />
              </div>

              <Button 
                variant="destructive" 
                className="w-full"
                onClick={() => deleteField(selectedField.id)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Field
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
