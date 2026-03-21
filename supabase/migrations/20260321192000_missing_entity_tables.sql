create extension if not exists pgcrypto;

create table if not exists public."EmergencyContact" (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid,
  "contactName" text,
  relationship text,
  phone text,
  email text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public."ImprovementPlan" (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid,
  title text,
  description text,
  status text default 'active',
  "startDate" timestamptz,
  "endDate" timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public."PerformanceScore" (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid,
  score numeric,
  category text,
  notes text,
  "recordedAt" timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists public."SurveyResponse" (
  id uuid primary key default gen_random_uuid(),
  "surveyId" uuid,
  "userId" uuid,
  response jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public."TechnicianScore" (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid,
  score numeric,
  "scoreType" text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public."WeeklySummary" (
  id uuid primary key default gen_random_uuid(),
  week text,
  summary text,
  metrics jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public."ClockEntry" (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid,
  "clockIn" timestamptz,
  "clockOut" timestamptz,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public."Query" (
  id uuid primary key default gen_random_uuid(),
  name text,
  query text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public."CalendarEvent" (
  id uuid primary key default gen_random_uuid(),
  title text,
  description text,
  "startAt" timestamptz,
  "endAt" timestamptz,
  location text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public."SignableDocument" (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid,
  "fileName" text,
  "fileUrl" text,
  status text default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public."JobOpening" (
  id uuid primary key default gen_random_uuid(),
  title text,
  description text,
  location text,
  status text default 'open',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public."Candidate" (
  id uuid primary key default gen_random_uuid(),
  "jobOpeningId" uuid,
  name text,
  email text,
  phone text,
  status text default 'new',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public."AnnouncementAcknowledgment" (
  id uuid primary key default gen_random_uuid(),
  "announcementId" uuid,
  "userId" uuid,
  acknowledged boolean default true,
  "acknowledgedAt" timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists public."PerformanceAdjustment" (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid,
  amount numeric,
  reason text,
  "effectiveDate" timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
