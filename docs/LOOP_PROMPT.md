# M2 Fleet — Feature Delivery Loop Prompt

Use this prompt for **every** feature or fix in the M2 Fleet Communications app. Paste the feature description at the bottom where marked.

---

## THE PROMPT

You are working on the M2 Fleet Communications app (`/home/workspace/M23FOR3-15`). Deliver the feature described at the end of this prompt by following this exact loop. Never skip a phase; never claim a phase is done without evidence.

### Phase 0 — Context (no code yet)
1. Read the code that touches this feature (pages, components, entities, API handlers, Supabase tables via the service-role client). Confirm current behavior before planning anything.
2. Check `supabase/migrations/` — if the feature needs new columns/tables, write the migration SQL and tell the user to run it in the Supabase SQL Editor (the agent cannot run DDL). Feature code must be written so it works the moment the migration runs.

### Phase 1 — PRD
Write `docs/PRD-<slug>.md`: problem, users, functional requirements numbered (FR-1..n), non-goals, data model changes, edge cases (empty states, failures, permissions), and acceptance criteria that a screenshot or a test can prove. No implementation details yet.

### Phase 2 — Task breakdown
Break the PRD into numbered tasks (schema → API → UI → wiring → tests). Each task names the files it touches and the acceptance criterion it satisfies. Do not start coding until every FR maps to at least one task.

### Phase 3 — Implementation
Implement task by task. Follow existing patterns in the repo (entity layer in `src/api/entities.js`, API handlers resolved from `/api/<name>`, Tailwind + shadcn UI). Match real column names in the database — check them, don't assume snake_case.

### Phase 4 — Design loops (max 5)
Run the app locally, then loop up to **5 times**:
1. **Screenshot** every screen the feature touches (agent-browser, full page).
2. **Compare** each screenshot against the PRD acceptance criteria — element by element.
3. **Gap list** — anything missing, mislabeled, broken, or ugly.
4. **Fix** all gaps, then loop again with fresh screenshots.
Stop early only when a loop produces zero gaps. If loop 5 still has gaps, ship what passes, list what's parked, and say so.

### Phase 5 — Functional tests
Test every data path against the real services (Supabase, Drive, email): create → read → filter → edit (change tracked) → export → delete test data. Verify failures surface visibly to the user (no silent errors). Clean up all test records.

### Phase 6 — Release
1. `git checkout -b release/<slug>` (branch from a checkpoint commit if the tree is dirty).
2. Commit in logical units with clear messages.
3. Run the build (`npm run build` or the project's build) — fix errors before pushing.
4. `git push -u origin release/<slug>`.
5. **Cleanup**: remove scratch files, test scripts, console noise; delete test DB/Drive records.
6. **Archive**: move superseded plan/scratch docs into `docs/archive/`, keep the PRD and this loop's findings in `docs/`.
7. Restart/republish the service and confirm the live URL responds.

### Phase 7 — Report
Report to the user: what shipped, what's parked and why (e.g., pending migration, pending credentials), what was tested with evidence, and the release branch name.

---

## FEATURE TO BUILD

<paste the feature description here>
