import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit2, Trash2, Copy, Eye, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';

export default function AuditTemplates() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [duplicating, setDuplicating] = useState(false);
  const [toggling, setToggling] = useState(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['auditTemplates'],
    queryFn: () => base44.entities.AuditTemplate.list('-created_date', 100),
    initialData: [],
  });

  const handleToggleActive = async (template) => {
    setToggling(template.id);
    try {
      await base44.entities.AuditTemplate.update(template.id, { active: !template.active });
      queryClient.invalidateQueries(['auditTemplates']);
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setToggling(null);
    }
  };

  const handleDuplicate = async (template) => {
    setDuplicating(true);
    try {
      // 1. Create new template
      const newTemplate = await base44.entities.AuditTemplate.create({
        name: `${template.name} (Copy)`,
        module: template.module,
        department: template.department,
        frequency: template.frequency,
        active: false, // Default to inactive when copied
        defaultOwnerRole: template.defaultOwnerRole,
        requiresManualAssignment: template.requiresManualAssignment,
        escalationThreshold: template.escalationThreshold,
        scoringMethod: template.scoringMethod,
        instructions: template.instructions,
        version: 1
      });

      // 2. Copy items
      const items = await base44.entities.AuditTemplateItem.filter({ templateId: template.id });
      if (items.length > 0) {
        const newItems = items.map(item => ({
          templateId: newTemplate.id,
          sectionName: item.sectionName,
          sectionOrder: item.sectionOrder,
          question: item.question,
          description: item.description,
          responseType: item.responseType,
          required: item.required,
          pointValue: item.pointValue,
          isCritical: item.isCritical,
          sortOrder: item.sortOrder
        }));
        await base44.entities.AuditTemplateItem.bulkCreate(newItems);
      }

      queryClient.invalidateQueries(['auditTemplates']);
      navigate(createPageUrl('AuditTemplateBuilder') + `?id=${newTemplate.id}`);
    } catch (e) {
      alert('Error duplicating: ' + e.message);
    } finally {
      setDuplicating(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Audit Templates</h1>
          <p className="text-gray-600 mt-1">Manage templates and checklists for all operational audits</p>
        </div>
        <Button onClick={() => navigate(createPageUrl('AuditTemplateBuilder'))}>
          <Plus className="w-4 h-4 mr-2" />
          Create Template
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Template Library</CardTitle>
          <CardDescription>Configure questions, scoring, and routing for your audits.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No audit templates configured yet.</p>
              <Button variant="outline" onClick={() => navigate(createPageUrl('AuditTemplateBuilder'))}>Create your first template</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-700">
                  <tr>
                    <th className="px-4 py-3 font-medium rounded-tl-lg">Template Name</th>
                    <th className="px-4 py-3 font-medium">Module / Frequency</th>
                    <th className="px-4 py-3 font-medium">Version</th>
                    <th className="px-4 py-3 font-medium">Last Updated</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium rounded-tr-lg text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {templates.map(template => (
                    <tr key={template.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{template.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 items-start">
                          <span className="text-gray-700">{template.module}</span>
                          <Badge variant="outline" className="text-xs">{template.frequency}</Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3">v{template.version || 1}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {template.updated_date ? format(new Date(template.updated_date), 'MMM d, yyyy') : 'N/A'}
                      </td>
                      <td className="px-4 py-3">
                        {template.active ? (
                          <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-800 border-gray-200">Inactive</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            title={template.active ? "Deactivate" : "Activate"}
                            onClick={() => handleToggleActive(template)}
                            disabled={toggling === template.id}
                          >
                            {toggling === template.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 
                             template.active ? <XCircle className="w-4 h-4 text-orange-500" /> : <CheckCircle className="w-4 h-4 text-green-500" />}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            title="Edit"
                            onClick={() => navigate(createPageUrl('AuditTemplateBuilder') + `?id=${template.id}`)}
                          >
                            <Edit2 className="w-4 h-4 text-blue-500" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            title="Duplicate"
                            onClick={() => handleDuplicate(template)}
                            disabled={duplicating}
                          >
                            <Copy className="w-4 h-4 text-gray-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}