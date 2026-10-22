# F-1 · PR-2a test log · Tester

Date: 2026-10-22. Branch `claude/adoring-euler-4469ys` (PR-2a on merged PR-1). Inputs: `plan.md`, the engineer's
build log, the feature file, the diff vs `origin/main`. No product code changed. Local Postgres 16; schema applied
twice with `psql`, then seeded, both clean.

## Results

| Command | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` with `DATABASE_URL`, five runs | 383 pass every run, 0 fail, 0 skipped; the engineer's flake did not reproduce |
| `npm run build` | success, five new routes present |
| `npm run test:e2e` (fake vendor on 4102, `ALLOW_DEV_AUTH=1`) | 60 passed, 3 skipped (PR-1 provider/email-sink tests, no issuer variables); all 7 connect tests ran |
| `node scripts/compliance.ts diff origin/main` | only the pre-existing `node_modules` license line |
| `node scripts/autopilot.ts guard main` | `guard: ok` |

Tester scripts (not committed) drove the lib against the DB with an in-memory vendor and the built app on port 3201
with the HTTP fake. Screenshots at 375 and 360 px, light and dark, in `screenshots/pr2a/` (how, consent, settings
both views, every result state, connect signed out, profile importing / connected / signed out / after a failure).

## Conformance

Passing tests assert: zero-depth link (no activities, provisional claims only); consent before `importing`; decline
and 24 h expiry remove the vendor link and release provisional claims, confirmed never; sign-in by connection, refusal
of a different signed-in trader and of a partial overlap; no user row before consent, attestation first; paper
accounts claimed, excluded, counted, consent line with counts; two syncs never interleave, failure atomicity; TR-5
freeze; positions percent only; stale → failed at 24 h; the tick advances imports with no tab; concurrent steps
consume each page once; funnel rows free of personal data; `/how`; two-step deletion.

Gaps (nothing asserts them): the hourly sync of a `pending` user (defect 1); the vendor state after a decline on a
non-pending row (the existing test encodes defect 2); pages without a valid `c` (3); the sync after a `failed`
import (5); the losing brokerage-first consent (6).

Checked by hand, fine: double consent; decline after decline; zero accounts (`nothing`); 5 accounts with one paper;
step endpoint session-only, replay a no-op; 5xx mid-step rolls the cursor back; deletion during an import; the dev
stub path (every e2e uses it).

## Defects

1. **High · consent bypass by the hourly tick.** `POST /api/sync` syncs every user with a vendor id and no
   `importing` row, so a signed-in trader whose link is `pending` is synced: `syncUser` confirms the provisional
   claims, imports the full history (since 2000 on a first link) and builds `closed_trades`. A later decline releases
   nothing. Repro: dev sign-in, connect through the fake to the consent page, `POST /api/sync` → activities 0 → 6,
   claims confirmed, state still `pending`; the profile shows 3 closed trades, stats and the chart under "Importing
   your record · 0 trades so far" (`profile-importing-375-*.png`). Sync only confirmed accounts; never confirm from a sync.
2. **High · a replayed decline removes the vendor link of a consented connection.** `decline()` always calls
   `cleanup()`, which deletes every authorization in the row's snapshot. Repro (lib): consent, then `decline(id)` →
   state stays `importing`/`connected` but `deleteConnection` ran; the next step fails or the next sync marks
   `disconnected_at`. Same cause: an `expired` row not yet cleaned is listed as "fresh" again by `completeLink` and
   bundled into a new pending connection, which the tick's cleanup then cuts at the vendor.
3. **High · 500 on `/connect/result?k=abandoned`, `/connect/result` and `/connect/consent` without `c`.**
   `Number(undefined)` is `NaN`; `applyClocks(now, { id: NaN })` sends `'NaN'` to a bigint. `/connect/done` redirects a
   signed-out trader with no new link to `?k=abandoned`, so S7a is a server error.
4. **Medium · a vendor 429 or 401 fails the import for good.** Every 4xx on a step → `failed` (`vendor`); rate limiting
   is plausible with 5 accounts and 200 steps per tick. Repro: page throws `{status: 429}` → `failed`.
5. **Medium · after a `failed` import the hourly sync publishes a partial Verified record.** Stale mid-pass (second
   account never read) → the next sync reads since `max(executed_at) − 7 d`, rebuilds, and the profile shows the
   partial record as if connected ("No closed trades yet…" or stats), no error, no retry. Repro: lib (2 of 6
   activities, 1 close, `verified = true`); route (403 → failed, tick → record appears).
6. **Medium · a brokerage-first consent that loses the claim race leaves a ghost user.** The user row is created
   before the claim transaction; on `AccountClaimedError` it stays (vendor user moved onto it, attempt completed),
   and cleanup finds no vendor user on the null-user connection: link and vendor user survive.
7. **Medium · revisiting the consent page after consent shows an error.** `/connect/consent?c=<id>` redirects to
   the result page, whose fallback for `importing`/`connected` is "Connection not completed. Nothing was saved."
   with `role="alert"` while the import runs. Send those states to the profile.
8. **Low · copy.** The consent line reads "(2 accounts found, 1 simulated, not imported)" rather than the plan's
   "N accounts found (M simulated, not imported)". "Nothing was saved" (S7b) and "Your record is unchanged" (stale)
   are untrue once pages were read.
9. **Low · usability.** Open-position symbol links are 20 px tall. Error results carry `role="alert"` but nothing
   moves focus to the heading. Signed in, a portal return with no new link lands on the profile silently. A
   `deleted_at` user whose vendor deletion failed stays public until the tick (delete.ts says S9 hides marked rows).

Fine: keyboard-only consent and two-step deletion (first Enter deletes nothing); 2 px focus ring; primary and
secondary controls ≥ 44 px; no horizontal scroll at 375 or 360; disclaimer and legal footer everywhere; dark mode.

## Compliance scan of the diff

No third-party names beyond the integrated vendor; no advice or promise words; trust notice byte-identical, "audit"
is the vendor's report of its own controls, never of a record; logs carry ids and status only; funnel rows free of
personal data. §3 consent at collection: defect 1 collects before it. §7: attestation precedes every user row
(defect 6 makes a user with no completed link). §9: defect 9. §10: cron bearer unchanged, step endpoint
session-only, cookie signed and path-scoped.

Verdict: DEFECTS
