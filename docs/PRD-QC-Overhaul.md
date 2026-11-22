# PRD — QC Inspections Overhaul (Nov 2026)

## Problem
QC inspections are a bare score+notes dialog. Photos aren't captured, records aren't searchable/reportable, nothing is filed to Google Drive, Velociti PM/QC communication isn't tracked, and the QC Board Managers tab is polluted with app-user accounts.

## Users
- QC inspectors (Ryan Miller, Chance Hoffman) — record inspections.
- Admins — report, export, manage Velociti contacts, fix records.

## Functional requirements

### FR-1 QC Inspection form (overhaul)
- FR-1.1 "New Inspection" opens a form with: Technician (select from roster), Asset Number (text), Customer (text/select), Location (text), Notes (textarea), Availability (Yes/No).
- FR-1.2 Availability = Yes → multi-photo upload section appears; ≥1 photo required before submit.
- FR-1.3 Availability = No → no photo section; submit allowed with no photos.
- FR-1.4 Photos attach to the inspection record permanently (Supabase Storage; URLs on the record).
- FR-1.5 Record auto-captures date/time (inspection_date) and completing QC (qcUserName).
- FR-1.6 Editing an inspection tracks changes: edit_history rows {field, from, to, at, by}.

### FR-2 QC Inspections Report (Performance & Analytics)
- FR-2.1 Same filter model as Call Logs Report + custom date range.
- FR-2.2 Filters: technician, customer, QC inspector, availability; free-text search across notes/asset/customer/location.
- FR-2.3 Record detail shows all fields + photo thumbnails (click to enlarge).
- FR-2.4 Edit with change tracking (FR-1.6); edited records show "edited" badge with who/when.
- FR-2.5 Export CSV and Excel (.xlsx).
- FR-2.6 Per-technician or all-technicians reporting.
- FR-2.7 Summary stats: total inspections, by technician, availability breakdown for the period.

### FR-3 Automatic Google Drive filing
- FR-3.1 On inspection create → PDF generated (all form fields, date/time, QC name, notes, photos embedded) and filed to `<Technician Folder>/QC/Inspection Reports/` under the shared-drive root `0AG5XubOTYKLFUk9PVA`. Folders auto-created if missing. Photos also uploaded as image files.
- FR-3.2 Every record tracks driveStatus: pending → filed | failed | missing; driveFileId, driveLink, driveFolderId, driveError, driveFiledAt.
- FR-3.3 Failed uploads are visible in the report with a Retry action; retry re-runs filing.
- FR-3.4 Two-way recognition: a "Verify Drive" pass re-checks each filed file still exists in Drive; missing/moved files are marked `missing`. Files added directly in a technician's Inspection Reports folder are listed in the report as Drive-side documents (linked back by folder, with view links) even if the app didn't create them.
- FR-3.5 Requires GOOGLE_SERVICE_ACCOUNT_KEY. **Currently broken in .env.local (decoder error) — parked pending a fresh key from the user.** Diagnostics: `/api/testDriveConnection`.

### FR-4 Technician search in Call Logs + QC Inspections reports
- FR-4.1 Call Logs Report keeps/repairs its technician select; selecting a technician shows their full call history in range.
- FR-4.2 QC Inspections Report technician select shows full inspection history in range (FR-2.6).

### FR-5 Velociti PM & QC call logs
- FR-5.1 QC Board Managers tab admins can add Velociti PMs/QCs by name (+ role PM/QC/Other, email, phone, project) — created once, persists.
- FR-5.2 Profiles behave like technician profiles on the board (call log, inspection, details).
- FR-5.3 Call logging records date/time, notes, logger; optional association to an M2 technician (technicianId/technicianName on ManagerCallLog).
- FR-5.4 PM & QC Calls Report (Performance & Analytics): filters person, role, technician, date range; CSV/Excel export; summary counts.

### FR-6 Managers tab cleanup
- FR-6.1 Managers tab lists ONLY intentionally-added ExternalManager records (type external_manager). App users/dev accounts never auto-populate.
- FR-6.2 Data cleanup: arturb@base44.com User row deactivated. (mistamidnight53 / egilmore2026 not present in DB — verified 2026-11-21; FR-6.1 prevents any recurrence.)

### FR-7 Testing
- FR-7.1 Functional test of: form (both availability branches), photo upload, reports + exports, manager call logs, Drive pipeline (pending FR-3.5), edit tracking.
- FR-7.2 ≤5 design-review screenshot loops before release; all gaps fixed or parked with reasons.

## Non-goals
- Real-time Drive→app push (webhooks): recognition is pull-based via Verify/listing.
- Editing PDFs after filing: re-filing an edited inspection creates a new PDF version (v2 suffix).

## Data model (migration `20261121_qc_overhaul.sql`)
- QCInspection: + assetNumber, customer, location, availability, photos (jsonb), qcUserId, qcUserName, driveStatus, driveFileId, driveLink, driveFolderId, driveError, driveFiledAt, editHistory (jsonb). (inspection_date, technicianId, score, notes already exist.)
- ManagerCallLog: + technicianId, technicianName.
- Storage bucket: `qc-inspection-photos`.

## Acceptance criteria
- A QC can complete an inspection without photos (No) and with photos (Yes) and see both in the report with correct filters/exports.
- Every filed inspection has a working Drive link in its technician's folder; failures show a visible Retry.
- Managers tab shows only the Velociti contacts admins added.
- Both reports export .csv and .xlsx with the filtered set.
