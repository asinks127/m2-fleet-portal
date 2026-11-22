export const WARRANTY_COLUMN_TYPES = {"Technician":{"id":"uuid","full_name":"text","normalized_name":"text","nickname":"text","phone":"text","email":"text","status":"text","is_primary":"boolean","is_active":"boolean","merged_into_technician_id":"uuid","technician_profile_status":"text","specialty":"text","employee_id":"text","contractor_id":"text","market":"text","project_manager":"text","hire_date":"date","training_status":"text","equipment_types":"jsonb","notes":"text","qc_issue_count_total":"numeric","qc_issue_count_30d":"numeric","open_qc_issue_count":"numeric","closed_qc_issue_count":"numeric","warranty_return_count_total":"numeric","warranty_verified_count":"numeric","warranty_reopened_count":"numeric","repair_success_rate":"numeric","reopen_rate":"numeric","repeat_issue_count":"numeric","last_qc_issue_date":"date","last_warranty_return_date":"date","last_verified_warranty_date":"date","qc_score":"numeric","repeat_issue_flag":"boolean","most_common_issue_category":"text","avg_days_to_close":"numeric","damage_claim_count":"numeric","created_at":"timestamptz","updated_at":"timestamptz"},"WarrantyProject":{"id":"uuid","project_name":"text","customer":"text","project_manager":"text","region":"text","active_status":"text","total_warranty_returns":"numeric","open_warranty_returns":"numeric","verified_warranty_returns":"numeric","reopened_warranty_returns":"numeric","avg_days_to_close":"numeric","most_common_issue_category":"text","last_warranty_return_date":"date","created_at":"timestamptz","updated_at":"timestamptz"},"QCIssue":{"id":"uuid","warranty_title":"text","issue_type":"text","claim_type":"text","initiated_by":"text","customer":"text","site_location":"text","project_manager":"text","scheduler":"text","assigned_scheduler":"text","technician_id":"uuid","technician_name":"text","technician_normalized_name":"text","technician_profile_status":"text","assigned_repair_tech":"text","assigned_repair_technician_id":"uuid","assigned_repair_technician_name":"text","project_id":"uuid","email_received_date":"text","date_received":"date","qc_event_date":"date","install_service_date":"date","repair_due_date":"date","repair_scheduled_for":"date","date_repaired":"date","date_closed":"date","alert_started_at":"timestamptz","alert_due_at":"timestamptz","alert_status":"text","asset_number":"text","make":"text","model":"text","year":"text","installed_vin":"text","equip_vin":"text","asset_type":"text","work_order_name":"text","case_number":"text","qc_notes":"text","remote_qc_notes":"text","post_install_notes":"text","issue_summary_clean":"text","resolution_summary_clean":"text","auto_category":"text","final_category":"text","issue_category":"text","qc_category":"text","issue_weight":"numeric","is_documentation_only":"boolean","has_documentation_issue":"boolean","secondary_category":"text","severity":"text","status":"text","data_status":"text","rework_required":"boolean","warranty_return_required":"boolean","chargeback_risk":"boolean","repeat_issue":"boolean","root_cause":"text","repair_notes":"text","repair_date":"date","repair_verified_by":"text","repair_verification_date":"date","repair_status":"text","repair_action_taken":"text","repair_completed_by":"text","repair_completed_date":"date","qc_verified":"boolean","qc_verified_by":"text","qc_verification_date":"date","resolution_outcome":"text","reopen_count":"numeric","reopened_reason":"text","next_action_needed":"text","last_status_changed_by":"text","last_status_changed_at":"timestamptz","warranty_audit_log":"text","issue_source":"text","issue_week":"text","issue_month":"text","issue_year":"numeric","days_open":"numeric","overdue_flag":"boolean","source_email_subject":"text","source_email_from":"text","source_email_date":"text","source_message_id":"text","source_thread_id":"text","communication_history":"text","raw_email_body":"text","parse_confidence":"text","parse_status":"text","dedupe_key":"text","duplicate_status":"text","technician_match_method":"text","technician_match_confidence":"text","created_at":"timestamptz","updated_at":"timestamptz"},"ServiceCall":{"id":"uuid","technician_id":"uuid","technician_name":"text","customer_name":"text","service_address":"text","start_address":"text","service_date":"date","miles_driven":"numeric","service_type":"text","status":"text","notes":"text","created_at":"timestamptz","updated_at":"timestamptz"},"UserSession":{"id":"uuid","user_email":"text","user_name":"text","session_start":"timestamptz","session_end":"timestamptz","last_seen":"timestamptz","is_active":"boolean","duration_minutes":"numeric","duration_seconds":"numeric","active_seconds":"numeric","idle_seconds":"numeric","created_at":"timestamptz","updated_at":"timestamptz"},"WarrantyClaim":{"id":"uuid","created_at":"timestamptz","updated_at":"timestamptz","claim_number":"text","technician_id":"text","technician_name":"text","customer_name":"text","product_description":"text","issue_description":"text","resolution":"text","status":"text","return_required":"boolean","claim_date":"date","resolution_date":"date"},"SchedulingEmail":{"id":"uuid","message_id":"text","thread_id":"text","subject":"text","sender":"text","recipients":"text","cc_recipients":"text","received_at":"timestamptz","body_text":"text","category":"text","status":"text","priority":"text","needs_reply":"boolean","assigned_to":"text","reply_draft":"text","notes":"text","last_action_at":"timestamptz","last_action_by":"text","created_at":"timestamptz","updated_at":"timestamptz"}};

