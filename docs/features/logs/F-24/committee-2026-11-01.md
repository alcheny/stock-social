# F-24 committee record, 2026-11-01

Feature: `docs/features/F-24-late-sell-reconciliation.md`. Members: UX lead (plan author), business lead, engineer,
reliability reviewer (added for this feature), each a fresh-context subagent; the orchestrating build session wrote the
brief and the round-2 synthesis. Plan: `plan.md` (round 1 draft replaced by the round-2 synthesis plus "Round 3
changes"). Brief: `brief.md`.

## Prerequisite
F-14 (sync cadence) merged as PR #64, commit 44a134b on main ("F-14 sync cadence: each account read within the vendor's
guidance (activities 1/day, positions 4/day) (#64)"); its committee log `docs/features/logs/F-14/committee-2026-11-01.md`
ends with the orchestrator's review of #64 (taken). F-22 shares the ledger slot but waits on the owner, so F-24 had it
alone.

## Round 1 (UX lead's draft; all three reviewers: CHANGES REQUIRED)

UX lead draft positions: 7-day period; alternate pages with week reads; random-default stagger; persisted listed ids; week read decides re-issues; recent_read_at; option closes in the change log; md5 arrays instead of a temp table; record_rewrites table.

Business lead r1: CHANGES REQUIRED.
1 week read may decide genuine only; otherwise pending + reconcile_due_at=now (D5: only a full read decides suspected).
2 pass completeness: overlap 50 rows per page (offset += limit-50), previous page's last 50 ids must reappear, else the pass decides nothing and restarts.
3 diff inside rebuildRecord so every rebuild (connect/done, syncTick, reflag) is covered.
4 null-safe hash md5(row(...)::text); thesis out of hash.
5 removal case test (pre-F-24 twins); activities.id decides "inserted later".
6 losses visible: AC1 late SELL is a loss, profile/stats/feed; held genuine loss returns after pass.
7 owner queries in SYNC.md; console line `sync reissues {user,pending,suspected}`.
8 AC3 F-24 on vs off: identical vendor requests.
9 AC4 unlisted connection; frozen mid-pass stale reconcile_listed removed.
10 AC7 feed/swipe; option twin key with contract_units/share_price.
Positions: 7d yes, alternate yes, stagger yes (tests set due explicitly), persisted ids yes, recent_read_at yes, option closes yes, arrays not temp table.

Engineer r1: CHANGES REQUIRED.
1 no `delete from` in sync.ts (reflections.test:78): seen ids as broker_accounts.reconcile_seen text[] (no table), only for multi-page passes.
2 log shape: console.log('sync closes rewritten', id, JSON.stringify({changed, removed, added})) — `user` key forbidden.
3 week read never decides suspected; genuine only when E listed and N.executed_at >= since+1d; else pending (held).
4 detect twins on every insert path with one SQL after inserts; only rows from the activities read (not share moves).
5 exclusion as one shared fragment (page query, chain query, future count).
6 drop recent_read_at; use pagedIds/midBackfill (ponytail ~1 day skew).
7 reuse the paged loop (backfill wins); reconcile progress beside saveBackfill.
8 every full-history read (!last, backfill end) restarts the reconcile clock; importStep ponytail.
9 row-constructor md5, is distinct from; cap ids; diff wrapper around default rebuild; simpler: counter + log line, drop record_rewrites.
10 options: (a) ponytail counting option twins without holding (recommended).
11 paged pass not a snapshot: two passes before genuine->suspected, or decide only from consistent reads.
12 SCHEMA_MAP entries; no `delete from` text in schema; AC3 offset null→1000→2000→null.

Reliability r1: CHANGES REQUIRED.
1 no single-pass demotion: E absent in two consecutive completed passes; void a pass whose distinct listed count < stored listable count; no first-pass sweep demoting published closes on one pass.
2 absence test only over rows the read can list (BUY/SELL/option event types, same account; not share moves / corporate actions).
3 failing page must not block week read: failure count outside txn; after 2 at same offset give up pass (offset null, due +7d, counted).
4 every pass ends: fix end at start (listable count + 1 page or max pages); restart otherwise.
5 reset pass state when account leaves real / reconnect / owner change / overlong pass; pending counted.
6 keys: reconcile_listed (user_id, account_id, external_id) on conflict do nothing; activity_reissues (source, external_id) per user.
7 diff in rebuildRecord (every caller); on-the-spot decision on non-cadence paths too.
8 gate diff on "something changed"; 10k-close LOAD case.
9 page_at stamped with clock_timestamp, slack 47h; page in readActs; rollback + RouteDeadlineError test.
10 no volatile column default (table rewrite under lock); stagger in code by account id hash.

## Round 2 (orchestrator's synthesis; all three: CHANGES REQUIRED, converging)
Conflicts settled: a week read may decide genuine only (business 1, engineer 3) over the UX lead's both-ways decision;
genuine is final and pre-F-24 twins are not swept, so no single pass can pull a shown close (answers reliability 1
without two-pass delays); a column (`reconcile_seen`) instead of a table (engineer 1); `recent_read_at` dropped for
F-14's `midBackfill` (engineer 6) over the UX lead's and business lead's preference, with a ponytail; the change diff in
`rebuildRecord` (all three); counter plus log line instead of a `record_rewrites` table (engineer 9, business accepted);
option twins counted, not held (engineer 10a; owner item); stagger in code, no volatile default (reliability 10).

Business lead r2: CHANGES REQUIRED (close; signs without another round if met).
1 short-count pass never valid forever: two consecutive passes short by the same number (no overlap break) → second decides; log `sync reconcile invalid` with reason code; oldest pending age in owner queries; test.
2 twins both new in same txn → genuine at once (import, week read).
3 AC1 loss ranks in feed by abs(return_pct); AC6 held genuine losing fill returns after valid pass.
4 option-twin departure explicit to owner (AC6 read as share rows only) or hold them.
5 clear reconcile_seen/tail when account freezes/leaves real mid-pass (retention); AC4 assertion.

Reliability r2: CHANGES REQUIRED: 1 set-based completeness (every stored listable id except pending originals); 2 stagger sign bug + write next hashed day; 3 count only reconcile-step non-transient failures; 4 importStep detection; 5 count invalid/abandoned passes, owner query, ponytail, unstable-order test.
Engineer r2: CHANGES REQUIRED: 1 set check created before reconcile_started_at excluding pending originals, unusable ids count as listed, expect only for bound; 2 ((h%7)+7)%7 and gate t >= claimed_at+7d; 3 twins only vs rows stored before this txn (e.created_at < now()); 4 log shapes const id = userId; 'sync reconcile abandoned'; 5 failure counter guarded, only when page attempted, reset on abandon/success; reconcile_valid in plan.

## Round 3 (plan "Round 3 changes" 1-15)
- Business lead: SIGN (all five r2 demands met).
- Engineer: SIGN (non-blocking notes taken: twins only against rows stored before the transaction; reason name
  `missing`; item 11 limit as a ponytail).
- Reliability: one demand (code errors such as a `TypeError` in the page step must count toward giving a pass up),
  taken as item 14 (`pageFailureCounts`, not `classify`) → SIGN on that condition, met in the build.
- UX lead: no visible change (a found close renders like any close); the copy test covers trade row, trade page and
  feed card.

## Decisions taken by the committee (recorded in the feature file's Decisions)
1. Period 7 days per account; pages alternate with week reads (47 h gap); a page replaces that day's week read.
2. Stagger: a null due date becomes the account's next hashed weekday, never before claim + 7 days.
3. Re-issue states pending / genuine / suspected in `activity_reissues`; activities untouched; rebuild holds non-genuine.
4. A pass decides only when complete (overlap check, set check of stored ids) or with a stable shortfall; invalid passes counted.
5. Failure rule: 2 counted page failures give the pass up; the week is read.
6. Close-change count in `rebuildRecord` for every rebuild; `users.closes_rewritten` and a counts-only log line.
7. Option twins counted, not held (owner item); TR-4 via `pagedIds`; "Updated" via F-14's `midBackfill`.

## Build, QA and review
- **Tests first, by three engineers in parallel** (fresh contexts, one file set each): AC1–AC4
  `lib/sync-reconcile.db.test.ts` (in-memory vendor and the vendor fake over HTTP), AC5/AC6
  `lib/sync-reconcile.log.test.ts` and `lib/sync-reconcile.reissue.test.ts`, AC7 `lib/sync-reconcile.copy.test.ts` and
  `e2e/f24-found-close.spec.ts` (360 px), TR-4 page day in `lib/sync-cadence.tr4.test.ts`. They found two bugs, both fixed:
  - a pass's decided states wrote no `sync reissues` line;
  - a first page that kept failing was never given up.
- **Independent code review** (fresh context): two blocking findings, fixed with regression tests
  (`lib/sync-reconcile.review.test.ts`, each failing on the pre-fix commit):
  - the overlap check took its tail from share and unusable ids out of vendor order, so options or unusable rows made
    every multi-page pass invalid. Fix: count shared ids across every vendor row kind;
  - the page bound counted share rows only. Fix: count option and unusable rows too.
  Four non-blocking findings were also fixed:
  - an ended or given-up pass was pulled forward by its own held rows;
  - rows found by a page were missing from the log count;
  - outage codes counted as page failures;
  - `reconcile_missing` was not cleared on retention.
  The stagger now uses UTC days.
- **Tester QA loop:** no blocking defects. Fixed:
  - D1: a re-issue among identical genuine fills was published three times. A row is now genuine only when every unheld
    twin is listed.
  - D2: a held row the vendor stops listing stayed pending forever. A complete pass now marks it suspected.
  - D7: held rows made a pass short.
  - D5: the twin lookup planned quadratically before an analyze. The new rows are now materialized first.
  Each has a regression test, (j)–(l). Heavy use: about +20–40 ms per sync for a 5,000-activity trader, within noise
  next to the rebuild.
- **UX lead, 360 px:** PASS. A found close renders exactly like any close (same markup and classes, thesis attached,
  loss shown); the diff touches no `app/` file.
- **Business lead:** first verdict CHANGES REQUIRED:
  - the `firstDue` floor could be due up to a day early (flaky, 3 of 18 runs);
  - the SYNC.md definitions did not match the code;
  - a ponytail was needed for symbol-less vendor rows.
  All three were fixed. Then PASS: the stagger test ran 30 times without a failure.

## Orchestrator review of #84 (taken)
- **Blocking:** a re-issue that fell between two pass pages was counted twice, permanently. A pass's pages are about 2
  days apart, but `markGenuine` ran over the union of every id the pass had listed so far, so that union could hold the
  original E from before its re-issue and the re-issue N from after it. N went `genuine` (final) and both rows
  published, even through a zero-net-shift overlap. Fix: a pair is genuine only when one vendor response (one page or
  one week read) lists both rows, and a complete pass marks everything still pending `suspected`. Neighbouring twins
  share a page through the 50-row overlap, so genuine twins are still found. Tests: (c) rewritten, (f) reworked, (m)
  the repro in both variants.
- **Nits:**
  - The import now checks each page with the account's previous import page, so neighbouring twins split across an
    import page boundary are never held (test (n)).
  - A pass is planned only when the page limit exceeds the 50-row overlap (`passPageLimitOk`).
  - The PR body states the local compliance exit status precisely.

## Orchestrator second review of #84 (dc08182: BLOCK) and the committee's ruling
- **F1, high:** the import's "previous page" union brought the defect back. An import step can wait behind a backoff
  of up to an hour, a deadline cut or the stale clock, so a reconnect could list E on page 1 and the re-issue N on
  page 2, and N went genuine. Fix:
  - import pages overlap (`importOverlap` = min(50, limit − 1)), so neighbouring twins share a page;
  - `markGenuine` runs on the current page only;
  - `imported_count` counts new rows only.
  Tests: R1 (both variants); the connection tests' page offsets are updated to the overlap.
- **F2, medium (committee decision):** the one-page rule could leave a genuine identical fill listed far from its twin
  `suspected` forever, so a real loss stayed off the Verified record (repro R2). Three options:
  - A: keep the rule;
  - B: one extra targeted read (needs an F-14 cap exception);
  - C: flag the row `confirm` and widen the account's next daily read to its trade date: no extra request.
  **Chosen: C, with three amendments:**
  1. only rows the pass listed with all their twins (on different pages) are flagged;
  2. suspected rows are re-examined by each later complete pass;
  3. the widened read is given up after 2 failed syncs, and the shard budget is charged its estimated pages.
  Positions:
  - Business lead (C): no hidden loss, no extra request.
  - Engineer (C, amended): small diff, no F-14 change; charge the extra pages.
  - Reliability (C, amended): bounded failure modes.
  Accepted residual: a true re-issue whose original the vendor still lists in that one read shows twice (D5's own
  rule). This is an owner question, and so is the vendor's list order. The decision, AC6 note, schema comment and open
  questions are recorded in the feature file.
- **F3, nit:** the `!last` whole-history read now checks twins page by page.

## Orchestrator third review of #84 (61898e3: BLOCK on M1) — taken
- **M1, medium:** a held genuine fill stayed hidden forever when its unheld original was re-issued (never listed by id
  again). Fix: one response clears by count. Per twin group, at most k − p of its listed held rows are cleared, where k
  is the rows listed and p the unheld rows, oldest first. The same rule decides `confirm`. QA D1 and R1 still hold.
  Tests: RA1, RA2.
- **L1:** a `fetchActivities` call is several vendor pages with no overlap, so a call of 1,000 rows or more decides
  nothing. Its widened confirm rows become suspected, and the next pass re-examines them. Test: RB. Ponytail and owner
  item: per-page id lists from `lib/broker.ts`.
- **L2:** the widened read's budget charge counts listable share rows, unusable trade rows and option rows, the same
  base as the pass's page bound. Test: RC.
- **L3:** "stored by this transaction" relies on no insert running inside a savepoint. A static invariant test pins it.
- **Nit:** the `sync_read_marks` retention text names the new failure counters.
- **Owner flag:** for an old confirm date, the widened read is in effect a whole-history read in one sync, the burst the
  pass's pacing avoids while MR-1 is open.
- **Main's #89 (matcher version 2, a deploy-time rebuild of every record through `rebuildRecord`):** decided, under the
  owner's instruction, that those rebuilds are counted in `users.closes_rewritten` like any other. D4 says every rebuild
  that changes or removes a shown close, and a matcher change rewriting shown closes is exactly that. Records whose
  closes don't change add nothing; the AC5 add-only test pins it. Owner item: a cause column, if matcher-driven and
  vendor-driven rewrites should be exposed separately.

## Orchestrator fourth review of #84 (811b398: BLOCK on C7) — taken
- **C7, medium:** the L1 rule (a read of a full vendor page or more decides nothing) left a busy account's far-apart
  genuine twin cycling confirm → suspected every pass, with a wasted multi-page widened read each time. The committee
  log's "the next pass re-examines them" was not true for such accounts. Fix: `plannedConfirm` estimates the window
  with the budget charge's own row count (`confirmRowsSql`). At a full page or more, the rows are suspected at once,
  counted and logged with reason `busy`, and no widened read is made. Recorded as an owner residual in AC6 and Open
  questions. Owner item: a `lib/broker.ts` change (an end date on `fetchActivities`, or per-page id lists).
- **C6, low:** the one-response threshold counted rows kept after filtering, not vendor rows. A two-page call with
  dropped rows could pass as one. Fix: `fetchActivities` calls the option sink once per internal vendor page, so the
  sync counts those calls and requires one page.

## Council cycle 5, record-trust lens: RT-2 (high) — taken
- **Finding:** `rebuildTrades` dropped held rows, so FIFO ran on a ledger missing them and published later closes from
  the wrong lot. Probes:
  - a held identical SELL: a -40% close vanished uncounted, and the next sell published -60% instead of +33.3%;
  - a held identical BUY: a -20% close published as +6.7%.
- **Decision**, under the owner's instruction, on the orchestrator's recommendation:
  - Held rows go to `matchTrades` as holds (`Activity.held`). A held BUY opens no lot, and a held SELL is counted under
    `excluded`.
  - Every sell of the pair after a held row is counted under `excluded`. So is any sell at its instant that isn't the
    held row's own unheld twin, which stays shown so a shown original is never pulled.
  - Genuine prices normally on the next rebuild; suspected keeps the pair counted. Theses go to `kept_theses` and come
    back by `sell_id`.
  - Trade-off: while pending, a pair's later sells are counted, not shown ("count, never guess"), and they return when
    decided.
- **Steering check:** the vendor creates re-issued ids, not the trader. If a reconnect makes the vendor re-issue ids,
  every such pair stays counted until a read lists the rows (the count rule) or a pass decides them. That is a vendor
  question and an owner item, recorded in Open questions.
- **`MATCHER_VERSION` stays at 2:** the output changes only where a held row exists, and `activity_reissues` is new, so
  no record's output changes at deploy.
- **Ponytail:** a rename after a held row moves the lots but not the hold.

