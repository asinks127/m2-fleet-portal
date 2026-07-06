import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Plus, ArrowLeft, Save, GripVertical, Trash2, Settings, AlertTriangle, PlayCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import AuditTemplatePreview from '@/components/auditing/AuditTemplatePreview';

const MODULES = ['Recruiting', 'Project Management', 'Quality Control', 'Contractor Offboarding'];
const FREQUENCIES = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Annual', 'Event-Triggered'];
const RESPONSE_TYPES = [
  { value: 'pass_fail', label: 'Pass / Fail' },
  { value: 'yes_no', label: 'Yes / No' },
  { value: 'text', label: 'Text Input' },
  { value: 'number', label: 'Number Input' },
  { value: 'date', label: 'Date Selection' },
  { value: 'file_upload', label: 'File Upload' },
];

export default function AuditTemplateBuilder() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const templateId = urlParams.get('id');

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  
  // Template State
  const [template, setTemplate] = useState({
    name: '', module: 'Project Management', department: '', frequency: 'Weekly',
    active: false, defaultOwnerRole: '', requiresManualAssignment: false,
    escalationThreshold: 90, scoringMethod: 'Percentage', instructions: '', version: 1
  });

  // Items State
  const [items, setItems] = useState([]);
  
  // Fetch existing data
  useEffect(() => {
    async function load() {
      if (!templateId) return;
      
      const tData = await base44.entities.AuditTemplate.filter({ id: templateId });
      if (tData[0]) setTemplate(tData[0]);
      
      const iData = await base44.entities.AuditTemplateItem.filter({ templateId }, 'sortOrder');
      // Sort by sectionOrder then sortOrder
      iData.sort((a, b) => {
        if (a.sectionOrder !== b.sectionOrder) return (a.sectionOrder || 0) - (b.sectionOrder || 0);
        return (a.sortOrder || 0) - (b.sortOrder || 0);
      });
      setItems(iData);
    }
    load();
  }, [templateId]);

  // Derived sections state
  const sections = [...new Set(items.map(i => i.sectionName || 'General'))];

  const handleAddSection = () => {
    const name = prompt('Enter new section name:');
    if (!name) return;
    if (sections.includes(name)) return alert('Section already exists.');
    
    // Add a placeholder item for the section so it exists
    const newItem = {
      id: `temp_${Date.now()}`,
      sectionName: name,
      sectionOrder: sections.length,
      question: 'New Question',
      description: '',
      responseType: 'pass_fail',
      required: true,
      pointValue: 10,
      isCritical: false,
      sortOrder: 0,
      isNew: true
    };
    setItems(prev => [...prev, newItem]);
  };

  const handleAddItem = (sectionName) => {
    const sectionItems = items.filter(i => i.sectionName === sectionName);
    const sOrder = sectionItems.length > 0 ? sectionItems[0].sectionOrder : sections.length;
    
    const newItem = {
      id: `temp_${Date.now()}`,
      sectionName,
      sectionOrder: sOrder,
      question: 'New Question',
      description: '',
      responseType: 'pass_fail',
      required: true,
      pointValue: 10,
      isCritical: false,
      sortOrder: sectionItems.length,
      isNew: true
    };
    setItems(prev => [...prev, newItem]);
  };

  const handleUpdateItem = (id, field, value) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const handleDeleteItem = (id) => {
    if (window.confirm('Remove this question?')) {
      setItems(prev => prev.filter(i => i.id !== id));
    }
  };

  const handleDeleteSection = (sectionName) => {
    if (window.confirm(`Remove section "${sectionName}" and all its questions?`)) {
      setItems(prev => prev.filter(i => i.sectionName !== sectionName));
    }
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    
    const { source, destination, type } = result;
    
    // Reorder sections
    if (type === 'SECTION') {
      const newSections = Array.from(sections);
      const [removed] = newSections.splice(source.index, 1);
      newSections.splice(destination.index, 0, removed);
      
      // Update sectionOrder for all items
      const updatedItems = items.map(item => ({
        ...item,
        sectionOrder: newSections.indexOf(item.sectionName)
      }));
      setItems(updatedItems);
      return;
    }
    
    // Reorder items within a section
    if (type === 'ITEM') {
      const sourceSection = source.droppableId;
      const destSection = destination.droppableId;
      
      if (sourceSection === destSection) {
        // Move within same section
        const sectionItems = items.filter(i => i.sectionName === sourceSection).sort((a,b) => a.sortOrder - b.sortOrder);
        const [removed] = sectionItems.splice(source.index, 1);
        sectionItems.splice(destination.index, 0, removed);
        
        // Update sortOrder
        sectionItems.forEach((item, index) => {
          item.sortOrder = index;
        });
        
        setItems(prev => prev.map(i => i.sectionName === sourceSection ? sectionItems.find(si => si.id === i.id) : i));
      } else {
        // Move to different section (not fully supported by this simple UI, but handling just in case)
        const itemToMove = items.find(i => i.sectionName === sourceSection && i.sortOrder === source.index);
        if (itemToMove) {
          handleUpdateItem(itemToMove.id, 'sectionName', destSection);
        }
      }
    }
  };

  const handleSave = async () => {
    if (!template.name || !template.module || !template.frequency) {
      alert('Template Name, Module, and Frequency are required.');
      return;
    }
    
    setSaving(true);
    setSuccessMsg('');
    try {
      let tId = templateId;
      
      // Save Template
      if (tId) {
        // Increment version if updating
        await base44.entities.AuditTemplate.update(tId, {
          ...template,
          version: (template.version || 1) + 1
        });
        setTemplate(prev => ({...prev, version: (prev.version || 1) + 1}));
      } else {
        const newT = await base44.entities.AuditTemplate.create(template);
        tId = newT.id;
        // Update URL
        window.history.replaceState({}, '', `?id=${tId}`);
      }

      // Sync Items
      const existingItems = await base44.entities.AuditTemplateItem.filter({ templateId: tId });
      const currentItemIds = items.filter(i => !i.isNew).map(i => i.id);
      
      // Delete removed items
      const toDelete = existingItems.filter(i => !currentItemIds.includes(i.id));
      for (const i of toDelete) {
        await base44.entities.AuditTemplateItem.delete(i.id);
      }
      
      // Create/Update items
      for (const item of items) {
        const payload = {
          templateId: tId,
          sectionName: item.sectionName,
          sectionOrder: item.sectionOrder,
          question: item.question,
          description: item.description,
          responseType: item.responseType,
          required: item.required,
          pointValue: item.pointValue,
          isCritical: item.isCritical,
          sortOrder: item.sortOrder
        };
        
        if (item.isNew) {
          await base44.entities.AuditTemplateItem.create(payload);
        } else {
          await base44.entities.AuditTemplateItem.update(item.id, payload);
        }
      }
      
      // Reload items to get true IDs
      const reloadedItems = await base44.entities.AuditTemplateItem.filter({ templateId: tId }, 'sortOrder');
      setItems(reloadedItems);
      
      setSuccessMsg('Template saved successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
      queryClient.invalidateQueries(['auditTemplates']);
    } catch (e) {
      alert('Error saving template: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const totalPoints = items.reduce((sum, i) => sum + (Number(i.pointValue) || 0), 0);
  const isSetupComplete = template.name && items.length > 0;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('AuditTemplates'))}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{templateId ? 'Edit Template' : 'New Template'}</h1>
            {templateId && <p className="text-sm text-gray-500">Version {template.version}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          {successMsg && <span className="text-sm text-green-600 font-medium self-center mr-2">{successMsg}</span>}
          {templateId && (
            <Button variant="outline" className="border-blue-200 text-blue-600 hover:bg-blue-50" onClick={() => setPreviewOpen(true)}>
              <PlayCircle className="w-4 h-4 mr-2" />
              Preview Audit
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Template
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COL: Settings */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="w-5 h-5 text-gray-500" />
                Template Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-1.5">
                <Label>Template Name *</Label>
                <Input value={template.name} onChange={e => setTemplate({...template, name: e.target.value})} placeholder="e.g. Weekly PM Audit" />
              </div>
              <div className="space-y-1.5">
                <Label>Module *</Label>
                <Select value={template.module} onValueChange={v => setTemplate({...template, module: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MODULES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Frequency *</Label>
                <Select value={template.frequency} onValueChange={v => setTemplate({...template, frequency: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FREQUENCIES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Department</Label>
                <Input value={template.department} onChange={e => setTemplate({...template, department: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <Label>Default Owner Role</Label>
                <Input value={template.defaultOwnerRole} onChange={e => setTemplate({...template, defaultOwnerRole: e.target.value})} placeholder="e.g. Project Manager" />
              </div>
              
              <div className="pt-2 border-t space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="manualAssign" 
                    checked={template.requiresManualAssignment} 
                    onCheckedChange={c => setTemplate({...template, requiresManualAssignment: c})} 
                  />
                  <Label htmlFor="manualAssign" className="text-sm font-normal">Requires manual auditor assignment</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="activeToggle" 
                    checked={template.active} 
                    onCheckedChange={c => setTemplate({...template, active: c})} 
                    disabled={!isSetupComplete}
                  />
                  <Label htmlFor="activeToggle" className="text-sm font-normal">
                    Template is Active
                    {!isSetupComplete && <span className="text-xs text-red-500 block">Needs name & items</span>}
                  </Label>
                </div>
              </div>

              <div className="pt-2 border-t space-y-1.5">
                <Label>Instructions for Auditor</Label>
                <Textarea 
                  value={template.instructions} 
                  onChange={e => setTemplate({...template, instructions: e.target.value})}
                  className="min-h-[100px]"
                  placeholder="Provide general guidance..."
                />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-lg">Scoring Summary</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Possible Points</span>
                <span className="font-semibold">{totalPoints}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Pass Threshold</span>
                <span className="font-semibold text-green-600">90%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Needs Review</span>
                <span className="font-semibold text-yellow-600">75% - 89%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Fail Threshold</span>
                <span className="font-semibold text-red-600">&lt; 75%</span>
              </div>
              <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded">
                <AlertTriangle className="w-3 h-3 inline mr-1" />
                Any failed Critical item automatically fails the audit.
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COL: Checklist Builder */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border shadow-sm">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Checklist Sections</h2>
              <p className="text-sm text-gray-500">Drag and drop to reorder. Click to edit items.</p>
            </div>
            <Button onClick={handleAddSection}>
              <Plus className="w-4 h-4 mr-2" /> Add Section
            </Button>
          </div>

          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="board" type="SECTION">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-6">
                  {sections.map((sectionName, index) => {
                    const sectionItems = items.filter(i => i.sectionName === sectionName).sort((a,b) => a.sortOrder - b.sortOrder);
                    return (
                      <Draggable key={sectionName} draggableId={sectionName} index={index}>
                        {(provided) => (
                          <Card 
                            ref={provided.innerRef} 
                            {...provided.draggableProps}
                            className="border-2 border-gray-200 shadow-sm"
                          >
                            <CardHeader className="bg-gray-50 pb-3 border-b flex flex-row items-center justify-between group">
                              <div className="flex items-center gap-2">
                                <div {...provided.dragHandleProps} className="cursor-grab p-1 hover:bg-gray-200 rounded">
                                  <GripVertical className="w-5 h-5 text-gray-400" />
                                </div>
                                <Input 
                                  value={sectionName} 
                                  className="font-semibold text-lg border-transparent hover:border-gray-300 focus:border-blue-500 bg-transparent w-64"
                                  onChange={(e) => {
                                    const newName = e.target.value;
                                    setItems(prev => prev.map(i => i.sectionName === sectionName ? {...i, sectionName: newName} : i));
                                  }}
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <Button variant="ghost" size="sm" onClick={() => handleAddItem(sectionName)}>
                                  <Plus className="w-4 h-4 mr-1" /> Add Question
                                </Button>
                                <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDeleteSection(sectionName)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </CardHeader>
                            <Droppable droppableId={sectionName} type="ITEM">
                              {(provided) => (
                                <CardContent ref={provided.innerRef} {...provided.droppableProps} className="p-0 divide-y">
                                  {sectionItems.length === 0 ? (
                                    <div className="p-8 text-center text-gray-400 text-sm">No questions in this section yet.</div>
                                  ) : (
                                    sectionItems.map((item, idx) => (
                                      <Draggable key={item.id} draggableId={item.id} index={idx}>
                                        {(provided) => (
                                          <div 
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            className="p-4 bg-white hover:bg-gray-50 transition-colors flex gap-3 group"
                                          >
                                            <div {...provided.dragHandleProps} className="mt-2 cursor-grab opacity-50 group-hover:opacity-100">
                                              <GripVertical className="w-4 h-4 text-gray-400" />
                                            </div>
                                            <div className="flex-1 space-y-3">
                                              <div className="flex gap-3">
                                                <div className="flex-1 space-y-1.5">
                                                  <Label className="text-xs text-gray-500">Question Text</Label>
                                                  <Input value={item.question} onChange={e => handleUpdateItem(item.id, 'question', e.target.value)} />
                                                </div>
                                                <div className="w-40 space-y-1.5">
                                                  <Label className="text-xs text-gray-500">Response Type</Label>
                                                  <Select value={item.responseType} onValueChange={v => handleUpdateItem(item.id, 'responseType', v)}>
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>{RESPONSE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                                                  </Select>
                                                </div>
                                              </div>
                                              <div className="flex gap-3">
                                                <div className="flex-1 space-y-1.5">
                                                  <Label className="text-xs text-gray-500">Help Description (Optional)</Label>
                                                  <Input value={item.description} onChange={e => handleUpdateItem(item.id, 'description', e.target.value)} placeholder="Provide guidance for the auditor..." />
                                                </div>
                                                <div className="w-24 space-y-1.5">
                                                  <Label className="text-xs text-gray-500">Points</Label>
                                                  <Input type="number" value={item.pointValue} onChange={e => handleUpdateItem(item.id, 'pointValue', Number(e.target.value))} />
                                                </div>
                                              </div>
                                              <div className="flex items-center gap-6 pt-1">
                                                <div className="flex items-center space-x-2">
                                                  <Checkbox id={`req-${item.id}`} checked={item.required} onCheckedChange={c => handleUpdateItem(item.id, 'required', c)} />
                                                  <Label htmlFor={`req-${item.id}`} className="text-xs font-normal">Required</Label>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                  <Checkbox id={`crit-${item.id}`} checked={item.isCritical} onCheckedChange={c => handleUpdateItem(item.id, 'isCritical', c)} />
                                                  <Label htmlFor={`crit-${item.id}`} className="text-xs font-normal text-red-600 flex items-center gap-1">
                                                    <AlertTriangle className="w-3 h-3" /> Critical Item
                                                  </Label>
                                                </div>
                                              </div>
                                            </div>
                                            <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDeleteItem(item.id)}>
                                              <Trash2 className="w-4 h-4" />
                                            </Button>
                                          </div>
                                        )}
                                      </Draggable>
                                    ))
                                  )}
                                  {provided.placeholder}
                                </CardContent>
                              )}
                            </Droppable>
                          </Card>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
          
          {sections.length === 0 && (
            <div className="text-center py-12 bg-gray-50 border-2 border-dashed rounded-xl">
              <p className="text-gray-500 mb-4">Start by adding a section for your checklist questions.</p>
              <Button onClick={handleAddSection}>Add First Section</Button>
            </div>
          )}
        </div>
      </div>
      <AuditTemplatePreview 
        open={previewOpen} 
        onClose={() => setPreviewOpen(false)} 
        template={template} 
        items={items} 
      />
    </div>
  );
}