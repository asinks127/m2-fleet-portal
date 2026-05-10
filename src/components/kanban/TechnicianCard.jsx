
import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Card, CardContent } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { User, Calendar, Shield, ClipboardList, PlusCircle, UserCheck, Edit, Award } from 'lucide-react';
import { differenceInDays, isBefore } from 'date-fns';

const CompactBadge = ({ children, className }) => (
  <div className={`px-1.5 py-0.5 rounded text-xs font-medium ${className}`}>
    {children}
  </div>
);

export default function TechnicianCard({ technician, index, tasks, compliance, onAddTask, onEditTechnician, isUserAdmin, compact = false }) {
  const handleCardClick = (e) => {
    if (e.target.closest('button')) return;
    if (onEditTechnician) {
      onEditTechnician(technician);
    }
  };

  // Compact version for the swim lane layout
  if (compact) {
    const wcRecord = compliance.wc.find(r => r.userEmail === technician.email);
    const certRecord = compliance.certs.find(r => r.userEmail === technician.email);
    const hasComplianceIssues = !wcRecord || !certRecord || 
      (wcRecord && isBefore(new Date(wcRecord.expirationDate), new Date())) ||
      (certRecord && isBefore(new Date(certRecord.expirationDate), new Date()));

    const contractEnding = technician.endDate && 
      differenceInDays(new Date(technician.endDate), new Date()) <= 30;
      
    const isSunbeltProject = technician.project && technician.project.toLowerCase().includes('sunbelt');

    return (
      <Draggable draggableId={technician.id} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className={`cursor-pointer ${snapshot.isDragging ? 'opacity-75' : ''}`}
            onClick={handleCardClick}
          >
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-2">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {(technician.displayName || technician.full_name || 'U')[0].toUpperCase()}
                    </div>
                    <span className="font-medium text-sm truncate">{technician.displayName || technician.full_name}</span>
                  </div>
                  {isUserAdmin && <Edit className="w-3 h-3 text-gray-400 ml-1" />}
                </div>
                
                <div className="flex flex-wrap gap-1 mb-1">
                  {contractEnding && (
                    <CompactBadge className="bg-red-100 text-red-700">Contract Ending</CompactBadge>
                  )}
                  {hasComplianceIssues && (
                    <CompactBadge className="bg-yellow-100 text-yellow-700">Compliance</CompactBadge>
                  )}
                  {isSunbeltProject && technician.sunbeltCertificationStatus === 'in_progress' && (
                    <CompactBadge className="bg-purple-100 text-purple-700">Sunbelt Cert</CompactBadge>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{tasks.filter(t => t.status !== 'Done').length} tasks</span>
                  {isUserAdmin && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-5 px-1 text-xs" 
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddTask();
                      }}
                    >
                      <PlusCircle className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </Draggable>
    );
  }

  // Full version for other layouts (keeping existing code for compatibility)
  const ComplianceBadge = ({ technician, compliance }) => {
    const wcRecord = compliance.wc.find(r => r.userEmail === technician.email);
    const certRecord = compliance.certs.find(r => r.userEmail === technician.email);

    if (!wcRecord || !certRecord) {
      return <Badge variant="destructive" className="flex items-center gap-1"><Shield className="w-3 h-3" /> Missing Docs</Badge>;
    }

    const today = new Date();
    const wcExp = new Date(wcRecord.expirationDate);
    const certExp = new Date(certRecord.expirationDate);

    if (isBefore(wcExp, today) || isBefore(certExp, today)) {
      return <Badge variant="destructive" className="flex items-center gap-1"><Shield className="w-3 h-3" /> Expired</Badge>;
    }

    if (differenceInDays(wcExp, today) <= 30 || differenceInDays(certExp, today) <= 30) {
      return <Badge variant="secondary" className="flex items-center gap-1 bg-yellow-100 text-yellow-800"><Shield className="w-3 h-3" /> Expiring Soon</Badge>;
    }

    return <Badge className="flex items-center gap-1 bg-green-100 text-green-800"><Shield className="w-3 h-3" /> Compliant</Badge>;
  };

  const ContractEndBadge = ({ endDate }) => {
    if (!endDate) return null;

    const daysLeft = differenceInDays(new Date(endDate), new Date());

    if (daysLeft < 0) {
      return <Badge variant="destructive" className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Contract Ended</Badge>;
    }
    if (daysLeft <= 30) {
      return <Badge variant="secondary" className="flex items-center gap-1 bg-yellow-100 text-yellow-800"><Calendar className="w-3 h-3" /> Ends in {daysLeft}d</Badge>;
    }
    return null;
  };

  const ShadowingBadge = ({ status }) => {
    if (!status || status === 'completed') return null;

    const statusMap = {
      'not_started': { label: 'Shadowing Not Started', color: 'bg-gray-200 text-gray-800' },
      'in_progress': { label: 'Shadowing In Progress', color: 'bg-blue-100 text-blue-800' },
      'failed': { label: 'Shadowing Failed', color: 'bg-red-100 text-red-800' }
    };
    const { label, color } = statusMap[status] || {};
    if (!label) return null;

    return <Badge className={`flex items-center gap-1 ${color}`}><UserCheck className="w-3 h-3" /> {label}</Badge>;
  };

  const SunbeltCertificationBadge = ({ status, technician }) => {
    const isSunbeltProject = technician.project && technician.project.toLowerCase().includes('sunbelt');
    if (!isSunbeltProject || !status || status === 'not_required' || status === 'completed') return null;

    const statusMap = {
      'not_started': { label: 'Sunbelt Cert Needed', color: 'bg-orange-100 text-orange-800' },
      'in_progress': { label: 'Sunbelt Cert In Progress', color: 'bg-purple-100 text-purple-800' },
      'failed': { label: 'Sunbelt Cert Failed', color: 'bg-red-100 text-red-800' }
    };
    const { label, color } = statusMap[status] || {};
    if (!label) return null;

    return <Badge className={`flex items-center gap-1 ${color}`}><Award className="w-3 h-3" /> {label}</Badge>;
  };

  const ProjectCertificationBadge = ({ technician }) => {
    if (technician.projectCertifications && technician.projectCertifications.length > 0) {
      return <Badge className="flex items-center gap-1 bg-purple-100 text-purple-800"><Shield className="w-3 h-3" /> Project Certs ({technician.projectCertifications.length})</Badge>;
    }
    return null;
  };

  return (
    <Draggable draggableId={technician.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`transition-shadow cursor-pointer ${snapshot.isDragging ? 'shadow-lg' : 'shadow-md'}`}
          onClick={handleCardClick}
        >
          <Card className="hover:bg-gray-50">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-500" />
                  <span className="font-semibold text-gray-800">{technician.displayName || technician.full_name}</span>
                </div>
                {isUserAdmin && (
                  <Edit className="w-3 h-3 text-gray-400" />
                )}
              </div>
              
              <div className="flex flex-wrap gap-1 text-xs">
                <ContractEndBadge endDate={technician.endDate} />
                <ComplianceBadge technician={technician} compliance={compliance} />
                <ShadowingBadge status={technician.shadowingStatus} />
                <SunbeltCertificationBadge status={technician.sunbeltCertificationStatus} technician={technician} />
                <ProjectCertificationBadge technician={technician} />
              </div>

              <div className="border-t pt-2 mt-2 flex items-center justify-between">
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <ClipboardList className="w-4 h-4" />
                  <span>{tasks.filter(t => t.status !== 'Done').length} Open Tasks</span>
                </div>
                {isUserAdmin && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-auto p-1" 
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddTask();
                    }}
                  >
                    <PlusCircle className="w-4 h-4 mr-1" />
                    Add Task
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </Draggable>
  );
}
