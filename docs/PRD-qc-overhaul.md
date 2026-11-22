# PRD — QC Inspection Overhaul, Reporting, and Velociti Communication Tracking

Date: 2026-11-21
Feature slug: `qc-overhaul`
Owner: M2 Fleet (TJ)

## Problem

The QC inspection process is a bare score+notes dialog. It cannot capture the information QCs
actually collect in the field (asset, customer, location, availability, photos), inspections are
not filed to the technician's Google Drive folder, there is no dedicated inspection report, and
communication with Velociti PMs/QCs (who are not app users) is tracked poorly — the Managers tab
on the QC Board is polluted with app users and developer accounts.

## Users

- **QCs** (Ryan Miller, Chance Hoffman) — perform inspections in the field.
- **Admins** — manage Velociti contacts, run reports, export data.
- **Velociti PMs/QCs** — never log in; they exist only as contacts with a communication history.

## Scope

In scope:
1. QC Inspection form overhaul (new fields + conditional photo upload)
2. QC Inspections Report under Performance & Analytics
3. Automatic Google Drive filing of every inspection (Tech folder → QC → Inspection Reports)
4. Technician search in both Call Logs Report and QC Inspections Report
5. Velociti PM & QC contact profiles + call logging + PM & QC Calls Report
6. QC Board Managers tab cleanup (exclude non-Velociti accounts at the data layer)
7. End-to-end verification of all of the above

Out of scope: technician-facing changes, invoice flows, safety modules.

## Requirements

### R1 — QC Inspection Form (overhaul)

1.1. A **New Inspection** action opens a full inspection form (not the old score dialog).
1.2. Required fields: Technician (select from roster), Asset Number (manual entry), Customer,
     Location, Notes, Availability (Yes/No).
1.3. If Availability = **Yes** → a photo section appears; at least one photo is required.
1.4. If Availability = **No** → no photos required; form completes without any.
1.5. Multiple photos per inspection; photos persist on the inspection record permanently.
1.6. Each inspection auto-records: inspection date/time, and the QC (logged-in user) who
     completed it.
1.7. Photos are stored in Supabase Storage (bucket `qc-inspection-photos`, folder per inspection)
     and referenced by path on the record. Viewing uses short-lived signed URLs.
1.8. On save the app immediately attempts Google Drive filing (R3) without blocking the UI; the
     inspection record tracks filing status (`pending | filed | failed | missing`).

### R2 — QC Inspections Report (Performance & Analytics)

2.1. New page `QCInspectionsReport`, mirroring the Call Logs Report layout.
2.2. Filters: date range presets (today / this week / last week / this month / last month /
     custom start–end), technician, customer, QC inspector, availability (Yes/No/All), free-text
     search over notes/technician/customer/asset.
2.3. Table/list shows all inspection details, notes, photo thumbnails (click to enlarge), and
     Drive filing status.
2.4. **Edit**: any inspection can be edited (all form fields, photos add/remove). Every edit
     appends a change entry (who, when, before→after per changed field) stored in
     `edit_history` on the record and viewable in the UI.
2.5. **Export**: CSV and Excel (.xlsx) of the filtered set, including all fields.
2.6. Summary statistics for the selected period: total inspections, inspections by technician,
     availability Yes/No counts.
2.7. Per-technician or all-technicians reporting via the technician filter.

### R3 — Automatic Google Drive filing

3.1. On inspection completion the app files a PDF into
     `<Technician Folder>/QC/Inspection Reports/` under the shared root `0AG5XubOTYKLFUk9PVA`.
     Technician folder = technician display name (same convention as invoice filing).
3.2. Missing folders (`Technician Folder`, `QC`, `Inspection Reports`) are created automatically.
3.3. The PDF contains: technician, asset number, customer, location, availability, notes,
     inspection date/time, QC name — and all photos embedded.
3.4. The inspection's photos are also uploaded as individual image files into the same folder.
3.5. Filing status, Drive file ID, folder ID, links, and error text are stored on the record.
3.6. **Retry**: failed/pending filings can be retried from the report (single + bulk "Retry
     unfiled"). A GET endpoint lists everything unfiled.
3.7. **Two-way recognition**: a "Verify Drive" action re-checks each filed inspection's file
     still exists in Drive (marks `missing` if deleted), and lists files present in a
     technician's Inspection Reports folder that are not linked to any app record (Drive-side
     additions), so nothing in Drive is invisible to the app.
