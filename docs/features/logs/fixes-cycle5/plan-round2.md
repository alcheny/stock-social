# Fixes cycle 5: implementation plan, round 2 (UX lead)

Source: `docs/direction/cycle5-2026-11-01.md` section 5. Scope: F5-2 and F5-4..F5-27; F5-1 and F5-3 are on the ballot.
This revises `plan-round1.md` in full; round 1 is kept as the record. The branch `claude/fixes-cycle5` now contains #84
(F-24, bdf3ea9b); every `path:line` below was re-read on 4041c6c9.

Round 1 got two objections (business lead, engineer). Section 1 answers every demand. Open conflicts are decided by
the committee's recommended option, marked "Why: decided by the committee under the owner's instruction of 2026-11-01".

## 0. Rules for the build

- **Built now, on main.** Every item is built now on main, except F5-14 (section 3). Nothing waits for #100 (f16), f25
  or #97 (f23). Where an in-flight branch edits the same line, take one of two shapes:
  - **copy its hunk byte-for-byte**, so git sees one identical change;
  - **or keep our edit to the smallest line set** and list the expected conflict and its resolution (section 5).
- **Markers.** Every edit is marked `FIXES-CYCLE5`. All new copy lands at once as one `FC5` object at the end of
  `lib/copy.ts`, in WP0.
- **Tests.** New tests are `lib/fixes-cycle5-*.test.ts` (`.db` / `.load`) and `e2e/fixes-cycle5-*.spec.ts`. An existing
  test is edited only where section 4 lists it, and only as an equal-strength or stronger replacement.
- **No wall-clock bounds.** Performance is proven by EXPLAIN rows read and plan shape, by build counters, or by
  `NOWAIT` / `lock_timeout` probes.
- No protected file is touched (section 6).

## 1. Demand register

### Orchestrator

| # | Demand | Answer |
|---|---|---|
| O1 | Build everything now on main, except F5-14 | **Adopted.** Batches are replaced by the WPs. Expected conflicts with unmerged branches are listed with their resolutions (section 5) |
| O2 | Adopt the engineer's WP0..WP4 | **Adopted** (section 2). The item lists are my reading of his split. Where his own list differs, his wins and the plan follows it |
| O3 | F5-5: ceil the asOf to the bucket end, on by default | **Rejected; floor kept, and on by default in production** (F5-5). Why: decided by the committee under the owner's instruction of 2026-11-01. The council chose a 60 s floor on the database clock. The candidate query filters `importedBy(sell_imported_at, asOf)` (`lib/feed.ts:217`), so a floored key builds the same list on every server. With a ceiled key, a list built at :10 and one built at :40 in the same bucket differ by every close imported between them. That breaks the keyed-list promise that page 2 on another server slices the same list. Ceil only fixes tests that insert and then load within one bucket. The production-only default fixes those without changing what readers see |
| O4 | F5-25: F-27's role tests vs F3-16 | **Built** (F5-25). F3-16 is the ruling on roles: "Plain paragraphs, not `role="status"`, for static record notes" (`docs/direction/cycle3-2026-11-01.md:398`). F-27 made no ruling. Its "`role` stays as today" (`docs/features/F-27-colour-follow-ups.md:34`) scopes what F-27 changed, and its out-of-scope list logs "`role="status"` on every failed card" for later (`:109`). The three test edits are equal-strength replacements (section 4) |

### Business lead

| # | Demand | Answer |
|---|---|---|
| BL1 | Everything now, each in a conflict-light shape | **Adopted with change.** F5-8 is the two-line edit. F5-15 adds `readVendorPositions()`. F5-4 is a new module, with `ticker-sql.ts` changed at call sites only. F5-10, F5-13 and F5-26 edit main's lines. Change for F5-2: #100's `TRADE_KEY` const and the validation lines are copied byte-for-byte and merge cleanly. Its `where` line is adjacent to #100's join-line change, so that hunk conflicts whatever we do; take #100's on resolution |
| BL2 | F5-2 copy, and the typed text stays next to the alert | **Copy adopted. AC adopted with change.** A `trade_key` survives rebuilds, so "changed" now means one of two things: the trade has left the record (no field is left to refill), or a pre-deploy page posted only the old id. So the text comes back in a read-only "Your unsaved note" box inside the alert. With JavaScript it is stashed on submit in that tab's `sessionStorage`, cleared once shown and on every other page load. Without JS, the alert shows and focus moves to it, and the browser's Back restores the field |
| BL3 | Delete the `saveThesis(form)` legacy delegate | **Adopted (moot).** With E2's shape the form keeps `action={saveThesis}`, and no second action exists |
| BL4 | Anchor `note-<trade_key>`, `^note-[0-9a-f]{64}$`; rebuild, then the edit link focuses the field | **Adopted.** It is built in `lib/own-note.ts`, not `lib/paging.ts#tradeHref`, which f23 edits. It needs two equal-strength edits of f26's pinned URLs (section 4) |
| BL5 | Drop "Up to 280 characters."; server renders "‹n› of 280" | **Adopted.** The server renders the count from `defaultValue` length. The threshold announcements and the paste line stay |
| BL6 | Triggers idempotent; applying the schema twice leaves one trigger per event | **Adopted.** The repo's `do $$ … if not exists (select 1 from pg_trigger …)` pattern (`db/schema.sql:671`, `:868`) is used over `create or replace trigger`. Why: decided by the committee under the owner's instruction of 2026-11-01; it is the file's own pattern, and CLAUDE.md allows "any Postgres", while `or replace trigger` needs version 14 |
| BL7 | Consistent index names; plan-shape AC checks the name | **Adopted.** `closed_trades_symbol_recent` (F5-27); `ticker_trader_sums_pkey` and `ticker_trader_sums_user` (F5-4). The ACs assert `Index Name` |
| BL8 | Trigger cost AC (rows read ≤ user rows × chunks), else defer | **Adopted with change.** The defer is mandatory (E7), so the AC asserts the deferred design's bound: during `rebuildTrades` the triggers read no `closed_trades` rows, and the final recompute reads the user's rows once |
| BL9 | Dismiss focus: one answer, the timeout path's | **Adopted.** `toCard()` (`app/feed-hides.tsx:40-52`), the function `close()` calls: the next visible card's `.card .who`, or the previous one |
| BL10 | `attestAgain` unconditional in the email alert; empty address gets the same alert and focus | **Adopted** |
| BL11 | Write the no-break space as an escape in code and test | **Adopted.** `' '`, never a literal character |
| BL12 | F5-11: null → "—", 1.009 → "1.00", values above 1 cut down | **Adopted** |
| BL13 | F5-9: pin the two "no …" sentences; flats count on neither side | **Adopted** |
| BL14 | F5-14 deferral line in `docs/process/coordination.md` | **Adopted.** It goes in this item's own row, the only row a client may edit (`docs/process/coordination.md` → Update rule). Text in section 3 |
| BL15 | Compliance §1: add F5-13's title and F5-2's error copy (U1) | **Adopted** (section 7) |

