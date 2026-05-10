import React, { useState, useEffect } from 'react';
import { Announcement, AnnouncementAcknowledgment, User } from '@/api/entities.js';
import { supabase } from '@/lib/supabaseClient.js';
import { Button } from '@/components/ui/button.jsx';
import { X, AlertTriangle, Info, Megaphone, Zap } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';

// CRITICAL: Centralized helper to format UTC timestamps to Central Time
function formatCentralTime(utcDateString) {
  if (!utcDateString) return 'N/A';
  try {
    const utcDate = new Date(utcDateString);
    if (isNaN(utcDate.getTime())) {
      return 'Invalid Date';
    }

    const options = {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    };
    
    const centralString = utcDate.toLocaleString('en-US', options);
    return centralString + ' CT';
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid Date';
  }
}

export default function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState([]);
  const [user, setUser] = useState(null);
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState(new Set());

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const loadAnnouncements = async () => {
    try {
      const currentUser = await User.me();
      if (!currentUser) {
        setUser(null);
        setAnnouncements([]);
        return;
      }
      setUser(currentUser);

      // Determine user type
      let userType = 'contractors';
      if (currentUser.role === 'admin') {
        userType = 'admins';
      } else if (['rmiller.contractor@m2fleetcom.com', 'choffman.contractor@m2fleetcom.com'].includes(currentUser.email?.toLowerCase())) {
        userType = 'qc';
      }

      // Get active announcements for this user type
      const { data: allAnnouncementsRaw = [] } = await supabase.from('Announcement').select('*').limit(50);
      const allAnnouncements = allAnnouncementsRaw || [];
      
      const relevantAnnouncements = allAnnouncements.filter(announcement => {
        const expiryValue = announcement.expiryDate || announcement.expirydate;
        if (expiryValue) {
          const d = new Date(expiryValue);
          if (!isNaN(d.getTime()) && d < new Date()) return false;
        }

        const targetAudience = announcement.targetAudience || announcement.targetaudience;
        return targetAudience === 'all' || targetAudience === userType;
      });

      const announcementsToShow = [];
      for (const announcement of relevantAnnouncements) {
        if (announcement.requiresAcknowledgment || announcement.requiresacknowledgment) {
          const acks = await AnnouncementAcknowledgment.filter({
            announcementId: announcement.id,
            userId: currentUser.id
          });
          if (acks.length === 0) announcementsToShow.push(announcement);
        } else {
          announcementsToShow.push(announcement);
        }
      }

      setAnnouncements(announcementsToShow);
    } catch (error) {
      console.error('Error loading announcements:', error);
      setAnnouncements([]);
    }
  };

  const handleDismiss = async (announcement) => {
    if (announcement.requiresAcknowledgment || announcement.requiresacknowledgment) {
      try {
        await AnnouncementAcknowledgment.create({
          announcementId: announcement.id,
          userId: user.id,
          userEmail: user.email,
          userName: user.displayName || user.full_name || user.email,
          acknowledgedAt: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error acknowledging announcement:', error);
      }
    }
    
    setDismissedAnnouncements(prev => new Set([...prev, announcement.id]));
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'urgent':
        return <Zap className="w-5 h-5 text-red-600" />;
      case 'high':
        return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'normal':
        return <Info className="w-5 h-5 text-blue-600" />;
      default:
        return <Megaphone className="w-5 h-5 text-gray-600" />;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'border-red-500 bg-red-50';
      case 'high':
        return 'border-orange-500 bg-orange-50';
      case 'normal':
        return 'border-blue-500 bg-blue-50';
      default:
        return 'border-gray-500 bg-gray-50';
    }
  };

  const visibleAnnouncements = announcements.filter(a => !dismissedAnnouncements.has(a.id));

  if (visibleAnnouncements.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {visibleAnnouncements.map((announcement) => (
        <Alert key={announcement.id} className={`${getPriorityColor(announcement.priority)} border-l-4`}>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              {getPriorityIcon(announcement.priority)}
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 mb-1">{announcement.title}</h4>
                <AlertDescription className="text-gray-700 whitespace-pre-wrap">
                  {announcement.message || announcement.content}
                </AlertDescription>
                {(announcement.requiresAcknowledgment || announcement.requiresacknowledgment) && (
                  <div className="mt-2">
                    <Button size="sm" onClick={() => handleDismiss(announcement)}>
                      I Acknowledge
                    </Button>
                  </div>
                )}
              </div>
            </div>
            {!(announcement.requiresAcknowledgment || announcement.requiresacknowledgment) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDismiss(announcement)}
                className="p-1 h-auto ml-2"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </Alert>
      ))}
    </div>
  );
}
