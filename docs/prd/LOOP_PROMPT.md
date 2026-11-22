# Product Feature Loop Prompt — PRD → Tasks → Implement → 5 Design-Check Loops → Release

Use this prompt for **every new feature or significant fix** in the M2 Fleet Communications Portal.
Paste it with a feature description and the agent executes the full cycle.

---

## THE PROMPT

> Implement the following feature set in the M2 Fleet Communications Portal
> (`/home/workspace/M23FOR3-15`) using the full loop workflow below.
>
> FEATURE REQUEST:
> <<< paste the feature request here >>>
>
> ### Stage 0 — Discovery (before writing anything)
> - Read the live code paths that the feature touches (pages, components, entities, API handlers).
> - Verify the live database schema for every table involved (column names are mixed camelCase/snake_case — never assume).
> - Identify what already exists vs. what must be built. Reuse existing patterns (entity layer, `api/` handler routing via `server.js`, report pages, Drive helpers).
>
> ### Stage 1 — PRD
> - Write `docs/prd/<slug>-prd.md` covering: problem, scope, non-goals, functional requirements (numbered), data model changes, API contracts, UI requirements, failure modes, and test checklist.
> - Flag any external dependency (credentials, third-party APIs) as a **blocker to resolve up front**.
>
> ### Stage 2 — Task Breakdown
> - Break the PRD into ordered tasks: schema migration → entity/API layer → UI components → pages/routing → nav registration → cleanup/data fixes.
> - Every task names its files and its acceptance check.
>
> ### Stage 3 — Implementation
> - Implement tasks in order. Commit after each coherent task.
> - Schema changes go to `supabase/migrations/<date>_<slug>.sql`, idempotent (`if not exists`), and MUST be applied to the live database before dependent code is tested.
> - Never break existing writers of a table: map every column explicitly in `TABLE_COLUMN_OVERRIDES` in `src/api/entities.js`.
>
> ### Stage 4 — Design & Function Loops (maximum 5)
> Repeat up to **5 times**, stop early when a loop reports zero gaps:
> 1. Run the app locally and walk every user flow in the feature (do not skip error paths: empty state, missing data, save failure).
> 2. Take screenshots of each screen state (form empty, form filled, conditional sections shown/hidden, report filtered, export produced, dialogs).
> 3. Compare the screenshots against the PRD requirement list, item by item. **Every PRD requirement must be checked against what is visibly on screen — no requirement passes by assumption.**
> 4. Test the data end-to-end: create → read → edit (with change tracking) → report → export → external sync (Drive). Verify actual rows in the database, not just the UI.
> 5. Fix all gaps found, then loop again. A loop that finds zero gaps ends Stage 4.
> - Loop history (what each loop found and fixed) goes in `docs/prd/<slug>-loops.md`.
>
> ### Stage 5 — Release
> 1. `git checkout -b release/<slug>` (or reuse) — commit everything with clean messages.
> 2. Build must pass (`npx vite build`) and `node --check` on changed backend files.
> 3. Push the release branch to GitHub.
> 4. Clean up: remove scratch/test files, delete test rows and test Drive files, close loops docs.
> 5. Archive: move the PRD + loop history into `docs/prd/archive/`, commit, push, and deploy/restart the service.
> 6. Report: what shipped, what's parked, what the user must do (credentials, SQL to run, etc.).

---

## Notes for future agents

- **Blockers are surfaced immediately.** If a credential (e.g. Google service account key) is broken or an external step (SQL migration) needs the user, say so the moment it's hit — don't burn loops on a blocked path.
- **Test data hygiene:** create test records marked `TEST`, then delete them in Stage 5 cleanup.
- **The service:** `m2-fleet-portal` (svc_UOiRr900h_E) runs `node server.js` on port 5174 from this directory; `update_user_service` with just the `service_id` restarts it after pulls.
- Database: Supabase project `rrvvklsknrjzzfdhrrfo`. DDL runs in the Supabase SQL Editor by the user, or via the Supabase Management API integration when connected.

## Changelog

- 2026-11-21: Created. First used for the QC Overhaul feature set (inspections, reports, Drive filing, Velociti PM/QC logs, Managers cleanup).
