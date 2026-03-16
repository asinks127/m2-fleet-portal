insert into public."PaymentLedger" (
  id, "invoiceId", "contractorEmail", "contractorName", amount, "paymentDate", "paymentMethod", "paymentReference", status, notes
)
values
  (
    '97000000-0000-4000-8000-000000000001',
    '94000000-0000-4000-8000-000000000001',
    'alex.contractor@m2fleetcom.com',
    'Alex Carter',
    920.00,
    current_date - interval '2 day',
    'ach',
    'ACH-2041',
    'paid',
    'Partial payment released for week 11.'
  ),
  (
    '97000000-0000-4000-8000-000000000002',
    '94000000-0000-4000-8000-000000000003',
    'taylor.contractor@m2fleetcom.com',
    'Taylor Reed',
    800.00,
    current_date - interval '1 day',
    'check',
    'CHK-8831',
    'paid',
    'Manual emergency release.'
  )
on conflict (id) do update set
  amount = excluded.amount,
  "paymentDate" = excluded."paymentDate",
  "paymentMethod" = excluded."paymentMethod",
  "paymentReference" = excluded."paymentReference",
  status = excluded.status,
  notes = excluded.notes;
