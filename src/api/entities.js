import { supabase } from '@/lib/supabaseClient.js';

// Entities helper - wraps Supabase table queries in a familiar interface
// Each entity maps to a Supabase table of the same name

// Recursively convert camelCase keys to snake_case so app code that still uses
// camelCase (displayName, businessName, onboardingCompleted, etc.) writes to
// the actual snake_case columns the tables have (display_name, business_name,
// onboarding_completed, ...). Tables in Supabase are snake_case; converting at
// the entity boundary keeps the rest of the app unchanged.
const camelToSnake = (key) =>
  key.replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2').replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

// The User table in Supabase has a few oddly-named columns that don't follow
// normal snake_case (m2pm instead of m2_pm, velopm instead of velo_pm). Map
// those exceptions here so the rest of the app can use normal camelCase.
const COLUMN_ALIASES = {
  m2_pm: 'm2pm',
  velo_pm: 'velopm',
};

const toDbKey = (key) => COLUMN_ALIASES[camelToSnake(key)] || camelToSnake(key);

const toDb = (value) => {
  if (Array.isArray(value)) return value.map(toDb);
  if (value && typeof value === 'object' && !(value instanceof Date) && !(value instanceof File) && !(value instanceof Blob)) {
    return Object.keys(value).reduce((acc, key) => {
      acc[toDbKey(key)] = toDb(value[key]);
      return acc;
    }, {});
  }
  return value;
};

