-- Warranty / QC flow tables (ported from warranty app)
-- Run in Supabase SQL Editor.

create extension if not exists pgcrypto;

-- ─── Technician (warranty-flow roster, distinct from TechnicianMaster) ───
create table if not exists public."Technician" (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  normalized_name text,
  nickname text,
  phone text,
  email text,
  status text default 'active',
  is_primary boolean default true,
  is_active boolean default true,
  merged_into_technician_id uuid,
  technician_profile_status text default 'linked',
  specialty text,
  employee_id text,
  contractor_id text,
  market text,
  project_manager text,
  hire_date date,
  training_status text,
  equipment_types jsonb default '[]'::jsonb,
  notes text,
  qc_issue_count_total numeric default 0,
  qc_issue_count_30d numeric default 0,
  open_qc_issue_count numeric default 0,
  closed_qc_issue_count numeric default 0,
  warranty_return_count_total numeric default 0,
  warranty_verified_count numeric default 0,
  warranty_reopened_count numeric default 0,
  repair_success_rate numeric,
  reopen_rate numeric,
  repeat_issue_count numeric default 0,
  last_qc_issue_date date,
  last_warranty_return_date date,
  last_verified_warranty_date date,
  qc_score numeric,
  repeat_issue_flag boolean default false,
  most_common_issue_category text,
  avg_days_to_close numeric,
  damage_claim_count numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists technician_normalized_name_idx on public."Technician" (normalized_name);

-- ─── WarrantyProject (warranty-flow projects, distinct from "Project") ───
create table if not exists public."WarrantyProject" (
  id uuid primary key default gen_random_uuid(),
  project_name text not null,
  customer text,
  project_manager text,
  region text,
  active_status text default 'active',
  total_warranty_returns numeric default 0,
  open_warranty_returns numeric default 0,
  verified_warranty_returns numeric default 0,
  reopened_warranty_returns numeric default 0,
  avg_days_to_close numeric,
  most_common_issue_category text,
  last_warranty_return_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── QCIssue (main warranty-return record created from QC emails) ───
create table if not exists public."QCIssue" (
  id uuid primary key default gen_random_uuid(),
  warranty_title text,
  issue_type text default 'warranty_return',
  claim_type text default 'warranty',
  initiated_by text default 'email',
  customer text,
  site_location text,
  project_manager text,
  scheduler text,
  assigned_scheduler text,
  technician_id uuid,
  technician_name text,
  technician_normalized_name text,
  technician_profile_status text default 'linked',
  assigned_repair_tech text,
  assigned_repair_technician_id uuid,
  assigned_repair_technician_name text,
  project_id uuid,
  email_received_date text,
  date_received date,
  qc_event_date date,
  install_service_date date,
  repair_due_date date,
  repair_scheduled_for date,
  date_repaired date,
  date_closed date,
  alert_started_at timestamptz,
  alert_due_at timestamptz,
  alert_status text default 'none',
  asset_number text,
  make text,
  model text,
  year text,
  installed_vin text,
  equip_vin text,
  asset_type text,
  work_order_name text,
  case_number text,
  qc_notes text,
  remote_qc_notes text,
  post_install_notes text,
  issue_summary_clean text,
  resolution_summary_clean text,
  auto_category text,
  final_category text,
  issue_category text,
  qc_category text,
  issue_weight numeric,
  is_documentation_only boolean default false,
  has_documentation_issue boolean default false,
  secondary_category text,
  severity text default 'medium',
  status text default 'pending_repair',
  data_status text default 'active',
  rework_required boolean default false,
  warranty_return_required boolean default false,
  chargeback_risk boolean default false,
  repeat_issue boolean default false,
  root_cause text,
  repair_notes text,
  repair_date date,
  repair_verified_by text,
  repair_verification_date date,
  repair_status text,
  repair_action_taken text,
  repair_completed_by text,
  repair_completed_date date,
  qc_verified boolean default false,
  qc_verified_by text,
  qc_verification_date date,
  resolution_outcome text,
  reopen_count numeric default 0,
  reopened_reason text,
  next_action_needed text,
  last_status_changed_by text,
  last_status_changed_at timestamptz,
  warranty_audit_log text,
  issue_source text,
  issue_week text,
  issue_month text,
  issue_year numeric,
  days_open numeric default 0,
  overdue_flag boolean default false,
  source_email_subject text,
  source_email_from text,
  source_email_date text,
  source_message_id text,
  source_thread_id text,
  communication_history text default '[]',
  raw_email_body text,
  parse_confidence text,
  parse_status text default 'ok',
  dedupe_key text,
  duplicate_status text,
  technician_match_method text,
  technician_match_confidence text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists qcissue_source_message_id_idx on public."QCIssue" (source_message_id);
create index if not exists qcissue_dedupe_key_idx on public."QCIssue" (dedupe_key);
create index if not exists qcissue_asset_number_idx on public."QCIssue" (asset_number);
create index if not exists qcissue_technician_id_idx on public."QCIssue" (technician_id);
create index if not exists qcissue_status_idx on public."QCIssue" (status);
create index if not exists qcissue_source_thread_id_idx on public."QCIssue" (source_thread_id);

-- ─── ServiceCall ───
create table if not exists public."ServiceCall" (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid,
  technician_name text,
  customer_name text,
  service_address text,
  start_address text,
  service_date date,
  miles_driven numeric,
  service_type text,
  status text default 'scheduled',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── UserSession (admin session tracker) ───
create table if not exists public."UserSession" (
  id uuid primary key default gen_random_uuid(),
  user_email text,
  user_name text,
  session_start timestamptz default now(),
  session_end timestamptz,
  last_seen timestamptz,
  is_active boolean default true,
  duration_minutes numeric default 0,
  duration_seconds numeric default 0,
  active_seconds numeric default 0,
  idle_seconds numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists usersession_email_active_idx on public."UserSession" (user_email, is_active);

-- ─── updated_at triggers ───
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array['Technician','WarrantyProject','QCIssue','ServiceCall','UserSession'] loop
    execute format('drop trigger if exists touch_%s_updated_at on public."%s"', t, t);
    execute format('create trigger touch_%s_updated_at before update on public."%s"
                    for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

-- ─── RLS: authenticated users can read/write; service role bypasses ───
alter table public."Technician" enable row level security;
alter table public."WarrantyProject" enable row level security;
alter table public."QCIssue" enable row level security;
alter table public."ServiceCall" enable row level security;
alter table public."UserSession" enable row level security;

do $$
declare t text;
begin
  foreach t in array array['Technician','WarrantyProject','QCIssue','ServiceCall','UserSession'] loop
    execute format('drop policy if exists "%s_auth_all" on public."%s"', t, t);
    execute format('create policy "%s_auth_all" on public."%s"
                    for all to authenticated using (true) with check (true)', t, t);
  end loop;
end $$;
