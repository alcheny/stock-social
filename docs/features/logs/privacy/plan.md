# Privacy product work: implementation plan (2026-11-01)

Task: the product work the Privacy Policy depends on (legal committee's privacy findings). The Privacy Policy and
Terms text is the owner's; `LEGAL_PLACEHOLDER` pages stay as they are. Committee record: `committee-2026-11-01.md`.

## 1. Launch gate (`lib/launch-gate.ts`)

Pure, env-driven, default **closed**.

- `LAUNCH_OPEN=1` opens real sign-up and broker connection for everyone. Anything else (unset, `0`, `true`) is closed.
- `LAUNCH_ALLOWLIST=handle_a,handle_b`: while closed, a signed-in account whose handle is listed may connect a broker
  (owner testing). Entries are normalized like handles (lowercase, `^[a-z0-9_]{3,20}$`); invalid entries are ignored.
- **Sandbox build**: while closed, the gate also opens when nothing real can enter: dev auth is allowed (non-production,
  or `ALLOW_DEV_AUTH=1`) AND the vendor is the loopback fake (`SNAPTRADE_BASE_URL` loopback) AND mail is not sent to a
  real host (`AUTH_EMAIL_SEND_URL` unset or loopback) AND every configured sign-in provider issuer is loopback. This is
  how the e2e suite (production build, `ALLOW_DEV_AUTH=1`, vendor fake) keeps working with the switch closed. With real
  vendor keys and no fake URL the sandbox never applies.
- `signUpOpen(env)`: open or sandbox. `mayConnect(handle | null, env)`: open, sandbox, or a signed-in allowlisted handle.

Enforcement (actions and routes; `lib/session.ts` and `lib/broker.ts` untouched):

| Where | Closed behavior |
|---|---|
| `app/auth/actions.ts#startSignIn`, method `brokerage` (sign-up by connection) | back to `/login?error=closed`, no attempt row |
| `startSignIn` email / provider | allowed to start (existing accounts must still sign in) |
| `lib/auth/attempts.ts#signInWithIdentity` (called by the email and provider callbacks) | new option `allowNew`; callers pass `signUpOpen()`. An unknown identity with `allowNew: false` throws `SignUpClosedError` before any users row; the callbacks redirect to `/login?error=closed`. Known identities sign in as before. |
| `app/connect/page.tsx` (S2) | signed in and `!mayConnect(handle)`, or signed out: status line `LAUNCH.closed`, no portal primary |
| `app/connect/start/route.ts`, `app/connect/portal/route.ts` | refuse before any vendor call: redirect to `/connect` (start) / 403 JSON (portal) |
| `app/connect/actions.ts#consentAction` | signed out (brokerage-first creates the user) needs `signUpOpen()`; signed in needs `mayConnect(handle)`; else `/connect?closed=1`, connection untouched (it expires by its clock) |
| `/login/dev` (`login` action) | unchanged: the dev stub is allowed (guarded by `devGuard`), demo data is allowed |

Copy (`lib/copy.ts`, new `LAUNCH` block): `closed: "Sign-up isn't open yet. Existing accounts can still sign in."`
and `connectClosed: "Connecting a brokerage isn't open yet."` No dates, no promises.

## 2. Policy-accuracy tests

- `lib/privacy-cookies.ts`: `COOKIE_TABLE`: name, purpose, lifetime (seconds; 0 = cleared), path, set-by. Test
  `lib/privacy-cookies.test.ts` scans every non-test `.ts/.tsx` under `app/`, `lib/`, root for cookie writes
  (`cookies()).set(`, `jar.set(`, `.cookies.set(`, `Set-Cookie` headers, `document.cookie`), resolves `*_COOKIE`
  constants to their string values, and fails on any name missing from the table, or a table row never set. Lifetimes
  are checked against the constants they come from (`SESSION_DAYS`, `EMAIL_COOKIE_SECONDS`, `CONNECT_COOKIE_SECONDS`).
- `lib/privacy-fields.ts`: `PUBLIC_FIELDS` / `PRIVATE_FIELDS` (the consent line's words) each mapped to the columns
  behind them. Test: the consent line equals the text built from the two lists; every column of the publicly read
  tables (`closed_trades`, `open_positions`) is a public field column or listed internal (ids, keys, flags); private
  columns (`activities.units/price/fee/account_id`) never appear in a public table.
- `lib/privacy-retention.ts`: `SCHEMA_MAP`: every table in `db/schema.sql` with `personal: boolean` and a retention
  class (`account` = until account deletion; `session` = until expiry; `short` = purged on the tick by age;
  `aggregate` = no personal data). Test parses every `create table` in the schema and fails on a table with no entry
  (and on stale entries).

## 3. Copy

- `LIKES.private` → "Only you can see your likes. Traders are never told and no one sees a count. Likes help order your own feed."
- `CONSENT.lines` third line (the public-scope line) → "Public: percent returns, symbols, dates, holding periods,
  institution names, account count, and your current open positions with unrealized percent. Private: quantities,
  prices, fees and account numbers. Your public record is also used to describe your trading style and to order traders
  for readers." The other four lines stay (account count, scope, one profile per account, stays public after
  disconnect: P6 requires that last one). Tests asserting the old copy are updated to the new copy, not loosened.

## 4. Log hygiene

- `lib/privacy-log.ts#logSafe(e)`: an error's class name and numeric status/code only, never its message (vendor and
  database messages can carry addresses, account numbers, query parameters).