### Engineer

| # | Demand | Answer |
|---|---|---|
| E1 | Keep the numeric-id save path; add the 64-hex path; retry once; `kept_theses` keyed on `prev.sell_id` | **Adopted with one change.** On the numeric path, "no row" now returns `'changed'` instead of `undefined`. The select and every write are unchanged. `lib/reports.test.ts:119-183` and `lib/connections.test.ts:674` ignore the return |
| E2 | Server-side form: a `tradeKey` line above `tradeId`, a redirect on "changed", no `useActionState` | **Adopted with change.** The redirect is `?note=changed#note-changed`, with no key in the URL. The trade is gone, or unknown to a pre-deploy page, so the alert sits at the top of the closed-trades list and focus goes to the alert. `tradeIdParam(form.get('tradeId'))` stays (`lib/params.test.ts:30`). `saveThesis` stays inside `<ul className="rows closes">` (`lib/sync-reconcile.copy.test.ts:47-48`). No `lib/trade-href.ts`: a local regex. **Report ids switch now**, decided with the orchestrator's lean: #100's `lib/reports.ts` validation and `byKey` lines are copied now, so F5-2's AC "a report sent after a rebuild reaches the same note" is met in scope |
| E3 | F5-24 in place: `<textarea>` with f16's exact spread; a client enhancer; named for the symbol; selector edits | **Adopted.** Also copied byte-for-byte from #100: `HeldNote`'s `id` prop (`lib/user-note.ts`) and the `<HeldNote … id={`held-${t.id}`} />` line, so the spread's id exists on main and both hunks merge cleanly. While a note is held, the spread replaces the counter in `aria-describedby`: the held reason wins. The counter stays visible |
| E4 | F5-25 blocked | **Unblocked by O4** |
| E5 | `HIDE_UNDO_MS = 20_000` in feed-hides; `follow.spec.ts:227` edit; focus not inside the bar after the menu click | **Adopted.** Pausing changes: the hide's own focus move to Undo does not pause the bar. Only the reader's own focus moves inside it, a pointer over it or pressed on it, pause it (F5-21). So focus left on Undo by the hide still times out, and the e2e line moves 5,300 → 20,300 ms at equal strength |
| E6 | F5-5: no database-clock offset; `FEED_BUCKET_MS` default 0 | **Rejected in part.** The database clock is kept. Why: decided by the committee under the owner's instruction of 2026-11-01; `importedBy` compares `sell_imported_at`, a database time, with the asOf. An app clock ahead of the database lets a later build include rows an earlier one excluded, which is the nondeterminism floored keys exist to remove. The default changes from 0 to on in production: `NODE_ENV=production`, not `ALLOW_DEV_AUTH=1`. That keeps every unit test (not production) and every e2e run (`ALLOW_DEV_AUTH=1`) on today's per-millisecond key, which answers his three broken tests. **Adopted:** single flight, LRU and the failed-build eviction, all unconditional |
| E7 | Triggers plus a mandatory rebuild defer; transition tables cannot take column lists; idempotent creation; triggers before the backfill | **Adopted** (F5-4) |
| E8 | "Others" summed in JS; traders `count(distinct user_id)`; cache only on the pool path; the review test's pins; page and image out of F5-4; the visible-user guard | **Adopted.** The module goes under `app/t/`, so `lib/fixes-cycle2-trust.test.ts:32` scans its SQL |
| E9 | F5-8 and F5-15 now | **Adopted.** #84 is merged |
| E10 | F5-10 and F5-13 now; the `record-strip.spec.ts:200` normalizer; the two-trade rule keeps the h2 shape | **Adopted** (F5-10) |
| E11 | `.env.example` after `:14`; F5-20 through `instrumentation.ts`; `cut2` in `lib/format.ts` | **Adopted.** `instrumentation.ts:7-10` already calls `assertSecrets()`, so only `lib/secret-env.ts` changes |
| E12 | F5-27: the renamed index is built without CONCURRENTLY during deploy: an owner item | **Adopted** (section 6, item 3) |
| E13 | One `FC5` object, whole, in WP0 | **Adopted** |

## 2. Work packages

| WP | Items | Main files | Merges against |
|---|---|---|---|
| **WP0** copy, labels, ops | the whole `FC5` object; F5-6, F5-9, F5-11, F5-12, F5-17, F5-19, F5-20, F5-25, F5-27; the F5-14 coordination line | `lib/copy.ts`, `lib/insights.ts`, `lib/format.ts`, `lib/chart-sub.ts`, `lib/matcher-rebuild.ts`, `next.config.ts`, `lib/secret-env.ts`, `.env.example`, `app/warn-notice.tsx` and its 4 call sites, `db/schema.sql:118`, `:791` | f23 (`page.tsx:368`), f16 (`page.tsx:274`), f25 (`ui.tsx:116`): none adjacent |
| **WP1** notes and reports | F5-2, F5-24, F5-26 | `app/u/[handle]/page.tsx`, `load.ts`, `row-focus.tsx`, `note-field.tsx` (new), `note-recovery.tsx` (new), `app/actions.ts`, `lib/thesis-save.ts`, `lib/reports.ts`, `lib/own-note.ts`, `lib/user-note.ts`, `app/feed-rows.tsx`, `app/u/[handle]/trade/[sellId]/page.tsx`, `lib/sync.ts:91-93` (comment) | f16 (C1-C4), f25 (C5) |
| **WP2** focus and pages | F5-7, F5-10, F5-13, F5-21, F5-22, F5-23 | `app/login/page.tsx`, the month page, `lib/recap.ts`, `app/t/[symbol]/page.tsx:55-56`, `app/feed-hides.tsx`, `app/me/hidden/page.tsx`, `app/me/record/page.tsx`, `app/actions.ts#setRule`, `app/settings/page.tsx` | f16 and f25 (month page, C6); f25 (`t/[symbol]`, C7) |
| **WP3** sync and housekeeping | F5-8, F5-15, F5-16, F5-18 | `lib/sync.ts`, `lib/options-sync.ts`, `app/api/sync/route.ts`, `db/schema.sql` (users columns), two DB test files | f25 (`lib/f15-share-action.db.test.ts`) |
| **WP4** scale | F5-4, F5-5 | `app/t/ticker-sums.ts` (new), `app/t/ticker-sql.ts` call sites, `db/schema.sql` (after `:416`), `lib/bucket-cache.ts` (new), `lib/feed.ts:463-481` | f25 (`ticker-sql.ts` select lists), f16 (`feed.ts:520+`): not adjacent |

