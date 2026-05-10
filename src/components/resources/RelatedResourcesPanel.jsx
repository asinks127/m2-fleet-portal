import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BookOpen, Wrench, PlayCircle, Activity, ShieldAlert, Phone, FileDown, FileText, ChevronRight } from 'lucide-react';
import ResourceDialog from '@/components/resources/ResourceDialog';

export default function RelatedResourcesPanel({ tags = [], categories = [], title = "Related Resources", maxItems = 4 }) {
  const [selectedResource, setSelectedResource] = useState(null);
  const [userRole, setUserRole] = useState('contractor');

  useEffect(() => {
    base44.auth.me().then(u => {
      if (u) setUserRole(u.role);
    }).catch(() => {});
  }, []);

  const { data: allResources = [] } = useQuery({
    queryKey: ['resourceLibrary'],
    queryFn: () => base44.entities.ResourceLibrary.list('-created_date', 500),
  });

  const relatedResources = useMemo(() => {
    let visible = allResources.filter(r => {
      if (userRole === 'admin') return true;
      return r.visibility === 'Both' || r.visibility === 'Contractor';
    });

    if (tags.length === 0 && categories.length === 0) return [];

    const scored = visible.map(r => {
      let score = 0;
      if (categories.includes(r.category)) score += 5;
      if (r.tags) {
        tags.forEach(t => {
          if (r.tags.some(rt => rt.toLowerCase().includes(t.toLowerCase()))) score += 2;
        });
      }
      return { ...r, _score: score };
    }).filter(r => r._score > 0);

    return scored.sort((a, b) => b._score - a._score).slice(0, maxItems);
  }, [allResources, userRole, tags, categories, maxItems]);

  const getIcon = (type) => {
    switch(type) {
      case 'Article': return <BookOpen className="w-4 h-4 text-blue-500" />;
      case 'Install Guide': return <Wrench className="w-4 h-4 text-indigo-500" />;
      case 'Training Video': return <PlayCircle className="w-4 h-4 text-red-500" />;
      case 'Troubleshooting Guide': return <Activity className="w-4 h-4 text-orange-500" />;
      case 'Safety Document': return <ShieldAlert className="w-4 h-4 text-green-500" />;
      case 'Contact': return <Phone className="w-4 h-4 text-teal-500" />;
      case 'PDF Document': return <FileDown className="w-4 h-4 text-rose-500" />;
      case 'Project Documentation': return <FileText className="w-4 h-4 text-cyan-500" />;
      default: return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  if (relatedResources.length === 0) return null;

  return (
    <>
      <Card className="bg-white/80 backdrop-blur shadow-sm border-blue-100">
        <CardHeader className="pb-3 border-b border-gray-100 bg-gray-50/50 rounded-t-xl">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center">
            <BookOpen className="w-4 h-4 mr-2 text-blue-600" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-gray-100">
            {relatedResources.map(res => (
              <li 
                key={res.id} 
                className="p-3 hover:bg-blue-50 cursor-pointer transition-colors flex items-start gap-3 group"
                onClick={() => setSelectedResource(res)}
              >
                <div className="mt-0.5 shrink-0 bg-white p-1.5 rounded-md shadow-sm border border-gray-100 group-hover:border-blue-200">
                  {getIcon(res.resourceType)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-700 transition-colors">
                    {res.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {res.category || res.resourceType}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 mt-2 group-hover:text-blue-500 shrink-0" />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      
      <ResourceDialog 
        resource={selectedResource} 
        open={!!selectedResource} 
        onOpenChange={(open) => !open && setSelectedResource(null)} 
      />
    </>
  );
}