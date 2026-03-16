create extension if not exists pgcrypto;

create table if not exists public."Task" (
  id uuid primary key default gen_random_uuid(),
  "assignedToId" uuid null,
  "createdById" uuid null,
  title text not null,
  description text null,
  status text not null default 'todo',
  priority text null default 'medium',
  due_date timestamp with time zone null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public."QCInspection" (
  id uuid primary key default gen_random_uuid(),
  "technicianId" uuid null,
  "inspectorId" uuid null,
  score numeric null,
  status text null default 'pending',
  notes text null,
  inspection_date timestamp with time zone null default now(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public."AlertLog" (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid null,
  category text null,
  severity text null default 'info',
  title text not null,
  message text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create table if not exists public."AppLog" (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  page text null,
  action text null,
  metadata jsonb not null default '{}'::jsonb,
  timestamp timestamp with time zone not null default now()
);

create table if not exists public."TimeEntry" (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid null,
  "taskId" uuid null,
  start_time timestamp with time zone null,
  end_time timestamp with time zone null,
  hours numeric null,
  notes text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public."SafetyAcknowledgement" (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid null,
  "messageId" uuid null,
  acknowledged_at timestamp with time zone not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public."SafetyMessage" (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  category text null,
  active boolean not null default true,
  published_at timestamp with time zone null default now(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public."ExternalManager" (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text null,
  phone text null,
  company text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
