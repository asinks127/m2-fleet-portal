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
      if (!user) return null;
      // Merge the User table row (role, display_name, etc.) on top of the raw
      // auth user, matching the User.me() entity behavior. The auth user is
      // spread last so id/email always stay the Supabase auth values.
      try {
        const { data: userData } = await supabase
          .from('User')
          .select('*')
          .eq('email', user.email.toLowerCase())
          .maybeSingle();
        if (userData) return { ...userData, ...user };
      } catch (e) {
        console.warn('base44.auth.me: User row merge failed', e);
      }
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
      // Attach the Supabase session token so server handlers can auth the user.
      const headers = { 'Content-Type': 'application/json' };
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      } catch (e) { console.warn('invoke: no session token', e); }
      const res = await fetch(`/api/${funcName}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(`Function ${funcName} failed`);
      const result = await res.json();
      const warrantyFunctions = new Set(['getAllSessions', 'logSession', 'mergeTechnicians', 'warrantySync', 'warrantyQuickAction', 'updateTechnicianStats', 'bulkRecalcTechStats', 'backfillAllWarrantyEmails', 'backfillQCEmails', 'backfillWarrantyClaims', 'backfillClassification', 'backfillCustomerProject', 'backfillProjects', 'backfillQCEventDate', 'fixExistingWarrantyRecords', 'fixPlaceholderTechNames', 'markOldWarrantiesRepaired']);
      return warrantyFunctions.has(funcName) ? { ...result, data: result?.data ?? result } : result;
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
