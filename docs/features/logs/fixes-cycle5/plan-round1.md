# Fixes cycle 5: implementation plan, round 1 (UX lead)

Source: `docs/direction/cycle5-2026-11-01.md` section 5 (fixes list), with the evidence in 4.1 and the hand-offs in 7.
Scope: F5-2 and F5-4..F5-27. F5-1 and F5-3 are ballot items and are out of scope. Branch `claude/fixes-cycle5`, cut from
`origin/main` at e16d6aa7 (#101). I re-read every cited `path:line` there with `sed -n`. Where a line has moved, the
new line is given. I diffed every in-flight branch with `git diff origin/main...origin/claude/<b>`.

Status: draft for the business lead and the engineer to sign or send back. Only docs change; no code is edited here.

## 0. Rules for the build

- Every edit is additive and sits in a block marked `FIXES-CYCLE5` (a comment on the line, or `// ---- FIXES-CYCLE5 ----`
  … `// end FIXES-CYCLE5` around a block). New copy lives in one `FC5` object in `lib/copy.ts`, appended **after** the
  last export so it lands in no other branch's hunk (f16, f23 and f25 all edit `lib/copy.ts`).
- Schema additions go **mid-file**, beside the table they serve (after `db/schema.sql:118` and `:416`). f16, f24 and f31
  all append at the end of the file (after `:1131` and `:1097`), and a fourth append there would conflict.
- New tests only, named `lib/fixes-cycle5-*.test.ts` (DB tests `*.db.test.ts`, heavy ones `*.load.test.ts` under the
  existing LOAD switch) and `e2e/fixes-cycle5-*.spec.ts`. No existing test is weakened. If an existing fixture needs one
  added setup call (F5-4), that is an added line only.
- Performance is proven by plan shape and rows read (`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`, the `planNodes` /
  `rowsRead` pattern of `lib/likes.test.ts:185-260`). It is also proven by counting statements or builds through
  injected deps. Lock behaviour is proven with `NOWAIT` / `lock_timeout` probes, which turn a wait into an error. No
  acceptance line is a wall-clock bound. Each wall-clock line in the council doc is converted below and says so.
- No protected file is touched. Section 4 has every change that needs one.

## 1. Build order (merge hazards decide it)

| Batch | Items | Waits for | Why |
|---|---|---|---|
| **A, now** | F5-5, F5-6, F5-7, F5-9, F5-11, F5-12, F5-16, F5-17, F5-18, F5-19, F5-20, F5-21, F5-22, F5-23, F5-25, F5-27 | none | No in-flight hunk touches or adjoins these lines. Checked: f23's `page.tsx` hunk is at `:368` and F5-11 is at `:364`; f16's is at `:274` and F5-25 is at `:279`; f25 touches `me/hidden:35` and F5-21 touches `:25`; f25 touches `me/record:51-53` and F5-22 touches `:57-58` |
| **B, after #100 (f16) and f25 merge** | F5-2, F5-24, F5-26, F5-10, F5-13 | `claude/f16-f17-trust-safety` (#100), `claude/f25-one-link-rule` | f16 rewrites `app/u/[handle]/page.tsx:418` and `:422` (held line, note input) and `:314-316` (handle field), which are adjacent to our `:417`, `:421` and `:316`. f25 edits the month page and `app/t/[symbol]/page.tsx` |
| **C, after #84 (f24) merges** | F5-8, F5-15 | `claude/f24-late-postings` | f24 has hunks all over `rebuildTrades` and `syncUser` (`lib/sync.ts:131-188`, `:548-676`) and in `lib/options-sync.ts` |
| **D, after A-C** | F5-4 | f25 (`ticker-sql.ts`, `t/[symbol]/page.tsx`), f16 (stock image), f24 (`sync.ts`) | Largest change; touches all three |
| **Deferred** | F5-14 | F-23 (`claude/f23-payload-precision`) merges, then a re-measure | Decision in F5-14 |

## 2. Items

Column key: **Copy** = the exact user-facing words (POLICY: no advice, no completeness claim, no third-party name, losses
equal gains, percent only). **AC** = acceptance criteria → test file. **Files / overlap**. **Protected?**

### F5-2 (C5-3): a note and a report on it are keyed by the trade, not by its row id. Batch B

**Decision: post `trade_key` and lock by `(user_id, trade_key)`.** Reason: `trade_key` is already the app's stable public
key: a generated column `encode(sha256(sell_id))` (`db/schema.sql:415`, index `:416`). Likes use it (`lib/likes.ts:11`,
`:19-25`), #100 uses it for reports, and f25 uses it for reflections and every trade URL. The `sell_id` is the vendor's
id, and F-25 keeps it off every client.

Behaviour:
- **Profile loader.** `app/u/[handle]/load.ts:20` selects `trade_key`. Use exactly f25's line (`select id, sell_id,
  trade_key, symbol, …`), so the two identical edits merge cleanly.
- **Note form.** It becomes `<NoteForm>` (new client component `app/u/[handle]/note-form.tsx`, shared with F5-24). It
  posts `<input type="hidden" name="tradeKey" value={t.trade_key}>`; `tradeId` is dropped from the form.
- **Action.** `saveThesis` (`app/actions.ts:85-92`) becomes `saveNote(prev, form)` for `useActionState`, and it keeps
  working without JavaScript: React's server-action form posts and the page re-renders with the returned state. This is
  the pattern `app/report-note.tsx:10-19` already relies on. `saveThesis(form)` stays exported for no-JS pages rendered
  before the deploy, and it delegates.
- **`lib/thesis-save.ts`.**
  - `saveThesisFor(userId, ref, input)` accepts a 64-hex trade key, the same `TRADE_KEY_RE` as `lib/trade-href.ts` on
    f25. It returns `'saved' | 'changed'`.
  - The select at `:34` becomes `select id, thesis, … from closed_trades where user_id = ${userId} and trade_key = ${ref}
    for update`.
  - **When the select finds no row, it runs once more.** A row deleted by a rebuild while this save waited for its lock
    comes back empty in READ COMMITTED. The second statement takes a new snapshot and finds the rebuilt row.
  - The updates at `:38` and `:59` and the `kept_theses` delete at `:62` key on the locked `prev.id`, which is stable
    inside this transaction. f16's hunk (`:52-56`, the hidden rule) is untouched and merges cleanly.
- **Unknown key.** A key matching no row after the retry, or an old numeric id from a page rendered before the deploy,
  writes nothing and returns `'changed'`.
- **Reports.** Take #100's `lib/reports.ts` as is (its `TRADE_KEY` regex and `byKey` branch); add nothing there. The
  profile's `UserNote reportId` (`page.tsx:417`) passes `t.trade_key`. The trade page's `reportId`
  (`app/u/[handle]/trade/[sellId]/page.tsx:116`, from `lib/trade-share-load.ts:39`, `String(t.id)`) passes f25's
  `t.tradeKey`.
- **Comment.** Correct the comment at `lib/sync.ts:88-91`: "…or waits for this rebuild and then finds the rebuilt row by
  its trade_key (lib/thesis-save.ts re-reads once after the lock)".

**Copy (`FC5.noteChanged`):** "This trade changed; reload and save again." Where it shows:
- in a `role="alert"` paragraph directly under the field, which is also in the field's `aria-describedby`;
- focus stays on the field, and the typed text stays in it (`defaultValue` comes from the state), so nothing the trader
  wrote is lost;
- without JS, after the post: the same paragraph in the re-rendered row.

**AC → `lib/fixes-cycle5-notes.db.test.ts`:**
1. Load a row's key, run `rebuildTrades`, save with that key: the note is stored on the rebuilt row.
2. Open a rebuild transaction (rows locked, not committed) and start a save on the same key. Commit the rebuild: the
   save resolves to `'saved'` and the text is on the new row.
3. An unknown 64-hex key, and a numeric id, return `'changed'` and write nothing: `closed_trades` and `kept_theses` are
   unchanged, row for row.
4. Report a note by `trade_key` after a rebuild: it reaches the same note (a `thesis_reports` row on its `sell_id`).
5. Source scan: no `<form>` under `app/` has a hidden input whose value is `t.id` / `String(t.id)` for `tradeId` or
   `reportId`.

**e2e (`e2e/fixes-cycle5-notes.spec.ts`):** at 360 px, rebuild between page load and Save. The note shows after reload.
With an unknown key the alert text shows under the field and focus is on the field.

**Files:** `app/u/[handle]/page.tsx`, `app/u/[handle]/load.ts`, `app/u/[handle]/note-form.tsx` (new), `app/actions.ts`,
`lib/thesis-save.ts`, `lib/sync.ts` (comment only), `app/u/[handle]/trade/[sellId]/page.tsx`, `lib/copy.ts`.
**Overlap:** f16 (form line, held line, `saveThesisFor`), f25 (load line, trade page). **Protected:** no.

### F5-4 (C5-6): ticker pages read a per-trader, per-symbol summary. Batch D

**Decision: table `ticker_trader_sums`, kept by statement-level triggers on `closed_trades`.** Reason: rows are written
outside `rebuildTrades`, after it, by `lib/options-sync.ts:146` and `:225` (deletes), `lib/public-trades.ts:124`, the
seed, and about 40 test fixtures that insert `closed_trades` directly. A trigger keeps every one of them right without
touching them.

**Shape** (`db/schema.sql`, placed after the `trade_key` block at `:416`):

```
create table if not exists ticker_trader_sums (
  symbol text not null, user_id int not null references users(id) on delete cascade, verified boolean not null,
  n int not null, wins int not null, k int not null,           -- trades, wins (r > 0, not NaN), bets (gaps-and-islands)
  sx float8 not null, sd float8 not null,                      -- Σ bet log-return, Σ bet days
  sxx float8 not null, sxn float8 not null, snn float8 not null, sxd float8 not null, sdd float8 not null,
  first_open timestamptz, last_close timestamptz, last_closed_at timestamptz,  -- ms-cut, ms-cut, full precision
  primary key (symbol, user_id, verified));
index ticker_trader_sums_user on (user_id)
```

**Why these columns.** The "others" baseline (`app/t/ticker-sql.ts:286-317`) needs Σ(x_b − n_b·m)² and Σ(x_b − r·d_b)²
with global m and r. Both expand into the additive sums `sxx − 2m·sxn + m²·snn` and `sxx − 2r·sxd + r²·sdd`. So "all
other symbols" is the total minus this symbol, done in JS. Clamp at 0, since rounding can leave a tiny negative on an
all-identical record.

**Bets.** Bets are per `(user_id, symbol, verified)`, ordered `o, id`, exactly as `sideConfidence` clusters them today
(`:291-300`).

**Triggers.**
- One `after insert`, one `after update` and one `after delete`, each `for each statement` with a transition table (a
  multi-event trigger cannot have one).
- Each recomputes the affected `(user_id, symbol)` pairs from `closed_trades` where `filing_url is null`, using the
  per-user index.
  - Insert upserts.
  - Update and delete update existing summary rows only. They never insert, so a cascaded user delete never inserts a
    row for a user that is going away.
- A pair with no rows left keeps a zeroed row. The schema guard bans `delete from` in `db/schema.sql`
  (`scripts/autopilot.ts:208`), so the trigger body cannot delete.
- Reads filter `n > 0`. Zero rows go with the user (FK cascade) on profile deletion.
- Updates that change none of `symbol, return_pct, holding_days, opened_at, closed_at, verified, filing_url` return
  early. These are the thesis saves and report holds.

**Contention.** The PK leads with symbol but includes `user_id`. A trader's rebuild writes only that trader's rows, so
two rebuilds of traders who share a symbol never wait on one row.

**What is in it:**

| Records | In it? |
|---|---|
| Demo users | Yes, as today. `verified = false`, so `demoOnly` and `mixed` come out the same |
| Public filers | No. `filing_url is null` at write time, the same rule as `tradesOf` (`:41`) |
| Frozen records | Yes. Their `closed_trades` rows stay, and the summary follows the rows |
| Hidden or deleted users | Excluded at read time by joining `users u … ${visibleUser('u')}`, f16's predicate once merged. Never baked in, because hiding does not trigger a rebuild |

**Reads.**
- **Per-symbol figures stay live from `closed_trades` by symbol.** These are the summary, charts, list and "this side"
  (`scopes`, `bets`, `timeline`, `spread`, `sideConfidence(…'this')`). They read only that symbol's rows through
  `closed_trades_symbol`.
- **Totals: one `symbolTotals()` statement.** It reads `ticker_trader_sums join users (visible) where n > 0 group by
  symbol, verified`, one row per symbol and trust: Σ of every column, `count(*)` as traders, min/max dates.
- **Caching.** The result is cached per 60 s bucket. It shares F5-5's `lib/bucket-cache.ts`: single flight, LRU of 4
  entries.
- **What reads the totals.** The `/t` index (total, prefix filter, two sorts, done in JS over the cached list; `collate
  "C"` equals JS code-point order for normalized ASCII symbols). The "others" baseline is total minus this symbol, from
  the same cached snapshot, so the two sides always agree.
- **Spans.** "Others" min/max dates come from the per-symbol rows of the same list (the global first and second extremes).
- **Related symbols.** `relatedSymbolsSql` (`:220-235`) reads `ticker_trader_sums` for the users of this symbol
  (`user_id` index).
- **The stock image.** `app/t/[symbol]/opengraph-image.tsx:33` reads this symbol's summary rows, which needs only n,
  traders, demoOnly and mixed. That resolves its ponytail at `:31-32`.
- The ponytails at `app/t/ticker-sql.ts:243` and `:277-280` are resolved and removed.

**Staleness (copy-free):** the `/t` index counts and the baseline lag a rebuild by at most one bucket (60 s) on each
server. The stock page's own figures stay live.

**Backfill:** `scripts/db-setup.ts` already applies the schema. The trigger file adds one idempotent
`insert … select … on conflict do update` over all pairs, run when `ticker_trader_sums` is empty. It is cheap: one
grouped scan, once.

**AC → `lib/fixes-cycle5-ticker.db.test.ts` (shape) and `lib/fixes-cycle5-ticker.load.test.ts` (LOAD):**
1. **Equality.** On every existing ticker fixture (`lib/ticker-sql.test.ts`, `lib/ticker-others.test.ts`,
   `lib/ticker-baseline.test.ts`), `/t`, `/t/SYMBOL`, the baseline and the image figures equal today's to the printed
   precision.
2. **Drift guard.** After random fictional inserts, updates, deletes, `rebuildTrades`, the options deletes and a user
   delete, the summary equals a recompute from `closed_trades` for every pair. No orphan row survives a user delete.
3. **Plan shape.** Replaces the council's "<300 ms p95 at 2 M". It uses a fixture of 20,000 closes over 400 symbols, run
   under `force_custom_plan` and `force_generic_plan`:
   - no node of any `/t` or `/t/SYMBOL` statement is a Seq Scan on `closed_trades`;
   - every `closed_trades` node reads at most that symbol's row count + 1;
   - `symbolTotals()` has no `closed_trades` node at all.
   LOAD repeats it at 2 M closes.
4. **Single flight.** Replaces "10 concurrent requests, profile ≤ 2×". With an injected build counter, 10 concurrent
   `/t/SYMBOL` loads and 50 concurrent `/t` loads in one bucket run `symbolTotals()` once.
5. **No waiting.** Two traders share a symbol. While A's rebuild transaction is open and uncommitted, B's
   `rebuildTrades` under `set local lock_timeout = '50ms'` completes. A wait would raise `lock_not_available`.
6. **Visibility.** A hidden user's trades (once f16 merges) and a deleted user's trades are absent from every total
   after the next bucket. A demo-only symbol still reads demoOnly. A public filer's filings are never counted.

**Files:** `db/schema.sql` (additive, mid-file), `app/t/ticker-sql.ts`, `app/t/page.tsx`, `app/t/[symbol]/page.tsx`,
`app/t/[symbol]/opengraph-image.tsx`, `lib/bucket-cache.ts` (from F5-5). Existing ticker fixtures get no change: the
trigger covers them. **Overlap:** f25 (`ticker-sql.ts`, the `t/[symbol]` page), f16 (stock image), f24 (sync). Build
last. **Protected:** no.

### F5-5 (C5-7): feed page 1 shares one list per minute. Batch A

**Decision: bucket on the database clock, through a per-process offset.** `FEED_BUCKET_MS = 60_000`. The asOf is
`floor((Date.now() + dbOffset) / 60 s) · 60 s`. `dbOffset` is sampled by `select extract(epoch from clock_timestamp())`
at most every 5 minutes, single flight, and kept on failure at its last value or 0. Reason: every server lands on the
same bucket key, so a later page built on another server ranks the same list. A pinned `asOf` is never ahead of the
database clock. And no visit pays an extra round trip.

- **Keep the pager pure.** `firstPage(now)` stays pure, and `loadFeedPage` passes the bucketed `now` to it. The cursor's
  skew check (`lib/discovery/pager.ts:11`, 60 s) still holds, because the bucket is never ahead of the app clock by more
  than the measured offset. If `|dbOffset| > SKEW_MS`, fall back to the app clock and say so with a `console.warn` (no
  values).
- **In-flight sharing.** `listFor` (`lib/feed.ts:469-481`) keeps a `Map<key, Promise<Kept>>`. Concurrent callers on one
  key await one `feedList`. A rejected build is removed, so the next caller retries.
- **LRU 256.** Keep `LIST_CACHE_MAX = 256` and make it LRU: re-insert on a hit, evict the oldest past the cap, and keep
  the 48 h age rule. Today's loop at `:477` deletes from the front whenever the map is full, so it evicts entries still
  in use. With per-minute keys a day is 1,440 keys at most, and the lists in use are the recent ones.
- Generic helper `lib/bucket-cache.ts`: `bucketed(key, build, {max})`, single flight plus LRU. F5-4 reuses it.

**Copy:** none.

**AC → `lib/fixes-cycle5-feed.test.ts` (pure, with an injected clock and offset) and `lib/fixes-cycle5-feed.db.test.ts`:**
1. Two page-1 calls in one bucket run `feedList` once (injected counter). So do 50 concurrent ones.
2. A page-2 cursor from bucket t still slices its own list after 1,000 page-1 builds across 1,000 other keys. LRU: the
   cursor's list was read last, so it is not evicted while 255 newer keys fit.
3. The bucket never exceeds the database clock: with an offset of −30 s, the asOf is ≤ `clock_timestamp()`.
4. A failed build is not cached: the next call builds again.
5. Replaces "warm p95 < 400 ms". The existing LOAD budget test (`lib/feed.crafted.load.test.ts`) stays as is. This
   change adds no time bound.

**Files:** `lib/feed.ts` (only `:463-481`; f16's nearest hunk is at `:520`), `lib/discovery/pager.ts` (one exported
const), `lib/bucket-cache.ts` (new). **Overlap:** none on these lines. **Protected:** no.

### F5-6 (C5-8): the connect notice says "the full trade history your broker provides". Batch A

**Copy:** `lib/copy.ts:51` becomes "Every account under this login and the full trade history your broker provides are
included. Nothing is imported until you confirm on the next screen." This is `:94`'s phrase. It makes no completeness
claim (POLICY F3a).
**AC → `lib/fixes-cycle5-copy.test.ts`:** both connect lines contain "your broker provides"; no connect line contains
"your full trade history".
**Files:** `lib/copy.ts:51` (one line; f16, f23 and f25 do not touch `:51`). **Legal committee re-signs the connect
copy** (council: part 1 of brief rank 8). **Protected:** no.

### F5-7 (C5-9): the email error keeps the trader in place. Batch A

**Decision on the 18+ box while owner Q2 is open:** the box stays unticked, and the alert names it in words. Reason:
COMPLIANCE §4 and §12 make a re-ticked box a legal question. The council's "if silent" answer is exactly this.

**Copy:**
- `SIGNIN.emailError` becomes "Enter a full email address, like name@example.com." The domain is IANA's reserved
  example, so the scanner allows it.
- New `FC5.attestAgain`: "Then tick “I am 18 or older” again." It is the same element, the second sentence of the
  email alert. It shows only while the box is unticked, which is always until Q2 is answered. These are the exact
  opening words of the box's label (`lib/copy.ts:17`), so a voice-control user can say them.

**Behaviour** (`app/login/page.tsx`):
- `error=email`: `#email` gets `autoFocus` and keeps `aria-describedby="email-err"` (`:43`). `#email-err` keeps
  `role="alert"` (`:44`), because the alert still speaks if autofocus fails. The typed address is kept (`typed`, `:33`).
- `error=rate` (`:45`): the paragraph gets `id="email-rate" tabIndex={-1}` and `<FocusHeading id="email-rate" />`, the
  pattern `:62` uses for `closed`.
- The box (`:74`) is unchanged.

**AC → `e2e/fixes-cycle5-a11y.spec.ts`:**
1. Tick the box, type `trader@mailhost`, press Enter: `#email` is focused, its accessible description contains "like
   name@example.com" and "I am 18 or older", and its value is still `trader@mailhost`.
2. Shift+Tab reaches the box, Space ticks it, the address is fixed, and one Enter reaches `/login/sent`.
3. `error=rate`: the alert is the focused element.

**Unit (`lib/fixes-cycle5-copy.test.ts`):** the copy strings, and no advice or promo words.
**Files:** `app/login/page.tsx`, `lib/copy.ts`. **Overlap:** none. **Legal committee:** sign-up copy re-sign
(COMPLIANCE §7). **Owner:** Q2. **Protected:** no.

### F5-8 (C5-11): rebuild paging keeps microseconds. Batch C

Behaviour:
- `${after.at}::timestamptz` becomes `${after.at}::text::timestamptz` at `lib/sync.ts:136` and
  `lib/options-sync.ts:93`, as `releaseClaim` does (`lib/sync.ts:293`).
- Both already select `executed_at::text as at`; the options query should also select its `at` as text. Verify on the
  f24 tree, since f24 rewrites `:131-188`.

**AC → `lib/fixes-cycle5-sync.db.test.ts`:** 2,500 share activities with microsecond times over 3 rebuild pages give
`closed_trades` equal to `matchTrades` over the whole set (no duplicate-key error). The same holds for options, over 3
option pages. **Files:** `lib/sync.ts`, `lib/options-sync.ts`. **Overlap:** f24. **Protected:** no.

### F5-9 (C5-19): the /me/record takeaway never names one side alone. Batch A

**Copy** (`lib/insights.ts:61-64`; floor `MIN_TRADES = 5`, `:5`). The rule is symmetric, so losses read like gains:
- both averaged: unchanged, "Your average win was +6.5% and your average loss was −4.0%.";
- wins only: "Your average win was +6.5%; 3 losses, too few to average." (with 1, "1 loss, too few to average"; with 0,
  "no losses.");
- losses only: "Your average loss was −4.0%; 2 wins, too few to average." (with 1, "1 win, too few to average"; with 0,
  "no wins.").

**AC → `lib/fixes-cycle5-labels.test.ts`:** 5 wins and 3 losses gives a sentence holding both counts; 3 wins and 5
losses is the mirror; the 1 and 0 forms; the copy passes the promo scan. **Files:** `lib/insights.ts`. **Overlap:**
none. **Protected:** no.

### F5-10 (C5-20): a gain is never "Worst trade". Batch B

**Copy:** "Best trade" when its return is above 0, otherwise "Highest return". "Worst trade" when its return is below 0,
otherwise "Lowest return". The rule is symmetric: a loss is never "Best trade" either.

**Behaviour** (`app/u/[handle]/month/[ym]/page.tsx:117`):
- 1 trade: today's "Only trade this month" stays.
- 2 trades: no pick cards. The full list right below shows both, so nothing repeats.
- 3 or more: the two picks.

**AC → `lib/fixes-cycle5-labels.test.ts`** (a pure `pickTitles(best, worst, count)` in `lib/recap.ts`, FIXES-CYCLE5
block): all four sign cases, 2 trades → none. **`e2e/fixes-cycle5-pages.spec.ts`:** an all-gain fictional month shows
"Lowest return" and never "Worst trade".
**Files:** the month page, `lib/recap.ts`. **Overlap:** f16 and f25 both edit the page; rebase on whichever lands first.
**Protected:** no.

### F5-11 (C5-21): a ratio below 1 never prints as 1.00. Batch A

**Behaviour:** `cut2(x) = (Math.floor(x * 100 + 1e-9) / 100).toFixed(2)` in `lib/trades.ts` (FIXES-CYCLE5 block). The
epsilon stops `0.29 * 100 = 28.999…` printing "0.28". Used at `app/u/[handle]/page.tsx:364` only; it is the only
`profitFactor` print.
**Copy:** unchanged ("profit factor"). Whether the stat stays at all is OD 2.36.
**AC → `lib/fixes-cycle5-labels.test.ts`:** 0.997 → "0.99"; 1.003 → "1.00"; 0.29 → "0.29"; 2.5 → "2.50"; 1 → "1.00";
a value just under 1 (0.9999) → "0.99". **Files:** `lib/trades.ts`, page `:364`. **Overlap:** f23's hunk at `:368` is
not adjacent. **Protected:** no.

### F5-12 (C5-22): the chart header keeps "Nov 1" together. Batch A

**Behaviour:** `chartRestSub` (`lib/chart-sub.ts:7-8`) puts the date through `.replace(/ /g, ' ')`, so the date
never breaks inside itself and "last close" still wraps. No CSS change (`app/globals.css:645` stays).
**AC:**
- Unit (`lib/fixes-cycle5-labels.test.ts`): the subline holds "Nov 1" and "Nov 1, 2025".
- e2e (`e2e/fixes-cycle5-pages.spec.ts`) at 320 px: the date's text nodes share one line box, so the date's range has a
  single client rect. The header's right edge is ≤ the plot's left edge + width.

**Files:** `lib/chart-sub.ts`. **Overlap:** none. **Protected:** no.

### F5-13 (C5-23): an empty stock page's title says it is empty. Batch B

**Copy:** when `s.n === 0`, the title is "No closed trades in ‹TICKER› yet · Stock Social". It follows the
`FL.tickerTitle` suffix form (`lib/copy.ts:298`) and makes no "verified" claim. The 200 status and `noindex` stay,
because the empty page can still show open positions (`app/t/[symbol]/page.tsx:72-73`).
**AC → `e2e/fixes-cycle5-pages.spec.ts`:** `/t/ZZZZQ` has exactly that title and status 200; a symbol with trades keeps
today's title. **Files:** `app/t/[symbol]/page.tsx:55-56`, `lib/copy.ts`. **Overlap:** f25 edits this page.
**Protected:** no.

### F5-14 (C5-12): a heavy profile sends a bounded chart series. Deferred

**Decision: defer until F-23 merges.** Reason: F-23 rewrites the same wire format (`lib/paging.ts#packPoints`, and
`lib/chart-series.ts`, `lib/downsample.test.ts` and `app/u/[handle]/chart.tsx` on `claude/f23-payload-precision`). A
downsampler built now would be rebuilt there. Section 7 already asks F-23 to re-measure 80,000 closes first.

- **No code marker now.** Every candidate line is in an F-23 hunk.
- **When F-23 lands,** the F5-14 build adds `// ponytail:` only if F-23's measure is still above the bound.
- **Its AC is deterministic.** An 80,000-close fixture renders at most 300 KB gzipped (bytes, not ms). The chart's
  printed figures (end value, range, low and high) equal full resolution. The full list stays paged.
- The council's "500 ms" line is dropped as wall-clock.

**Protected:** no.

### F5-15 (C5-13): vendor reads happen before the rebuild's locks. Batch C

**Behaviour:** inside `syncUser`'s transaction, the `broker.fetchPositions` calls (`lib/sync.ts:603-640`) move before
`await rebuild(user.id, tx)` (`:602`).
- They collect `Map<accountId, {rows, split}>` for both branches (`!opts.cadence` and cadence).
- Every write (`replaceListedPositions`, `settleAccountPositions`, the upsert, `moveUnlisted*`,
  `replaceAccountOptionPositions`) stays after the rebuild, in today's order, in the same transaction. So the freeze and
  option-split atomicity holds.
- The per-user advisory lock is unchanged. Note saves do not take it; they only wait on `closed_trades` row locks, which
  the rebuild takes.
- The `clock_timestamp()` stamp after the vendor calls (the cadence branch, `:643+`) stays where it is.

**AC → `lib/fixes-cycle5-sync.db.test.ts`.** Replaces "note save < 500 ms":
1. While a fake `fetchPositions` is pending on a promise the test holds, `select … from closed_trades where user_id = $1
   for update nowait` from a second connection succeeds, and so does a `saveThesisFor`.
2. After release, `open_positions` and `option_positions` equal today's for the same fake rows (a property test over
   both branches).