- `lib/sync.ts` (3 sites), `app/t/[symbol]/Watch.tsx`, `app/api/sync/route.ts`: use it. Numeric user ids stay (no handle,
  email or account id next to them).
- Test `lib/privacy-logs.test.ts`: every `console.*` call in server code (files without `'use client'`) passes only
  string literals, numbers/ids, `JSON.stringify` of counts, or `logSafe(...)`/`errStatus(...)`; it fails on `e`,
  `e.message`, `email`, `handle`, `account_id`/`accountId`, `snaptrade_*`, `secret`, `raw` as arguments.

## 5. Purges on the existing tick (`lib/privacy-purge.ts`, called from `app/api/sync/route.ts`)

Own advisory lock (key 41, tried, never waited for), ≤ 20 s box, batches of 5,000, never a branch for the rest of the tick.

- Expired sessions: `sessions.expires_at < now()`.
- Unused sign-in links: already expired links go via `purgeExpiredLinks`; additionally links whose attempt finished
  (`completed_at` set) are deleted (they can no longer be used).
- Unfinished sign-ups: `signup_attempts` with `user_id is null and completed_at is null`, older than 30 days, vendor
  user already cleaned (`snaptrade_user_id is null`), with no live/uncleaned connection: their funnel events, links,
  connections (`user_id is null`) and the attempt go.
- Unfinished connections: covered above (signed-out ones). Connections of a signed-in user stay (they drive the
  profile's state, TR-3).
- Orphan likes and rejects: `trade_likes` / `trade_exclusions` rows whose `trade_key` matches no `closed_trades` row.
  Condition-based, not age-based: preference data is kept indefinitely (owner, 2026-11-01).
- Account deletion is unchanged (deletes everything; `display_log` cascades).

## 6. Display log (`lib/display-log.ts`, `display_log` table)

- Table: `(user_id → users on delete cascade, day date, headline, range, trade_count, open_summary, evidence,
  demo, created_at)`, primary key `(user_id, day)`.
- Append-only in the database: a trigger refuses every `update`, and every `delete` except the cascade from deleting the
  users row (`pg_trigger_depth() > 1`).
- Written once per day by the tick for each public record (not deleted, not importing, at least one close or position),
  `on conflict do nothing`. Text is built by the same functions the profile uses (`stats`, `pct`, `confidence`,
  `rangeText`, `evidenceLine`), percent only.
- `displayedOn(userId, day)`: the latest row on or before `day`.

## Tests per acceptance criterion

Unit (node:test): gate matrix; sign-in refusal of a new identity when closed (DB); cookie table; fields; schema map;
log scanner; purge (each class, preserved neighbours, lock); display log (one row/day, refused update and delete,
cascade on account deletion, reader). E2E `e2e/privacy-gate.spec.ts`: at 360 px, with the sandbox off is not reachable
from the suite's server, so e2e covers: the dev path and connect still work (sandbox), the consent screen shows the
new public/private line, `/me/likes` shows the new likes line.

## Compliance (COMPLIANCE Section 1)

No new vendor, dependency, tracker or secret. Less personal data kept (purges), no personal data logged, consent copy
names every public field. No advice, no completeness claim, percent only. Adults-only unchanged.
