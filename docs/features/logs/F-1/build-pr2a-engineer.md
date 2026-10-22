# F-1 · PR-2a build log · Engineer

Date: 2026-10-22. Branch `claude/adoring-euler-4469ys` (equal to main after PR-1). Built from `plan.md` §1 (PR-2a scope),
§3 (connections, broker_accounts additions, open_positions), §4 (tests), §5 (funnel events), §7 (compliance) and §8
(round-2 changes: tick advances importing rows, stale → failed, lazy marking, chunked resumable import, advisory lock,
vendor delete on decline/expiry/no-real-account), with the §9 default for simulated accounts (exclude and count). No
decision in `docs/features/F-1-broker-connection.md` changed. No new dependency; `package.json` untouched.
`lib/broker.ts` edited under the owner's F-1 pre-authorization (vendor surface only; `connectionType: 'read'` and the
secret encryption unchanged). Nothing committed or pushed.

## What PR-2a delivers (server)

- **State machine** (`lib/connections.ts`): `pending → importing | declined | expired`, `importing → connected | failed`,
  one `<state>_at` timestamp per state, illegal transitions throw `IllegalTransitionError`; `clockState()` is the pure
  form of the two clocks (24 h pending → expired; 24 h without progress → failed, reason `stale`).
- **Zero-depth link validation** (`completeLink`): back from the portal the vendor's accounts are listed, a `connections`
  row is written with the account snapshot (ids, institution, paper flag, vendor initial-sync flag), provisional claims
  (`broker_accounts.confirmed_at null`, `connection_id`) are inserted for a signed-in trader, **no activity is read**.
  Outcomes: consent (S4), none (S6c: only simulated accounts → declined, `no_real_account`, vendor link and vendor user
  deleted, no user row), refused (claimed by another profile → link dropped, existing message), sign-in (mechanic (a):
  every real account confirmed-claimed by one existing trader → that trader is signed in, the attempt completed, the
  new link dropped), nothing (no new authorization).
- **Consent** (`consent`): the tap is `consent_at`; creates the users row for a brokerage-first attempt (the attempt's
  attestation precedes it; the vendor user registered on the attempt moves to the user), confirms the claims under the
  per-user advisory lock, moves to `importing` with the cursor at the start. **Decline** (`decline`): `declined`, funnel
  `declined`, cleanup.
- **Chunked, resumable import** (`importStep`): one vendor page per step, one transaction per step under
  `pg_advisory_xact_lock(1, user_id)` taken before the row lock (so a step and an hourly sync never interleave and never
  deadlock), cursor `{i, offset, pass}` in `import_cursor`, `imported_count` and `last_progress_at` per step. At the end
  of a pass: `closed_trades` rebuilt once and positions stored; then the vendor's `initial_sync_completed` flag is
  checked (re-checks throttled to 30 s, no progress recorded while waiting); complete at link time → `connected`; else
  one more pass after the vendor finishes, then `connected` (`import_finished` with trades and seconds). A vendor 4xx on
  a step → `failed` (`vendor`); any other error rolls the step back and leaves the row for the next step/tick.
- **Client poll endpoint** `POST /api/import/step` (session user, own import only): one step, returns state and counts.
  The polling banner itself is PR-2b.
- **Tick** (`tick`, called from `POST /api/sync`): clocks for every row, every `importing` row driven (bounded steps per
  tick), cleanups retried where `cleanup_done_at` is null; then deletions a failed vendor call left marked
  (`users.deleted_at`) are finished, then the hourly sync for users with no import in progress.
- **Lazy marking** (`applyClocks`): the profile, the consent page, the result page and the step endpoint apply the
  clocks on read (marking only), so the rules hold before request #7 is granted; cleanup stays with the tick.