## 3. Items

### F5-2 (C5-3): a note and a report on it are keyed by the trade. WP1

**Form.** On `app/u/[handle]/page.tsx:419-424`:
- a new line `<input type="hidden" name="tradeKey" value={t.trade_key} />` goes **above** the `tradeId` line, which
  stays;
- `load.ts:20` selects `trade_key`, the same line as f25's.

**Action.** `saveThesis` (`app/actions.ts:85-92`) keeps `tradeIdParam(form.get('tradeId'))`:
- When `form.get('tradeKey')` matches `/^[0-9a-f]{64}$/` (a local regex), it calls `saveThesisFor(user.id, key, …)`.
  Otherwise it passes the numeric id, as today.
- On `'changed'` it `redirect`s to `/u/<handle>?note=changed#note-changed`. Otherwise it revalidates, as today.

**`lib/thesis-save.ts`.** `saveThesisFor(userId, ref, input)` returns `'saved' | 'changed'`.
- **64-hex ref:** `select id, thesis, thesis_status, thesis_hold_rule, sell_id, thesis_reports_from from closed_trades
  where user_id = ${userId} and trade_key = ${ref} for update` (index `closed_trades_trade_key`). An empty result runs
  the select **once more**: in READ COMMITTED, a row deleted while this save waited for its lock comes back empty, and
  the next statement sees the committed rebuild. The updates key on `prev.id`.
- **Numeric ref:** unchanged, except that "no row" returns `'changed'`.
- **Both:** the `kept_theses` delete keys on `prev.sell_id`. Leave #100's hunk (`:52-56`) alone.

**Reports.** From #100, byte-for-byte:
- the `TRADE_KEY` const and its comment (after `lib/reports.ts:17`);
- the two validation lines (`:27`);
- the `where ${byKey ? sql`t.trade_key = ${tradeId}` : sql`t.id = ${tradeId}`}` line.