**Files:** `lib/sync.ts`. **Overlap:** f24 rewrites `:548-676`; build on #84's tree. **Protected:** `lib/broker.ts` is
not touched.

### F5-16 (C5-14): DB tests clean up after themselves. Batch A

**Behaviour:**
- `lib/trades-prompt.db.test.ts` (`:12-18`) and `lib/f15-share-action.db.test.ts` (`:13-20`) record each user and
  signup-attempt id they create.
- An added `after` hook (before `sql.end`) deletes them: the users (cascade), then the `signup_attempts` by id, then the
  funnel and event rows the suites wrote, by those user ids.
- Both helpers are additive lines.

**AC → `lib/fixes-cycle5-cleanup.db.test.ts`:** each file, run as a child `node --test` process, leaves the row counts
of `users`, `signup_attempts` and the funnel tables equal before and after. The suite-wide check is a protected CI step
(Owner item 2). **Overlap:** f25 edits `lib/f15-share-action.db.test.ts` (5 lines, `:20-30` region); keep our lines in
the `after` hook only. **Protected:** the CI step only.

### F5-17 (C5-15): the deploy rebuild says why a record failed. Batch A

**Behaviour:** `lib/matcher-rebuild.ts:38` changes `catch { failed++; }` to `catch (e) { failed++; const c = logSafe(e);
byClass[c] = (byClass[c] ?? 0) + 1; }`. The `:41` line logs `JSON.stringify({ count: failed, byClass })`: class names
only, never a user id with the cause (POLICY P6). The ponytail at `:12` stays; that is brief rank 9.
**AC → `lib/fixes-cycle5-ops.db.test.ts`:** one record whose rebuild throws a `TypeError` still lets the others be marked
in `matcher_rebuilt`. The log line holds `"TypeError":1` and no user id or handle. **Overlap:** none. **Protected:** no.

