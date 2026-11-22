import React, { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Task } from '@/api/entities.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Loader2, CheckCircle2, ClipboardList, ArrowLeft } from 'lucide-react';
import { createPageUrl } from '@/utils/index.js';

const CLOSED = ['done', 'completed', 'closed'];

export default function PendingTasks() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const filterActive = new URLSearchParams(location.search).get('status') === 'pending';
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['pendingTasksPage'],
    queryFn: () => Task.list(),
  });

  const pendingTasks = useMemo(() => tasks.filter(task => !CLOSED.includes(String(task.status || '').toLowerCase())), [tasks]);

  const markComplete = async (task) => {
    await Task.update(task.id, { status: 'completed' });
    queryClient.invalidateQueries({ queryKey: ['pendingTasksPage'] });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          {filterActive && <div className="mb-4 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900"><span>Showing pending tasks requiring attention.</span><Button variant="outline" size="sm" onClick={() => navigate(location.pathname, { replace: true })}>Show all tasks</Button></div>}
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3"><ClipboardList className="w-8 h-8 text-blue-600" />Pending Tasks</h1>
          <p className="text-gray-600 mt-1">Tasks requiring attention ({pendingTasks.length}).</p>
        </div>
        <Link to={createPageUrl('ProjectKanbanBoard')}><Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" />Open Project Board</Button></Link>
      </div>

      <Card>
        <CardHeader><CardTitle>Open Tasks ({pendingTasks.length})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div> : pendingTasks.length === 0 ? <div className="text-center py-12 text-gray-500">No pending tasks.</div> : (
            <div className="space-y-3">
              {pendingTasks.map(task => {
                const metadata = task.metadata || {};
                return <div key={task.id} className="border rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="min-w-0"><div className="flex items-center gap-2"><h2 className="font-semibold text-gray-900 truncate">{task.title}</h2><Badge variant="outline">{task.status || 'Open'}</Badge></div><p className="text-sm text-gray-600 mt-1">{task.description || 'No description provided.'}</p><p className="text-xs text-gray-500 mt-2">{metadata.technicianName || metadata.technician_name || 'Unassigned technician'}{task.due_date ? ` • Due ${new Date(task.due_date).toLocaleDateString()}` : ''}</p></div>
                  <Button size="sm" onClick={() => markComplete(task)}><CheckCircle2 className="w-4 h-4 mr-2" />Mark complete</Button>
                </div>;
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
