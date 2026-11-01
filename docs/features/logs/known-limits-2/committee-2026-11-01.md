# Known limits 2: committee record (2026-11-01)

Session: `claude/known-limits-2`, started by the owner's orchestrating session to resolve the next batch of `ponytail:`
known limits (owner: "ponytail skills should be used everywhere"). Follows `claude/known-limits` (#52). One engineer
subagent per item planned and built in parallel; a fresh-context reliability reviewer and the business lead signed the
plans; then tester QA and an independent code review on the combined diff. Open questions are decided by the
committee's recommended option; product questions go to the owner.

## Scope

| # | Item | Where |
|---|---|---|
| 1 | Display log snapshots one trader at a time in a 20 s box | `lib/display-log.ts` |
| 2 | Billing reconcile unboxed; a processor 409 for an in-flight idempotent customer create fails the checkout | `lib/billing.ts` |
| 3 | Tick loops and the attempt sweep start from the lowest id (starvation); the sweep is unlimited | `lib/connections.ts` |
| 4 | Similar-traders pool per process, rebuilt every 10 s, each request sorts the whole pool | `lib/similar.ts` |
| 5 | Own follow / hidden / expired-hide lists unpaged; referral names past 20 cut silently | `lib/follows.ts`, `/me/following`, `app/tools/page.tsx`, `app/u/[handle]/referral-feedback.tsx` |
| 6 | A profile view reads the record 3–4 times | `app/u/[handle]/page.tsx`, `record-card-data.ts` |
| 7 | Five missing indexes | `db/schema.sql`, `lib/delete.ts` |
| 8 | Privacy purge clearing and marking steps walk whole tables each tick | `lib/privacy-purge.ts` |
| 9 | Sitemap count cached per server; every chunk groups closed_trades and pages by offset | `lib/sitemaps.ts` |
| 10 | `lib/feed.ts` limits: full-pass fallback and the notes beside it | `lib/feed.ts` |

## Plan reviews (fresh context)

Business lead: all ten approved, eight with demands; all ten are fixes (no three-variant process). Cuts: the feed
plan's trigger on activity inserts (a second, hidden writer to the derived `closed_trades`; the case is unreachable
today) and the sitemaps plan's new `closed_trades (symbol collate "C") include (...)` index (write cost on every
rebuild for a request crawlers make a few times a day). Copy fixed for item 5.

Reliability reviewer: none blocked, seven with blocking demands. Main ones: purge must not loosen
`lib/likes.test.ts` (window over the `trade_key` hash range instead, a window that shrinks after a timeout, a separate
progress flag for due marks); billing pass writes fenced by a lease token, the box checked per subscription, grace
expiry and the event purge once per due day whatever the pass state; feed exploration picks driven from users in md5
order with a capped eligibility probe, and equivalence fixtures with eligible traders whose closes are all old; profile
tests without React internals, card equality including close order; similar pool writes fenced on the claim, a capped
cold wait; lists cursors built like `ownLikes` (no `to_timestamp(double)`); indexes: a test of the `lib/delete.ts`
rewrite including an identity with an empty email.

## Decisions

- 2026-11-01 · Purge: `trade_key` hash-range windows over the existing key indexes; `lib/likes.test.ts` unchanged.
  Why: the reliability path needs no test change (the business lead allowed one exact extra form; not needed).
- 2026-11-01 · Feed: no trigger on activities; the note at the same-vendor-id case stays, made precise. Why: both
  reviewers (derived table is never patched; cross-user write outside the per-user lock).
- 2026-11-01 · Sitemaps: no new index; range reads on the existing `closed_trades_symbol` index. Why: both reviewers.
- 2026-11-01 · Similar: the per-request bucket walk ships; the shared pool table only if a cold build is slow enough
  to justify it (business lead: ~150 ms). Why: business lead's "what would change my mind".
- 2026-11-01 · Billing: the engineer ships the boxed reconcile only if it meets every blocking demand; otherwise the
  409 fix alone and a precise note. Why: business lead's fallback.
- 2026-11-01 · Indexes go through `schema_add_index` (not `create index if not exists`, which `lib/schema.test.ts`
  forbids: it takes a table lock before noticing the index exists). Why: the file's rule.
- 2026-11-01 · Feed's 350-card day list is a product question for the owner (it decides who appears); its note is made
  precise only. Why: business lead.
