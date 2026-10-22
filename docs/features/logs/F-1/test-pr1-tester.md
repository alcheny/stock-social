# F-1 · PR-1 test report · Tester

Date: 2026-10-22. Branch `claude/adoring-euler-4469ys` (3964b94) vs `origin/main`. Inputs: the plan, the engineer's
log, the feature file, the diff. No product code changed. Local Postgres 16, schema applied twice, demo seed,
production build started with `ALLOW_DEV_AUTH=1` and the in-repo OIDC and email fakes configured.

## 1. Checks

| Command | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` with `DATABASE_URL`, 4 runs | 355 tests; **1 fails in 2 of 4 runs**: `lib/claims.test.ts` "schema applies twice", `deadlock detected` (40P01). The file alone: 8/8 |
| `npm test` without `DATABASE_URL` | 344 pass, 11 skipped |
| `npm run build` | success |
| `npx playwright test` (fakes configured) | **49 passed** (41 on main + 8); the log's "46 → 55" is miscounted |
| `node scripts/compliance.ts tree` | one pre-existing dependency finding, identical on main |
| `node scripts/autopilot.ts guard main` | ok |

## 2. Conformance (PR-1 criteria, plan §4 + feature file)

- Sign-in via either provider or email link, attestation before any user row on every method: tested
  (`e2e/signin.spec.ts`, `lib/auth/attempts.test.ts` NOT NULL + FK). Pass. **Gap:** the provider e2e tests skip in CI
  until request #12 is answered.
- Funnel per attempt, no personal data: `lib/funnel.test.ts` + e2e. Pass.
- Trust notice strings vs banned list: `lib/copy.test.ts`. Pass. `/how` is a 404 until PR-2a (expected).
- Deletion vendor-first, cascade, reservation without personal data: `lib/delete.test.ts` (DB-level; screen is
  PR-2a). Pass. Funnel rows survive deletion by design (no personal data).
- OIDC wrong audience, `alg: none`, HS256, unknown kid, signature, issuer, expiry, nonce: tested. Pass.
- S1 at 375px light/dark, 44px controls, no h-scroll, keyboard-only: tested. Pass.
- Untested: the `localStorage` "last method first" reorder, S2 in dark, the email send-failure path, resend limits.

## 3. Edge cases (run against the built app)

| Case | Result |
|---|---|
| Replayed link; expired link (clock via SQL) | `/login?error=expired` with alert; claim is atomic; expired row stays unused. OK |
| Link opened in another browser | signs in (links are not browser-bound; expected). OK |
| Two tabs submit the same address at once | two attempts, two links, both sign in the same user. OK |
| Tampered `sid`, unsigned token, old `uid=1` | all signed out. OK |
| Provider sign-in while signed in | new user and session; old session row stays valid 30 days (D6) |
| Pre-F-1 rows | backfilled `dev` attempt; NOT NULL holds; seed and e2e inserts go through an attempt. OK |
| Provider config half-set | no button (unit). OK |
| Email send failure | **generic "This page couldn't load"**; attempt and link rows already written (D2) |
| Provisional handle collision; taken handle on change | retries; inline error. OK |
| Deletion signed out / twice | redirect to `/login`; no session on the second call (code read). OK |
| Stranger resends with a guessed attempt id | 3 emails reach the victim before the per-attempt cap (D5) |
| Submit with JavaScript off | works. OK |
| `/connect?attempt=N` reloaded or hit by a stranger | one `notice_seen` row per render, any id (D7) |

## 4. Usability (375px and 360px, light and dark; `screenshots/pr1/`)

No horizontal scroll on any of the five pages or the error states. Disclaimer footer everywhere. Every control
labeled; a 2px focus ring on every tabbable element in order; primary controls 44–45px; keyboard-only path completes. Defects: a stray purple block above the checkbox (D1),
"← Back" and the S2 links 16–20px tall (D8), the attestation error clears the typed email (D4).

## 5. Compliance scan of the diff

Only the integrated vendor is named; provider labels come from env. No advice or promise words (`secure` is only a
cookie flag). No `console.*`; errors carry status or reason only. No third-party script, font or stylesheet.
Personal fields: `login_links.email`, `identities.email/subject`, session hashes; all cascade on delete (tested).
§7 attestation-first, signed httpOnly sessions; §9 labels and focus except D8; §10 PKCE/state/nonce, hashed tokens.

## 6. Defects

1. **must-fix** · The hidden default submit button renders as a 28×44px purple block above the attestation
   checkbox: `button, .button { display: inline-block }` overrides `[hidden]`, `.auth button` sets the height. It is
   clickable and unlabeled. Repro: open `/login`; see `screenshots/pr1/login-dark.png`.
2. **must-fix** · Email send failure shows Next's generic server error, no message or retry; the attempt and
   `login_links` rows are written first. Repro: point `AUTH_EMAIL_SEND_URL` at a closed port and submit.
3. **must-fix** · Flaky CI: the schema's backfill block (insert from `users`, update, `alter table users … set not
   null`) runs on every apply with exclusive locks; `node --test` applies the schema from 8 files in parallel and
   deadlocks in 2 of 4 runs (`lib/claims.test.ts:105`). Skip the block when nothing needs backfilling.
4. **nit** (usability) · Unchecked attestation redirects and drops the typed email.
5. **nit** (security) · `/login/sent?a=N` resend is unauthenticated for any open attempt; ids are sequential. Bind
   it to the originating browser.
6. **nit** · Signing in while signed in keeps the old session row; no sign-out control until PR-2a.
7. **nit** · `notice_seen` written per render, any id; dedupe like `own_profile_viewed`.
8. **nit** (usability) · "← Back" and the two S2 links are under 44px.
9. **nit** · `users.deleted_at` never written; `?method=brokerage` is ignored, so the signed-out brokerage-first
   path loops S1 → S2 → S1 with only "Sign in first" as explanation (PR-2 must close it).
10. **nit** · Build log miscounts e2e (41 → 49, not 46 → 55).

## Verdict

DEFECTS

---

# Re-run 1 (after fix round 1)

Date: 2026-10-22. Branch `claude/adoring-euler-4469ys` (cde6d07) vs `origin/main`. Inputs: the original report above, the
engineer's "Fix round 1" section in `build-pr1-engineer.md`, the fix diff (3964b94..cde6d07: 17 files, product code in
`app/auth/actions.ts`, `app/login/{page,sent/page}.tsx`, `app/connect/page.tsx`, `app/globals.css`, `db/schema.sql`,
`lib/auth/{links,sessions}.ts`, `lib/session.ts`, `lib/delete.ts`, `lib/copy.ts`). No product code changed by this pass.
Local Postgres 16 (same role/database as before, the `DATABASE_URL` from `.env.example`), schema applied twice with `psql`,
demo seed, production build started with `ALLOW_DEV_AUTH=1` and the in-repo issuer and email-sink fakes configured as the
header of `e2e/signin.spec.ts` lists. Screenshots: `screenshots/pr1/rerun1/`.

## 1. Checks

| Command | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` with `DATABASE_URL`, 3 runs in a row | 359 / 359 / 359 pass, 0 fail, 0 skipped. No deadlock, no lock wait |
| `npm test` without `DATABASE_URL` | 359 tests, 346 pass, 13 skipped |
| `npm run build` | success |
| `npx playwright test` (fakes configured) | **50 passed** (41 on main + 9) |
| `npx playwright test e2e/signin.spec.ts` with no provider/sink variables (CI's situation) | 6 passed, 3 skipped with their reasons (the two provider flows, the send-failure test) |
| `node scripts/compliance.ts diff origin/main` | one finding, the pre-existing optional prebuilt image package's licence; identical on `origin/main` (`tree` run in a worktree of main). Nothing from this diff |
| `node scripts/autopilot.ts guard main` | ok |
| Schema on an empty database | `scripts/db-setup.ts` twice, `psql -1 -f` once, then `SEED=1`: `signup_attempt_id` NOT NULL, 25 indexes, 3 users / 3 attempts |

## 2. The three must-fix defects, as a user sees them

1. **Stray purple block above the checkbox: fixed.** `/login` at 375px, light and dark (`rerun1/login-light.png`,
   `rerun1/login-dark.png`): nothing paints between the attestation line and the first provider button. Measured: the one
   `button[hidden]` has computed `display: none`, `isVisible() = false`, no bounding box; the four visible buttons are
   343×44–45px and all named. No horizontal scroll. Enter in the email field still submits (lands on `/login/sent?a=N`,
   the sink receives the message), so the implicit-submission path survived the CSS change.
2. **Email send failure: fixed.** With the sink answering 500, "Send me a link" lands on `/login/sent?a=N&error=send`
   (`rerun1/login-sent-error-light.png`, `-dark.png`): one `role="alert"` "We could not send your link. Try again." in the
   error colour, a primary "Send again" (114×44px, `aria-describedby` the alert), "← Back" (44px). No "Check your email",
   no framework error text. Database after the failure: one `login_links` row for the attempt, `used_at` set (nothing
   claimable), the attempt row open with `user_id null`. A retry while the sink still fails returns to the same error state
   and leaves the row count at one (the second row is closed too). With the sink back, "Send again" → `&again=1`,
   "Check your email… / Sent again." (`rerun1/login-sent-retry-ok-light.png`, `-dark.png`), the sink receives the message
   for the same address, the link signs in with a provisional handle and the attempt completes
   (`rerun1/profile-after-retry-light.png`). The retry also works keyboard-only (Tab to "Send again", Enter). Server log:
   no address, token or link; the only noise is the share-card font fetch that also exists on main.
3. **Flaky schema apply: fixed, and the test proves it.** `lib/schema.test.ts` exists with two tests. The text test pins the
   mechanism: no bare `add column if not exists` / `create index if not exists` left in `db/schema.sql` (16+ columns and 8+
   indexes go through the catalog-checking `schema_add_column` / `schema_add_index`), the backfill and `set not null` only
   inside a `do` block guarded by `is_nullable = 'YES'`, the advisory transaction lock first, still no drop/truncate/delete.
   The DB test holds an open transaction with an uncommitted insert into `users` and `activities` from one connection and
   applies the schema twice from another under `lock_timeout = 3s`: any table lock the apply would wait on fails the test.
   I ran the same test file against the pre-fix schema (3964b94) in a scratch copy: both tests fail, the DB one with
   `canceling statement due to lock timeout` (55P03), which is the wait that turned into the 40P01 deadlock when test files
   ran in parallel. Against the fixed schema it passes, and three full `npm test` runs were clean.

## 3. Nits the engineer marked done

| # | Verified |
|---|---|
| 4 | After the attestation error the field still holds the typed address, the URL is `/login?method=email&error=attest` (no address), the box is focused with the alert (`rerun1/login-attest-error-light.png`, `-dark.png`). The address rides in `login_email`: httpOnly, `path=/login`, Lax, 10 minutes. |
| 5 | A second browser context at the same `/login/sent?a=N` sees the text and "← Back" only, no "Send again" (`rerun1/login-sent-error-stranger.png`). The owner's `login_attempt` cookie is the signed attempt id (httpOnly, `path=/login`). Resend cap: with JavaScript off (native form posts, no client-side race) resends 1–3 send a new row each, resend 4 and 5 land on `&error=limit` with "Too many links sent. Try again in a few minutes." and no new row (`rerun1/login-sent-limit-light.png`, `-dark.png`). |
| 6 | Dev sign-in as one demo handle, then as another without clearing cookies: the first session's hash is gone from `sessions`, the second is the only row for that browser. |
| 8 | "← Back" on `/login/sent` is 44px tall; on `/connect` the vendor security link, "How records are calculated" and the primary are 44px (`rerun1/connect-light.png`, `-dark.png`). No horizontal scroll at 375px. |
| 9 (first half) | `deleted_at` is set before the vendor call; a failed vendor call leaves the row marked (`lib/delete.test.ts`, run clean). PR-2a must hide marked rows and stop them signing in; until then a marked row is a normal profile, which is unchanged from before and unreachable without the PR-2a screen. |
| 10 | Build log corrected to 41 → 49 (50 with the send-failure test). |

Deferred to PR-2, and still only these two: **#7** (`notice_seen` is written on every render of `/connect?attempt=N`, any open
id: `app/connect/page.tsx:15`) and **#9 second half** (`/login?method=brokerage` is read into the page's search-param type
but not used, so the signed-out brokerage-first path still loops S1 → S2 → S1 with "Sign in first" as the only explanation).

