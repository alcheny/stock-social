# F-24 implementation plan, round 2 (committee synthesis, 2026-11-01)

Round 1 (UX lead's draft) and the three round-1 reviews are summarized in `committee-2026-11-01.md`. This round folds
every demand in, settles the conflicts between reviewers, and is what the build follows. It decides how; it changes no
decision in the feature file (D1–D7).

## 1. Data model (append-only, idempotent; no volatile default, no table rewrite)

`broker_accounts` (the per-account cursor, written only inside the sync transaction, so a rollback never advances it):
- `reconcile_due_at timestamptz` — when the next pass may start. **Null = stagger in code**: due on the account's own
  weekday, `hashtext(account_id) mod 7 = day number of the database clock mod 7` (reliability 10: no volatile default,
  which would rewrite the table under an exclusive lock at deploy).
- `reconcile_offset int` — next page offset; null = no pass running.
- `reconcile_page_at timestamptz` — last page read (pacing), stamped with the same `clock_timestamp()` stamp as F-14.
- `reconcile_started_at timestamptz`, `reconcile_pages int`, `reconcile_expect int` — the pass's start, pages read, and
  the stored listable count at its start (completeness and the end bound, §3).
- `reconcile_tail text[]` — the previous page's last 50 ids (the overlap check, §3).
- `reconcile_seen text[]` — ids a multi-page pass has listed so far (engineer 1: a column, no table, no `delete`;
  cleared with `update … set reconcile_seen = null` when the pass ends or restarts). A one-page pass writes nothing.

New table `activity_reissues (user_id → users on delete cascade, source, external_id, account_id, original_id,
state in ('pending','genuine','suspected'), found_at, decided_at, primary key (source, external_id))` (reliability 6).
Rows change state by `update`, never by delete.

`users.closes_rewritten int not null default 0` — the owner-visible count (D4). `record_rewrites` is dropped (engineer 9):
D4 asks for a log entry and a count; the log line carries the ids-and-counts entry.

`sync_read_marks.reconcile_failures int not null default 0` — written after the transaction like F-14's marks
(reliability 3).

Privacy maps: `activity_reissues` in SCHEMA_MAP (personal, account); new columns are not public (no privacy-fields
change; the `broker_accounts` columns hold vendor activity ids → noted in the `broker_accounts` holds text).

## 2. Re-issue rule (D5)

- **Twin.** Two `activities` rows of one user, same `account_id, symbol, side, executed_at, units, price`, different
  `external_id`, both from the activities read (`raw->>'type' in ('BUY','SELL')`; share-move rows such as REI are never
  listed by that read, reliability 2 / engineer 4). The newer row (higher `activities.id`) is N, the older E.
- **Detection on every insert path** (engineer 4): one SQL statement after the inserts in syncUser's transaction (both
  cadence and non-cadence paths, every branch: week read, `!last` full read, backfill page, reconcile page) finds rows
  inserted by this transaction (`created_at = now()`, the transaction's start) that have an older twin, and inserts
  them into `activity_reissues` as `pending` (`on conflict do nothing`). Pending rows are held from the record at once:
  never shown twice.
- **Genuine, never suspected, from a partial read** (business 1, engineer 3): any read that listed both N and E marks N
  `genuine` (a week read only when N's date is at least `since` + 1 day, off the time-zone boundary). A pending row the
  week read cannot clear brings the account's next pass forward (`reconcile_due_at = now`, unless a pass is running).
- **Suspected only from a complete pass** (D5's "full read"): at a valid pass end (§3), each pending N of the account
  whose E is not in the pass's listing becomes `suspected`; listed → `genuine`. An invalid pass decides nothing.
- **Genuine is final within F-24.** An original that later disappears is a vendor cancel or correction (C3-9b, owner
  Q3), out of scope. So no shown close is ever pulled by this rule (reliability 1's single-pass demotion cannot happen:
  pending → suspected changes nothing visible, both are held). `suspected` → `genuine` if a later read lists both.
- **Twins stored before F-24 are not swept** (reliability 1): they stay as published. Ponytail.
- **Rebuild exclusion** as one fragment (engineer 5) applied in `rebuildTrades`' page query, the chain query and the
  future count: `not exists (select 1 from activity_reissues r where r.source = a.source and r.external_id =
  a.external_id and r.state <> 'genuine')`.
- **Options** (engineer 10a): option twins are counted in the log line (`optionTwins`), not held. Not silent (D5);
  ponytail; owner item.

## 3. The pass (cadence only; inside F-14's budget)

- **Budget:** a reconcile page replaces that account's daily week read (only accounts in `actIds`, so only `real`:
  consented, not frozen, not paper). Requests per account per day unchanged; `dueRequestsSql` unchanged.
- **Code path** (engineer 7): reconcile-due accounts join the existing option-backfill page loop (backfill wins), so
  corporate-action and option inserts, `pagedIds` and the metered `paged` count come for free.
- **Start:** due (`reconcile_due_at <= t`, or null and its hash weekday) and no pass running → offset 0,
  `reconcile_started_at = t`, `reconcile_expect` = stored listable rows of the account.
- **Pacing:** later pages only when `reconcile_page_at <= t − 47 h` (reliability 9), so page, week, page, week.
- **Overlap** (business 2): each later page starts 50 rows back (`offset += limit − 50`) and must list all of
  `reconcile_tail`; if not, the pass is invalid.
- **End:** a page returning `done`. Valid only if no overlap break and `|listed ids| >= reconcile_expect`
  (reliability 1). Then decide pending rows (§2), set `reconcile_due_at = t + 7 d`, clear offset/seen/tail. An invalid
  pass decides nothing and is restarted next period.
- **Bound** (reliability 4): `reconcile_pages > ceil(expect / (limit − 50)) + 2` → abandoned (invalid), restarted
  next period.
- **Restart** (reliability 5): a pass started before the account's latest consent or claim is restarted at 0.
- **Failure** (reliability 3): after a failed sync (not a `RouteDeadlineError` cut) the accounts that were to read a
  reconcile page get `reconcile_failures + 1` (outside the transaction); a success resets it. At 2 the pass is
  abandoned (offset null, due + 7 d, logged) and the week is read instead.
- **One-page pass** (page 0 returns `done`): a superset of the week read, so it counts as the week read (left out of
  `pagedIds`), decides in memory. Any other page joins `pagedIds`: positions-only rule (TR-4) and `last_synced_at`
  keeps its value (F-14's `midBackfill`; `recent_read_at` dropped, engineer 6; ponytail: up to a day of skew).
- **Full reads restart the clock** (engineer 8): the `!last` full read and the backfill's last page set
  `reconcile_due_at = t + 7 d`. The connect-time import: ponytail (its next pass falls within 7 days, one page for most).

## 4. Close-change log and count (D4: every rebuild)

Inside `rebuildRecord` (business 3, reliability 7, engineer 9), so every caller is covered: before and after, one
query each for `array_agg(sell_id)` / `array_agg(md5((account_id, symbol, opened_at, closed_at, return_pct,
holding_days, verified)::text))` over `closed_trades`, and the same over `option_trades` by `close_id`. Changed = same
id, hash `is distinct from`; removed = id gone; added = new id. When changed + removed > 0: `users.closes_rewritten +=
changed + removed` and `console.log('sync closes rewritten', id, JSON.stringify({ changed, removed, added }))`
(engineer 2: `user` is a forbidden key). Theses stay out of the hash. Load: the `LOAD=1` sync load test measures it.
Ponytail: no gate (business wants every rebuild; reliability 8's gate is left as the fix if the load test shows cost).

Re-issue line per sync when any state changed: `console.log('sync reissues', id, JSON.stringify({ found, cleared,
pending, suspected, optionTwins }))`. docs/SYNC.md carries the owner queries (rewrites, pending, suspected per user).

## 5. Visible outcome: none

A found close renders like any close (profile, trade page, feed/swipe card, share card). No new string. Thesis stays by
`sell_id`. "Updated" moves only with week reads (or a one-page pass). The round-1 before/after table stands.

## 6. Tests (first)

| AC | Test | Asserts |
|---|---|---|
| AC1 | `lib/sync-reconcile.db.test.ts` (vendor fake over HTTP via an in-process broker using its paged endpoint) | A SELL (a loss) dated 10 days before the newest stored trade is missed by the week read, lands in `closed_trades` after the pass, counts in stats and the signed-out profile; a second pass inserts 0 rows. |
| AC2 | same | `activities` snapshot (all columns, `xmin`) identical before/after for every prior row; only new rows added. |
| AC3 | same | 7 days × 24 rounds with F-24 on vs off: identical vendor activities-endpoint counts per account (≤ 1/24 h); a 3-page pass: offset null → (limit − 50) → 2 × (limit − 50) → null, a week read between pages; a rolled-back page day and a `RouteDeadlineError` cut leave the cursor and marks unchanged. |
| AC4 | same | frozen, unlisted, paper and unconsented accounts with a due pass: 0 page calls over a week. |
| AC5 | `lib/sync-reconcile.log.test.ts` | a late BUY re-prices a shown close: `changed = 1`, `closes_rewritten` + 1, exact log shape; a paper flip removes closes: `removed`; an add-only rebuild writes nothing; non-cadence path covered. |
| AC6 | `lib/sync-reconcile.reissue.test.ts` | re-issue (E absent from a complete pass) → suspected, one close; genuine (both listed) → two closes; boundary (E page 1, N page 2) → genuine; week read → held, never shown twice; overlap break → no decision. |
| AC7 | `lib/sync-reconcile.copy.test.ts` + `e2e/f24-found-close.spec.ts` (360 px) | no "late/corrected/new" wording on the trade row, trade page and feed card of a found close; the thesis stays attached. |
| F-14 | existing + tr4 addition | a page day takes the positions-only rule and keeps `last_synced_at`. |

## 7. Known limits (ponytails)
Pass length ~2k days for k pages (≈ 20 days at 10 pages); pre-F-24 twins not swept; option twins counted not held;
genuine is final (cancels are Q3); one day of "Updated" skew across accounts on page days; connect-time import does not
stamp the clock; the diff is not gated.

## 8. Owner items
No `lib/broker.ts` edit, no dependency, vendor or secret. Confirm: held (pending/suspected) rows are counted for the
owner only; a held genuine fill can be absent until its pass decides it (D5's trade-off against double publishing).
CLAUDE.md sync text (protected) should mention the weekly full read.

## Round 3 changes (supersede the round-2 text where they differ)

1. **Completeness is a set check, not a count** (engineer r2-1, reliability r2-1). A pass that ended (`done`) is
   complete when every `snaptrade` activities row of the account stored before `reconcile_started_at` with
   `raw->>'type'` BUY or SELL is in the pass's listing (seen ids ∪ the last page ∪ the ids the read returned as unusable
   trade rows), except the originals of the account's held (`pending`/`suspected`) rows, which are what is being tested.
   Rows that arrive during the pass cannot mask a skipped row. `reconcile_expect` stays only for the page bound.
2. **A stable shortfall decides** (business r2-1). The missing ids are kept (`broker_accounts.reconcile_missing text[]`).
   A pass without an overlap break whose missing ids are all among the previous pass's missing ids decides too (a
   stored row the vendor no longer lists, a cancel: owner Q3), so an account is not undecided forever.
3. **Invalid passes are visible** (reliability r2-5, business r2-1): `broker_accounts.reconcile_invalid` counts passes
   in a row that ended invalid or were abandoned (reset by a deciding pass); every one logs
   `console.log('sync reconcile invalid', id, JSON.stringify({ reason }))` with reason `shifted | missing | bound |
   failures`; docs/SYNC.md's owner queries list invalid counts and the oldest pending row's age. Ponytail + owner item:
   in an account whose passes never validate, a held row (possibly a genuine fill) stays held and counted.
4. **Twins only against rows stored before this transaction** (engineer r2-3, business r2-2): `e.created_at < now()`.
   Rows that arrive together were listed by the same read and are never held, not even for one sync.
5. **Detection in `importStep` too** (reliability r2-4): after its inserts, the same statement (lib/connections.ts).
6. **Stagger** (engineer r2-2, reliability r2-2): a null due date is written once, by the first sync that plans it, as
   the next occurrence of the account's weekday (`((hashtext(account_id) % 7) + 7) % 7`), never before
   `claimed_at + 7 d`; from then on it compares normally (no missed days).
7. **Failure counter** (engineer r2-5, reliability r2-3): incremented, after the transaction, only for accounts whose
   reconcile page step (its fetch, inserts or record) threw a non-transient error (`classify` in lib/sync-limits.ts) and
   not on a `RouteDeadlineError` cut; reset on success and when a pass is abandoned. AC3's "marks unchanged after a
   rollback" excludes this column.
8. **Log shapes** (engineer r2-4): `const id = userId` before every line; shapes pinned in AC5's test.
9. **`reconcile_valid boolean`** (the overlap-break flag of the running pass) is in the data model.
10. **Options, explicit** (business r2-4): AC6 is built for share rows; a re-issued option row is counted
    (`optionTwins` in the `sync reissues` line), not held, so a re-issued option close can show twice until the owner
    decides. Owner item.
11. **Retention** (business r2-5): an account that leaves `real` mid-pass has its pass state and listed ids cleared in the
    same sync (AC4 asserts it).
12. **Loss assertions** (business r2-3): AC1's late losing close ranks in the feed by `abs(return_pct)`; AC6's genuine
    losing fill held across pages is back in `closed_trades` and the stats after the deciding pass.
13. **Unstable order test** (reliability r2-5): same-instant rows in a different order between calls → the pass is
    invalid (`shifted`) and decides nothing.
14. **Item 7, exactly** (reliability r3-1): every error thrown inside the page step counts, code errors such as a
    `TypeError` included, except vendor or database outage classes (429, 5xx, vendor timeout, transport and
    database-wide codes) and `RouteDeadlineError` (`pageFailureCounts` in lib/reconcile.ts, not `classify`, which treats
    code errors as transient). AC3 adds a page that always throws a `TypeError`: abandoned after 2, reason `failures`,
    the week read resumes.
15. **Item 11 limit** (engineer r3-3): a trader whose every connection is frozen is never synced (`syncable()`), so a
    pass left running there is not cleared; it holds only vendor ids the `activities` table already keeps. Ponytail.
