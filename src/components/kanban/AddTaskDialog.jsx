import React, { useState, useEffect } from 'react';
import { sendKanbanAlert } from '@/functions.js';
import { User, Task } from '@/api/entities.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.jsx';
import { Calendar } from '@/components/ui/calendar.jsx';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export default function AddTaskDialog({ isOpen, onClose, technician, currentUser, onTaskAdded }) {
  const [assigneeList, setAssigneeList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [task, setTask] = useState({
    title: '',
    description: '',
    priority: 'Medium',
    assignedTo: '',
    dueDate: null
  });

  useEffect(() => {
    const fetchAssignees = async () => {
      const allUsers = await User.list();
      const pmsAndQc = allUsers.filter(u => u.email.includes('@m2fleetcom.com'));
      setAssigneeList(pmsAndQc);
    };
    if (isOpen) {
      fetchAssignees();
      // Reset form state when dialog opens
      setTask({ title: '', description: '', priority: 'Medium', assignedTo: '', dueDate: null });
    }
  }, [isOpen]);

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setTask(prev => ({ ...prev, [id]: value }));
  };

  const handleSelectChange = (id, value) => {
    setTask(prev => ({ ...prev, [id]: value }));
  };
  
  const handleDateChange = (date) => {
    setTask(prev => ({ ...prev, dueDate: date }));
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const assignee = assigneeList.find(u => u.email === task.assignedTo);
      
      const newTask = await Task.create({
        ...task,
        technicianId: technician.id,
        technicianName: technician.displayName || technician.full_name,
        assignedToName: assignee?.displayName || assignee?.full_name || task.assignedTo,
        status: 'To Do',
        createdBy: currentUser.email,
        dueDate: task.dueDate ? task.dueDate.toISOString().split('T')[0] : null
      });

      // Send email alert
      const emailBody = `
        <div style="font-family: sans-serif;">
          <h3>New Task Assigned</h3>
          <p>Hi ${assignee?.displayName || task.assignedTo},</p>
          <p>A new task has been assigned to you on the M2 Fleet Kanban Board:</p>
          <ul style="list-style: none; padding: 10px; background-color: #f9f9f9; border-radius: 5px;">
            <li><strong>Task:</strong> ${newTask.title}</li>
            <li><strong>Related Technician:</strong> ${technician.displayName}</li>
            <li><strong>Priority:</strong> ${newTask.priority}</li>
            <li><strong>Due Date:</strong> ${newTask.dueDate ? format(new Date(newTask.dueDate), 'PPP') : 'Not set'}</li>
            <li><strong>Assigned by:</strong> ${currentUser.displayName || currentUser.email}</li>
          </ul>
          <p><strong>Description:</strong><br>${newTask.description || 'No description provided.'}</p>
          <p>Please visit the Project Kanban Board to view details and update the status.</p>
        </div>
      `;

      await sendKanbanAlert({
        to: task.assignedTo,
        subject: `New Task: ${newTask.title}`,
        body: emailBody
      });
      
      onTaskAdded(); // Refresh board data
      onClose();
    } catch (error) {
      console.error("Failed to create task and send alert:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Task for {technician?.displayName}</DialogTitle>
          <DialogDescription>Assign a task to a PM or QC Tech related to this contractor.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Task Title</Label>
            <Input id="title" value={task.title} onChange={handleInputChange} placeholder="e.g., Follow up on expiring insurance" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" value={task.description} onChange={handleInputChange} placeholder="Provide details about the task..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="assignedTo">Assign To</Label>
              <Select onValueChange={(value) => handleSelectChange('assignedTo', value)}>
                <SelectTrigger><SelectValue placeholder="Select assignee..." /></SelectTrigger>
                <SelectContent>
                  {assigneeList.map(u => (
                    <SelectItem key={u.id} value={u.email}>{u.displayName || u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select defaultValue="Medium" onValueChange={(value) => handleSelectChange('priority', value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
           <div className="space-y-2">
              <Label>Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {task.dueDate ? format(task.dueDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={task.dueDate} onSelect={handleDateChange} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isLoading || !task.title || !task.assignedTo}>
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create and Alert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}