-- Add missing Task table for AdminDashboard and Messaging
create table if not exists public."Task" (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  status text default 'Open' not null,
  priority text default 'Medium',
  assigneeEmail text,
  assigneeName text,
  dueDate timestamp with time zone,
  channelId uuid references public."Channel"(id) on delete cascade,
  createdByEmail text,
  createdByName text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Add RLS
alter table public."Task" enable row level security;

create policy "Allow all for authenticated users" on public."Task"
  for all using (auth.role() = 'authenticated');

create policy "Allow all for anon users" on public."Task"
  for all using (auth.role() = 'anon');

-- Seed some tasks
insert into public."Task" (id, title, description, status, priority, assigneeEmail, assigneeName, createdByEmail, createdByName) values
  ('11111111-1111-4111-8111-111111111111', 'Complete QC Training Module', 'Finish the mandatory QC training for all new hires', 'Open', 'High', 'alex.contractor@m2fleetcom.com', 'Alex Carter', 'pm.west@m2fleetcom.com', 'Casey Walker'),
  ('11111111-1111-4111-8111-111111111112', 'Submit Week 12 Invoice', 'Submit invoice for week ending March 20', 'Open', 'Medium', 'jamie.contractor@m2fleetcom.com', 'Jamie Brooks', 'pm.west@m2fleetcom.com', 'Casey Walker'),
  ('11111111-1111-4111-8111-111111111113', 'Update Safety Certifications', 'Renew expiring safety certs for Phoenix project', 'In Progress', 'High', 'taylor.contractor@m2fleetcom.com', 'Taylor Reed', 'pm.west@m2fleetcom.com', 'Casey Walker'),
  ('11111111-1111-4111-8111-111111111114', 'Complete Equipment Audit', 'Finish auditing all equipment at warehouse', 'Open', 'Low', 'alex.contractor@m2fleetcom.com', 'Alex Carter', 'pm.west@m2fleetcom.com', 'Casey Walker'),
  ('11111111-1111-4111-8111-111111111115', 'Schedule Team Meeting', 'Weekly operations sync for install team', 'Done', 'Medium', 'pm.west@m2fleetcom.com', 'Casey Walker', 'pm.west@m2fleetcom.com', 'Casey Walker')
on conflict (id) do nothing;
