# F-24 implementation plan, round 1 (UX lead, 2026-11-01)

Feature file: `docs/features/F-24-late-sell-reconciliation.md` (decisions D1-D7, AC1-AC7). Brief: `brief.md`. Base:
`main` at 44a134b (F-14 #64 merged). This plan decides how; it changes no decision. Where it departs from the
orchestrator's sketch it says so and why.

## 1. Data model (additive, idempotent, no `drop`/`truncate`/`delete from` in `db/schema.sql`)

| Object | Purpose |
|---|---|
| `broker_accounts.reconcile_due_at timestamptz default now() + random() * interval '7 days'` | When the next full-history pass may start. The volatile default is evaluated per existing row once, when `schema_add_column` adds the column, so a deploy spreads first passes over 7 days (§2.5) with no `update` statement; new accounts get it too. Null means "due now" (F-14 rule: a null never freezes a read). |
| `broker_accounts.reconcile_offset int` | Next page offset; null = no pass in progress. |
| `broker_accounts.reconcile_page_at timestamptz` | Last history page read (pacing, §2.3). |
| `broker_accounts.recent_read_at timestamptz` | Last read that covered the recent week (week read, whole-history read, or a one-page pass that returned `done`). Backfilled once from `activities_read_at` where null. See §3. |
| table `reconcile_listed (user_id, account_id, external_id, primary key (account_id, external_id))` | Ids the current pass has listed, so the re-issue check is exact across pages (§4). Emptied for the account when its pass completes. Never public. |
| table `activity_reissues (user_id, account_id, external_id, original_id, state check in ('pending','genuine','suspected'), decided_at, primary key (external_id))` | Possible re-issues (§4). Activities stay raw: no flag column on `activities`. |
| table `record_rewrites (id identity, user_id, at, changed int, removed int, added int, sell_ids text[])` | The per-user close-change log (§5). One row per rebuild that changed or removed a shown close. |
| `users.closes_rewritten int not null default 0` | The owner-visible count (§5). Shown nowhere in the product. |

All tables cascade on `users` delete (whole-profile deletion, P6). The code that removes `reconcile_listed` rows at
pass end lives in `lib/sync.ts`, not in the schema file.

## 2. Sync flow and budget (inside F-14, `opts.cadence` only)

1. **Where.** Txn 2 of `syncUser`, in the windowed branch, next to the option backfill. The non-cadence path
   (`syncTick`, `/connect/done`) is unchanged. Only accounts in `actIds` (due today under F-14, so already inside
   `real`: consented, not frozen, not paper) are candidates. Disconnected, frozen, paper and unconsented accounts are
   never in `actIds`, so they are never read (AC4).
2. **Budget.** A reconcile page REPLACES that account's daily week read: one `fetchActivitiesPage(bu, id, offset,
   limit, sink)` call in place of one `fetchActivities` call. Requests per account per day stay 3, `dueRequestsSql`
   and `SYNC_REQUESTS_PER_ACCOUNT` are unchanged, and the metered broker's `paged` set already counts the page as the
   account's one activities read. The cap is one page (`pageLimit`, 1,000 rows) per account per run; the offset
   persists in `reconcile_offset`, so a capped pass resumes next due read (AC3). An account owed the option backfill
   reads that instead (the backfill page wins; its whole-history read also covers the reconciliation, so on its
   last page set `reconcile_due_at = now() + 7 d`).
3. **Pacing (position: alternate).** Page 0 is read on the first due read on or after `reconcile_due_at`. Later pages
   of the same pass are read only if `reconcile_page_at` is at least 48 h old, so day by day an account goes page,
   week, page, week. Its recent trades wait at most one extra day; a pass of k pages takes about 2k days. Most
   accounts have one page, which is a complete read (point 4), so for them nothing waits at all.
4. **A one-page pass.** Page 0 returning `done` lists the whole history, a superset of the week read. It counts as
   that account's week read: combined positions rule, `recent_read_at` stamped, pass complete.
5. **Staggering (position: yes).** Without it, every existing account's first pass falls on its first due read after
   deploy. That is not a request spike (a page replaces a read), but for multi-page accounts it would take every
   account's week read away on the same day and move every "Updated" line together. The random default spreads them
   over 7 days at no cost.
6. **Period (position: 7 days).** It matches the 7-day re-read window, so a row posted late lands within about a week
   plus one day. Costs zero extra requests per account (page replaces week). Constant `RECONCILE_EVERY_MS` in
   `lib/sync-cadence.ts`, next to F-14's constants. At pass completion: `reconcile_due_at = clock + 7 d`,
   `reconcile_offset = null`.
7. **Insert path unchanged.** `insertActivities` keeps `on conflict (source, external_id) do nothing`. To know which
   ids were new, the reconcile branch first selects which listed ids already exist (one `= any(...)` query per page)
   instead of changing the insert's shape. Results reach `closed_trades` only via the existing `rebuild` call.
8. **Load.** The engineer attaches the `LOAD=1 node --expose-gc --test lib/sync.load.test.ts` run (interim rule).

## 3. TR-4 and "Updated" semantics

- A reconcile page that is not a complete one-page pass is a history page. Its account id joins `pagedIds`, so its
  positions take the positions-only rule (added and updated, never removed). A position closed at a loss stays
  listed until the week read that publishes its close (TR-4), as for the option backfill.
- `activities_read_at` is stamped on a page read (it is F-14's daily gate). Because of that it can no longer stand for
  "recent trades were read". **Departure from the sketch:** `last_synced_at` becomes the oldest real account's
  `recent_read_at`, not `activities_read_at`. The sketch kept the previous value on page days. With pacing that would
  still mix in a page-day stamp on the next sync of another account, and an "Updated" line would claim a week read
  that never happened. With `recent_read_at`, "Updated" keeps meaning the last successful read of recent activity
  (D6). F-14's existing hold while an option backfill is pending stays as it is.
- Nothing on screen changes because of a pass. "Updated" moves only with real week reads.

## 4. Re-issue rule (D5)

Twin key: `(account_id, symbol, side, executed_at, units, price)`, source `snaptrade`. A row N is a candidate re-issue
when it was newly inserted and an already stored row E with a different id has the same twin key.

- **Who can decide.** A read decides only the rows whose time it fully covers. **Departure from the sketch ("only the
  reconcile read can tell"):** a week read lists everything from `since` onward, and N and E share a time. So a week
  read that inserts N decides on the spot: E listed too means `genuine`, E absent means `suspected`. This matters
  because a re-issue of a recent fill arrives through the week read and would otherwise be published twice for up to 7
  days.
- **Reconcile pass.** Each page writes its listed ids to `reconcile_listed` and records candidates as `pending`. At
  pass completion, one query decides every `pending` row (E listed in the pass means `genuine`, otherwise
  `suspected`). It also checks every stored twin group in the account, including pairs stored before F-24: a member
  inserted later whose earlier twin is absent from the listing is `suspected`. Then the account's `reconcile_listed`
  rows are removed.
- **Boundary gap (position: persist the listed ids, no ponytail).** With the pass's ids on disk, E on an earlier page
  than N is decided correctly. The cost is one insert of up to 1,000 small rows per page (at most one page per account
  a day), kept only while the pass runs. The alternative ponytail would exclude genuine identical fills split across
  a page boundary from a Verified record, which goes against "two genuine identical fills must both survive" (D5).
- **Rebuild.** The rebuild's activity read (`lib/sync.ts`, the `from activities a where ...` page query) adds `and not
  exists (select 1 from activity_reissues r where r.external_id = a.external_id and r.state in ('pending','suspected'))`.
  E stays published and N is held, so the close is never shown twice. A later full read that lists both turns N
  `genuine`. The pass re-decides every row on each run.
- **Option rows.** The same rule applies to `option_activities` on `(account_id, contract_key, kind, open_close,
  executed_at, units, price)` if those columns exist there as named; otherwise a ponytail (§9).
- **Count.** Owner-visible count = `select count(*) from activity_reissues where state = 'suspected'` per user (DB
  query). No product surface: out of scope.

## 5. Close-change log and owner count (D4)

- Around `rebuild(user.id, tx)` under cadence: before the rebuild, read `array_agg(sell_id)` and
  `array_agg(md5(account_id||symbol||opened_at||closed_at||return_pct||holding_days||verified))` from `closed_trades`,
  plus the same over `option_trades` (`close_id`). After it, compare in one SQL statement against `unnest` of those two
  arrays. `changed` = same id with a different hash, `removed` = id gone, `added` = new id. **Departure from the
  sketch:** two array parameters instead of a temp table. A temp table per sync means about 100k create/drop a
  round, which bloats the system catalog; the arrays are 2 bind parameters, far under the 65,534 limit.
- **Option closes (position: included).** An option close the vendor's late rows rewrite is just as shown and just as
  public. The option close is rebuilt in the same `rebuildRecord`, so leaving it out would be a silent rewrite (D4).
- When `changed + removed > 0`: insert one `record_rewrites` row (user id, counts, the affected sell/close ids: ids
  only, no figures, no raw payloads) and `users.closes_rewritten += changed + removed`, in txn 2 so a rollback writes
  neither. Console line `sync closes rewritten {user, changed, removed, added}`: internal user id and counts only (no
  account ids, P6), added to docs/SYNC.md's log table. A rebuild that only adds closes writes nothing.
- A thesis on a changed close stays attached by `sell_id` (existing `reattachTheses`). A thesis on a removed close goes
  to `kept_theses` (existing behavior) and comes back if the close returns.

## 6. Copy and visible outcome: no visible change

A found close renders through the same components as every other close. There is no new string, badge, color, animation
or notification (F3b: records are looked up, not broadcast).

| At 360 px | Before a late close is found | After |
|---|---|---|
| Viewer, profile `/u/<handle>` (signed out) | Headline win rate, avg return with interval, CH-1 chart, open positions ("Open: n positions · x% unrealized", sold position still listed if its close was missing), closes list, "Updated <date>", disclaimer | The same layout. The close appears in its date order in the list and as a dot on the chart, the stats and interval include it, and the open position it closed leaves on the same read (TR-4). "Updated" shows the last week read, not the pass. No "late", "corrected", "new" or "updated" wording on the row. |
| Viewer, feed card / swipe (SW-1), share card | Ranked by the documented method | The close ranks by `abs(return_pct)` like any other, losses included. No special marker. |
| Trader, own profile | Same as the viewer, plus thesis forms | Same. The found close gets an empty thesis form like any close. A thesis already written for that `sell_id` stays attached. No notice that anything changed (owner question for later, out of scope). |
| Earlier-position exclusion | "n positions excluded (no recorded entry)" counted | When a late BUY is found, the count drops and the close appears. Nothing announces it. |

"New record" (TR-7) is an existing badge about record age. It is not about trades and is untouched. The copy test (AC7)
targets the trade row and the trade page.

## 7. Test plan (tests first; total count rises)

| AC | Test file | Asserts |
|---|---|---|
| AC1 | `lib/sync-reconcile.db.test.ts` (vendor fake `e2e/fakes/vendor.ts`, cadence, clock shift) | Seed history, then add a SELL dated 10 days before the newest stored trade; advance to `reconcile_due_at`; after the pass the sell is in `closed_trades`; a second pass inserts 0 rows (row counts equal). Plus: a multi-page history with the SELL on page 3 lands after 3 page days, with week days between them (pacing). |
| AC2 | same file | A snapshot of `activities` (all columns, `raw` included, and `xmin`) before and after the pass. Every row before is byte-identical after (no update) and still present (no delete); after minus before = only the late rows. |
| AC3 | same file + `lib/sync-shard.test.ts` addition | Per-account `/_stats` counts over 24 hourly rounds: at most 1 activities-endpoint call per account per 24 h, whether page or week, and 3 requests per account per day. Capped at 1 page, `reconcile_offset` goes 0 → 1000 → 2000 → null across runs and resumes after a rolled-back sync without advancing. The metered broker's request count equals `dueRequestsSql`. |
| AC4 | same file | A frozen connection (`disconnected_at`), a paper account and an unconsented account each have `reconcile_due_at` in the past. `/_stats` shows 0 page calls for them across a week of rounds. |
| AC5 | `lib/sync-reconcile.log.test.ts` | A late BUY that re-prices an already shown close: exactly one `record_rewrites` row (changed = 1), `closes_rewritten` = 1, the captured console line holds only `user, changed, removed, added` (no account id, figure or payload, checked with `lib/privacy-logs.test.ts` patterns). A pass that only adds a close writes no row. An option close gets the same treatment. |
| AC6 | `lib/sync-reconcile.reissue.test.ts` | (a) Re-issue: the vendor lists N (same twin key) and no longer lists E → N `suspected`, one close published, count 1. (b) Genuine: the vendor lists both ids → both kept, two closes. (c) Boundary: E on page 1 and N on page 2 → `genuine`. (d) Week read: a recent re-issue is decided in the same sync, so the close is never shown twice. |
| AC7 | `e2e/f24-found-close.spec.ts` (360 px, signed out and signed in) | After a reconciled close: the trade row and `/u/<h>/trade/<sellId>` contain none of /\blate\b\|corrected\|\bnew\b/i (row scope, outside the TR-7 badge). A thesis saved on that `sell_id` before a rebuild that re-prices it is still shown. The disclaimer is present. No horizontal scroll at 360 px. |
| F-14 regressions | existing `lib/sync-cadence*.test.ts` | Unchanged and passing. Added to `sync-cadence.tr4.test.ts`: a history-page day takes the positions-only rule, and "Updated" (`last_synced_at`) does not move on a page day. |

## 8. Privacy map and compliance (§1 checklist)

- `lib/privacy-retention.ts` SCHEMA_MAP:
  - `reconcile_listed`: personal, retention `account`, holds "vendor activity ids listed during a pass, removed at pass end";
  - `activity_reissues`: personal, retention `account`, holds "vendor activity ids suspected as re-issues";
  - `record_rewrites`: personal, retention `account`, holds "ids and counts of rewritten closes".
- `lib/privacy-fields.ts`: add `reconcile_listed.account_id` and `activity_reissues.account_id` to the "account numbers"
  entry. The new columns are not public, so there is no new public field.
- Checklist: 1 yes (it changes which closes are shown; no new wording, losses are treated the same, the disclaimer is
  unchanged); 2 yes (the three tables above, never shown, deleted with the profile); 3-7 no; 8 no UI; 9 no; 10-11 no.

## 9. Docs and known limits

- `docs/SYNC.md`: a new "Late postings (F-24)" section (period, pacing, stagger, re-issue rule, the log line).
  `docs/features/F-24-*.md` Build log.
- CLAUDE.md "re-reads the last 7 days" and the DESIGN text are protected paths. They go to the owner as a note, not as
  edits.
- Ponytails:
  - A pass needs about 2k days for a k-page history, so a late row deep in a large history waits up to about 2k + 7
    days. Fix: the vendor's written answer (MR-1) on history pages.
  - A row the vendor re-dates or re-prices under the same id is never seen (C3-9b, owner Q3).
  - Option-row twin key, if `option_activities` lacks a column (§4).

## 10. Pre-authorization requests (owner)

1. None needed for `lib/broker.ts`. `fetchActivitiesPage` is used as it is (D2). If the engineer finds it must change,
   the build stops for the owner.
2. No new dependency, vendor, secret or env var. `RECONCILE_EVERY_MS` is a code constant.
3. Confirm the D5 reading: a `suspected` row is held from the record and counted for the owner only. There is no
   public mention, which is out of scope until the owner decides.
4. Note for the owner: CLAUDE.md "Sync paths" text (protected) should mention the weekly full-history pass.
