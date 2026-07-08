import { supabase } from '@/lib/supabaseClient.js';

// Entities helper - wraps Supabase table queries in a familiar interface
// Each entity maps to a Supabase table of the same name

// Recursively convert camelCase keys to snake_case so app code that still uses
// camelCase (displayName, businessName, onboardingCompleted, etc.) writes to
// the actual snake_case columns the tables have (display_name, business_name,
// onboarding_completed, ...). Most tables use snake_case, but the User table
// mixes snake_case and camelCase depending on the column. Convert at the entity
// boundary so the rest of the app can keep using camelCase keys.
const camelToSnake = (key) =>
  key.replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2').replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

// Table-specific column overrides. The User table has a mix of snake_case and
// camelCase columns (display_name is snake_case, but businessName, endDate,
// startDate, m2pm, velopm, fullName are camelCase or compressed forms).
// Override the default snake_case conversion for those.
const TABLE_COLUMN_OVERRIDES = {
  User: {
    // app camelCase -> actual DB column
    displayName: 'display_name',
    businessName: 'businessName',
    endDate: 'endDate',
    startDate: 'startDate',
    fullName: 'fullName',
    m2PM: 'm2pm',
    veloPM: 'velopm',
    qcAssignment: 'qcAssignment',
    shadowingStatus: 'shadowingStatus',
    shadowingStartDate: 'shadowingStartDate',
    shadowingEndDate: 'shadowingEndDate',
    sunbeltCertStatus: 'sunbeltCertStatus',
    sunbeltCertStartDate: 'sunbeltCertStartDate',
    sunbeltCertEndDate: 'sunbeltCertEndDate',
    sunbeltCertNotes: 'sunbeltCertNotes',
    emergencyContactName: 'emergencyContactName',
    emergencyContactPhone: 'emergencyContactPhone',
    emergencyContactEmail: 'emergencyContactEmail',
    profileComplete: 'profileComplete',
    invoiceReviewReason: 'invoiceReviewReason',
    inactiveReason: 'inactiveReason',
    inactiveDate: 'inactiveDate',
    avgQcScore: 'avgQcScore',
    lateArrivals: 'lateArrivals',
    needsInvoiceReview: 'needsInvoiceReview',
    veloSurveyFeedback: 'veloSurveyFeedback',
    velocitiScore: 'velocitiScore',
    onboardingCompleted: 'onboardingCompleted',
    weeklyPay: 'weeklyPay',
  },
};

const toDbKey = (key, tableName) => {
  if (tableName && TABLE_COLUMN_OVERRIDES[tableName] && TABLE_COLUMN_OVERRIDES[tableName][key] !== undefined) {
    return TABLE_COLUMN_OVERRIDES[tableName][key];
  }
  return camelToSnake(key);
};

const toDb = (value, tableName) => {
  if (Array.isArray(value)) return value.map(v => toDb(v, tableName));
  if (value && typeof value === 'object' && !(value instanceof Date) && !(value instanceof File) && !(value instanceof Blob)) {
    return Object.keys(value).reduce((acc, key) => {
      acc[toDbKey(key, tableName)] = toDb(value[key], tableName);
      return acc;
    }, {});
  }
  return value;
};

const fromDbKey = (key) => {
  // The User table returns camelCase columns (businessName, endDate). Keep
  // them as-is when reading — most of the app already uses these names.
  return key;
};

const fromDb = (row) => {
  if (!row || typeof row !== 'object') return row;
  return Object.keys(row).reduce((acc, key) => {
    acc[fromDbKey(key)] = row[key];
    return acc;
  }, {});
};

const createEntityProxy = (tableName) => ({
  list: async (orderBy, limit) => {
    let query = supabase.from(tableName).select('*');
    if (orderBy) {
      const desc = orderBy.startsWith('-');
      const col = desc ? orderBy.slice(1) : orderBy;
      if (col === 'created_date') {
        query = supabase.from(tableName).select('*').order('created_at', { ascending: !desc });
      } else {
        query = query.order(col, { ascending: !desc });
      }
    }
    if (limit) query = query.limit(limit);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(fromDb);
  },
  filter: async (filters, orderBy, limit) => {
    let query = supabase.from(tableName).select('*');
    if (filters) query = query.match(toDb(filters, tableName));
    if (orderBy) {
      const desc = orderBy.startsWith('-');
      const col = desc ? orderBy.slice(1) : orderBy;
      if (col === 'created_date') {
        query = supabase.from(tableName).select('*').match(toDb(filters, tableName)).order('created_at', { ascending: !desc });
      } else {
        query = query.order(col, { ascending: !desc });
      }
    }
    if (limit) query = query.limit(limit);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(fromDb);
  },
  get: async (id) => {
    const { data, error } = await supabase.from(tableName).select('*').eq('id', id).single();
    if (error) throw error;
    return fromDb(data);
  },
  create: async (record) => {
    const { data, error } = await supabase.from(tableName).insert(toDb(record, tableName)).select().single();
    if (error) throw error;
    return fromDb(data);
  },
  update: async (id, updates) => {
    const { data, error } = await supabase.from(tableName).update(toDb(updates, tableName)).eq('id', id).select();
    if (error) throw error;
    if (data && data.length > 0) return fromDb(data[0]);
    // No row matched by id. Try matching by email if the caller passed one —
    // common case: Supabase auth user id != User table row id (the two are
    // generated independently for Google OAuth sign-ups).
    if (updates && updates.email) {
      const { data: byEmail, error: emailErr } = await supabase
        .from(tableName)
        .update(toDb(updates, tableName))
        .eq('email', updates.email)
        .select();
      if (emailErr) throw emailErr;
      if (byEmail && byEmail.length > 0) return fromDb(byEmail[0]);
    }
    // Still nothing — treat as success no-op rather than "Cannot coerce the
    // result to a single JSON object" so the UI doesn't get stuck.
    return null;
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
  'Range', 'ReportHistory', 'SyncLog', 'TimeEntry',
  // Tech Schedule Parser & Service Map
  'tech_schedule_uploads', 'tech_schedule_rows'
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
  Range, ReportHistory, SyncLog, TimeEntry,
  // Tech Schedule Parser & Service Map
  TechScheduleUpload, TechScheduleRow
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

// Velo outside-PM directory (table is lowercase snake_case, so it can't be a
// clean destructured identifier — export it explicitly).
export const VeloPM = entities['velo_project_managers'];