## 4. New defects introduced by the fixes

None found. Looked for: the global `[hidden] { display: none !important }` (no other element in `app/` uses the `hidden`
attribute, so nothing else changed); the session replacement deleting a row that belongs to another user (it deletes only the
row behind the cookie the browser presents, which is the right thing on a shared browser); the `login_email` cookie
(10 minutes, cleared when the field is empty, never in a URL); the failed-send link rows (closed by `used_at`; the claim
route also checks `used_at is null`, tested by the single-use e2e); the rate limiter counting failed sends (five failed
sends in 15 minutes show "Too many links sent", acceptable and explained on screen); a stranger at `…&error=send` sees the
error line with no retry (correct: the retry belongs to the originating browser).

Observations, not defects: the rate-limited state shows "Check your email…" and "Too many links sent…" together (the first
link was sent, so both are true); the resend limit is per process (documented in `lib/auth/rate-limit.ts`).

## 5. Compliance scan of the fix diff

New strings (`sendFailed`, `sentAgain`, `tooMany`, `back`) are in `lib/copy.ts` and pass `lib/copy.test.ts`. The error
message carries no address, token or link. No new dependency; no third-party script, font or stylesheet; no `console.*`.
New personal data at rest: none (the typed address in a 10-minute httpOnly cookie on the user's own browser). Only the
integrated vendor is named, in the S2 copy that already existed. No performance surface touched.

## Verdict

CLEAN

---

# Re-run 2 (after fix round 2)

Date: 2026-10-22. Branch `claude/adoring-euler-4469ys` (606283e) vs `origin/main`. Inputs: the three committee reports, the
engineer's `build-pr1-fix2.md`, the fix diff (7aa16d7..606283e: 24 files, product code in `app/{actions,layout,nav-login}.ts(x)`,
`app/api/sync/route.ts`, `app/auth/{actions.ts,email/route.ts,callback/[provider]/route.ts}`, `app/connect/{page.tsx,start,done}`,
`app/globals.css`, `app/login/page.tsx` (`order.tsx` deleted), `app/u/[handle]/page.tsx`, `lib/auth/{links,providers}.ts`,
`lib/{copy,delete,session}.ts`). No product code changed by this pass. Local Postgres 16 (same role/database, the `DATABASE_URL`
from `.env.example`), schema applied, demo seed, production build started as `localhost:3000` with `ALLOW_DEV_AUTH=1` and the
in-repo issuer (`127.0.0.1:4100`) and email sink (`127.0.0.1:4101`) configured as the header of `e2e/signin.spec.ts` lists.
Beyond the suite, an independent script (my own contrast formula, DB queries, cookie inspection, 216 checks) drove the server
at 375px light and dark. Screenshots: `screenshots/pr1/rerun2/` (28 files).

