# Feature Delivery Loop Prompt

Use this prompt for **every product feature or change** in this app. Paste the feature description
where marked. The loop guarantees the design is reviewed visually multiple times before anything
ships, and that everything is tested, branched, and archived.

---

## THE PROMPT

> Implement the following feature in the M2 Fleet Communications Portal:
>
> **[PASTE FEATURE DESCRIPTION HERE]**
>
> Follow this exact process:
>
> **Step 1 — PRD.** Write a PRD to `docs/PRD-<feature-slug>.md`. It must cover: problem, users,
> scope (in/out), every user-facing behavior as a numbered requirement, data model changes, API
> changes, edge cases, and explicit acceptance criteria I can verify. Do not write code yet.
>
> **Step 2 — Task breakdown.** Break the PRD into numbered implementation tasks ordered by
> dependency (data model → API → UI → wiring → cleanup). Save to `docs/TASKS-<feature-slug>.md`.
> Each task lists the files it touches and its acceptance criteria.
>
> **Step 3 — Implement.** Work the tasks in order. Verify each acceptance criterion as you go.
> Fix pre-existing breakage you discover on paths this feature touches — do not build on top of
> broken code silently; log it in the PRD under "Discovered issues".
>
> **Step 4 — Design review loops (max 5).** Run the app locally, then loop:
> 1. Screenshot every screen this feature touches (full page).
> 2. Compare against the PRD acceptance criteria and against sibling screens for visual
>    consistency (spacing, headers, badges, empty states).
> 3. List every gap: missing behavior, layout problem, inconsistency, broken interaction.
> 4. Fix all gaps, re-screenshot, and loop again.
> Stop early only when a loop finds zero gaps. Never exceed 5 loops — if gaps remain at loop 5,
> report them instead of iterating blindly.
>
> **Step 5 — Functional test.** Exercise the real flows end-to-end (create, edit, export,
> external integrations). Confirm data lands where it should. Clean up test records.
>
> **Step 6 — Release.** Create a `release/<feature-slug>` branch, commit with clear messages,
> push to GitHub.
>
> **Step 7 — Clean up + archive.** Move the PRD and task list into `docs/archive/`, commit, and
> summarize what shipped, what was deferred, and any open risks.

---

## HARD RULES

- Max **5** design-review loops. Loop 0 = first screenshots; loop N re-reviews fixes.
- Every loop must produce: screenshots → gap list → fixes. No loop without a gap list.
- Screenshots go in the conversation workspace, never committed to the repo.
- Test data must be visibly labeled (e.g. notes containing "TEST") and removed before release.
- Never push to `main` directly; release branches only.
- If an external dependency (API key, service) is broken, implement around it, mark the piece
  `BLOCKED` in the PRD with the exact blocker, and ship the rest.
