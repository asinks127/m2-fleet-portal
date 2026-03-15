import { supabase } from '@/lib/supabaseClient.js';

// Entities helper - wraps Supabase table queries in a familiar interface
// Each entity maps to a Supabase table of the same name

const createEntityProxy = (tableName) => ({
  list: async (orderBy, limit) => {
    let query = supabase.from(tableName).select('*');
    if (orderBy) {
      const desc = orderBy.startsWith('-');
      const col = desc ? orderBy.slice(1) : orderBy;
      query = query.order(col, { ascending: !desc });
    }
    if (limit) query = query.limit(limit);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },
  filter: async (filters, orderBy, limit) => {
    let query = supabase.from(tableName).select('*');
    if (filters) query = query.match(filters);
    if (orderBy) {
      const desc = orderBy.startsWith('-');
      const col = desc ? orderBy.slice(1) : orderBy;
      query = query.order(col, { ascending: !desc });
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
    const { data, error } = await supabase.from(tableName).insert(record).select().single();
    if (error) throw error;
    return data;
  },
  update: async (id, updates) => {
    const { data, error } = await supabase.from(tableName).update(updates).eq('id', id).select().single();
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

// Auto-generate entity proxies for all tables used in the app
const entityNames = [
  'User', 'Invoice', 'AlertLog', 'CallLog', 'Channel', 'ChannelMember',
  'ChatMessage', 'ContractorDocument', 'DirectMessageThread', 'EmergencyContact',
  'ExternalManager', 'ImprovementPlan', 'PaymentLedger', 'PerformanceScore',
  'Project', 'QCInspection', 'SafetyMessage', 'ShadowingChecklist',
  'SignatureRequest', 'SurveyResponse', 'Task', 'TechnicianScore',
  'VeloSurvey', 'WeeklySummary', 'WorkersCompRecord', 'Announcement',
  'ClockEntry', 'Query',
  // Additional entities discovered in page imports
  'VeloSurveyResponse', 'CalendarEvent', 'SignableDocument', 'JobOpening',
  'Candidate', 'AutomationSetting', 'AnnouncementAcknowledgment', 'SafetyCertification',
  'PerformanceAdjustment', 'SafetyAcknowledgement'
];

const entities = {};
for (const name of entityNames) {
  entities[name] = createEntityProxy(name);
}

export default entities;

// Named exports for direct imports
export const {
  User, Invoice, AlertLog, CallLog, Channel, ChannelMember,
  ChatMessage, ContractorDocument, DirectMessageThread, EmergencyContact,
  ExternalManager, ImprovementPlan, PaymentLedger, PerformanceScore,
  Project, QCInspection, SafetyMessage, ShadowingChecklist,
  SignatureRequest, SurveyResponse, Task, TechnicianScore,
  VeloSurvey, WeeklySummary, WorkersCompRecord, Announcement,
  ClockEntry, Query,
  VeloSurveyResponse, CalendarEvent, SignableDocument, JobOpening,
  Candidate, AutomationSetting, AnnouncementAcknowledgment, SafetyCertification,
  PerformanceAdjustment, SafetyAcknowledgement
} = entities;