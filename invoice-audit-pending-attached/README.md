# Invoice cross-comparison audit

Generated 2026-08-31 from the attached export `Invoice_export (1)-f25da0e61dcf.csv` and the live Supabase `Invoice` table.

## Results

- Attached export: 4,055 rows — 3,957 approved, 54 pending, 44 rejected.
- Live Invoice table: 9,194 rows — 8,952 standard approved, 111 standard pending, 128 standard rejected, plus 3 records with nonstandard status values (`eq.pending`, `eq.rejected`, and `eq.approved`).
- Current pending invoices compared with the attached export: 111 total.
- 93 current pending invoices matched an approved invoice in the attached export.
  - 15 matched by the exact stored `driveFileId`.
  - 77 matched by contractor + date + amount, but not the exact filename or Drive ID.
  - 1 matched by contractor + amount within one day of the invoice date.
- 18 current pending invoices did not match any invoice in the attached export.
- 27 live invoice rows in total did not match the attached export by the comparison rules.
- No invoice records were deleted or modified.

The 15 exact Drive-ID matches are the strongest duplicate candidates. The other 78 matches should not be deleted automatically solely from this comparison because the filename or date differs.

## Files

- `current_pending_against_attached.csv`: every current pending invoice with its attached-sheet match, match method, status, and IDs.
- `attached_pending_against_current.csv`: every pending row from the attached export with its live-table match.
- `all_current_against_attached.csv`: all live invoice rows compared against the attached export.
- `duplicate_drive_file_ids_in_attached.csv`: duplicate Drive IDs inside the attached export.
- `duplicate_exact_identities_in_attached.csv`: duplicate contractor/date/amount/filename identities inside the attached export.
- `summary.json`: machine-readable totals.

## Re-run

```bash
node audit_pending_against_attached_export.mjs "/home/.z/chat-uploads/Invoice_export (1)-f25da0e61dcf.csv" "/home/workspace/M23FOR3-15/invoice-audit-pending-attached"
```