Where the reports are sent from:
- **Feed card:** `app/feed-rows.tsx:69-71` takes #100's two replacement lines, the comment and `<ReportNote
  tradeId={tradeKey(t.sell_id)} …>`.
- **Profile:** the `UserNote reportId` (`page.tsx:417`) passes `t.trade_key`.
- **Trade page:** `reportId` (`trade/[sellId]/page.tsx:116`) passes `tradeKey(t.sell_id)` from `lib/likes.ts`. That
  needs `sell_id` in the view: one select column in `lib/trade-share-load.ts`, the same one f25 adds.

**Comment.** Correct `lib/sync.ts:91-93` to "…or waits for this rebuild and then finds the rebuilt row by its trade_key
(lib/thesis-save.ts selects again once after the lock)".

**Copy:**
- `FC5.noteChanged`: "This trade changed. Copy your note, reload the page, then save it again.";
- `FC5.noteUnsaved`: "Your unsaved note".

**Display.** With `note=changed` and `isMe`, the closes section starts with `<div id="note-changed" role="alert"
tabIndex={-1}>` holding that sentence, and `<FocusHeading id="note-changed" />`.

**Recovery (`note-recovery.tsx`, client).** On submit of any `.note-form`, the field's value goes into
`sessionStorage['fc5-note']`. When the alert is rendered, the component shows that text in a read-only `<textarea
aria-label="Your unsaved note">` inside the alert, then removes the key. On every other profile load, the key is
removed. It is wrapped in try/catch, and without storage the alert alone shows.

**AC:**
- `lib/fixes-cycle5-notes.db.test.ts`:
  1. Read the key, `rebuildTrades`, save: `'saved'`, on the rebuilt row.
  2. Hold a rebuild transaction open with rows locked and start a save by key. Commit: `'saved'`, the text is on the new
     row.
  3. An unknown key returns `'changed'` and changes no row of `closed_trades` or `kept_theses`. So does a numeric id
     after a renumbering.
  4. A report by `trade_key` after a rebuild reaches the same note (a `thesis_reports` row on its `sell_id`).
  5. Source scan: every `name="tradeId"` form under `app/` also posts `tradeKey`. Every `reportId=` / `<ReportNote
     tradeId=` passes a trade key.
- `e2e/fixes-cycle5-notes.spec.ts` at 360 px:
  1. A rebuild between load and Save: the note shows after reload.
  2. A key made unknown: the alert is focused, and the read-only box holds the typed text.
  3. No JS: the alert is focused.

**Files:** as in WP1. **Overlap:** f16 C1-C3, f25 C5. **Protected:** no.

### F5-4 (C5-6): ticker pages read a per-trader, per-symbol summary. WP4

**Table** (`db/schema.sql`, after `:416`):
- `ticker_trader_sums(symbol, user_id → users on delete cascade, verified, n, wins, k, sx, sd, sxx, sxn, snn, sxd, sdd,
  first_open, last_close, last_closed_at)`;
- primary key `(symbol, user_id, verified)`, named `ticker_trader_sums_pkey`; index `ticker_trader_sums_user (user_id)`.

The sums reproduce `sideConfidence`'s clustering (`app/t/ticker-sql.ts:286-317`) per trader and trust: bets ordered `o,
id`, and Σ(x−nm)² and Σ(x−rd)² from the expanded sums, clamped at 0.

**Triggers.**
- Three statement-level `after insert|update|delete` triggers with transition tables, one per event. Transition tables
  do not allow `update of` column lists, so the update function returns early when no row changed `symbol, return_pct,
  holding_days, opened_at, closed_at, verified, filing_url`.
- Each recomputes the affected `(user_id, symbol)` pairs from rows with `filing_url is null`. Insert upserts. Update and
  delete only update existing rows, so a cascaded user delete never inserts.
- A pair with no rows keeps a zeroed row (the schema guard bans `delete from`), and reads use `n > 0`.
- Created idempotently by the `pg_trigger` pattern, **before** the one-off backfill (`insert … select … on conflict do
  update`, run only while the table is empty).

**Rebuild defer (mandatory).**
- `rebuildTrades` (`lib/sync.ts:81`) sets `select set_config('app.tts_defer', 'on', true)` first, and the triggers
  return at once while it is on.
- The return line (`:194`) becomes `return await finishTickerSums(tx, userId, {...})`. That function sets it `'off'` and
  runs one grouped recompute of every pair of the user.
- Writes after the rebuild (`lib/options-sync.ts:146`, `:225`) fire the triggers normally.

**Reads** (`app/t/ticker-sums.ts`, under `app/t/` so the visible-user guard scans it). Every statement joins `users u
on … ${visibleUser('u')}` and filters `n > 0`.
- `symbolTotals(sql)`: one row per `(symbol, verified)`, Σ of every column, `count(distinct user_id)` as traders,
  min/max dates.
- **Caching** only when `sql` is the default pool: through `lib/bucket-cache.ts`, a 60 s bucket, single flight. A
  caller's own transaction always reads fresh (`lib/ticker-others.test.ts:99-106`, `lib/ticker-review.test.ts:107-111`).
- **Call sites in `ticker-sql.ts`:**
  - `tickerIndexIn` (`:247-270`) maps the totals: total, prefix, the two sorts, in JS.
  - `relatedSymbolsSql` (`:220-235`) reads the sums for this symbol's users.
  - `sideConfidence`'s `'others'` branch sums the rows of every other symbol in JS, not total minus this symbol, for
    precision. `tickerPageWithBaseline` keeps calling `sideConfidence(q, symbol, 'others', …)`.
  - The `'this'` branch is unchanged.
- **Out of F5-4:** `app/t/[symbol]/page.tsx` and the stock image. Each reads one symbol through its index; the image's
  ponytail stays.

| Records | Rule |
|---|---|
| Demo | In, with `verified=false` (demoOnly and mixed as today) |
| Public filers | Out (`filing_url is null` at write time) |
| Frozen | In (they follow their rows) |
| Hidden or deleted | Excluded at read time; deleted rows go by cascade |

**AC:**
- `lib/fixes-cycle5-ticker.db.test.ts`:
  1. On the existing ticker fixtures, the figures equal today's to the printed precision.
  2. Drift guard: after random inserts, updates, deletes, `rebuildTrades`, the options deletes and a user delete, every
     pair equals a recompute. No orphan rows.
  3. Applying `db/schema.sql` twice leaves exactly one trigger per event (`pg_trigger` count).
  4. **Plan shape** (20,000 closes, 400 symbols, custom and generic plans):
     - no `/t` or `/t/SYMBOL` statement has a Seq Scan on `closed_trades`;
     - every `closed_trades` node reads at most that symbol's rows + 1, through an index named
       `closed_trades_symbol_recent` (or `closed_trades_trade_key`);
     - `symbolTotals` reads only `ticker_trader_sums` (through `ticker_trader_sums_pkey` or a scan of that table) and
       `users`.
  5. **Defer:** EXPLAIN of the trigger function shows no `closed_trades` read while `app.tts_defer` is on. The final
     recompute reads exactly the user's rows (`rowsRead` equals the user's count).
  6. **Single flight:** 10 concurrent `/t/SYMBOL` and 50 concurrent `/t` loads in one bucket build the totals once.
  7. **No waiting:** with trader A's rebuild open, trader B's rebuild on a shared symbol under `set local lock_timeout =
     '50ms'` completes.
  8. A deleted user leaves every total after the next bucket; a public filer is never counted.
- `lib/fixes-cycle5-ticker.load.test.ts`: item 4 at 2 M closes.

**Test edit:** `lib/ticker-review.test.ts:125`. The ponytail is resolved, so its text goes (section 4).
**Files:** WP4. **Protected:** no.

### F5-5 (C5-7): feed page 1 shares one list per minute. WP4

**Decision.** The asOf is the **floor** of the bucket, taken on the database clock.
- The bucket is `floor((Date.now() + dbOffset) / 60_000) · 60_000`. `dbOffset` comes from `select
  extract(epoch from clock_timestamp()) * 1000` at most every 5 minutes, single flight, kept at its last value on
  failure.
- The default is on when `NODE_ENV === 'production'` and `ALLOW_DEV_AUTH !== '1'`. `FEED_BUCKET_MS` overrides it, and 0
  turns it off.
- It is read in `loadFeedPage` only when `opts.now` is not given, so tests that pass `now` keep today's exact key.
- If `|dbOffset| > SKEW_MS` (`lib/discovery/pager.ts:11`), fall back to the app clock and log one counted warning with
  no values.

Why the floor (O3, E6): decided by the committee under the owner's instruction of 2026-11-01. A floored key gives the
same list on every server, because `importedBy(…, asOf)` is a hard filter. Its cost: a close imported in the last
minute reaches the signed-out home up to 60 s later. Profiles and trade pages stay live.

**Unconditional:**
- one in-flight build per key in `listFor` (`lib/feed.ts:469-481`);
- a failed build is not cached;
- `LIST_CACHE_MAX` 256 as a true LRU (re-insert on hit, evict the oldest), replacing the evict-from-front loop at
  `:477`, with the 48 h age rule kept.
- The helper lives in `lib/bucket-cache.ts`, shared with F5-4.

**AC → `lib/fixes-cycle5-feed.test.ts`** (injected clock, offset and build counter):
1. Two calls in one bucket, and 50 concurrent calls, build once.
2. A page-2 cursor's list survives 1,000 page-1 builds under 255 other keys.
3. The asOf is at most the database time (offset −30 s).
4. A failed build runs again on the next call.
5. Off when `NODE_ENV` is not production or `ALLOW_DEV_AUTH=1`.

`lib/fixes-cycle5-feed.db.test.ts`: a close imported after the floor is absent from that bucket's list and present in
the next one; two builds of one key on fresh caches are equal.
No test is edited. `lib/f26-held-like-none.db.test.ts`, `lib/f7-feed.test.ts` and `e2e/follow.spec.ts:268` run with the
bucket off.

### F5-6 (C5-8): the connect copy. WP0

**Copy**, `lib/copy.ts:51`: "Every account under this login and the full trade history your broker provides are
included. Nothing is imported until you confirm on the next screen."
**AC → `lib/fixes-cycle5-copy.test.ts`:** both connect lines contain "your broker provides"; none contains "your full
trade history". **Legal committee re-sign.**

### F5-7 (C5-9): the email error keeps the trader in place. WP2

**Box:** unticked while owner Q2 is open, and named in words. Why: decided by the committee under the owner's
instruction of 2026-11-01; it is the council's "if silent" answer.

**Copy:**
- `SIGNIN.emailError`: "Enter a full email address, like name@example.com.";
- `FC5.attestAgain`: "Then tick “I am 18 or older” again.";
- both always in the one `#email-err` alert, empty address included (BL10).

