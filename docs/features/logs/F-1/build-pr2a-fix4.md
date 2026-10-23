# F-1 PR-2a fix round 7: committee fixes (engineer)

Date: 2026-10-23. Branch `claude/adoring-euler-4469ys`, from `e193ad4` (committee: engineer FAIL, business lead and
UX lead DEMANDS). A compliance failure goes back to the plan step, so the plan comes first.

## Committee fix plan

Security and compliance first, then usability. Every item has a test that fails before the change.

### 1. High: brokerage-first sign-up takeover (engineer §5, business lead demand 5)

- **Root cause.** The binding between a brokerage-first attempt and the browser that attested it was made late, by
  whoever asked: `/connect/start?attempt=N` signed a `connect_attempt` cookie for any open brokerage attempt it was
  handed, and attempt ids are sequential. Any browser could take an open attempt, open the portal with the attempt's
  vendor user, finish `/connect/done` and consent, and be signed in to a profile publishing another person's trades.
  Separately, `consent()` for a brokerage-first row was not serialized: two taps both created a user, and the losing
  tap of a claim race copied the vendor secret back onto the attempt.
- **Change.**
  - `startSignIn` (method `brokerage`) signs the attempt id into the `connect_attempt` cookie (httpOnly, sameSite=lax,
    path `/connect`, 24 h) at creation, as `bindAttempt` does for email, and redirects to `/connect` with no id.
  - One helper, `boundAttempt(cookie, secret)` in `lib/connections.ts`, is the only way a signed-out request finds
    its attempt: the HMAC-checked cookie, an attested `brokerage` attempt with no user and not completed.
    `/connect`, `/connect/start` and `/connect/done` read only that. A query-string `attempt` is never used; when one
    is presented that the browser's cookie does not match, the request is refused and `refuseUnbound(id)` writes a
    `failed` funnel event with `reason: 'unbound'` on that attempt (an id and a reason; nothing personal; no schema
    change). `/connect/start` and `/connect/done` redirect a refused request to `/login`; `/connect` shows the
    sign-in options.
  - `consent()` for a brokerage-first row first reserves the attempt atomically (`update signup_attempts set
    completed_at = now() where id = … and user_id is null and completed_at is null returning id`); a second tap finds
    nothing to reserve and gets `NotPendingError` before any user is created. The vendor user moves from the attempt to
    the new user inside the same transaction as the claim and the state change, so a losing tap never has to copy
    anything back: on any failure the new users row is deleted and the reservation released, and the attempt still
    holds its own vendor user for the refusal's cleanup to delete.
  - `consentAction` clears the `connect_attempt` cookie once the user exists.
- **Files.** `app/auth/actions.ts`, `lib/connections.ts`, `app/connect/page.tsx`, `app/connect/start/route.ts`,
  `app/connect/done/route.ts`, `app/connect/actions.ts`.
