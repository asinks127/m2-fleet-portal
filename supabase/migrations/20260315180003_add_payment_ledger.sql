create table if not exists public."PaymentLedger" (
  id uuid primary key default gen_random_uuid(),
  "invoiceId" uuid null references public."Invoice"(id) on delete set null,
  "contractorEmail" text not null,
  "contractorName" text null,
  amount numeric(12,2) not null default 0,
  "paymentDate" date not null default current_date,
  "paymentMethod" text null,
  "paymentReference" text null,
  status text not null default 'paid',
  notes text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists payment_ledger_contractor_email_idx on public."PaymentLedger"("contractorEmail");
create index if not exists payment_ledger_invoice_id_idx on public."PaymentLedger"("invoiceId");
