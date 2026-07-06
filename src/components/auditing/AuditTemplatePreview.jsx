import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ChecklistSection from './ChecklistSection';

export default function AuditTemplatePreview({ open, template, items, onClose }) {
  const [responses, setResponses] = useState({});

  useEffect(() => {
    if (open) {
      setResponses({});
    }
  }, [open]);

  if (!template || !items) return null;

  // Group items by section
  const sections = {};
  items.forEach(item => {
    const key = item.sectionName || 'General';
    if (!sections[key]) sections[key] = [];
    sections[key].push(item);
  });

  const handleResponse = (itemId, field, value) => {
    setResponses(prev => ({ ...prev, [itemId]: { ...prev[itemId], [field]: value } }));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <div className="p-6 border-b bg-gray-50 shrink-0">
          <div className="flex justify-between items-start">
            <div>
              <Badge className="mb-2 bg-blue-100 text-blue-800">Preview Mode</Badge>
              <DialogTitle className="text-2xl">{template.name}</DialogTitle>
              <DialogDescription className="mt-1">
                {template.module} • {template.frequency} Audit
              </DialogDescription>
            </div>
            <div className="text-right text-sm">
              <p className="text-gray-500">Version {template.version || 1}</p>
              <p className="text-gray-500">{items.length} checklist items</p>
            </div>
          </div>
          {template.instructions && (
            <div className="mt-4 p-3 bg-blue-50/50 border border-blue-100 rounded-lg text-sm text-gray-700">
              <span className="font-semibold text-blue-900 block mb-1">Instructions:</span>
              {template.instructions}
            </div>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-100">
          {Object.entries(sections).map(([sectionName, sectionItems]) => (
            <ChecklistSection
              key={sectionName}
              sectionName={sectionName}
              items={sectionItems}
              responses={responses}
              onResponse={handleResponse}
              onCreateCA={() => alert('Corrective Action dialog would open here in live mode.')}
              disabled={false}
            />
          ))}
        </div>
        
        <div className="p-4 border-t bg-white shrink-0 flex justify-end">
          <Button onClick={onClose}>Close Preview</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}