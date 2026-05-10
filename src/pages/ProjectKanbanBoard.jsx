
import React, { useState, useMemo } from 'react';
import { User, Task, WorkersCompRecord, SafetyCertification } from '@/api/entities.js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { 
  Loader2, KanbanSquare, Search, Plus, Edit2, 
  AlertTriangle, CheckCircle, Clock, Users as UsersIcon,
  TrendingUp, Shield, UserCheck,
  ChevronDown, ChevronUp, Check
} from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Card, CardContent } from '@/components/ui/card.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isBefore, differenceInDays } from 'date-fns';
import TechnicianDetailsModal from '../components/kanban/TechnicianDetailsModal';
import AddTaskDialog from '../components/kanban/AddTaskDialog';

const adminEmails = ['austin@m2fleetcom.com', 'orville@m2fleetcom.com', 'lena@m2fleetcom.com'];

const getComplianceStatus = (tech, compliance) => {
  if (!tech || !compliance) return 'unknown';
  
  const wcRecord = compliance.wc.find(r => r.userEmail === tech.email);
  const certRecord = compliance.certs.find(r => r.userEmail === tech.email);

  if (!wcRecord || !certRecord) return 'critical';

  const today = new Date();
  const wcExpDate = wcRecord.expirationDate ? new Date(wcRecord.expirationDate) : null;
  const certExpDate = certRecord.expirationDate ? new Date(certRecord.expirationDate) : null;

  if ((wcExpDate && isBefore(wcExpDate, today)) || (certExpDate && isBefore(certExpDate, today))) {
    return 'critical';
  }

  if ((wcExpDate && differenceInDays(wcExpDate, today) <= 30) || 
      (certExpDate && differenceInDays(certExpDate, today) <= 30)) {
    return 'warning';
  }

  return 'good';
};

