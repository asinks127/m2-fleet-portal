import React, { useState, useEffect, useCallback } from 'react';
import { CallLog, QCInspection } from '@/api/entities.js';
import { Badge } from '@/components/ui/badge.jsx';
import { Phone, ClipboardCheck, Loader2, ServerCrash, CalendarX } from 'lucide-react';
import { format } from 'date-fns';

const ActivityItem = ({ activity }) => {
    const isCall = activity.type === 'call';
    const Icon = isCall ? Phone : ClipboardCheck;
    
    let badgeColorClass = 'border-gray-300';
    if (!isCall) {
        if (activity.data.score >= 90) badgeColorClass = 'border-green-500';
        else if (activity.data.score >= 70) badgeColorClass = 'border-yellow-500';
        else badgeColorClass = 'border-red-500';
    } else {
        badgeColorClass = 'border-blue-500';
    }

    return (
        <div className={`relative pl-8 py-4 border-l-2 ${badgeColorClass}`}>
            <div className={`absolute -left-[11px] top-5 w-5 h-5 bg-background border-2 ${badgeColorClass} rounded-full flex items-center justify-center`}>
                <Icon className="w-3 h-3 text-foreground" />
            </div>
            <div className="flex justify-between items-start">
                <div>
                    <p className="font-semibold text-gray-800">
                        {isCall ? 'QC Call Log' : `QC Inspection`}
                    </p>
                    <p className="text-sm text-gray-500">
                        {isCall ? `Logged by ${activity.data.loggedBy}` : `Inspected by ${activity.data.qcUserName}`}
                    </p>
                </div>
                <Badge variant="outline">
                    {format(new Date(activity.date), 'MMM d, yyyy')}
                </Badge>
            </div>
             {!isCall && (
                <p className="mt-2 text-sm font-medium text-gray-700">
                    Score: {activity.data.score}/100
                </p>
             )}
            <p className="mt-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-md border">
                {activity.data.note || activity.data.notes || 'No notes provided.'}
            </p>
        </div>
    );
};

export default function ActivityHistoryTab({ userId }) {
    const [activities, setActivities] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const loadActivityHistory = useCallback(async () => {
        if (!userId) {
            setError("No user ID provided.");
            setIsLoading(false);
            return;
        }
        
        setIsLoading(true);
        setError(null);

        try {
            const [callLogs, inspections] = await Promise.all([
                CallLog.filter({ technicianId: userId }, '-callDate'),
                QCInspection.filter({ technicianId: userId }, '-inspectionDate')
            ]);

            const allActivities = [
                ...callLogs.map(log => ({
                    id: `call-${log.id}`,
                    type: 'call',
                    date: log.callDate,
                    data: log
                })),
                ...inspections.map(inspection => ({
                    id: `inspection-${inspection.id}`,
                    type: 'inspection',
                    date: inspection.inspectionDate,
                    data: inspection
                }))
            ].sort((a, b) => new Date(b.date) - new Date(a.date));

            setActivities(allActivities);
        } catch (err) {
            console.error('Failed to load activity history:', err);
            setError('Could not retrieve activity data. Please try again later.');
        } finally {
            setIsLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        loadActivityHistory();
    }, [loadActivityHistory]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <span className="ml-3 text-gray-600">Loading activity history...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center text-red-600 bg-red-50 rounded-lg">
                <ServerCrash className="w-8 h-8 mb-3" />
                <p className="font-semibold">An Error Occurred</p>
                <p className="text-sm">{error}</p>
            </div>
        );
    }

    if (activities.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center text-gray-500 bg-gray-50 rounded-lg">
                <CalendarX className="w-8 h-8 mb-3" />
                <p className="font-semibold">No Activity Found</p>
                <p className="text-sm">There are no call logs or inspections recorded for this technician yet.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {activities.map(activity => <ActivityItem key={activity.id} activity={activity} />)}
        </div>
    );
}