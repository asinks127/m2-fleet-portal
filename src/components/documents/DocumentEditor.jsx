import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Trash2, Type, PenTool, Calendar, CheckSquare, FileSignature, FileText, PlusCircle, ExternalLink } from 'lucide-react';

export default function DocumentEditor({ document, onSave }) {
  const [signatureFields, setSignatureFields] = useState(document?.signatureFields || []);
  const [selectedFieldType, setSelectedFieldType] = useState('signature');
  const [selectedField, setSelectedField] = useState(null);
  const documentRef = useRef(null);

  // Determine if the document is a PDF based on documentType property
  const isPdf = document?.documentType === 'pdf';

  const fieldTypes = [
    { value: 'signature', label: 'Signature', icon: FileSignature, color: 'bg-blue-100 border-blue-300' },
    { value: 'initial', label: 'Initial', icon: PenTool, color: 'bg-green-100 border-green-300' },
    { value: 'text', label: 'Text Field', icon: Type, color: 'bg-purple-100 border-purple-300' },
    { value: 'date', label: 'Date', icon: Calendar, color: 'bg-orange-100 border-orange-300' },
    { value: 'checkbox', label: 'Checkbox', icon: CheckSquare, color: 'bg-gray-100 border-gray-300' }
  ];
  
  // Function to add fields for PDF documents (without visual placement)
  const addPdfField = (type) => {
    const newField = {
      id: Date.now().toString(),
      type: type,
      label: `${type.charAt(0).toUpperCase() + type.slice(1)} Field`,
      required: true,
      placeholder: getDefaultPlaceholder(type),
      // For PDFs, x, y, width, height are not set during editing as there's no visual placement
    };
    setSignatureFields([...signatureFields, newField]);
  };

  const handleDocumentClick = (e) => {
    // Only allow document clicks for field placement if it's not a PDF
    if (!documentRef.current || isPdf) return;
    
    const rect = documentRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const newField = {
      id: Date.now().toString(),
      type: selectedFieldType,
      label: `${selectedFieldType.charAt(0).toUpperCase() + selectedFieldType.slice(1)} Field`,
      x: x,
      y: y,
      width: selectedFieldType === 'signature' ? 25 : selectedFieldType === 'checkbox' ? 5 : 15,
      height: selectedFieldType === 'signature' ? 8 : 6,
      page: 1,
      required: true,
      placeholder: getDefaultPlaceholder(selectedFieldType)
    };

    setSignatureFields([...signatureFields, newField]);
  };

  const getDefaultPlaceholder = (type) => {
    switch (type) {
      case 'signature': return 'Sign here';
      case 'initial': return 'Initial here';
      case 'text': return 'Enter text';
      case 'date': return 'MM/DD/YYYY';
      case 'checkbox': return '';
      default: return '';
    }
  };

  const handleFieldUpdate = (fieldId, updates) => {
    setSignatureFields(fields =>
      fields.map(field =>
        field.id === fieldId ? { ...field, ...updates } : field
      )
    );
  };

  const handleFieldDelete = (fieldId) => {
    setSignatureFields(fields => fields.filter(field => field.id !== fieldId));
    setSelectedField(null);
  };

  const handleSave = () => {
    onSave({
      ...document,
      signatureFields: signatureFields
    });
  };

  return (
    <div className="flex h-full">
      {/* Toolbar */}
      <div className="w-80 bg-gray-50 p-4 border-r overflow-y-auto">
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Add Fields</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isPdf ? (
                <>
                  <p className="text-xs text-gray-600 mb-3">
                    Add fields that will appear on the final signature page. Visual placement is only available for text documents.
                  </p>
                   <div className="grid grid-cols-1 gap-2">
                    {fieldTypes.map(type => {
                      const Icon = type.icon; // Using Icon for consistency, even if not displayed on button
                      return (
                        <Button
                          key={type.value}
                          variant="outline"
                          className="justify-start h-10"
                          onClick={() => addPdfField(type.value)}
                        >
                          <PlusCircle className="w-4 h-4 mr-2" />
                          Add {type.label}
                        </Button>
                      );
                    })}
                  </div>
                </>
            ) : (
                <>
                  <p className="text-xs text-gray-600 mb-3">
                    Select a field type, then click on the document to place it.
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    {fieldTypes.map(type => {
                      const Icon = type.icon;
                      return (
                        <Button
                          key={type.value}
                          variant={selectedFieldType === type.value ? "default" : "outline"}
                          className="justify-start h-10"
                          onClick={() => setSelectedFieldType(type.value)}
                        >
                          <Icon className="w-4 h-4 mr-2" />
                          {type.label}
                        </Button>
                      );
                    })}
                  </div>
                </>
            )}
          </CardContent>
        </Card>

        {/* Field List */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Placed Fields ({signatureFields.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {signatureFields.map(field => {
                const fieldType = fieldTypes.find(t => t.value === field.type);
                const Icon = fieldType?.icon || Type;
                return (
                  <div
                    key={field.id}
                    className={`p-2 border rounded cursor-pointer transition-colors ${
                      selectedField?.id === field.id ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedField(field)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="w-3 h-3" />
                        <span className="text-xs font-medium">{field.label}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFieldDelete(field.id);
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
              {signatureFields.length === 0 && (
                <p className="text-xs text-gray-500 text-center py-4">
                  {isPdf ? 'No fields added yet.' : 'Click on the document to add fields.'}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Field Properties */}
        {selectedField && (
          <Card className="mt-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Field Properties</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Label</Label>
                <Input
                  value={selectedField.label}
                  onChange={(e) => handleFieldUpdate(selectedField.id, { label: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Placeholder</Label>
                <Input
                  value={selectedField.placeholder}
                  onChange={(e) => handleFieldUpdate(selectedField.id, { placeholder: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
              {!isPdf && ( // Only show width/height for non-PDF documents
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Width (%)</Label>
                    <Input
                      type="number"
                      value={selectedField.width}
                      onChange={(e) => handleFieldUpdate(selectedField.id, { width: parseFloat(e.target.value) })}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Height (%)</Label>
                    <Input
                      type="number"
                      value={selectedField.height}
                      onChange={(e) => handleFieldUpdate(selectedField.id, { height: parseFloat(e.target.value) })}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="mt-6 pt-4 border-t">
          <Button onClick={handleSave} className="w-full">
            Save Template
          </Button>
        </div>
      </div>

      {/* Document Preview */}
      <div className="flex-1 p-4 overflow-auto bg-gray-100">
        <div className="max-w-4xl mx-auto">
          <div
            ref={documentRef}
            className={`relative bg-white shadow-lg min-h-[800px] ${!isPdf ? 'cursor-crosshair' : ''}`}
            onClick={handleDocumentClick}
            style={{ aspectRatio: '8.5/11' }}
          >
            {/* Document Content */}
            {document?.originalFileUrl ? (
                isPdf ? (
                    <div className="w-full h-full flex flex-col">
                        {/* PDF Display with better fallback */}
                        <div className="flex-1 relative">
                            <iframe
                                src={`${document.originalFileUrl}#view=FitH`}
                                className="w-full h-full border-0"
                                title="Document Preview"
                                style={{ minHeight: '600px' }}
                            />
                        </div>
                        
                        {/* Alternative link if PDF doesn't load */}
                        <div className="p-4 bg-gray-50 border-t">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <FileText className="w-4 h-4" />
                                <span>PDF Preview</span>
                                <a 
                                    href={document.originalFileUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="ml-auto flex items-center gap-1 text-blue-600 hover:text-blue-800"
                                >
                                    <ExternalLink className="w-3 h-3" />
                                    Open in New Tab
                                </a>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="p-8 flex flex-col items-center justify-center text-center bg-gray-50 h-full">
                        <FileText className="w-16 h-16 text-gray-400 mb-4" />
                        <h3 className="text-xl font-semibold text-gray-800">Unsupported File Type for Preview</h3>
                        <p className="text-gray-600 mt-2 max-w-md">
                            This file type cannot be previewed in the editor. To add signature fields, please convert your document to a <strong>PDF</strong> and re-upload it.
                        </p>
                        <a href={document.originalFileUrl} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" className="mt-4">
                                Download Original File
                            </Button>
                        </a>
                    </div>
                )
            ) : (
              <div 
                className="p-8 prose max-w-none"
                dangerouslySetInnerHTML={{ __html: document?.content || '<p class="text-gray-500">Create a text-based document here, or go back and upload a PDF to add signature fields to an existing file.</p>' }}
              />
            )}

            {/* Signature Fields Overlay (only for text documents, not PDFs) */}
            {!isPdf && signatureFields.map(field => {
              const fieldType = fieldTypes.find(t => t.value === field.type);
              const Icon = fieldType?.icon || Type;
              // Ensure field has x, y, width, height for visual rendering
              if (field.x === undefined || field.y === undefined || field.width === undefined || field.height === undefined) {
                // This case should ideally not happen for non-PDFs if fields are added via visual click
                // but good to be defensive. Could render a warning or skip.
                return null; 
              }
              return (
                <div
                  key={field.id}
                  className={`absolute border-2 border-dashed ${fieldType?.color || 'bg-gray-100 border-gray-300'} 
                    cursor-move flex items-center justify-center text-xs font-medium transition-all
                    ${selectedField?.id === field.id ? 'ring-2 ring-blue-400' : ''}
                    hover:opacity-80`}
                  style={{
                    left: `${field.x}%`,
                    top: `${field.y}%`,
                    width: `${field.width}%`,
                    height: `${field.height}%`
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedField(field);
                  }}
                >
                  <Icon className="w-3 h-3 mr-1" />
                  <span className="truncate">{field.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}