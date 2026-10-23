COMPLIANCE: PASS

# F-1 PR-3 · Committee review (engineer)

2026-10-23, `81e79ec`, Postgres 16. Scratch tests (outside the repo) on my own traders via the clock-shift hook. No product code changed.

## Claim rule (database clock, :30 rounds, lease, restore on skip)

| Scenario | Result |
|---|---|
| Two instances skewed 1 min in opposite directions (:59 and :01), alternating and both firing, 6 rounds | pass: once per round, no lease left |
| Database connections dropped mid-sync | pass: that sync `failed`, lease released after reconnect, retried next round |
| Sync throws synchronously | pass: `failed`, lease released |
| Lease exactly equal to now (claim predicate, `now()` frozen in one transaction) | pass: claimable at equality, not 1 µs before; a stale release leaves the newer lease |
| Connections dropped **during `releaseClaim`** | **Low**: the `finally` throws, the tick aborts (later traders unsynced by that call, route 500), the lease stays, and once it lapses the trader syncs twice that round |

## Vendor timeout

All 9 call sites use `bounded()`. A hung request fails at 30,027 ms (real constant); a never-finishing body fails at the bound; 429 forever fails at 7,002 ms (bound lowered) and no request follows (the SDK's next retry finds the signal aborted). The bound is per request: ~20 slow calls could still outlast the lease; restore-on-skip covers that.

## Rows

- Chunks: 999/1,000/1,001/5,950/6,000 activities and closes write and rebuild exactly; re-insert idempotent.
- Ties: 2,600 rows at one instant across 3 pages, stored shuffled vs reversed: hash-identical rebuilds, equal to the pure matcher.
- **Info**: the keyset omits `source`; two sources sharing a vendor id at a page boundary lose a row. No path writes both sources for one trader.

## Schema

Applied twice: clean. `activities_user_pair` exists once; the keyset read is an index-only scan. No drop, truncate or delete from.

## Compliance

- §3: generated fixtures, no emails, names or paths in the diff; logs carry user ids only. The clock-shift/`ids` hooks and `vendorTimeout.ms` are test-only: the cron route calls `syncTick()` with no arguments.
- §10: cron bearer check unchanged; no new route. Read-only connections and secret encryption untouched.
- `lib/broker.ts` is a CODEOWNERS path: the owner merges.

## Recommendation

Merge-ready. Non-blocking follow-ups: guard `releaseClaim` in the `finally`; add `source` to the keyset.

## Cleanup

My traders, accounts and activities deleted; every other user's claim and lease byte-identical before and after. Orphan sign-up attempt rows remain, as repo tests leave them.
