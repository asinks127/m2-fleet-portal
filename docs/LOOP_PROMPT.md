# Feature Implementation Loop Prompt — M2 Fleet ComPortal

**Copy this prompt and fill in the FEATURE block for every change, fix, or feature moving forward.**
It enforces the full discipline: PRD → task breakdown → iterative implementation → design review loops → release.

---

## THE PROMPT

```
Implement the following feature(s) on the M2 Fleet ComPortal app
(/home/workspace/M23FOR3-15) using the LOOP WORKFLOW below.

FEATURE:
<paste the feature request / bug report here>

LOOP WORKFLOW (follow in order, do not skip steps):

1. PRD FIRST
   - Write a PRD to docs/PRD-<feature-slug>.md covering: problem, users,
     functional requirements (numbered), data model changes, API changes,
     UX flow, edge cases, out-of-scope, and acceptance criteria.
   - Number every requirement (R1, R2, …). Every later check must trace
     back to these IDs.

2. TASK BREAKDOWN
   - Break the PRD into tasks ordered so the data model comes first,
     then backend/API, then UI, then reports/exports, then cleanup.
   - Each task names the files it touches and the PRD IDs it satisfies.

3. IMPLEMENT (one task at a time, commit after each)
   - Run migrations (supabase/migrations/<date>_<slug>.sql) and verify the
     live schema matches before writing code against it.
   - Keep existing behavior intact; check callers before changing shared
     components/entities.

4. DESIGN REVIEW LOOPS (maximum 5)
   Run the app locally (npx vite build && node server.js, or the dev
   server) and for each loop:
   a. Exercise every changed screen with the agent browser
      (agent-browser open/snapshot/click/fill/screenshot).
   b. Screenshot each state (default, filled, error, empty, mobile-width).
   c. Compare the screenshots against the PRD acceptance criteria and
      against each other — look for: layout gaps, dead buttons, broken
      filters, missing empty states, bad date/timezone handling, orphaned
      records.
   d. Log every gap found, fix it, re-screenshot only the fixed states.
   e. Stop early if a loop produces zero new gaps. Never exceed 5 loops.
   - Keep a loop log (loop #, states checked, gaps found, fixes made).

5. FUNCTIONAL VERIFICATION
   - Test real writes against a clearly-labeled TEST record; verify
     integration points (Supabase tables, Google Drive filing, exports).
   - Delete TEST records and their artifacts at cleanup.
   - Verify no console errors and no broken imports (npx vite build).

6. RELEASE
   - git checkout -b release/<slug> (or reuse if continuing)
   - Commit with conventional messages (feat:/fix:/chore:), push the
     branch to origin.
   - Clean up: remove temp files/scripts, scratch DB rows, test Drive
     files; move the PRD and loop log into docs/archive/.
   - Merge/deploy per current release practice and confirm the live
     service responds 200.
```

---

## WHY EACH CHECK EXISTS (hard-won rules)

- **Schema before code.** The entity layer maps app keys to real columns;
  blind camelCase→snake_case conversion has broken writes before. Verify
  actual columns with a live `select *` after every migration.
- **Tables with camelCase columns** (QCInspection, CallLog, ManagerCallLog,
  ManagerQCInspection, ExternalManager) MUST have TABLE_COLUMN_OVERRIDES
  entries in `src/api/entities.js` — never assume snake_case.
- **Never leave a no-op import.** `supabase.entities` does not exist on a
  plain supabase-js client; always use the `@/api/entities.js` proxies.
- **Screenshots over assumptions.** Every "should work" is a screenshot.
- **TEST data is labeled and deleted.** Production Supabase + shared Drive.
- **One release branch per feature batch.** Archive docs; don't leave PRDs
  loose in the repo root.
