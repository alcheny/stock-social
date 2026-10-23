# F-1 PR-2a fix round 2 (engineer)

Date: 2026-10-23. Branch `claude/adoring-euler-4469ys`, from `45c1074` (tester re-run 1 in `test-pr2a-tester.md`).

## Fix round 2 plan

The Medium is a compliance failure (COMPLIANCE §3, consent at collection): a fact read from the vendor at link time
(the paper flag on a provisional claim) reached a public page before the trader tapped "Import my record". Fix the
rule once, in one place, and route every public read through it.

1. **Medium, pre-consent fact on public pages.** One helper in `lib/connections.ts`, `publicRecord(userId)`, returns
   what may be public about a trader's connections: the record state and the simulated-account count. It counts only
   claims with `confirmed_at` (set at consent, or by a completed sync of a consented link) and only while the trader
   has a consented connection (`consent_at` set: importing, connected, or failed after consent), or for a pre-F-1
   claim with no connection. The profile and the share card use it; audit every other public read of
   `broker_accounts` and `connections` (pane, story image, feed, trade page, ticker page, /how) and record the result.
   Tests: DB (pending link: state `none`, paper 0; after consent: paper 1) and e2e signed out (a pending link shows
   no simulated-account line, no "Broker connected"/S8 line).
2. **Low, record state from the vendor id.** Same helper: the state is the latest *consented* connection's state
   (`importing` / `connected` / `failed`); a trader whose links are only pending, declined or expired is `none`
   ("No trades yet."), never `connected`. Positions show only when the state is not `none`. A unit/DB test per state.
