import React, { useState, useEffect } from 'react';
import { CalendarEvent } from '@/api/entities.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { Loader2, Trash2, Check } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.jsx';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command.jsx';
import { Badge } from '@/components/ui/badge.jsx';

export default function CalendarEventDialog({ isOpen, onClose, onSuccess, eventToEdit, technicians, selectedDate }) {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        startDate: '',
        endDate: '',
        isAllDay: true,
        participantIds: [],
        eventType: 'Other',
    });
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen) {
            if (eventToEdit) {
                setFormData({
                    title: eventToEdit.title || '',
                    description: eventToEdit.description || '',
                    startDate: eventToEdit.startDate ? format(parseISO(eventToEdit.startDate), "yyyy-MM-dd'T'HH:mm") : '',
                    endDate: eventToEdit.endDate ? format(parseISO(eventToEdit.endDate), "yyyy-MM-dd'T'HH:mm") : '',
                    isAllDay: eventToEdit.isAllDay !== false,
                    participantIds: eventToEdit.participantIds || [],
                    eventType: eventToEdit.eventType || 'Other'
                });
            } else {
                const defaultStartDate = selectedDate ? format(selectedDate, "yyyy-MM-dd'T'09:00") : '';
                const defaultEndDate = selectedDate ? format(selectedDate, "yyyy-MM-dd'T'17:00") : '';
                setFormData({
                    title: '',
                    description: '',
                    startDate: defaultStartDate,
                    endDate: defaultEndDate,
                    isAllDay: true,
                    participantIds: [],
                    eventType: 'Other',
                });
            }
        }
    }, [eventToEdit, selectedDate, isOpen]);

    const handleInputChange = (e) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleSelectChange = (id, value) => {
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleCheckboxChange = (checked) => {
        setFormData(prev => ({ ...prev, isAllDay: checked }));
    };

    const handleParticipantsChange = (userId) => {
        setFormData(prev => {
            const newParticipantIds = prev.participantIds.includes(userId)
                ? prev.participantIds.filter(id => id !== userId)
                : [...prev.participantIds, userId];
            return { ...prev, participantIds: newParticipantIds };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.title || formData.participantIds.length === 0 || !formData.startDate) {
            setError('Title, at least one participant, and start date are required.');
            return;
        }
        setIsSaving(true);
        setError(null);
        try {
            const dataToSave = { ...formData };
            if (eventToEdit) {
                await CalendarEvent.update(eventToEdit.id, dataToSave);
            } else {
                await CalendarEvent.create(dataToSave);
            }
            onSuccess();
            onClose();
        } catch (err) {
            console.error('Failed to save event:', err);
            setError('An error occurred. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!eventToEdit || !window.confirm('Are you sure you want to delete this event?')) return;
        setIsDeleting(true);
        setError(null);
        try {
            await CalendarEvent.delete(eventToEdit.id);
            onSuccess();
            onClose();
        } catch (err) {
            console.error('Failed to delete event:', err);
            setError('Failed to delete event. Please try again.');
        } finally {
            setIsDeleting(false);
        }
    };

    const selectedParticipants = technicians.filter(t => formData.participantIds.includes(t.id));

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{eventToEdit ? 'Edit Event' : 'Create New Event'}</DialogTitle>
                    <DialogDescription>
                        {eventToEdit ? 'Update the details for this event.' : 'Add a new event to the calendar.'}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div>
                        <Label htmlFor="title">Event Title *</Label>
                        <Input id="title" value={formData.title} onChange={handleInputChange} required />
                    </div>
                    <div>
                        <Label htmlFor="participantIds">Participants *</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full justify-start h-auto">
                                    <div className="flex flex-wrap gap-1">
                                        {selectedParticipants.length > 0 ? selectedParticipants.map(p => (
                                            <Badge key={p.id} variant="secondary">{p.displayName || p.full_name}</Badge>
                                        )) : "Select participants..."}
                                    </div>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                <Command>
                                    <CommandInput placeholder="Search users..." />
                                    <CommandList>
                                        <CommandEmpty>No users found.</CommandEmpty>
                                        <CommandGroup>
                                            {technicians.map(t => (
                                                <CommandItem
                                                    key={t.id}
                                                    onSelect={() => handleParticipantsChange(t.id)}
                                                    className="flex items-center justify-between"
                                                >
                                                    <span>{t.displayName || t.full_name}</span>
                                                    {formData.participantIds.includes(t.id) && <Check className="w-4 h-4" />}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>
                    <div>
                        <Label htmlFor="eventType">Event Type</Label>
                        <Select value={formData.eventType} onValueChange={(val) => handleSelectChange('eventType', val)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="PTO">PTO</SelectItem>
                                <SelectItem value="Training">Training</SelectItem>
                                <SelectItem value="Meeting">Meeting</SelectItem>
                                <SelectItem value="Appointment">Appointment</SelectItem>
                                <SelectItem value="On-site Project">On-site Project</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox id="isAllDay" checked={formData.isAllDay} onCheckedChange={handleCheckboxChange} />
                        <Label htmlFor="isAllDay">All Day Event</Label>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="startDate">Start Date *</Label>
                            <Input id="startDate" type={formData.isAllDay ? 'date' : 'datetime-local'} value={formData.isAllDay ? formData.startDate.split('T')[0] : formData.startDate} onChange={handleInputChange} required />
                        </div>
                        <div>
                            <Label htmlFor="endDate">End Date</Label>
                            <Input id="endDate" type={formData.isAllDay ? 'date' : 'datetime-local'} value={formData.isAllDay ? formData.endDate.split('T')[0] : formData.endDate} onChange={handleInputChange} />
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea id="description" value={formData.description} onChange={handleInputChange} />
                    </div>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                </form>
                <DialogFooter className="flex justify-between w-full">
                    <div>
                    {eventToEdit && (
                        <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            <span className="ml-2">Delete</span>
                        </Button>
                    )}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose}>Cancel</Button>
                        <Button onClick={handleSubmit} disabled={isSaving}>
                            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Save Event
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}