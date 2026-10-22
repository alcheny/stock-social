# F-1 · Plan round 1 · Engineer

Date: 2026-10-22. Read: both round-1 plans, the feature file, the named code paths, the vendor SDK
(v12.2.22) surface. No decision in the feature file is changed.

## 1. Feasibility, point by point

**PR order: sign-in first.** The business lead wants the state machine first on the dev stub. The
stub creates the `users` row at login; mechanic (c) creates it at consent, with the attestation and
vendor link on `signup_attempts`. Built on the stub, every connection row hangs off a user id and is
rewritten when the attempt-first model lands: the hardest part built twice. PR-1 is bounded (OIDC
with runtime crypto, a magic link, a sessions table); the dev form stays behind `ALLOW_DEV_AUTH=1`
for e2e (existing tests use it). Provider buttons render only when configured, so PR-1 ships on the
email link alone if secrets are late.

**Embedded portal (S3).** The SDK confirms: the portal URL expires in 5 minutes; `customRedirect`
and `immediateRedirect` are ignored inside an iframe. So the modal runs on the portal's `postMessage`
events (success, error, abandoned, close), the fallback on `customRedirect`. The vendor's web SDK
wraps exactly that; if request #5 is refused, the protocol is ~60 lines in `app/connect/portal.tsx`. Both plans assume we can see the popup being blocked. We cannot:
the broker popup opens inside the vendor's iframe. What works: browsers without `window.opener`
(in-app, standalone) go straight to redirect; any portal error and the 8 s "Open in a new page
instead" link lead to redirect. The popup-blocked test nulls `window.open` in every frame; the fake
portal posts an error and the test asserts the fallback completes.

**Zero-depth connect, consent (S4).** `listUserAccounts` returns the connection id,
`institution_name`, `sync_status`, `is_paper`. Provisional claims use the account ids; "N found" is
the list's length.

**Vendor data is daily-cached.** A fresh connection's activities can be empty while the vendor's
initial sync runs (`sync_status.transactions.initial_sync_completed`). The import must not reach
`connected` until that flag is true for every claimed account, or the trader lands on a frozen empty
record. Banner adds "Your broker is still sending history" after 60 s. One vendor page
(`limit ≤ 1000`) per polled step is right.

**Decline, expiry, deletion.** `removeBrokerageAuthorization(connectionId)` exists and is queued at
the vendor (asynchronous); an attempt with no user row also gets `deleteSnapTradeUser`. Lazy expiry
on read only marks the row; the hourly tick makes the vendor call with retry, so a public page never
calls the vendor inline. Account deletion: `deleteSnapTradeUser`, cascade the user row,
`handle_reservations(handle, until)` with no personal data.

**Sign-in by connection.** If every account of the new vendor user is confirmed-claimed by one user,
sign that user in and delete the new connection and vendor user.

**TR-4 positions.** `getAllAccountPositions(accountId)` gives units, price, average cost; we store
symbol, unrealized percent and fetched-at only.

**Gap for the owner.** The vendor flags `is_paper` accounts; "every account under this login" would
publish simulated trades as Verified. Default: exclude and count them. Logged in plan.md.

**Everything else** in both plans builds as written, with the UX lead's strings.

## 2. Size