### F5-18 (C5-16): housekeeping deletions stop at the deadline. Batch A

**Behaviour** (`app/api/sync/route.ts:61-62`):
- **Order.** Pending deletions are read `order by deletion_next_at nulls first, id`, `limit DELETIONS_PER_CALL` (5).
- **Deadline.** Each one starts only while `Date.now() < deadline - VENDOR_TIMEOUT_MS`. `deadline` is already
  `syncDeadline`, which reserves `SYNC_RESERVE_MS`.
- **Backoff.** A failure sets `deletion_attempts + 1` and `deletion_next_at = now() + least(2^attempts minutes, 24 h)`.
  These are two additive columns on `users`, placed beside its other columns, not at the end of the file.
- A deletion is never skipped for good. Data is removed by the next call that reaches it (POLICY P6), and the backoff
  only reorders.

**AC → `lib/fixes-cycle5-ops.db.test.ts`** (fake clock, injected `deleteProfile`):
1. With 20 hanging deletions, the call starts at most 5, stops at the deadline, and still runs `purgeDiscovery` and the
   sync stage.
2. A failed one is retried later and is not first in line again.
3. All 20 complete over successive calls.

**Files:** the route, `db/schema.sql` (additive, mid-file), `lib/delete.ts` (signature unchanged). **Protected:**
`lib/broker.ts:146` unchanged.

