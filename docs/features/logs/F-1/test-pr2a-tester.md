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

## Re-run 2 (after fix round 2)

Date: 2026-10-23. Same branch, at `d5dfbf6` (fix round 2, `build-pr2a-fix2.md`). No product code changed.
Local Postgres 16; `scripts/db-setup.ts` twice, then with `SEED=1`, all clean.

| Command | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test`, four runs | 392 pass every run, 0 fail, 0 skipped (neither the "attestation first" race nor the schema backfill race appeared) |
| `npm run build` | the first attempt compiled, then stopped on a framework security-advisory prompt. That is tool output and nothing was upgraded. The retry built cleanly with the five F-1 routes present |
| `npm run test:e2e` (`ALLOW_DEV_AUTH=1`, vendor fake on 4102 with the three `SNAPTRADE_*` variables, PR-1 issuer and sink variables) | 66 passed, 0 skipped; all 10 connect tests ran, the new "fix round 2" test included |
| `node scripts/compliance.ts diff origin/main` | only the pre-existing `node_modules/@img/sharp-wasm32` license line |
| `node scripts/autopilot.ts guard main` | `guard: ok` |

Tester scripts (not committed) drove the built app on port 3000 against the in-repo vendor fake in a browser, with
database and vendor-state checks after each step, then deleted their users and claims. Screenshots at 375 and 360 px,
light and dark, plus the share card per state, are in `screenshots/pr2a/rerun2/`. The server and the fake were stopped afterwards.

### Re-run 1 findings

| # | Check as a user and in the database | Result |
|---|---|---|
| 1 Medium | A signed-in trader linked one real account and one simulated account, then stopped at consent. In the DB: `pending`, no `consent_at`, two provisional claims, 0 activities, and still 0 activities and 0 positions after a tick. Signed out, the profile shows only "No trades yet.": no "simulated" text, no positions, no status or alert line, no "Broker connected" (`profile-pending-signedout-*`). The share card (`card-pending.png`) shows no "Broker connected" either | Fixed |
| 2 Low | Record copy per state is in the table below. The S8 line appears only for `connected` with no closes. `none`, `pending`, `declined` and `expired` all read "No trades yet." | Fixed |
| 3 Low | S6b (a provisional claim held by a signed-in trader; a brokerage-first attempt links the same account): the H1 is "We couldn't link that broker account.", 93 px tall at 375 px, with `role="alert"`, `aria-describedby="result-body"` and focus on the heading. The explanation is a paragraph, and the buttons are "Try another login" and "Back to feed". No user row is created, and the attempt is not completed (`result-refused-*`) | Fixed |
| Watch | "attestation first" no longer uses a global count; it passed in 4 of 4 runs. The schema backfill race also did not appear in 4 runs, and the extra `not exists` filter is idempotent and adds no drop, truncate or delete | Closed |

Record copy per state (`.record-body` / status or alert line / owner's "Connect your broker (read-only)" button):

| State | Owner | Signed out |
|---|---|---|
| none | "No trades yet." / "You're in. Next: connect your brokerage." / button | "No trades yet." / none |
| pending | "No trades yet." / none / button | "No trades yet." / none / no simulated count |
| declined | "No trades yet." / none / button (leads to `/connect`) | "No trades yet." / none |
| expired (lazily on the profile read; the tick then released the claims and removed the vendor link) | "No trades yet." / none / button | "No trades yet." / none |
| importing | "Your trades appear here as they import." / status "Importing your record · 6 trades so far" / no button | same lines, plus "1 simulated account excluded" (confirmed at consent) |
| connected | stats and closed trades, Verified, no banner / no button | same, "1 simulated account excluded" |
| failed | "No trades yet." / alert "The import did not finish, so this record may be incomplete." + "Try again" / no button | "No trades yet." / the same line as status, no retry, no Verified |

Result headings: declined "Import not started. Nothing is connected."; expired "The time to decide ran out. Import not
started. Nothing is connected."

### Stall scenario (the engineer's open note)

A signed-in trader linked 2 real accounts and 1 simulated account, consented, and ran one step (6 activities, cursor
`{i:1}`). They then opened `/connect` again; it is not blocked while an import runs. A second link landed on its
consent page, which reads "1 account found", and stayed `pending`.
- Six owner polls of `POST /api/import/step` all returned `{"state":"pending","imported":0,"closes":0}`. The importing
  row's cursor, count and `last_progress_at` did not move.
- The server-rendered profile reads the importing row correctly: the "Importing your record · 6 trades so far" banner
  shows for the owner and for visitors (`profile-stall-owner-*`). The second link's provisional claim stays unconfirmed
  and is not public.
- One tick (`advanced: 1`) finished the first import: `connected`, 10 activities, 5 closes.
- After that, the owner's poll still answers `{"state":"pending","imported":0,"closes":5}`.

So the hourly tick does finish the import, but the client poll stops driving it and misreports the record's state until
the newer link expires 24 h later. A variant shows this is more than a stall:

**Variant: the trader consents to the second link while the first import runs.** The first link has 3 real accounts
with 4 activities each, and one step reads account 1. The second link (1 account, 2 activities) is consented. The polls
now drive only the newest row, which reaches `connected` within 4 polls. The first row is still `importing` at `{i:1}`,
with accounts 2 and 3 never read. `publicRecord` takes the newest consented row (`connected`), so signed out the profile
shows the partial record as whole: Verified, "Connected: broker (2 accounts)", win rate, average return, 3 closed trades
and the chart, with no importing banner and no incomplete line (`profile-two-imports-signedout-*`). The share card shows
the same (`card-two-imports.png`). The next tick finished the first row, and the record went from 3 closes to 7.

### New in this re-run

1. **Medium · a newer connection hides a running import, so a partial record shows as complete.** This breaks TR-3 and
   the meaning of Verified. It reproduces in the browser with the steps above. Cause: two reads take a single
   "latest" connection, while one trader can hold several connections and more than one can be importing.
   - `publicRecord` takes the newest consented row.
   - `POST /api/import/step` uses `latestConnection`, the newest row of any state.
   - Fix:
     - The public state is `importing` while any consented connection is importing, and `failed` when any consented
       connection failed with nothing importing.
     - The step endpoint drives the trader's importing connection(s), not the newest row, and reports that state.
   - Tests: a DB test with an importing row and a newer `connected` row, and another with a newer `pending` row, for
     `publicRecord` and for the step endpoint.
2. **Low · the engineer's stall note is a defect, the same cause as 1.** With a newer pending link, the owner's poll
   reports `pending` and never advances the import, even after the tick has finished it. Today the hourly tick limits
   the harm (up to 200 steps per tick), but PR-2b's 2 s banner built on this endpoint would freeze and never show
   "Import finished." The endpoint's own contract ("the session user's own import") is not met. Fixed by 1.
3. **Low · the share card disagrees with the profile on empty records.**
   - For `failed` the card shows "✓ Broker connected" while the profile says the import did not finish (`card-failed.png`).
     Fix round 2's `state !== 'none'` counts `failed` as connected.
   - For a real trader whose state is `none`, `pending`, `declined` or `expired`, the card is labeled "Demo data"
     (`card-pending.png`) although the trader is not demo data. That label predates this PR for `none`.
   - Fix: "Broker connected" only for `importing` or `connected`, and no "Demo data" label unless the trader's source is demo.

Note (not blocking): the card's ✓ glyph rendered as a missing-glyph box here because the font download failed offline.
This is the sandbox, not the build.

Verdict: DEFECTS (re-run 1's three fixed and both test races closed; new: 1 Medium, 2 Low)

## Re-run 3 (after fix round 3)

Date: 2026-10-23. Same branch, at `60e64b0` (fix round 3, `build-pr2a-fix3.md`). No product code changed. Local
Postgres 16; `db/schema.sql` applied twice with `psql`, then `npm run db:seed`, all clean.

| Command | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test`, four runs | 396 pass in runs 1, 3 and 4. Run 2: 395 pass, 1 fail ("D6: a brokerage-first consent that loses the claim race…", `49 !== 50` on a table-wide `count(*) from users`; see new item 2) |
| `npm run build` | the first attempt compiled, then stopped on a framework security-advisory prompt (tool output; nothing upgraded). The retry built cleanly |
| `npm run test:e2e` (`ALLOW_DEV_AUTH=1`, vendor fake on 4102 with the three `SNAPTRADE_*` variables, PR-1 issuer and sink variables) | 67 passed, 0 skipped; then 68 passed with the feed test added below. The two "fix round 3" tests also passed 3 of 3 runs on their own |
| `node scripts/compliance.ts diff origin/main` | only the pre-existing `node_modules/@img/sharp-wasm32` license line |
| `node scripts/autopilot.ts guard main` | `guard: ok` |

