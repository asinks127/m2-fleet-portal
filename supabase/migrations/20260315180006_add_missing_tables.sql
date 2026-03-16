-- Add missing tables that Admin/Messaging depend on
-- These may already exist partially, this ensures they have required columns

-- AlertLog table
create table if not exists public."AlertLog" (
  id uuid default gen_random_uuid() primary key,
  type text not null,
  severity text default 'info',
  title text,
  message text,
  userEmail text,
  metadata jsonb,
  isRead boolean default false,
  created_at timestamp with time zone default now()
);

-- TimeEntry table
create table if not exists public."TimeEntry" (
  id uuid default gen_random_uuid() primary key,
  userEmail text not null,
  userName text,
  date date not null,
  clockIn timestamp with time zone,
  clockOut timestamp with time zone,
  hoursWorked decimal(5,2),
  project text,
  notes text,
  created_at timestamp with time zone default now()
);

-- Seed some time entries
insert into public."TimeEntry" (userEmail, userName, date, clockIn, clockOut, hoursWorked, project) values
  ('alex.contractor@m2fleetcom.com', 'Alex Carter', '2026-03-14', '2026-03-14T07:00:00Z', '2026-03-14T16:00:00Z', 9.0, 'Phoenix Fiber'),
  ('alex.contractor@m2fleetcom.com', 'Alex Carter', '2026-03-13', '2026-03-13T07:00:00Z', '2026-03-13T16:00:00Z', 9.0, 'Phoenix Fiber'),
  ('jamie.contractor@m2fleetcom.com', 'Jamie Brooks', '2026-03-14', '2026-03-14T07:30:00Z', '2026-03-14T17:00:00Z', 9.5, 'Phoenix Fiber'),
  ('taylor.contractor@m2fleetcom.com', 'Taylor Reed', '2026-03-14', '2026-03-14T08:00:00Z', '2026-03-14T17:00:00Z', 9.0, 'Phoenix Fiber')
on conflict do nothing;

-- Seed some alerts
insert into public."AlertLog" (type, severity, title, message, userEmail) values
  ('compliance', 'warning', 'WC Expiring Soon', 'Jamie Brooks workers comp expires in 15 days', 'pm.west@m2fleetcom.com'),
  ('invoice', 'info', 'New Invoice Submitted', 'Taylor Reed submitted week 12 invoice', 'pm.west@m2fleetcom.com'),
  ('task', 'info', 'Task Assigned', 'New QC inspection assigned to Alex Carter', 'alex.contractor@m2fleetcom.com')
on conflict do nothing;

-- RLS for new tables
alter table public."AlertLog" enable row level security;
alter table public."TimeEntry" enable row level security;

create policy "Allow all AlertLog" on public."AlertLog" for all using (true);
create policy "Allow all TimeEntry" on public."TimeEntry" for all using (true);
