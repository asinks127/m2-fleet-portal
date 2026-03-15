import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient.js';
import { CheckCircle2, Circle, Clock, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';

export default function ChannelTasksPanel({ channel, dmThread, currentUser, allUsers }) {
  const queryClient = useQueryClient();
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [dueDate, setDueDate] = useState('');

  const targetId = channel?.id || dmThread?.id;
  const targetKey = channel ? 'channelId' : 'dmThreadId';
  const targetName = channel ? `#${channel.name}` : 'this conversation';

  const { data: tasks = [] } = useQuery({
    queryKey: ['channelTasks', targetId],
    queryFn: async () => (await supabase.from('ChannelTask').select('*').match({ [targetKey]: targetId }).order('created_date', { ascending: false }).limit(100)).data,
    enabled: !!targetId,
  });

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) return;
    
    let assigneeName = null;
    if (selectedAssignee) {
      const user = allUsers.find(u => u.email === selectedAssignee);
      assigneeName = user ? (user.full_name || user.email) : null;
    }

    await supabase.from('ChannelTask').insert({
      [targetKey]: targetId,
      title: newTaskTitle.trim(),
      assignedToEmail: selectedAssignee || null,
      assignedToName: assigneeName,
      status: 'open',
      createdByEmail: currentUser.email,
      createdByName: currentUser.full_name || currentUser.email
    });
    
    setNewTaskTitle('');
    setSelectedAssignee('');
    setDueDate('');
    queryClient.invalidateQueries({ queryKey: ['channelTasks', targetId] });
  };

  const handleToggleStatus = async (task) => {
    const statuses = ['todo', 'in_progress', 'completed'];
    const nextIndex = (statuses.indexOf(task.status) + 1) % statuses.length;
    const nextStatus = statuses[nextIndex];
    
    await (await supabase.from('ChannelTask').update({ status: nextStatus }).eq('id', task.id)).data;
    queryClient.invalidateQueries({ queryKey: ['channelTasks', targetId] });
  };

  const handleDelete = async (task) => {
    if (window.confirm('Delete this task?')) {
      await (await supabase.from('ChannelTask').delete().eq('id', task.id));
      queryClient.invalidateQueries({ queryKey: ['channelTasks', targetId] });
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'completed': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'in_progress': return <Clock className="w-5 h-5 text-blue-500" />;
      default: return <Circle className="w-5 h-5 text-gray-300" />;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <h3 className="font-semibold mb-3">Add New Task for {targetName}</h3>
          <div className="flex gap-2 flex-wrap sm:flex-nowrap">
            <Input 
              value={newTaskTitle}
              onChange={e => setNewTaskTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="flex-1 min-w-[200px]"
              onKeyDown={e => e.key === 'Enter' && handleCreateTask()}
            />
            <Input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-auto"
            />
            <select 
              value={selectedAssignee} 
              onChange={e => setSelectedAssignee(e.target.value)}
              className="border rounded-md px-3 text-sm bg-white"
            >
              <option value="">Unassigned</option>
              {allUsers.map(u => (
                <option key={u.email} value={u.email}>{u.full_name || u.email}</option>
              ))}
            </select>
            <Button onClick={handleCreateTask} disabled={!newTaskTitle.trim()}>
              <Plus className="w-4 h-4 mr-2" /> Add
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {tasks.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No tasks in this conversation yet.</p>
          ) : (
            tasks.map(task => (
              <div key={task.id} className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 flex items-center gap-3 group">
                <button onClick={() => handleToggleStatus(task)} className="focus:outline-none hover:bg-gray-50 rounded-full p-1 transition-colors">
                  {getStatusIcon(task.status)}
                </button>
                
                <div className="flex-1">
                  <p className={`text-sm ${task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-900 font-medium'}`}>
                    {task.title}
                  </p>
                  <div className="flex text-xs text-gray-500 mt-1 gap-3">
                    <span>
                      Status: <span className="capitalize">{task.status.replace('_', ' ')}</span>
                    </span>
                    {task.assignedToName && (
                      <span>Assignee: {task.assignedToName}</span>
                    )}
                    {task.dueDate && (
                      <span className={new Date(task.dueDate) < new Date() && task.status !== 'completed' ? 'text-red-500 font-semibold' : ''}>
                        Due: {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                <button 
                  onClick={() => handleDelete(task)}
                  className="opacity-0 group-hover:opacity-100 p-2 text-red-500 hover:bg-red-50 rounded-md transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}