**Behaviour:**
- `error=email`: `#email` gets `autoFocus`, keeps `aria-describedby="email-err"` (`app/login/page.tsx:43`) and the
  typed address. `#email-err` keeps `role="alert"` (`:44`).
- `error=rate` (`:45`): `id="email-rate" tabIndex={-1}`, plus `<FocusHeading id="email-rate" />`.

**AC → `e2e/fixes-cycle5-a11y.spec.ts`:**
1. `trader@mailhost` + Enter: `#email` is focused, its description holds both sentences, and its value is kept.
2. An empty address: the same.
3. Shift+Tab to the box, Space, fix the address, Enter: `/login/sent`.
4. `error=rate`: the alert is focused.

**Legal committee:** the sign-up copy. **Owner:** Q2.

### F5-8 (C5-11): rebuild paging keeps microseconds. WP3

`${after.at}::timestamptz` → `${after.at}::text::timestamptz` at `lib/sync.ts:141` and `lib/options-sync.ts:93`. Both
already page on `executed_at::text as at`; check the options select during the build.
**AC → `lib/fixes-cycle5-sync.db.test.ts`:** 2,500 activities with microsecond times over 3 pages equal `matchTrades`
over the whole set. The same for options over 3 option pages.

### F5-9 (C5-19): the takeaway never names one side alone. WP0

**Copy** (`lib/insights.ts:61-64`, floor `MIN_TRADES = 5`):

| Case | Sentence |
|---|---|
| Both sides averaged | Unchanged |
| Wins averaged, 1-4 losses | "Your average win was +6.5%; 3 losses, too few to average." ("1 loss, too few to average") |
| Wins averaged, no losses | "Your average win was +6.5%; no losses." |
| Losses averaged, 1-4 wins | "Your average loss was −4.0%; 2 wins, too few to average." ("1 win, …") |
| Losses averaged, no wins | "Your average loss was −4.0%; no wins." |

Flat trades (return 0) count on neither side, as `:59-60` already filter.
**AC → `lib/fixes-cycle5-labels.test.ts`:**
- 5 wins, 3 losses and 2 flats: "3 losses";
- the mirror;
- each "no …" form, exact.

### F5-10 (C5-20): a gain is never "Worst trade". WP2

**Copy:**
- "Best trade" if its return is above 0, else "Highest return";
- "Worst trade" if its return is below 0, else "Lowest return";
- "Only trade this month" unchanged for 1 trade.

The logic is a pure `pickTitles` in `lib/recap.ts`.

**Two-trade month:** the picks stay out, so the full list is not repeated.
- The h2 shape stays constant (E10). `Pick` renders its title as an `<h2>` (month page `:65-67`), so dropping the picks
  changes the h2 list. The build first checks `e2e/record-strip.spec.ts:175-200`'s fixture.
- The two demo months it compares are the lowest- and highest-average months of the three demo traders. If either is a
  two-trade month, the no-repeat part waits as a `// ponytail:`, and only the label fix ships, because that test must
  not change shape.
- Either way, the normalizer at `:200` gains `Highest return|Lowest return` (section 4).

**AC:**
- `lib/fixes-cycle5-labels.test.ts`: all four sign cases, and 2 trades.
- `e2e/fixes-cycle5-pages.spec.ts`: an all-gain fictional month shows "Lowest return" and never "Worst trade".

### F5-11 (C5-21): a ratio below 1 never prints 1.00. WP0

`cut2(x) = (Math.floor(x * 100 + 1e-9) / 100).toFixed(2)` in `lib/format.ts`, used at `app/u/[handle]/page.tsx:364`;
null still prints "—".
**AC → `lib/fixes-cycle5-labels.test.ts`:**

| Value | Prints |
|---|---|
| 0.997 | "0.99" |
| 0.9999 | "0.99" |
| 1.003 | "1.00" |
| 1.009 | "1.00" |
| 0.29 | "0.29" |
| 2.5 | "2.50" |
| 2.999 | "2.99" |
| null | "—" (page render) |

### F5-12 (C5-22): "Nov 1" stays together. WP0

`chartRestSub` (`lib/chart-sub.ts:7-8`) passes the date through `.replace(/ /g, ' ')`.
**AC:**
- `lib/fixes-cycle5-labels.test.ts`: the subline contains `'Nov 1'`.
- `e2e/fixes-cycle5-pages.spec.ts` at 320 px: the date's range has one client rect.

### F5-13 (C5-23): an empty stock page says it is empty. WP2

**Copy:** if `s.n === 0`, the title is "No closed trades in ‹TICKER› yet · Stock Social" (`app/t/[symbol]/page.tsx:55-56`,
`FC5.tickerEmptyTitle`). The 200 status and `noindex` stay.
**AC → `e2e/fixes-cycle5-pages.spec.ts`:** `/t/ZZZZQ` has that title and status 200; a symbol with trades keeps today's.

### F5-14 (C5-12): a bounded chart series. Deferred

Built after F-23 merges and re-measures. The AC will be bytes (≤ 300 KB gzipped at 80,000 closes) with the printed
figures equal to full resolution. WP0 adds to the fixes-cycle5 row's notes in `docs/process/coordination.md`:
"F5-14 (C5-12, bounded profile chart series) deferred until F-23 (`claude/f23-payload-precision`) merges and
re-measures an 80,000-close profile; it then builds on F-23's wire format."

### F5-15 (C5-13): vendor reads before the rebuild's locks. WP3

`readVendorPositions(bu, real, posIds, cadence)` (a FIXES-CYCLE5 block in `lib/sync.ts`) runs every
`broker.fetchPositions` call (today `:707` and `:721`) and returns `Map<accountId, {rows, split}>`. It is called before
`if (rebuilt) await rebuild(user.id, tx)` (`:702`).
- Both branches then read from the map instead of calling the vendor. Every write keeps its place and order after the
  rebuild, in the same transaction.
