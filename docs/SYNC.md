# Hourly sync: shards, schedule and switch-on gate

How the hourly broker sync covers every connected trader, how to configure the cron, and what must be true before
the sharded schedule is switched on. Code: `app/api/sync/route.ts`, `lib/sync-shard.ts`, `lib/sync-limits.ts`,
`lib/sync.ts`. Decisions and reasons: `docs/features/logs/sync/committee-2026-11-01.md` (signed 2026-11-01).

## How it works

- `POST /api/sync?shard=i&of=N` with `Authorization: Bearer $CRON_SECRET` syncs only traders whose id satisfies
  `id % N = i`. No parameters means `shard=0&of=1`: every trader, the behavior before sharding. Parameters are checked
  after the secret: bad ones answer 400 (`0 <= i < N <= 1024`, whole numbers, both or neither).
- **What a call does.** The unsharded call (no parameters, or `of=1`) does everything, as before: housekeeping, the
  privacy slots, the sync and the coverage report. A sharded call (`of > 1`, shard 0 included) only syncs its shard.
  `?task=housekeeping&of=N` runs the housekeeping, the privacy slots and the coverage report for an N-shard schedule,
  and syncs nobody. It has its own cron entry, so no shard spends its window on housekeeping.
- **Each trader's sync is `syncUser`, unchanged**: one transaction under the trader's lock that re-reads the last 7 days;
  any failure rolls back, so a partial record is never published (F-1 D4/D5).
- **Rounds and the durable cursor.** Rounds run from :30 to :30 on the database clock. A trader is claimed at most once per
  round (`users.sync_claimed_at`). A shard reads its queue stalest first (`last_synced_at nulls first, id`), a page at
  a time. A run that stops at its deadline leaves the rest unclaimed at the head of that queue, and the next call resumes
  there. Nobody is synced twice in a round, even when N changes mid-round.
- **One run per shard at a time.** A shard is leased in `sync_shards`. The lease lasts 60 s on the database clock and is
  renewed every 15 s. A run whose renewal fails stops dispatching. A second call for a busy shard answers
  `200 {run: {busy: true}}` and does nothing. A killed run's lease lapses within a minute, so the next 5-minute call
  goes ahead.
- **Bounded concurrency.** `SYNC_CONCURRENCY` workers per run, never more than `DATABASE_POOL_MAX − 2`. A sync holds
  its database connection for its whole transaction, vendor calls included.