3. **Low, S6b heading.** `/connect/result?k=refused`: the H1 is the short existing title ("We couldn't link that
   broker account.") and the explanation is a paragraph under it, tied to the heading with `aria-describedby` so the
   focused alert still reads in full. e2e.
4. **Test robustness (PR-1).** "attestation first" stops comparing a table-wide `signup_attempts` count: the rejected
   call carries a unique marker (`surface`), and the test asserts no row carries that marker, with a positive control
   proving the marker is written when attested. `npm test` four times.

## Defects, causes, fixes

| # | Defect (tester re-run 1) | Cause | Fix |
|---|---|---|---|
| 1 Medium | A pending link showed "1 simulated account excluded" on the public profile, signed out included | `app/u/[handle]/page.tsx` counted `broker_accounts.is_paper` with no `confirmed_at` filter, so a provisional claim written at link time (zero-depth validation) reached a public page before consent | `publicRecord(userId)` in `lib/connections.ts`: the simulated count is confirmed claims only, and only when the trader has a consented connection (`consent_at` set) or a pre-F-1 confirmed claim with no connection. The profile reads its state and count from it; positions show only when the state is not `none` |
| 1 (audit) | The share card said "✓ Broker connected" for an empty record whenever the user had a vendor id, so a trader with only a pending link got it | same "has a vendor id" shortcut in `app/u/[handle]/opengraph-image.tsx` | the card uses `publicRecord(...).state !== 'none'`; the users query no longer reads the vendor id |
| 2 Low | S8 "No closed trades yet…" for a trader whose only link is pending, declined or expired | the record state fell back to `connected` on `users.snaptrade_user_id` | the state is the latest consented connection's (`importing` / `connected` / `failed`), else `connected` only for a pre-F-1 confirmed claim, else `none` ("No trades yet."). The owner's "Connect your broker" button now also follows the state (a declined or expired trader can retry). The importing banner count reads the importing connection, not the newest row (a newer pending link no longer shows "0 trades so far") |
| 3 Low | S6b (`?k=refused`): the four-sentence claim message was the H1 | the result page joined title and body into one heading | H1 = the existing short title "We couldn't link that broker account."; the explanation is `<p id="result-body">`, tied to the focused alert heading by `aria-describedby` |
| 4 Test (PR-1) | "attestation first" compared a global `signup_attempts` count across parallel files | table-wide count | the rejected call carries a unique `surface` marker; the test asserts no row has it, and an attested control with the same marker proves it would be written (then removed) |
| 5 Test (found here) | 2 of 10 `npm test` runs before this fix failed one test (the first was not captured; the second, captured, was): `lib/schema.test.ts` "a repeat apply waits on no table lock…" failed with `broker_accounts_user_id_fkey` (23503) | the pre-F-1 backfill in `db/schema.sql` (`insert into broker_accounts … select … from activities … on conflict do nothing`) read an activity in its snapshot while another test file deleted that user (cascade: claims and activities); the conflict check saw the claim gone and the insert hit the users FK | the backfill filters accounts already claimed in the same snapshot as the activities (`and not exists (select 1 from broker_accounts b where b.account_id = a.account_id)`); semantics unchanged (claimed accounts were skipped by `on conflict` anyway), no drop/truncate/delete. 24 runs afterwards, 0 failures |

### Audit of public reads of `broker_accounts` and `connections`

| Surface | Reads | Result |
|---|---|---|
| Profile `app/u/[handle]/page.tsx` | simulated count, record state, importing count, positions | fixed (above) |
| Share card `app/u/[handle]/opengraph-image.tsx` | "Broker connected" on an empty record | fixed (above) |
| Story image, month recap, trade page and its card, feed `app/page.tsx`, pane `app/pane.tsx`, ticker pages `app/t/*`, sitemap | `closed_trades`, `activities` (story's demo check), `users`; no `broker_accounts` or `connections` | clean: those rows exist only after consent (D1 confirmed by the tester); no change |
| `/how` | static copy, no database read | clean |
| `/connect/consent` | the pending snapshot counts | owner-only (signed attempt cookie or the user), by design |
| `/me/record`, `POST /api/import/step` | vendor id / latest connection | owner-only, not public; left as is |

## Tests added or changed

- `lib/connections.test.ts` (new DB test) "public record (fix round 2)": no link → `none`, 0; pending with a provisional
  paper claim and a vendor id → `none`, 0; declined → `none`, 0; expired → `none`, 0; consented → `importing`, 1;
  connected with no closes → `connected`, 1; a later pending link with a new simulated account → still `connected`, 1;
  consented then failed → `failed`, 0. Failed before the fix (`publicRecord` absent; the old query counted the pending row).
- `e2e/connect.spec.ts` (new) "fix round 2": signed in, link a real and a simulated account and stop at consent;
  signed out the profile has no "simulated" text, no S8 line, "No trades yet.", no positions. A brokerage-first attempt
  on the same real account → `?k=refused`: H1 "We couldn't link that broker account." under 120 px tall at 375 px,
  `aria-describedby="result-body"`, the explanation in `#result-body`, focus on the heading. The owner consents and
  imports: signed out now shows "1 simulated account excluded" and the S8 line.
- `lib/auth/attempts.test.ts` "attestation first": own-attempt marker instead of the global count (no assertion removed;
  one positive control added).
- No test weakened or deleted. Unit 391 → 392; e2e 65 → 66.

## Results

| Command | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` (`DATABASE_URL` local Postgres 16), ten runs before the schema fix | 8 × 392 pass; 2 × 391 (one captured: the schema backfill race, row 5) |
| `npm test` after the schema fix, 24 runs (8 + 16) | 392 pass every run, 0 fail |
| `npm run build` | first attempt stopped after compiling on a framework security-advisory prompt (tool output; nothing upgraded); the retry built cleanly |
| `npm run test:e2e` (`ALLOW_DEV_AUTH=1`, vendor fake 4102 with `SNAPTRADE_BASE_URL`/`_CLIENT_ID`/`_CONSUMER_KEY`, PR-1 issuer and sink variables) | 66 passed, 0 skipped |
| `node scripts/compliance.ts diff origin/main` | only the pre-existing `node_modules/@img/sharp-wasm32` license line |
| `node scripts/autopilot.ts guard main` | `guard: ok` |

## Compliance

- §3 consent at collection: nothing read at link time (account snapshot, paper flag, provisional claims, the vendor
  user's existence) reaches a public page or the share card before consent; one helper is the rule.
- No new dependency, vendor, personal data, copy claim or disclaimer change. The S6b wording is the existing copy, split.
- Schema change is a filter on an idempotent backfill; no drop/truncate/delete.
