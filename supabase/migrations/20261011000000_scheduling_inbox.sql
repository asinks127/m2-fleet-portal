create table if not exists public."SchedulingEmail" (
  id uuid primary key default gen_random_uuid(),
  gmail_message_id text unique not null,
  gmail_thread_id text,
  subject text,
  sender text,
  recipient text,
  cc text,
  received_at timestamptz,
  snippet text,
  body_text text,
  category text not null default 'other' check (category in ('pending_request','tech_unavailability','other')),
  status text not null default 'pending' check (status in ('pending','in_progress','closed','ignored')),
  assigned_to text,
  last_replied_at timestamptz,
  last_replied_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists scheduling_email_status_idx on public."SchedulingEmail" (status, received_at desc);
create index if not exists scheduling_email_category_idx on public."SchedulingEmail" (category, received_at desc);
alter table public."SchedulingEmail" enable row level security;
drop policy if exists scheduling_email_authenticated on public."SchedulingEmail";
create policy scheduling_email_authenticated on public."SchedulingEmail" for all to authenticated using (true) with check (true);
