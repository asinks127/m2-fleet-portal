import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient.js';
import { CheckCircle2, Circle, Clock, Plus, Trash2, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ChannelTasksPanel({ channel, currentUser }) {
  const queryClient = useQueryClient();
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('medium');

  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const targetId = channel?.id;
  const targetName = channel ? `#${channel.name}` : 'this conversation';

  const { data: tasks = [] } = useQuery({
    queryKey: ['channelTasks', targetId],
    queryFn: async () => {
      const { data } = await supabase.from('ChannelTask').select('*').eq('channelId', targetId).order('created_date', { ascending: false });
      return data || [];
    },
    enabled: !!targetId,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await supabase.from('User').select('email,full_name,displayName').limit(100);
      return data || [];
    },
  });

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) return;
    
    let assigneeName = null;
    if (selectedAssignee) {
      const user = allUsers.find(u => u.email === selectedAssignee);
      assigneeName = user ? (user.full_name || user.displayName || user.email) : null;
    }

    await supabase.from('ChannelTask').insert({
      channelId: targetId,
      title: newTaskTitle.trim(),
      assignedToEmail: selectedAssignee || null,
      assignedToName: assigneeName,
      status: 'todo',
      priority: priority,
      createdByEmail: currentUser.email,
      dueDate: dueDate || null
    });

    let messageContent = `🎫 **New Task Created:** ${newTaskTitle.trim()}`;
    if (assigneeName) messageContent += `\n👤 **Assigned to:** ${assigneeName}`;
    if (priority) messageContent += `\n⚡ **Priority:** ${priority}`;
    if (dueDate) messageContent += `\n📅 **Due:** ${new Date(dueDate).toLocaleDateString()}`;

    await supabase.from('ChatMessage').insert({
      channelId: channel?.id || null,
      senderEmail: currentUser.email,
      senderName: currentUser.full_name || currentUser.email,
      content: messageContent,
      reactions: [],
      edited: false,
      deleted: false,
    });
    
    setNewTaskTitle('');
    setSelectedAssignee('');
    setDueDate('');
    setPriority('medium');
    queryClient.invalidateQueries({ queryKey: ['channelTasks', targetId] });
    queryClient.invalidateQueries({ queryKey: ['messages'] });
  };

  const handleUpdateTask = async (task, updates) => {
    await supabase.from('ChannelTask').update(updates).eq('id', task.id);
    queryClient.invalidateQueries({ queryKey: ['channelTasks', targetId] });
  };

  const handleDelete = async (task) => {
    if (window.confirm('Delete this task?')) {
      await supabase.from('ChannelTask').delete().eq('id', task.id);
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

  const getPriorityColor = (p) => {
    const pLower = (p || '').toLowerCase();
    if (pLower === 'high') return 'bg-red-50 text-red-700 border-red-200';
    if (pLower === 'low') return 'bg-gray-50 text-gray-700 border-gray-200';
    return 'bg-amber-50 text-amber-700 border-amber-200';
  };

  const startEdit = (task) => {
    setEditingTaskId(task.id);
    setEditForm({
      title: task.title || '',
      priority: task.priority || 'medium',
      status: task.status || 'todo',
      assignedToEmail: task.assignedToEmail || '',
      dueDate: task.dueDate || ''
    });
  };

  const saveEdit = async () => {
    let assigneeName = null;
    if (editForm.assignedToEmail) {
      const user = allUsers.find(u => u.email === editForm.assignedToEmail);
      assigneeName = user ? (user.full_name || user.displayName || user.email) : null;
    }
    
    await handleUpdateTask({ id: editingTaskId }, {
      ...editForm,
      assignedToName: assigneeName
    });
    setEditingTaskId(null);
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
                <option key={u.email} value={u.email}>{u.full_name || u.displayName || u.email}</option>
              ))}
            </select>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value)}
              className="border rounded-md px-3 text-sm bg-white"
            >
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
            </select>
            <Button onClick={handleCreateTask} disabled={!newTaskTitle.trim()}>
              <Plus className="w-4 h-4 mr-2" /> Add
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tasks.length === 0 ? (
            <p className="text-center text-gray-500 py-8 col-span-full">No tasks in this conversation yet.</p>
          ) : (
            tasks.map(task => {
              if (editingTaskId === task.id) {
                return (
                  <div key={task.id} className="bg-white p-4 rounded-xl shadow-md border border-blue-200 flex flex-col gap-3 relative">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-semibold text-sm text-gray-900">Edit Task</h4>
                      <button onClick={() => setEditingTaskId(null)} className="text-gray-400 hover:text-gray-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-gray-500">Title</label>
                        <Input 
                          value={editForm.title} 
                          onChange={e => setEditForm({...editForm, title: e.target.value})} 
                          className="h-8 text-sm mt-1"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs font-medium text-gray-500">Status</label>
                          <select 
                            value={editForm.status} 
                            onChange={e => setEditForm({...editForm, status: e.target.value})}
                            className="w-full border rounded-md h-8 px-2 text-sm mt-1"
                          >
                            <option value="todo">To Do</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500">Priority</label>
                          <select 
                            value={editForm.priority} 
                            onChange={e => setEditForm({...editForm, priority: e.target.value})}
                            className="w-full border rounded-md h-8 px-2 text-sm mt-1"
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs font-medium text-gray-500">Assignee</label>
                          <select 
                            value={editForm.assignedToEmail} 
                            onChange={e => setEditForm({...editForm, assignedToEmail: e.target.value})}
                            className="w-full border rounded-md h-8 px-2 text-sm mt-1"
                          >
                            <option value="">Unassigned</option>
                            {allUsers.map(u => (
                              <option key={u.email} value={u.email}>{u.full_name || u.displayName || u.email}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500">Due Date</label>
                          <Input 
                            type="date"
                            value={editForm.dueDate} 
                            onChange={e => setEditForm({...editForm, dueDate: e.target.value})} 
                            className="h-8 text-sm mt-1 px-2"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <Button onClick={saveEdit} className="w-full bg-blue-600 hover:bg-blue-700 text-white" size="sm">
                        Save Changes
                      </Button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={task.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col group hover:shadow-md transition-shadow relative">
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                    <button 
                      onClick={() => startEdit(task)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(task)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-start gap-3 mb-2 pr-12">
                    <button 
                      onClick={() => handleUpdateTask(task, { status: task.status === 'completed' ? 'todo' : 'completed' })}
                      className="mt-0.5 focus:outline-none hover:bg-gray-50 rounded-full transition-colors flex-shrink-0"
                    >
                      {getStatusIcon(task.status)}
                    </button>
                    <h4 className={`font-semibold text-gray-900 text-sm leading-snug ${task.status === 'completed' ? 'line-through text-gray-400' : ''}`}>
                      {task.title}
                    </h4>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-3 ml-8">
                    <span className={`text-[10px] px-2 py-0.5 rounded-md border font-bold uppercase tracking-wider whitespace-nowrap ${getPriorityColor(task.priority)}`}>
                      {task.priority || 'medium'}
                    </span>
                    <span className="text-xs text-gray-500 border border-gray-200 bg-gray-50 px-2 py-0.5 rounded-md font-medium capitalize">
                      {task.status?.replace('_', ' ') || 'todo'}
                    </span>
                  </div>

                  <div className="mt-auto flex items-center justify-between text-xs pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-1.5 text-gray-600 truncate max-w-[60%]">
                      <span className="text-gray-400 text-[11px]">👤</span>
                      <span className="truncate font-medium" title={task.assignedToName || task.assignedToEmail || 'Unassigned'}>
                        {task.assignedToName || task.assignedToEmail || 'Unassigned'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <span className="text-gray-400 text-[11px]">📅</span>
                      <span className={`font-medium ${task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed' ? 'text-red-500' : ''}`}>
                        {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'None'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}