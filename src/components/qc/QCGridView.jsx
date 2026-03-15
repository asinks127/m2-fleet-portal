import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx';
import { Phone, MessageSquarePlus, Edit2, Users, ChevronDown, ChevronRight, Eye, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

export default function QCGridView({ 
  groupedTechnicians, 
  onUpdate, 
  onOpenInspection, 
  onOpenCallLog, 
  onViewDetails,
  onProjectEdit,
  collapsedProjects,
  onToggleCollapse,
  isManagerView = false,
  onDelete
}) {
  const getRowStyle = (technician) => {
    // Score Logic
    let qcScore = 0;
    
    if (isManagerView) {
        qcScore = technician.managerAvgQcScore || 0;
    } else {
        qcScore = technician.avgQcScore || 0;
    }

    if (qcScore === 0 && (technician.lastContacted || technician.managerLastContacted)) {
        // Red critical if score is 0 (and active?) - Prompt says "If Project Score == 0". 
        // Assuming user score for now.
        return 'bg-red-50 hover:bg-red-100 border-l-4 border-red-500';
    }
    if (qcScore < 50) return 'bg-yellow-50 hover:bg-yellow-100 border-l-4 border-yellow-500'; // Threshold from prompt
    
    return 'hover:bg-gray-50 border-l-4 border-transparent';
  };

  const ScoreBadge = ({ score }) => {
    const num = Number(score) || 0;
    let color = 'bg-gray-100 text-gray-800';
    if (num >= 90) color = 'bg-green-100 text-green-800';
    else if (num >= 70) color = 'bg-yellow-100 text-yellow-800';
    else color = 'bg-red-100 text-red-800';
    
    return <Badge className={color}>{num}</Badge>;
  };

  if (Object.keys(groupedTechnicians).length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white rounded-lg shadow-sm py-12">
        <div className="text-center text-gray-500">
          <Users className="w-12 h-12 mx-auto mb-2"/>
          <p>No records found for the selected filters.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 overflow-y-auto">
      {Object.entries(groupedTechnicians).sort(([a], [b]) => a.localeCompare(b)).map(([project, techs]) => {
        const isCollapsed = collapsedProjects.has(project);
        
        return (
          <div key={project} className="bg-white rounded-lg border shadow-sm overflow-hidden">
            <div 
              className="bg-gray-50 px-4 py-3 flex justify-between items-center border-b cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => onToggleCollapse(project)}
            >
              <div className="flex items-center gap-2">
                {isCollapsed ? <ChevronRight className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                <h3 className="font-semibold text-gray-800">{project}</h3>
                <Badge variant="secondary" className="ml-2 text-xs">{techs.length}</Badge>
              </div>
              {onProjectEdit && !isManagerView && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); onProjectEdit(project); }}
                  className="h-6 text-xs text-gray-500"
                >
                  <Edit2 className="w-3 h-3 mr-1" /> Edit
                </Button>
              )}
            </div>
            
            {!isCollapsed && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[250px]">Name</TableHead>
                      {!isManagerView && <TableHead>Location</TableHead>}
                      <TableHead>{isManagerView ? 'Role' : 'QC Assignment'}</TableHead>
                      {!isManagerView && <TableHead>Velociti Score</TableHead>}
                      <TableHead>QC Score</TableHead>
                      <TableHead>Last Contacted</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {techs.map((tech) => (
                      <TableRow key={tech.id} className={getRowStyle(tech)}>
                        <TableCell className="font-medium">
                          <div>
                             {tech.displayName || tech.full_name}
                             <div className="text-xs text-gray-500">{tech.email}</div>
                          </div>
                        </TableCell>
                        {!isManagerView && <TableCell>{tech.location || '-'}</TableCell>}
                        <TableCell>
                            {isManagerView ? (
                                <Badge variant="outline">{tech.role || 'Manager'}</Badge>
                            ) : (
                                tech.qcAssignment || '-'
                            )}
                        </TableCell>
                        {!isManagerView && (
                            <TableCell>
                              <ScoreBadge score={tech.velocitiScore} />
                            </TableCell>
                        )}
                        <TableCell>
                          <ScoreBadge score={isManagerView ? tech.managerAvgQcScore : tech.avgQcScore} />
                        </TableCell>
                        <TableCell>
                          {isManagerView ? (
                              tech.managerLastContacted ? format(new Date(tech.managerLastContacted), 'MMM d, yyyy') : '-'
                          ) : (
                              tech.lastContacted ? format(new Date(tech.lastContacted), 'MMM d, yyyy') : '-'
                          )}
                          <div className="text-xs text-gray-400">
                             by {isManagerView ? tech.managerLastContactedBy : tech.lastContactedBy}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {!isManagerView && (
                                <Button variant="ghost" size="icon" onClick={() => onViewDetails(tech)} title="View Details">
                                  <Eye className="w-4 h-4 text-gray-500" />
                                </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => onOpenCallLog(tech)} title="Log Call">
                              <Phone className="w-4 h-4 text-blue-600" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => onOpenInspection(tech)} title="QC Inspection">
                              <MessageSquarePlus className="w-4 h-4 text-green-600" />
                            </Button>
                            {isManagerView && tech.type === 'external_manager' && onDelete && (
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => {
                                        if(window.confirm(`Are you sure you want to delete ${tech.displayName}?`)) {
                                            onDelete(tech);
                                        }
                                    }} 
                                    title="Delete Manager"
                                >
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}