Tester scripts (not committed) drove the built app on port 3000 against the in-repo vendor fake in a browser, with
database checks after each step, then deleted their users and claims. Screenshots at 375 and 360 px, light and dark,
plus the share card per state, are in `screenshots/pr2a/rerun3/`. The server and the fake were stopped afterwards.

### Re-run 2 findings

| # | Check as a user and in the database | Result |
|---|---|---|
| 1 Medium | Stall repro end to end. A signed-in trader linked 3 real accounts (4 activities each) and consented; one poll read account 1 (`{importing, 4}`). A second link (1 account, 2 activities) reached its consent page and stayed `pending`: the next poll answered `importing` (not `pending`) and moved the first row to account 3 (`{i:2}`, 8 imported). The second link was then consented. Signed out: the banner "Importing your record · 8 trades so far", no Verified badge, no `section.stats`, no chart, no "Connected:" line; the unfurl text was the banner line. One poll advanced **both** rows (first `{i:3}`, 12; second `{i:1}`, 2) and answered `{importing, 14}`; the next rebuilt both (7 rows in `closed_trades`), still `importing`, and signed out the 7 trades so far were listed under the banner with no badge, stats, chart or "Connected:" (`stall-importing-signedout-*`, `stall-importing-owner-375-light.png`). The tick (`advanced: 2`) finished both: `connected` and `connected`, 7 closes; the poll then answered `{connected, 14, 7}`. Signed out: no banner, Verified, stats, chart, "Connected:", 7 trades (`stall-connected-signedout-*`); the share card went from "Importing record / Import in progress" to "✓ Verified from broker" with stats | Fixed |
| 2 Low | Same run: with the newer link pending the poll drove the running import and never said `pending` | Fixed |
| 3 Low | Share card per state (images in `rerun3/`): demo profile "Demo data" (`card-demo.png`); a real trader with nothing consented, and one with only a pending link: no label, "No closed trades yet" (`card-real-none.png`, `card-real-pending.png`); importing: "Importing record", "Import in progress", "Stats appear when the import finishes.", no stats (`card-importing-two-links.png`); failed with no closes: amber "Import did not finish", "No closed trades yet", the profile's incomplete line (`card-failed.png`); failed with closes: the same label and line under the stats (`card-failed-partial-retry.png`); connected with no closes: "✓ Broker connected" (`card-real-empty.png`); connected with closes: "✓ Verified from broker" (`card-retry-connected.png`, `card-connected-after-two-links.png`). No "Demo data" on any real trader | Fixed |