const ProjectHealthBadge = ({ health }) => {
  const configs = {
    excellent: { icon: CheckCircle, color: 'bg-green-100 text-green-800', label: 'Excellent' },
    good: { icon: TrendingUp, color: 'bg-blue-100 text-blue-800', label: 'Good' },
    warning: { icon: AlertTriangle, color: 'bg-yellow-100 text-yellow-800', label: 'Needs Attention' },
    critical: { icon: AlertTriangle, color: 'bg-red-100 text-red-800', label: 'Critical' }
  };
  
  const config = configs[health] || configs.warning;
  const Icon = config.icon;
  
  return (
    <Badge className={`${config.color} flex items-center gap-1`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  );
};

const TechnicianCard = ({ tech, tasks, compliance, onEdit, onAddTask, onUpdateTaskStatus, index }) => {
  const complianceStatus = getComplianceStatus(tech, compliance);
  const openTasks = tasks.filter(t => t.status !== 'Done');
  const isSunbelt = tech.project?.toLowerCase().includes('sunbelt');
  
  const statusConfig = {
    onboarding: { color: 'border-l-orange-500', label: 'Onboarding', icon: Clock },
    shadowing: { color: 'border-l-blue-500', label: 'Shadowing', icon: UserCheck },
    certifying: { color: 'border-l-purple-500', label: 'Certifying', icon: Shield },
    active: { color: 'border-l-green-500', label: 'Active', icon: CheckCircle },
    issues: { color: 'border-l-red-500', label: 'Issues', icon: AlertTriangle }
  };

  const getStatus = () => {
    if (complianceStatus === 'critical') return 'issues';
    if (isSunbelt) {
      if (tech.shadowingStatus === 'completed' && tech.sunbeltCertificationStatus === 'completed') return 'active';
      if (tech.shadowingStatus === 'completed') return 'certifying';
      if (tech.shadowingStatus === 'in_progress') return 'shadowing';
      return 'onboarding';
    }
    if (tech.shadowingStatus === 'completed') return 'active';
    if (tech.shadowingStatus === 'in_progress') return 'shadowing';
    return 'onboarding';
  };

  const status = getStatus();
  const StatusIcon = statusConfig[status].icon;

  const TaskItem = ({ task }) => (
    <div className="flex items-center justify-between text-xs py-1 border-t border-gray-100">
      <span className={`truncate ${task.status === 'Done' ? 'line-through text-gray-400' : 'text-gray-700'}`}>{task.title}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs">
            {task.status} <ChevronDown className="w-3 h-3 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onUpdateTaskStatus(task.id, 'To Do')}>To Do</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onUpdateTaskStatus(task.id, 'In Progress')}>In Progress</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onUpdateTaskStatus(task.id, 'Done')}>
             <Check className="w-4 h-4 mr-2" />
             Mark as Done
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <Draggable draggableId={tech.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`
            bg-white rounded-lg border-l-4 ${statusConfig[status].color}
            p-3 mb-2 hover:shadow-md transition-all cursor-grab active:cursor-grabbing
            ${snapshot.isDragging ? 'shadow-lg rotate-2' : ''}
          `}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-gray-900 truncate">
                {tech.displayName || tech.full_name}
              </div>
              <div className="text-xs text-gray-500 truncate">{tech.business || 'No Business'}</div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 ml-2"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(tech);
              }}
            >
              <Edit2 className="w-3 h-3" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-1 mb-2">
            <Badge variant="outline" className="text-xs flex items-center gap-1">
              <StatusIcon className="w-3 h-3" />
              {statusConfig[status].label}
            </Badge>
            
            {complianceStatus === 'critical' && (
              <Badge className="bg-red-100 text-red-800 text-xs">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Compliance
              </Badge>
            )}
            
            {complianceStatus === 'warning' && (
              <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                <Clock className="w-3 h-3 mr-1" />
                Expiring
              </Badge>
            )}
            
            {openTasks.length > 0 && (
              <Badge className="bg-blue-100 text-blue-800 text-xs">
                {openTasks.length} {openTasks.length === 1 ? 'Task' : 'Tasks'}
              </Badge>
            )}
          </div>
          
          {tasks.length > 0 && (
            <div className="space-y-1 mt-2 mb-2">
              {tasks.map(t => <TaskItem key={t.id} task={t} />)}
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-gray-600 border-t pt-2">
            <span className="flex items-center gap-1">
              <UsersIcon className="w-3 h-3" />
              {tech.m2PM || 'No PM'}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs px-2"
              onClick={(e) => {
                e.stopPropagation();
                onAddTask(tech);
              }}
            >
              <Plus className="w-3 h-3 mr-1" />
              Task
            </Button>
          </div>
        </div>
      )}
    </Draggable>
  );
};