### F5-19 (C5-17): no `X-Powered-By`. Batch A

`poweredByHeader: false` in `next.config.ts` (documented in `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/poweredByHeader.md`).
**AC → `e2e/fixes-cycle5-pages.spec.ts`:** `/`, `/u/<demo>`, `/t`, an image route and `/api/sync` (401) carry no
`x-powered-by`. **Protected:** no.

### F5-20 (C5-18): a public production start needs its own session secret. Batch A

**Decision: the switch is `SESSION_SECRET_REQUIRED=1`, an env var read only in `lib/secret-env.ts#assertSecrets`.** The
owner sets it in the deploy environment together with a distinct `SESSION_SECRET` when launch row 5 is signed off.
Reason: a dedicated switch can't take the current deploy down by surprise. Tying it to `LAUNCH_OPEN` would fail the very
deploy that opens sign-up.

**Behaviour.** It runs on the same production path as today's checks (`:13-18`; skipped in dev, the build and
`ALLOW_DEV_AUTH=1`).
- **Switch off.** If `SESSION_SECRET` is missing or equals `APP_SECRET_KEY`, `console.warn` once per process:
  `secret-env: SESSION_SECRET missing or shared with APP_SECRET_KEY (launch row 5)`, with a process-lifetime count
  appended (`{"count":1}`) and never a value.