The engineer's two additions:

- **A failed import stops counting once a later live connection re-imports all of its real accounts.** Sound, and
  needed: without it "Try again" could never clear the incomplete line. Checked as a user: 2 accounts, one page, then a
  403 → `failed`; owner sees the alert and "Try again", signed out the status line, the card says the import did not
  finish (`failed-owner-375-light.png`, `failed-signedout-*`); a tick leaves it `failed`. "Try again" → `/connect` →
  portal → consent → polls → the new row `connected` (8 imported, 4 closes), the old row stays `failed` in the table,
  and the profile has no failed line and no "Try again", Verified, stats, "Connected:" (`retry-connected-signedout-*`).
  A retry re-reads from offset 0 for each account, so the cleared record is whole. A retry that cannot cover the
  failed accounts (the old authorization removed at the vendor, only account 1 linked again) ends `connected` for the
  new row but the record stays `failed`: the line and the amber card label remain. A re-link while the vendor still
  lists the old authorization bundles both accounts into the new row, which correctly clears it.
- **The feed leaves out traders whose import is still running.** Correct. Checked: a trader with 5 recent closes from a
  finished first link is in the feed; a second link (2 accounts) consented and one step run → `importing`, 5 closes,
  absent from the feed (`feed-importing-omitted-375-light.png`); after the polls finish it (9 closes) they are back.
  The missing automated test was cheap and test-only, so I added it: `e2e/connect.spec.ts` "fix round 3: the feed
  omits a trader whose second import is still running and shows them once it finishes" (recent fake activities so the
  trader ranks; skips without the vendor fake like the other vendor-backed tests). e2e 67 → 68; nothing weakened.