- The cadence branch's `clock_timestamp()` stamp stays after the vendor calls.

**AC → `lib/fixes-cycle5-sync.db.test.ts`:**
1. While a fake `fetchPositions` is pending, a second connection's `select … from closed_trades where user_id = $1 for
   update nowait` succeeds, and so does a note save.
2. After release, `open_positions` and `option_positions` equal today's for the same fake rows, in both branches.

### F5-16 (C5-14): DB tests clean up. WP3

`lib/trades-prompt.db.test.ts` (`:12-18`) and `lib/f15-share-action.db.test.ts` (`:13-20`) record the ids they create.
An added `after` hook deletes them before `sql.end`: users (cascade), then `signup_attempts` by id, then the funnel and
event rows for those users.
**AC → `lib/fixes-cycle5-cleanup.db.test.ts`:** each file, run as a child `node --test`, leaves those tables' counts
unchanged. The suite-wide CI step is owner item 2.

### F5-17 (C5-15): the deploy rebuild says why. WP0

`lib/matcher-rebuild.ts:38`: `catch (e) { failed++; const c = logSafe(e); byClass[c] = (byClass[c] ?? 0) + 1; }`. The
`:41` log line becomes `{count, byClass}`: classes only.
**AC → `lib/fixes-cycle5-ops.db.test.ts`:** one throwing record lets the others finish. The log holds `"TypeError":1`
and no id or handle.

### F5-18 (C5-16): housekeeping deletions stop at the deadline. WP3

Pending deletions (`app/api/sync/route.ts:61-62`):
- **Order:** `order by deletion_next_at nulls first, id limit 5`.
- **Deadline:** each one starts only while `Date.now() < deadline - VENDOR_TIMEOUT_MS`.
- **Backoff:** a failure sets `deletion_attempts + 1` and `deletion_next_at = now() + least(2^attempts min, 24 h)`. These
  are two additive `users` columns, placed beside that table, not at the end of the file.
- No deletion is ever dropped.

**AC → `lib/fixes-cycle5-ops.db.test.ts`** (fake clock):
1. 20 hanging deletions: at most 5 start, the call stops at the deadline, and the purge and sync stages still run.
2. A failed one goes later in line.
3. All 20 finish over successive calls.

### F5-19 (C5-17): no `X-Powered-By`. WP0

`poweredByHeader: false` in `next.config.ts`.
**AC → `e2e/fixes-cycle5-pages.spec.ts`:** no `x-powered-by` on `/`, a demo profile, `/t`, an image or `/api/sync`
(401).

### F5-20 (C5-18): a separate session secret on a public start. WP0

**Switch:** `SESSION_SECRET_REQUIRED=1`, read only in `lib/secret-env.ts#assertSecrets`, which `instrumentation.ts:9`
already calls. On the production path:
- **switch off:** when `SESSION_SECRET` is missing or equal to `APP_SECRET_KEY`, one `console.warn` per process:
  `secret-env: SESSION_SECRET missing or shared with APP_SECRET_KEY (launch row 5) {"count":1}`;
- **switch on:** `throw new SecretEnvError('SESSION_SECRET')`.

`.env.example` gains `SESSION_SECRET_REQUIRED=` after `:14`, with the comment "# 1 once launch row 5 is signed off: a
public start then refuses a missing or shared SESSION_SECRET." `lib/session.ts` and `lib/auth/sessions.ts` are not
touched.
**AC → `lib/fixes-cycle5-ops.test.ts`:**
- switch off: a warning, for both missing and equal;
- switch on: a throw for both;
- a distinct strong secret: passes;
- no message contains a value.

### F5-21 (C5-24, F3-24): Undo waits for the reader. WP2

`HIDE_UNDO_MS = 20_000` in `app/feed-hides.tsx`; `UNDO_MS` stays the follow bar's.

**Pausing.** `paused()` (`:59`) is true while the pointer is over or pressed on the bar, or after any `focusin` inside
the bar that the bar did not make itself. That covers Tab, Shift+Tab, a tap on a button and a screen reader's focus
move.
- The hide's own move of focus to Undo does not pause the bar, so a reader who does nothing gets the full 20 s, then
  `close()` → `toCard()`.
- When focus or the pointer leaves after a pause, a fresh 20 s starts.

**Dismiss.** A Dismiss button (`FC5.dismiss` "Dismiss", 44 px, after Undo) calls `close()`. Focus goes to `toCard()`,
as on timeout (BL9).

**/me/hidden.** On `?back=` the status line (`app/me/hidden/page.tsx:25`) gets `id="hidden-back" tabIndex={-1}`, plus
`<FocusHeading id="hidden-back" />`.

**AC → `e2e/fixes-cycle5-a11y.spec.ts`** (Playwright clock, 360 px):
1. Hide by tap: the bar is there at 19 s and gone at 21 s, with focus on the next card's name.
2. Hide, then Tab to Dismiss: still there at 60 s. Tab out: gone 20 s later.
3. Dismiss: the bar closes, with focus on the next card's name.
4. Show again on /me/hidden: `#hidden-back` is focused and names the trader.

**Test edit:** `e2e/follow.spec.ts:227` (section 4).

### F5-22 (C5-25): rule forms keep focus and say what changed. WP2

`setRule` (`app/actions.ts:186-199`) ends with `redirect('/me/record?rule=<kind>&did=set|clear#rule-<kind>')`.
- `kind` is checked by `isRuleKind`.
- The section (`app/me/record/page.tsx:213`) gets `id="rule-<kind>"`, and its `<h3>` gets `id="rule-<kind>-h"
  tabIndex={-1}`.
- When `rule` and `did` match, `<p role="status" className="small">` sits under the h3, with `<FocusHeading
  id="rule-<kind>-h" />`.
- The tag buttons drop `<span className="sr-only"> Selected, tap to clear</span>` (`:57-58`).

**Copy:**
- `FC5.ruleSet(label)`: "Rule set: ‹label›." (e.g. "Rule set: Close losing trades within 5 days.");
- `FC5.ruleCleared`: "Rule cleared."

**AC:**
- `e2e/fixes-cycle5-a11y.spec.ts`: Set → the h3 is focused, the status is right, and the h3 is in view at 360 × 640.
  Clear → the same.