- **Switch on.** The same cases throw `new SecretEnvError('SESSION_SECRET')`.
- `lib/auth/sessions.ts:13`'s fallback is unchanged; it is the dev path. `lib/session.ts` is not touched.
- `.env.example` gains `SESSION_SECRET_REQUIRED=` (empty placeholder) with a one-line comment.

**AC → `lib/fixes-cycle5-ops.test.ts`:** warns and doesn't throw, for both missing and equal, with the switch off;
throws for both with it on; a distinct strong secret passes either way; the message never contains either secret's
value. **Protected:** CLAUDE.md's Commands line (Owner item 1). Deploy env settings are the owner's (POLICY H).

### F5-21 (C5-24, F3-24): Undo waits for the reader. Batch A

**Decision on timing:** the bar stays at least 20 s (`UNDO_MS` 5,000 becomes 20,000 at `app/follow-button.tsx:14`). It
pauses while focus is anywhere inside the bar, whatever the input (touch, screen reader or keyboard), or while the
pointer is over it. When the reader leaves, a fresh 20 s starts, so a paused bar never closes the moment focus leaves.
Reason: WCAG 2.2.1 allows a limit the user can extend, and 20 s covers a screen reader reading the bar and its two
buttons. Applied at `app/feed-hides.tsx:56-61`: `paused()` checks `bar.contains(document.activeElement)` and drops the
`keys` and `:focus-visible` condition.