- **Cleanup** (`cleanup`): the authorization(s) deleted at the vendor (404 counts as gone), the vendor user deleted when
  no users row exists (and the attempt's vendor columns cleared), provisional claims released, confirmed never,
  `cleanup_done_at` set; retried by the tick on failure.
- **Sync lock** (`lib/sync.ts#syncUser`): one transaction per user with `pg_try_advisory_xact_lock`; a concurrent sync
  returns `'skipped'`; claims, activities, rebuild and positions are all inside it, so a failure anywhere leaves the
  record exactly as before. Paper flags re-read on every sync (`claimIn` upsert); paper accounts never fetched.
  TR-5: a `connected` connection none of whose accounts the vendor still lists gets `disconnected_at`; nothing deleted.
- **Claims** (`lib/claims.ts#claimIn`): the claim inside a caller's transaction, provisional or confirmed, upsert that
  never clears `confirmed_at`; `claimAccounts` keeps its signature for existing callers and tests.
- **Vendor surface** (`lib/broker.ts`): `basePath` from `SNAPTRADE_BASE_URL` (tests only), `registerUser(ref)` accepts
  `attempt-<id>`, `listAccounts` (authorization id, institution, `is_paper`, `initial_sync_completed`),
  `fetchActivitiesPage(accountId, offset, limit)`, `fetchPositions` (symbol + unrealized percent from price × units
  against cost basis; nothing else leaves the module), `deleteConnection`, `deleteUser`; the activity mapping is shared
  with the existing `fetchActivities`.
- **Positions** (`lib/positions.ts`): `open_positions` replaced as a set at import end and on every sync.
- **Pages**: `/connect/start` (signed in, or brokerage-first `?attempt=` bound to the browser by the signed
  `connect_attempt` cookie), `/connect/done`, `/connect/consent` (S4 copy, "N accounts found (M simulated, not
  imported)", deadline line, "Import my record" / "Don't import"), `/connect/result` (S6, S6 expired, S6c, S7a/b/c and
  stale, `role="alert"` on errors, one retry and one way out), `/how` (POLICY F3: what Verified means, the FIFO math in
  the words of `lib/trades.ts`, what is excluded and counted, percent-only, disconnect and deletion), `/settings` (S9:
  view 1 explains and its "Delete my profile" is a link to view 2; view 2 "This cannot be undone." and the only
  deleting action; "Keep it" on both; sign-out), footer `nav.legal` with Terms / Privacy / How on every page,
  `notice_seen` once per attempt, the profile's body copy by state (`recordBodyCopy`: S5 line while importing, S8 line
  only when connected with no closes), a server-rendered `role="status"` line with the import count, open positions
  (symbol + percent) before the closed trades, "N simulated account(s) excluded" beside the excluded sells.
- **Deletion** (`lib/delete.ts`): `defaultDeleteDeps` now calls `lib/broker.ts#deleteUser` (404 = already gone), closing
  PR-1's `ponytail`.
- **Schema** (`db/schema.sql`, idempotent, through the PR-1 helpers): `connections` (the six states, one timestamp
  each, `consent_at`, `import_cursor`, `imported_count`, `last_progress_at`, `failure_reason`, `portal_mode`,
  `accounts`, `cleanup_done_at`, `disconnected_at`), `broker_accounts` + `connection_id`, `confirmed_at`, `removed_at`,
  `is_paper`, `paper_seen_at` (pre-F-1 rows backfilled as confirmed), `open_positions` (percent only). No drop,
  truncate or delete from. Applied twice plus seed on an empty schema.
- **Copy** (`lib/copy.ts`): `CONSENT`, `RECORD_BODY`, `RESULT`, `HOW`, `SETTINGS`, `FOOTER`, all through the banned-list
  test; the trust notice wording is unchanged (the vendor reports an independent audit of its security controls,
  never an audit of any record).

## Files

New: `lib/connections.ts`, `lib/positions.ts`, `app/connect/actions.ts`, `app/connect/consent/page.tsx`,
`app/connect/result/page.tsx`, `app/api/import/step/route.ts`, `app/how/page.tsx`, `app/settings/page.tsx`,
`e2e/fakes/vendor.ts`, `e2e/connect.spec.ts`, `lib/connections.test.ts`, `lib/sync.test.ts`, `lib/broker.test.ts`.
Changed: `lib/broker.ts` (pre-authorized), `lib/sync.ts`, `lib/claims.ts`, `lib/copy.ts`, `lib/delete.ts`,
`db/schema.sql`, `app/connect/start/route.ts`, `app/connect/done/route.ts`, `app/connect/page.tsx`,
`app/api/sync/route.ts`, `app/layout.tsx`, `app/u/[handle]/page.tsx`, `app/globals.css`, `.env.example`,
`lib/copy.test.ts`, `e2e/signin.spec.ts` (see "Existing tests touched").

Product diff (excluding tests, e2e and docs): 13 files, 381 added / 86 removed; with the lib/app additions counted as
new files, 887 added / 86 removed, about 800 net, at the cap.

## Tests added (unit 361 → 383; e2e 56 → 63)

