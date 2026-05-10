import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2, BarChart } from 'lucide-react';
import CreateResourceDialog from '@/components/resources/CreateResourceDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ResourceAdmin() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingResource, setEditingResource] = useState(null);

  const { data: resources = [], refetch } = useQuery({
    queryKey: ['resourceLibraryAll'],
    queryFn: () => base44.entities.ResourceLibrary.list('-created_date', 1000),
  });

  const { data: analytics = [] } = useQuery({
    queryKey: ['searchAnalytics'],
    queryFn: () => base44.entities.SearchAnalytics.list('-created_date', 500),
  });

  const { data: feedbacks = [] } = useQuery({
    queryKey: ['resourceFeedback'],
    queryFn: () => base44.entities.ResourceFeedback.list('-created_date', 1000),
  });

  const resourceStats = useMemo(() => {
    const stats = {};
    feedbacks.forEach(f => {
      if (!stats[f.resourceId]) stats[f.resourceId] = { helpful: 0, notHelpful: 0 };
      if (f.helpful) stats[f.resourceId].helpful += 1;
      else stats[f.resourceId].notHelpful += 1;
    });
    return stats;
  }, [feedbacks]);

  const topSearches = useMemo(() => {
    const counts = {};
    analytics.forEach(a => {
      const kw = a.keyword?.toLowerCase() || 'unknown';
      counts[kw] = (counts[kw] || 0) + 1;
    });
    return Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 10);
  }, [analytics]);

  const unansweredSearches = useMemo(() => {
    const counts = {};
    analytics.filter(a => a.resultCount === 0).forEach(a => {
      const kw = a.keyword?.toLowerCase() || 'unknown';
      counts[kw] = (counts[kw] || 0) + 1;
    });
    return Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 10);
  }, [analytics]);

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this resource?')) {
      await base44.entities.ResourceLibrary.delete(id);
      refetch();
    }
  };

  const handleEdit = (r) => {
    setEditingResource(r);
    setCreateOpen(true);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Manage Resource Center</h1>
          <p className="text-gray-500 mt-1">Admin control panel for resources and search analytics.</p>
        </div>
        <Button onClick={() => { setEditingResource(null); setCreateOpen(true); }} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" /> Add Resource
        </Button>
      </div>

      <Tabs defaultValue="resources" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="resources">All Resources ({resources.length})</TabsTrigger>
          <TabsTrigger value="analytics">Search Analytics</TabsTrigger>
        </TabsList>
        <TabsContent value="resources" className="bg-white p-4 rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Visibility</TableHead>
                <TableHead>Metrics</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resources.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {r.title}
                    {r.featured && <Badge className="ml-2 bg-amber-100 text-amber-800 text-[10px]">Featured</Badge>}
                  </TableCell>
                  <TableCell>{r.resourceType}</TableCell>
                  <TableCell>{r.category || '-'}</TableCell>
                  <TableCell><Badge variant="outline">{r.visibility}</Badge></TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 text-xs">
                      <span>👁️ {r.viewCount || 0} views</span>
                      <span className="text-green-600">👍 {resourceStats[r.id]?.helpful || 0} helpful</span>
                      <span className="text-red-600">👎 {resourceStats[r.id]?.notHelpful || 0} not helpful</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(r)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete(r.id)}><Trash2 className="w-4 h-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {resources.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-gray-500">No resources created yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-6">
                 <div className="bg-white p-6 rounded-xl border">
                   <h3 className="text-lg font-bold mb-4 flex items-center"><BarChart className="w-5 h-5 mr-2 text-blue-500"/> Top Search Keywords</h3>
                   <div className="space-y-3">
                     {topSearches.map(([kw, count], idx) => (
                       <div key={idx} className="flex justify-between items-center border-b pb-2">
                         <span className="font-medium text-gray-700">"{kw}"</span>
                         <Badge variant="secondary">{count} searches</Badge>
                       </div>
                     ))}
                     {topSearches.length === 0 && <p className="text-gray-500">No searches yet.</p>}
                   </div>
                 </div>

                 <div className="bg-white p-6 rounded-xl border border-red-100">
                   <h3 className="text-lg font-bold mb-4 flex items-center text-red-700">Unanswered Searches</h3>
                   <p className="text-sm text-gray-500 mb-4">Searches that returned 0 results.</p>
                   <div className="space-y-3">
                     {unansweredSearches.map(([kw, count], idx) => (
                       <div key={idx} className="flex justify-between items-center border-b pb-2">
                         <span className="font-medium text-gray-700">"{kw}"</span>
                         <Badge variant="destructive">{count} failed searches</Badge>
                       </div>
                     ))}
                     {unansweredSearches.length === 0 && <p className="text-gray-500">No failed searches yet.</p>}
                   </div>
                 </div>
             </div>
             
             <div className="bg-white p-6 rounded-xl border h-fit">
               <h3 className="text-lg font-bold mb-4">Most Viewed Resources</h3>
               <div className="space-y-3">
                 {resources.sort((a,b) => (b.viewCount||0) - (a.viewCount||0)).slice(0, 10).map((r, idx) => (
                   <div key={idx} className="flex justify-between items-center border-b pb-2">
                     <span className="font-medium text-gray-700 truncate mr-4">{r.title}</span>
                     <Badge variant="secondary">{r.viewCount || 0} views</Badge>
                   </div>
                 ))}
               </div>
             </div>
          </div>
        </TabsContent>
      </Tabs>

      <CreateResourceDialog 
        open={createOpen} 
        onClose={() => setCreateOpen(false)} 
        onSuccess={() => { setCreateOpen(false); refetch(); }}
        initialData={editingResource}
      />
    </div>
  );
}