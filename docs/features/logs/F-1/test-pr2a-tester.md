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

## Re-run 1 (after fix round 1)

Date: 2026-10-23. Same branch, at `0ad904f` (fix round 1 in `5722c6d`, `build-pr2a-fix1.md`). No product code changed.
Local Postgres 16; `scripts/db-setup.ts` twice, then with `SEED=1`, all clean.

| Command | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test`, four runs | 391 pass every run, 0 fail, 0 skipped |
| `npm run build` | success. The first attempt stopped after compiling on a framework security advisory prompt (tool output, not acted on beyond a retry); the retry built cleanly, routes as listed in the build log |
| `npm run test:e2e` (`ALLOW_DEV_AUTH=1`, vendor fake on 4102, PR-1 issuer and sink variables) | 65 passed, 0 skipped; all 9 connect tests ran |
| `node scripts/compliance.ts diff origin/main` | only the pre-existing `node_modules/@img/sharp-wasm32` license line |
| `node scripts/autopilot.ts guard main` | `guard: ok` |

**Watch item, "attestation first" (PR-1, `lib/auth/attempts.test.ts`).** It did not fail in the four runs. Reproduced
on purpose: running that one test while a second process inserts attested attempts fails 2 of 3 times with
`expected N, actual N+1`, an off-by-one equal to one concurrent insert. Confirmed: a global `count(*)` race between
parallel test files, not a product defect (the rejected call itself writes nothing). Classified as a separate must-fix
for test robustness (assert on the rejected call's own effect, not a table-wide count), owned by PR-1.

Tester scripts (not committed) drove the built app on port 3201 against the in-repo vendor fake, as a user in a
browser, with database and vendor-state checks after each step. Screenshots at 375 and 360 px, light and dark, in
`screenshots/pr2a/rerun1/` (consent, result declined / failed / not found / abandoned signed in and out / refused
and refused after the claim race, profile importing / importing while deferred / connected / failed owner and
signed out / pending owner and signed out, stale-tab decline after consent and after connected). The server and
the fake were stopped afterwards.

### D1–D9

| # | Check as a user and in the database | Result |
|---|---|---|
| D1 | Signed in, link 2 accounts (1 simulated) → consent page; `POST /api/sync` twice → 0 activities, both claims `confirmed_at` null, state `pending`, `last_synced_at` null, no closed trades. "Don't import" → claims released, vendor link gone, row `declined` with `cleanup_done_at`, activities still 0. | Fixed |
| D2 | Consent with the consent page also open in two stale tabs. "Don't import" in stale tab 1 while importing, and in stale tab 2 after `connected`: both land on the profile; row stays `importing`/`connected`, no `declined_at`/`cleanup_done_at`, the authorization is still at the vendor, confirmed claim kept, the next tick marks no disconnect and the record (2 closes) stays. Expired row re-bundled: link A with a fixed authorization, expire it, link again (B bundles the same authorization), consent, tick → A cleaned, authorization kept at the vendor, B `connected`, 2 closed trades. | Fixed |
| D3 | The seven URLs (`/connect/result`, `?c=abc`, `?c=<20 digits>`, `?c=1.5`, `/connect/consent`, `?c=0`, `?c=NaN`) plus `-1`, a blank, `1e3`, `007`, an 18-digit unknown id and another trader's real id: all 200 "Connection not found." with "Connect a brokerage". `?k=abandoned` signed out is S7a, 200. | Fixed |
| D4 | One page read, then a forced 503 → still `importing`, cursor unchanged, `retries` 1, `retryAt` ≈ 30 s, `last_progress_at` unchanged. A 403 armed and a step before `retryAt` → the 403 is still armed afterwards (no vendor call), still `importing`. Second 503 → `retries` 2, ≈ 60 s. After the backoff, 403 → `failed`, reason `vendor`. | Fixed |
| D5 | After that failure, the tick → activities stay 4 (second account never read), 0 closed trades. Owner profile: "The import did not finish, so this record may be incomplete." as an alert with "Try again" → `/connect`; signed out the same line as a status, no retry, no Verified badge, never "No closed trades yet". The result page for that row reads "Your brokerage stopped the connection before the import finished." | Fixed |
| D6 | Brokerage-first attempt links account X and waits on consent; a signed-in trader links X and consents first (confirmed claim). The attempt taps "Import my record" → `?k=refused`, not signed in; no users row for the attempt, user count unchanged, attempt `user_id`/`completed_at`/vendor id null, vendor user gone at the fake, row `declined` with `cleanup_done_at`, funnel ends `failed` (`claimed`), the other trader keeps the confirmed claim. | Fixed |
| D7 | After consent, `/connect/consent?c=` and `/connect/result?c=` land on `/u/<handle>` with "Importing your record · 0 trades so far", no "Connection not completed". | Fixed |
| D8 | Consent lines read "Every account under this login" then "2 accounts found (1 simulated, not imported)". Failed result line as above. | Fixed |
| D9 | Open-position link 44 px tall. Focus is on `#result-heading` on `?k=abandoned`. Signed in, `GET /connect/done` with no new link → `?k=abandoned`. A user with five feed-worthy closes, visible in the feed and with a 200 share card, then `deleted_at` set: absent from the feed and the ticker page; profile, share card, story image and trade page all 404. | Fixed |

### New in this re-run

1. **Medium · a pending (unconsented) link already shows on the public profile.** With only a `pending` connection,
   the profile reads "1 simulated account excluded: simulated trades are never part of a record." to everyone,
   signed out included (`profile-pending-signedout-*.png`): the count comes from `broker_accounts` provisional rows
   (`app/u/[handle]/page.tsx` counts `is_paper` with no `confirmed_at` filter). That publishes a fact read from the
   vendor before consent (COMPLIANCE §3, consent at collection; the consent screen says "Nothing has been imported
   yet"). Count only confirmed claims. Present since PR-2a; not caught in the first pass.
2. **Low · the S8 empty-record line shows for a trader who never consented.** The record state falls back to
   `connected` whenever the user has a vendor id, so a trader whose only connection is `pending`, `declined` or
   `expired` sees, and visitors see, "No closed trades yet. Your record starts with your first close." instead of
   "No trades yet." (plan §8 item 3: the empty-record line only once an import has finished). Derive `connected`
   from a `connected` connection (or confirmed claims), not from the vendor id.
3. **Low · usability.** On S6b (`?k=refused`, `result-refused-race-*.png`) the whole four-sentence claim message is the
   H1 (about 12 lines of heading text at 375 px, read as one heading by a screen reader). Short heading, the rest as
   body text.

Watch item (separate must-fix, test robustness, PR-1): the "attestation first" global-count race, above.

Verdict: DEFECTS (D1–D9 fixed; new: 1 Medium, 2 Low)
