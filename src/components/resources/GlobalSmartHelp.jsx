import React, { useState, useEffect, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { HelpCircle, Search, X, Loader2, BookOpen, Wrench, PlayCircle, Activity, ShieldAlert, Phone, FileDown, FileText } from 'lucide-react';
import ResourceDialog from '@/components/resources/ResourceDialog';

export default function GlobalSmartHelp() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [selectedResource, setSelectedResource] = useState(null);
  const [userRole, setUserRole] = useState('contractor');
  const [userEmail, setUserEmail] = useState('');
  const wrapperRef = useRef(null);

  useEffect(() => {
    base44.auth.me().then(u => {
      if (u) {
        setUserRole(u.role);
        setUserEmail(u.email);
      }
    }).catch(() => {});
  }, []);

  const { data: allResources = [], isLoading } = useQuery({
    queryKey: ['resourceLibrary'],
    queryFn: () => base44.entities.ResourceLibrary.list('-created_date', 500),
  });

  const visibleResources = useMemo(() => {
    return allResources.filter(r => {
      if (userRole === 'admin') return true;
      return r.visibility === 'Both' || r.visibility === 'Contractor';
    });
  }, [allResources, userRole]);

  const searchResults = useMemo(() => {
    if (!debouncedTerm) return [];
    
    const term = debouncedTerm.toLowerCase();
    return visibleResources.filter(r => {
      const matchTitle = r.title?.toLowerCase().includes(term);
      const matchTags = r.tags?.some(t => t.toLowerCase().includes(term));
      const matchContent = r.content?.toLowerCase().includes(term);
      const matchKeywords = r.searchKeywords?.toLowerCase().includes(term);
      const matchCategory = r.category?.toLowerCase().includes(term);
      return matchTitle || matchTags || matchContent || matchKeywords || matchCategory;
    }).slice(0, 5); // limit to 5 results for quick help
  }, [visibleResources, debouncedTerm]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedTerm(searchTerm);
      if (searchTerm.length > 2) {
        base44.entities.SearchAnalytics.create({
          keyword: searchTerm,
          userEmail: userEmail || 'unknown',
          resultCount: searchResults.length 
        }).catch(() => {});
        base44.entities.ResourceSearchLog.create({
          searchTerm: searchTerm,
          userEmail: userEmail || 'unknown',
          resultsReturned: searchResults.length,
          origin: 'GlobalSmartHelp'
        }).catch(() => {});
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm, userEmail, searchResults.length]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target) && !selectedResource && !document.getElementById('radix-portal')) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedResource]);

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

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end" ref={wrapperRef}>
      {isOpen && (
        <Card className="w-80 md:w-96 mb-4 shadow-2xl border-blue-200 overflow-hidden animate-slide-in-right flex flex-col max-h-[500px]">
          <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
            <h3 className="font-semibold flex items-center"><HelpCircle className="w-5 h-5 mr-2" /> Smart Help</h3>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-white hover:bg-blue-700" onClick={() => setIsOpen(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="p-3 border-b bg-gray-50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input 
                autoFocus
                placeholder="Ask a question or search..." 
                className="pl-9 bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1 p-0">
            {isLoading && <div className="p-4 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-blue-500" /></div>}
            
            {!isLoading && debouncedTerm.length > 2 && searchResults.length === 0 && (
              <div className="p-6 text-center text-gray-500">
                <p className="text-sm">No results found for "{debouncedTerm}"</p>
                <p className="text-xs mt-1">Try different keywords.</p>
              </div>
            )}
            
            {!isLoading && debouncedTerm.length <= 2 && (
              <div className="p-6 text-center text-gray-400 text-sm">
                Type at least 3 characters to search the Resource Center.
              </div>
            )}

            {!isLoading && searchResults.length > 0 && (
              <div className="divide-y">
                {searchResults.map(res => (
                  <div 
                    key={res.id} 
                    className="p-3 hover:bg-blue-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedResource(res)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 bg-white p-1.5 rounded shadow-sm border border-gray-100">
                        {getIcon(res.resourceType)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{res.title}</p>
                        <div className="flex items-center text-xs text-gray-500 mt-0.5 gap-2">
                          <span>{res.resourceType}</span>
                          {res.category && <span>• {res.category}</span>}
                        </div>
                        <p className="text-xs text-gray-600 mt-1 line-clamp-1">
                          {res.content ? res.content.replace(/<[^>]*>?/gm, '') : res.searchKeywords || 'Click to view details'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {!isOpen && (
        <Button 
          onClick={() => setIsOpen(true)} 
          className="h-14 px-6 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 text-white font-medium hover-lift group"
        >
          <HelpCircle className="w-6 h-6 mr-2 group-hover:scale-110 transition-transform" />
          Smart Help
        </Button>
      )}

      <ResourceDialog 
        resource={selectedResource} 
        open={!!selectedResource} 
        onOpenChange={(open) => !open && setSelectedResource(null)} 
      />
    </div>
  );
}