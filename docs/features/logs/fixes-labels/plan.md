# Fixes: truthful labels and dates, plus F-11 record status line — UX lead plan

Branch `claude/fix-truthful-labels` · 2026-11-01 · Scope: D-03, D-05, D-07, D-09/D20, D-12, D-24
(`docs/direction/design-2026-11-01.md`), approval fixes #2, #3 (+C1), #4, #24, and F-11 (`docs/features/F-11-*.md`, status ready).
Out of scope: D-04 badge wording, D-06/D-10 (F-4), D-11/D-48, the profile OG image and `record-card*` (F-4), the data
plumbing of `app/t/[symbol]/page.tsx` `load()` + overlap query and `app/t/page.tsx`'s query (another engineer).

## 0. Ground rules for the build
- New strings live in one `lib/copy.ts` block headed `// ---- FIXES-LABELS ----`, exported as `FIXES_LABELS`, and the
  block is added to the `allCopy()` walk list (one-token edit on that line). `DISCLAIMER` stays in `lib/share.ts` and is
  never added to the walk (it contains "guarantee", which the banned list matches).
- In shared files (`app/page.tsx`, `lib/feed.ts`, `app/feed-rows.tsx`, `app/ui.tsx`, `app/pane.tsx`, `app/u/[handle]/page.tsx`,
  `app/suggest-section.tsx`, `app/u/[handle]/similar-section.tsx`, `app/lazy-pane.tsx`, `app/me/**`, `app/how/page.tsx`,
  `app/u/[handle]/chart.tsx`, `lib/sync.ts`, `app/globals.css`) every edit sits in or beside a `{/* FIXES-LABELS */}` / `// FIXES-LABELS`
  marker and is additive (new prop, new element, new rule). The only in-place replacements, each one expression, are
  listed per item below; nothing else in those files moves.