### Regression (D1–D9, Re-run 1)

Quick pass, all still fixed: D1 (pending link, two ticks: 0 activities, no confirmed claim, still `pending`); D3 (the
seven URLs answer 200 "Connection not found.", `?k=abandoned` 200; `POST /api/sync` without the bearer and an anonymous
`POST /api/import/step` both 401); D7 (revisiting the consent page after consent lands on the profile, no
"Connection not completed"); D9 (open-position link 44 px); Re-run 1 item 1 (pending link: signed out "No trades
yet.", no simulated text; after consent and import "1 simulated account excluded"). D2, D4, D5, D6, D8 and the S6b
heading are covered by named unit/e2e tests that passed (D6's in 3 of 4 runs, see item 2).

### New in this re-run

1. **Low · spec (TR-3) · the feed presents a failed import's record as whole.** A trader with 5 closes from a finished
   link whose second import failed (403 after one page) stays in the feed, and the feed pane shows "✓ Verified", the
   chart and stats with no incomplete line (`feed-failed-row-375-light.png`), while the profile and the card both say
   "The import did not finish, so this record may be incomplete." Present since PR-2a (the feed never read the record
   state); not raised in earlier passes. Fix: in the feed, either leave out a `failed` record as an `importing` one is,
   or carry the incomplete line in the pane and drop the Verified badge there; add the case to the new feed e2e.
2. **Low · test robustness · "D6: … leaves no ghost user" counts the whole `users` table.** It failed once in four
   runs with `49 !== 50`: another test file deleted a user between `usersBefore` and the assertion. Same class as the
   "attestation first" race closed in re-run 2. Fix: assert on the attempt's own rows only (the
   `signup_attempt_id = attempt` check already there), not a table-wide count. The product behavior is correct.

Notes (not blocking): the unfurl text for a record with no closes reads "0 verified trades · % win rate · 0.0% avg
return" (same on `main`; with `failed` it is now prefixed by the incomplete line). While importing, the banner's count
is imported activities ("14 trades so far") while 7 closed trades are listed under it; worth aligning the wording in
PR-2b. The card's ✓ glyph rendered as a box here only because the font download failed offline.

Verdict: DEFECTS (re-run 2's Medium and two Lows fixed, both additions sound; new: 2 Low, one TR-3 feed gap and one
test race)

## Re-run 4 (after fix round 4)

Date: 2026-10-23. Same branch, at `d07fe66` (fix round 4 and 4b, end of `build-pr2a-fix3.md`). No product code changed.
Local Postgres 16; `db/schema.sql` applied twice with `psql`, then `npm run db:seed`, all clean.

| Command | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test`, four runs | 398 pass in every run, 0 fail, 0 skipped |
| `npm run build` | the first attempt compiled, then stopped on the framework's security-advisory prompt (tool output; nothing upgraded). The retry built cleanly |
| `npm run test:e2e` (`ALLOW_DEV_AUTH=1`, vendor fake on 4102 with the three `SNAPTRADE_*` variables, PR-1 issuer and sink variables) | 69 passed, 0 skipped. (A first attempt had 2 fail with `EADDRINUSE` because I had started the fakes myself; the specs start their own. Not a product issue) |
| `node scripts/compliance.ts diff origin/main` | only the pre-existing `node_modules/@img/sharp-wasm32` license line |
| `node scripts/autopilot.ts guard main` | `guard: ok` |

Tester scripts (not committed) drove the built app on port 3000 against the in-repo vendor fake in a browser, with
database checks after each step, then deleted their users. Screenshots are in `screenshots/pr2a/rerun4/`. The server and
the fakes were stopped afterwards.

### Re-run 3 findings

| # | Check as a user and in the database | Result |
|---|---|---|
| 1 Low (TR-3, feed) | A trader with 5 recent closes from a finished link (feed pane: Verified, no line), then a second 2-account link consented, one step, a vendor 403 → `failed` (rows `connected` + `failed`, 5 closes). Signed out at 375 and 360 px, light and dark, and at 1280 px: the trader is still in the feed; the **pane** has no Verified badge, the line "The import did not finish, so this record may be incomplete." above the stats (60% win rate, +7.0% avg return), the chart, no horizontal scroll (`feed-failed-pane-*`). The **profile** signed out: no Verified badge ("New record"), the same line, stats, chart, "Connected:", 5 trades (`profile-failed-signedout-*`); owner: the line and "Try again", no badge (`profile-failed-owner-375-light.png`). The **share card**: amber "Import did not finish", stats, the incomplete line, no Verified label (`card-failed-with-closes.png`). **But the feed's trade card itself** (the first thing seen in the swipe feed, before the pane) still shows "✓ Verified" next to the trader's name, with no incomplete line, at every width and scheme (`feed-failed-card-*`) | Pane, profile and card fixed; feed trade card not (new item 1) |
| 2 Low (D6 race) | The test now selects this attempt's own rows (its attempt id or its vendor user id) before and after the refused consent; no table-wide count remains. 4 of 4 unit runs passed it, and the full suite passed 4 of 4 | Fixed |
| Note (banner) | Stall repro, signed out and as owner after every poll: "Importing your record · 0 closed trades so far" with 0 listed (while 4, 8 and then 14 activities were imported), then "· 7 closed trades so far" with 7 listed and 7 in `closed_trades`; the unfurl text is the same line. The count always matches the list | Fixed |

### Regression

- **Stall repro:** 3 accounts, one poll (`{i:1}`); a second link left pending: the poll answered `importing` and moved
  the first row on (`{i:2}`, 8 imported); after consenting the second link the polls drove both rows, rebuilt 7 closes;
  signed out while importing: banner, no Verified badge, no stats, no chart, no "Connected:"
  (`stall-importing-signedout-375-light.png`, `stall-importing-owner-375-light.png`). The tick (`advanced: 2`) finished
  both (`connected`, `connected`); the poll then answered `{connected, 14, 7}`; signed out: Verified, stats, chart,
  "Connected:", 7 trades. Still fixed.
- **Pending privacy (re-run 1 item 1, D1):** a pending link (1 real account with an open position, 1 simulated) after two
  ticks: still `pending`, 0 activities, 0 open positions stored; signed out "No trades yet", no "simulated", no position,
  no "Connected:", no banner, no Verified badge. After consent and import: "1 simulated account excluded" and the
  position appear. Still fixed.

### New in this re-run

1. **Low · spec (TR-3) · the feed's trade card still shows "✓ Verified" for a failed record.** Same finding as re-run 3
   item 1 (my re-run 3 screenshot `feed-failed-row-375-light.png` was this card), fixed in the pane only. The card
   (`TradeCard` in `app/ui.tsx`) takes its badge from the trade's own `verified` flag, so a trader whose import failed is
   shown in the feed with the same badge, beside the same name, that the profile and the pane now withhold, and with no
   sign that the record may be incomplete. On a phone this card is the full first screen; the pane only follows a swipe.
   Fix: pass the record state the feed already reads (`recordStates`) to the card and apply the same `paneTrust()` rule
   (no Verified badge for `failed`, optionally the short incomplete line); extend the "fix round 4 (TR-3)" e2e to assert
   no `.badge.verified` in the row's `article.card`.

Notes (not blocking): the unfurl text for the failed record reads "The import did not finish, so this record may be
incomplete. 5 verified trades · …"; each trade is verified, so this is accurate, but it can move with the unfurl copy to
`lib/copy.ts` in PR-2b as the engineer suggests. The "0 verified trades · % win rate" unfurl for a record with no closes
is unchanged (same note as re-run 3).

Verdict: DEFECTS (re-run 3's test race and banner note fixed, the pane, profile and card fixed; 1 Low left: the feed trade
card still shows Verified for a failed record)

## Re-run 5 (after fix round 5)

Date: 2026-10-23. Same branch, at `5448929` (fix round 5 and 5b, end of `build-pr2a-fix3.md`). No product code changed.
Local Postgres 16; `db/schema.sql` applied twice with `psql`, then `npm run db:seed`, all clean.

| Command | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test`, three runs | 400 pass in every run, 0 fail, 0 skipped |
| `npm run build` | the first attempt stopped on the framework's security-advisory prompt (tool output; nothing upgraded). The retry built cleanly |
| `npm run test:e2e` (`ALLOW_DEV_AUTH=1`, vendor fake variables for 4102, PR-1 issuer and sink variables; fakes started by the specs) | 69 passed, 0 skipped |
| `node scripts/compliance.ts diff origin/main` | only the pre-existing `node_modules/@img/sharp-wasm32` license line |
| `node scripts/autopilot.ts guard main` | `guard: ok` |

Tester scripts (not committed) drove the built app on port 3000 against the in-repo vendor fake (started for this manual
pass only, after e2e). Two traders: one with a finished link (5 closes, `connected`) and one with the same first link
plus a second link that hit a vendor 403 (`connected` + `failed`, 5 closes); each got one published thesis on an AAA
trade. Plus the seeded demo trader. Signed out at 375 px, light and dark. Screenshots in `screenshots/pr2a/rerun5/`. The
test users were deleted, and the server and the fake were stopped afterwards.

### Re-run 4 item 1 and fix round 5 part 2

| Surface | Failed record | Connected | Demo |
|---|---|---|---|
| Feed trade card | no badge; "The import did not finish, so this record may be incomplete." under the header; 0 `.badge.verified` across every card for the trader (`feed-card-fail-375-*`) | ✓ Verified on all 5 cards, no line | Demo |
| Feed pane | no badge, the same line (`feed-pane-fail-375-*`) | ✓ Verified, no line | Demo |
| Profile | no Verified badge ("New record" only), the line (`profile-fail-375-*`) | ✓ Verified | Demo |
| Profile share card | amber "Import did not finish", the line, no Verified label (`card-fail.png`) | Verified label (`card-ok.png`) | Demo (`card-demo.png`) |
| Stock page `/t/AAA`, trade rows and thesis row | still listed and counted, no badge on any row (`stock-rows-375-*`, `stock-theses-375-*`) | ✓ Verified on every row | `/t/TSM`: Demo on all 6 rows (`stock-demo-rows-375-*`) |

No horizontal scroll on the feed, profiles or stock page in either scheme. Re-run 4 item 1 is fixed, and part 2 is
correct for the rows it covers.

### Sweep: other public surfaces that state Verified (`grep -i verified app/`)

Per-symbol labels (stock page heading, compare, stock index, stock share image) describe pooled trades, not a trader's
record, and are left as they are. The per-trader surfaces not covered by fix round 5:

1. **Low · spec (TR-3) · the single-trade share card and the month recap share card still say "✓ Verified from broker"
   for a failed record.** `app/u/[handle]/trade/[sellId]/opengraph-image.tsx` (`t.demo ? 'Demo data' : '✓ Verified from
   broker'`) and `app/u/[handle]/month/[ym]/opengraph-image.tsx` (`r.verified`) ignore the record state. Both are the
   unfurl images of the public trade and month pages (`og:image` on `/u/<h>/trade/<id>` and `/u/<h>/month/<ym>`), so a
   shared link for the failed trader unfurls with the Verified label and the whole-record stats, with no incomplete line
   (`trade-og-fail.png`, `month-og-fail.png`), while the profile card for the same trader says "Import did not finish"
   (`card-fail.png`). The connected trader's and the demo trader's images are right (`*-ok.png`, `*-demo.png`).
   Related, same item: the story image (`app/u/[handle]/story/route.tsx`, offered by "Share my record") shows "Imported
   read-only from the broker" in green and no incomplete line for the failed record (`story-fail.png`); the trade and
   month pages themselves draw no Verified badge but show the whole-record stats without the line (`trade-page-fail-*`,
   `month-page-fail-*`). Fix: read `publicRecord(user).state` in the trade and month loaders and the story route, and use
   the profile card's rule (`shareCardText`/`paneTrust`): no Verified label and the incomplete line when `failed`; extend
   the "fix round 4 (TR-3)" e2e to fetch these three images' text sources or assert on the loaders.

Notes (pre-existing on `origin/main`, not from this PR; not blocking):
- The month recap share card overflows when the month label wraps ("October 2026 · month so far"): for the failed and
  connected traders the disclaimer line is pushed off the bottom of the image (`month-og-fail.png`), and the demo card's
  disclaimer is cut at the edge (`month-og-demo.png`). A performance image without the full disclaimer is a POLICY gap
  worth its own fix.
- The "✓" glyph renders as an empty box in the trade and month share cards (font has no glyph); the profile card avoids it.
- The trade page's meta description reads "30 verified trades" for the demo trader.

Verdict: DEFECTS (re-run 4's feed card fixed, and fix round 5 part 2 correct on the stock page; 1 Low left: the trade and
month share cards and the story image still present a failed record as verified)

## Re-run 6 (after the committee fix round, `build-pr2a-fix4.md`)

Date: 2026-10-23. Same branch, at `ae7ec19`. No product code changed. Local Postgres 16; `db/schema.sql` applied twice
with `psql`, then `npm run db:seed`, all clean.

| Command | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test`, four runs | 413 pass in every run, 0 fail, 0 skipped |
| `npm run build` | the first attempt stopped on the framework's security-advisory prompt (tool output; nothing upgraded). The retry built cleanly |
| `npm run test:e2e` (`ALLOW_DEV_AUTH=1`, vendor fake variables for 4102, PR-1 issuer and sink variables; fakes started by the specs) | 72 passed, 0 skipped |
| `node scripts/compliance.ts diff origin/main` | **2 violations**: the pre-existing `node_modules/@img/sharp-wasm32` license line, and a new `lib/connections.test.ts:964 [secret] hard-coded secret` (item 1 below). The fix log reports only the first |
| `node scripts/autopilot.ts guard main` | `guard: ok` |

Tester scripts (not committed) drove the built app on port 3000 against the in-repo vendor fake, started for this pass
only after e2e had finished. Screenshots in `screenshots/pr2a/rerun6/`. Test users deleted; server and fake stopped.

### As an attacker: the takeover

| Attempt | Result |
|---|---|
| Owner: `/login` → attest → "Connect a brokerage instead" | lands on `/connect` (no id in the URL), `connect_attempt` cookie httpOnly, Lax, path `/connect`; primary shown (`s2-owner-375x667.png`) |
| Second browser, no cookie, guessed id: `/connect?attempt=N` | "Sign in first, then connect.", no primary (`s2-stranger-guessed-id-375x667.png`) |
| Same browser: `/connect/start?attempt=N`, `/connect/done?attempt=N`, and both with `N+1` | 307 → `/login` every time |
| Third browser holding its **own** bound attempt, presenting the owner's id at start and done | 307 → `/login` |
| Owner's id with the third browser's valid signature spliced in (`N.<other sig>`) at `/connect/start` | 307 → `/login` |
| Stranger hits `/connect/done` (no id) while the owner's portal is open | 307 → `/login` |
| Stranger opens the owner's `/connect/consent?c=<id>` | "Connection not found." (`consent-stranger-375x667.png`) |
| Refusals logged on the owner's attempt | 5 `failed` events, each exactly `{"reason": "unbound"}`; unknown ids wrote nothing |
| Owner's attempt after all of the above | no vendor user, no connection, no user; the owner then completed normally |
| Double tap: two tabs of the owner submit "Import my record" at the same moment | exactly 1 user for the attempt; the attempt is completed and holds no vendor user; the user holds it; the cookie is gone. The losing tab lands on `/connect` (signed in) |

The takeover is closed.

### Production refuses the base-URL override (`next start`, `NODE_ENV=production`, port 3199)

| Environment | `/`, `/how`, `/connect/start`, `/u/<demo>`, `/api/sync` |
|---|---|
| remote `https://vendor.example`, no override | all 500, "Failed to prepare server … SNAPTRADE_BASE_URL is for tests only and must not be set in production." |
| remote with `ALLOW_DEV_AUTH=1` | all 500, same message |
| loopback without `ALLOW_DEV_AUTH` | all 500, same message |
| look-alike `http://127.0.0.1.vendor.example` with `ALLOW_DEV_AUTH=1` | all 500, same message |
| loopback `http://127.0.0.1:4102` with `ALLOW_DEV_AUTH=1` | serves (200, 200, 307, 200, 405 for GET) |
| unset | serves |

### Cleanup and the 24 h sweep

- Signed-in decline: the row is `declined`, `accounts = []`, `institution` null, `cleanup_done_at` set, timestamps kept.
- Pending link aged 25 h + tick: `expired`, `accounts = []`, `institution` null, cleaned.
- Brokerage-first decline: connection blanked and cleaned, the attempt holds no vendor user or secret, and that vendor
  user is gone from the fake; no user created.
- Abandoned brokerage-first attempts (portal opened, nothing linked): the one aged 25 h was swept by the tick (vendor
  user deleted at the fake, both columns null); a fresh one and one aged 23 h were left alone.

### As a user (375×667)

- `/login` → attest → "Connect a brokerage instead" → "Connect brokerage (read-only)" → (portal) → consent: 3 app taps
  to consent, 4 to the importing profile. Consent: "Import my record" spans y 548–593 with no scroll; the page says
  "Decide within 24 hours, or this link is removed automatically.", no "UTC", the merged scope line, no repeated notice
  (`consent-375x667-light.png`).
- Importing profile (0 listed): banner + "Your trades appear here as they import.", no "Your record is live.", no
  "Share my record" (`profile-importing-brokerage-first-375x667.png`). With 7 trades listed and still importing: banner
  only, no importing line (stall run).
- Failed record owner: no "Your record is live.", no "Share my record", no new-trades prompt; "Try again" is the only
  primary, 101×44 px (`profile-failed-owner-375x667.png`).
- Email sign-in with an empty profile, light and dark: lands on `/connect` "Before you connect" signed in, primary shown,
  a "Your profile" link 44 px tall that opens the profile with "You're in. Next: connect your brokerage."
  (`signin-email-lands-notice-375x667-*.png`). No horizontal scroll.

### Regression

- Stall repro: the second consented link no longer blocks; after the tick both rows are `connected`, 7 closes, banner gone.
- Pending privacy: after two ticks a pending link has imported no activities or positions and the signed-out profile
  shows none; after consent the simulated-account line and the position appear.
- Trust rule, signed out at 375 px, light and dark (failed / connected / demo): feed card and pane (no badge + the
  incomplete line / ✓ Verified / Demo), profile ("New record" only + line / ✓ Verified / Demo), stock page rows (no badge
  / ✓ Verified), and the three images for the failed trader (profile card, trade card, month card, story: "Import did not
  finish", the incomplete line, the full disclaimer). Trade and month page descriptions say "closed" for the failed
  trader and "demo" for the demo trader. No horizontal scroll.

### Findings

1. **Medium · bug (CI) · the compliance check fails on the new test.** `node scripts/compliance.ts diff origin/main`
   flags `lib/connections.test.ts:964` (the `const secret` literal, a 16-character test value) as a hard-coded secret. CI runs this on
   every PR, so the PR is blocked; the fix log reports only the pre-existing license line. Fix: a value the rule
   already treats as a placeholder (for example one containing `fake`, or shorter than 12 characters) in the test.
2. **Low · spec (TR-3) · the profile's unfurl description still says "verified" for a failed and a demo record.**
   `app/u/[handle]/page.tsx#generateMetadata` writes `${s.trades} verified trades` in every state other than
   importing: the failed trader's profile link previews as "The import did not finish, so this record may be
   incomplete. 5 verified trades · …", and the demo trader's as "30 verified trades · …". The trade and month pages
   already use `recordCountText` ("closed" / "demo"); the profile, the link most often shared, does not. Fix: the same
   `recordCountText` in the profile description.

Notes (not blocking): a profile with no closed trades previews as "0 verified trades · % win rate · 0.0% avg return"
(pre-existing on `origin/main`). The engineer's residual (a victim entering credentials into a portal session an
attacker opened) stands for PR-2b's embedded portal.

Verdict: DEFECTS (takeover closed, production guard, cleanup, sweep and every usability demand verified; 1 Medium: the
compliance check fails on a test string; 1 Low: the profile unfurl description says "verified" for failed and demo records)
