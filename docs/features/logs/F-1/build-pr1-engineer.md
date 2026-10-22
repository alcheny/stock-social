# F-1 · PR-1 build log · Engineer

Date: 2026-10-22. Built from `plan.md` §1 (PR-1 scope), §2 (S1, S2, the attestation), §3 (PR-1 tables), §4
(PR-1 tests), §5 (funnel events), §7 (compliance). No decision in `docs/features/F-1-broker-connection.md`
changed. No new dependency; `package.json` and `lib/broker.ts` untouched. `lib/session.ts` edited under the
owner's F-1 pre-authorization.

## What PR-1 delivers

- **Real sessions** (`lib/auth/sessions.ts`, `lib/session.ts`): random 32-byte token, HMAC-signed with
  `SESSION_SECRET` (falls back to `APP_SECRET_KEY`) in an `httpOnly`, `sameSite=lax`, `Secure`-when-https
  cookie `sid`; only the sha256 is stored in `sessions`; 30 days; `last_seen_at` touched hourly. The old plain
  `uid` cookie is never accepted. The dev form moved to `/login/dev` (`login` action) and keeps the production
  guard: it throws in production unless `ALLOW_DEV_AUTH=1`; `/login` links to it only when allowed.
- **S1 `/login`** (`app/login/page.tsx`): the UX lead's copy verbatim from `lib/copy.ts`; no handle fields;
  one attestation checkbox linking `/terms` and `/privacy`; provider buttons only when configured
  (`lib/auth/providers.ts`); email field + "Send me a link"; divider; "Connect a brokerage instead". Order:
  device maker first when the user agent matches the configured pattern, else email provider; the last
  method used is moved first on the client (`localStorage`, `app/login/order.tsx`). Enter in the email field
  sends the link (a hidden default submit). Unchecked box → redirect back, box focused, `aria-describedby`
  "Confirm you are 18 or older to continue.", nothing written.
- **Attestation first on every path** (`lib/auth/attempts.ts`): `startSignIn` writes `signup_attempts`
  (method, `adult_attested_at`, referral) before any redirect; the `users` row is created only when the
  method completes, with `signup_attempt_id not null` enforced by the schema. Provisional handle
  `trader_` + 8 random chars, never from the email; "Change handle" on the owner's own profile.
- **OIDC code flow** (`lib/auth/oidc.ts`, `app/auth/actions.ts`, `app/auth/callback/[provider]/route.ts`):
  discovery, PKCE S256, state and nonce in a signed 10-minute `auth_tx` cookie, token exchange with client
  secret (or the device maker's ES256 client-secret JWT), id_token verified with `node:crypto` against the
  JWKS: RS256/ES256 only (`none`/HMAC rejected before any key lookup), kid match (one refetch on an unknown
  kid), signature, issuer, audience (+ `azp` for lists), expiry, future `iat`, nonce, subject. GET and
  form_post (POST) callbacks. Known subject → same user; verified email on file → same user; else new user.
- **Email link** (`lib/auth/links.ts`, `lib/auth/email.ts`, `app/auth/email/route.ts`): single-use hashed
  token, 15 minutes, claimed atomically; "Send again" on `/login/sent`; rate limit 5 per address and 3 per
  attempt per 15 minutes (`lib/auth/rate-limit.ts`). Sending is one HTTPS POST behind a `Sender` interface;
  outside production with no `AUTH_EMAIL_SEND_URL` the in-memory outbox is used and `/login/dev` shows the
  last link (so the e2e email path runs in CI with no extra configuration).
- **S2 `/connect`** (`app/connect/page.tsx`): the four lines, the vendor's security page link ("opens
  SnapTrade's site") and "How records are calculated" (`/how`, a PR-2a page), primary "Connect brokerage
  (read-only)" → `/connect/start` (today's redirect flow, moved from `app/connect/route.ts`; PR-2b replaces
  it with the portal). Records `notice_seen` for the attempt. Brokerage-first from S1 creates the attempt and
  lands here (the stub the plan allows).
- **Funnel** (`lib/funnel.ts`): the plan's 14 names in a CHECK, meta keys allow-listed per event, values
  refused when they look like personal data. PR-1 records `landed` (at the S1 render time carried in the form),
  `method_chosen`, `attested`, `notice_seen`, `own_profile_viewed` (once per completed attempt).
- **Deletion action** (`lib/delete.ts`, `deleteProfile` in `app/auth/actions.ts`): vendor user first (a
  failure deletes nothing), then the `users` row cascades, `handle_reservations(handle, until)` for 365 days.
  The two-step screen is PR-2a. `ponytail:` the default vendor deletion throws until PR-2a adds `deleteUser`
  to `lib/broker.ts`, so a connected profile is not deleted while leaving its vendor data behind.
- **Placeholders** `/terms`, `/privacy`: "Placeholder: the owner supplies the final text before launch."
- **Schema** (`db/schema.sql`, idempotent additions only; applied twice in the tests): `signup_attempts`,
  `users.signup_attempt_id` (backfilled with a `dev` attempt per existing row, then `set not null`),
  `users.deleted_at`, `identities`, `sessions`, `login_links`, `handle_reservations`, `funnel_events`.
  No drop, truncate or delete from.

## Files changed

New: `lib/copy.ts`, `lib/funnel.ts`, `lib/delete.ts`, `lib/auth/{attempts,email,links,oidc,providers,rate-limit,sessions,tx}.ts`,
`app/auth/actions.ts`, `app/auth/callback/[provider]/route.ts`, `app/auth/email/route.ts`,
`app/login/{order.tsx,dev/page.tsx,sent/page.tsx}`, `app/connect/page.tsx`, `app/terms/page.tsx`, `app/privacy/page.tsx`,
`e2e/signin.spec.ts`, `e2e/fakes/{oidc,email}.ts`, seven test files (below).
Changed: `lib/session.ts`, `app/login/page.tsx`, `app/actions.ts` (dev `login` via an attempt), `app/u/[handle]/page.tsx`
(handle form, `own_profile_viewed`), `app/globals.css`, `db/schema.sql`, `.env.example`, `scripts/seed.ts`,
`lib/claims.test.ts`, `lib/reflections.test.ts`, `e2e/app.spec.ts` (user inserts go through an attempt; the dev
form is at `/login/dev`; the signed-out redirect assertions on `/login` are unchanged). Moved:
`app/connect/route.ts` → `app/connect/start/route.ts`.

## Tests added (test count 327 → 355 unit, 46 → 55 e2e)

| File | Covers |
|---|---|
| `lib/copy.test.ts` (2) | every F-1 string vs `PROMO`, `MARKS`, `MINORS` and endorse/recommend/guarantee/secure; S1/S2 copy verbatim |
| `lib/funnel.test.ts` (4) | 14 names, meta allow-list, personal-looking values refused, schema has no personal columns; DB: a full email sign-up leaves rows with no `@`, 7+ digit run or handle |
| `lib/auth/oidc.test.ts` (8) | valid RS256/ES256; **wrong audience** (incl. list without `azp`); **`alg: none`** and HS256; **unknown kid**, kid/alg mismatch, bad signature; issuer, expiry, future iat, nonce, subject, malformed; PKCE; authorize URL; client-secret JWT; exchange body; JWKS refetch once on rotation |
| `lib/auth/links.test.ts` (4) | token/hash, 15 min, single use, `normalizeEmail`; sender: one call, bearer, body, errors carry no address or link, production requires a URL; rate limit |
| `lib/auth/sessions.test.ts` (3) | signed cookie value, tampering, old `uid` rejected; secret fallback; DB: create/lookup/expire/touch/delete, raw token never stored |
| `lib/auth/attempts.test.ts` (5) | provisional handle, provider config completeness, ordering, device UA; DB: no attempt without attestation, **no users row without a linked attempt (NOT NULL + FK)**, zero orphans; identity sign-in (new/same/email recovery), handle taken/reserved, handle change; referral insert-only |
| `lib/delete.test.ts` (2) | reservation = 365 days; DB: vendor failure deletes nothing, cascade, reservation has only handle+until, attempt survives without the person, handle unavailable afterwards |
| `e2e/signin.spec.ts` (9) | S1 at 375px signed out (copy, links, ≥44px controls, no h-scroll, light and dark screenshots), unchecked box blocks every path with focus and message and no row, email link end to end (attempt before redirect, provisional handle not from the email, signed cookie, funnel rows clean, second use expired), S2 lines/links/no third-party script + brokerage-first attempt and `notice_seen`, provider_a and provider_b OIDC flows (same user on repeat, bad state refused; skip with a message when the server has no provider configured), keyboard-only email path, dev form at `/login/dev` through an attempt |

## Commands run

| Command | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` (with a local Postgres 16, schema applied twice) | 355 tests, 355 pass |
| `npm test` without `DATABASE_URL` | 355 tests, 344 pass, 11 skipped ("no DATABASE_URL"), same pattern as `lib/claims.test.ts` |
| `node scripts/compliance.ts tree` | one violation, pre-existing and identical on `main`: `node_modules/@img/sharp-wasm32` (optional prebuilt package, `Apache-2.0 AND LGPL-3.0-or-later AND MIT`); nothing from this diff. Only a human adds the `LICENSE_REVIEWED` entry (`scripts/compliance.ts` is owner-only). |
| `node scripts/autopilot.ts guard main` | `guard: ok` |
| `npm run build` | success; new routes `/auth/callback/[provider]`, `/auth/email`, `/connect`, `/connect/start`, `/login/dev`, `/login/sent`, `/privacy`, `/terms` |
| `npx playwright test` with the fake issuer and sink configured on the server | 55 passed |
| `npx playwright test e2e/signin.spec.ts` with no provider/sink variables (CI's situation) | 6 passed, 2 skipped (the provider flows, with the reason printed) |

Screenshots per screen (light and dark, 375px) are written to the Playwright output folder by the spec.

## Not done, or done differently, and why

1. **Diff size.** The product diff is ~1,090 lines excluding tests and docs (~1,800 with tests), over the
   800 target. The plan's §6 #2 already asks the owner about the cap for F-1 PRs; what could still be cut
   without losing a requirement is small (the `.env.example` documentation, CSS). OIDC without a dependency,
   two providers, the email link, sessions, deletion and the attempt-first model do not fit 800 together.
2. **Provider e2e in CI.** `playwright.config.ts` and `.github/` are owner-only, so the server under test
   cannot be given the fake issuer's variables from this PR; the two provider tests skip with a message
   unless the server is started with the variables listed at the top of `e2e/signin.spec.ts`. The email and
   every other path run in CI as is. The owner can add the six `AUTH_*` variables to the e2e job (request #12).
3. **`landed` timing.** No cookie is set on a GET, so the landing time travels in a hidden field from the S1
   render to the submit and the `landed` event is written with the attestation (only attested visitors
   produce a funnel row; the S1 → attested drop-off needs a cookie-free page-view count, a follow-up).
4. **Vendor user deletion** waits for PR-2a's `lib/broker.ts#deleteUser` (protected file, PR-2 scope); the
   default throws rather than deleting the app row and leaving vendor data behind.
5. **"SnapTrade's security page" URL** is a constant (`NEXT_PUBLIC_VENDOR_SECURITY_URL`, default the
   vendor's `/security` path); the owner confirms the exact page and the vendor's audit wording to quote.
6. **`/how`** is linked from S2 and lands in PR-2a as planned.
7. **Sign-out** exists as an action (`signOut`) with no button; S9 `/settings` (PR-2a) is its screen.
8. **Device maker's phones first** uses a configured user-agent regex (`AUTH_DEVICE_PROVIDER_UA_PATTERN`)
   so no product name enters the repo (POLICY T1).

## Compliance checklist (docs/COMPLIANCE.md §1) for this diff

1. **Performance shown?** No new performance surface; S1, S2, sent, terms and privacy show no stats. The layout
   footer disclaimer is on every new page (e2e asserts it on S1).
2. **Personal data?** Yes: email (`login_links.email`, `identities.email`), provider subject
   (`identities.subject`), session hash (`sessions`), the signed transaction cookie (10 minutes). Owner-only
   reads; all cascade on `delete from users` (tested). `signup_attempts`, `funnel_events`, `handle_reservations`
   hold none (schema test + DB test). Errors and logs carry status codes and reasons only, never an address, token
   or link.
3. **Money?** No.
4. **Email/SMS/tracking?** One transactional email (the link) through one vendor behind `AUTH_EMAIL_SEND_URL`;
   no marketing, no SMS, no third-party script or font (e2e asserts no cross-origin `<script src>` on S2;
   `localStorage` holds only the last method name).
5. **User text?** None new (the handle keeps its existing `^[a-z0-9_]{3,20}$` rule).
6. **Sign-up/age/identity?** Yes: attestation on every method before any redirect; `users.signup_attempt_id`
   NOT NULL + FK; backfill for existing rows; tested at the schema level and end to end.
7. **Vendor/dependency/asset?** No dependency; the email vendor is the plan's one exception (§6 #6); nothing
   loaded from another company's servers.
8. **Screen reader/keyboard?** Labels on every control, `role="alert"` + `aria-describedby` + focus on the
   attestation error, 44px controls, visible `:focus-visible`, no animation added, keyboard-only e2e.
9. **Security posture?** Hashed sessions, signed cookies, PKCE/state/nonce, audience and algorithm checks,
   single-use links, rate limits, secrets only in env; `/login/dev` and the in-memory outbox exist only
   outside production or under `ALLOW_DEV_AUTH=1`.
10. **Claims in copy?** All strings fixed in `lib/copy.ts` and tested against `PROMO`, the marks list and
    endorse/recommend/guarantee/secure; the vendor is named only as the integrated vendor; "Verified" unchanged.
11. **Checkout?** No.