const ProjectColumn = ({ 
  project, 
  technicians, 
  tasks, 
  compliance, 
  onEditTech, 
  onAddTask, 
  onUpdateTaskStatus,
  onEditProject,
  provided 
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  const projectHealth = useMemo(() => {
    if (technicians.length === 0) return 'good';
    
    const criticalCount = technicians.filter(t => 
      getComplianceStatus(t, compliance) === 'critical'
    ).length;
    
    const warningCount = technicians.filter(t => 
      getComplianceStatus(t, compliance) === 'warning'
    ).length;

    const criticalPercent = (criticalCount / technicians.length) * 100;
    const warningPercent = (warningCount / technicians.length) * 100;

    if (criticalPercent > 25) return 'critical';
    if (criticalPercent > 0 || warningPercent > 40) return 'warning';
    if (warningPercent > 0) return 'good';
    return 'excellent';
  }, [technicians, compliance]);

  const stats = useMemo(() => ({
    total: technicians.length,
    active: technicians.filter(t => t.shadowingStatus === 'completed').length,
    shadowing: technicians.filter(t => t.shadowingStatus === 'in_progress').length,
    onboarding: technicians.filter(t => !t.shadowingStatus || t.shadowingStatus === 'not_started').length,
    issues: technicians.filter(t => getComplianceStatus(t, compliance) === 'critical').length
  }), [technicians, compliance]);

  return (
    <div className="flex-shrink-0 w-80 bg-gray-50 rounded-lg p-4 border border-gray-200">
      {/* Project Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h3 className="font-bold text-lg text-gray-900 truncate">{project}</h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => onEditProject(project)}
            >
              <Edit2 className="w-3 h-3" />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-6 w-6 p-0"
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </Button>
        </div>
        
        <ProjectHealthBadge health={projectHealth} />
        
        <div className="grid grid-cols-4 gap-2 mt-3">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-xs text-gray-500">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            <div className="text-xs text-gray-500">Active</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.shadowing}</div>
            <div className="text-xs text-gray-500">Training</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{stats.issues}</div>
            <div className="text-xs text-gray-500">Issues</div>
          </div>
        </div>
      </div>

      {/* Technicians List */}
      {!isCollapsed && (
        <div
          ref={provided?.innerRef}
          {...provided?.droppableProps}
          className="space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto pr-2"
        >
          {technicians.length > 0 ? (
            technicians.map((tech, index) => (
              <TechnicianCard
                key={tech.id}
                tech={tech}
                tasks={tasks.filter(t => t.technicianId === tech.id)}
                compliance={compliance}
                onEdit={onEditTech}
                onAddTask={onAddTask}
                onUpdateTaskStatus={onUpdateTaskStatus}
                index={index}
              />
            ))
          ) : (
            <div className="text-center py-8 text-gray-400 text-sm">
              <UsersIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
              No technicians assigned
            </div>
          )}
          {provided?.placeholder}
        </div>
      )}
    </div>
  );
};

export default function ProjectKanbanBoard() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [complianceFilter, setComplianceFilter] = useState('all');
  const [selectedTechnician, setSelectedTechnician] = useState(null);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState(null);
  
  const queryClient = useQueryClient();

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => User.list(),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => Task.list(),
  });

  const { data: wcRecords = [] } = useQuery({
    queryKey: ['wcRecords'],
    queryFn: () => WorkersCompRecord.list(),
  });

  const { data: certRecords = [] } = useQuery({
    queryKey: ['certRecords'],
    queryFn: () => SafetyCertification.list(),
  });

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => User.me(),
  });

  const updateTechMutation = useMutation({
    mutationFn: ({ id, data }) => User.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }) => Task.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const compliance = useMemo(() => ({
    wc: wcRecords,
    certs: certRecords
  }), [wcRecords, certRecords]);

  const contractors = useMemo(() => {
    return users.filter(user =>
      user.active !== false &&
      user.email &&
      (user.email.toLowerCase().includes('.contractor@m2fleetcom.com') ||
       user.email.toLowerCase().includes('.contractor@smcinstallations.com'))
    );
  }, [users]);

  const filteredContractors = useMemo(() => {
    return contractors.filter(tech => {
      const searchMatch = !searchTerm || 
        (tech.displayName || tech.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (tech.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (tech.project || '').toLowerCase().includes(searchTerm.toLowerCase());

      const statusMatch = statusFilter === 'all' || 
        (statusFilter === 'active' && tech.shadowingStatus === 'completed') ||
        (statusFilter === 'shadowing' && tech.shadowingStatus === 'in_progress') ||
        (statusFilter === 'onboarding' && (!tech.shadowingStatus || tech.shadowingStatus === 'not_started'));

      const compStatus = getComplianceStatus(tech, compliance);
      const complianceMatch = complianceFilter === 'all' || 
        (complianceFilter === 'good' && compStatus === 'good') ||
        (complianceFilter === 'warning' && compStatus === 'warning') ||
        (complianceFilter === 'critical' && compStatus === 'critical');

      return searchMatch && statusMatch && complianceMatch;
    });
  }, [contractors, searchTerm, statusFilter, complianceFilter, compliance]);

  const projectGroups = useMemo(() => {
    const groups = {};
    
    filteredContractors.forEach(tech => {
      const project = tech.project || 'Unassigned';
      if (!groups[project]) {
        groups[project] = [];
      }
      groups[project].push(tech);
    });

    return Object.entries(groups).sort(([a], [b]) => {
      if (a === 'Unassigned') return 1;
      if (b === 'Unassigned') return -1;
      return a.localeCompare(b);
    });
  }, [filteredContractors]);

  const handleDragEnd = async (result) => {
    const { destination, source, draggableId } = result;

    if (!destination || (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    )) {
      return;
    }

    const newProject = destination.droppableId === 'Unassigned' ? null : destination.droppableId;
    
    try {
      await updateTechMutation.mutateAsync({
        id: draggableId,
        data: { project: newProject }
      });
    } catch (error) {
      console.error('Error updating technician project:', error);
    }
  };

  const handleUpdateTaskStatus = async (taskId, status) => {
    updateTaskMutation.mutate({ id: taskId, data: { status } });
  };

  const handleProjectRename = async (oldName, newName) => {
    if (!newName.trim() || oldName === newName) return;

    try {
      const techsToUpdate = contractors.filter(t => t.project === oldName);
      await Promise.all(
        techsToUpdate.map(tech => 
          User.update(tech.id, { project: newName.trim() })
        )
      );
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setProjectToEdit(null);
    } catch (error) {
      console.error('Error renaming project:', error);
    }
  };

  const isUserAdmin = currentUser && adminEmails.includes(currentUser.email);

  if (usersLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-gray-50 to-blue-50/30 p-6">
      {/* Header */}
      <div className="flex-shrink-0 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <KanbanSquare className="w-8 h-8" />
              Project Kanban Board
            </h1>
            <p className="text-gray-600 mt-1">Drag technicians between projects to reassign</p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="grid md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Search technicians..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="shadowing">Shadowing</SelectItem>
                  <SelectItem value="onboarding">Onboarding</SelectItem>
                </SelectContent>
              </Select>

              <Select value={complianceFilter} onValueChange={setComplianceFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by compliance" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Compliance</SelectItem>
                  <SelectItem value="good">Compliant</SelectItem>
                  <SelectItem value="warning">Expiring Soon</SelectItem>
                  <SelectItem value="critical">Critical Issues</SelectItem>
                </SelectContent>
              </Select>

              <div className="text-sm text-gray-600 flex items-center justify-end">
                <span className="font-semibold">{filteredContractors.length}</span>
                <span className="ml-1">technicians across</span>
                <span className="font-semibold ml-1">{projectGroups.length}</span>
                <span className="ml-1">projects</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-4 pb-4 min-h-full">
            {projectGroups.map(([project, techs]) => (
              <Droppable droppableId={project} key={project}>
                {(provided) => (
                  <ProjectColumn
                    project={project}
                    technicians={techs}
                    tasks={tasks}
                    compliance={compliance}
                    onEditTech={(tech) => {
                      setSelectedTechnician(tech);
                      setIsDetailsModalOpen(true);
                    }}
                    onAddTask={(tech) => {
                      setSelectedTechnician(tech);
                      setIsTaskDialogOpen(true);
                    }}
                    onUpdateTaskStatus={handleUpdateTaskStatus}
                    onEditProject={(name) => setProjectToEdit(name)}
                    provided={provided}
                  />
                )}
              </Droppable>
            ))}
          </div>
        </div>
      </DragDropContext>

      {/* Dialogs */}
      {isUserAdmin && selectedTechnician && (
        <>
          <AddTaskDialog
            isOpen={isTaskDialogOpen}
            onClose={() => setIsTaskDialogOpen(false)}
            technician={selectedTechnician}
            currentUser={currentUser}
            onTaskAdded={() => queryClient.invalidateQueries({ queryKey: ['tasks'] })}
          />
          
          <TechnicianDetailsModal
            isOpen={isDetailsModalOpen}
            onClose={() => setIsDetailsModalOpen(false)}
            technician={selectedTechnician}
            onUpdate={() => queryClient.invalidateQueries({ queryKey: ['users'] })}
          />
        </>
      )}
    </div>
  );
}