- `lib/fixes-cycle5-a11y.test.ts`: no "tap to clear" under `app/`.

### F5-23 (C5-26): delete step 1 focuses its alert. WP2

`app/settings/page.tsx:33`: `<p id="delete-confirm" role="alert" tabIndex={-1}>…</p><FocusHeading id="delete-confirm" />`.
No autofocus on the button.
**AC → `e2e/fixes-cycle5-a11y.spec.ts`:** `#delete-confirm` is focused; the next Tab reaches the final delete button.

### F5-24 (C5-27): the note field has a visible label and states its limit. WP1

**The field.** Edit the field line in place (`page.tsx:422`) to:

```
<textarea id={`note-${t.trade_key}`} name="thesis" rows={3} maxLength={280} defaultValue={t.thesis ?? ''} placeholder="Why did you take this trade?" aria-label={`Your note, thesis for ${t.symbol}`} aria-describedby={`count-${t.trade_key}`} {...(t.thesis_status === 'held' && !!t.thesis ? { 'aria-describedby': `held-${t.id}`, 'aria-invalid': true } : {})} />
```

- The spread is #100's, exact. It sits after our `aria-describedby`, so a held note's reason replaces the count in the
  description.
- **Visible label:** "Your note" (`<label htmlFor={`note-${t.trade_key}`}>`, `FC5.noteLabel`). The `aria-label` keeps
  the symbol, so the rows' fields stay distinct.
- **Copied byte-for-byte from #100:** `lib/user-note.ts`'s `HeldNote` `id` prop, and `page.tsx:418` `<HeldNote
  rule={t.thesis_hold_rule} id={`held-${t.id}`} />`.

**Counter.**
- Server-rendered `<span id={`count-${t.trade_key}`} className="muted small">{FC5.noteCount(len)}</span>`, where `len` is
  the `defaultValue` length (BL5).
- `note-field.tsx` (client) attaches to the textarea by id and updates the count on input. One polite live region
  speaks only "20 characters left" at 260 and "Limit reached, 280 of 280" at 280. On a paste whose length after the
  selection would pass 280, it shows and speaks "Your paste was cut to 280 characters." until the next input.

**Copy:**
- `FC5.noteCount(n)`: "‹n› of 280";
- `FC5.noteNear`: "20 characters left";
- `FC5.noteFull`: "Limit reached, 280 of 280";
- `FC5.notePasteCut`: "Your paste was cut to 280 characters.";
- `FC5.noteLabel`: "Your note".

**The edit link.** `lib/own-note.ts` selects `trade_key` and builds `tradeHref(…)` with `#trade-<id>` replaced by
`#note-<trade_key>`. `app/u/[handle]/row-focus.tsx:11` also accepts `^note-[0-9a-f]{64}$` and focuses that field.

**Typed text after Save.** React 19 resets uncontrolled fields after an action. After a successful save the field shows
the saved text, which is the typed text; e2e checks it.

**AC → `e2e/fixes-cycle5-notes.spec.ts`** (360 px):
1. `getByLabel('Your note')` finds the filled field, and it shows at least 3 lines.
2. A 300-character paste stores 280, with the cut line shown and spoken.
3. The server renders "‹len› of 280" for a saved note.
4. After `rebuildTrades`, "Edit it on your profile" on a held trade lands with the textarea focused.
5. The typed text stays in the field after Save.

`lib/fixes-cycle5-a11y.test.ts`: no `<input type="text" name="thesis"`.
**Test edits:** f26 and f7 selectors, and f26's URLs (section 4).

### F5-25 (C5-28): static failed-import notices carry no live-region role. WP0

`WarnNotice`'s `role` becomes optional (`app/warn-notice.tsx:5`; it renders `role` only when given). The four static
uses drop it:
- `app/record-strip.tsx:32`;
- `app/ui.tsx:104`;
- `app/pane.tsx:71`;
- `app/u/[handle]/page.tsx:279`, which becomes `<WarnNotice>{RECORD_BODY.failed}{isMe && <> <Link …>…</Link></>}</WarnNotice>`.

**AC → `lib/fixes-cycle5-a11y.test.ts`:**
- a render without `role` has no role attribute;
- a render with `role="status"` keeps it;
- no `<WarnNotice role=` anywhere in `app/`.

**Test edits:** three (section 4).

### F5-26 (C5-29): `autocomplete="username"` on the handle field. WP2 (with WP1's page edit)

`autoComplete="username"` on `#new-handle` (`page.tsx:316`).
**AC → `lib/fixes-cycle5-a11y.test.ts`:** `#new-handle`'s line carries it.

### F5-27 (C5-44): one definition of the symbol index. WP0

- `db/schema.sql:118` becomes `schema_add_index('closed_trades_symbol_recent', 'create index closed_trades_symbol_recent
  on closed_trades (symbol, closed_at desc, id desc)')`.
- The `:791` line is removed.
- The comments in `lib/sitemaps.ts:6` and `:42` take the new name.

**AC → `lib/fixes-cycle5-schema.db.test.ts`:**
- a fresh schema has it on those three columns;
- a database seeded with the old two-column `closed_trades_symbol` gains it;
- the `/t/SYMBOL` list's EXPLAIN uses `closed_trades_symbol_recent`.

Owner items 3 and 4 cover the upgrade.

## 4. Existing tests edited (equal-strength or stronger)

