import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import ResourceCard from '@/components/resources/ResourceCard';
import ResourceDialog from '@/components/resources/ResourceDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function ResourceInstallGuides() {
  const [selectedResource, setSelectedResource] = useState(null);
  const [userRole, setUserRole] = useState('contractor');
  
  const [deviceFilter, setDeviceFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [vehicleFilter, setVehicleFilter] = useState('all');

  useEffect(() => { base44.auth.me().then(u => { if (u) setUserRole(u.role); }).catch(() => {}); }, []);

  const { data: allResources = [] } = useQuery({
    queryKey: ['resourceLibrary'],
    queryFn: () => base44.entities.ResourceLibrary.filter({ resourceType: 'Install Guide' }),
  });

  const guides = useMemo(() => {
    let filtered = allResources.filter(r => userRole === 'admin' || r.visibility === 'Both' || r.visibility === 'Contractor');
    if (deviceFilter !== 'all') filtered = filtered.filter(r => r.device === deviceFilter);
    if (customerFilter !== 'all') filtered = filtered.filter(r => r.customer === customerFilter);
    if (vehicleFilter !== 'all') filtered = filtered.filter(r => r.vehicleType === vehicleFilter);
    return filtered;
  }, [allResources, userRole, deviceFilter, customerFilter, vehicleFilter]);

  const devices = useMemo(() => ['all', ...new Set(allResources.map(r => r.device).filter(Boolean))], [allResources]);
  const customers = useMemo(() => ['all', ...new Set(allResources.map(r => r.customer).filter(Boolean))], [allResources]);
  const vehicles = useMemo(() => ['all', ...new Set(allResources.map(r => r.vehicleType).filter(Boolean))], [allResources]);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <h1 className="text-4xl font-bold text-gray-900">Install Guides</h1>
      <p className="text-xl text-gray-600 mb-6">Filter and find installation manuals and wiring diagrams.</p>

      <div className="flex flex-wrap gap-4 p-5 bg-white rounded-xl border border-gray-200 shadow-sm mb-8">
         <Select value={deviceFilter} onValueChange={setDeviceFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Filter Device" /></SelectTrigger>
            <SelectContent>
               {devices.map(d => <SelectItem key={d} value={d}>{d === 'all' ? 'All Devices' : d}</SelectItem>)}
            </SelectContent>
         </Select>
         <Select value={customerFilter} onValueChange={setCustomerFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Filter Customer" /></SelectTrigger>
            <SelectContent>
               {customers.map(c => <SelectItem key={c} value={c}>{c === 'all' ? 'All Customers' : c}</SelectItem>)}
            </SelectContent>
         </Select>
         <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Filter Vehicle" /></SelectTrigger>
            <SelectContent>
               {vehicles.map(v => <SelectItem key={v} value={v}>{v === 'all' ? 'All Vehicles' : v}</SelectItem>)}
            </SelectContent>
         </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {guides.map(resource => (
          <ResourceCard key={resource.id} resource={resource} onClick={setSelectedResource} />
        ))}
        {guides.length === 0 && <p className="text-gray-500 col-span-full">No install guides match your filters.</p>}
      </div>

      <ResourceDialog resource={selectedResource} open={!!selectedResource} onOpenChange={(o) => !o && setSelectedResource(null)} />
    </div>
  );
}