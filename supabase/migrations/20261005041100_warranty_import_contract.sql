begin;

alter table public."UserSession" add column if not exists session_end timestamptz;
drop index if exists public.technician_normalized_name_uidx;
create index if not exists technician_normalized_name_idx on public."Technician" (normalized_name);

do $$
declare table_name text;
begin
  foreach table_name in array array['Technician','WarrantyProject','QCIssue','ServiceCall','UserSession','WarrantyClaim'] loop
    execute format('alter table public.%I add column if not exists legacy_id text', table_name);
    execute format('alter table public.%I add column if not exists source_record jsonb', table_name);
    execute format('alter table public.%I add column if not exists import_review_reasons jsonb not null default ''[]''::jsonb', table_name);
    execute format('create unique index if not exists %I on public.%I (legacy_id) where legacy_id is not null', lower(table_name) || '_legacy_id_uidx', table_name);
  end loop;
end $$;

alter table public."WarrantyClaim" add column if not exists qc_issue_id uuid;
create index if not exists warrantyclaim_qc_issue_id_idx on public."WarrantyClaim" (qc_issue_id);

drop policy if exists "UserSession_auth_all" on public."UserSession";
drop policy if exists "UserSession_admin_read" on public."UserSession";
create policy "UserSession_admin_read" on public."UserSession"
for select to authenticated using (
  exists (
    select 1 from public."User" u
    where lower(u.email) = lower(auth.jwt() ->> 'email') and u.role = 'admin'
  )
);

notify pgrst, 'reload schema';
commit;
