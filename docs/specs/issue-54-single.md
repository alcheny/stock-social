# Spec: TR-6: one broker account, one profile, ever

Variant: **single** · Spec agreed by designer and business analyst

## Agreed spec

# Spec: TR-6, one broker account, one profile, ever (issue #54)

## Summary of the change
A broker account (SnapTrade `account.id`) is claimed by exactly one user the first time it syncs, and is never released. Any other user who connects the same account is refused, with no activities written for them and no hint of who owns it. The same owner re-syncing is unaffected. This is a fix and a trust rule, not a product direction. The only new UI is one error state on the profile.

## Key decision: a claims table, not a unique index on `activities`
The unique key lives on a new table `broker_accounts`, not on `activities.account_id`.
- `activities.account_id` is legitimately repeated for the same user (one row per trade). It would need a partial unique index across users, which cannot express "one owner" without a self-join.
- A claims table lets us decide ownership **before** any activity is inserted. That is the acceptance criterion "writes no activities for B".
- It is also the natural anchor for TR-5, which needs an account-removed date later. Do not build TR-5 now. Add no `removed_at` column.

### Schema (append to `db/schema.sql`, idempotent, no drop/truncate/delete)
```sql
-- TR-6: a broker account belongs to one profile, ever. Claimed on first sync, never released.
create table if not exists broker_accounts (
  account_id text primary key,                       -- vendor account id (SnapTrade account.id)
  source text not null default 'snaptrade' check (source = 'snaptrade'),
  user_id int not null references users on delete cascade,
  claimed_at timestamptz not null default now()
);
create index if not exists broker_accounts_user on broker_accounts (user_id);
```
- `source = 'snaptrade'` only. Demo activities never touch this table, so the demo seed is unaffected. `db/seed` needs no change.
- Backfill is also idempotent SQL. Existing real data is claimed by its current owner:
```sql
insert into broker_accounts (account_id, user_id)
  select distinct on (account_id) account_id, user_id from activities
  where source = 'snaptrade' order by account_id, executed_at
  on conflict (account_id) do nothing;
```
  If historical data already has two users on one account (which is the exploit), the earliest activity wins. Do not delete anything. The second user's existing rows stay for the engineer to flag with a `ponytail:` comment, since cleanup is out of scope.
- `on delete cascade` is acceptable here. Profile deletion and the 1-year hold are out of scope. Add a `ponytail:` note that a deleted profile must keep its claim once the handle-hold work lands.

## Behaviour

### Claim logic (`lib/sync.ts`, vendor-free)
Add `claimAccounts(userId, accountIds: string[])`, which returns `{ ok: true } | { ok: false, conflicts: string[] }`.
1. Inside one transaction, run `insert into broker_accounts (account_id, user_id) values ... on conflict (account_id) do nothing`.
2. Select the owner of every requested id. Any id whose `user_id !== userId` is a conflict.
3. Insert-then-check is race-safe: two users racing on the same account get exactly one winner from the primary key.

### `syncUser` flow
1. Fetch from the broker. `fetchActivities` already lists accounts and returns activities each carrying `accountId`.
2. Derive the set of distinct account ids. **Accounts with zero activities in the window must still be claimed**, so claiming cannot depend on activities alone. Change `lib/broker.ts` minimally: add and export `fetchAccountIds(u)`, or have `fetchActivities` return `{ accounts: string[], activities }`. Prefer a new `listAccountIds` function so the existing signature and tests stay untouched. The SnapTrade SDK stays confined to `lib/broker.ts`.
3. Call `claimAccounts`. Order matters: claim first, then fetch activities only for allowed accounts. Simplest approach: call `listAccountIds`, claim, and if there are conflicts, return before fetching any activity.
4. On any conflict, **reject the whole link**:
   - Insert nothing, and do not call `rebuildTrades`.
   - Return a result. `syncUser` currently returns a count, so change it to return `number` on success and throw a typed `AccountClaimedError` on conflict. Pick one and keep the cron caller working. The cron route must catch the error per user, log `user id` only, continue the loop, and never abort the batch.
   - The claim step already inserted any non-conflicting accounts for this user. That is acceptable only if the transaction rolls back on conflict. **Make the whole claim transactional: on conflict, roll back so the user claims nothing.** This avoids a half-linked state.
5. Same-owner re-sync: every id resolves to the user's own id, so the flow proceeds exactly as today.