| File:line | Today | Becomes | Why it is not weaker |
|---|---|---|---|
| `lib/f27-colour-follow-ups.test.ts:136` | `^<WarnNotice role=\{isMe \? 'alert' : 'status'\}>` | `^<WarnNotice>` | It still pins the exact opening tag, now with no live role (F3-16) |
| `lib/f27-colour-follow-ups.test.ts:148` | each file matches `/<WarnNotice role=/` | each file matches `/<WarnNotice>/` and does not match `/<WarnNotice role=/` | The same "uses WarnNotice" check, plus the role's absence |
| `lib/qa-round-1.test.ts:35` | `/<WarnNotice role=/` | `/<WarnNotice>/` and not `/<WarnNotice role=/` | As above |
| `lib/ticker-review.test.ts:125` | the ponytail text before `othersConfidence` | `/FIXES-CYCLE5: other symbols from ticker_trader_sums/` in the same span; `:124` (`sideConfidence(q, symbol, 'others'`) is kept | The resolved ponytail is replaced by its fix's marker. The new plan-shape test proves no full scan, which is stronger than a comment pin |
| `lib/f26-held-like-none.db.test.ts:151-153` | `edit: …#trade-${id}` | `edit: …#note-${tradeKey}`, with the `?closes=` window unchanged | The same exact `deepEqual`, with the new anchor |
| `e2e/f26-held-like-none.spec.ts:305`, `:313` | URL `…#trade-${id}$` | URL `…#note-${key}$` | The same exact URL match |
| `e2e/f26-held-like-none.spec.ts:306`, `:314-316` | `#trade-${id} input[name="thesis"]` visible / in viewport | `#trade-${id} [name="thesis"]` visible / in viewport, **and** `toBeFocused()` | Selector-equivalent, plus a focus check (stronger) |
| `e2e/f7-public-profile.spec.ts:117` | `form input[name="thesis"]` count 0 | `form [name="thesis"]` count 0 | It matches input and textarea, so it is wider |
| `e2e/follow.spec.ts:227` | `waitForTimeout(5_300)` | `waitForTimeout(20_300)` | The same "bar times out and focus lands on a card" check, at the new limit |
| `e2e/record-strip.spec.ts:200` | normalizer `^(Best\|Worst) trade$\|^Only trade this month$` | adds `\|^(Highest\|Lowest) return$` | The same shape comparison; the new titles are picks too |

## 5. Expected conflicts with unmerged branches (the second to land resolves them)

| # | File | Theirs | Resolution |
|---|---|---|---|
| C1 | `app/u/[handle]/page.tsx:422` | f16 adds the held spread to the `<input>` | Take ours: the textarea already carries f16's exact spread |
| C2 | `page.tsx:417` (`reportId`) beside f16's `:418` | f16: `HeldNote` id (identical to ours) | Keep `t.trade_key` for `reportId`; `:418` is identical |
| C3 | `lib/reports.ts` `where` line beside #100's join change | #100: `visibleUser('u')` join | Take #100's two lines. Its `byKey` text is ours byte-for-byte |
| C4 | `page.tsx:314-316` (handle field) | f16 rewrites the label and input | Take f16's lines and add `autoComplete="username"` to its input |
| C5 | `load.ts:20`, `trade-share-load.ts` select | f25 adds `trade_key` and `sell_id` | Identical columns: take either |
| C6 | Month page `:117` | f16 and f25 edit the page | Keep `pickTitles` on the merged line |
| C7 | `app/t/[symbol]/page.tsx:55-56` | f25 | Keep the `s.n === 0` title branch |

Each session gets this table through its coordination row; WP1 and WP2 post it.

## 6. Owner items (protected or owner-only)

1. **CLAUDE.md, Commands** (protected): "then fill APP_SECRET_KEY and CRON_SECRET with random strings" → "then fill
   APP_SECRET_KEY, CRON_SECRET and SESSION_SECRET with distinct random strings".
2. **`.github/workflows/ci.yml`** (protected; council owner Q4): before and after `npm test`, run `psql "$DATABASE_URL"
   -Atc "select string_agg(relname || '=' || n_live_tup, ',' order by relname) from pg_stat_user_tables"` into two
   files (with `analyze` before the second), then `diff` them. Merge once every suite is clean; F5-16 cleans two of them.
3. **F5-27 on upgraded databases.**
   - Before the deploy, run `create index concurrently if not exists closed_trades_symbol_recent on closed_trades
     (symbol, closed_at desc, id desc);`. Otherwise `vercel-build`'s schema step builds it without `concurrently` and
     blocks writes to `closed_trades` while it runs (E12).
   - After the deploy, run `drop index if exists closed_trades_symbol;`.
4. **F5-4 on upgraded databases:** the backfill is one grouped scan of `closed_trades`. At 2 M closes, run `node
   --env-file=.env scripts/db-setup.ts` in a quiet window.
5. **Deploy env** (POLICY H):
   - a distinct `SESSION_SECRET` of at least 32 random characters, then `SESSION_SECRET_REQUIRED=1` once launch row 5 is
     signed off;
   - `FEED_BUCKET_MS` only to change or disable F5-5's default.
6. **Owner Q2:** may the 18+ tick survive an email error? A yes re-renders the box ticked on `error=email` and drops
   `FC5.attestAgain`.
7. **Note, no action asked:** F-27's file says "`role` stays as today" (`F-27:34`). F5-25 follows F3-16's later ruling
   on roles, which F-27 left out of scope (`F-27:109`).
8. **Legal committee re-sign** (not the owner): F5-6's connect line and F5-7's sign-up error copy.

## 7. COMPLIANCE Section 1 answers

1. **Performance?** Yes, in these items:
   - F5-4: same figures, new source;
   - F5-9, F5-10 and F5-11: labels, symmetric for gains and losses;
   - F5-13: "No closed trades in ‹TICKER› yet" states a count, never a rating of the security (F3b), and makes no
     "verified" claim (F3a).

   Disclaimers are unchanged, and the copy is scanned for advice and promo words (`lib/fixes-cycle5-copy.test.ts`).
2. **Personal data?**
   - F5-4: derived per-trader sums with no prices, quantities or amounts (P3). They are deleted by cascade, and hidden
     users are excluded at read time.
   - F5-18: two retry columns.
   - F5-17: logs error classes only.
   - F5-2: an unsaved note is kept only in the author's own tab (`sessionStorage`), cleared once shown and on every other
     load, never sent anywhere and never logged (P6).
3. **Money?** No.
4. **Messages or tracking?** No.
5. **User text?** F5-2 and F5-24.
   - Moderation is unchanged, including #100's hidden rule.
   - A save that can't find its trade writes nothing and says so: "This trade changed. Copy your note, reload the page,
     then save it again." It is never a silent drop and never a publish (U1).
   - The recovered text is shown only to its author.
6. **Sign-up or age?** F5-7. The attestation is unchanged and recorded only when a link is sent; a re-tick waits on Q2.
7. **Vendor or dependency?** None. `lib/broker.ts` is untouched.
8. **Screen reader and keyboard?** F5-7 and F5-21..F5-26 cover WCAG 2.2.1, 2.4.3, 3.3.1-3.3.3, 4.1.3 and 1.3.5, each
   with a 360 px e2e check. F5-25 stops static notices re-announcing on appended pages.
9. **Security?** F5-19 and F5-20 tighten it.
10. **Claims?** F5-6 removes a completeness claim, and F5-13 removes a "verified" claim on an empty page (F3a).
11. **Checkout?** No.
