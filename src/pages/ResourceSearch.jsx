import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Search, Loader2 } from 'lucide-react';
import ResourceCard from '@/components/resources/ResourceCard';
import ResourceDialog from '@/components/resources/ResourceDialog';

export default function ResourceSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [selectedResource, setSelectedResource] = useState(null);
  const [userRole, setUserRole] = useState('contractor');
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    base44.auth.me().then(u => {
      if (u) {
        setUserRole(u.role);
        setUserEmail(u.email);
      }
    }).catch(() => {});
  }, []);

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
          origin: 'ResourceSearch'
        }).catch(() => {});
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm, userEmail]);

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
    if (!debouncedTerm) return visibleResources.filter(r => r.featured);
    
    const term = debouncedTerm.toLowerCase();
    return visibleResources.filter(r => {
      const matchTitle = r.title?.toLowerCase().includes(term);
      const matchTags = r.tags?.some(t => t.toLowerCase().includes(term));
      const matchContent = r.content?.toLowerCase().includes(term);
      const matchKeywords = r.searchKeywords?.toLowerCase().includes(term);
      const matchCategory = r.category?.toLowerCase().includes(term);
      return matchTitle || matchTags || matchContent || matchKeywords || matchCategory;
    });
  }, [visibleResources, debouncedTerm]);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">
      <div className="text-center max-w-3xl mx-auto mb-10 mt-8">
        <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4 tracking-tight">Resource Center</h1>
        <p className="text-lg text-gray-600 mb-8">Search operational guides, training, contacts, and more.</p>
        
        <div className="relative group max-w-2xl mx-auto">
          <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
            <Search className="h-6 w-6 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
          </div>
          <Input 
            className="w-full pl-14 pr-4 py-8 text-xl rounded-2xl shadow-xl border-2 border-transparent focus:border-blue-500 bg-white placeholder:text-gray-400 transition-all hover:shadow-2xl"
            placeholder="Search for 'Installation Guide', 'Safety Policy'..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
      ) : (
        <div className="animate-fade-in">
          <div className="flex items-center justify-between mb-6 border-b pb-4">
            <h2 className="text-2xl font-semibold text-gray-800">
              {!debouncedTerm ? 'Featured Resources' : `Search Results (${searchResults.length})`}
            </h2>
          </div>

          {searchResults.length === 0 ? (
            <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
              <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900">No resources found</h3>
              <p className="text-gray-500 mt-2">Try adjusting your search terms or browse categories.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {searchResults.map(resource => (
                <ResourceCard 
                  key={resource.id} 
                  resource={resource} 
                  onClick={setSelectedResource} 
                />
              ))}
            </div>
          )}
        </div>
      )}

      <ResourceDialog 
        resource={selectedResource} 
        open={!!selectedResource} 
        onOpenChange={(open) => !open && setSelectedResource(null)} 
      />
    </div>
  );
}