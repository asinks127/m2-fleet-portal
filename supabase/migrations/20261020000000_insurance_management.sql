-- ============================================================================
-- Insurance Management System
-- - Centralized policies for Workers' Comp / General Liability / Commercial Auto
-- - Private contractor info (DOB, EIN, phone, address) for roster
-- - Private document storage bucket
-- - Admin-only access everywhere
-- - Seeds InsurancePolicy from existing WorkersCompRecord (preserves history)
-- Run in Supabase SQL Editor. Safe to re-run.
-- ============================================================================

-- ── Admin gate helper ───────────────────────────────────────────────────────
create or replace function public.is_m2_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    exists (
      select 1 from auth.users u
      where u.id = auth.uid()
        and (
          coalesce(u.raw_user_meta_data->>'role','') = 'admin'
          or (
            lower(u.email) like '%@m2fleetcom.com'
            and lower(u.email) not like '%.contractor@%'
          )
        )
    ),
    false
  );
$$;

revoke execute on function public.is_m2_admin() from anon, public;
grant execute on function public.is_m2_admin() to authenticated;

-- ── Insurance policies ──────────────────────────────────────────────────────
create table if not exists public."InsurancePolicy" (
    id uuid primary key default gen_random_uuid(),
    technician_id uuid references public."User"(id) on delete set null,
    contractor_name text,
    contractor_email text,
    business_name text,
    insurance_type text not null default 'workers_comp'
        check (insurance_type in ('workers_comp','general_liability','commercial_auto')),
    carrier text,
    policy_number text,
    effective_date date,
    expiration_date date,
    uploaded_date date,
    notes text,
    is_current boolean default true,
    supersedes_policy_id uuid references public."InsurancePolicy"(id) on delete set null,
    document_bucket text,
    document_path text,
    document_name text,
    document_uploaded_at timestamptz,
    created_by text,
    updated_by text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create index if not exists idx_insurance_policy_tech
    on public."InsurancePolicy"(technician_id);
create index if not exists idx_insurance_policy_type
    on public."InsurancePolicy"(insurance_type);
create index if not exists idx_insurance_policy_expiration
    on public."InsurancePolicy"(expiration_date);

alter table public."InsurancePolicy" enable row level security;
revoke all on public."InsurancePolicy" from anon, public;

drop policy if exists "InsurancePolicy admin all" on public."InsurancePolicy";
create policy "InsurancePolicy admin all"
    on public."InsurancePolicy"
    for all
    to authenticated
    using (public.is_m2_admin())
    with check (public.is_m2_admin());

-- ── Private contractor info (DOB, EIN, phone, address) ─────────────────────
create table if not exists public."ContractorPrivateInfo" (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null unique references public."User"(id) on delete cascade,
    date_of_birth date,
    ein text,
    phone text,
    address_street text,
    address_line2 text,
    city text,
    state text,
    zip text,
    created_by text,
    updated_by text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

alter table public."ContractorPrivateInfo" enable row level security;
revoke all on public."ContractorPrivateInfo" from anon, public;

drop policy if exists "ContractorPrivateInfo admin all" on public."ContractorPrivateInfo";
create policy "ContractorPrivateInfo admin all"
    on public."ContractorPrivateInfo"
    for all
    to authenticated
    using (public.is_m2_admin())
    with check (public.is_m2_admin());

-- ── Private insurance document bucket ──────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('insurance-docs', 'insurance-docs', false)
on conflict (id) do nothing;

-- Admin-only object access
drop policy if exists "insurance-docs admin read" on storage.objects;
create policy "insurance-docs admin read"
    on storage.objects for select
    to authenticated
    using (bucket_id = 'insurance-docs' and public.is_m2_admin());

drop policy if exists "insurance-docs admin write" on storage.objects;
create policy "insurance-docs admin write"
    on storage.objects for insert
    to authenticated
    with check (bucket_id = 'insurance-docs' and public.is_m2_admin());

drop policy if exists "insurance-docs admin update" on storage.objects;
create policy "insurance-docs admin update"
    on storage.objects for update
    to authenticated
    using (bucket_id = 'insurance-docs' and public.is_m2_admin())
    with check (bucket_id = 'insurance-docs' and public.is_m2_admin());

drop policy if exists "insurance-docs admin delete" on storage.objects;
create policy "insurance-docs admin delete"
    on storage.objects for delete
    to authenticated
    using (bucket_id = 'insurance-docs' and public.is_m2_admin());

-- ── Seed Workers' Comp history from existing records (idempotent) ──────────
-- Static SQL only (no EXECUTE/dynamic DDL — safe for the Supabase SQL editor).
-- Rows are read via to_jsonb, so optional columns (provider, policyNumber,
-- issueDate) that don't exist on WorkersCompRecord simply resolve to null.

insert into public."InsurancePolicy" (
    technician_id, contractor_email, contractor_name, business_name,
    insurance_type, carrier, policy_number, effective_date, expiration_date,
    notes, created_by
)
select
    u.id,
    lower(j.email),
    coalesce(u.full_name, u.display_name, split_part(j.email, '@', 1)),
    null,
    'workers_comp',
    nullif(j.provider, ''),
    nullif(j.policy_number, ''),
    case when j.issue_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then j.issue_date::date end,
    case when j.expiration_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then j.expiration_date::date end,
    'Imported from Workers'' Comp records on ' || to_char(now(), 'YYYY-MM-DD'),
    'system-migration'
from (
    select
        r->>'userEmail'        as email,
        r->>'provider'         as provider,
        r->>'policyNumber'     as policy_number,
        r->>'issueDate'        as issue_date,
        r->>'expirationDate'   as expiration_date
    from (
        select to_jsonb(w) as r
        from public."WorkersCompRecord" w
        where w."userEmail" is not null
    ) t
) j
left join public."User" u on lower(u.email) = lower(j.email)
where not exists (
    select 1 from public."InsurancePolicy" p
    where p.insurance_type = 'workers_comp'
      and lower(p.contractor_email) = lower(j.email)
      and coalesce(p.expiration_date::text,'') = coalesce(j.expiration_date,'')
      and coalesce(p.policy_number,'') = coalesce(j.policy_number,'')
      and coalesce(p.effective_date::text,'') = coalesce(j.issue_date,'')
);