## 1. Checks

| Command | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` with `DATABASE_URL`, 3 runs in a row | 361 / 361 / 361 pass, 0 fail, 0 skipped |
| `npm run build` | success |
| `npx playwright test` (fakes configured) | **56 passed** (41 on main + 15 in `signin.spec.ts`), 43 s |
| `node scripts/compliance.ts diff origin/main` | one finding, the pre-existing optional prebuilt image package's licence, identical on `origin/main`; nothing from this diff |
| `node scripts/autopilot.ts guard main` | ok |
| Server log after everything | no address, token or link; only the share-card font fetch that also exists on main |

## 2. Committee findings, as a user and as the database see them

| | Finding | Verified |
|---|---|---|
| (a) | `login_links.email` outlived the link | **Fixed.** After a successful link sign-in: `select count(*) from login_links where email = <addr>` = 0; the row stays with `used_at` set and `email = ''`; the local part appears in no row; the address lives only on the user's `identities` row. After expiry: `expires_at` moved to the past, `POST /api/sync` (bearer) returns `{ok, failed, purgedLinks: n≥1}` and the row (and address) is gone; the lazy purge before the next send also removes an expired row. After profile deletion: a claimed link on the completed attempt plus an unclaimed link for the same address on a later attempt → `deleteProfile` (vendor stub) leaves zero `login_links` rows with the address or on either attempt, the `users` and `identities` rows gone, the handle reserved. |
| (b) | Dark primary text 2.72:1 | **Fixed.** Measured with my own formula on computed colors at 375px. Dark: primaries `rgb(11,11,15)` on `rgb(167,139,250)` = **7.22:1** on `/login` (three primaries), `/connect` signed in, the profile ("Connect your broker", "Save", "Share my record"); secondaries 16.39:1. Light: `#fff` on `rgb(109,40,217)` = **7.1:1**; secondaries 18.8:1. Signed-out `/connect` options 16.39:1 / 18.8:1. Every visible button is ≥ 44px. |
| (c) | Redirects carried the server's hostname | **Fixed.** Link minted on `http://localhost:3000/…`, opened on `http://127.0.0.1:3000/…` → lands on `http://127.0.0.1:3000/u/trader_…`, nav shows `@handle`, `sid` cookie domain `127.0.0.1`. A bad token on `127.0.0.1` → `303 http://127.0.0.1:3000/login?error=expired`; signed-out `/connect/start` on `127.0.0.1` → `307 http://127.0.0.1:3000/login`. |
| (d) | Signed-out brokerage-first looped | **Fixed.** S1 → attest → "Connect a brokerage instead" → S2 shows one `role="status"` "Sign in first, then connect.", no "Connect brokerage (read-only)", three 45px secondary links (`/login?method=provider_a|provider_b|email`); following one lands on S1 with the form (no redirect back). Signed in: the primary → `/connect/start`, 45px, no status line. Light and dark (`connect-signed-out-*.png`, `connect-signed-in-*.png`). |
| (e) | Reused link said "expired", nothing to tap, address retyped | **Fixed.** Second tap after sign-in (session cleared) → `/login?error=used`, alert "That link was already used. Send a new one?", field prefilled, button "Send a new link". `expires_at` in the past → `/login?error=expired`, the expired alert, field prefilled, "Send a new link" 44px; after the attestation it sends a new link to the same address on a new attempt and the expired row is gone. `login_email` cookie: httpOnly, `path=/login`, ~15 min, never in a URL (`login-used-*.png`, `login-expired-*.png`). |
| (f) | S2 "·" orphaned | **Fixed.** No "·" in `main`; the vendor link and "How records are calculated" are 44px rows 58px apart; no horizontal scroll at 375px or 360px. |
| (g) | Tap-time reorder | **Fixed.** `data-method` order before a failed attestation submit equals the order after (and after a reload), the brokerage block last, the typed address kept, the alert shown. `auth_last_method` is written only on completion (`email`, httpOnly, `path=/login`); after a completed link sign-in S1 lists `email` first, `brokerage` last. A `dev` value leaves the order sane. |
| (h) | New profile: handle twice, no "what next", bare "Change handle" | **Fixed on the first screen.** `h1` = `@trader_…`, the handle occurs once in `main`, `role="status"` "You're in. Next: connect your brokerage.", "Change handle" is a 44px secondary button (16.39:1 / 18.8:1) that opens the form (`profile-new-*.png`, `profile-new-handle-edit-*.png`). See defect 1 for what happens after the handle is changed. |
| (i) | Signed-in `/login` | **Fixed.** `/login` and `/login?ref=…&via=nav` → `307` to `/u/<handle>`, signed in. |
| (j) | Nav attribution | **Fixed.** On `/u/momentum_maya` the nav link is `/login?ref=momentum_maya&via=nav` (also in the server-rendered HTML, so JS is not needed); on `/` and `/t` it is `/login`. Following it through the email path records `landed` with `{"source":"profile"}`. |
| (k) | 24px checkbox, legal links lost the box | **Fixed.** Checkbox bounding box 44×44; Terms and Privacy carry `target="_blank" rel="noopener noreferrer"`; after checking, a tap on "Terms" opens `/terms` in a new tab and the box is still checked; Space toggles the drawn box; a 2px focus ring (`login-checkbox-checked-focus-*.png`). |

