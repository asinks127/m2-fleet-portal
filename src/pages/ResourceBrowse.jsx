import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import ResourceCard from '@/components/resources/ResourceCard';
import ResourceDialog from '@/components/resources/ResourceDialog';

export default function ResourceBrowse() {
  const [selectedCategory, setSelectedCategory] = useState('All');
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

  const visibleResources = useMemo(() => {
    return allResources.filter(r => {
      if (userRole === 'admin') return true;
      return r.visibility === 'Both' || r.visibility === 'Contractor';
    });
  }, [allResources, userRole]);

  const categories = useMemo(() => {
    const cats = new Set(visibleResources.map(r => r.category).filter(Boolean));
    return ['All', ...Array.from(cats)].sort();
  }, [visibleResources]);

  const filtered = useMemo(() => {
    if (selectedCategory === 'All') return visibleResources;
    return visibleResources.filter(r => r.category === selectedCategory);
  }, [visibleResources, selectedCategory]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Browse Resources</h1>
          <p className="text-gray-500 mt-2 text-lg">Explore all available operational materials by category.</p>
        </div>
      </div>

      {!selectedCategory || selectedCategory === 'All' ? (
        <div className="mb-8 animate-fade-in">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Popular Resources</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {visibleResources.slice().sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0)).slice(0, 4).map(resource => (
              <ResourceCard key={resource.id} resource={resource} onClick={setSelectedResource} />
            ))}
          </div>
          <hr className="mt-8 border-gray-200" />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 mb-8 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        {categories.map(cat => (
          <Button 
            key={cat} 
            variant={selectedCategory === cat ? 'default' : 'ghost'}
            className={selectedCategory === cat ? 'bg-blue-600 text-white rounded-full' : 'rounded-full text-gray-600'}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
         <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
           <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
           <h3 className="text-xl font-medium text-gray-900">No resources found in this category</h3>
         </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.map(resource => (
            <ResourceCard key={resource.id} resource={resource} onClick={setSelectedResource} />
          ))}
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