**Copy:** a new Dismiss button in the bar, `FC5.dismiss` "Dismiss". It is a 44 px target, after Undo. It closes the bar
and returns focus to the card (`toCard`, `:40-52`), the same as the timeout path.

**/me/hidden "Show again":** on `?back=` the status paragraph (`app/me/hidden/page.tsx:25`) gets `id="hidden-back"
tabIndex={-1}` and `<FocusHeading id="hidden-back" />`. Focus lands on "‹…› is back…" (the existing `HIDDEN_TRADES.back`
text), which sits under the heading, and Tab continues into the list. This is the council's "or the heading", the one
choice that works on a full no-JS reload.

**AC → `e2e/fixes-cycle5-a11y.spec.ts`** (Playwright clock):
1. Hide a trade by touch emulation: the bar is still there at 19 s and gone at 21 s.
2. With focus moved to Undo by tap or screen reader, the bar is still there at 60 s. After focus leaves, it is gone 20 s
   later.
3. Dismiss closes the bar and focuses the next card's name.
4. On /me/hidden, Show again → the focused element is `#hidden-back`, and its text names the trader.

**Files:** `app/follow-button.tsx`, `app/feed-hides.tsx`, `app/me/hidden/page.tsx`, `lib/copy.ts`. **Overlap:** f25 at
`me/hidden:35` is not adjacent. **Protected:** no.

### F5-22 (C5-25): /me/record rule forms keep focus and say what changed. Batch A

**Behaviour:** `setRule` (`app/actions.ts:186-199`) ends with `redirect('/me/record?rule=<kind>&did=set|clear#rule-<kind>')`
instead of only `revalidatePath`. The kind is checked by `isRuleKind`.
- The rule `<section>` (`app/me/record/page.tsx:213`) gets `id="rule-<kind>"`.
- Its `<h3>` gets `id="rule-<kind>-h" tabIndex={-1}`.
- When `rule`/`did` match, a `<p role="status" className="small">` sits right under the h3, plus `<FocusHeading
  id="rule-<kind>-h" />`.
