approve: true

# F-2 · PR-2 (follow and "not interested") · Reviewer

Date: 2026-10-23. Branch `claude/adoring-euler-4469ys` at `0ed7231` vs `origin/main`. Product diff (`-- . ':!docs/features/logs'`):
31 files, +1,408 / −35 (product code ~+620; the rest tests and the e2e spec). Inputs: `team/reviewer.md`, POLICY,
COMPLIANCE §1, CLAUDE.md, the F-2 feature file, plan §1 (PR-2), the engineer's log (build + fix round 1), the tester's
re-run 1 (3 Low), the business lead's round 2 (PASS/PASS) and the UX lead's round 2 (PASS). Everything ran on my own
database (`ss_rev_pr2`, created as the superuser and owned by the shared role; the shared `stock_social` was never
written). The three tester Lows are fixed here (product code, as the brief allows), below.

## Checks run (after my changes)

| Check | Result |
|---|---|
| Schema ×2 on a fresh database, seed | clean and idempotent; additions only: `follows`, `viewer_exclusions` (both keys `on delete cascade`, `check (viewer_id <> trader_id)`), 3 indexes on them, `users_referred_by` (partial), `users.follow_notice_at` via `schema_add_column`; no drop, truncate or delete from |
| `npx tsc --noEmit` | clean |
| `npm test` | **576 tests, 566 pass, 10 skipped (LOAD), 0 fail** (575 → 576: one test added for the `?back=` fix) |
| Weakening | `lib/discovery/imports.test.ts` and `lib/feed.signed-out.test.ts` gain roots and cases only (PR-1's import graph and the signed-out query log are untouched; the new signed-in case asserts every `follows`/`viewer_exclusions` read is `where viewer_id = $1` with the session's id). No test removed, no `.skip`/`.only` |
| `LOAD=1` feed / follows / sync | **4/4, 1/1, 5/5.** Feed all-pages p95: 12 heavy 124 ms, 50 heavy 237 ms (bound 400); late, weights kept p95 262 ms; own-late cold ~790 ms median (bound 1 s; PR-1's known limit, unchanged). Deleting a trader 100,000 viewers follow and hide: 103 ms. Purging 100,000 ended exclusions: 291 ms, done in one call |
| `node scripts/compliance.ts diff origin/main` | only the pre-existing `@img/sharp-wasm32` license line (local `node_modules`) |
| `node scripts/autopilot.ts guard main` | ok |
| `CI=1 npm run build`, stdin closed | run 1 stopped on the framework's security advisory (tool output; nothing upgraded, nothing offered); retry exit 0. `/me/following` is dynamic |
| `npm run test:e2e` ×1, own database, `CI=1`, vendor fake variables set | **103 passed, 3 skipped (provider and mail-sink variables), 0 failed** (4.2 min); follow toggle feedback 2.6 ms. After the CSS change `follow.spec.ts` + `signin.spec.ts` re-ran: 15 passed, 3 skipped. Rewritten committed screenshots restored with `git checkout` |

## Adversarial read

**Auth and tampering (`app/discovery-actions.ts`).** The viewer id comes only from `currentUser()`; no action takes an id
from the form. The handle is `unknown`, checked against `^[a-z0-9_]{3,20}$` before any query (`traderId`), resolved to a
non-deleted user, and yourself is refused (also a table check). The only exported functions are the eight actions;
`pair`/`run`/`done` are module-private. The redirects interpolate a handle that has passed the pattern and resolved, so
no open redirect. Bound args (`.bind(null, handle)`) are a convenience, not a trust boundary: calling `follow('x')`
directly does exactly what the button does.

**CSRF.** Server actions are POST-only and the framework compares `Origin` with the host; the session cookie is
`sameSite=lax`, so a cross-site form post carries no session. Same stance as F-1's actions. Acceptable.

**Rate limit: non-blocking, recorded.** Abuse potential is low by construction: follows and exclusions are private to the
viewer, never counted, never shown to the trader or anyone else, and never feed a ranking in PR-2 (weights wait for
PR-5). Rows are bounded by the primary keys at one per (viewer, trader), so mass follows grow at most viewers × traders,
and a deleted account takes its rows first. The cost of a burst is a handful of indexed single-row writes per call. A
limit matters when PR-5 turns these into signals (a sybil ring could then shape another viewer's suggestions only
through its own accounts, which the plan already scopes to the viewer). Follow-up R1 below: per-viewer limit on the four
actions before PR-5 or before real viewers (H4), whichever comes first.

**Feed filter (`lib/feed.ts`, `lib/discovery/exclusions.ts`).** Signed out, `viewer` is undefined: no exclusion or
follow read, `kept.mixed` is used unchanged (the signed-out query-log test holds). Signed in, exclusions made by `asOf`
shape the ranked list before the mix (caps exact); later ones filter the slice in place; ended rows are kept a day so a
same-day cursor's list never changes. `exclusionsFor` reads rows with `until > min(asOf, now)` and `reason =
'not_interested'` unless `FEED_HIDES_UNFOLLOWED`. The `to` position uses the unfiltered slice, so positions do not shift.
Losses are not hidden: only a trader the viewer chose to hide leaves *that viewer's* feed; the profile (TR-1) lists every
trade, and ranking by `abs(return_pct)` is untouched. `<style>` in `app/feed-hides.tsx` interpolates only handles that
passed the pattern (no CSS injection).

**`exclude` upsert.** A running "Not interested" is never replaced by an unfollow; a running row keeps `created_at`
(no re-shaping of a live cursor) unless it becomes a row the feed honors. Read correctly.

**Purge (`lib/discovery/purge.ts`, `app/api/sync/route.ts`).** Own session advisory lock (3, distinct from 1 and 2),
tried not waited; `≤ 30 s` box checked between batches of 10,000 (one batch is ~30 ms at 100,000 rows, so the box
holds); runs after the connection tick and the deletion retries, before `syncTick`, inside a `try` so a throw or a lost
lock never skips trader claiming. The lock is released in `finally` on the reserved connection. Correct.

**Deletion order (`lib/delete.ts`).** The deleted mark and both deletes (as viewer and as trader) are one transaction
before the vendor call; `traderId` excludes marked users, so nothing new names them; cascades cover a race.

**F6 / privacy.** `lib/follows.test.ts` scans `app/` and `lib/` for every statement naming the tables (keyed by
`viewer_id = ${viewer}`; nothing counts) and keeps share images, story, pane chart, sitemap and robots free of the follow
modules. The tester's byte and text sweep (re-run 1, R3) found no viewer data in any public output. My new query is keyed
the same way and passes that scan. No third-party names, no advice or signal words in `FOLLOW` (`allCopy()` is in the
copy word test).

**`/me/following`.** Own rows only (`viewer_id = me.id`), `noindex`, signed out redirects to `/login`; query params other
than `back` are ignored.

## Findings

| # | Severity | Finding | Disposition |
|---|---|---|---|
| L1 | non-blocking (tester Low 1) | Own-profile "Settings" link was 61 × 20 px: `.tap`'s 44 px rule is scoped to `.auth` | **Fixed:** `p.settings-link a.tap` gets the 44 px rule (`app/globals.css`, `app/u/[handle]/page.tsx`). Measured 61 × 44 at 320. Placement (tester/UX suggestion to move it) left to the next UX round |
| L2 | non-blocking (tester Low 2) | `/me/following?back=<any handle>` claimed "@x is back in your feed." for anyone | **Fixed:** `lib/follows.ts#shownAgainJustNow` (keyed by viewer): the line shows only when this viewer ended a "Not interested" on that trader in the last minute. Test added (never hidden, unknown handle, still hidden, just shown again, another viewer, ended 2 min ago). Measured: crafted `?back=momentum_maya` shows nothing; a real "Show again" shows the line |
| L3 | non-blocking (tester Low 3, UX follow-up 1) | On `/me/following` at 320/375 a long name hid the handle | **Fixed:** the name, then the handle on its own line (smaller), each cut only if it alone is wider than the column. Measured at 320 with a 36-char name and a 20-char handle: handle 148 px of 148, whole, inside the 44 px link; no page scroll. The pane header case stays a UX follow-up |
| R1 | non-blocking | No rate limit on the four actions | Follow-up: per-viewer limit before PR-5 or real viewers (H4). Justified above |
| R2 | non-blocking | The purge box is checked between batches, so a single slow batch could overrun 30 s on a pathological table | 30 ms per 10,000 rows measured; revisit when PR-5 adds the event log to the same purge |
| R3 | non-blocking | `npm run test:e2e` rewrites committed screenshots under `docs/features/logs/F-2/screenshots/` (also PR-1 review item 5) | Unchanged harness follow-up |

No blocking findings.

## Owner items carried to the PR

`FEED_HIDES_UNFOLLOWED` (fix round 1 set it `false`: unfollow no longer hides from the feed; the owner may reverse),
O1–O3 (O3 default 90 days stands), H1–H4 (H4 before real viewers on PR-2), P1/P2/P5, and the commit-email NOREPLY rule
(`check` fails on author emails; owner's call).

**Verdict: APPROVE.**
