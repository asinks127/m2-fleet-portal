// base44Client.js - Legacy compatibility layer
// This file now re-exports Supabase client and entity helpers
// so that any remaining imports from '@/api/base44Client' still work

import { supabase } from '@/lib/supabaseClient.js';
import entities from '@/api/entities.js';
import { Core } from '@/api/integrations.js';
import { createPageUrl } from '@/utils/index.js';

// Legacy-compatible client that mirrors the old base44 API surface
export const base44 = {
  auth: {
    me: async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      return user;
    },
    logout: (redirectUrl) => {
      supabase.auth.signOut();
      if (redirectUrl) window.location.href = createPageUrl('PortalAccess');
    },
    redirectToLogin: () => {
      window.location.href = createPageUrl('PortalAccess');
    }
  },
  entities,
  integrations: { Core },
  functions: {
    invoke: async (funcName, data) => {
      const res = await fetch(`/api/${funcName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(`Function ${funcName} failed`);
      return res.json();
    }
  },
  appLogs: {
    logUserInApp: async (pageName) => {
      // Optional: log page views to a Supabase table
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('AppLog').insert({
            user_id: user.id,
            page: pageName,
            timestamp: new Date().toISOString()
          });
        }
      } catch (e) {
        // Silently fail - logging shouldn't break the app
      }
    }
  }
};