### `/connect/done`
- On success: unchanged, redirect to `/u/<handle>`.
- On `AccountClaimedError`: redirect to `/u/<handle>?connect=account-claimed`. Use a redirect, not a 4xx page, because the user is mid-OAuth return and should land somewhere navigable.
- The message is shown on the signed-in user's own profile only. It is never on the public view and not in the share card.

### Error copy (exact, shown on the owner's own profile, role `alert`)
> **We couldn't link that broker account.** It's already connected to another Stock Social profile, and a broker account can only ever belong to one profile. This is what keeps every record verified. If you think this is a mistake, contact support.

Rules for the copy:
- Never reveal the other handle, its existence beyond "another profile", or the timing of the claim.
- Do not include the account id or the broker's masked number.
- Do not say "try again". Retrying cannot succeed.
- The tone is plain and factual. No celebration or warning iconography beyond the existing alert token styling.

### Profile page states (`app/u/[handle]/page.tsx`)
- Only when the viewer is the owner and `searchParams.connect === 'account-claimed'`, render the alert above the existing connect/empty area.
- Keep the existing "Connect a broker" button visible, so they may connect a different account.
- For all other viewers and for a signed-out viewer, the query param is ignored. No new states for the feed or the share card.
- The alert is dismissed by navigating away. No persistence, because the query param is the state.
- Accessibility: `role="alert"`, text contrast uses the existing error token, and the alert is not colour-only (it has a bold lead sentence). It is readable at 320px width, wraps naturally, and has no horizontal scroll.
- Empty state: a new trader whose only link was rejected sees the existing "no closed trades" empty state plus the alert.

## Product-rule checks
- No manual trade path is added, and Verified semantics are strengthened, not changed.
- No new data is shown publicly. Claims store ids only: no quantities or prices.
- Loss visibility and ranking are untouched. TR-5 (disconnect/freeze) is out of scope, and `rebuildTrades` is unchanged.
- The cron `/api/sync` loop is still sequential. The extra cost is one `listAccountIds` call (already made inside `fetchActivities`) and one small transaction per user, so do not fetch accounts twice if it can be avoided. Share the listing by passing account ids into `fetchActivities`, or accept a single extra call and add a `ponytail:` note.

## Known limits (add `ponytail:` comments)
- SnapTrade account ids are stable per brokerage connection, but a full disconnect and a new connection from the same SnapTrade user may produce a new id. A trader could theoretically re-link under a new id. The claim only guards the id we see. Dedupe on account number or institution hash is future work, and TR-5 plus TR-6 interplay should be revisited there.
- A second SnapTrade user registered for the same real brokerage login would get distinct ids. This is likewise future work.
- Legacy data with pre-existing duplicates is not cleaned up.

## Acceptance criteria → tests (node:test, no weakening of existing tests)
Tests need a DB. Follow the existing DB-test pattern in the repo. If none exists, put the logic in `claimAccounts` and test it against the test Postgres used by e2e, or factor out a pure `partitionClaims(requested, owners, userId)` function and unit-test that plus one DB-backed integration test.
1. `claimAccounts`: user A claims `acc-1`, then user B attempts `acc-1` → `{ ok: false, conflicts: ['acc-1'] }`. B has zero rows in `broker_accounts`, and zero rows in `activities`.
2. Mixed request: B requests `['acc-new', 'acc-1']` → rejected, and `acc-new` is **not** claimed (rollback).
3. `claimAccounts` is idempotent for the owner: A claims `acc-1` twice → ok both times, and exactly one row exists.
4. `syncUser` for B with a stubbed broker returning `acc-1` activities → throws `AccountClaimedError`, writes no activities for B, and does not call `rebuildTrades`. (Inject the fetcher, or stub `lib/broker.ts` through the existing test seam.)
5. `syncUser` for A re-syncing its own account → succeeds, and returns the activity count.
6. Zero-activity account is still claimed: a stub with `acc-2` and no activities → a claim row exists for A.
7. Demo seed: after running the seed, `broker_accounts` has no rows, and the demo traders' `closed_trades` are unchanged. Seeding twice is still idempotent.
8. Schema: applying `db/schema.sql` twice succeeds, and contains no `drop`/`truncate`/`delete from`. The backfill is idempotent on a pre-seeded fixture, and the earliest owner wins a duplicate.
9. Error message test: the copy contains neither the other handle nor any account id. Render or string-test the message constant.
10. The cron loop continues past a conflicting user (unit test the loop wrapper if it is factored out; otherwise assert the catch).
Finally: `npm test`, `npx tsc --noEmit` and `node scripts/autopilot.ts guard main` must all pass, with the test count not lower than before.

