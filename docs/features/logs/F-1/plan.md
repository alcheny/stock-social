# F-1 · Broker connection, end to end · Implementation plan (round 2)

Date: 2026-10-22. Feature: `docs/features/F-1-broker-connection.md` (Status ready). Inputs: the
round-1 plans and both sign-off files. This plan decides how, not what; no decision in the feature
file changes. One gap for the owner is under §9.

## 1. The PRs, in build order

**PR-1 · Sign-in, attestation, sessions, deletion action.** Branch `autopilot/feature-1-signin`.
Real sessions replace the dev stub (`lib/session.ts`): random token hashed in `sessions`, `httpOnly`
`sameSite=lax` `Secure` cookie. The two providers via OIDC code flow with PKCE, state and nonce,
id_token verified against the JWKS with `node:crypto`; the email link (single-use hashed token, 15
minutes); provider buttons render only when config is present. The 18+
attestation is written to `signup_attempts` before any redirect; the `users` row is created at
consent (brokerage path) or at first sign-in completion (other paths), always with
`signup_attempt_id not null`. Funnel events. Deletion server action (vendor user deleted first, user
row cascades, `handle_reservations` keeps the handle one year with no personal data); its screen is
in PR-2a. Dev sign-in stays at `/login/dev` under `ALLOW_DEV_AUTH=1`. ~700 lines, under the cap.
Why first: the attempt-first identity model is the spine of PR-2.

**PR-2a · Server: state machine, consent, decline/expiry/failure, import, sync lock, `/how`,
`/settings`.** Branch `autopilot/feature-1-connection`. States pending → importing → connected,
pending → declined | expired, importing → failed; one timestamp per state; illegal transitions
rejected in `lib/connections.ts`. Connect validates the link only (zero depth): list accounts,
provisional claims, no activities. Consent confirms the real-account claims, creates the user row
for a brokerage-first attempt and starts the import: one vendor page per step, one transaction per
step under a per-user advisory lock, cursor in `import_cursor`. Steps run from the client
poll while a tab is open **and from the hourly tick for every `importing` row**, so a closed tab
never stalls an import. `closed_trades` rebuilt once at the end; `connected` only when every claimed
account reports its initial sync complete. Hourly `/api/sync`: one transaction per user under the
same lock (a concurrent sync is skipped); advances `importing` rows; expires `pending` after 24
hours; `importing` with no progress for 24 hours → `failed`; vendor cleanup with retry.
Profile and consent reads apply expiry and staleness lazily (marking only), so the rules hold before
request #7. Decline and expiry delete the connection at the vendor (and the vendor user when no user
row exists) and release provisional claims; confirmed claims never. Sign-in by connection as in the
feature file. Static `/how` in the words of `lib/trades.ts`. A step that cannot finish within the
default function duration stores a partial page and resumes, so #8 is performance, not a blocker.

**PR-2b · Client: trust notice, portal, consent, banner, importing/empty profile, positions, error
screens.** Branch `autopilot/feature-1-connection-ui`. Positions (TR-4) as symbol + unrealized
percent only. A yes on request #2 opens 2a and 2b as one PR.

**PR-3 · Heavy-use tests.** Branch `autopilot/feature-1-heavy`. 10,000 activities × 5 accounts
import and rebuild under a bounded time; three syncs leave `closed_trades` byte-identical; 500
traders synced by 8 concurrent callers, each exactly once. Before Status: built.

## 2. Screens (375px, `.page`, existing tokens, controls ≥ 44px, visible focus, reduced motion,
footer disclaimer, light and dark; the UX lead's copy verbatim unless marked)

- **S1 Sign-in** `/login`. All copy as written. No handle fields: a provisional handle is derived
  (never from the email) and editable on the profile. Phone-maker first on its phones, else
  email-provider; last method used first (`localStorage`).
- **S2 Trust notice** `/connect`, a page. The four lines and links as written. Primary "Connect
  brokerage (read-only)". Copy in `lib/copy.ts`, tested against the banned list.
- **S3 Portal**: vendor portal in a `role="dialog"` modal, focus trapped, Escape or Close returns
  focus. Loading states as written. **"Open in a new page instead" is a persistent footer link from
  open until success**, starting the redirect flow on the same attempt. Automatic redirect on no
  `window.opener` (in-app, standalone) and on any portal error event. Closed without a link → S7a;
  error → S7b; success → S4.
- **S4 Consent** `/connect/consent`. Copy as written; with simulated accounts the account line is
  "N accounts found (M simulated, not imported)". Primary "Import my record" (the tap is
  `consent_at`), secondary "Don't import". Zero real accounts → no consent screen, no user row: S6c.