## 3. Regression

- Chart range tabs (restyled): the pressed tab is the solid sign colour with page-background text, `rgb(250,250,250)` on
  `rgb(21,128,61)` = **4.81:1** light, `rgb(11,11,15)` on `rgb(34,197,94)` = **8.62:1** dark, measured for every tab on
  `dividend_dan` and the pressed tab on `yolo_yuki`; the losing colour by the same formula is 6.1:1 light, 5.3:1 dark.
  Tapping a tab presses it, exactly one tab is pressed, the header number changes, the unpressed tabs are 5.0:1 / 5.8:1 as before
  (`profile-dividend_dan-*.png`, `profile-momentum_maya-tab-switched-dark.png`).
- Round-1 fixes still hold: the send-failure state shows the alert and "Send again", and the retry signs in after the sink
  recovers (`login-sent-error-*.png`); the hidden default submit does not paint; Enter in the field still submits (e2e).
- The second `role="alert"` on `/login/sent` is the framework's route announcer (page title), not product markup.
- No horizontal scroll at 375px or 360px on S1, S2, the used state and a seeded profile.

## 4. Defects

1. **bug (usability)** · After "Change handle" the discarded provisional handle stays as the display name: `changeHandle`
   (`lib/auth/attempts.ts`) updates `handle` only, and nothing in the product sets `display_name`, so the heading reads
   `trader_zz9q1w2e` over `@chosen_name`, and the same text is the page title, `og:title` and the share-card name
   (`profile-after-handle-change-light.png`; DB after: `handle = chosen_name, display_name = trader_zz9q1w2e`). The feed and
   ticker pages show `display_name` too. Pre-existing in PR-1 (the heading was `display_name` before fix round 2 as well),
   but item 9's `provisional = display_name === handle` now flips to this state the moment the trader uses the control the fix
   made prominent, and the "You're in" line still shows. Simplest fix: `changeHandle` also sets `display_name` when it equals
   the old handle (or the pages treat a display name that never diverged from a provisional handle as unset).

Observations, not defects: a used or expired link opened in a browser without the `login_email` cookie shows the alert and
"Send a new link" with an empty field (the cookie is per browser, by design); a `dev` sign-in writes `auth_last_method=dev`,
which `orderMethods` ignores.

## Verdict

DEFECTS
1. After "Change handle" the discarded provisional handle remains the display name on the profile heading, page title, share card and feed (bug, usability; pre-existing, exposed by fix 2 item 9).
