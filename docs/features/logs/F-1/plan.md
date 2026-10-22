# F-1 · Broker connection, end to end · Implementation plan (converged draft, round 1)

Date: 2026-10-22. Feature: `docs/features/F-1-broker-connection.md` (Status ready). Inputs:
`plan-round1-business-lead.md`, `plan-round1-ux-lead.md`, `plan-round1-engineer.md`. This plan
decides how, not what; no decision in the feature file is changed. One gap for the owner is listed
under Open questions; the build proceeds with the stated default unless the owner answers otherwise.

## 1. The three PRs, in build order

**PR-1 · Sign-in, attestation, sessions, deletion, "How records are calculated".** Branch
`autopilot/feature-1-signin`. Real sessions replace the dev stub (`lib/session.ts`): a random token,
hashed in a `sessions` table, `httpOnly` `sameSite=lax` cookie, `Secure` on HTTPS. Three methods:
the two device-native providers via standard OIDC authorization code with PKCE, state and nonce,
id_token verified against the provider's JWKS with `node:crypto` (no dependency); the email link
(single-use token, hashed, 15 minutes, one HTTPS call to the email vendor); provider buttons render
only when their config is present. The 18+ attestation is written to `signup_attempts` before any
redirect; the `users` row is created at consent (brokerage path) or at first sign-in completion
(other paths), always with `signup_attempt_id not null`. Funnel events on `funnel_events`. Account
deletion at `/settings` (vendor user deleted first, user row cascades, `handle_reservations`
keeps the handle for one year with no personal data). Static `/how` page describing FIFO matching,
fees, excluded sells, equal-weight drawdown and the evidence range, in the words of `lib/trades.ts`.
The dev sign-in form remains at `/login/dev` only under `ALLOW_DEV_AUTH=1` (existing e2e tests keep
passing). Why first: the attempt-first identity model is the spine PR-2 builds on; building the
state machine on the stub means building it twice.

**PR-2 · Connection state machine, trust notice, embedded portal, consent, chunked import, banner,
empty profile, decline/expiry/failure, positions, sign-in by connection.** Branch
`autopilot/feature-1-connection`. `connections` rows with states pending → importing → connected,
or pending → declined | expired, or failed, one timestamp per state, illegal transitions rejected in
`lib/connections.ts`. Connect validates the link only (zero depth): list accounts, provisional
claims (`broker_accounts.confirmed_at null`), no activities. Consent confirms claims, creates the
user row for a brokerage-first attempt, and starts the import: one vendor page per client-polled
step, each step one transaction under a per-user advisory lock; `closed_trades` rebuilt once at the
end in one transaction; `connected` only when every claimed account reports its initial transaction
sync complete. Hourly `/api/sync` keeps one transaction per user with the same lock (a concurrent
sync is skipped), expires pending rows older than 24 hours and runs vendor cleanup with retry; profile
and consent reads apply the expiry lazily (marking only). Decline and expiry delete the connection at
the vendor (and the vendor user when no user row exists) and release provisional claims; confirmed
claims are never released. A new connection whose accounts are all confirmed-claimed by one user
signs that user in and drops the new link; a different signed-in user gets the existing claimed
message. Positions (TR-4) read per account and stored as symbol + unrealized percent only. Size is
above the Gate's diff cap; if request #2 is refused, PR-2 splits into 2a (server: state machine,
consent, decline, sync lock) and 2b (portal modal, banner, empty profile, positions).

**PR-3 · Heavy-use tests and fakes sizing.** Branch `autopilot/feature-1-heavy`. 10,000 activities
per trader across 5 accounts import and rebuild under a bounded time; three repeated syncs leave
`closed_trades` byte-identical; 500 traders synced by 8 concurrent callers, each processed exactly
once; the e2e fakes gain the scenario parameters these need. Lands before Status: built.

## 2. Screens (375px, one column, `.page`, existing tokens, controls ≥ 44px, visible focus,
reduced motion honored, footer disclaimer on every page)

The UX lead's copy is adopted verbatim unless marked *amended*.

- **S1 Sign-in** `/login`. H1 "Publish your trades". Sub "Read-only. We can never place trades or
  move money." Buttons: phone-maker, email-provider (labels from config), email field + "Send me a
  link", divider, secondary "Connect a brokerage instead". Checkbox "I am 18 or older and accept
  the Terms and Privacy Policy" (linked); unchecked tap focuses it with "Confirm you are 18 or older
  to continue." No handle or display-name fields (business lead): a provisional handle is derived
  and editable on the profile. Order: phone-maker first on that maker's phones, else email-provider;
  last method used listed first (`localStorage`). *Link sent* and *Expired link* copy as written.