- **S5 Profile while importing**: banner `role="status"`, `aria-live="polite"`, "Importing your
  record · N trades so far", poll 2 s, announce at most every 5 s, no layout shift. After 60 s with
  no new rows: "Your broker is still sending history. You can leave; the import continues." **Body
  while `importing`: positions (if fetched), then "Your trades appear here as they import." Never
  the S8 copy.** Same signed out. On finish, one distinct line "Import finished.", no motion.
- **S6 Declined / expired**: as written. **S6c** (added) "No real brokerage account found." with
  "Connect a different brokerage"; cleanup as for a decline.
- **S7 Errors** a–d: as written; `role="alert"`, focus to the heading. **S7a's second action is
  "Continue in a new page"** (redirect, same attempt). S7b also covers a stale import.
- **S8 Empty record** (state `connected`, no closes): positions first (TR-4), then "No closed trades
  yet. Your record starts with your first close." Same signed out; no stat preview. Excluded
  simulated accounts listed beside excluded sells, same component, in every state.
- **S9 Delete profile** `/settings`. View 1: explanation as written, primary "Delete my profile",
  secondary "Keep it". **View 2 (added): "This cannot be undone." with "Delete my profile" (the only
  tap that deletes) and "Keep it"**. No typed handle, no pre-checked box, no shaming.

Tap count S1 → S5: four.

## 3. Data model (idempotent additions to `db/schema.sql`; no drop, truncate or delete from)

- `signup_attempts(id, created_at, method check in (provider_a, provider_b, email, brokerage, dev), adult_attested_at not null, snaptrade_user_id, snaptrade_secret_enc, referred_by_user_id, referred_surface, user_id, completed_at)`. No personal data.
- `users`: add `signup_attempt_id` (not null for new rows; existing rows backfilled), `deleted_at`.
- `identities(user_id, provider, subject, email, created_at, unique(provider, subject))`; `sessions(token_hash pk, user_id, created_at, expires_at, last_seen_at)`; `login_links(token_hash pk, email, attempt_id, expires_at, used_at)`; `handle_reservations(handle pk, until)`; `funnel_events(id, attempt_id, name, at, meta jsonb)` with `name` checked against §5 and `meta` keys allow-listed.
- `connections(id, attempt_id, user_id, vendor_authorization_id, institution, state check in (the six states), one `*_at` per state, consent_at, import_cursor jsonb, imported_count, last_progress_at, failure_reason check in ('stale','vendor','link_closed','link_error'), portal_mode check in ('embedded','redirect'), cleanup_done_at, disconnected_at)`.
- `broker_accounts`: add `connection_id`, `confirmed_at`, `removed_at`, `is_paper boolean default false`, `paper_seen_at`. Provisional claims released on decline, expiry or S6c; confirmed rows never deleted. `is_paper` re-read on every sync.
- `open_positions(user_id, account_id, symbol, unrealized_pct, fetched_at)`: no units, prices or amounts.
- `lib/broker.ts` (only vendor importer): `listAccounts` (with sync status and paper flag), `listConnections`, `deleteConnection`, `deleteUser`, `fetchActivitiesPage(accountId, cursor, limit)`, `fetchPositions`; `SNAPTRADE_BASE_URL` for the fakes. Encryption and `connectionType: 'read'` unchanged.

## 4. Test plan summary

