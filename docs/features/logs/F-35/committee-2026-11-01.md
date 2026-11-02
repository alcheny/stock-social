# F-35 committee record, 2026-11-01 / 11-02

Feature: `docs/features/F-35-publish-once-the-date-has-passed.md`. Members: UX lead (plan author), business lead,
engineer, each a fresh-context subagent; the orchestrating build session wrote the brief (`brief.md`) and the round
syntheses (`plan.md`, "Round 2 changes", "Round 3 changes"). Paused 2026-11-01 for the weekly limit after the brief;
resumed 2026-11-02 after merging main (ca34767).

## Round 1 (UX lead's plan; business lead and engineer: CHANGES REQUIRED)
UX lead: `published = executed_at <= now()` for the share, option and corporate-action rebuild reads; the 24 h grace
kept for the re-read window only; `excluded_future_sells` and `excluded_future_options`; a second copy sentence; the
watermark set in `rebuildRecord`; the matured pass before the workers; frozen records publish; MATCHER_VERSION bump.

Business lead r1: (1) copy promised an outcome ("added to this record") the code can't guarantee → "waits on this
line"; (2) drop `excluded_future_sells` (speculative; F-21 hand-off note instead); (3) AC1 over every surface; (4) AC3
counted by real rebuild calls; (5) the pass must not starve the workers (time cap + test); (6) frozen: sign "publish",
with status-line and loss tests; (7) bump: thesis round trip, "Updated" unchanged. Non-blocking: 8-day bound, AC5
zones, AC6 listing.

Engineer r1 (with EXPLAIN experiments on 500k rows, rolled back): (1) the planner ignores the partial index under the
plan's join shape (a nested loop over every user); a materialized per-table CTE gives a bitmap scan on the partial
index (180 buffers); (2) a blocked import step whose clock predates a rebuild can store a row the pass skips → lower
the watermark on insert; (3) placement after the heartbeat, stop on lease/deadline/route end, time box; (4) drop the
bump (misses options-only records, fleet rebuild, F-36 collision) → select null-watermark records with a row ahead;
(5) last_synced_at restore and claim order; matcher-rebuild change out of scope; (6) test isolation: opt-in pass;
(7) shift test rows, never the clock; (8) clock-skew ponytail; (9) watermark = the publish clock.

## Round 2 (orchestrator's synthesis): business lead SIGN (three test conditions); engineer CHANGES REQUIRED
Engineer r2: (1) `least()` skips nulls, so an insert would fill a null watermark and hide the record from the
null-watermark branch → never fill a null; only stored rows; (2) the null-watermark branch needs its own CTE
(`executed_at > now()`); (3) count it as `maturedInitial` within the same budget.
Business lead r2 conditions: options-only null-watermark case, insert-lowering costs one rebuild, copy checked on the
page in both colour schemes.

## Round 3 (taken in full; plan "Round 3 changes")
