# M2 Fleet ComPortal — QC Overhaul PRD

**Date:** 2026-11-21
**Branch:** `release/qc-overhaul`
**Source:** Client request (7 items) — see conversation 2026-11-21.

## Goals

1. **QC Inspection Form Overhaul** — A full inspection form (not the old score dialog) when a QC starts a New Inspection.
   - Required fields: Technician (roster), Asset Number (manual), Customer, Location, Notes, Availability (Yes/No).
   - Availability = Yes → multi-photo upload section appears (photos optional but encouraged); No → no photos required.
   - Photos are stored permanently (Supabase Storage bucket `qc-inspection-photos`) and attached to the inspection record.
   - Record auto-captures date, time, and the QC who completed it.

2. **QC Inspections Report** (Performance & Analytics → QC Inspections, page `QCInspectionsReport`)
   - Date-range presets + custom start/end (editable).
   - Filters/search: technician, customer, QC inspector, availability, free-text search across fields/notes.
   - Full inspection details incl. notes and photo thumbnails.
   - Edit with change tracking (`editHistory` jsonb: who/when/field/old→new).
   - CSV + Excel (.xlsx via SheetJS) export.
   - Per-technician or all-technicians combined.
   - Summary stats: total inspections, per-technician counts, availability Yes/No breakdown.
   - Drive filing status per row + retry for failed uploads (item 3).

3. **Automatic Google Drive Filing**
   - On every completed inspection, the backend generates a PDF (pdf-lib) containing all form data, date/time, QC name, notes, and embedded photos, then files it under:
     `Technicians Shared Drive root (0AG5XubOTYKLFUk9PVA) / <Technician Name> / QC / Inspection Reports`
     Folders auto-created. Photos are also uploaded alongside the PDF.
   - Record tracks `driveStatus` (pending/filed/failed/missing), `driveFileId`, `driveLink`, `driveFolderId`, `driveError`, `driveFiledAt`.
   - Two-way recognition:
     - **App → Drive:** file + photos uploaded automatically; retry endpoint re-files failed inspections.
     - **Drive → App:** a "verify" action re-checks every filed inspection against Drive; records whose Drive file was deleted/moved externally are marked `missing` and shown in the report so nothing silently disappears. Manually-added Drive documents cannot be auto-ingested (no push channel from Drive); the verify pass surfaces the state of app-filed documents instead.

4. **Technician Search in Call Logs** — Call Logs Report already supports technician + date-range filtering; retained and verified. QC Inspections Report mirrors the same pattern.

5. **Velociti PM & QC Call Logs**
   - Non-user profiles live in the `ExternalManager` table (already exists). QC Board → Managers tab → "Add Manager" creates them with an explicit role (Velociti PM / Velociti QC / Other). Created once, reusable.
   - Call logging on a manager card opens a call dialog that also allows associating the call with an M2 technician (`ManagerCallLog.technicianId`, `technicianName` — migration adds these).
   - Calls record date, time, notes, logger.

6. **PM & QC Calls Report** (page `VeloPMQCCallsReport`)
   - Filters: person, role (PM/QC/Other), technician, custom date/time range, search.
   - CSV + Excel export; summary stats (calls by person, by role, by technician, in range).

7. **Managers Tab Cleanup**
   - Managers tab now shows ONLY `ExternalManager` records (`type === 'external_manager'`), never app users or developer accounts.
   - The stray accounts (mistamidnight53, egilmore2026, Artur B) are gone from the tab; the Artur B User row was deactivated in Supabase (`active=false`) so it disappears app-wide, not just in one view.

## Out of scope / known limits
- Google Drive cannot push change notifications to the app without a pub/sub webhook + domain verification; Drive-side changes are recognized via on-demand verification, not live sync.
- PDF generation is server-side; photos are embedded as JPEG/PNG (HEIC is transcoded by the browser before upload).

## Data model changes
Migration: `supabase/migrations/20261121000000_qc_overhaul.sql` (idempotent; run in Supabase SQL editor or via Management API).
- `QCInspection`: assetNumber, customer, location, availability, photos (jsonb), qcUserId, qcUserName, driveStatus, driveFileId, driveLink, driveFolderId, driveError, driveFiledAt, editHistory (jsonb) — quoted camelCase to match table style.
- `ManagerCallLog`: technicianId, technicianName.
- Storage bucket: `qc-inspection-photos` (private; signed URLs for display).

## API surface (server.js serves root/`api/` handlers)
- `POST /api/qcInspectionPhotos` — upload photos → storage paths (auth required).
- `POST /api/qcInspectionPhotos` with `{paths}` action `sign` — signed URLs for report display.
- `POST /api/qcInspectionDrive` `{inspectionId}` — generate + file PDF/photos; retry on failure.
- `POST /api/qcInspectionDrive` `{action:'verify', ids?}` — re-check filed inspections against Drive.
- `GET  /api/qcInspectionDrive` — filing status counts + failed list (report banner).
- `GET/POST/PATCH /api/veloManagers` — list/create/update Velociti PM & QC profiles (admins only).
