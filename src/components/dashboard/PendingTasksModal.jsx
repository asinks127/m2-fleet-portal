import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent } from '@/components/ui/card.jsx';
import { CheckSquare, AlertCircle, ArrowRight, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils/index.js';
import { format, isPast } from 'date-fns';

export default function PendingTasksModal({ isOpen, onClose, tasks }) {
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'Urgent': return 'bg-red-100 text-red-800';
      case 'High': return 'bg-orange-100 text-orange-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Low': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Blocked': return 'bg-red-100 text-red-800';
      case 'In Progress': return 'bg-blue-100 text-blue-800';
      case 'To Do': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    const priorityOrder = { 'Urgent': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-3">
            <CheckSquare className="w-6 h-6 text-blue-600" />
            Pending Tasks ({tasks.length})
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {sortedTasks.length > 0 ? (
            sortedTasks.map((task) => {
              const isOverdue = task.dueDate && isPast(new Date(task.dueDate));
              
              return (
                <Card key={task.id} className={`hover:shadow-md transition-all ${
                  task.priority === 'Urgent' ? 'border-l-4 border-l-red-500' :
                  task.priority === 'High' ? 'border-l-4 border-l-orange-500' : ''
                }`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold text-gray-900">
                            {task.title}
                          </h4>
                          <Badge className={getPriorityColor(task.priority)}>
                            {task.priority}
                          </Badge>
                          <Badge className={getStatusColor(task.status)}>
                            {task.status}
                          </Badge>
                          {isOverdue && (
                            <Badge className="bg-red-100 text-red-800">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Overdue
                            </Badge>
                          )}
                        </div>

                        {task.description && (
                          <p className="text-sm text-gray-600 mb-2">{task.description}</p>
                        )}

                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          {task.dueDate && (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              <span>Due: {format(new Date(task.dueDate), 'MMM d, yyyy')}</span>
                            </div>
                          )}
                          <div>Assigned to: {task.assignedToName || task.assignedTo}</div>
                          <div>Tech: {task.technicianName}</div>
                        </div>
                      </div>

                      <div className="ml-4">
                        <Link to={createPageUrl(`ContractorProfile?id=${task.technicianId}`)}>
                          <Button size="sm" variant="outline">
                            View Tech
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <div className="text-center py-8 text-gray-500">
              <CheckSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No pending tasks</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Link to={createPageUrl('QCBoard')}>
            <Button>
              Go to QC Board
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}