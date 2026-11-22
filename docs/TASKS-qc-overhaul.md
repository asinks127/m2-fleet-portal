# Tasks — qc-overhaul

| # | Task | Files | Done when |
|---|------|-------|-----------|
| 1 | DB migration: new QCInspection + ManagerCallLog columns | `qc_overhaul_migration.sql` | Columns exist; old rows intact |
| 2 | Entity-layer column overrides (D2) + registration of new entities | `src/api/entities.js` | Create/filter/write on QCInspection, CallLog, ManagerCallLog, ManagerQCInspection, ExternalManager hit real columns |
| 3 | Photo upload + signed URL APIs | `api/qcInspectionPhotos.js`, `api/qcInspectionPhotosSigned.js` | Photos upload to storage; signed URLs render |
| 4 | Drive filing API (file/retry/verify/listFolder + unfiled list) | `api/qcInspectionDrive.js` | (Blocked on key) endpoint compiles, runs, stores status/errors |
| 5 | Velociti manager API | `api/veloManagers.js` | GET/POST/PATCH work; role normalized |
| 6 | New inspection form dialog | `src/components/qc/QcInspectionFormDialog.jsx` | R1.1–1.8 behave; required-field validation; conditional photos |
| 7 | QC Board wiring: New Inspection button, per-card inspection uses new form, Managers tab = external only (R6), add-manager with roles, manager call dialog with technician association (R5, D1) | `src/pages/QCBoard.jsx`, `src/components/qc/AddManagerDialog.jsx`, `src/components/qc/CallLogDialog.jsx` | All flows work from the board |
| 8 | QC Inspections Report page (R2, R4) | `src/pages/QCInspectionsReport.jsx` | Filters/search/edit+history/export/stats/photos/drive status work |
| 9 | PM & QC Calls Report (R5.6) | `src/pages/VeloPMQCCallsReport.jsx` | Filters/search/export/stats work |
| 10 | Nav + Reports Hub + pages.config registration | `src/Layout.jsx`, `src/pages/ReportsHub.jsx`, `src/pages.config.js` | Pages reachable from nav |
| 11 | Build + local run | — | `bun run build` clean; server serves app + new APIs |
| 12 | Design review loops (≤5) + functional tests | — | Zero gaps or reported leftovers; test data removed |
| 13 | Data cleanup: deactivate arturb@base44.com (R6.2) | Supabase | Account inactive |
| 14 | Release branch, push, archive docs | git | Branch pushed; PRD/TASKS in `docs/archive/` |
