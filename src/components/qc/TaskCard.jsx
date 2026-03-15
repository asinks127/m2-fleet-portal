import React from 'react';
import { User } from '@/api/entities.js';
import { Card, CardContent } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Phone, MessageSquarePlus, Star, GripVertical } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils/index.js';
import { Draggable } from '@hello-pangea/dnd';
import { format } from 'date-fns';

export default function TaskCard({ technician, onOpenCallLog, onOpenInspection, onViewDetails, index }) {

  const ScoreBadge = ({ score, type }) => {
    const numScore = Number(score) || 0;
    let color = 'bg-gray-100 text-gray-800';
    if (type === 'velociti') {
      if (numScore >= 90) color = 'bg-green-100 text-green-800';
      else if (numScore >= 70) color = 'bg-yellow-100 text-yellow-800';
      else color = 'bg-red-100 text-red-800';
    } else { // QC Score
      if (numScore >= 95) color = 'bg-green-100 text-green-800';
      else if (numScore >= 85) color = 'bg-yellow-100 text-yellow-800';
      else color = 'bg-red-100 text-red-800';
    }
    return <Badge className={color}>{numScore}</Badge>;
  };
  
  return (
    <Draggable draggableId={technician.id} index={index}>
      {(provided, snapshot) => (
        <Card 
          className={`mb-3 bg-white shadow-sm hover:shadow-md transition-shadow ${snapshot.isDragging ? 'rotate-2 shadow-lg ring-2 ring-blue-400' : ''}`}
          ref={provided.innerRef}
          {...provided.draggableProps}
        >
          <CardContent className="p-3">
            <div className="flex justify-between items-start">
              <div className="flex items-start gap-2 flex-1">
                <div 
                  {...provided.dragHandleProps}
                  className="mt-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
                >
                  <GripVertical className="w-4 h-4" />
                </div>
                <button 
                  onClick={() => onViewDetails(technician)}
                  className="text-left hover:text-blue-600 transition-colors flex-1"
                >
                  <p className="font-semibold text-sm text-gray-900 hover:text-blue-600">
                    {technician.displayName || technician.full_name}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {technician.project || 'No project assigned'}
                  </p>
                  <div className={`mt-2 text-xs p-1.5 rounded border ${technician.lastContacted ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-gray-50 border-gray-100 text-gray-500'}`}>
                      <div className="font-medium mb-0.5">Last Contacted:</div>
                      {technician.lastContacted ? (
                        <span>
                          {format(new Date(technician.lastContacted), 'MMM d')} by {technician.lastContactedBy?.split('@')[0]}
                        </span>
                      ) : (
                        <span className="italic">No contact logged</span>
                      )}
                  </div>
                </button>
              </div>
              <div className="flex items-center space-x-2 text-xs">
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-yellow-500"/>
                    <ScoreBadge score={technician.velocitiScore || 0} type="velociti" />
                  </div>
                  <ScoreBadge score={technician.avgQcScore || 0} type="qc" />
              </div>
            </div>

            <div className="mt-3 flex justify-end space-x-2">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onOpenCallLog(technician)}>
                <Phone className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onOpenInspection(technician)}>
                <MessageSquarePlus className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </Draggable>
  );
}