const createEntityProxy = (tableName) => ({
  list: async (orderBy, limit) => {
    let query = supabase.from(tableName).select('*');
    if (orderBy) {
      const desc = orderBy.startsWith('-');
      const col = desc ? orderBy.slice(1) : orderBy;
      // Graceful fallback: created_date → created_at if column doesn't exist
      if (col === 'created_date') {
        query = supabase.from(tableName).select('*').order('created_at', { ascending: !desc });
      } else {
        query = query.order(col, { ascending: !desc });
      }
    }
    if (limit) query = query.limit(limit);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },
  filter: async (filters, orderBy, limit) => {
    let query = supabase.from(tableName).select('*');
    if (filters) query = query.match(toDb(filters));
    if (orderBy) {
      const desc = orderBy.startsWith('-');
      const col = desc ? orderBy.slice(1) : orderBy;
      // Graceful fallback: created_date → created_at if column doesn't exist
      if (col === 'created_date') {
        query = supabase.from(tableName).select('*').match(filters).order('created_at', { ascending: !desc });
      } else {
        query = query.order(col, { ascending: !desc });
      }
    }
    if (limit) query = query.limit(limit);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },
  get: async (id) => {
    const { data, error } = await supabase.from(tableName).select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },
  create: async (record) => {
    const { data, error } = await supabase.from(tableName).insert(toDb(record)).select().single();
    if (error) throw error;
    return data;
  },
  update: async (id, updates) => {
    const { data, error } = await supabase.from(tableName).update(toDb(updates)).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  delete: async (id) => {
    const { error } = await supabase.from(tableName).delete().eq('id', id);
    if (error) throw error;
  },
  subscribe: (callback) => {
    const channel = supabase.channel(`${tableName}-changes`)
      .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, (payload) => {
        callback(payload);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }
});

// All entities including newly added tables from zip sync
const entityNames = [
  // Core
  'User', 'Invoice', 'AlertLog', 'CallLog', 'Channel', 'ChannelMember',
  'ChatMessage', 'ContractorDocument', 'DirectMessageThread', 'EmergencyContact',
  'ExternalManager', 'ImprovementPlan', 'PaymentLedger', 'PerformanceScore',
  'Project', 'QCInspection', 'SafetyMessage', 'ShadowingChecklist',
  'SignatureRequest', 'SurveyResponse', 'Task', 'TechnicianScore',
  'VeloSurvey', 'WeeklySummary', 'WorkersCompRecord', 'Announcement',
  'ClockEntry', 'Query',
  // Additional
  'VeloSurveyResponse', 'CalendarEvent', 'SignableDocument', 'JobOpening',
  'Candidate', 'AutomationSetting', 'AnnouncementAcknowledgment', 'SafetyCertification',
  'PerformanceAdjustment', 'SafetyAcknowledgement',
  // Auditing (from zip sync)
  'AuditRecord', 'AuditTemplate', 'AuditTemplateItem', 'AuditResponse',
  'CorrectiveAction', 'AuditSystemSetting', 'AuditNotification',
  // Safety (from zip sync)
  'SafetyHazardReport', 'SafetyInjuryReport', 'SafetyLessonLearned',
  'SafetyLessonAcknowledgment', 'SafetyCorrectiveAction', 'SafetySettings',
  'OnsiteSafetyCheck',
  // Onboarding (from zip sync)
  'OnboardingCompletionRecord', 'OnboardingDocument',
  // Workforce
  'TechnicianMaster',
  // App logging
  'AppLog', 'AppActivityLog',
  // Misc
  'DelayDetail', 'DailyActivityRecord', 'ManagerCallLog', 'ManagerQCInspection',
  'Range', 'ReportHistory', 'SyncLog', 'TimeEntry'
];

const entities = {};
for (const name of entityNames) {
  entities[name] = createEntityProxy(name);
}

export default entities;

export const {
  Invoice, AlertLog, CallLog, Channel, ChannelMember,
  ChatMessage, ContractorDocument, DirectMessageThread, EmergencyContact,
  ExternalManager, ImprovementPlan, PaymentLedger, PerformanceScore,
  Project, QCInspection, SafetyMessage, ShadowingChecklist,
  SignatureRequest, SurveyResponse, Task, TechnicianScore,
  VeloSurvey, WeeklySummary, WorkersCompRecord, Announcement,
  ClockEntry, Query,
  VeloSurveyResponse, CalendarEvent, SignableDocument, JobOpening,
  Candidate, AutomationSetting, AnnouncementAcknowledgment, SafetyCertification,
  PerformanceAdjustment, SafetyAcknowledgement,
  // Auditing
  AuditRecord, AuditTemplate, AuditTemplateItem, AuditResponse,
  CorrectiveAction, AuditSystemSetting, AuditNotification,
  // Safety
  SafetyHazardReport, SafetyInjuryReport, SafetyLessonLearned,
  SafetyLessonAcknowledgment, SafetyCorrectiveAction, SafetySettings,
  OnsiteSafetyCheck,
  // Onboarding
  OnboardingCompletionRecord, OnboardingDocument,
  // Workforce
  TechnicianMaster,
  // App logging
  AppLog, AppActivityLog,
  // Misc
  DelayDetail, DailyActivityRecord, ManagerCallLog, ManagerQCInspection,
  Range, ReportHistory, SyncLog, TimeEntry
} = entities;

// Custom User entity with me() function
export const User = {
  ...createEntityProxy('User'),
  me: async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) return null;
      const { data: userData, error: userError } = await supabase
        .from('User')
        .select('*')
        .eq('email', user.email.toLowerCase())
        .maybeSingle();
      if (userError) {
        console.error('Error fetching user:', userError);
        return null;
      }
      if (!userData) {
        console.log('No User record found for:', user.email);
        return null;
      }
      return { ...userData, ...user };
    } catch (err) {
      console.error('Error in User.me():', err);
      return null;
    }
  },
  updateMyUserData: async (updates) => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user?.email) throw new Error('You must be signed in to save your profile.');

    const email = user.email.toLowerCase();
    const payload = {
      ...updates,
      email,
    };

    const { data: existingUser, error: existingError } = await supabase
      .from('User')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existingUser?.id) {
      const { data, error } = await supabase
        .from('User')
        .update(toDb(payload) || payload)
        .eq('id', existingUser.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const { data, error } = await supabase
      .from('User')
      .insert(toDb(payload) || payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};