import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, PlayCircle, Wrench, FileDown, BookOpen, ShieldAlert, Phone, Activity } from 'lucide-react';

export default function ResourceCard({ resource, onClick }) {
  const getIcon = (type) => {
    switch(type) {
      case 'Article': return <BookOpen className="w-5 h-5 text-blue-500" />;
      case 'Install Guide': return <Wrench className="w-5 h-5 text-indigo-500" />;
      case 'Training Video': return <PlayCircle className="w-5 h-5 text-red-500" />;
      case 'Troubleshooting Guide': return <Activity className="w-5 h-5 text-orange-500" />;
      case 'Safety Document': return <ShieldAlert className="w-5 h-5 text-green-500" />;
      case 'Contact': return <Phone className="w-5 h-5 text-teal-500" />;
      case 'PDF Document': return <FileDown className="w-5 h-5 text-rose-500" />;
      case 'Project Documentation': return <FileText className="w-5 h-5 text-cyan-500" />;
      default: return <FileText className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <Card 
      className="cursor-pointer hover-lift h-full flex flex-col transition-all border-gray-200 shadow-sm hover:shadow-md bg-white"
      onClick={() => onClick(resource)}
    >
      <CardHeader className="pb-3 flex-none">
        <div className="flex justify-between items-start mb-2 gap-2">
          <div className="p-2 bg-blue-50 rounded-lg shrink-0">
            {getIcon(resource.resourceType)}
          </div>
          <div className="flex flex-wrap gap-1 justify-end">
            {resource.featured && <Badge className="bg-amber-100 text-amber-800 border-amber-200">Featured</Badge>}
            <Badge variant="outline" className="bg-white">{resource.resourceType}</Badge>
          </div>
        </div>
        <CardTitle className="text-lg line-clamp-2 leading-tight mt-1">{resource.title}</CardTitle>
        {resource.category && (
          <CardDescription className="text-sm font-medium text-blue-600 mt-2">
            {resource.category} {resource.subcategory ? `• ${resource.subcategory}` : ''}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex-grow flex flex-col justify-between">
        <p className="text-sm text-gray-600 line-clamp-3 mb-4">
          {resource.content ? resource.content.replace(/<[^>]*>?/gm, '') : 
            (resource.searchKeywords || 'No description available.')}
        </p>
        <div className="flex items-center gap-2 mt-auto text-xs text-gray-400">
           {resource.tags && resource.tags.slice(0, 3).map((tag, i) => (
             <span key={i} className="bg-gray-100 text-gray-600 px-2 py-1 rounded-md">#{tag}</span>
           ))}
           {resource.tags?.length > 3 && <span>+{resource.tags.length - 3}</span>}
        </div>
      </CardContent>
    </Card>
  );
}