- **Deadline.** A run stops dispatching 90 s before the route's 300 s limit. It dispatches a trader only if
  `1 + 3n` vendor bounds (`syncRequests`: the account list, then each account's activities, positions and share moves), plus the expected wait for rate tokens, fit before the limit (n = accounts). A trader that
  does not fit is left for the next call, which starts with a full budget. A run's first trader is always dispatched
  (`SYNC_FIT_CAP` keeps any trader's worst case under one call), so the unsharded call's housekeeping can never defer
  a trader with many accounts forever.
- **Vendor budget.** Each run has a token bucket of `SYNC_VENDOR_RPS` requests per second. Because only one run per shard
  is possible, this is the shard's whole budget. A trader's `1 + 3n` requests are taken before it is claimed, outside
  its transaction. Any extra request (another page on a first sync) takes a token as it goes. The aggregate vendor
  ceiling is `N × SYNC_VENDOR_RPS`.
- **Failures.** What a failure does depends on its cause:
  - **Trader-specific** (a vendor refusal 401/403/404, another 4xx, an account claimed by another profile, a record the
    rebuild rejects): the trader backs off for 1 h after the first failure, then 2 h, 4 h and so on, capped at 24 h. A
    success clears the backoff.
  - **Transient** (429, 5xx, a vendor timeout, a dropped connection, a database-wide error such as too many connections
    or a statement timeout, or a code error such as a `TypeError` from an unexpected vendor answer): never held against
    the trader. It keeps its round
    claim and is retried next round.
  - **Breaker:** once 20 attempts have finished, a run stops if at least half of the last 20 were transient or refused,
    since at that scale the cause is an outage or our own credentials.
  - **Unfinished claims:** two claims that never finished (the process died mid-sync) quarantine the trader, which is a
    backoff, so one poison record never stalls its shard.
- **Housekeeping** (expired sign-in links, the connections tick, pending deletions, the discovery purge, the daily billing
  reconciliation) runs once per cron mark: in the unsharded call, or in the `task=housekeeping` call on a sharded
  schedule. It never waits on a shard lease. Its time is reported as `housekeepingMs`. Its own vendor calls (import
  steps, deletions) are outside the shards' request budgets.
- **Transient streak.** A trader that fails transiently 5 rounds in a row (`TRANSIENT_LIMIT`: a record that always
  times out, or whose own data always throws) is quarantined and backed off, never retried every round forever.

## Read cadence (F-14)

`docs/features/F-14-sync-cadence.md`; committee `docs/features/logs/F-14/committee-2026-11-01.md`. The cron is still
hourly, but each account is read within the vendor's guidance (`lib/sync-cadence.ts`):

- **Activities** (with the share moves, which use the same vendor endpoint) are read at most once per 24 h per account.
  Each read is the 7-day re-read, as before. On hourly rounds a record's trades are about 25 h fresh at worst.
- **Positions** are read at most 4 times in any 24 h per account:
  - on their own clock, 6 h after the last read, while at most 2 reads fall in the trailing 24 h;
  - always together with an activities read.
- **What is never throttled:** the consented import (`importStep`, untouched) and the first sync after a consent
  (a new import or a reconnect). "Importing your record" never waits.
- **Positions and closed trades move together.** A positions read without an activities read adds and updates
  positions and never removes one. So a position closed at a loss stays listed until the read that publishes its
  closed trade (TR-4). If a forced positions read finds 4 reads in its window, which happens only while syncs keep
  rolling back, the activities read waits too (`readsDeferred`).
- **Timestamps:**
  - Read and written on the database clock inside the sync's transaction, so a failed sync never advances them.
  - Null, future or pre-consent timestamps mean "read now".
  - Every successful vendor read is also recorded after the transaction (`sync_read_marks`), so a sync that keeps
    failing reads activities at most every 6 h and positions within the same 4-a-day window.
- **The rebuild** runs only after an activities read (or when the account set, a paper flag or a connection changed).
  `last_synced_at`, which F-11's "Updated …" line reads, is set to the oldest real account's last activities read. It
  never becomes "now" after a rebuild that a change or a partial read triggered. While an account has never been read,
  the previous value stands.
- **The accepted exception to "≤ 1 activities read per 24 h"** (committee G2): when a sync keeps rolling back after its
  read, the 6 h floor allows a retry, so up to 4 activities reads a day for that account. Committed syncs read once a
  day.
- **Options (#62) under the cadence:**
  - Option rows come in with each due account's activities read, through the same calls.
  - An account still owed its one-time option backfill (connections made before #62) reads its next history page *as*
    its daily activities read (same endpoint, same cap). A history of k pages takes about k days to backfill.
  - During a backfill, the account's recent week is unread. So its positions take the positions-only rule (never
    removed), and `last_synced_at` keeps its previous value until the backfill finishes.
  - Open option positions follow the share rule. A positions-only read adds and updates them and never removes one. A
    read with activities removes an unlisted option only once a closing row of its contract (a close, an expiry, an
    assignment or an exercise) has been imported since it was last listed, or after 3 days unlisted (a transfer out).
  - "Updated …" also holds on the sync that reads the last backfill page; it moves with the first week read after it.
  - The open option counts are kept per account (`users.open_options_by_account`), so reading one account replaces
    only its part of the user's totals.
- **A sync cut at the route's end** (the route-end guard) leaves no marks, so the next call reads at once.
- **The account list** is still read every round (TR-5, the claim): 1 request. Whether it may be throttled is a vendor
  question for the owner.
- **Load (calculated, not measured):** about 1.4 vendor requests per trader-hour in steady state, against about 5.5 when every account is due. The
  plan below stays sized for the all-due hour (the first deploy, after an outage, a reconnect wave). The shard runner
  plans each trader's budget from its due reads.
- **Evidence:** each run logs `accountLists`, `activitiesReads`, `positionsReads` and `readsDeferred`, summed hourly in
  `sync_read_counts`. The coverage line reports:
  - `capRatio`: activities reads in the last 24 h ÷ connected real accounts, with `capBreach` above 1.05;
  - the oldest activities and positions reads, with `freshnessAlarm` above 26 h and 18 h (positions normally go 12–13 h unread before
    the read an activities read forces, and up to about 17 h with round jitter).

## Late postings (F-24)

`docs/features/F-24-late-sell-reconciliation.md`; plan and committee record `docs/features/logs/F-24/plan.md` (round 2
and "Round 3 changes"). Code: `lib/reconcile.ts`, the pass step in `lib/sync.ts#syncUser`, the close-change count in
`lib/options-sync.ts#rebuildRecord`. The week re-read starts 7 days before the newest stored activity, so a row the
vendor posts later with an older trade date is never read by it. A periodic full-history read per account (a **pass**)
finds those rows:

- **Insert only.** A pass inserts with the same `on conflict (source, external_id) do nothing` as every other read. No raw
  row is ever updated or deleted, and what it finds reaches `closed_trades` only through the rebuild.
- **Period:** a pass starts at most once per 7 days per account (`RECONCILE_EVERY_MS`). When a pass ends (decided or
  not), the next one is due 7 days later. A whole-history read made another way (the first sync of a record with
  nothing stored, the option backfill's last page) restarts the period too.
- **Stagger:** a null due date is written once, by the first sync that plans the account, as the next occurrence of the
  account's own weekday (`((hashtext(account_id) % 7) + 7) % 7`, on the database clock), on or after `claimed_at + 7 d`
  (a just-claimed account has just read its whole history). From then on it compares normally, so no day is missed.
- **Budget and pacing:**
  - A pass reads one vendor page per due daily activities read (F-14), **in place of** that day's week read. Requests
    per account per day do not change, and nor does the shard runner's request plan.
  - Only under `cadence` (the shard runner), only for accounts due today under F-14 (consented, not frozen, not paper)
    and never for an account still owed its option backfill (the backfill's page wins).
  - A later page waits at least 47 h after the previous one (`RECONCILE_PAGE_GAP_MS`), so an account's daily reads go
    page, week, page, week: its recent trades wait at most one extra day.
  - A one-page pass (page 0 returns `done`) read the whole history in one call, a superset of the week read: it counts
    as the week read. Any other page is a history page: the account's positions take the positions-only rule (a sold
    position is never removed before its close is imported, TR-4) and `last_synced_at` keeps its value, as during an
    option backfill. ponytail: up to a day of "Updated" skew across accounts on page days.
- **Overlap:** each later page starts 50 rows back (`RECONCILE_OVERLAP`: offset += limit − 50), so exactly 50 of its
  vendor ids must also be on the previous page (share, unusable and option rows all count: the order across them is
  not kept, so the check is on the count). More or fewer means a row was inserted or removed before the cursor and a row
  may have been skipped: the pass is invalid. A vendor row with no id makes the count short (invalid, the safe side).
  ponytail: a vendor row with an id but no symbol is in no list either, so inside the overlap it ends that account's
  multi-page passes `shifted` every time (held rows stay held, counted) — fix: count raw vendor ids (a `lib/broker.ts`
  change, owner item).
- **Set completeness:** a pass that ended is complete when it had no overlap break and every `snaptrade` BUY or SELL row
  of the account stored before the pass started is among the ids it listed (unusable trade rows included), except the
  originals of the account's held rows, which are what is being tested. Rows that arrive during the pass cannot mask a
  skipped row.
- **Stable shortfall:** the stored ids an ended pass did not list are kept (`broker_accounts.reconcile_missing`). A pass
  without an overlap break whose missing ids are all among the previous pass's missing ids decides too (a stored row the
  vendor no longer lists, such as a cancel: owner question Q3), so one cancel never leaves an account undecided forever.
- **Abandoned or invalid passes** decide nothing; the next one starts a period later:
  - `shifted`: the overlap broke;
  - `missing`: a shortfall that is not the previous pass's;
  - `bound`: more pages than `ceil(expected / (limit − 50)) + 2`, where expected is every stored row the read can return
    at the start (share rows, unusable trade rows and option rows);
  - `confirm`: 2 failed syncs in a row that were to make the widened confirm read (`sync_read_marks.confirm_failures`);
  - `busy`: the widened confirm read's window holds a full vendor page (1,000 rows) or more, so it would be several
    responses and decide nothing. The account's confirm rows are suspected at once and no widened read is made
    (ponytail: an end date or per-page ids from `lib/broker.ts`, owner);
  - `failures`: 2 failed page steps in a row (`RECONCILE_MAX_FAILURES`). A failure counts (`pageFailureCounts`) for any
    error thrown inside the page step, code errors such as a `TypeError` included, except vendor or database outages
    (429, 5xx, a vendor timeout, transport and database-wide codes) and a cut at the route's end (`RouteDeadlineError`).
    The count is written after the transaction (`sync_read_marks.reconcile_failures`), and a committed sync clears it.
    At 2 the pass is given up and the account reads its week instead.
  Each one adds 1 to `broker_accounts.reconcile_invalid` (passes in a row; a deciding pass resets it) and logs one line.
- **Restart and retention:** a pass started before the account's latest consent or claim restarts at offset 0. An
  account that stops being read (frozen, paper, unconsented) drops its running pass, its listed ids and its missing ids
  in the same sync.
  ponytail: a trader whose every connection is frozen is never synced, so a pass left running there is not cleared; it
  holds only vendor ids `activities` already keeps.
- **Rollbacks:** the cursor and the re-issue states are written inside the sync's transaction, so a failed or cut sync
  leaves them as they were (only the failure count is written after it).
- **Re-issues** (`activity_reissues`, one row per newer id). A newly stored row whose account, symbol, side, time, units
  and price equal a row stored **before this transaction**, under another vendor id, is a possible re-issue. Rows that
  arrive together were listed by the same read and are never held. The rebuild leaves out every row not `genuine`, so a
  re-issue is never published twice. The rebuild passes undecided rows (pending, confirm, and give-ups flagged
  `undecided`) to the matcher as holds (council cycle 5 RT-2): a held row opens no lot, and in the canonical order every
  later sell of its pair is counted in `users.excluded_held` (shown on the profile when there are any), never priced
  from a ledger missing a row; a rename carries the mark; each real sell is counted once. A row decided genuine is
  priced normally; one the count rule decided suspected is a duplicate, left out of the rebuild:
  - `pending`: held until a read decides it. A week read that finds one and cannot decide it brings the account's next
    pass forward (never an account whose pass ran in that sync: an ended or given-up pass waits its period);
  - `genuine`: ONE vendor response (one pass page, one week read, one import page) decides by count. Per twin group, k
    is the group's rows that response listed and p the group's rows not held (listed or not); at most k − p of the
    group's listed held rows are cleared, the oldest stored first, so the record keeps as many fills as the vendor lists
    (a re-issued original, never listed again, cannot hide a genuine late twin). A week read decides only inside its
    window, a day clear of its time-zone boundary. Never the union of a pass's pages: they are days apart, so it could
    hold an original from before its re-issue and the re-issue from after. A `fetchActivities` call that returned a
    full vendor page (1,000 rows) or more is several responses (it pages internally with no overlap), so it decides
    nothing. ponytail: per-page id lists from `lib/broker.ts` (owner) would let each internal page decide. The row is
    kept and published. Final;
  - `confirm`: a complete pass listed enough of the group's rows to clear it by the same count, but never on one page.
    On a busy account (a full vendor page or more stored since the twins' date) there is no widened read: the rows are
    suspected (reason `busy`). The account's next daily
    activities read (inside F-14's budget) is widened to a day before the row's trade date: one call, a superset of the
    week read. It makes the row genuine when it lists both, otherwise suspected (the one week read that can suspect).
    Two failed syncs in a row that were to make it give it up (rows suspected, reason `confirm`, the week read). Held;
  - `suspected`: no single read listed it with every unheld twin, or a twin was not listed at all. Held, counted for the
    owner; a later pass that lists it and its twins on different pages sets it to `confirm` again. Held rows and their
    twins never make a pass short.
  The connect-time import (`importStep`) checks each page on its own; its pages overlap by up to 50 rows so neighbouring
  twins share a page (an import step can wait an hour or more behind a backoff, so pages are never joined). Option rows are
  counted (`optionTwins`), not held: a re-issued option close can show twice until the owner decides (owner item).
- **Close-change count:** every rebuild compares the trader's closes (share and option) before and after, by id and a
  hash of the shown fields (theses left out). Closes that were shown and are now changed or removed are added to
  `users.closes_rewritten` and logged. Added closes are not counted. The count is shown nowhere yet.
  The deploy-time matcher rebuild (`lib/matcher-rebuild.ts`, once per `MATCHER_VERSION`) goes through `rebuildRecord`
  too, so closes a matcher change rewrites are counted the same way (D4: every rebuild that changes or removes a shown
  close). A record whose closes it leaves unchanged adds nothing. Separating the two causes would need a cause column:
  an owner item.
- **Nothing visible:** a found close renders like any close on the profile, the trade page, the feed card and the share
  card, with no "late", "corrected" or "new" wording or styling. Its thesis stays attached by `sell_id`. No file under
  `app/` reads any of this state (`lib/sync-reconcile.copy.test.ts`).

**Log lines** (`const id = userId`: the internal user id and counts only, never a handle, figure or payload):

| Line | When | Shape |
|---|---|---|
| `sync closes rewritten <id> {…}` | a rebuild changed or removed a close already shown | `{"changed":n,"removed":n,"added":n}` |
| `sync reissues <id> {…}` | a sync found, cleared or counted re-issues | `{"found":n,"cleared":n,"pending":n,"confirm":n,"suspected":n,"optionTwins":n}`: found and cleared in this sync; pending, confirm and suspected are the trader's totals |
| `sync reconcile invalid <id> {…}` | a pass ended without deciding, or was given up | `{"reason":"shifted" \| "missing" \| "bound" \| "failures"}` |
| `sync reconcile marks failed <id> <error>` | writing the failure count after the transaction failed (never fatal) | `console.error`, `logSafe(e)` |

**Owner queries** (internal ids only):

```sql
-- Closes already shown that a rebuild changed or removed, per trader.
select id as user_id, closes_rewritten from users where closes_rewritten > 0 order by closes_rewritten desc;

-- Held rows per trader: pending (waiting for a read to decide) and suspected (a complete pass did not list the original).
select user_id, count(*) filter (where state = 'pending') as pending, count(*) filter (where state = 'suspected') as suspected
from activity_reissues where state <> 'genuine' group by user_id order by suspected desc, pending desc;

-- The oldest pending row's age, per account (a held row that may be a genuine fill waits this long).
select user_id, account_id, now() - min(found_at) as oldest_pending, count(*) as pending
from activity_reissues where state = 'pending' group by user_id, account_id order by oldest_pending desc limit 50;

-- Passes in a row that ended invalid or were given up, per account, with the pass's position.
select user_id, account_id, reconcile_invalid, reconcile_offset, reconcile_due_at, reconcile_missing is not null as shortfall
from broker_accounts where reconcile_invalid > 0 order by reconcile_invalid desc;
```

Alert on any account whose `reconcile_invalid` keeps growing: its passes never validate, so a held row there (possibly a
genuine fill) stays held and counted until the owner looks.

## Publish once the date has passed (F-35)

A trade reaches the record once its date has passed: the rebuild reads rows with `executed_at <= now()` (the
transaction's clock), for shares, options and corporate actions (`lib/sync.ts#published`, `lib/options-sync.ts`). This
amends #62's 24-hour grace, which published a sell dated up to a day ahead (council cycle 5, C5-30).

- **Waiting rows.** A row dated after now() is stored (raw rows are immutable), never matched, and counted:
  `users.excluded_future` (share rows, buys and sells, same filters as before) and `users.excluded_future_options`
  (option rows, not paper, not shared). The profile prints their sum on one muted line,
  `PROFILE.futureWaiting(n)`: "N imported trade(s) excluded: dated in the future by the broker. It waits on this line
  until that date passes." (the second sentence describes the line only: a matured sell with no entry is counted, not
  shown). F-21's sells-only sum must never read `excluded_future` (it holds buys). The compare tool's card keeps the
  first sentence (`PROFILE.excludedFuture`) with the summed count.
- **The 24-hour grace** (`FUTURE_GRACE_HOURS`) now bounds only the re-read window: a row dated further ahead never sets
  it (the newest stored row minus a week). How far ahead a row is quarantined is unchanged.
- **Watermark.** `users.published_through` is the clock of the record's last committed rebuild
  (`lib/options-sync.ts#rebuildRecord`, the same transaction: a failed rebuild leaves it). An insert that stores a row
  dated ahead lowers it to its own transaction's clock (`lib/sync.ts#lowerWatermark`; never fills a null), so a
  transaction that started before a rebuild committed (an import step waiting on the lock) never stores a row the pass
  skips.
- **Matured pass** (`lib/sync-shard.ts#maturePass`, every shard run from `/api/sync`, `mature: true`). After the shard
  lease and heartbeat, before the workers: one query (`maturedQuery`) finds the records with a row stored while dated
  ahead (`executed_at > created_at`) whose date is in (`published_through`, now()], within 8 days; and, once per record,
  the records with no watermark holding a row still dated ahead (`maturedInitial`: a close published early on the old
  grace leaves at once after the deploy, with no fleet-wide rebuild). Up to `MATURED_PER_RUN` (50) records per run,
  within `MATURED_BOX_MS` (20 s), and never past the run's deadline, the route's end or a lost lease. Each record: one
  transaction, `pg_try_advisory_xact_lock(USER_LOCK, id)` (busy: left for the next run, the watermark unmoved), then
  `rebuildWithoutRead` (the rebuild, with `last_synced_at` put back: "Updated" and the claim order never claim a vendor
  read the pass did not make). Scope: not deleted, not a public filer, no import running (its own rebuild advances the
  watermark); frozen records are included (the rows were imported before the freeze, no vendor read is made, and a loss
  among them is published like any other: TR-5).
- **Indexes.** Partial indexes on `executed_at` where `executed_at > created_at` on `activities`, `option_activities`
  and `corporate_actions` (only rows stored while dated ahead). Each table is read through its index in a materialized
  CTE, so the plan never visits a trader without such a row. EXPLAIN at the LOAD shape: `lib/f35-matured.load.test.ts`
  (100,000 traders, 2,000,000 activities): no sequential scan, rows read within the future-stored rows.
- Owner queries: `select count(*) from users where published_through is null and exists (select 1 from activities a
  where a.user_id = users.id and a.executed_at > a.created_at and a.executed_at > now())` (deploy catch-up left).

## Logs (numbers only, no personal data)

| Line | When | Fields |
|---|---|---|
| `sync run start {…}` | a run took its lease | of, shard, concurrency, rps |
| `sync run {…}` | every call | of, shard, busy, done, skipped (lock held elsewhere), deferred (did not fit), transient, refused, failed, quarantined, releaseFailed, remaining (left this round), inBackoff, stoppedAtDeadline, breaker, leaseLost, aborted, concurrency, requests, tokenWaitMs, pages, ms, matured, maturedInitial, maturedBusy, maturedFailed (F-35) |
| `sync matured rebuild failed <id> <class> <status>` | one record's matured-pass rebuild failed (F-35) | internal user id, error name and HTTP status |
| `sync coverage {…}` | every unsharded or housekeeping call | missingShards (no heartbeat in 15 min, counting shards that never ran), capRatio, capBreach, oldestActivitiesReadHours, oldestPositionsReadHours, freshnessAlarm, unclaimedPrevRound, neverSynced, stalestHours, inBackoff, refused, quarantined, oldestRefusalHours, dbConfigOk, dbProblems, db settings, idle (F-11: records with no successful sync for 30 days, `lib/sync.ts#idleCount`) |
| `sync round incomplete {…}` | the previous round left traders unclaimed, or a shard is missing | of, missingShards, unclaimedPrevRound |
| `sync failed <id> <class> <status>` | one trader's sync failed | internal user id, failure class, error name and HTTP status (never the message) |

Alert on `sync round incomplete`, on `breaker: true`, on `dbConfigOk: false`, on `capBreach: true` and on `freshnessAlarm: true`.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `SYNC_CONCURRENCY` | 1 (1–32) | workers per run; clamped to `DATABASE_POOL_MAX − 2`. The plan sets 6 at switch-on |
| `SYNC_VENDOR_RPS` | 2 (1–1000) | vendor requests per second per shard. The plan sets 12 at switch-on |
| `SYNC_VENDOR_BURST` | = RPS | the most requests saved up |
| `SYNC_PAGE` | 500 | traders read per queue page |
| `SYNC_START_JITTER_MS` | 15000 | sharded calls (`of > 1`) other than shard 0 start after a random delay up to this; 0 disables |

The defaults are today's effective rate (one worker, about 2 vendor requests a second, the old sequential tick), so
merging this does not raise vendor load before the switch-on gate. The plan's values are set together with the
sharded cron.
| `DATABASE_POOL_MAX` | 10 | the app's connection pool per instance (`lib/db.ts`) |

## Capacity and the production plan

The per-shard rate is `min(C / L, RPS / q)` traders per second, where C is the workers, L is one trader's sync time and
q is its vendor requests. Each round has 11 calls (every 5 minutes, never at :30) of 210 s of dispatching, so 2,310 s.

| Plan | Assumptions | Per shard per round | Total |
|---|---|---|---|
| **40 shards × 6 workers, RPS 12** (the plan, committee round 3) | p95 0.5 s per request, half the traders with 2 accounts (q = 1 + 3 × 1.5 = 5.5, L ≈ 2.75 s) | design min(6/2.75, 12/5.5) = 2.18 a second × 2,310 ≈ 5,000; **measured ≈ 3,880** | **≈ 155k, extrapolated** from the measured per-shard rate × 40 (1.55× over 100k) |
| 32 × 6, RPS 10 (the plan before #40's third read) | the same | measured ≈ 3,125 | ≈ 100k: no headroom |
| of=1, defaults (1 worker, RPS 2) | the same | rate-bound: 2 / 5.5 ≈ 0.36 a second × 2,310 ≈ 840 at p95 latency | the old sequential rate (~5k/hour at 0.5 s a trader) |

**Measured** (`lib/sync-shard.load.test.ts`, opt-in `LOAD=1`, 2026-11-01, after #40). The test runs 100,000 synthetic
traders against the in-repo vendor fake on 40 shards × 6 workers, including the share-move read. Time is scaled by 10:
50 ms a request, a 3 s request bound, 30 s calls with a 9 s reserve, and 120 req/s per shard. Database time is not
scaled, so the test errs on the conservative side. The database server had 100 connections, so 10 shards ran at once
(in four batches), not all 40. The 155k total is therefore the measured per-shard rate times 40, an extrapolation that
assumes a database sized for 40 × 8 connections. The test drives `runShard` directly, not the route; with housekeeping
in its own call (above), every shard's window is the same.

- Of the 100,000 traders, 98,912 healthy ones were synced exactly once in round 1. The 989 slow traders, whose requests
  pass the bound, counted as transient and were synced in round 2. The 99 failing traders were backed off.
- Nothing was deferred, cut at a call's end or falsely quarantined. Shards were disjoint, at 16.5 traders a second per
  shard in scaled time (5.45 requests a trader).
- The worst shard used 7.09 of the round's 11 calls (**1.55× headroom**); in whole calls, 8 of 11 (1.38×).
- The latency-model test (one shard, real 200–500 ms latency, RPS 12, 6 workers) measured 2.17 traders a second. The
  prediction was 2.22 (−2.3%).

**Why the measured figure is below the design figure.** The database's own time (about 17 ms a sync) is not scaled in
the test, and the workers spend time waiting for pool connections. At production speed, a trader's sync is measured at
2.89 s, giving min(C/L = 2.07, RPS/requests = 2.20) ≈ 2.07 a second per shard. The plan has no concurrency slack:
C/L and RPS/requests are nearly equal, so latency spread lowers throughput directly. Re-measure on the real account
distribution before switch-on.

**Fit rule (committee round 3).** A trader is dispatched only if its requests fit before the call's end at the run's
observed p99, plus one whole bound for a straggler, plus a 10 s margin (all at the bound until 50 requests are timed).
The plan uses the trader's real account count. The run's first trader is always dispatched.

**Route-end guard.** A vendor call is refused (`RouteDeadlineError`) if its requests, each at its bound, could end in the
call's last 10 s; a multi-account activities read counts as n requests. The trader's transaction rolls back, so nothing
is published.
- A trader that was not the run's first pick gets its round claim back for the next call (`cutAtDeadline`), with no
  attempt, streak or backoff.
- The run's first pick had the whole call. A cut there counts as a transient failure, so a sync that can never fit a
  call is quarantined after 5 calls instead of holding a worker every call.

**What the guard does not cover** (`ponytail:` in `lib/sync-shard.ts`):
- the database work after the last vendor call (the rebuild and the positions write, well under a second);
- the requests of a read past one vendor page (an activities week or a share-move history over 1,000 rows), which run
  inside one broker call;
- per-request timing inside a multi-account read: its requests enter the p99 at their average.

Covering these needs a per-request hook in `lib/broker.ts`, or the resumable per-account sync (follow-up PR).

**Database:** peak connections are `N × (C + 2)` = 40 × 8 = **320**, plus the rest of the app. A pooler does not reduce
this: each held transaction pins a server connection. Size the server for about 360 backends (`max_connections` ≥ 340, the coverage check's `N × (C + 2) + 20`,
and memory for them: `work_mem` × backends must fit next to `shared_buffers`). Set timeouts at the role level, for
example:

```sql
alter role stock_social set statement_timeout = '60s';
alter role stock_social set idle_in_transaction_session_timeout = '6min';
```

The idle timeout must sit above the largest sync cost (`(1 + 3 × SYNC_FIT_CAP) × 30 s` = 300 s) and below the per-user lease
(10 min). The coverage line checks both timeouts and `max_connections ≥ N × (C + 2) + 20`, and reports
`dbConfigOk`.

## Cron setup

The endpoint answers both `POST` and `GET`, with the same bearer check and the same parameters. The host's cron
(`vercel.json` `crons`) sends `GET` with `Authorization: Bearer $CRON_SECRET` when the project's `CRON_SECRET` is set.
The schedule is a deploy setting for the owner: this repo has no `vercel.json`. Check that the hosting plan allows
5-minute crons, and how many cron entries it allows.

Today's entry (`of=1`):

```json
{ "crons": [ { "path": "/api/sync", "schedule": "0,5,10,15,20,25,35,40,45,50,55 * * * *" } ] }
```

Sharded (after the switch-on gate): one entry per shard plus the housekeeping entry, on the same schedule:

```json
{ "crons": [
  { "path": "/api/sync?shard=0&of=40", "schedule": "0,5,10,15,20,25,35,40,45,50,55 * * * *" },
  { "path": "/api/sync?shard=1&of=40", "schedule": "0,5,10,15,20,25,35,40,45,50,55 * * * *" },
  …
  { "path": "/api/sync?shard=39&of=40", "schedule": "0,5,10,15,20,25,35,40,45,50,55 * * * *" },
  { "path": "/api/sync?task=housekeeping&of=40", "schedule": "0,5,10,15,20,25,35,40,45,50,55 * * * *" }
] }
```


- **Today (until the gate below is met):** one call `/api/sync` (shard 0 of 1) every 5 minutes, never at :30:
  `0,5,10,15,20,25,35,40,45,50,55 * * * *`. It does everything, at the default rate.
- **Sharded plan:** 40 calls on that same schedule, `/api/sync?shard=i&of=40` for i = 0…39, plus **one housekeeping
  call** `/api/sync?task=housekeeping&of=40` on the same schedule. Configure them as 41 cron entries, or one scheduler
  job that sends all 41 at once. Each call has `maxDuration` 300 s. The random start delay spreads them out. Set
  `SYNC_CONCURRENCY=6`, `SYNC_VENDOR_RPS=12` and `DATABASE_POOL_MAX=8` (C + 2).
- Runs with different shard counts do not exclude each other: a manual unsharded call during an `of=N` schedule adds
  its own vendor budget (round claims still prevent any double sync). Avoid manual calls while sharded.
- Changing N is safe at any time: round claims carry over, so nobody is synced twice. Leases are per (N, shard), so
  for one round both counts may run, and the vendor budget can briefly reach the sum of both plans.

## Switch-on gate (required before any `of > 1` cron)

Every item below must hold. Until then, the cron stays at `of=1`.

1. **The vendor has confirmed in writing both the quota and its cost**: at least `N × SYNC_VENDOR_RPS` (480 req/s for the
   plan), plus housekeeping's import and deletion calls, for the plan's account. If the quota is lower, the quota caps
   capacity, not N: lower RPS and re-run the capacity table. Whether the share-move read must run hourly is an open
   question for the owner and F-14 (sync cadence): read daily, it would cut the cost per account from 3 requests to
   about 2.
2. **The "Last updated ‹date›" line has shipped.** A connected record whose last sync is over 24 h old must say so on the
   profile and the open-positions block (owner decision via the three-variant process). Without it, a trader in backoff
   keeps a record that looks live.
3. **The owner has decided the TR-5 rule for vendor refusals:** whether repeated 401/403s disconnect (freeze) a record.
   Nothing clears `disconnected_at` today, so this is irreversible. Until then, refusals are counted (`refused`,
   `oldestRefusalHours`) and backed off. Refusals never freeze: since fixes cycle 3 (F3-3) only confirmed absence does
   (the connection's accounts missing from two successful account lists at least `FREEZE_CONFIRM_HOURS` apart,
   `connections.missing_since`), and a frozen connection is not read (owner question Q1 of council cycle 3).
4. **The coverage line reports `dbConfigOk: true`** against the production database, with the plan's N and C.
5. **The housekeeping entry is in the cron** (`task=housekeeping&of=N`). Without it, sharded calls run no deletions,
   purges, billing reconciliation or coverage report. Its `missingShards` must read 0 after one round.