- Without JS, the fragment scrolls there.
- The tag buttons lose `<span className="sr-only"> Selected, tap to clear</span>` (`:57-58`); `aria-pressed` carries the
  state.

**Copy:** `FC5.ruleSet(label)` "Rule set: ‹label›." (e.g. "Rule set: Close losing trades within 5 days."), and
`FC5.ruleCleared` "Rule cleared." The label is `RULE_LABEL` with N replaced (`lib/rules.ts:7-10`). Neither is advice: it
describes the trader's own rule.

**AC → `e2e/fixes-cycle5-a11y.spec.ts`:** Set → the h3 is focused, the status reads "Rule set: …", and the h3's top is in
the viewport at 360 × 640. Clear → the h3 is focused and the status reads "Rule cleared.". **`lib/fixes-cycle5-a11y.test.ts`**
(source scan): no "tap to clear" under `app/`.
**Files:** `app/actions.ts`, `app/me/record/page.tsx`, `lib/copy.ts`. **Overlap:** f25 at `:51-53`; ours is at `:57-58`
and `:213-216`. **Protected:** no.

### F5-23 (C5-26): delete step 1 focuses its alert. Batch A

**Behaviour:** `app/settings/page.tsx:33` becomes `<p id="delete-confirm" role="alert" tabIndex={-1}><b>{SETTINGS.confirm}</b></p><FocusHeading id="delete-confirm" />`.
The delete button gets no autofocus.
**AC → `e2e/fixes-cycle5-a11y.spec.ts`:** `/settings?confirm=1` → the focused element is `#delete-confirm`; the next Tab
is the final delete button. **Copy:** unchanged. **Protected:** no.

### F5-24 (C5-27): the note field has a visible label and states its limit. Batch B, with F5-2

**Decision on the field:** a `<textarea rows={3} maxLength={280}>`, full width at 360 px, inside F5-2's `<NoteForm>`.

**Decision on the counter:**
- Below the field there is a visible counter "‹n› of 280" (`FC5.noteCount(n)`, ≥ 4.5:1, muted small), in the field's
  `aria-describedby`, so it is read on focus. It is not a live region on every keystroke.
- One polite live region speaks only on crossings: "20 characters left" when the count reaches 260, and "Limit reached,
  280 of 280" at 280.
- Without JS, the server renders "Up to 280 characters." in the same slot.

Reason: announcing on every keystroke drowns out typing, and threshold announcements give the same warning.

**Copy:**
- label (visible, `<label htmlFor>`): "Your note";
- placeholder kept: "Why did you take this trade?";
- `FC5.noteCount(n)`: "‹n› of 280";
- `FC5.noteNear`: "20 characters left";
- `FC5.noteFull`: "Limit reached, 280 of 280";
- `FC5.notePasteCut`: "Your paste was cut to 280 characters." This is spoken in the same polite region and shown under
  the field until the next input. `onPaste` detects it: current length − selection + pasted length > 280.

**Behaviour:**
- Carry #100's held attributes onto the textarea (`aria-describedby` held id, `aria-invalid` when held). The accessible
  name includes the symbol through `aria-describedby` on a visually hidden "on ‹SYMBOL›", so each row's field stays
  distinct.
- "Edit it on your profile" (`lib/report-copy.ts:46`, href from `lib/own-note.ts:19` via `lib/paging.ts:33`): the anchor
  becomes `#note-<id>`, the textarea's id. `RowFocus` (`app/u/[handle]/row-focus.tsx:11`) also accepts `^note-\d+$` and
  focuses the field.

**AC:**
- `e2e/fixes-cycle5-notes.spec.ts` at 360 px:
  1. The filled field shows its visible label, and `getByLabel('Your note')` finds it.
  2. A 280-character note shows at least 3 lines.
  3. A 300-character paste stores 280 and shows and announces the cut line.
  4. The counter reads "280 of 280".
  5. From a trade page's held line, "Edit it on your profile" lands with the textarea focused.
- `lib/fixes-cycle5-a11y.test.ts` (source scan): no `<input type="text" name="thesis"`.

**Files:** `note-form.tsx`, the profile page, `lib/paging.ts#tradeHref` (anchor), `row-focus.tsx`, `lib/copy.ts`.
**Overlap:** f16 (same line). **Protected:** no.

### F5-25 (C5-28): static failed-import notices carry no live-region role. Batch A

**Behaviour:** `WarnNotice`'s `role` becomes optional (`app/warn-notice.tsx:5`). Static uses drop it:
- `app/record-strip.tsx:32`;
- `app/ui.tsx:104`;
- `app/pane.tsx:71`;
- `app/u/[handle]/page.tsx:279`, both the `alert` and the `status`. The page is rendered on load, so nothing changes in
  place.

This is as F3-16 decided.

**AC → `lib/fixes-cycle5-a11y.test.ts`:** a source scan finds no `<WarnNotice role=` in `app/`. The unit render has no
`role` attribute when none is given. **Overlap:** f25 `ui.tsx:116`, f23 `pane.tsx:58-60` and `:82`, f16 `page.tsx:274`:
none adjacent. **Protected:** no.

### F5-26 (C5-29): `autocomplete="username"` on the handle field. Batch B

The attribute goes on `#new-handle`, which is `app/u/[handle]/page.tsx:316` on main and f16's rewritten line after #100.
**AC → `lib/fixes-cycle5-a11y.test.ts`:** a source scan finds `id="new-handle"` with `autoComplete="username"`.
**Overlap:** f16 rewrites that line. **Protected:** no.

### F5-27 (C5-44): one definition of the three-column symbol index. Batch A

**Behaviour:**
- `db/schema.sql:118` becomes `schema_add_index('closed_trades_symbol_recent', 'create index closed_trades_symbol_recent
  on closed_trades (symbol, closed_at desc, id desc)')`.
- The stale `:791` line is removed. That is a deleted line, not an added `drop`, so the guard passes.
- Upgraded databases keep the old `closed_trades_symbol` (2 or 3 columns) until the owner drops it (Owner item 3).
- Update the comment references in `lib/sitemaps.ts:6` and `:42` to the new name. `sitemaps` relies on the default
  collation order, which both indexes give.

