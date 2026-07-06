import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Clock, LogIn, LogOut, Loader2, Calendar } from 'lucide-react';
import { format } from 'date-fns';

const AUTHORIZED_EMAILS = [
  'jason@m2fleetcom.com',
  'steve@m2fleetcom.com',
  'lowell@m2fleetcom.com',
  'austin@m2fleetcom.com'
];

// Helper to get current ISO time
const getCurrentTimeISO = () => new Date().toISOString();

const formatCentralTime = (dateStr) => {
  try {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }) + ' CT';
  } catch (error) {
    return dateStr;
  }
};

export default function ClockInOut() {
  const [user, setUser] = useState(null);
  const [currentEntry, setCurrentEntry] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recentEntries, setRecentEntries] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    loadUser();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = (await supabase.auth.getUser()).data.user;
      if (!currentUser) {
        setUser(null);
        setIsLoading(false);
        return;
      }
      setUser(currentUser);

      if (!currentUser?.email || !AUTHORIZED_EMAILS.includes(currentUser.email.toLowerCase())) {
        setIsLoading(false);
        return;
      }

      await loadCurrentEntry(currentUser.email);
      await loadRecentEntries(currentUser.email);
    } catch (error) {
      console.error('Error loading user:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCurrentEntry = async (email) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const { data } = await supabase.from('TimeEntry').select('*').eq('userEmail', email).eq('date', today).order('created_at', { ascending: false }).limit(10);
    const entries = (data || []).filter(row => !row.end_time && !row.clockOutTime);

    if (entries.length > 0) {
      setCurrentEntry(entries[0]);
    }
  };

  const loadRecentEntries = async (email) => {
    const { data } = await supabase.from('TimeEntry').select('*').eq('userEmail', email).order('created_at', { ascending: false }).limit(10);
    const entries = data || [];
    setRecentEntries(entries);
  };

  const handleClockIn = async () => {
    setIsProcessing(true);
    try {
      const now = getCurrentTimeISO();
      const today = format(new Date(), 'yyyy-MM-dd');

      const { data: inserted, error } = await supabase.from('TimeEntry').insert({
        userEmail: user.email,
        userName: user.full_name || user.email,
        start_time: now,
        clockInTime: now,
        date: today,
        status: 'clocked_in'
      }).select().single();
      if (error) throw error;
      const entry = inserted;

      setCurrentEntry(entry);
      await loadRecentEntries(user.email);
    } catch (error) {
      console.error('Error clocking in:', error);
      alert('Failed to clock in. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClockOut = async () => {
    if (!currentEntry) return;

    setIsProcessing(true);
    try {
      const now = getCurrentTimeISO();
      const clockInRaw = currentEntry.start_time || currentEntry.clockInTime;
      const clockIn = new Date(clockInRaw);
      const clockOut = new Date(now);
      const totalHours = (clockOut - clockIn) / (1000 * 60 * 60);

      const { error } = await supabase.from('TimeEntry').update({
        end_time: now,
        clockOutTime: now,
        hours: parseFloat(totalHours.toFixed(2)),
        totalHours: parseFloat(totalHours.toFixed(2)),
        status: 'clocked_out'
      }).eq('id', currentEntry.id);
      if (error) throw error;

      setCurrentEntry(null);
      await loadRecentEntries(user.email);
    } catch (error) {
      console.error('Error clocking out:', error);
      alert('Failed to clock out. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  if (!user || !AUTHORIZED_EMAILS.includes(user.email.toLowerCase())) {
    return null;
  }

  const displayTime = currentTime.toLocaleTimeString('en-US', {
    timeZone: 'America/Chicago',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Time Clock
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <div className="text-4xl font-bold text-gray-900 mb-1">{displayTime}</div>
            <div className="text-sm text-gray-500">Central Time</div>
          </div>

          {currentEntry ? (
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-700 font-medium mb-2">
                  <LogIn className="w-4 h-4" />
                  Currently Clocked In
                </div>
                <p className="text-sm text-green-600">
                  Since: {formatCentralTime(currentEntry.start_time || currentEntry.clockInTime)}
                </p>
              </div>

              <Button
                onClick={handleClockOut}
                disabled={isProcessing}
                className="w-full bg-red-600 hover:bg-red-700"
                size="lg"
              >
                {isProcessing ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <LogOut className="w-5 h-5 mr-2" />
                )}
                Clock Out
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleClockIn}
              disabled={isProcessing}
              className="w-full bg-green-600 hover:bg-green-700"
              size="lg"
            >
              {isProcessing ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <LogIn className="w-5 h-5 mr-2" />
              )}
              Clock In
            </Button>
          )}
        </CardContent>
      </Card>

      {recentEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="w-4 h-4" />
              Recent Time Entries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <div className="font-medium text-sm">
                      {format(new Date(entry.date), 'MMM d, yyyy')}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatCentralTime(entry.start_time || entry.clockInTime)}
                      {(entry.end_time || entry.clockOutTime) && (
                        <span> - {formatCentralTime(entry.end_time || entry.clockOutTime)}</span>
                      )}
                    </div>
                  </div>
                  {(entry.hours || entry.totalHours) && (
                    <div className="text-sm font-semibold text-blue-600">
                      {Number.isFinite(Number(entry.hours || entry.totalHours)) ? Number(entry.hours || entry.totalHours).toFixed(2) : (entry.hours || entry.totalHours)} hrs
                    </div>
                  )}
                  {!(entry.end_time || entry.clockOutTime) && (
                    <div className="text-xs text-orange-600 font-medium">
                      In Progress
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}