## Out of scope (do not build)
Disconnect and frozen states (TR-5), profile deletion, the 1-year handle hold, account-level display, an admin override or appeal flow, and any UI beyond the single alert.

## Designer ⇄ business discussion

### Round 1

**Designer:** Add a broker_accounts claims table (account_id primary key → user_id), claimed transactionally in syncUser before any activities are written. A conflict throws AccountClaimedError, and /connect/done redirects to the owner's profile with an alert that doesn't reveal the other handle. The owner's re-sync, demo data and the cron loop are unaffected.

**Business analyst (approved):**
- Ease of use: Good. A rejected user lands on their own profile with a plain, bold-lead alert. The copy leaks nothing and says retrying can't help. The Connect button stays visible, so they can try a different account. The redirect keeps them mid-flow instead of showing a dead-end error page.
- Retention: Neutral to positive. Verified is the brand, and making a record impossible to reset is why viewers keep trusting the feed. Honest traders who reconnect the same account are unaffected, so they aren't pushed away. The only cost is a trader with a bad record who wants to restart. Blocking that is the intended outcome.
- Virality: No direct lift, and it shouldn't be one. Indirectly it supports sharing: a link to a profile means more when "one account, one profile, ever" is true. The alert is owner-only and stays off public views and the share card, which is correct.
- Feedback: Approved within the product rules. Notes for the engineer:
1. The all-or-nothing claim (rollback on any conflict) is right. Keep it.
2. Add "contact support" only if a support channel actually exists. If it doesn't, change the copy to something true, such as "If you believe this is a mistake, email <address>". Don't point users at a dead end.
3. When the cron catches AccountClaimedError, log the user id only. Never log the account id alongside the owner.
4. The backfill leaves historical duplicate users in place. Add a `ponytail:` comment saying so, and open a follow-up issue so the exploit's existing victims don't get forgotten.
5. In syncUser, claim before fetching activities so no conflicting data is ever read into memory for the wrong user.
6. Test 7 (demo seed untouched) is cheap and important. Don't skip it.
The spec is already clear that TR-5 and the account-id-stability limits are out of scope. The ponytail notes for those are enough.

## QA log

| Round | By | Result | Findings |
|---|---|---|---|
| 1 | tester | ✖ fail | [spec] lib/claims.ts ACCOUNT_CLAIMED_BODY: The copy says "contact support", but the repo has no support channel (no mailto or support address in app/ or docs/DESIGN.md). The business analyst's note 2 says to use a real address or reword to something true, and this is a dead end for the user. Either add a real contact or reword the copy, and keep the copy test in step. · [spec] lib/claims.test.ts: Spec tests 7 (seed leaves broker_accounts empty and closed_trades unchanged), 8 (schema applied twice, backfill idempotent, earliest owner wins) and 10 (cron loop continues past a conflicting user) ar |
| 2 | tester | ✅ pass | [note] lib/sync.ts syncUser: If an already-connected user later adds a second broker account that another profile owns, the whole sync is rejected. Their existing valid account stops syncing and the cron fails for them every hour. This is the all-or-nothing behavior the spec asks for. Consider noting it as a follow-up. · [note] app/u/[handle]/page.tsx: The alert uses the generic `.down` class, which only sets a text colour. The bold lead sentence keeps it from being colour-only, as the spec requires. I did not check it visually at 360px. The text is a plain paragraph, so it should wrap. · [not |

## Cost

6 role calls, $1.21 total: designer#1 $0.13, business#1 $0.07, engineer#1 $0.53, tester#1 $0.12, engineer#2 $0.25, tester#2 $0.12

---

## Fix 2026-10-15

## QA log

| Round | By | Result | Findings |
|---|---|---|---|
| 1 | tester | ✅ pass | [note] lib/sync.ts syncUser: An already-connected user who adds a second account owned by another profile has the whole sync rejected. Their valid account stops syncing, and the hourly cron fails for them every hour. This is the all-or-nothing behaviour the spec asks for. Consider a follow-up. · [note] app/u/[handle]/page.tsx: The alert uses the generic `.down` class (text colour only). It is a plain paragraph with a bold lead sentence, so it should wrap at 360px and is not colour-only. I did not check it visually. · [note] lib/claims.ts ACCOUNT_CLAIMED_BODY: The 'contact support' line was rep |

## Cost

2 role calls, $0.24 total: engineer#1 $0.14, tester#1 $0.10
