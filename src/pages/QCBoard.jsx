import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { User } from '@/api/entities.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Loader2, Users, Grid3x3, Columns } from 'lucide-react';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import BoardColumn from '../components/qc/BoardColumn';
import QCGridView from '../components/qc/QCGridView';
import QCInspectionDialog from '../components/qc/QCInspectionDialog';
import CallLogDialog from '../components/qc/CallLogDialog';
import QCTechnicianDetailsModal from '../components/qc/QCTechnicianDetailsModal';
import ProjectEditDialog from '../components/qc/ProjectEditDialog';
import AddManagerDialog from '../components/qc/AddManagerDialog';
import { supabase } from '@/lib/supabaseClient.js';
import { Plus } from 'lucide-react';

export default function QCBoard() {
  const [technicians, setTechnicians] = useState([]);
  const [qcList, setQcList] = useState(['Ryan Miller', 'Chance Hoffman']);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedQc, setSelectedQc] = useState('all');
  const [selectedProject, setSelectedProject] = useState('all'); // NEW: Project filter
  const [currentUser, setCurrentUser] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [collapsedProjects, setCollapsedProjects] = useState(new Set()); // NEW: Track collapsed projects
  const [projectEditDialog, setProjectEditDialog] = useState({ open: false, oldName: '', newName: '' });
  
  // State for dialogs
  const [selectedTechnician, setSelectedTechnician] = useState(null);
  const [isInspectionDialogOpen, setIsInspectionDialogOpen] = useState(false);
  const [isCallLogDialogOpen, setIsCallLogDialogOpen] = useState(false);
  const [showTechnicianDetails, setShowTechnicianDetails] = useState(false);
  const [boardType, setBoardType] = useState('technician'); // 'technician' or 'manager'
  const [allUsers, setAllUsers] = useState([]); // Store all users to filter locally
  const [isAddManagerDialogOpen, setIsAddManagerDialogOpen] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await (await fetch('/api/getQcBoardData', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })).json();
      const { users, currentUser: me } = response.data;
      setCurrentUser(me);
      setAllUsers(users); // Store raw list
      
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);
  
  const handleOpenInspection = (technician) => {
    setSelectedTechnician(technician);
    setIsInspectionDialogOpen(true);
  };
  
  const handleOpenCallLog = (technician) => {
    setSelectedTechnician(technician);
    setIsCallLogDialogOpen(true);
  };

  const handleViewTechnicianDetails = (technician) => {
    setSelectedTechnician(technician);
    setShowTechnicianDetails(true);
  };

  const handleDragEnd = async (result) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    const newProject = destination.droppableId.replace('project-', '');
    const technicianId = draggableId;

    try {
      setIsLoading(true); // Show loading indicator during update
      
      // If moving to 'Unassigned Project', set project field to null for cleaner data
      const projectUpdate = newProject === 'Unassigned Project' ? null : newProject;
      
      await User.update(technicianId, { project: projectUpdate });
      
      // Reload data from server to ensure change is persisted and reflected
      await loadData();
    } catch (error) {
      console.error('Error updating technician project:', error);
      // In case of error, reload data to revert to original state
      await loadData();
    }
  };

  const handleProjectEdit = (oldProjectName) => {
    setProjectEditDialog({ open: true, oldName: oldProjectName, newName: oldProjectName });
  };

  const handleProjectRename = async (oldName, newName) => {
    if (oldName === newName || !newName.trim()) return;

    try {
      // Find all technicians with the old project name
      const techsToUpdate = technicians.filter(tech => tech.project === oldName);
      
      // Update all technicians with the new project name
      await Promise.all(
        techsToUpdate.map(tech => 
          User.update(tech.id, { project: newName.trim() })
        )
      );

      // Refresh the data to show changes
      await loadData();
      setProjectEditDialog({ open: false, oldName: '', newName: '' });
    } catch (error) {
      console.error('Error renaming project:', error);
    }
  };

  const handleDeleteManager = async (manager) => {
    try {
        await (await supabase.from('ExternalManager').delete().eq('id', manager.id));
        loadData();
    } catch (error) {
        console.error('Error deleting manager:', error);
    }
  };

  const filteredData = useMemo(() => {
    if (!allUsers.length) return [];

    let data = [];
    if (boardType === 'technician') {
        data = allUsers.filter(user => 
            user.email && (
              user.email.toLowerCase().includes('.contractor@m2fleetcom.com') ||
              user.email.toLowerCase().includes('.contractor@smcinstallations.com')
            ) && 
            !['rmiller.contractor@m2fleetcom.com', 'choffman.contractor@m2fleetcom.com'].includes(user.email.toLowerCase()) &&
            user.active !== false
        );
    } else {
        // Manager Logic
        const contractorEmails = ['.contractor@m2fleetcom.com', '.contractor@smcinstallations.com'];
        const qcEmails = ['rmiller.contractor@m2fleetcom.com', 'choffman.contractor@m2fleetcom.com'];
        
        data = allUsers.filter(user => {
            // Include explicitly marked external managers
            if (user.type === 'external_manager') return true;

            const email = user.email?.toLowerCase() || '';
            const isContractor = contractorEmails.some(d => email.includes(d));
            const isQC = qcEmails.includes(email);
            return !isContractor && !isQC && user.active !== false;
        });
    }

    // Filter by QC assignment (only for techs usually, but keeps logic consistent)
    if (selectedQc !== 'all' && boardType === 'technician') {
        data = data.filter(t => t.qcAssignment === selectedQc);
    }

    // Filter by project
    if (selectedProject !== 'all') {
        data = data.filter(t => t.project === selectedProject);
    }

    return data;
  }, [allUsers, boardType, selectedQc, selectedProject]);

  const groupedTechnicians = useMemo(() => {
    return filteredData.reduce((groups, tech) => {
      const key = tech.project || 'Unassigned';
      if (!groups[key]) groups[key] = [];
      groups[key].push(tech);
      return groups;
    }, {});
  }, [filteredData]);

  // Get list of unique projects for filter
  const availableProjects = useMemo(() => {
    const projects = new Set();
    filteredData.forEach(tech => {
      projects.add(tech.project || 'Unassigned');
    });
    return Array.from(projects).sort();
  }, [filteredData]);

  // NEW: Handle project collapse/expand
  const toggleProjectCollapse = (projectName) => {
    setCollapsedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectName)) {
        newSet.delete(projectName);
      } else {
        newSet.add(projectName);
      }
      return newSet;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }
  
  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="h-full bg-gray-50 flex flex-col p-6">
        <div className="flex-shrink-0 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">QC Technician Board</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-white rounded-lg p-1 border">
                  <Button 
                    variant={boardType === 'technician' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setBoardType('technician')}
                  >
                    Technicians
                  </Button>
                  <Button 
                    variant={boardType === 'manager' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setBoardType('manager')}
                  >
                    Managers
                  </Button>
              </div>
              
              {/* View Mode Toggle (Keeping it if user still wants columns for technicians) */}
              <div className="flex items-center gap-2 bg-white rounded-lg p-1 border">
                <Button
                  variant={viewMode === 'columns' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('columns')}
                  className="flex items-center gap-2"
                >
                  <Columns className="w-4 h-4" />
                  Columns
                </Button>
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="flex items-center gap-2"
                >
                  <Grid3x3 className="w-4 h-4" />
                  Grid
                </Button>
              </div>
            </div>
          </div>
          
          <div className="mt-4 flex flex-col sm:flex-row gap-4">
            {boardType === 'technician' && (
                <div>
                  <Label htmlFor="qc-filter" className="text-sm font-medium text-gray-700">Filter by QC Manager</Label>
                  <Select value={selectedQc} onValueChange={setSelectedQc}>
                    <SelectTrigger id="qc-filter" className="w-64 bg-white mt-1">
                      <SelectValue placeholder="Filter by QC..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Technicians</SelectItem>
                      <SelectItem value="Ryan Miller">Ryan Miller</SelectItem>
                      <SelectItem value="Chance Hoffman">Chance Hoffman</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
            )}
            
            {/* NEW: Project Filter */}
            <div>
              <Label htmlFor="project-filter" className="text-sm font-medium text-gray-700">Filter by Project</Label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger id="project-filter" className="w-64 bg-white mt-1">
                  <SelectValue placeholder="Filter by Project..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {availableProjects.map(project => (
                    <SelectItem key={project} value={project}>{project}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {boardType === 'manager' && (
              <div className="mt-4 flex justify-end">
                <Button onClick={() => setIsAddManagerDialogOpen(true)} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                    <Plus className="w-4 h-4" /> Add Manager
                </Button>
              </div>
          )}
        </div>

        {(viewMode === 'grid' || boardType === 'manager') ? (
          <QCGridView 
            groupedTechnicians={groupedTechnicians}
            onUpdate={loadData}
            onOpenInspection={handleOpenInspection}
            onOpenCallLog={handleOpenCallLog}
            onViewDetails={handleViewTechnicianDetails}
            onProjectEdit={handleProjectEdit}
            collapsedProjects={collapsedProjects}
            onToggleCollapse={toggleProjectCollapse}
            isManagerView={boardType === 'manager'}
            onDelete={handleDeleteManager}
          />
        ) : (
          <div className="flex-1 flex gap-6 overflow-x-auto pb-4">
            {Object.keys(groupedTechnicians).length > 0 ? (
              Object.entries(groupedTechnicians).sort(([a], [b]) => a.localeCompare(b)).map(([project, techs]) => (
                <Droppable droppableId={`project-${project}`} key={project}>
                  {(provided, snapshot) => (
                    <BoardColumn
                      key={project}
                      title={`Project: ${project}`}
                      technicians={techs}
                      onUpdate={loadData}
                      onOpenInspection={handleOpenInspection}
                      onOpenCallLog={handleOpenCallLog}
                      onViewDetails={handleViewTechnicianDetails}
                      onProjectEdit={() => handleProjectEdit(project)}
                      provided={provided}
                      isDraggingOver={snapshot.isDraggingOver}
                    />
                  )}
                </Droppable>
              ))
            ) : (
              <div className="flex-1 flex items-center justify-center bg-white rounded-lg shadow-sm">
                <div className="text-center text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-2"/>
                    <p>No technicians found for the selected filters.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Dialogs */}
        {selectedTechnician && (
          <>
            <QCInspectionDialog
              isOpen={isInspectionDialogOpen}
              onClose={() => setIsInspectionDialogOpen(false)}
              technician={selectedTechnician}
              onSuccess={() => {
                setIsInspectionDialogOpen(false);
                loadData();
              }}
              entityType={boardType === 'manager' ? 'ManagerQCInspection' : 'QCInspection'}
              idField={boardType === 'manager' ? 'managerId' : 'technicianId'}
            />
            <CallLogDialog
              isOpen={isCallLogDialogOpen}
              onClose={() => setIsCallLogDialogOpen(false)}
              technician={selectedTechnician}
              onSuccess={() => {
                setIsCallLogDialogOpen(false);
                loadData();
              }}
              entityType={boardType === 'manager' ? 'ManagerCallLog' : 'CallLog'}
              idField={boardType === 'manager' ? 'managerId' : 'technicianId'}
            />
          </>
        )}

        {/* New Technician Details Modal */}
        {selectedTechnician && (
          <QCTechnicianDetailsModal
            technician={selectedTechnician}
            isOpen={showTechnicianDetails}
            onClose={() => setShowTechnicianDetails(false)}
            onLogCall={(tech) => {
              setShowTechnicianDetails(false);
              handleOpenCallLog(tech);
            }}
            onRecordInspection={(tech) => {
              setShowTechnicianDetails(false);
              handleOpenInspection(tech);
            }}
          />
        )}

        {/* Project Edit Dialog */}
        <ProjectEditDialog
          isOpen={projectEditDialog.open}
          oldName={projectEditDialog.oldName}
          newName={projectEditDialog.newName}
          onNameChange={(newName) => setProjectEditDialog(prev => ({ ...prev, newName }))}
          onSave={() => handleProjectRename(projectEditDialog.oldName, projectEditDialog.newName)}
          onCancel={() => setProjectEditDialog({ open: false, oldName: '', newName: '' })}
        />
        
        <AddManagerDialog 
            isOpen={isAddManagerDialogOpen}
            onClose={() => setIsAddManagerDialogOpen(false)}
            onSuccess={() => {
                loadData();
                setIsAddManagerDialogOpen(false);
            }}
        />
      </div>
    </DragDropContext>
  );
}