const TABLE_ALIASES = { Project: 'WarrantyProject', WarrantyCallLog: 'ServiceCall' };
const DATE_TYPES = new Set(['date', 'timestamptz']);
const JSON_TYPES = new Set(['jsonb']);
const BOOLEAN_TYPES = new Set(['boolean']);
const NUMERIC_TYPES = new Set(['numeric']);

function tableName(name) { return TABLE_ALIASES[name] || name; }
const WARRANTY_COLUMN_ALIASES = {
  created_date: 'created_at',
  updated_date: 'updated_at',
};

function warrantyColumn(name) { return WARRANTY_COLUMN_ALIASES[name] || name; }
function normalizeValue(type, value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return DATE_TYPES.has(type) ? null : value === '' && BOOLEAN_TYPES.has(type) ? false : value;
  if (BOOLEAN_TYPES.has(type)) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return Boolean(value);
  }
  if (NUMERIC_TYPES.has(type)) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  if (JSON_TYPES.has(type)) {
    if (typeof value === 'string') { try { return JSON.parse(value); } catch { return []; } }
    return value;
  }
  return value;
}

export function toWarrantyRecord(name, input = {}) {
  const schema = WARRANTY_COLUMN_TYPES[name];
  if (!schema) return { ...input };
  const out = {};
  for (const [key, value] of Object.entries(input)) {
    if (!(key in schema)) throw new Error(`Unrecognized ${name} field: ${key}`);
    const normalized = normalizeValue(schema[key], value);
    if (normalized !== undefined) out[key] = normalized;
  }
  return out;
}

export function fromWarrantyRow(row) {
  if (!row) return row;
  const { source_record, import_review_reasons, ...record } = row;
  return record;
}

export function isLiveWarrantySession(session, now = Date.now()) {
  if (!session?.is_active || !session.last_seen) return false;
  return now - Date.parse(session.last_seen) <= 5 * 60 * 1000;
}

export function createWarrantyEntityProxy(client, name) {
  const table = tableName(name);
  const schema = WARRANTY_COLUMN_TYPES[name] || {};
  const convert = (row) => fromWarrantyRow(row);
  return {
    list: async (orderBy, limit) => {
      const pageSize = Math.min(Number(limit) || 1000, 1000);
      let query = client.from(table).select('*');
      if (orderBy) {
        const desc = orderBy.startsWith('-');
        const col = desc ? orderBy.slice(1) : orderBy;
        query = query.order(col, { ascending: !desc });
      }
      const { data, error } = await query.limit(pageSize);
      if (error) throw error;
      return (data || []).map(convert);
    },
    filter: async (filters = {}, orderBy, limit) => {
      let query = client.from(table).select('*');
      for (const [key, value] of Object.entries(filters)) {
        query = query.eq(warrantyColumn(key), value);
      }
      if (orderBy) {
        const desc = orderBy.startsWith('-');
        const col = warrantyColumn(desc ? orderBy.slice(1) : orderBy);
        query = query.order(col, { ascending: !desc });
      }
      const { data, error } = await query.limit(Math.min(Number(limit) || 1000, 1000));
      if (error) throw error;
      return (data || []).map(convert);
    },
    get: async (id) => {
      const { data, error } = await client.from(table).select('*').eq('id', id).single();
      if (error) throw error;
      return convert(data);
    },
    create: async (record) => {
      const { data, error } = await client.from(table).insert(toWarrantyRecord(name, record)).select().single();
      if (error) throw error;
      return convert(data);
    },
    update: async (id, updates) => {
      const { data, error } = await client.from(table).update(toWarrantyRecord(name, updates)).eq('id', id).select().maybeSingle();
      if (error) throw error;
      return convert(data);
    },
    delete: async (id) => {
      const { error } = await client.from(table).delete().eq('id', id);
      if (error) throw error;
    },
    subscribe: (callback) => {
      const channel = client.channel(`${table}-changes`).on('postgres_changes', { event: '*', schema: 'public', table }, callback).subscribe();
      return () => client.removeChannel(channel);
    },
  };
}
