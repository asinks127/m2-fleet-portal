import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { logActivity } from '@/functions/logActivity';

export default function ActivityTracker() {
    const { user, isAuthenticated } = useAuth();
    const location = useLocation();
    
    const sessionId = useRef(Math.random().toString(36).substring(2, 15) + Date.now().toString(36));
    const lastInteraction = useRef(Date.now());
    const lastSent = useRef(Date.now());
    const heartbeatTimer = useRef(null);
    const trackingEmails = ['rmiller.contractor@m2fleetcom.com', 'choffman.contractor@m2fleetcom.com', 'austin@m2fleetcom.com', 'orville@m2fleetcom.com'];
    const started = useRef(false);
    const currentPage = useRef(location.pathname);

    useEffect(() => {
        currentPage.current = location.pathname;
    }, [location.pathname]);

    useEffect(() => {
        if (!isAuthenticated || !user || !user.email) return;
        
        const email = user.email.toLowerCase();
        if (!trackingEmails.includes(email)) return;

        const handleInteraction = () => {
            lastInteraction.current = Date.now();
        };

        window.addEventListener('mousemove', handleInteraction);
        window.addEventListener('keydown', handleInteraction);
        window.addEventListener('click', handleInteraction);
        window.addEventListener('scroll', handleInteraction);
        window.addEventListener('touchstart', handleInteraction);

        const getBrowserInfo = () => navigator.userAgent;
        const getDeviceType = () => /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop';

        if (!started.current) {
            logActivity({
                sessionId: sessionId.current,
                type: 'start',
                pageName: currentPage.current,
                browserInfo: getBrowserInfo(),
                deviceType: getDeviceType()
            }).catch(console.error);
            started.current = true;
            lastSent.current = Date.now();
        }

        heartbeatTimer.current = setInterval(() => {
            const now = Date.now();
            const elapsedSinceLastSend = Math.round((now - lastSent.current) / 1000);
            const timeSinceInteraction = now - lastInteraction.current;
            
            let activeDelta = 0;
            let idleDelta = 0;

            if (timeSinceInteraction > 5 * 60 * 1000) {
                idleDelta = elapsedSinceLastSend;
            } else {
                activeDelta = elapsedSinceLastSend;
            }

            lastSent.current = now;

            logActivity({
                sessionId: sessionId.current,
                type: 'heartbeat',
                pageName: currentPage.current,
                activeDelta,
                idleDelta
            }).catch(console.error);

        }, 60000);

        const handleUnload = () => {
            logActivity({
                sessionId: sessionId.current,
                type: 'end',
                pageName: currentPage.current,
                activeDelta: 0,
                idleDelta: 0
            }).catch(console.error);
        };
        window.addEventListener('beforeunload', handleUnload);

        return () => {
            window.removeEventListener('mousemove', handleInteraction);
            window.removeEventListener('keydown', handleInteraction);
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('scroll', handleInteraction);
            window.removeEventListener('touchstart', handleInteraction);
            window.removeEventListener('beforeunload', handleUnload);
            if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
        };
    }, [isAuthenticated, user]);

    return null;
}