| PR | Files | Schema (idempotent adds only) | Lines | Risks |
|---|---|---|---|---|
| PR-1 sign-in | `lib/session.ts` (protected), `lib/auth/{oidc,email-link,attempts}.ts`, `lib/funnel.ts`, `app/login/*`, `app/auth/{[provider],callback,email}/route.ts`, `app/how/page.tsx`, `app/settings/page.tsx` (delete), `.env.example`, tests | `signup_attempts`, `sessions`, `identities`, `login_links`, `funnel_events`, `handle_reservations`; `users.signup_attempt_id`, `users.deleted_at` | ~900 | Hand-rolled OIDC (JWKS verification, state, nonce, PKCE, the phone maker's client-secret JWT); unit tests on generated keys. |
| PR-2 connection | `lib/broker.ts` (protected: authorizations, delete connection/user, positions, paged activities), `lib/connections.ts`, `lib/claims.ts`, `lib/sync.ts` (advisory lock, one transaction, chunks), `lib/copy.ts`, `app/connect/*`, `app/u/[handle]/{page,import-banner}.tsx`, `app/api/sync/route.ts`, `package.json` (if #5), tests | `connections` (state, one timestamp per state, `consent_at`, `import_cursor`, `imported_count`, `vendor_authorization_id`, `attempt_id`, `user_id`); `broker_accounts.{connection_id,confirmed_at,removed_at}`; `open_positions` | ~1,500 | Over the 800-line Gate cap (#2); fallback split 2a state machine + consent + decline, 2b portal + banner + empty profile + positions. Chunk step under the function limit (#8). |
| PR-3 heavy tests | `lib/sync.heavy.test.ts`, `lib/connections.heavy.test.ts`, `e2e/connect.spec.ts`, `e2e/fakes/*` | none | ~400 | CI time: generated data, target under 2 minutes. |

Gaps: "How records are calculated" in **PR-1** (static, independent; the PR-2 notice link resolves
on landing). Positions read in **PR-2** (needs the connection and empty profile).

## 3. Test plan

U unit, D DB-integration (`dbTest`: skipped without `DATABASE_URL`, schema in `before`, tagged rows
cleaned in `finally`), E e2e (Playwright, `ALLOW_DEV_AUTH=1`, fakes below), L load.

| Criterion | File | Asserts | Kind |
|---|---|---|---|
| Three methods, attestation first | `lib/auth/oidc.test.ts`, `email-link.test.ts`, `e2e/signin.spec.ts` | token rejected on bad nonce/issuer/signature/expiry; link single-use, 15 min; each path blocks unchecked; no `users` row until consent | U, E |
| Funnel events | `lib/funnel.test.ts`, `.db.test.ts` | names enumerated, meta keys allow-listed; rows match no `@`, 7+ digits, handle | U, D |
| Trust notice | `lib/copy.test.ts`, e2e | passes `PROMO` plus `endorse|recommend|guarantee|\bsecure\b`; renders before any portal script | U, E |
| Portal + fallback | `e2e/connect.spec.ts` | dialog visible, trapped; `window.open` nulled → redirect reaches consent | E |
| Link + claims only | `lib/connections.db.test.ts`, e2e | `pending_at`, provisional claims, `activities` empty; depth and N shown | D, E |
| States, 24h expiry | `lib/connections.test.ts`, `.db.test.ts`, e2e | illegal transitions throw; `expirePending(now+24h)` marks, tick deletes at fake; profile shows expired | U, D, E |
| Decline | `.db.test.ts`, e2e | exact copy; provisional rows gone, re-claimable; confirmed rows survive | D, E |
| All-claimed-by-self | `.db.test.ts`, e2e | resolves to owner, new link deleted; other user gets `ACCOUNT_CLAIMED_*` | D, E |
| Attestation before user | `lib/auth/attempts.db.test.ts`, `db/schema.test.ts` | insert without `signup_attempt_id` rejected; attempt precedes redirect | D |
| Deletion | `lib/delete.db.test.ts`, e2e | rows and fake vendor user gone; profile 404; handle reserved | D, E |
| Import banner | `lib/connections.test.ts`, e2e | count monotonic; waits for `initial_sync_completed`; gone at `connected` | U, E |
| No interleaving | `lib/sync.db.test.ts` | concurrent `syncUser`: one `skipped`; mid-rebuild failure leaves `closed_trades` identical | D |
| Failed/abandoned; claimed by another | e2e, `lib/claims.test.ts` (kept) | copy, retry, zero rows; existing claimed copy | D, E |
| Edge cases | `lib/sync.db.test.ts`, `trades.test.ts` | empty copy; orphan sell counted; re-sync inserts nothing; disconnect freezes | U, D, E |
| Heavy use | `lib/sync.heavy.test.ts` | 10k × 5 accounts < 20 s; 3 syncs byte-identical; 500 users, 8 concurrent callers, each once | L |
| 375px signed out | `e2e/profile.spec.ts` | name, since, stats + range, chart, list; no horizontal scroll | E |

**Fakes** (`e2e/fakes/`, started by Playwright's `webServer` list). *Vendor*: a Node HTTP server
with register, login, accounts, activities, positions, authorizations, delete connection and delete
user, in-memory, seeded by `?scenario=` (accounts, activity count, paper flag, initial-sync delay);
`lib/broker.ts` passes `SNAPTRADE_BASE_URL` as SDK `basePath`; its portal page's buttons
`postMessage` when framed, else redirect to `customRedirect`. *Issuers*: one OIDC fake per provider
(discovery, authorize, token, JWKS from a key pair made at start) via `OIDC_<PROVIDER>_ISSUER`.
*Email*: the sender is one HTTPS call; the fake serves the last message on `GET /last`.

## 4. Pre-authorization

Before PR-1: #1 (`lib/session.ts`), #4 sign-in and email secrets (fakes cover the build; the
committee's preview needs real test apps), #6 email vendor, #10 Terms/Privacy placeholders. Before
PR-2: #1 (`lib/broker.ts`, `package.json`), #2 cap or the 2a/2b split, #4 vendor test keys, #5 web
SDK, #7 hourly call, #8 duration, #10 consent copy. Before PR-3: #3 budgets. Can wait: #9, #11,
#12. Everything builds against the fakes; nothing waits on a real provider.

## 5. Compliance (COMPLIANCE.md §1)

1. Performance: profile, banner; layout disclaimer; empty state shows no stats; percent-only positions (§2).
2. Personal data: email, provider subject, session hash, attestation, vendor ids; deleted with the user incl. vendor user (§3).
3. Money: none.
4. Email: transactional magic link, one vendor (§5).
5. User text: none new.
6. Sign-up/age: attestation before the user row on every path, FK-enforced (§7).
7. Vendor/dependency: web SDK, email vendor; assets self-hosted (§8, §3).
8. Accessibility: dialog trap, live region, labels, focus to error headings, reduced motion (§9).
9. Security: hashed sessions, state/nonce/PKCE, single-use links, rate limits, cron bearer (§10).
10. Claims: notice and consent strings fixed and scanned (§11).
11. Checkout: none.