Every acceptance criterion maps to a test (engineer's log §3 table, extended here). Unit: OIDC
verification (nonce, issuer, signature, expiry, **wrong audience, `alg: none`, unknown `kid`**), link
lifecycle, state transitions, funnel event shape, copy against the banned list, copy by state. DB-integration (`dbTest`): attestation-before-user at the schema level, provisional vs
confirmed claims, decline/expiry/S6c cleanup, sign-in-by-connection, deletion end to end (the first
action never deletes), advisory-lock concurrency, failure atomicity,
**tick advances an `importing` row with no client poll; no progress for 24 hours → `failed`; a
paper account is excluded, counted, and stays excluded when flagged on a later sync; zero real
accounts creates no user row**. E2e (Playwright, `ALLOW_DEV_AUTH=1`, in-repo fakes for the vendor,
its portal, both OIDC issuers and the email sender): the whole flow at 375px signed out and in,
**light and dark, a screenshot per screen**; redirect via the persistent link with the portal idle,
and via S7a; keyboard-only; every error state forced; expiry and staleness with a clock; **tab
closed mid-import, tick run, banner resumes**; no S8 copy while importing. On the preview: the
fallback with the real portal and popups blocked. The compliance scanner runs before the tester.

## 5. Funnel events (per `signup_attempts` row, no personal data)

`landed` (meta: `source`), `method_chosen` (meta: `method`), `attested`, `notice_seen`,
`portal_opened` (meta: `mode`), `link_succeeded` (meta: `accounts`, `paper`), `no_real_account`,
`consented`, `declined`, `expired`, `abandoned`, `failed` (meta: `reason`), `import_finished`
(meta: `trades`, `seconds`), `own_profile_viewed`. Measures: landed → consented in one session
(target ≥ 40% of portal opens), median seconds to import_finished, consented / link_succeeded, share
of redirect opens. A test asserts no event row matches `@`, a 7+ digit run or any handle.

## 6. Pre-authorization requests (owner answers once, before the build)

| # | Needed before | Why |
|---|---|---|
| 1 Protected paths | PR-1 (`lib/session.ts`), PR-2a (`lib/broker.ts`, `package.json`) | Gate stops those PRs otherwise |
| 2 Diff cap ~2,000 | optional | PR-1, 2a and 2b each fit the 800 cap; a yes merges 2a+2b |
| 3 Budgets | PR-3 | test runtime and rounds |
| 4 Test-mode secrets | PR-1, PR-2a | the build runs on fakes; the preview needs real test apps |
| 5 One dependency: the vendor's web SDK | PR-2b | if no, ~60 lines in-repo |
| 6 One vendor: email sending | PR-1 | the Phase 1 vendor exception |
| 7 Hourly call to `/api/sync` | before Status: built | not a blocker: lazy marking covers the visible rules; without it imports advance only with a tab open |
| 8 Function duration ≥ 60 s | before Status: built | not a blocker: partial-page resume fits the default |
| 9 Preview deploys | committee review | in-job start accepted |
| 10 Terms and Privacy placeholders | PR-1, PR-2b | POLICY P6/F3 |
| 11, 12 Process wiring | pipeline | not needed yet |

## 7. Compliance checklist (COMPLIANCE.md §1)

1. Performance: yes; disclaimer on every page; empty and importing states show no stats. 2. Personal data: yes; email, provider subject, session hash, vendor ids and encrypted secret; owner-only reads; deleted with the user after a second confirmation; none in funnel rows. 3. Money: no. 4. Email: transactional link only, one vendor. 5. User text: none new. 6. Sign-up/age: attestation before the user row on every method, not-null FK, tested. 7. Vendor/dependency: the web SDK (owner's yes), the email vendor; assets self-hosted. 8. Screen reader/keyboard: focus trap, live region, labeled controls, reduced motion. 9. Security: hashed sessions, PKCE/state/nonce, audience and algorithm checks, single-use links, rate limits, secrets encrypted. 10. Claims: fixed strings in `lib/copy.ts` tested against the banned list; "Verified" unchanged; simulated trades never carry it. 11. Checkout: no.

## 8. Round 2 changes

UX lead's demands, all met:

1. **Persistent redirect link.** S3 keeps "Open in a new page instead" for the modal's whole life;
   S7a's second action is "Continue in a new page". `portal_mode` added; e2e covers both routes.
2. **Import progresses without the browser.** The hourly tick advances every `importing` row;
   `last_progress_at` added; 24 hours without progress → `failed`, S7b; the 60 s line ends "You can
   leave; the import continues." Tests: tick advances, stale → failed, tab-closed e2e.
3. **No empty-record copy while importing.** S5 body is positions + "Your trades appear here as they
   import."; S8 copy only in state `connected`. Unit test by state.
4. **Second deletion confirmation.** S9 view 2 ("This cannot be undone."); only its primary deletes.
   Integration test: the first action deletes nothing.

Business lead's notes: 1 adopted (`/how` and `/settings` to PR-2a; 2a/2b default; #2 optional).
2 adopted (lazy marking; partial-page resume; #7 and #8 moved to "before Status: built"). 3 adopted
(light/dark screenshots in the e2e walk). 4 adopted as a follow-up measure. 5 adopted, plus unknown
`kid`. Paper accounts: the recommendation is the default (§9). UX notes adopted.

## 9. Open questions (for the owner; build proceeds with the default)

- Simulated ("paper") accounts. Default, per the business lead: **exclude and count**. They never
  enter the record or carry "Verified"; consent reads "N accounts found (M simulated, not imported)";
  zero real accounts → no user row, "No real brokerage account found." (S6c); excluded simulated
  accounts listed beside excluded sells; flag re-read on every sync. The owner may instead include
  them with a label (advised against) or refuse logins containing one.

## Sign-off

Business lead: SIGNED (round 1, with notes adopted)

UX lead: SIGNED (round 2; notes: hourly call tied to Status: built; count may lag up to an hour between ticks)

Engineer: SIGNED (round 2, author of the revision)

Plan signed 2026-10-22 by all three members. Build starts with PR-1.