- **S2 Trust notice** `/connect`, a page. H1 "Before you connect". The four lines as written. Links
  to SnapTrade's security page ("opens SnapTrade's site") and to "How records are calculated".
  Primary *amended* to "Connect brokerage (read-only)": the UX lead offered the swap; it names the
  trader's goal and the promise in one label, and the vendor is already named in the lines above.
  Copy lives in `lib/copy.ts`, tested against the banned list.
- **S3 Portal**: vendor portal in a `role="dialog"` modal labeled "Connect your brokerage", focus
  trapped, Escape or Close returns focus. Loading states as written (3 s, 8 s "Open in a new page
  instead"). *Amended*: the app cannot observe a blocked popup inside the vendor's frame, so the
  fallback triggers on (a) browsers without `window.opener` (in-app, standalone), which go straight
  to redirect, (b) any error event from the portal, (c) the 8 s link. Closed without a link → S7a;
  error → S7b; success → S4.
- **S4 Consent** `/connect/consent`. All copy as written, including "Every account under this login
  (N found)", "Decide by ‹date time›, or this link is removed automatically.", primary "Import my
  record", secondary "Don't import". The primary tap is the recorded consent (`consent_at`).
- **S5 Profile with import banner**: `role="status"`, `aria-live="polite"`, "Importing your record ·
  N trades so far", poll 2 s, announce at most every 5 s, no layout shift. *Amended*: after 60 s
  with no new rows, a second line "Your broker is still sending history." (the vendor's initial sync
  can take minutes). "Import finished." until next navigation. No celebration.
- **S6 Declined / expired**: as written.
- **S7 Errors** a–d: as written; `role="alert"`, focus to the heading.
- **S8 Empty record**: open positions block first (TR-4), then "No closed trades yet. Your record
  starts with your first close." Same signed out; "Record since" omitted. No stat preview.
- **S9 Delete profile** `/settings` (added; both plans require deletion, neither listed the screen).
  "Delete your profile. This removes your personal data, your broker connection and your record.
  Your handle is held for one year and cannot be reused." Primary "Delete my profile", secondary
  "Keep it". No confirm-shaming, no pre-checked anything.

Tap count S1 → S5: four (method, attest/continue, connect, import), inside both plans' limits.

## 3. Data model (idempotent additions to `db/schema.sql`; no drop, truncate or delete from)

- `signup_attempts(id, created_at, method check in ('provider_a','provider_b','email','brokerage','dev'), adult_attested_at not null, snaptrade_user_id, snaptrade_secret_enc, referred_by_user_id, referred_surface, user_id references users, completed_at)`. No personal data.
- `users`: add `signup_attempt_id references signup_attempts` (not null for new rows; existing rows backfilled with a synthetic attempt in the same migration block), `deleted_at`.
- `identities(user_id, provider, subject, email, created_at, unique(provider, subject))`.
- `sessions(token_hash primary key, user_id, created_at, expires_at, last_seen_at)`.
- `login_links(token_hash primary key, email, attempt_id, expires_at, used_at)`.
- `funnel_events(id, attempt_id, name, at, meta jsonb)`; `name` checked against the list in §5; `meta` keys allow-listed in code.
- `connections(id, attempt_id, user_id, vendor_authorization_id, institution, state check in ('pending','importing','connected','declined','expired','failed'), pending_at, importing_at, connected_at, declined_at, expired_at, failed_at, consent_at, import_cursor jsonb, imported_count int, cleanup_done_at, disconnected_at)`.
- `broker_accounts`: add `connection_id`, `confirmed_at`, `removed_at`, `is_paper boolean default false`. Claims with `confirmed_at null` are provisional and released on decline or expiry; confirmed rows are never deleted.
- `open_positions(user_id, account_id, symbol, unrealized_pct, fetched_at, primary key (user_id, account_id, symbol))`: no units, prices or amounts.
- `handle_reservations(handle primary key, until)`.
- `lib/broker.ts` additions (only vendor importer): `listAccounts` (ids, connection id, institution, sync status, paper flag), `listConnections`, `deleteConnection`, `deleteUser`, `fetchActivitiesPage(accountId, cursor)`, `fetchPositions(accountId)`; `SNAPTRADE_BASE_URL` → SDK `basePath` for the fakes. Encryption unchanged; `connectionType: 'read'` unchanged.

## 4. Test plan summary

Every acceptance criterion maps to a test (engineer's log §3 has the per-criterion table). Unit:
OIDC verification, link lifecycle, state transitions, funnel event shape, copy against the banned
list, banner count logic. DB-integration (`dbTest` pattern): attestation-before-user at the schema
level, provisional vs confirmed claims, decline and expiry cleanup, sign-in-by-connection, deletion
end to end, advisory-lock concurrency, failure atomicity, edge cases. E2e (Playwright,
`ALLOW_DEV_AUTH=1`, in-repo fakes for the vendor and its portal page, the two OIDC issuers and the
email sender): the whole flow at 375px signed out and signed in, popup-blocked fallback, keyboard-only
run, every error state forced, 24-hour expiry with a clock. Load (PR-3): 10k activities × 5 accounts,
500 traders per hourly tick, concurrent callers. The compliance scanner runs before the tester.

## 5. Funnel events (per `signup_attempts` row, no personal data)

`landed` (meta: `source` shared-link | direct), `method_chosen` (meta: `method`), `attested`,
`notice_seen`, `portal_opened` (meta: `mode` embedded | redirect), `link_succeeded` (meta:
`accounts` count), `consented`, `declined`, `expired`, `abandoned`, `failed`, `import_finished`
(meta: `trades`, `seconds`), `own_profile_viewed`. Measures: landed → consented in one session
(target ≥ 40% of portal opens), median seconds method_chosen → import_finished, consented /
link_succeeded. A test asserts no event row matches `@`, a 7+ digit run or any handle.

## 6. Pre-authorization requests (owner answers once, before the build)

| # (IMPLEMENTATION.md) | Needed before | Why |
|---|---|---|
| 1 Protected paths | PR-1 (`lib/session.ts`), PR-2 (`lib/broker.ts`, `package.json`) | Gate stops those PRs otherwise |
| 2 Diff cap ~2,000 for `feature` PRs, or accept the 2a/2b split | PR-2 | PR-2 is ~1,500 lines with tests |
| 3 Budgets (`TEAM_BUDGET_USD`, `BUDGET_ENGINEER`, `FEATURE_MAX_ATTEMPTS`) | PR-3 | test runtime and rounds |
| 4 Test-mode secrets: vendor key pair, both providers' client ids and secrets, email key and from-address, session secret, site URL | PR-1 (sign-in, email), PR-2 (vendor) | the build runs on fakes; the committee's running preview needs the real test apps |
| 5 One dependency: the vendor's web SDK | PR-2 | if no, the same iframe + message protocol is built in-repo (~60 lines) |
| 6 One vendor: email sending for the magic link | PR-1 | the one Phase 1 vendor exception |
| 7 Hourly call to `/api/sync` | PR-2 | expiry and vendor cleanup run in that tick; lazy expiry covers the visible rule meanwhile |
| 8 Function duration ≥ 60 s | PR-2 | one vendor page per import step |
| 9 Preview deploys, or in-job start + screenshots | committee review | round one accepts in-job start |
| 10 Terms and Privacy placeholders, consent copy | PR-1 (attestation links), PR-2 (consent) | POLICY P6/F3 |
| 11, 12 Process wiring | pipeline | not needed for the first run in the owner's chat |

## 7. Compliance checklist (COMPLIANCE.md §1), answered for the code to be written

1. Performance: yes (profile, banner, positions as percent). Layout disclaimer on every page; empty state shows no stats; losses as gains. → §2.
2. Personal data: yes. Fields: email and provider subject (`identities`), session hash, attestation time, vendor ids and encrypted secret. Owner-only reads; deleted with the user including the vendor user; funnel rows carry none. → §3.
3. Money: no.
4. Email: yes, transactional magic link only, one vendor, no marketing, no SMS. → §5.
5. User text: no new text.
6. Sign-up/age/identity: yes. Attestation on every method before the user row, enforced by a not-null FK and tested. → §7.
7. Vendor/dependency: yes. The vendor's web SDK (owner's yes), the email vendor; every script, font and image self-hosted; the portal loads only on `/connect` after S2. → §8, §3.
8. Screen reader/keyboard: yes. Dialog focus trap, live region, labeled controls, focus to error headings, reduced motion. → §9.
9. Security: yes. Hashed sessions, PKCE/state/nonce, single-use links, rate limits on link sending and sign-in, cron bearer kept, secrets encrypted, nothing logged with ids. → §10.
10. Claims: yes, the trust notice and consent copy: fixed strings in `lib/copy.ts`, tested against the banned list; "Verified" wording unchanged. → §11.
11. Checkout: no.

## 8. Open questions (for the owner; build proceeds with the default)

- The vendor marks simulated ("paper") accounts. "Every account under this login" would publish
  simulated trades as Verified. Default: paper accounts are excluded from the record and shown on
  the profile as excluded, like sells without an entry. The owner may instead include them with a
  label, or refuse logins that contain one.

## Sign-off

Business lead:

UX lead:

Engineer:
