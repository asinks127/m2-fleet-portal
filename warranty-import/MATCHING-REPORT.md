# Warranty export reconciliation

Generated: 2026-10-05T04:26:53.776432+00:00

**Status: prepared and validated locally; not imported into live Supabase.**

| Destination | Rows | Source columns |
|---|---:|---:|
| WarrantyProject | 1,245 | 18 |
| Technician | 307 | 43 |
| QCIssue | 2,883 | 101 |
| WarrantyClaim | 5,914 | 17 |
| UserSession | 717 | 16 |

Total: **11,066 distinct source records**. The second project CSV is byte-identical and is not imported twice.

## Compatibility repairs

- All source fields map to a database column or the preserved `source_record` snapshot; none are discarded.
- Legacy IDs map deterministically to UUIDs, including technician, project, repair-technician and duplicate-of references. Original IDs remain in `legacy_id` and `source_record`.
- Source created/updated dates map to `created_at`/`updated_at`. The app exposes both date naming conventions.
- Blank non-text values become null; blank text stays blank (including one missing claim description). Impossible dates become null and are listed for review. Original strings remain in the source snapshot.
- Technician-name uniqueness must be removed: merged history and duplicate names are legitimate source records, not safe automatic deletions.
- `UserSession.session_end` must be added.
- Plain-text activity logs become readable timeline entries; full original logs are preserved.
- Reads must paginate: Supabase’s default response cap would otherwise omit records.

## Safe linkage results

- Technician:preserved_id: **2,486**
- Technician:recovered_by_exact_name: **5,817**
- Technician:unresolved: **296**
- WarrantyProject:preserved_id: **2,779**
- WarrantyProject:recovered_by_exact_name: **43**
- WarrantyProject:unresolved: **36**
- claim_issue_link:ambiguous: **1,072**
- claim_issue_link:matched: **3,514**
- claim_issue_link:unresolved: **1,328**
- legacy_audit_logs_preserved: **315**

## Review findings

6,463 records have at least one review reason; records and statuses are retained, not deleted or silently rewritten.
815 claim-number groups repeat. Claim number alone is not a reliable identity; use source ID plus asset/date/technician.
1 normalized names identify multiple active technicians; these are not guessed.

- ambiguous_reference:project_id: **34**
- ambiguous_reference:qc_issue_id: **1,072**
- ambiguous_reference:technician_id: **7**
- claim_pending_but_qc_resolved: **2,172**
- historical_session_active_flag_preserved: **10**
- invalid_date:last_qc_issue_date: **18**
- missing_asset_number: **140**
- missing_issue_type: **1,718**
- missing_required_text:issue_description: **1**
- placeholder_technician_name: **343**
- session_activity_exceeds_duration: **2**
- unresolved_reference:duplicate_of: **1**
- unresolved_reference:project_id: **2**
- unresolved_reference:qc_issue_id: **1,328**
- unresolved_reference:technician_id: **289**

## Protected behavior

Existing M2 `Project`, `TechnicianMaster`, `QCInspection` and `CallLog` tables are not altered or repurposed. Source counters and session activity are retained as historical snapshots. Pending claims are not automatically closed from an issue status. Original archived, suspected-duplicate, placeholder and merged records remain available for review.

## Live prerequisites

The five new warranty tables are still absent in the last live check. Applying migrations requires database-administration access; the connected data API key cannot execute table-creation SQL. The scheduling mailbox connection is also not configured. No live data has been imported.