**AC → `lib/fixes-cycle5-schema.db.test.ts`:**
- A fresh schema has `closed_trades_symbol_recent` on `(symbol, closed_at desc, id desc)`.
- A database pre-seeded with the old two-column `closed_trades_symbol` gains the new index after `db/schema.sql` runs.
- EXPLAIN of the `/t/SYMBOL` list uses the new index.

**Protected:** the drop on upgraded databases is an owner step.

## 3. States walk (UX check per surface)

| Surface | Empty | Error | New trader | All losses | Demo | Signed out |
|---|---|---|---|---|---|---|
| Note form (F5-2/24) | Field empty, "Up to 280 characters." / "0 of 280" | "This trade changed; reload and save again." under the field, focus kept | Same | n/a | Demo profiles have no owner form | Not rendered |
| Month picks (F5-10) | No month page | n/a | 1 trade: "Only trade this month" | "Highest return" + "Worst trade" | Same labels, Demo badge as today | Same |
| /me/record (F5-9, F5-22) | Few trades: FEW text as today | Rule out of range: browser validation as today | Rules "Not set" | "Your average loss was −x%; 2 wins, too few to average." | Footer "(including demo data)" as today | Redirects to /login as today |
| /login (F5-7) | Empty address → same email error | email, rate, attest each focus their field or alert | n/a | n/a | n/a | Only state |
| Stock page (F5-4, F5-13) | "No closed trades in X yet" title, open positions if any | Baseline read fails → section left out (as today) | n/a | Losses ranked as gains (unchanged) | demoOnly / mixed from the summary | The only audience |
| Undo bar (F5-21) | n/a | Server refusal → `FOLLOW.failed` with no Undo (as today), and Dismiss is offered | n/a | n/a | n/a | No hide control signed out |

## 4. Owner items (protected or owner-only; exact proposed change)

1. **CLAUDE.md, Commands** (protected). `cp .env.example .env # then fill APP_SECRET_KEY and CRON_SECRET with random
   strings` becomes `cp .env.example .env # then fill APP_SECRET_KEY, CRON_SECRET and SESSION_SECRET with distinct
   random strings`.
2. **`.github/workflows/ci.yml`** (protected; council owner Q4). In the unit-test job, add a step before `npm test` and
   one after it:
   ```yaml
   - name: Row counts before tests
     run: psql "$DATABASE_URL" -Atc "select string_agg(relname || '=' || n_live_tup, ',' order by relname) from pg_stat_user_tables" > /tmp/rows-before
   # existing: - run: npm test
   - name: Tests leave no rows behind
     run: |
       psql "$DATABASE_URL" -c "analyze" >/dev/null
       psql "$DATABASE_URL" -Atc "select string_agg(relname || '=' || n_live_tup, ',' order by relname) from pg_stat_user_tables" > /tmp/rows-after
       diff /tmp/rows-before /tmp/rows-after
   ```
   Merge only after F5-16 and the other suites are clean. Until then it would fail on leaks the council has already
   counted (about 7,400 funnel events per run). The council recommends "merge when green".
3. **Upgraded databases:** run `drop index if exists closed_trades_symbol;` once, after F5-27 deploys. An agent can't
   add a `drop` (schema guard).
4. **Deploy env** (POLICY H): set a distinct `SESSION_SECRET` (≥ 32 random characters), then `SESSION_SECRET_REQUIRED=1`
   when launch row 5 is signed off.
5. **Owner Q2** (18+ tick survives an email error). Until it is answered, F5-7 ships with the box unticked and named. A
   "yes" changes one line: re-render the box ticked on `error=email` only, and drop `FC5.attestAgain`.
6. **Legal committee re-signs** (not owner): the F5-6 connect line, and F5-7's sign-up error copy.

## 5. COMPLIANCE Section 1 answers (for every PR of this batch)

1. Performance shown or ranked? Yes:
   - F5-4: same figures, new source;
   - F5-9, F5-10, F5-11: labels.
   Disclaimers are unchanged on every surface. Losses are treated as gains (F5-9 and F5-10 are symmetric). No advice
   words (scanned in `fixes-cycle5-copy.test.ts`). No security is rated: F5-13's title states a count.
2. Personal data? F5-4 stores derived per-trader sums (no prices, quantities or amounts, POLICY P3). They are deleted by
   cascade with the user, and hidden users are excluded at read time. F5-18 adds two retry columns. F5-17's log carries
   error classes only. Nothing new is public.
3. Money? No.
4. Email, push, tracking? No.
5. User text? F5-2 and F5-24 (notes). Moderation is unchanged (`moderateDetail`, #100's hidden rule kept); nothing is
   dropped silently; a stale save writes nothing and says so (U1).
6. Sign-up or age? F5-7. The attestation is unchanged and recorded only when a link is sent. The re-tick waits on owner
   Q2.
7. Vendor, dependency, asset? No new dependency. No vendor file is touched (`lib/broker.ts` stays as it is).
8. Screen reader and keyboard? F5-7 and F5-21..F5-26 are accessibility fixes (WCAG 2.2.1, 2.4.3, 3.3.1-3.3.3, 4.1.3,
   1.3.5), each with an e2e check at 360 px.
9. Security posture? F5-19 (header) and F5-20 (secret separation) tighten it. CSRF and the server-action origin checks
   are unchanged.
10. Product claims? F5-6 removes a completeness claim (F3a).
11. Checkout? No.

## 6. Open points for the business lead and the engineer

- **F5-4 trigger cost.** The engineer measures rows read by a 50,000-close `rebuildTrades` with and without the triggers
  (EXPLAIN on the recompute statement). If insert chunks split pairs often, recompute pairs once in a final per-user
  statement and make the insert trigger a no-op inside rebuilds (a `set local` flag).
- **F5-5.** Confirm that `loadFeedPage`'s non-default `opts.now` (tests) bypasses the offset sampler.
- **F5-2.** Confirm that the old `saveThesis(form)` delegate can go one release after deploy (a `// ponytail:` with the
  removal condition).
