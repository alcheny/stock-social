# F-35 implementation plan (UX lead, round 1)

Built from `brief.md`. Nothing needs counsel; no new dependency or vendor.

## 1. Publish predicate
- `lib/sync.ts`: `published = executed_at <= now()` (the transaction clock, the watermark's clock).
  `lib/options-sync.ts`: `publishedO = (executed_at is null or executed_at <= now())` (undated option rows pass, as today).
- `published` is used by: `rebuildTrades` (page and chain queries); `rebuildOptionTrades` (keyed and loose reads);
  `exerciseDays`; the option-pair removal; corporate actions (`loadCorporateActions(tx, id, published(tx))` in
  `rebuildTrades` and the rename step). Corporate actions amend the brief: with the grace, a rename dated tomorrow
  re-symbols published closes today. "Quarantine distance unchanged" is about activities, not what feeds the matcher.
- `notFuture` (24 h) stays only for the re-read window (`lastShare`, `lastOptionActivityAt`). The comment above
  `FUTURE_GRACE_HOURS` says it bounds the re-read window only.
- `MATCHER_VERSION` 2 → 3 (`lib/trades.ts`), so closes published from sells dated up to 24 h ahead before the deploy are
  removed by `rebuildAllForMatcher`. Coordinate with F-36: whichever merges second takes the next number.

## 2. Counts (F-21 hand-off)
- End of `rebuildTrades`, one statement with today's filters and `not published`: `count(*)` → `excluded_future`
  (meaning unchanged: buys and sells) and `count(*) filter (where side = 'SELL')` → new `users.excluded_future_sells`.
- `rebuildOptionTrades` writes new `users.excluded_future_options` (option rows not published, not paper, not shared).
- F-21's sum reads `excluded_future_sells`, never `excluded_future`. Whether F-21 counts the option part is F-21's call
  (a waiting option row is not yet classed as a close).
- Profile line: shown when `excluded_future + excluded_future_options > 0`, printing the sum (profile and
  `lib/record-tools.ts#card`).

## 3. Copy
The pinned first sentence stays; `PROFILE.excludedFuture(n)` appends a second:
- n = 1: "… It is added to this record once that date has passed."
- n > 1: "… They are added to this record once their dates have passed."
"Added to this record" (not "appears"): a matured sell with no entry is counted, not shown. No advice, no completeness
word. States: 0 no line; demo same rule; signed out same public line; frozen shown (and it publishes, §5); public filer
no line. `data-excluded-future` on the `<p>` for the e2e. The month page copy is unchanged and now true.

## 4. Watermark
`users.published_through timestamptz` (additive, null). Set at the end of `lib/options-sync.ts#rebuildRecord`
(`= now()`), not in `rebuildTrades` (which rebuilds shares only). Same transaction: a failure rolls it back. Every full
rebuild (sync, import, matcher rebuild) advances it. Rows with `executed_at <= published_through` were in that
rebuild's published set, so the condition is exact.

## 5. Matured pass
`lib/sync-shard.ts#maturePass`, called in `runShard` after `acquireShard` and before the workers (workers run to the
deadline; AC2 needs the first tick to publish). The route needs no change.
```sql
with m as (
  select user_id, executed_at from activities where executed_at > created_at and executed_at <= now() and executed_at > now() - interval '8 days'
  union all select … from option_activities where (same)
  union all select … from corporate_actions where (same))
select u.id from users u join m on m.user_id = u.id
where m.executed_at > coalesce(u.published_through, '-infinity') and u.deleted_at is null and u.public_filer_id is null
  and not exists (select 1 from connections c where c.user_id = u.id and c.state = 'importing')
  and u.id % of = shard [scope]
group by u.id order by min(m.executed_at) limit MATURED_PER_RUN
```
- Partial indexes `(executed_at) where executed_at > created_at` on the three tables: only rows stored while
  future-dated.
- Bound 8 days (window 7 + grace 1). `MATURED_PER_RUN = 50`, a time box, and the run's deadline.
- Scope: frozen records included (decided by the committee option "publish": imported before the freeze, no vendor
  read, F3c counted never dropped, the line says so, the matcher rebuild already rebuilds frozen records). Deleted,
  public filers and importing users excluded. Paper/shared rows not filtered (a cheap superset: one harmless rebuild).
- Per user: a transaction, `pg_try_advisory_xact_lock(USER_LOCK, id)`; busy → `maturedBusy`, watermark untouched, next
  run retries. Else `rebuildWithoutRead` (rebuildRecord with `last_synced_at` put back, so "Updated" never claims a
  vendor read); also used by `lib/matcher-rebuild.ts` (today a deploy stamps every record "Updated"). A throw →
  `maturedFailed`, logSafe counts only.
- RunReport: `matured`, `maturedBusy`, `maturedFailed`. Test hook `RunOpts.matureRebuild`.

## 6. F-24
`published` is ANDed beside `heldRow` and `notDuplicate` (unchanged). A waiting held row is counted only in
`excluded_future`; once it matures and is still held it moves to `excluded_held`. Never on both lines.

## 7. Tests (dates from SQL `now()`; time passes by shifting the test's own `executed_at`, `created_at`, `published_through` back together)
`lib/f35-publish.test.ts`:
- AC1: BUY −2 d, SELL +12 h, rebuild: no close; profile load and month recap leave it out; `excluded_future = 1`,
  `excluded_future_sells = 1`; a +2 d row still counted.
- AC2: shift 13 h, `runShard` with a no-op sync and a throwing broker: the close appears, `matured = 1`,
  `last_synced_at` and `activities_read_at` unchanged, no vendor call.
- AC3: three ticks → `matured` 1, 0, 0.
- AC4: rebuild hook throws → `maturedFailed = 1`, watermark and closes unchanged; next tick publishes.
- Lock held elsewhere → `maturedBusy = 1`; retry publishes.
- Scope: frozen publishes; deleted, importing, public filer and other shards skipped.
- F-21: a future BUY matures: `excluded_future` 1 → 0, `excluded_future_sells` stays 0.
- F-24: a future held sell counted once before and after it matures.
- Option twin and corporate-action twin (+12 h rename not applied, then applied).
- Server zone: month recap under `TZ=Pacific/Kiritimati`.
- AC6: the existing "fix round 6" test keeps its name and its +2 d, window and feed assertions; `['AAA','CCC']` →
  `['AAA']`, `[1,0]` → `[2,0]` (comment: F-35 amends #62's grace); then shift the CCC rows back 13 h, rebuild, assert
  `['AAA','CCC']`. A twin "+12 h waits, then publishes on the first tick" test is added.
- AC5: `e2e/f35-month-today.spec.ts` at 360 px under `timezoneId` UTC and Pacific/Kiritimati: "Trades close through
  today" shown, every `time[datetime]` on the page at or before the database now(), the waiting close absent, the
  profile line equals `PROFILE.excludedFuture(1)`.
- AC7: EXPLAIN (format json) shows the three partial indexes used; a LOAD=1 test with 100k traders, ~2M activities
  (1% future-stored), `analyze`, `explain (analyze, buffers)`: no Seq Scan on the three tables; rows read ≤ the
  future-stored rows in the window.

## 8. docs/SYNC.md
New section "Publish once the date has passed (F-35)"; logs fields; remove the `lib/sync.ts` "re-checked only when
activities are read" ponytail; update the `lib/feed.ts` comment.

## 9. Ponytails
Pass bound (> 8 days of missed ticks waits for the next rebuild — page by the watermark); feed paging (a matured
close's `sell_imported_at` predates its publication — a per-close publish time); vendor-corrected dates wait for the
daily read; the deploy rebuild's budget leftovers (existing).

## 10. COMPLIANCE §1
Performance surfaces: yes (when closes show, one line); disclaimers unchanged, no advice, losses unaffected, F3a now
holds. Personal data: three internal integer/timestamp columns on `users`, cascade-deleted; none public except the
summed count already shown. Money, messages, user text, accounts, vendors, dependencies, endpoints, auth: no.
Accessibility: a muted `<p>`, no interaction. Claims: a mechanical rule, no completeness claim.

## 11. Owner items (none blocking)
(a) Amending #62's grace ruling (council-approved); (b) the frozen-record ruling; (c) the matcher bump (a full rebuild
at deploy); (d) the copy.
