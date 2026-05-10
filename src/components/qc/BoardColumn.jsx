
import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button.jsx';
import { Edit2 } from 'lucide-react';
import TaskCard from './TaskCard';

const getTechnicianStatus = (technician) => {
  const qcScore = technician.avgQcScore || 0;
  const velocitiScore = technician.velocitiScore || 100;
  
  if (qcScore < 75 || velocitiScore < 70) return 'red';
  if (qcScore < 85 || velocitiScore < 80) return 'yellow';
  return 'green';
};

const getProjectStatusColor = (technicians, isDraggingOver) => {
  if (isDraggingOver) return 'bg-blue-100 border-blue-300';
  
  const statuses = technicians.map(getTechnicianStatus);

  if (statuses.includes('red')) return 'bg-red-100';
  if (statuses.includes('yellow')) return 'bg-yellow-100';
  if (technicians.length > 0 && statuses.every(s => s === 'green')) return 'bg-green-100';
  return 'bg-gray-100';
};

export default function BoardColumn({ 
  title, 
  technicians, 
  onUpdate, 
  onOpenInspection, 
  onOpenCallLog, 
  onViewDetails,
  onProjectEdit,
  provided,
  isDraggingOver
}) {
  const columnColor = getProjectStatusColor(technicians, isDraggingOver);

  return (
    <div 
      className={`flex-shrink-0 w-80 rounded-lg transition-all duration-300 ${columnColor} ${isDraggingOver ? 'ring-2 ring-blue-400' : ''}`}
      ref={provided?.innerRef}
      {...provided?.droppableProps}
    >
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
          <p className="text-sm text-gray-500">{technicians.length} Technicians</p>
          {isDraggingOver && (
            <p className="text-xs text-blue-600 mt-1">Drop to move technician to this project</p>
          )}
        </div>
        {onProjectEdit && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onProjectEdit}
            className="text-gray-500 hover:text-gray-700"
          >
            <Edit2 className="w-4 h-4" />
          </Button>
        )}
      </div>
      <motion.div
        layout
        className="p-4 space-y-4 overflow-y-auto h-[calc(100%-80px)]"
      >
        {technicians.map((tech, index) => (
          <TaskCard
            key={tech.id}
            technician={tech}
            onOpenInspection={onOpenInspection}
            onOpenCallLog={onOpenCallLog}
            onViewDetails={onViewDetails}
            index={index}
          />
        ))}
        {provided?.placeholder}
      </motion.div>
    </div>
  );
}