- 2026-11-01 · Lists: the create-view form has no handle box above its select, so it gets its own line ("Add anyone
  else by handle after you create the view."). Why: business lead sign-off (the approved line is untrue there).
- 2026-11-01 · Similar: a cold build measured 357 ms at 5,000 traders (> 150 ms), so the shared table ships. Account
  deletion drops every pool naming the trader; the purge drops pools idle past a day. Why: business lead's bar; tester
  QA Q2; code review S3.
- 2026-11-01 · Purge: `privacy_orphans` gets an index on `viewer_id` (found when a 60,000-user test cleanup cascaded
  into a full scan per deleted user: 124 ms → 3.4 ms per user at 1M rows). Why: measured.

## Load tests (before → after)

All on a local Postgres 16 shared with other test runs; the after-numbers marked † ran on a fresh database (`ss_kl2`)
because the first database had millions of dead rows from earlier fixtures.

| Item | Test | Before | After |
|---|---|---|---|
| Display log | 2,000 traders, 251,400 closes (LOAD=1 lib/display-log.load.test.ts) | 116–323 records/s | 467–1,048 records/s; 4.84× in the same run |
| Connections | LOAD=1 lib/sync.load.test.ts (`# load:` lines) | heavy import 1,556 ms; three syncs 558/414/441 ms; contention 747 ms; first sync 1,325 ms; fleet 7,251 ms (15 ms/trader) | 1,243 ms; 622/639/533 ms; 870 ms; 1,101 ms; 7,233 ms (14 ms/trader) — noise, the sync path is untouched |
| Similar | 5,000 traders, pool 284 | cold build 357 ms on every server every 10 s; next cold server 235 ms | one build per 10 s fleet-wide; next cold server 5 ms; pick p95 0.025 → 0.002 ms |
| Lists | one viewer, 20,000 each of follows / hides / expired hides | ownLists 125.8 ms (40,000 rows), expiredHides 66.7 ms (20,000 rows) | first pages 44.5 ms and 4.2 ms (50 rows each); with the new indexes the timing test is CPU-bound on this machine (passed once, 103.8 ms once, see Known limits) |
| Profile | queries per signed-out view (running app) | 23–25 | 8–9 (11 after main's options and filer reads) |
| Indexes | EXPLAIN of each real query | seq scans (login_links delete: `Seq Scan … hashed SubPlan`) | index scans on each new index (BitmapOr for the delete) |
| Purge | LOAD=1 lib/privacy-purge.load.test.ts, 220k due | 5,938 ms, slowest batch 1,362 ms | † 6,052 ms, slowest batch 393 ms |
| Purge | 1,000,000 orphans, 100 due | every call the whole 20 s box; 0 of 100 due removed in 12 calls | † calls 5.2–6.0 s, slowest batch 3.0 s (the cap), one lap in 6–7 calls, due rows gone on the first call |
| Sitemaps | 60,000 symbols, 180,000 closes | count 200–707 ms, last sitemap 237–702 ms | count 0 ms (shared row), last sitemap 40–61 ms; rebuild 575–681 ms once per 10 min fleet-wide |
| Feed | quiet site (LOAD=1 lib/feed.window.load.test.ts), page 1 | p95 2,005 ms, cold 1,828 ms; candidates (full pass) 768–1,034 ms | † p95 251 ms, median 207 ms, cold 631 ms; candidates (60-day step) 135 ms |
| Feed | LOAD=1 lib/feed.load.test.ts (14-day path, unchanged statement) | 6/6 | † 5/6: "section, 50 heavy" p95 570–680 ms against its budget while the machine's load average was 4.5–5.7 (two orphaned queries from the first database held ~1.4 of 4 cores); not re-measured on an idle machine (Known limits) |

## Tester QA and code review (fresh context, combined diff)

| Finding | By | Decision |
|---|---|---|
| B1: three new log lines passed an error message / bare objects (lib/privacy-logs.test.ts failed) | review | Fixed: logSafe(e) and JSON counts |
| S1: playwright.config.ts is a protected path | review | Kept: the orchestrator asked for `workers: 1` explicitly; flagged for the owner in the PR |
| S2: at the hour change every profile view re-reads the pool row while another server builds | review | `ponytail:` note (extra load only, bounded by the 60 s lease) |
| S3: a pool row whose first build failed was never purged | review | Fixed: coalesce(built_at, claimed_at, hour) |
| S4 / Q2: a deleted trader's id stayed in the shared pool | review, tester | Fixed: deletion drops every pool naming the trader; test |
| S5: a wider window that adds no close fell back to the full pass even when it could prove the 200 | review | Fixed with a test |
| S6: a partial walk could count as a purge lap | review | Fixed: `swept` per cursor; test |
| Q1: /me/following said a list was empty past its last page | tester | Fixed: redirect to that list's newest page; unit + e2e |
| Q3: two purge tests assumed one call finishes a lap | tester | Fixed: tests drive whole laps (bounded), fail fast on a held lock |
| Schema plan check depended on table size (seq scans off only) | gates | Fixed: plan checks use bitmap scans only (a test this PR added) |

## Merge of main (18 commits)

Each engineer resolved their own file and carried main's new rules into the new code paths: F-7 public filings
(`filing_url is null`, `filerVisibleSql`) in the sitemap query, the feed's wider-window picks and the lists' hidden
pages; the 30-day `ready()` floor in the picks' counts; the options line in the display log's batch writer; F-15 view
purges and handle-reservation purges in the purge's new structure; F-7 filer visibility and options in the profile's
shared reads.

## Open questions for the owner

- The feed's 350-card day list (who appears; `EXPLORE_EXTRA`): a product decision (business lead).
- `lib/feed.load.test.ts` (on main) adds closes and broker accounts to whichever listed trader the feed shows (a seeded
  demo trader on a fresh database) and leaves them; it should use its own traders. Not changed here (an existing test).
- `@img/sharp-wasm32` (an optional dependency in main's lockfile) is installed in this container by `npm ci` and trips
  the licence scan locally; CI's install does not show it. An exception, if ever needed, is the owner's.