3.8. Drive filing runs server-side with the M2FleetComPortal service account.

### R4 — Technician search in Call Logs

4.1. Call Logs Report keeps its technician dropdown (verify working end-to-end).
4.2. QC Inspections Report has the identical technician dropdown (2.2).
4.3. Selecting a technician shows their full call + inspection history within the selected date
     range on the respective reports.

### R5 — Velociti PM & QC communication tracking

5.1. QC Board → Managers tab: admins can **Add Velociti PM/QC** (name required; email, phone,
     role, project optional). Role options: Velociti PM, Velociti QC, Velociti PM/QC.
5.2. A person is created once and remains available for future call logging (no duplicates
     required; same record reused).
5.3. Profiles function like technician profiles on the QC Board (cards with details, call log,
     inspection access).
5.4. Calls to/from a Velociti person are logged with date, time, notes, and the logger
     (auto-captured).
5.5. A call may be associated with an M2 technician (optional technician dropdown in the call
     dialog; stored as `technicianId`/`technicianName` on ManagerCallLog).
5.6. New page `VeloPMQCCallsReport` under Performance & Analytics: filters by person, role,
     associated technician, date range presets + custom; shows every call with notes and logger;
     CSV/Excel export; summary stats (total calls, calls by person, calls by technician).

### R6 — Managers tab cleanup

6.1. The Managers tab shows **only** `ExternalManager` records (type `external_manager`).
     App users, contractor accounts, and developer accounts never appear, regardless of their
     data, at the data/query level — not by hiding in one view.
6.2. The account `arturb@base44.com` (Artur B) is deactivated in the User table so it cannot
     surface anywhere.
6.3. `mistamidnight53` and `egilmore2026` do not exist in `ExternalManager` or `User`; after
     6.1 they cannot appear even if re-added as plain users.

## Data model changes

- `QCInspection` new columns: `assetNumber`, `customer`, `location`, `availability` ('yes'/'no'),
  `photos` (jsonb array of {path,name}), `qcUserId`, `qcUserName`, `driveStatus`,
  `driveFileId`, `driveLink`, `driveFolderId`, `driveError`, `driveFiledAt`, `editHistory` (jsonb).
  Existing columns kept (`technicianId`, `inspectorId`, `score`, `status`, `notes`,
  `inspection_date`) — `score` becomes optional.
- `ManagerCallLog` new columns: `technicianId`, `technicianName`.
- Entity layer (`src/api/entities.js`) gets column-name overrides so these camelCase tables
  stop being mangled by blind snake_case conversion.

## API changes

- `POST /api/qcInspectionPhotos` — upload photos → storage paths.
- `POST /api/qcInspectionPhotosSigned` — signed URLs for stored photo paths.
- `POST /api/qcInspectionDrive` (`action`: file | retry | verify) — Drive filing pipeline.
- `GET  /api/qcInspectionDrive` — unfiled/failed inspection list.
- `POST /api/qcInspectionDrive?action=listFolder` — list files in a technician's Inspection
  Reports folder (two-way visibility).
- `GET/POST/PATCH /api/veloManagers` — ExternalManager CRUD.

## Discovered issues (pre-existing, on our path)

- **D1** `QCInspectionDialog.jsx` and `CallLogDialog.jsx` call `supabase.entities[...]`, which
  does not exist → **every manager call log and manager inspection save fails today**. Fixed by
  rewriting both dialogs against `@/api/entities.js`.
- **D2** Entity layer converts camelCase keys to snake_case blindly; CallLog / ManagerCallLog /
  ManagerQCInspection / QCInspection / ExternalManager use camelCase columns. Fixed with
  TABLE_COLUMN_OVERRIDES.
- **D3** `GOOGLE_SERVICE_ACCOUNT_KEY` in `.env.local` (and therefore the deployed service) is
  corrupted — the key fails OpenSSL parsing on the live test endpoint. **BLOCKED**: Drive
  filing code ships complete but cannot be verified end-to-end until a fresh service-account
  JSON key is provided. Retry mechanism makes recovery one click.

## Acceptance criteria

See the numbered requirements above; each is checked in the design-review loops and the
functional test pass.
