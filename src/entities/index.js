import { supabase } from '@/lib/supabaseClient';

const createEntity = (tableName) => ({
  list: async (filters = {}) => {
    let q = supabase.from(tableName).select('*');
    if (filters && typeof filters === 'object') {
      Object.entries(filters).forEach(([key, val]) => {
        if (val !== undefined) q = q.eq(key, val);
      });
    }
    const { data } = await q;
    return data || [];
  },
  get: async (id) => {
    const { data } = await supabase.from(tableName).select('*').eq('id', id).single();
    return data;
  },
  create: async (payload) => supabase.from(tableName).insert(payload),
  update: async (id, payload) => supabase.from(tableName).update(payload).eq('id', id).select(),
  delete: async (id) => supabase.from(tableName).delete().eq('id', id),
  findFirst: async (filters = {}) => {
    let q = supabase.from(tableName).select('*');
    if (filters && typeof filters === 'object') {
      Object.entries(filters).forEach(([key, val]) => {
        if (val !== undefined) q = q.eq(key, val);
      });
    }
    const { data } = await q.limit(1).single();
    return data;
  }
});

// Create User with static auth methods (mirrors Base44 User.auth pattern)
const userEntity = createEntity('User');
userEntity.me = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};
userEntity.logout = async () => {
  await supabase.auth.signOut();
};
userEntity.login = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
};
userEntity.signup = async (email, password) => {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
};

export const User = userEntity;

export const AlertLog = createEntity('AlertLog');
export const Announcement = createEntity('Announcement');
export const AnnouncementAcknowledgment = createEntity('AnnouncementAcknowledgment');
export const AutomationSetting = createEntity('AutomationSetting');
export const CalendarEvent = createEntity('CalendarEvent');
export const CallLog = createEntity('CallLog');
export const Candidate = createEntity('Candidate');
export const ContractorDocument = createEntity('ContractorDocument');
export const DocusignEnvelope = createEntity('DocusignEnvelope');
export const DocusignTemplate = createEntity('DocusignTemplate');
export const Invoice = createEntity('Invoice');
export const JobOpening = createEntity('JobOpening');
export const PaymentLedger = createEntity('PaymentLedger');
export const PerformanceAdjustment = createEntity('PerformanceAdjustment');
export const QCInspection = createEntity('QCInspection');
export const SafetyAcknowledgement = createEntity('SafetyAcknowledgement');
export const SafetyCertification = createEntity('SafetyCertification');
export const SafetyCorrectiveAction = createEntity('SafetyCorrectiveAction');
export const SafetyHazardReport = createEntity('SafetyHazardReport');
export const SafetyInjuryReport = createEntity('SafetyInjuryReport');
export const SafetyLessonAcknowledgment = createEntity('SafetyLessonAcknowledgment');
export const SafetyLessonLearned = createEntity('SafetyLessonLearned');
export const SafetyMessage = createEntity('SafetyMessage');
export const ShadowingChecklist = createEntity('ShadowingChecklist');
export const SignableDocument = createEntity('SignableDocument');
export const SignatureRequest = createEntity('SignatureRequest');
export const Task = createEntity('Task');
export const VeloSurvey = createEntity('VeloSurvey');
export const VeloSurveyResponse = createEntity('VeloSurveyResponse');
export const WorkersCompRecord = createEntity('WorkersCompRecord');
export const Channel = createEntity('Channel');
export const ChannelMember = createEntity('ChannelMember');
export const ChatMessage = createEntity('ChatMessage');
export const DirectMessageThread = createEntity('DirectMessageThread');
export const ExternalManager = createEntity('ExternalManager');
export const OnboardingCompletionRecord = createEntity('OnboardingCompletionRecord');
export const OnboardingDocument = createEntity('OnboardingDocument');
export const AppActivityLog = createEntity('AppActivityLog');