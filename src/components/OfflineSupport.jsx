import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { WifiOff, Wifi, Cloud, CloudOff } from 'lucide-react';

/**
 * Offline support with data caching and sync
 */
export function useOfflineSupport(key, fetchFunction) {
  const [data, setData] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSync, setLastSync] = useState(null);
  const [pendingChanges, setPendingChanges] = useState([]);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load data from cache or fetch
  useEffect(() => {
    const loadData = async () => {
      // Try to load from localStorage first
      const cached = localStorage.getItem(`offline_${key}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setData(parsed.data);
          setLastSync(new Date(parsed.timestamp));
        } catch (e) {
          console.error('Error parsing cached data:', e);
        }
      }

      // If online, fetch fresh data
      if (isOnline) {
        try {
          const freshData = await fetchFunction();
          setData(freshData);
          setLastSync(new Date());
          
          // Cache the fresh data
          localStorage.setItem(`offline_${key}`, JSON.stringify({
            data: freshData,
            timestamp: new Date().toISOString()
          }));
        } catch (error) {
          console.error('Error fetching data:', error);
          // If fetch fails but we have cached data, keep using it
        }
      }
    };

    loadData();
  }, [key, isOnline]);

  // Sync pending changes when back online
  useEffect(() => {
    if (isOnline && pendingChanges.length > 0) {
      syncPendingChanges();
    }
  }, [isOnline]);

  const syncPendingChanges = async () => {
    const changes = [...pendingChanges];
    setPendingChanges([]);

    for (const change of changes) {
      try {
        await change.action();
      } catch (error) {
        console.error('Error syncing change:', error);
        // Re-add to pending if sync fails
        setPendingChanges(prev => [...prev, change]);
      }
    }
  };

  const addPendingChange = (action, description) => {
    setPendingChanges(prev => [...prev, { action, description, timestamp: new Date() }]);
  };

  return {
    data,
    isOnline,
    lastSync,
    pendingChanges,
    addPendingChange
  };
}

/**
 * Offline indicator banner
 */
export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <Alert variant="destructive" className="mb-4">
      <WifiOff className="h-4 w-4" />
      <AlertDescription>
        You're currently offline. Some features may be limited. Changes will sync when you're back online.
      </AlertDescription>
    </Alert>
  );
}

/**
 * Sync status indicator
 */
export function SyncStatus({ lastSync, pendingChanges = [] }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      {isOnline ? (
        <>
          <Wifi className="w-4 h-4 text-green-600" />
          <span>Online</span>
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4 text-red-600" />
          <span>Offline</span>
        </>
      )}
      
      {lastSync && (
        <>
          <span className="mx-2">•</span>
          <Cloud className="w-4 h-4" />
          <span>Synced {lastSync.toLocaleTimeString()}</span>
        </>
      )}
      
      {pendingChanges.length > 0 && (
        <>
          <span className="mx-2">•</span>
          <CloudOff className="w-4 h-4 text-orange-600" />
          <span className="text-orange-600">{pendingChanges.length} pending</span>
        </>
      )}
    </div>
  );
}

/**
 * Cache manager utility
 */
export const cacheManager = {
  set: (key, data, expiryMinutes = 60) => {
    const item = {
      data,
      timestamp: new Date().toISOString(),
      expiry: new Date(Date.now() + expiryMinutes * 60000).toISOString()
    };
    localStorage.setItem(`cache_${key}`, JSON.stringify(item));
  },

  get: (key) => {
    const item = localStorage.getItem(`cache_${key}`);
    if (!item) return null;

    try {
      const parsed = JSON.parse(item);
      const now = new Date();
      const expiry = new Date(parsed.expiry);

      if (now > expiry) {
        localStorage.removeItem(`cache_${key}`);
        return null;
      }

      return parsed.data;
    } catch (e) {
      return null;
    }
  },

  remove: (key) => {
    localStorage.removeItem(`cache_${key}`);
  },

  clear: () => {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('cache_')) {
        localStorage.removeItem(key);
      }
    });
  }
};