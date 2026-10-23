approve: true

# F-1 PR-3 · Reviewer

2026-10-23. Branch `claude/adoring-euler-4469ys` at `dc04e78` against `origin/main`. Read-only: no product code changed.

## Checks run

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` (Postgres 16) | 520 tests: 515 pass, 0 fail, 5 skipped (the heavy-use suite, gated on `LOAD=1`) |
| `LOAD=1 node --test lib/sync.load.test.ts` | 5 pass, 0 fail (10,000-activity import and rebuild, 3 idempotent hourly syncs, contention, first-sync paging, 500 traders × 8 concurrent ticks) |
| `compliance.ts diff origin/main` | only the installed-tree `@img/sharp-wasm32` licence line, as on main; no `package*.json` change |
| `autopilot.ts guard main` | `guard: ok` |
| `db/schema.sql` applied twice | both clean; no `drop`, `truncate` or `delete from` |
| `CI=1 npm run build < /dev/null` | first run stopped on the framework advisory (owner); the retry built |
| e2e | not re-run here (shared database). Tester re-run 5 on a private database: 96 passed, 0 failed; feed of 50 cards from 11 heavy traders 322 KB raw, 23 KB gzipped |

## Criteria

- **Sync claims and leases (`lib/sync.ts#claimNextUser`, `syncTick`).**
  - One clock: every claim and lease decision reads the database `now()` inside the claim statement.
  - `for update of u skip locked` keeps concurrent claims apart; the per-user advisory lock still prevents interleaving after a lapsed lease.
  - `restoreClaim` and `releaseClaim` compare the lease as database text (microseconds), so a newer claim is never cleared.
  - A failed release does not abort the tick. A skipped sync gives its round back. Tested across rounds, skew, a tick across :30 and 8 concurrent callers.
- **Chunked rebuild.**
  - Keyset pages over the full unique key (account, symbol, time, vendor id, source) with the matching index; total order, so rebuilds are byte-identical (tested).
  - FIFO lots never cross a pair, so matching each completed pair is equivalent to matching the whole history. The open pair carries across page boundaries.
  - Theses are read before the delete and re-attached per pair; unattached ones go to `kept_theses`. Nothing is deleted.
  - Every bulk insert is chunked at 1,000 rows (11,000 parameters), under the 65,534 limit.
- **Future-date quarantine.** Raw rows are kept (immutable), never matched, counted in `users.excluded_future` (paper accounts excluded from the count, as from the record), and excluded from the backfill window. Re-checked every rebuild.
- **Feed decay clamp (`lib/feed.ts`).** The exponent is clamped to [0, 600]: no underflow for old closes, no overflow or outranking for future ones; the tie-break reads a future close as now. Losses still rank by `abs(return_pct)`.
- **Downsampling.** Min/max per x slice keeps the first and last point and every slice's extremes, so the record's low and high (the drawdown) survive. Header numbers, drawdown and y range come from every close. `packValue` keeps full precision where rounding would change the printed percent.
- **Pane-chart route.** Public like the profile, same `deleted_at is null` lookup. It returns only percentages, symbols, holding days, close times and published theses; held theses never leave the server. The trust state (Verified, Demo, incomplete) is rendered on the server with the page, not taken from this data.
- **Paging.** `closesWindow` rounds and clamps any `?closes=` value; non-numeric or infinite values fall back to window 1. The list order is total, so windows never overlap or skip a row. Stats and chart cover the whole record (TR-1, TR-2).
- **Rate limits and bounds.** Every vendor request is bounded at 30 s. The import step keeps its 1 per second limit and its route deadline. The cron route has a 300 s limit with a per-trader reserve.
- **Product rules hold.**
  - Percentages only in `closed_trades` (no column added).
  - Losses shown and ranked equally.
  - The disclaimer footer is asserted on the paged profile.
  - Excluded positions and future-dated activities are counted, never guessed.
- **Policy.** No secrets or personal data. Only the integrated vendor is named. No advice words. The public "your broker" fallback from the PR-2b review is now neutral ("the broker").
- **Tests not weakened.** 64 new tests. The removed lines are replaced by stricter or reworded assertions:
  - exact excluded-position copy;
  - the neutral broker line;
  - the one-visible-count import banner;
  - a race-free single-statement insert in the claims test.

## Findings (none blocking)

1. **Low · `app/u/[handle]/pane-chart/route.ts:12`**, shared with `story/route.tsx:15` and `opengraph-image.tsx:19`.
   - A handle containing a NUL byte reaches Postgres, which rejects it, so the route answers 500 instead of 404.
   - No data leaks and nothing is written.
   - Follow-up: validate the handle pattern before the query, in all three routes at once.
2. **Low · `app/u/[handle]/pane-chart/route.ts`.**
   - The route is unauthenticated and not rate limited. Each request reads and downsamples the whole record (about 10,000 closes at most).
   - `public, max-age=60` lets a shared cache absorb repeats, but a direct caller can repeat the work.
   - Follow-up, with the per-instance limiter (`lib/rate-limit.ts`).
3. **Low, owner decision · feed size.**
   - The 500 KB bound holds up to about 25–30 distinct heavy traders.
   - At 50 distinct heavy traders the feed is about 560 KB raw (71 KB gzipped).
4. **Low · e2e on a shared database.** Concurrent writers can push a test's trader out of the top 50 of the feed. On a private database it is green.
5. **Info · `lib/sync.ts#rebuildTrades`.** Memory is bounded by the largest single (account, symbol) pair plus one page, not by one page. That is acceptable: one pair is the unit FIFO needs whole.

## Owner

- The framework advisory stops the first `npm run build`. The dependency bump is yours.
- Feed size at 50 distinct heavy traders (finding 3) is your call.
- Cron schedule: every 5 minutes, never at :30 (request #7 as amended). The route's `maxDuration = 300` needs a plan that allows it.