- **Tests.**
  - e2e `connect.spec.ts`: a second browser context holding only the attempt id is refused at `/connect/start?attempt=N`
    (no portal; lands on `/login`) and at `/connect/done?attempt=N` (lands on `/login`), and `/connect?attempt=N`
    shows it no primary; each refusal is a `failed`/`unbound` funnel event with no personal data; the owning browser
    then completes the flow to its profile.
  - DB `connections.test.ts`: `boundAttempt` accepts only the signed cookie of an open brokerage attempt (not a forged
    or another attempt's cookie, not an email attempt, not a completed one); `refuseUnbound` writes the event and
    ignores an unknown id. Two concurrent `consent()` calls on one brokerage-first row create exactly one user, one
    rejects with `NotPendingError`, the attempt keeps no vendor user and the user holds it. D6 (claim race) still
    passes and the attempt never regains the secret.

### 2. Medium: `SNAPTRADE_BASE_URL` in production (engineer §5)

- **Root cause.** The test-only override was passed straight to the SDK's `basePath` with no environment check, so a
  production deploy with it set would send signed requests and vendor secrets to that host.
- **Change.** A pure `assertVendorBaseUrl(env)` in a new `lib/vendor-env.ts` throws when `NODE_ENV=production` and
  `SNAPTRADE_BASE_URL` is set. The tests-only override is the one production test builds already use: allowed only
  with `ALLOW_DEV_AUTH=1` **and** a loopback `http(s)://127.0.0.1|localhost|[::1]` URL, so it can never point at
  another machine. It runs at server startup from a new root `instrumentation.ts` (`register()`), skipped during
  `next build`. `lib/broker.ts` (owner-protected) is not edited.
- **Files.** `lib/vendor-env.ts`, `instrumentation.ts`.
- **Test.** Unit `lib/vendor-env.test.ts`: production + set → throws; production + `ALLOW_DEV_AUTH=1` + remote host →
  throws; production + `ALLOW_DEV_AUTH=1` + loopback → allowed; development or unset → allowed; build phase → allowed.
  Checked by hand: `next start` with the variable set and no override refuses to start.

### 3. Medium: data kept beyond its use after cleanup (engineer §5)

- **Root cause.** `cleanup()` deleted the link at the vendor and the provisional claims but left the account snapshot
  (`connections.accounts`: account ids, institution) and `institution` on declined and expired rows. A brokerage-first
  attempt whose portal was opened and never finished kept its vendor user on the attempt for good.
- **Change.** `cleanup()` sets `accounts = '[]'` and `institution = null` in the same update as `cleanup_done_at`;
  ids, states and timestamps stay for the funnel. The vendor user of a declined brokerage-first attempt is deleted with
  its link (unchanged rule: when no live connection of the attempt holds an authorization), and the double-tap fix (1)
  means no losing tap copies it back. New: the hourly tick's `cleanupAttempts()` deletes the vendor user of any attempt
  older than 24 h that still holds one, has no live or uncleaned connection, and whose vendor user no users row holds,
  then blanks it on the attempt.
- **Files.** `lib/connections.ts`.
- **Tests.** DB: after decline and after expiry + tick, the row has `accounts = []`, `institution = null`, keeps its
  ids and timestamps; a declined brokerage-first attempt keeps no vendor user and the vendor user was deleted; an
  abandoned attempt (portal opened, no link) older than 24 h is swept by the tick, a fresh one is not.

### 4. Brokerage-first from `/login` is a dead end (business lead demand 1)

- **Root cause.** S1's brokerage option redirected to `/connect?attempt=N`, which signed out showed only "Sign in
  first, then connect." No page linked to `/connect/start`.
- **Change.** With (1), "Connect a brokerage instead" creates the attested attempt, binds it and lands on the trust
  notice, which shows the primary "Connect brokerage (read-only)" → `/connect/start` (cookie-bound) for a browser with
  an open bound attempt. Signed out with no bound attempt, `/connect` keeps the status line and the sign-in options.
- **Files.** `app/connect/page.tsx`, `app/auth/actions.ts`.
- **Test.** e2e at 375 px: `/login` → attest → "Connect a brokerage instead" → trust notice → primary → portal →
  consent → "Import my record" → importing profile, signed in, counting app taps (4). The S2 test keeps its signed-out
  no-attempt assertions.

### 5. No share invitation on a failed or importing record (business lead demand 2, UX lead demand 1)

- **Root cause.** The profile gated the share prompt and share card on `state !== 'importing'` only.
- **Change.** One `shareable = state === 'connected' || state === 'none'` gate in the profile for the share prompt, the
  share card and the new-trades prompt: none of them shows while `failed` or `importing`. "Try again" stays the only
  primary on a failed record.
- **Files.** `app/u/[handle]/page.tsx`.
- **Test.** e2e: the failed owner sees neither "Your record is live." nor "Share my record"; a retry that reaches
  `connected` shows the prompt again; while importing neither shows.

### 6. "Try again" ≥ 44 px (UX lead demand 2)

- **Root cause.** The retry is a `.button` inline in the failed line with no minimum height (43.2 px).
- **Change.** `.record-failed .button { min-height: 44px; display: inline-flex; align-items: center; }`.
- **Files.** `app/globals.css`. **Test.** e2e measures the bounding box of `.record-failed a` at 375 px (≥ 44).

### 7. Consent above the fold; sign-in goes straight to the notice (business lead demands 3, 4)

- **Root cause.** The consent page repeated the trust notice (a lead line and two scope lines) and gave the deadline
  in UTC; at 667 px the primary ended near 688 px. Sign-in landed on the empty profile, one extra stop before S2.
- **Change.** `lib/copy.ts`: drop `CONSENT.linked`; merge the history and accounts lines into "Full trade history your
  broker provides, from every account under this login"; `CONSENT.deadline` is the fixed "Decide within 24 hours, or
  this link is removed automatically." (no time zone). After an email or provider sign-in, a trader whose profile would
  be empty (nothing consented, no closed trades) lands on `/connect`; anyone with a record lands on the profile. The
  notice keeps the profile one tap away ("Your profile" link row, and the nav).
- **Files.** `lib/copy.ts`, `app/connect/consent/page.tsx`, `lib/auth/landing.ts` (new, pure `landingPath` + loader),
  `app/auth/email/route.ts`, `app/auth/callback/[provider]/route.ts`, `app/connect/page.tsx`.
- **Tests.** Unit: consent lines and deadline copy (no "UTC", "within 24 hours"), `landingPath` by state and closes.
  e2e: at 375×667 the whole "Import my record" button is inside the viewport; the brokerage-first walk counts ≤ 4
  app taps from `/login` to consent; the email sign-in lands on the trust notice and the profile is reachable.
  Existing sign-in e2e assertions on the landing URL follow the new landing (each still checks the same user).

### 8. Importing line only when nothing is listed (business lead demand 6)

- **Root cause.** `recordBodyCopy('importing', n)` returned the importing line for any `n`.
- **Change.** The importing line only when `closes === 0`; with trades listed the banner alone carries the state.
- **Files.** `lib/copy.ts`. **Test.** Unit by state and row count (`importing, 5` → none). The one existing assertion
  that pinned the old behaviour (`recordBodyCopy('importing', 5)`) follows the new rule.

### Checks

`npx tsc --noEmit`; `npm test` three times (local Postgres 16); `npm run build`; `npm run test:e2e` with the vendor,
provider and email fakes the specs start; `node scripts/compliance.ts diff origin/main`;
`node scripts/autopilot.ts guard main`.

## What was built

| # | Finding | Fix as built |
|---|---|---|
| 1 High | Brokerage-first attempt takeover via `/connect/start?attempt=N` | `startSignIn` sets the signed `connect_attempt` cookie (path `/connect`, httpOnly, lax, 24 h) when it creates the attempt and redirects to `/connect`. `boundAttempt()` is the only lookup for a signed-out request (HMAC-checked, `brokerage`, no user, not completed); `/connect`, `/connect/start` and `/connect/done` use it and never read the id from the URL. A presented id the cookie does not match → `refuseUnbound()` (`failed` / `reason: 'unbound'`) and `/login` (start, done) or the sign-in options (S2). The cookie is cleared once consent creates the user |
| 1 Low | Double tap on brokerage-first consent | `consent()` reserves the attempt (`completed_at`) atomically before creating the user; the loser gets `NotPendingError` with no user created. The vendor user moves to the user inside the claim + state transaction; on any failure the user is deleted and the reservation released; nothing is copied back |
| 2 Medium | `SNAPTRADE_BASE_URL` with no production guard | `lib/vendor-env.ts#assertVendorBaseUrl` run from `instrumentation.ts#register`. Production + set → throws, unless `ALLOW_DEV_AUTH=1` and a loopback URL (the e2e build). `lib/broker.ts` (owner-protected) untouched. By hand: `next start` with `SNAPTRADE_BASE_URL=https://vendor.example` logs "Failed to prepare server … SNAPTRADE_BASE_URL is for tests only …" and answers every request 500 (`/`, `/how`, `/connect/start`), so no route ever runs; with `ALLOW_DEV_AUTH=1` and `http://127.0.0.1:4102` it serves `/how` 200 |
| 3 Medium | Account snapshot and institution kept after cleanup; vendor user left on attempts | `cleanup()` blanks `accounts` and `institution` with `cleanup_done_at`. New `cleanupAttempts()` in the tick deletes and blanks a vendor user still on an attempt older than 24 h (database clock) with no live or uncleaned connection and no users row holding it |
| 4 | `/login` brokerage option dead end | S2 shows "Connect brokerage (read-only)" → `/connect/start` to the browser holding its open bound attempt; without one, the status line and sign-in options as before |
| 5 | Share invitation on failed / importing records | `shareable` (connected or none) gates the share prompt, share card and new-trades prompt; `sharePromptShowing` is false while importing or failed, so the one-time prompt is not spent while hidden |
| 6 | "Try again" 43.2 px | `.record-failed .button { min-height: 44px; … }`; measured in e2e (≥ 44) |
| 7 | Consent below the fold; extra stop after sign-in | Consent: lead line removed, scope lines merged, deadline "Decide within 24 hours, or this link is removed automatically." (`lib/copy.ts`). Email and provider sign-ins go through `landingFor()`: empty profile → `/connect`, else the profile. S2 signed in has a "Your profile" link row (44 px). The dev form is unchanged (test stub) |
| 8 | Importing line above listed trades | `recordBodyCopy` returns the importing line only with 0 closes |

Residual (not in scope, for PR-2b's embedded portal): the redirect flow's portal URL is a bearer link at the vendor. A
person who phishes a victim into linking a brokerage through the attacker's own portal URL could still finish the link
from the attacker's own browser. The binding fixed here stops anyone taking over someone else's attempt; it cannot stop
a victim entering credentials into a portal session the attacker opened. The embedded portal (PR-2b) keeps the portal
inside the page that owns the attempt.

## Tests added or changed

- `lib/connections.test.ts` (DB): "committee fix 1 (High)" (`boundAttempt` accepts only the signed cookie of an open
  brokerage attempt; unsigned, forged, wrong-secret, email and completed are refused; `refuseUnbound` records one
  `failed`/`unbound` event with no personal data, unknown and malformed ids write nothing); "committee fix 1 (Low)"
  (two concurrent consents → one user, one `NotPendingError`, the attempt keeps no vendor user, the user holds it);
  "committee fix 3 (Medium)" (declined and expired rows have `accounts = []`, `institution = null`, ids and timestamps
  kept; a declined brokerage-first attempt keeps no vendor user and it was deleted; an abandoned attempt older than 24 h
  is swept, a fresh one and one with a pending link are not). D6 unchanged and passing.
- `lib/vendor-env.test.ts` (unit, new): the production matrix (remote, loopback without override, override with remote,
  look-alike host, credentials in URL, `ALLOW_DEV_AUTH=true` all throw; override + loopback, unset, development, test,
  build phase pass) and that `instrumentation.ts#register` calls it.
- `lib/auth/landing.test.ts` (unit, new): `landingPath` by state and closes.
- `lib/copy.test.ts`: consent copy (no lead line, one scope line, deadline without clock time or zone, "Your profile");
  `recordBodyCopy` by state and row count. The PR-2a assertion on the old three scope lines now asserts the merged line.
- `lib/connections.test.ts` "body copy by state": `recordBodyCopy('importing', 5)` is now `null` (item 8; the old
  assertion pinned the behaviour the committee rejected).
- `e2e/connect.spec.ts`: new "committee fix (items 1, 4, 7)" (375×667: `/login` → attest → "Connect a brokerage
  instead" → S2 primary → portal → consent → "Import my record" → importing profile = 4 app taps, ≤ 4 to consent; the
  whole "Import my record" button inside 667 px with no scroll; a second context with only the id gets no primary on
  `/connect?attempt=N`, and `/connect/start?attempt=N`, `/connect/done?attempt=N` and a forged cookie all land on
  `/login`; three `unbound` events; no connection and no vendor user on the attempt from the stranger; exactly one user;
  the cookie is gone after consent). New "committee fix (items 5, 6)" (with `last_synced_at` set as an hourly sync
  would: importing and failed owners see neither "Your record is live." nor "Share my record"; "Try again" ≥ 44 px; a
  retry to `connected` brings the prompt back). The `brokerageAttempt` helper now goes through S1 (it used to insert the
  attempt and open `/connect?attempt=N`, the hole); start calls use `/connect/start`; the fix round 3 importing view
  asserts no importing line under listed trades; the signed-in consent test asserts the merged scope line.
- `e2e/signin.spec.ts`: the S2 test's brokerage-first part asserts the bound cookie (httpOnly, Lax), no id in the URL,
  the same funnel events and the 44 px primary to `/connect/start`. Email, other-host, method-memory, provider (both)
  and send-failure sign-ins assert the new landing on S2 with the same user in the nav (`landedOnNotice`); the email
  test then taps "Your profile" (44 px) and keeps every first-screen profile assertion.
- Nothing weakened or deleted. Unit 405 → 413; e2e 70 → 72.

## Results

| Command | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` (`DATABASE_URL` local Postgres 16), three runs | 413 pass every run, 0 fail, 0 skipped |
| `npm run build` | first attempt stopped on the framework's security-advisory prompt (tool output; nothing upgraded); the retry built cleanly |
| Startup guard by hand (`next start`) | remote base URL: "Failed to prepare server", every request 500; loopback + `ALLOW_DEV_AUTH=1`: 200 |
| `SEED=1 node --env-file=.env scripts/db-setup.ts`, then `npm run test:e2e` (`ALLOW_DEV_AUTH=1`; the specs start the vendor fake on 4102 and the provider and mail fakes; server given `SNAPTRADE_BASE_URL`/`_CLIENT_ID`/`_CONSUMER_KEY` and the PR-1 issuer and sink variables) | first run 70 passed, 2 failed (two assertions still pinned to the old consent lines and the old landing); updated to the new spec; second run 72 passed, 0 skipped |
| `node scripts/compliance.ts diff origin/main` | only the pre-existing `node_modules/@img/sharp-wasm32` license line |
| `node scripts/autopilot.ts guard main` | `guard: ok` |

## Compliance

- §7 / §10 / P3: an attempt is bound to the browser that attested it; no id in a URL grants anything; refusals are
  logged as an id and a reason only. The 18+ attestation still precedes every attempt and every user row.
- §10: the vendor base URL can no longer reach a production server outside a loopback test build.
- §3: declined and expired rows keep no account ids or institution after cleanup; no attempt keeps a vendor user past
  its use (declined, refused, abandoned).
- No advice, signals or celebration added; the failed record no longer invites sharing. Percent-only; no quantities or
  prices. No schema change, no drop / truncate / delete in `db/schema.sql`, no new dependency, no protected path edited.
- No third-party names added; the new strings are in `lib/copy.ts` under the existing banned-claims and marks checks.

## Files changed

`app/auth/actions.ts`, `app/auth/email/route.ts`, `app/auth/callback/[provider]/route.ts`, `app/connect/page.tsx`,
`app/connect/start/route.ts`, `app/connect/done/route.ts`, `app/connect/actions.ts`, `app/connect/consent/page.tsx`,
`app/u/[handle]/page.tsx`, `app/globals.css`, `lib/connections.ts`, `lib/copy.ts`, new `lib/vendor-env.ts`,
`lib/auth/landing.ts`, `instrumentation.ts`; tests `lib/connections.test.ts`, `lib/copy.test.ts`, new
`lib/vendor-env.test.ts`, `lib/auth/landing.test.ts`, `e2e/connect.spec.ts`, `e2e/signin.spec.ts`.
