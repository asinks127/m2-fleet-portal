-- QC Overhaul migration (2026-11)
-- Adds inspection-form fields, photo storage, Drive filing tracking, and edit history
-- to QCInspection; adds technician association to ManagerCallLog.
-- Quoted camelCase identifiers match the existing column style of these tables
-- (technicianId, callDate, ...).

alter table "QCInspection" add column if not exists "assetNumber" text;
alter table "QCInspection" add column if not exists "customer" text;
alter table "QCInspection" add column if not exists "location" text;
alter table "QCInspection" add column if not exists "availability" text;
alter table "QCInspection" add column if not exists "photos" jsonb default '[]'::jsonb;
alter table "QCInspection" add column if not exists "qcUserId" text;
alter table "QCInspection" add column if not exists "qcUserName" text;
alter table "QCInspection" add column if not exists "technicianName" text;
alter table "QCInspection" add column if not exists "driveStatus" text default 'pending';
alter table "QCInspection" add column if not exists "driveFileId" text;
alter table "QCInspection" add column if not exists "driveLink" text;
alter table "QCInspection" add column if not exists "driveFolderId" text;
alter table "QCInspection" add column if not exists "driveError" text;
alter table "QCInspection" add column if not exists "driveFiledAt" timestamptz;
alter table "QCInspection" add column if not exists "editHistory" jsonb default '[]'::jsonb;

alter table "ManagerCallLog" add column if not exists "technicianId" text;
alter table "ManagerCallLog" add column if not exists "technicianName" text;

create index if not exists qc_inspection_drive_status_idx on "QCInspection" ("driveStatus");