- Existing tests are not edited. Strings that tests assert ("No verified closed trades in ZZZZ yet.", "Connected: Fake
  Brokerage (3 accounts)", `baseline` test ids, `.evidence`) keep working (checked per item).

## 1. Shared helpers (new files, pure unless noted)
| File | Export | Contract |
|---|---|---|
| `lib/date-text.ts` | `dateText(d, now, opts?: { year?: 'auto' \| 'always' })` | `'Mon D'` when `d` is in `now`'s UTC year, else `'Mon D, YYYY'`; `year:'always'` always adds it (images, share text, cached renders). Always `timeZone:'UTC'`, one cached `Intl.DateTimeFormat` per variant (render cost, F-2). `asOfDay` is left as is; a test pins `asOfDay(d,now) === dateText(d,now)`. |
| `lib/date-text.ts` | `relativeText(from, now)` | `'less than an hour ago'`, `'N hours ago'` (1–23), `'yesterday'`, `'N days ago'` (2–29), `'N weeks ago'` (≥30 d up to 12 w), else `'N months ago'`. Future `from` → `'less than an hour ago'`. |
| `lib/record-status.ts` | `recordStatusLine(f: StatusFacts, now, mode: 'live' \| 'static')` → `StatusLine` | The one status-line helper (F-11 AC8). Input `StatusFacts = { source: 'broker' \| 'demo' \| 'none'; firstEntry; lastClose; lastSyncedAt; connections: { id; state; disconnectedAt; accounts: { id; institution; isPaper; removedAt }[] }[] }`. Output: `{ since: Part \| null; link: Part \| null; fresh: Part \| null; idle: boolean; accounts: Part[]; frozen: Date \| null }` where `Part = { text: string; time?: { iso: string; abs: string; rel?: string } }`. `mode:'static'` never fills `rel`. |
| `lib/record-status.ts` | `frozenAt(connections)` | Consented connections in `connected` state, non-empty, **all** with `disconnectedAt` → `max(disconnectedAt)`; else `null`. Legacy (pre-F-1) and demo → `null`. |
| `lib/record-status.ts` | `isIdle(lastSyncedAt, now)`, `idleCount(rows, now)` | Idle = broker record, not frozen, `lastSyncedAt` older than 30 × 24 h (or null with a connected connection). `idleCount` returns a number only (no ids) for the internal counter. |
| `lib/record-status.ts` | `accountLabels(connections)` | Real (non-paper) accounts of consented connections in link order (connection id, then array order) → `Map<accountId, 'Account i of n'>`; empty when n < 2. |
| `lib/record-status-load.ts` (DB) | `statusFacts(userIds): Promise<Map<number, StatusFacts>>` | Three queries total for any number of users: `users.last_synced_at` + demo flag; `min(opened_at)`, `max(closed_at)` from `closed_trades` grouped by user; consented connections with `state, disconnected_at, accounts` joined to `broker_accounts.removed_at`. Never reads cron config or render time (F-11 AC2). |
| `app/disclaimer.tsx` | `Disclaimer({ className? })` | `<p className="muted small disclaimer" data-disclaimer>{DISCLAIMER}</p>`. Static text, no role, no live region, not focusable (the skip link keeps targeting the footer). |
| `app/status-line.tsx` | `StatusText({ line, parts })` | Renders chosen parts joined by ` · ` in one `<p className="muted small record-status">`; each dated part as `<time dateTime={iso}>{abs}</time>` and, when `rel` exists, `updated <time dateTime={iso}>{rel} ({abs})</time>` (relative always beside the absolute, inside the element; F-11 AC7). Words only, no icon or colour. |

`lib/connections.ts` and `lib/feed.ts` keep their types; status travels in a new optional map (§5).

## 2. Copy — `FIXES_LABELS` (exact strings)
```ts
export const FIXES_LABELS = {
  // D-03 / fix #2: one state name, "Demo".
  tickerTitle: { verified: (s) => `${s} verified trades · Stock Social`, demo: (s) => `${s} Demo trades · Stock Social`, mixed: (s) => `${s} closed trades, includes Demo · Stock Social` },
  tickerCount: { verified: (n, s) => `${n} verified closed trades in ${s}`, demo: (n, s) => `${n} Demo closed trades in ${s}, not from a real broker`, mixed: (n, s) => `${n} closed trades in ${s}, some Demo` },
  tickerExplainer: {
    verified: 'Verified closed trades in this stock from connected accounts, newest first. Percentages only. Few trades means a wide range, and that is expected.',
    demo: 'Demo closed trades in this stock, newest first. Not from a real broker. Percentages only. Few trades means a wide range, and that is expected.',
    mixed: 'Closed trades in this stock, newest first: some from connected accounts, some Demo. Percentages only. Few trades means a wide range, and that is expected.' },
  demoNote: 'Demo trades, not from a real broker.',
  mixedNote: 'Includes Demo trades, marked Demo. The figures include them.',
  demoPage: 'All trades on this page are Demo trades, not from a real broker.',
  imageSub: { verified: 'verified closed trades', demo: 'Demo trades', mixed: 'closed trades, includes Demo' },
  imageStatus: { verified: 'Verified from broker', demo: 'Demo', mixed: 'Includes Demo' },
  tickerAlt: 'Trading records by stock on Stock Social',
  indexTitle: 'Trades by stock · Stock Social',
  indexDescription: 'Closed trades by stock: trade counts and traders, percentages only, losses included. Demo trades are marked Demo.',
  indexIntro: 'Stocks with closed trades from connected accounts or Demo data. Open a stock to see its trades, losses included. Percentages only.',
  compareTitle: { verified: (a, b) => `${a} vs ${b} verified trades · Stock Social`, demo: (a, b) => `${a} vs ${b} Demo trades · Stock Social`, mixed: (a, b) => `${a} vs ${b} closed trades, includes Demo · Stock Social` },
  compareExplainer: { verified: 'Verified closed trades in each stock, side by side. Percentages only. Few trades means a wide range, and that is expected.' /* today's text, verbatim; no import of lib/ticker.ts */, demo: 'Demo closed trades in each stock, side by side. Not from a real broker. Percentages only.', mixed: 'Closed trades in each stock, side by side; some are Demo. Percentages only.' },
  compareTail: { demo: ' Demo trades.', mixed: ' Includes Demo trades.' },
  // D-07: facts with the traders' records as the subject; no above/below/difference verdict.
  baselineHeading: 'Closed trades recorded here: this stock and all others',
  baselineThis: (sym, n, traders, range) => `${n} closed trades in ${sym} by ${traders /* counted(k,'trader') */}${range ? `: per-trade range ${range}` : ''}.`,
  baselineOthers: (n, avg) => `${n} closed trades in all other stocks: ${avg} per trade (geometric mean).`,
  baselineNote: 'Side by side for context only. Different traders, sizes and timing. Not a rating of any stock.',
  // D-24: months show numbers and a range only.
  monthRange: (range) => `95% range ${range}`,
  monthNoRange: (k, min) => `No range yet (${k} of ${min} bets)`,
  monthOf: (n) => (n === 1 ? 'The only month on record' : `1 of ${n} months on record`),   // n via count()
  // F-11 / D-12 / fix #4 status line.
  since: (d) => `Record since ${d}`,
  lastClose: (d) => `Last close ${d}`,
  updatedStatic: (d) => `updated ${d}`,                 // rel form is built in StatusText: `updated ${rel} (${abs})`
  idle: (d) => `No sync since ${d}`,                    // 30 days; a fact, no verdict
  frozen: (d) => `Disconnected ${d} · record frozen`,
  removed: (d) => `Account removed ${d}`,
  removedNumbered: (label, d) => `${label} removed ${d}`, // "Account 2 of 2 removed Jul 2, 2020"
  accountLine: (label, inst) => `${label} · ${inst}`,     // "Account 1 of 2 · Fake Brokerage"
  demoLink: 'Demo',
  chartSub: (rangeLabel, d) => `${rangeLabel} · last close ${d}`,
  chartEnds: (a, b) => `First close ${a}, last close ${b}`, // sr-only sentence for the two end labels
} as const;
```
Typed params (`s: string`, `n: string` already `count()`-formatted). No string says "every", "all trades", "full record",
"whole record", "verified" for demo or mixed scope, "above", "below", "better", "worse", "clear difference". The wording of
"updated"/"as of" is the design-system council's to settle (F-11); changing it is a one-block edit.

## 3. Items

### D-03 · fix #2 — Demo is never "verified" (owner: `app/t/**`, `lib/ticker.ts` COMPARE_COPY area)
`kind = s.demoOnly ? 'demo' : s.mixed ? 'mixed' : 'verified'`, one helper `trustKind(s)` in `lib/ticker.ts`.
- `app/t/[symbol]/page.tsx`: `generateMetadata` title/description from `tickerTitle[kind]`, `tickerCount[kind]` (drop the
  `' Sample data.'` tail); `EXPLAINER` → `tickerExplainer[kind]` (no-rows page keeps the verified text and the existing
  "No verified closed trades in X yet." sentence: no demo data there). Role notes → `demoPage` / `mixedNote`. "Based on
  sample data." → `demoNote`; aria `', sample data'` → `', Demo'`. Do not touch `load()` or the overlap query.
- `Spread`, `Timeline`, `HoldTime`, `Concentration`, `Theses`, `Baseline`: "Sample data, not from a real broker." →
  `demoNote`; "Includes sample data marked Demo." → `mixedNote`.
- `opengraph-image.tsx`: `alt` → `tickerAlt`; subtitle → `imageSub[kind]`; corner → `imageStatus[kind]`.
- `app/t/compare/page.tsx` + `lib/ticker.ts`: title from `compareTitle[kind(a ∪ b)]`; explainer by kind; `compareDescription`
  tail → `compareTail`; `COMPARE_COPY.demoOnly/mixed` → `demoPage`/`mixedNote`. Empty-side strings unchanged.
- `app/t/page.tsx` metadata and intro → `indexTitle/indexDescription/indexIntro`; list aria label → "Stocks with closed
  trades"; watch line `' (demo data)'` → `' (Demo)'`. Query untouched.

### D-05 · fix #24 — years and chart ends
- `app/ui.tsx` TradeCard: `CLOSED_DAY.format(...)` → `dateText(t.closed_at, now)` (one in-place expression; `now` from a new
  optional prop, default `new Date()`).
- Month page `day()` → `dateText(d, now)`; pane `day()` already carries the year (unchanged).
- `app/u/[handle]/chart.tsx` (FIXES-LABELS block): under the plot a row `.chart-ends` with two `<time>` labels, left = first
  close in range, right = last close in range (ALL: `series.t0` / `series.t1`; other ranges: first/last `pts[i].trade`),
  `dateText(…, now)`, plus an sr-only `chartEnds` sentence. At rest the subline is `chartSub(spec.label, dateText(lastClose))`
  where `lastClose` = the ALL series' `t1` (works on the lite stand-in, which carries only ALL). Scrub date →
  `dateText`. UTC everywhere, so server and client render the same text (no hydration diff).
- Images and share text always use `year:'always'` (trade image already does; month image label has the year).

### D-07 — baseline facts, no verdict (`app/t/[symbol]/Baseline.tsx` only)
Heading → `baselineHeading`. Replace the three verdict `<p data-testid="baseline-verdict">` lines and the `demo` verdict
line with `baselineThis` + `baselineOthers` (no test id, so the e2e's `toHaveCount(0)` branch and visible-section check
still hold) and `baselineNote`. Drop "No verdict is drawn…" sentences. `baselineVerdict()` and its tests stay (kind still
sets `data-kind`). OD-8: reword now (§7).

### D-09 / D20 · fix #3 (+C1) — the F3 line in plain view
One `<Disclaimer />` directly after the first stats block on each surface (pattern `.sheet-note`):
| Surface | Place | File |
|---|---|---|
| Feed card | last child of `<article className="card">`, after `<footer>` | `app/ui.tsx` (additive) |
| Pane | directly after `figures` in both orders | `app/pane.tsx` (additive); prop `disclaimer = true` |
| Sheets that already end with `.sheet-note` | pass `disclaimer={false}` to the pane | `suggest-section.tsx`, `similar-section.tsx` → `lazy-pane.tsx` pass-through (keeps `getByText` single-match in section/similar specs) |
| Profile | after `<div className="evidence">` | `app/u/[handle]/page.tsx` (additive) |
| Trade, month | last line inside "Their whole record", before the link; trade also gets `<RowBadge>` in "This trade" by `paneTrust` | trade/month pages |
| `/t/[symbol]` | after the `.evidence` caveat under the summary stats | `page.tsx` |
| `/t/compare` | under the overlap line, before the columns | `compare/page.tsx` |
| `/me/record`, `/me/likes`, `/how` (C1 walks them: they print percentages) | after the first stats/list heading | additive line each |
Images: disclaimer 22 → 28 px on trade, month (`lib/month-card.ts` `disclaimer.size`) and stock images.
Footer, skip link and the F-1 test are unchanged.

### D-12 · fix #4 · F-11 — status line
Facts via `statusFacts` (profile, trade, month loaders; feed and pane via one extra query, §5).
- **Profile** (replaces the "Record since … · {connected}." line; one in-place JSX swap in a FIXES-LABELS block): line 1
  `since · link` where link = `connectedLine(...)` while live, `frozen(date)` when frozen, `demoLink` for demo; then the
  unchanged sentence "Only trades from connected accounts are shown." for broker records only (fix #10's demo half).
  Line 2 `lastClose · updated <rel (abs)>` or `lastClose · idle(date)`; omitted with no `lastSyncedAt` (pre-sync). Line 3+,
  only with ≥ 2 accounts: `accountLine(label, inst)` per account, removed ones as `removedNumbered`; a single removed
  account in a live multi-connection record shows `removed(date)`. Trades of removed accounts stay listed.
- **Pane, feed card**: one compact line (static mode, absolute dates — pane JSON is cached 60 s): `frozen(date)` when
  frozen, else `lastClose · updatedStatic(date)`. Card: `<p className="muted small record-status">` between hero and thesis.
- **Trade, month pages** (dynamic): in "Their whole record", first line, live mode.
- **Trade, month images**: when frozen, one muted 26 px line `frozen(dateText(d,now,{year:'always'}))` in the bottom block;
  never relative.
- **Open positions of a frozen record** keep F-6's rule and its "as of ‹date›" (F-11 decision; OD-9 stays with the owner).
- **Removed accounts**: `broker_accounts.removed_at` is read but never written. Additive block in `lib/sync.ts` beside the
  `disconnected_at` update: set `removed_at = now` for the user's confirmed real accounts not in the vendor list and clear it
  for listed ones (coordinate with the sharded-sync owner; §7 Q3).
- **Idle counter**: `idleCount` logged once per sync tick as `idle_connections=<n>` (no ids) at the end of `POST /api/sync`
  (one additive line; §7 Q4).

### D-24 — month pages give numbers and a range, no verdict
- `lib/recap.ts`: `monthRecap` also returns `bets: c.k`; new `monthsOnRecord(all)` = distinct UTC `YYYY-MM` of `closedAt`;
  `loadRecap` returns `months`.
- Month page: "This month" box drops `m.evidence`; shows `monthRange(range)` or `monthNoRange(k, MIN_BETS)`. Under the h1:
  `monthOf(months)`. Whole-record box unchanged in size (same `.big`).
- `lib/month-card.ts`: no evidence on month lines (already none); add top line `{ role:'of', text: monthOf(n), size:26, muted }`;
  whole-record `record` line 34 → 40 px (equal to the month line); label `fitSize` max 96 → 80; disclaimer 28 px; optional
  frozen line. Height with every optional line: 498 ≤ 502 px room (`monthCardFits`).

## 4. Layout at 360 px
- Token: `--muted` (dark `#8b8b98`: 5.84:1 on `--bg`, 5.35:1 on `--surface`; light `#6b6b78`: 5.03:1 on `--bg`, 5.25:1 on
  `--surface`). All ≥ 4.5:1 at `.small` (0.85 rem ≈ 13.6 px). No new colour. `.disclaimer { margin: 0; }`.
- Feed card: the disclaimer wraps to two lines (~40 px). Add `.feed .row > .card { padding-bottom: 96px; }` (fixed bar
  bottom 16 + 62 tall + 16 gap) so the Undo/sign-in bars never cover it; the hero (`flex:1`) absorbs the space at 360×740.
  `.card .record-status` one line, `overflow-wrap:anywhere`.
- Pane: disclaimer sits under the stats, inside the first 740 px at 360 (sheet padding unchanged).
- Profile/trade/month: in normal flow; e2e checks it is in the first viewport for the seeded demo trader (no thesis). If the
  trade page fails it, the fallback is the last line of "This trade" (engineer reports which).
- `.chart-ends { display:flex; justify-content:space-between; font-size:.85rem }`, `color: var(--muted)`; no wrap at 360
  ("Jul 30, 2020" ×2 ≈ 180 px).
- No `nav.top` overlap: the disclaimer box must not intersect the fixed nav either (C1).

## 5. Data plumbing (additive)
- `lib/feed.ts`: one more promise in the page's `Promise.all`, `statusFacts(onPage)` → `page.status?: Map<number, StatusFacts>`.
- `app/feed-rows.tsx`: pass `status={page.status?.get(id)}` to `TradeCard` and `ProfilePane` (new optional props; absent → no line).
- Pane route `app/u/[handle]/pane/route.ts`: add `status` (static parts only, already formatted) to the JSON.
- `lib/trade-share-load.ts`, `lib/recap-load.ts`: add `status: StatusFacts` beside `state`.

## 6. Acceptance criteria → tests (new files only)
1. Demo/mixed `/t/[symbol]` title, description, explainer, notes, image subtitle/corner and alt contain no "verified" (any case); verified scope keeps "verified trades". → `lib/fixes-labels-copy.test.ts` (kinds × builders) + e2e §C.
2. `/t/compare` with a demo side: title/description/explainer contain no "verified". → `lib/fixes-labels-copy.test.ts`.
3. Every rendered surface for a demo record (feed card, pane, profile, trade, month, `/t/NVDA`, compare, three images' text model) contains "Demo" and no `/verified/i` outside the footer. → e2e `e2e/fixes-labels.spec.ts` "demo scan".
4. `dateText`: same-year `'May 30'`, other year `'May 30, 2020'`, `year:'always'`, UTC at 23:30 / 00:30 edges; `asOfDay` parity. → `lib/date-text.test.ts`.
5. A 2020 close on the feed card prints "2020"; chart subline reads "All time · last close ‹date›" and the ends show first and last close. → `lib/date-text.test.ts` (TradeCard render via `react-dom/server`) + e2e.
6. Baseline renders no "above", "below", "difference", "sits"; `baseline` test id and `data-kind` kept. → `lib/fixes-labels-copy.test.ts` (render) + existing e2e.
7. F3 string inside the viewport at 360×740 and not intersecting `nav.top`, `.signin-line:not(:empty)`, `.hide-bar`, on: every route from walking `app/**/page.tsx` (dynamic segments from a fixture map; an unmapped dynamic route or a new route printing a `%` figure without the line in view **fails**), the open pane, and the 2nd appended feed page's first card. Bars are raised first (signed-out like → sign-in bar; signed-in hide → Undo bar, as in `likes.spec.ts`). → `e2e/fixes-labels.spec.ts` "C1 route walk".
8. Section and similar sheets still hold exactly one F3 line. → existing specs unchanged + `lib/fixes-labels-copy.test.ts` (ProfilePane `disclaimer={false}` render).
9. `recordStatusLine`: frozen → `frozen` text and no "Connected"; live → "Connected:"; demo → "Demo"; static mode has no `rel` and no "ago"; idle at 30 d exactly (not at 29 d 23 h); a failed sync (`lastSyncedAt` unchanged) leaves `updated` unchanged; output never depends on anything but its inputs (no clock read: `now` injected, asserted with a frozen `now`). → `lib/record-status.test.ts`.
10. `accountLabels`: 2 real + 1 paper → "Account 1 of 2", "Account 2 of 2"; 1 account → empty. `idleCount` returns a number; the log line has no handle/id (regex). → `lib/record-status.test.ts`.
11. `StatusText` puts every relative time inside `<time dateTime>` with its absolute date; words, no icon. → `lib/record-status.test.ts` (server render).
12. Every `FIXES_LABELS` string passes PROMO, BANNED, MARKS and has no "every", "full record", "whole record", "complete". → `lib/fixes-labels-copy.test.ts`.
13. Disconnected fixture (vendor fake lists no accounts → sync sets `disconnected_at`): profile, pane, feed card, trade and month pages show "Disconnected ‹date› · record frozen" and no "Connected:"; its trades stay listed; trade/month image models carry the frozen line with a year-qualified date and no "ago". → e2e "frozen record" + `lib/record-status.test.ts` (image model).
14. Two-account fixture with one account removed: "Account 1 of 2 · …", "Account 2 of 2 removed ‹date›"; profile shows "Last close ‹date› · updated … ago (‹date›)". → e2e "accounts".
15. Month page has no "Past results:" in the "This month" box, shows a range or "No range yet", and "1 of N months on record"; `monthCard` record line size == month line size; `monthCardFits` holds with every optional line and the 28 px disclaimer. → `lib/fixes-labels-month.test.ts` + e2e.
16. Images: trade, month, stock disclaimer ≥ 28 px; no relative time; dates carry the year. → `lib/fixes-labels-month.test.ts` (month model) + e2e fetch of each image (200, PNG).
17. Total test count does not drop; `npx tsc --noEmit`, `npm test`, guard pass.

## 7. Open questions (recommendation first)
1. **OD-8 baseline wording** — *reword now* to §2 facts; the AI legal committee confirms. Owner may restore nothing.
2. **OD-9 positions of a disconnected account** — F-11 leaves it with the owner. *Recommend include and label "last known ‹date›"*
   (excluding could flatter a losing record). Until the owner rules, F-6's rule and its "as of ‹date›" stay; no change here.
3. **Writing `broker_accounts.removed_at` in `lib/sync.ts`** (sharded-sync file) — *recommend the additive block in this PR*,
   reviewed by that owner; without it "Account removed" can show only whole-connection removals.
4. **Idle counter location** — *recommend one count-only log line in the sync tick*; alternative: a funnel event. No ids either way.
5. **"Updated" is now public** (`last_synced_at` as a date). Consent lists "dates"; *recommend privacy confirms that covers it*
   before real users (COMPLIANCE §3). Not a blocker for demo data.
6. **Position rows' "account N"** numbers per symbol, not per record; with the new "Account i of n" this can disagree.
   *Recommend the profile maps position rows to `accountLabels`* when n ≥ 2 (additive), else unchanged.
7. **Trade page placement** if the e2e finds the whole-record box below 740 px: *fallback to the end of "This trade"*.

## 8. Compliance (COMPLIANCE §1)
1 Performance: yes — disclaimer added in view on every performance route and image; baseline verdict removed (F3b);
month verdict removed (F4); Demo never verified (F3a, P2). 2 Personal data: shows `last_synced_at`, account count/labels
and removal dates, already-stored fields; see Q5. 3 Money: no. 4 Comms/tracking: no (one count-only log line). 5 User
text: no. 6 Accounts: no. 7 Vendors/deps: none added. 8 Accessibility: status in words, `<time datetime>`, ≥ 4.5:1, static
text (no live region), 44 px targets unchanged. 9 Security: no. 10 Claims: no completeness words (AC12). 11 Checkout: no.
Owner-only: OD-8 confirmation, OD-9, Q5.
