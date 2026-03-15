import React, { useState, useEffect, useCallback } from 'react';
import { User, QCInspection, CallLog, VeloSurveyResponse, SafetyMessage, CalendarEvent } from '@/api/entities.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import CalendarEventDialog from '../components/calendar/CalendarEventDialog';
import DayEventsDialog from '../components/calendar/DayEventsDialog';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight,
  Filter,
  PlusCircle,
  Loader2,
  AlertTriangle,
  Briefcase,
  ClipboardCheck,
  Phone,
  Star,
  Clock,
  Users
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isToday } from 'date-fns';

const superAdminEmails = ['lena@m2fleetcom.com', 'orville@m2fleetcom.com', 'steve@m2fleetcom.com', 'austin@m2fleetcom.com'];

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [calendarUsers, setCalendarUsers] = useState([]);
  const [visibleUsers, setVisibleUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingErrors, setLoadingErrors] = useState([]);
  
  // Dialog states
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [isDayDialogOpen, setIsDayDialogOpen] = useState(false);
  const [eventToEdit, setEventToEdit] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [participantFilter, setParticipantFilter] = useState('all');
  const [eventTypeFilter, setEventTypeFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');

  const safeEntityCall = async (entityCall, entityName) => {
    try {
      const result = await entityCall();
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error(`Error loading ${entityName}:`, error);
      setLoadingErrors(prev => [...prev, `Failed to load ${entityName}`]);
      return [];
    }
  };

  const loadCalendarData = useCallback(async (user) => {
    setIsLoading(true);
    setLoadingErrors([]);
    try {
      const [users, qcInspections, callLogs, veloResponses, safetyMessages, customEvents] = await Promise.all([
        safeEntityCall(() => User.list(), 'Users'),
        safeEntityCall(() => QCInspection.list(), 'QC Inspections'), 
        safeEntityCall(() => CallLog.list(), 'Call Logs'),
        safeEntityCall(() => VeloSurveyResponse.list(), 'Velo Survey Responses'),
        safeEntityCall(() => SafetyMessage.list(), 'Safety Messages'),
        safeEntityCall(() => CalendarEvent.list(), 'Custom Events')
      ]);

      const allAdmins = users.filter(u => superAdminEmails.includes(u.email?.toLowerCase()));
      const activeContractors = users.filter(u => 
        u.active !== false && u.email && (
          u.email.toLowerCase().includes('.contractor@m2fleetcom.com') ||
          u.email.toLowerCase().includes('.contractor@smcinstallations.com')
        )
      );
      
      const allCalendarUsers = [...allAdmins, ...activeContractors].sort((a,b) => (a.displayName || a.full_name).localeCompare(b.displayName || b.full_name));
      setCalendarUsers(allCalendarUsers);

      const isSuperAdmin = superAdminEmails.includes(user.email.toLowerCase());
      let currentlyVisibleUsers = allCalendarUsers;
      if (!isSuperAdmin) {
        const myTechs = activeContractors.filter(c => 
          c.m2PM === user.displayName || c.veloPM === user.displayName
        );
        currentlyVisibleUsers = [user, ...myTechs];
      }
      setVisibleUsers(currentlyVisibleUsers);

      const calendarEvents = generateAllEvents({
        users: currentlyVisibleUsers,
        allCalendarUsers,
        qcInspections,
        callLogs,
        veloResponses,
        safetyMessages,
        customEvents
      });
      
      setEvents(calendarEvents);
    } catch (error) {
      console.error('Error loading calendar data:', error);
      setLoadingErrors(prev => [...prev, 'Failed to load calendar data']);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const user = await User.me();
        setCurrentUser(user);
        await loadCalendarData(user);
      } catch (err) {
        console.error("Failed to load user or data", err);
        setIsLoading(false);
      }
    }
    init();
  }, [loadCalendarData]);
  
  useEffect(() => {
    applyFilters();
  }, [events, searchTerm, participantFilter, eventTypeFilter, projectFilter, visibleUsers]);
  
  const generateAllEvents = (dataSources) => {
    const { users, allCalendarUsers, qcInspections, callLogs, veloResponses, safetyMessages, customEvents } = dataSources;
    let allEvents = [];
    
    (customEvents || []).forEach(event => {
      const isVisible = event.participantIds?.some(pId => users.some(u => u.id === pId));
      if (isVisible) {
        allEvents.push({
            id: `custom-${event.id}`,
            title: event.title,
            date: event.startDate,
            type: 'custom',
            subType: event.eventType,
            participants: event.participantIds?.map(pId => allCalendarUsers.find(u => u.id === pId)).filter(Boolean),
            data: event,
            color: 'bg-indigo-500',
            icon: event.participantIds?.length > 1 ? 'users' : 'calendar',
            isEditable: true,
        });
      }
    });

    users.forEach(contractor => {
      if (contractor.startDate) {
        allEvents.push({
          id: `start-${contractor.id}`,
          title: `${contractor.displayName || contractor.full_name} - Contract Start`,
          date: contractor.startDate, type: 'contract-start', contractor,
          color: 'bg-green-500', icon: 'briefcase'
        });
      }
      if (contractor.endDate) {
        const endDate = new Date(contractor.endDate);
        const daysUntilEnd = Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24));
        allEvents.push({
          id: `end-${contractor.id}`,
          title: `${contractor.displayName || contractor.full_name} - Contract End`,
          date: contractor.endDate, type: 'contract-end', contractor,
          color: daysUntilEnd <= 30 ? 'bg-red-500' : 'bg-orange-500',
          icon: 'briefcase', urgent: daysUntilEnd <= 30
        });
      }
    });

    (qcInspections || []).forEach(inspection => {
      const contractor = users.find(c => c.id === inspection.technicianId);
      if (contractor) {
        allEvents.push({
          id: `qc-${inspection.id}`, title: `QC - ${contractor.displayName || contractor.full_name}`,
          date: inspection.inspectionDate, type: 'qc-inspection', contractor, data: inspection,
          color: inspection.score >= 80 ? 'bg-green-500' : 'bg-yellow-500', icon: 'clipboard-check'
        });
      }
    });

    (callLogs || []).forEach(call => {
        const contractor = users.find(c => c.id === call.technicianId);
        if (contractor) {
            allEvents.push({
                id: `call-${call.id}`, title: `Call - ${contractor.displayName || contractor.full_name}`,
                date: call.callDate, type: 'call-log', contractor, data: call,
                color: 'bg-blue-500', icon: 'phone'
            });
        }
    });

    (veloResponses || []).forEach(response => {
        const contractor = users.find(c => c.id === response.technicianId);
        if (contractor) {
            allEvents.push({
                id: `velo-${response.id}`, title: `Velo Survey - ${contractor.displayName || contractor.full_name}`,
                date: response.submittedDate, type: 'velo-survey', contractor, data: response,
                color: response.calculatedScore >= 4 ? 'bg-green-500' : 'bg-yellow-500', icon: 'star'
            });
        }
    });

    (safetyMessages || []).forEach(message => {
        if (message.scheduledFor) {
            allEvents.push({
                id: `safety-${message.id}`, title: `Safety: ${message.title}`,
                date: message.scheduledFor, type: 'safety-message', data: message,
                color: 'bg-red-500', icon: 'alert-triangle'
            });
        }
    });

    return allEvents;
  };

  const applyFilters = () => {
    let filtered = events;

    if (searchTerm) {
      filtered = filtered.filter(event => 
        event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (event.contractor && (event.contractor.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || event.contractor.full_name?.toLowerCase().includes(searchTerm.toLowerCase()))) ||
        (event.participants && event.participants.some(p => p.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || p.full_name?.toLowerCase().includes(searchTerm.toLowerCase())))
      );
    }

    if (participantFilter !== 'all') {
      filtered = filtered.filter(event => 
        (event.contractor?.id === participantFilter) ||
        (event.participants && event.participants.some(p => p.id === participantFilter))
      );
    }

    if (eventTypeFilter !== 'all') {
      filtered = filtered.filter(event => event.type === eventTypeFilter);
    }

    if (projectFilter !== 'all') {
      filtered = filtered.filter(event => event.contractor?.project === projectFilter);
    }

    setFilteredEvents(filtered);
  };

  const getCalendarDays = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  };

  const getEventsForDay = (day) => {
    return filteredEvents.filter(event => isSameDay(new Date(event.date), day));
  };

  const getEventTypeIcon = (iconType) => {
    const iconMap = {
      'briefcase': Briefcase, 'clipboard-check': ClipboardCheck,
      'phone': Phone, 'star': Star, 'alert-triangle': AlertTriangle,
      'calendar': CalendarIcon, 'users': Users, 'clock': Clock
    };
    return iconMap[iconType] || CalendarIcon;
  };

  const handleEditEvent = (eventData) => {
    setIsDayDialogOpen(false);
    setEventToEdit(eventData);
    setIsEventDialogOpen(true);
  };
  
  const handleCreateEvent = (date) => {
      setIsDayDialogOpen(false);
      setSelectedDate(date);
      setEventToEdit(null);
      setIsEventDialogOpen(true);
  };
  
  const handleDayClick = (day) => {
      setSelectedDate(day);
      setIsDayDialogOpen(true);
  };

  const projects = [...new Set(calendarUsers.map(c => c.project).filter(Boolean))];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2">Loading calendar...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarIcon className="w-8 h-8" />
            Team Calendar
          </h1>
          <p className="text-gray-600 mt-1">
            {currentUser && !superAdminEmails.includes(currentUser.email.toLowerCase()) ? 
                `Viewing calendar for technicians assigned to ${currentUser.displayName}` :
                'Track important dates and events for all technicians & admins'
            }
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => handleCreateEvent(new Date())}>
            <PlusCircle className="w-4 h-4 mr-2" />
            Create Event
          </Button>
        </div>
      </div>

      {loadingErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Some data could not be loaded: {loadingErrors.join(', ')}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Filter className="w-5 h-5" />Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Input placeholder="Search events..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            <Select value={participantFilter} onValueChange={setParticipantFilter}>
              <SelectTrigger><SelectValue placeholder="Filter by participant" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Participants</SelectItem>
                {visibleUsers.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.displayName || user.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
              <SelectTrigger><SelectValue placeholder="Filter by type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="custom">Custom Events</SelectItem>
                <SelectItem value="contract-start">Contract Start</SelectItem>
                <SelectItem value="contract-end">Contract End</SelectItem>
                <SelectItem value="qc-inspection">QC Inspection</SelectItem>
                <SelectItem value="call-log">Call Log</SelectItem>
                <SelectItem value="velo-survey">Velo Survey</SelectItem>
                <SelectItem value="safety-message">Safety Message</SelectItem>
              </SelectContent>
            </Select>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger><SelectValue placeholder="Filter by project" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map(project => (<SelectItem key={project} value={project}>{project}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{format(currentDate, 'MMMM yyyy')}</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(subMonths(currentDate, 1))}><ChevronLeft className="w-4 h-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Today</Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(addMonths(currentDate, 1))}><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-2 text-center font-medium text-gray-500 border-b">{day}</div>
            ))}
            {getCalendarDays().map(day => {
              const dayEvents = getEventsForDay(day);
              return (
                <div key={day.toISOString()} onClick={() => handleDayClick(day)} className={`min-h-[120px] p-2 border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors ${!isSameMonth(day, currentDate) ? 'bg-gray-50' : 'bg-white'} ${isToday(day) ? 'bg-blue-50' : ''}`}>
                  <div className="font-medium text-sm mb-1">{format(day, 'd')}</div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map(event => {
                      const IconComponent = getEventTypeIcon(event.icon);
                      return (
                        <div key={event.id} className={`text-xs p-1 rounded ${event.color} text-white truncate flex items-center gap-1`}>
                          <IconComponent className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{event.title}</span>
                        </div>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <div className="text-xs text-gray-500 text-center">+{dayEvents.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {selectedDate && (
          <DayEventsDialog
            isOpen={isDayDialogOpen}
            onClose={() => setIsDayDialogOpen(false)}
            date={selectedDate}
            events={getEventsForDay(selectedDate)}
            onCreate={() => handleCreateEvent(selectedDate)}
            onEdit={handleEditEvent}
            calendarUsers={calendarUsers}
          />
      )}

      <CalendarEventDialog
        isOpen={isEventDialogOpen}
        onClose={() => setIsEventDialogOpen(false)}
        onSuccess={() => { setIsEventDialogOpen(false); loadCalendarData(currentUser); }}
        eventToEdit={eventToEdit}
        technicians={calendarUsers}
        selectedDate={selectedDate}
      />
    </div>
  );
}