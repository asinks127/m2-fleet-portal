import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import ResourceCard from '@/components/resources/ResourceCard';
import ResourceDialog from '@/components/resources/ResourceDialog';

export default function ResourceTraining() {
  const [selectedResource, setSelectedResource] = useState(null);
  const [userRole, setUserRole] = useState('contractor');

  useEffect(() => { base44.auth.me().then(u => { if (u) setUserRole(u.role); }); }, []);

  const { data: allResources = [] } = useQuery({
    queryKey: ['resourceLibrary'],
    queryFn: () => base44.entities.ResourceLibrary.filter({ resourceType: 'Training Video' }),
  });

  const videos = useMemo(() => {
    return allResources.filter(r => userRole === 'admin' || r.visibility === 'Both' || r.visibility === 'Contractor');
  }, [allResources, userRole]);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <h1 className="text-4xl font-bold text-gray-900">Training Library</h1>
      <p className="text-xl text-gray-600">Watch training videos and onboarding guides.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        {videos.map(resource => (
          <ResourceCard key={resource.id} resource={resource} onClick={setSelectedResource} />
        ))}
        {videos.length === 0 && <p className="text-gray-500 col-span-full">No training videos published yet.</p>}
      </div>

      <ResourceDialog resource={selectedResource} open={!!selectedResource} onOpenChange={(o) => !o && setSelectedResource(null)} />
    </div>
  );
}