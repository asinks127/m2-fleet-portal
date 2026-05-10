import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { PlusCircle, User, Users } from 'lucide-react';
import { format } from 'date-fns';

export default function DayEventsDialog({ isOpen, onClose, date, events, onCreate, onEdit, calendarUsers }) {

  const getParticipantNames = (participantIds) => {
    if (!participantIds || participantIds.length === 0) return 'No participants';
    return participantIds.map(id => {
      const user = calendarUsers.find(u => u.id === id);
      return user?.displayName || user?.full_name || 'Unknown';
    }).join(', ');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Events for {format(date, 'MMMM d, yyyy')}</DialogTitle>
          <DialogDescription>
            Viewing all scheduled events for this day. You can edit an event by clicking on it.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 max-h-[60vh] overflow-y-auto pr-2 space-y-3">
          {events.length > 0 ? (
            events.map(event => (
              <div 
                key={event.id}
                onClick={() => event.isEditable && onEdit(event.data)}
                className={`p-3 rounded-lg border flex flex-col gap-2 ${event.isEditable ? 'cursor-pointer hover:bg-gray-50' : ''}`}
              >
                <div className="flex justify-between items-start">
                  <h4 className="font-semibold">{event.title}</h4>
                  <Badge variant="secondary" className={event.color}>{event.type}</Badge>
                </div>
                {/* Fixed: Added null check for event.data */}
                {event.data?.description && <p className="text-sm text-gray-600">{event.data.description}</p>}
                {event.type === 'custom' && event.data?.participantIds && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    {event.data.participantIds.length > 1 ? <Users className="w-4 h-4" /> : <User className="w-4 h-4" />}
                    <span>{getParticipantNames(event.data.participantIds)}</span>
                  </div>
                )}
                {event.type !== 'custom' && event.contractor && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <User className="w-4 h-4" />
                        <span>{event.contractor.displayName || event.contractor.full_name}</span>
                    </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-center text-gray-500 py-8">No events scheduled for this day.</p>
          )}
        </div>
        <DialogFooter>
          <Button onClick={onCreate}>
            <PlusCircle className="w-4 h-4 mr-2" />
            Create New Event
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}