| File | Covers (acceptance criterion → assertion) |
|---|---|
| `lib/connections.test.ts` (6 unit + 9 DB) | six states and the exact legal transitions (every other pair throws); clocks at 24 h; cursor; body copy by state (S8 line never while importing); ownership by user or signed attempt cookie; schema shape (a timestamp per state, F-1 claim columns, positions percent-only, no drop/truncate/delete). DB: **link writes the row and provisional claims only, no activities; consent confirms and starts; one page per step; rebuild once; positions; connected; funnel rows clean**; **decline releases provisional claims (re-claimable by another trader), confirmed never, vendor link removed**; **brokerage-first: no user row until consent, attestation first, vendor user moves; S6c creates no user row and deletes the vendor user**; **sign-in by connection; a different signed-in trader refused; partial overlap refused**; **expiry at 24 h lazily on read, cleanup by the tick, never pending older than 24 h**; **stale importing → failed after 24 h lazily; a 500 mid-step rolls back the whole step; a 4xx → failed (vendor)**; **tick advances an importing row with no client poll, waits on the vendor's initial-sync flag with throttled re-checks, re-reads once after it completes so late rows are not missed**; **paper accounts claimed, excluded, counted, and a real account flagged paper on a later sync stops being imported**; **concurrency: four simultaneous steps consume four pages in order, each once, final state equal to a sequential run** |
| `lib/sync.test.ts` (1 unit + 3 DB) | **two syncs for one trader: one runs, the other is skipped, the vendor is never called twice at once, re-sync idempotent**; **a failure anywhere (positions, rebuild) leaves activities, closed_trades, claims and positions byte-identical**; **disconnect after connecting marks `disconnected_at`, the record freezes, nothing deleted** |
| `lib/broker.test.ts` (2) | `unrealizedPct`; the real SDK against the HTTP fake: register, read-only portal URL, accounts with paper and sync flags, paging by offset, positions, delete connection, delete user |
| `lib/copy.test.ts` (+1, and the existing banned-list test now walks 60+ strings) | trust notice unchanged and never an audit of records; consent depth lines; S6/S6c/S7 and S9 strings; `/how` says what Verified means and lists every exclusion, no completeness claim |
| `e2e/connect.spec.ts` (7) | `/how` content and the legal footer on eight pages (44 px links; light and dark screenshots); `/settings` two taps, the first deletes nothing, the second deletes and reserves the handle, profile 404; signed-in flow S2 → fake portal → S4 (counts with simulated) → zero depth → importing copy and status line → steps → connected with positions, simulated count, signed-out read; decline (S6 copy, vendor state, claim released, connect again); brokerage-first (consent creates the user and signs in; S6c with no user row and the vendor user gone); sign-in by connection and the refusal of a different signed-in trader; expiry with a clock (consent read redirects to the expired result; tick cleans at the vendor) and **tab closed mid-import, tick run, profile finished**. The vendor-backed five skip with a message when the server has no `SNAPTRADE_BASE_URL` (CI's situation until request #12). |

The fake vendor (`e2e/fakes/vendor.ts`) is an in-repo HTTP server with register/login/portal, accounts (paper flag,
`initial_sync_completed`), paged activities, positions, delete connection, delete user, and test controls
(`/_scenario`, `/_sync` to flip the flag, `/_fail`, `/_state`). `lib/broker.ts` reaches it through the SDK's `basePath`.

## Commands run

| Command | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` with the local Postgres 16, runs 1 / 2 / 3 (and 4 more while chasing one flake) | 383 tests, 383 pass, 0 fail, 0 skipped on 7 of 8 runs; one run had 1 failure that did not reproduce in 7 further runs (name not captured; the suite was run four more times with `not ok` captured: none). Noted as a watch item below. |
| `npm test` without `DATABASE_URL` | 383 tests, 357 pass, 26 skipped ("no DATABASE_URL") |
| `npm run build` | success; new routes `/api/import/step`, `/connect/consent`, `/connect/result`, `/how`, `/settings` |
| `npx playwright test` against `npm run start` (`ALLOW_DEV_AUTH=1`, `SNAPTRADE_BASE_URL=http://127.0.0.1:4102`, `SNAPTRADE_CLIENT_ID=e2e`, `SNAPTRADE_CONSUMER_KEY=e2e`, the PR-1 issuer and sink variables), twice | 63 passed, 63 passed (53 s) |
| `npx playwright test e2e/connect.spec.ts` against a server with no vendor variables (CI's situation) | 2 passed, 5 skipped with their reason |
| Schema on an empty schema | `scripts/db-setup.ts` twice, then `SEED=1`: all columns present, seed ok |
| `node scripts/compliance.ts diff origin/main` | the one pre-existing violation only (`node_modules/@img/sharp-wasm32`, identical on `main`); nothing from this diff |
| `node scripts/autopilot.ts guard main` | `guard: ok` |

Screenshots written by the spec: `how-light.png`, `how-dark.png`, `s4-consent.png`, `profile-connected.png` (375 px).

## Existing tests touched (no assertion dropped)

- `e2e/signin.spec.ts`: the footer now carries Terms / Privacy / How on every page (POLICY F3), so five PR-1 locators
  (`Terms`, `Privacy Policy`, `How records are calculated`) became ambiguous; they are scoped to `main` with the same
  assertions. The "unchecked attestation" test compared a global `signup_attempts` count before and after, which raced
  with the dev sign-ins of the other workers (the same latent race PR-1's fix rounds removed from three other tests);
  it now asserts the same fact per browser: after each blocked submit the URL is `/login?…error=attest` with no
  `attempt=`, no `login_attempt` / `auth_tx` / `connect_attempt` cookie exists (every path that writes an attempt sets
  one or redirects with its id), and no link row carries the typed address. The unused `attempts()` helper was removed.
- `lib/reflections.test.ts` allows `delete from` only on `closed_trades` inside `lib/sync.ts`; the positions
  replacement therefore lives in `lib/positions.ts` (derived data, like `closed_trades`), not in `sync.ts`.

## Not done, or done differently, and why

1. **Provisional claims before a user row exists.** `broker_accounts.user_id` is `not null`, and relaxing it would need a
   `drop not null`, which CI forbids. For a brokerage-first attempt the provisional claim is the account snapshot on the
   `connections` row; the claim check at link time reads `broker_accounts` (confirmed or provisional rows by anyone →
   refused, or sign-in when all are one trader's), and the rows are inserted, confirmed, at consent under the lock (a
   race there → `AccountClaimedError` → refused + cleanup). Signed-in traders get real provisional rows at link time, as
   planned. Decline/expiry release exactly what was written.
2. **S6c, sign-in-by-connection and refusals are recorded as `declined`.** The six states are the owner's; none fits "the
   link was dropped by the app" better. Each case is distinguishable by its funnel event (`no_real_account`,
   `failed{reason:'claimed'}`, the attempt's `user_id` for sign-in) and the result page takes the kind in the redirect.
3. **`imported_count` counts activities read**, duplicates included on a second pass; the record dedupes on
   `(source, external_id)`. The banner (PR-2b) may show "N trades so far" from this or from `closes` returned by the
   step endpoint; both are returned.
4. **The S5 banner is server-rendered**, one `role="status"` line with the count on load; the 2 s poll, the 5 s
   announcement cap and "Import finished." are PR-2b's client. The endpoint it polls exists.
5. **`/api/import/step` is a POST by the session user only**; it never takes a connection id from the client.
6. **Vendor e2e in CI** waits on request #12 (the three `SNAPTRADE_*` variables for the e2e job; `playwright.config.ts`
   is owner-only). The five vendor-backed tests skip with a message until then; the fake needs no secrets.
7. **One unit-suite flake** (1 of 8 runs, name not captured) is a watch item for the tester; the concurrency tests use
   real timing (60–150 ms delays) and the most likely candidate is the sync-lock test's `maxInFlight` under a slow
   machine. No test was loosened.
8. **Disconnect detection** is the simplest honest rule (no claimed account listed any more → `disconnected_at`); the
   vendor's "disabled authorization" signal is a follow-up.

## Compliance checklist (docs/COMPLIANCE.md §1) for this diff

1. **Performance shown?** Yes: the profile now shows open positions as percent only and a state-driven empty line; no
   stats while importing or empty; the disclaimer footer is on every page and now links Terms, Privacy and `/how`
   (POLICY F3). `/how` states what Verified means (broker-sourced, read-only, no identity, completeness or endorsement)
   and what is excluded and counted.
2. **Personal data?** Vendor ids and the encrypted vendor secret on `signup_attempts` only until consent moves them to
   the user; deleted with the vendor user on decline/expiry/S6c; `connections`, `broker_accounts`, `open_positions`
   and `funnel_events` hold ids, flags, counts and timestamps only (tested: no `@`, 7+ digit run or handle in events).
   Profile deletion now deletes the vendor user for real and retries from the tick.
3. **Money?** No. Positions store no units, prices or amounts (schema test).
4. **Email/SMS/tracking?** None added.
5. **User text?** None.
6. **Sign-up/age/identity?** Yes: the brokerage-first user row is created at consent from an attested attempt (tested at
   the DB level: no user row before consent, `signup_attempt_id` set); sign-in by completing a connection only when
   every real account is confirmed-claimed by one trader.
7. **Vendor/dependency/asset?** No dependency; the fake is in-repo; `SNAPTRADE_BASE_URL` documented as tests-only.
8. **Screen reader/keyboard?** `role="status"` + `aria-live="polite"` for the import line, `role="alert"` with a
   focusable heading on error results, 44 px controls and footer links, no motion.
9. **Security posture?** `connect_attempt` is a signed, httpOnly, path-scoped cookie; every connection read or action
   checks ownership (user or cookie); the step endpoint is session-only; the cron bearer check is unchanged; vendor
   errors are logged by status only; the vendor base URL override is never defaulted.
10. **Claims in copy?** Every new string in `lib/copy.ts` passes the banned-list, marks and promo tests; the trust notice
    is byte-identical to PR-1; `/how` makes no completeness claim.
11. **Checkout?** No.
