# Fixes: truthful labels and dates, plus F-11 record status line — UX lead plan (round 2)

Branch `claude/fix-truthful-labels` · 2026-11-01 · Scope: D-03, D-05, D-07, D-09/D20, D-12, D-24
(`docs/direction/design-2026-11-01.md`), approval fixes #2, #3 (+C1), #4, #24, and F-11 (status ready).
Out of scope: D-04 (badge wording), fix #8 ("whole record"/"full record" wording), D-06/D-10 (F-4), D-11/D-48, the
profile OG image and `record-card*` (F-4), and the data plumbing of `app/t/[symbol]/page.tsx` `load()` + overlap query and
`app/t/page.tsx`'s query (another engineer).

## 0. Ground rules for the build
- New strings live in one `lib/copy.ts` block headed `// ---- FIXES-LABELS ----`, exported as `FIXES_LABELS`, added to the
  `allCopy()` walk list (one-token edit). `DISCLAIMER` stays in `lib/share.ts`, never in the walk ("guarantee" is banned there).
- Shared files (`app/page.tsx`, `lib/feed.ts`, `app/feed-rows.tsx`, `app/ui.tsx`, `app/pane.tsx`, `app/u/[handle]/page.tsx`,
  `app/u/[handle]/chart.tsx`, `app/me/**`, `app/how/page.tsx`, `lib/sync.ts`, `app/globals.css`, `e2e/fakes/vendor.ts`):
  every edit sits beside a `FIXES-LABELS` marker and is additive. The few one-expression replacements are named per item.
- Existing tests are not edited. Strings they assert stay: "No verified closed trades in ZZZZ yet." (app.spec:695,757-759),
  "Connected: Fake Brokerage (3 accounts)" (connect.spec:1149), "Demo data" + "Record since" (app.spec:151-152), numeric
  scrub date `M/D/YYYY` (app.spec:97,115,1077), `figure.chart` → next sibling `.chart-note` and its figcaption (f6:111-112),
  "F6A account 1" (f6:118), `/Sample data/` in compare descriptions (compare.test:74), `fitSize` default 96 (month-card.test:29),
  one F3 line per sheet (section.spec:128, similar.spec:79), `baseline` test id / `data-kind` (app.spec:652-662).
- Unit tests cover pure `.ts` models only (`.tsx` cannot load under `node --test`); DOM checks live in the e2e.
- Every limit left gets `// ponytail: <what is limited> — <what would fix it>` at the exact place, plus a "Known limits"
  line in the PR body (§8).
- Build as three green commits: (a) D-03, D-07, D-24 copy; (b) D-05 dates, D-09 disclaimer, C1; (c) F-11 status line + sync.

## 1. Shared helpers (new files)
| File | Export | Contract |
|---|---|---|
| `lib/date-text.ts` | `dateText(d, now, { year?: 'auto' \| 'always' })` | `'Mon D'` in `now`'s UTC year, else `'Mon D, YYYY'`; `'always'` for images, share text and cached renders. UTC, one cached `Intl.DateTimeFormat` per variant. `asOfDay` untouched; a test pins parity. |
| `lib/date-text.ts` | `relativeText(from, now)` | `'less than an hour ago'`, `'N hours ago'` (1–23), `'yesterday'`, `'N days ago'` (2–29), `'N weeks ago'` (to 12), `'N months ago'`; future → `'less than an hour ago'`. |
| `lib/record-status.ts` | `statusParts(f: StatusFacts, now, mode: 'live' \| 'static')` → `StatusLine` | The one status-line model (F-11 AC8). `StatusFacts = { source: 'broker' \| 'demo' \| 'filing' \| 'none'; state: PublicState; firstEntry; lastClose; lastSyncedAt; brokers: string[]; accounts: number; connections: { id; consentAt; disconnectedAt; institution; accounts: { id; isPaper; removedAt }[] }[] }`. Output `{ show: boolean; line1: Part[]; line2: Part[]; accounts: Part[]; frozen: Date \| null; idle: boolean }`, `Part = { text; time?: { iso; abs; rel? } }`; `'static'` never sets `rel`. Rules below. |
| `lib/record-status.ts` | `frozenAt(connections)` | Non-empty consented connected set, **all** with `disconnectedAt` → `max(disconnectedAt)`; else `null`. Legacy and demo → `null`. |
| `lib/record-status.ts` | `idleSince(f, now)` | Idle is **per record** (there is no per-connection sync time): `ref = lastSyncedAt ?? earliest live consentAt`; idle when `now − ref ≥ 30 × 24 h` and not frozen. A null `lastSyncedAt` right after connecting is not idle. Returns `ref` or `null`. |
| `lib/record-status.ts` | `accountLabels(connections)` | Real accounts of consented connections in link order → `Map<accountId, 'Account i of n'>`; empty when n < 2. |
| `lib/record-status.ts` | `segments(parts)` | Parts → `{ text \| time }` segments joined by `' · '`; the `.tsx` renders segments only, so the model is unit-tested. |
| `lib/record-status-load.ts` | `statusFacts(userIds)` | One query per call (CTEs: `users.last_synced_at`; `min(opened_at)`, `max(closed_at)` per user; consented connections with `consent_at, disconnected_at, institution, accounts` joined to `broker_accounts.removed_at`), taking the `recordStates` id set and its states. Reads no cron config, schedule or render clock (F-11 AC2). `source:'filing'` (F-7 public filing profiles) → `show:false` (coordinate the value with F-7). |
| `app/disclaimer.tsx` | `Disclaimer()` | `<p className="muted small disclaimer" data-disclaimer>{DISCLAIMER}</p>`. Static, no role, no live region, not focusable. |
| `app/status-line.tsx` | `StatusText({ parts })` | One `<p className="muted small record-status">`; dated segments as `<time dateTime={iso}>{abs}</time>`, relative as `<time dateTime={iso}>{rel} ({abs})</time>` (F-11 AC7). Words only. |

**Status rules** (`statusParts`): `show` is false while importing or failed (the failed line stays as today), for `'none'`
and `'filing'`. Demo: line1 `since · demoLink`, no line2. Broker:
- **Live, no connection disconnected:** line1 `since · connectedLine(brokers, accounts)` (today's call, exact text).
- **Partial:** line1 `since · connectedLine(live institutions, live real accounts)`, then one part per disconnected
  connection `instDisconnected(inst, d)`.
- **Frozen** (all disconnected): line1 `since · frozen(d)`; line2 `lastClose(d)` only — no "updated", no idle.
  **Frozen wins over idle.**
- **Idle:** line2 `lastClose · idle(ref)`. **Otherwise:** line2 `lastClose · updated …` (`rel` live, `updatedStatic` static);
  with neither `lastSyncedAt` nor idle, `lastClose` alone.
- **Accounts** (n ≥ 2 only): `accountLine(label, inst)` per account, removed ones `removedNumbered(label, d)`; n = 1 with
  `removedAt` → `removed(d)`. Trades of removed accounts stay listed.

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
  demoPage: 'This page shows Demo trades only, not from a real broker.',
  imageSub: { verified: 'verified closed trades', demo: 'Demo trades', mixed: 'closed trades, includes Demo' },
  imageStatus: { verified: 'Verified from broker', demo: 'Demo', mixed: 'Includes Demo' },
  tickerAlt: 'Trading records by stock on Stock Social',
  indexTitle: 'Trades by stock · Stock Social',
  indexDescription: 'Closed trades by stock: trade counts and traders, percentages only, losses included. Demo trades are marked Demo.',
  indexIntro: 'Stocks with closed trades from connected accounts or Demo data. Open a stock to see its trades, losses included. Percentages only.',
  compareTitle: { verified: (a, b) => `${a} vs ${b} verified trades · Stock Social`, demo: (a, b) => `${a} vs ${b} Demo trades · Stock Social`, mixed: (a, b) => `${a} vs ${b} closed trades, includes Demo · Stock Social` },
  compareExplainer: {
    verified: 'Verified closed trades in each stock, side by side. Percentages only. Few trades means a wide range, and that is expected.', // today's text
    demo: 'Demo closed trades in each stock, side by side. Not from a real broker. Percentages only. Few trades means a wide range, and that is expected.',
    mixed: 'Closed trades in each stock, side by side; some are Demo. Percentages only. Few trades means a wide range, and that is expected.' },
  compareTail: { demo: ' Demo trades. Sample data, not from a real broker.', mixed: ' Includes Demo trades. Sample data, not from a real broker.' }, // compare.test:74
  compareOverlap: { verified: (n, a, b) => (n === 0 ? 'No trader has closed verified trades in both yet.' : `${n} trader${n === 1 ? '' : 's'} closed verified trades in both ${a} and ${b}.`), // today's COMPARE_COPY.overlap text; copy.ts never imports lib/ticker.ts
    demo: (n, a, b) => (n === 0 ? 'No trader has closed trades in both yet.' : `${n} trader${n === 1 ? '' : 's'} closed trades in both ${a} and ${b}.`) },
  // D-07: facts, the traders' records as subject, one mean on both sides (D-10), no verdict.
  baselineHeading: 'Closed trades recorded here: this stock and other stocks',
  baselineThis: (sym, n, traders, range) => `${n} closed trades in ${sym} by ${traders}${range ? `: per-trade range ${range}` : ''}.`,
  baselineOthers: (n, range) => `${n} closed trades in other stocks recorded here${range ? `: per-trade range ${range}` : ''}.`,
  baselineNote: 'Side by side for context only. Different traders, sizes and timing. Not a rating of any stock.',
  // D-24: months show numbers and a range only.
  monthRange: (range) => `95% range ${range}`,
  monthNoRange: (k, min) => `No range yet: ${k} of the ${min} separate bets needed`,
  monthOf: (n) => (n === '1' ? 'The only month on record' : `1 of ${n} months on record`),
  // F-11 / D-12 / fix #4.
  since: (d) => `Record since ${d}`,
  lastClose: (d) => `Last close ${d}`,
  updatedStatic: (d) => `updated ${d}`,          // live form: `updated ${rel} (${abs})`, built from segments
  idle: (d) => `No sync since ${d}`,             // a fact; per record
  frozen: (d) => `Disconnected ${d} · record frozen`,
  instDisconnected: (inst, d) => `${inst} disconnected ${d}`,
  removed: (d) => `Account removed ${d}`,
  removedNumbered: (label, d) => `${label} removed ${d}`,
  accountLine: (label, inst) => `${label} · ${inst}`,
  demoLink: 'Demo data',                          // app.spec:152
  chartSub: (rangeLabel, d) => `${rangeLabel} · last close ${d}`,
  chartEnds: (a, b) => `First close ${a}, last close ${b}`,
} as const;
```
Params are strings (`count()`/`counted()`/`dateText()` output). `baselineOthers` uses the others' 95% range from the same
`confidence()` path as this stock (built from one aggregate's rows, not `exp(avg(ln))`). If the pooled rows are not
available without touching `load()`, the line drops the range and prints the count only (ponytail note). The wording of
"updated"/"as of" is the design-system council's to settle (one-block edit).

## 3. Items

### D-03 · fix #2 — Demo is never "verified" (`app/t/**`, `lib/ticker.ts`)
`trustKind(s) = s.demoOnly ? 'demo' : s.mixed ? 'mixed' : 'verified'` in `lib/ticker.ts` (compare: over both sides' rows).
- `/t/[symbol]`: metadata from `tickerTitle`/`tickerCount` (no `' Sample data.'` tail); `EXPLAINER` → `tickerExplainer[kind]`
  (the no-rows page keeps today's text and "No verified closed trades in X yet."); notes → `demoPage`/`mixedNote`;
  "Based on sample data." → `demoNote`; aria `', sample data'` → `', Demo'`. `load()` and the overlap query untouched.
- `Spread`, `Timeline`, `HoldTime`, `Concentration`, `Theses`, `Baseline`: sample-data notes → `demoNote` / `mixedNote`.
- Stock image: `alt` → `tickerAlt`; subtitle `imageSub[kind]`; corner `imageStatus[kind]`.
- `/t/compare`: title, explainer, overlap by kind; `compareDescription` tail → `compareTail`; empty-side strings unchanged.
- `/t` index: metadata and intro → `indexTitle/Description/Intro`; aria → "Stocks with closed trades"; watch `' (demo data)'` →
  `' (Demo)'`. Query untouched.

### D-05 · fix #24 — years and chart ends
- Feed card (`app/ui.tsx`): `CLOSED_DAY.format(t.closed_at)` → `dateText(t.closed_at, now)` (one expression; optional `now` prop).
- Month page `day()` → `dateText`. Pane dates already carry the year.
- `chart.tsx` (FIXES-LABELS block): `.chart-ends` row **inside `<figure class="chart">`, after the plot, outside the
  figcaption**, with two `<time>` labels: ALL → `series.t0`/`series.t1`; other ranges → first/last `pts[i].trade`; sr-only
  `chartEnds`. The **at-rest** subline becomes `chartSub(spec.label, dateText(ALL.t1, now))`. The scrubbed date stays
  numeric `toLocaleDateString('en-US')`.
- Images/share text: `year:'always'`.

### D-07 — baseline facts (`app/t/[symbol]/Baseline.tsx`)
Heading → `baselineHeading`; the "This stock" / "All other stocks" tiles → "This stock" / "Other stocks recorded here",
the geometric per-trade tiles and the "(geometric mean)" captions removed; the three `baseline-verdict` lines and the demo
verdict line → `baselineThis` + `baselineOthers` + `baselineNote`. `baselineVerdict()` and its tests stay (`data-kind`).

### D-09 / D20 · fix #3 (+C1) — the F3 line in plain view
`<Disclaimer />` directly after the first stats block (pattern `.sheet-note`, `app/suggest-section.tsx:31`):
| Surface | Place |
|---|---|
| Feed card (`app/ui.tsx`) | last child of `<article className="card">` |
| Pane (`app/pane.tsx`) | right after `figures`, both orders; prop `disclaimer = true` |
| Sheets with `.sheet-note` | `feed-rows.tsx` memo key `${user_id}:${flag}`; `suggest-section` calls `pane(r.userId, false)`, `similar-section` → `lazy-pane` passes `disclaimer={false}` (one F3 line per sheet) |
| Profile | after `<div className="evidence">` |
| Trade / month | **last line of the "This trade" / "This month" box**; trade also gets `<RowBadge>` in "This trade" (`paneTrust`) |
| `/t/[symbol]` | after the `.evidence` caveat |
| `/t/compare` | under the overlap line, before the columns |
| `/me/record`, `/me/likes`, `/how` | after the first block that prints a `%` figure |

**Images at 28 px (from 22), two lines** ("Not investment advice." / "Past performance does not guarantee future results.",
874 px ≤ 1072 px inner width), all three:
- Month (`lib/month-card.ts`): `disclaimer` becomes two `CardLine`s (`role:'disclaimer'`), both counted in `monthCardFits`;
  label `fitSize(label, 64)` at the call site (default 96 kept); month and picks lines 40 → 36; record line 34 → 36 (equal to
  the month line, D-24); new `of` line 26; optional frozen line 26. Worst case (new + frozen) = 498.2 ≤ 502.
- Trade image: return figure 160 → 136 px; worst case (record + note + new + frozen + disclaimer, thesis at 0) = 500.4 ≤ 502.
- Stock image: symbol 120 → 96 px; total 477.6 ≤ 502.
- New pure `lib/image-fit.ts`: `lineHeights(spec)` and `textWidth(text, size)` (0.6 em glyph, as `month-card.ts`), the
  trade/stock images read their sizes from it, so the fit test covers what is drawn.

Footer, skip link and the F-1 test unchanged.

### D-12 · fix #4 · F-11 — status line
- **Profile** (one JSX swap of the "Record since … · {connected}." line, FIXES-LABELS block): `line1`, then "Only trades
  from connected accounts are shown." for broker records only, `line2` in live mode, then `accounts`.
- **Feed card**: the line only when **frozen or idle** (static mode), else nothing; between hero and thesis.
- **Pane**: line1's link part + line2, static mode (pane JSON is cached 60 s).
- **Trade, month pages** (dynamic): first line of "Their whole record", live mode.
- **Trade, month images**: when frozen, muted 26 px `frozen(dateText(d, now, { year: 'always' }))`; never relative.
- **Open positions of a frozen record**: F-6's rule and "as of ‹date›" unchanged (OD-9 below).
- **`removed_at` write** (`lib/sync.ts`, additive, beside the `disconnected_at` update): only after the vendor account list
  returned successfully **and** non-empty; never on a fetch error; for confirmed real accounts not listed whose connection
  still lists ≥ 1 account (an empty list is the disconnect path); `where removed_at is null` — written once, never cleared,
  like `disconnected_at`.
- **Idle counter**: one SQL `count(*)` of idle records (same predicate as `idleSince`), emitted as an `idle` field in the
  existing counts-only `sync tick` JSON (`lib/sync.ts:290`, passes `lib/privacy-logs.test.ts`). No funnel event, no ids.
- **Vendor fake** (`e2e/fakes/vendor.ts`, additive): `POST /_remove { accountId }` drops an account from the listing;
  `/_remove { all: true }` empties it (disconnect).

### D-24 — month pages: numbers and a range, no verdict
`monthRecap` also returns `bets: c.k`; `monthsOnRecord(all)` = distinct UTC `YYYY-MM`; `loadRecap` returns `months`.
"This month" drops `m.evidence`; shows `monthRange` or `monthNoRange(k, MIN_BETS)`; under the h1 `monthOf(count(months))`.
Image as in D-09.

## 4. Layout at 360 px
- `--muted`: dark `#8b8b98` 5.84:1 on `--bg`, 5.35:1 on `--surface`; light `#6b6b78` 5.03:1 / 5.25:1. All ≥ 4.5:1 at
  `.small`. No new colour. `.disclaimer { margin: 0; }`.
- Feed card: disclaimer wraps to two lines (~40 px); `.feed .row > .card { padding-bottom: 96px; }` (bar 16 + 62 + 16) so the
  Undo and sign-in bars never cover it; the hero (`flex:1`) absorbs it at 360×740 with the longest allowed thesis (280).
- Trade/month: the line ends the first box, inside the first 740 px (e2e asserts position and viewport).
- `.chart-ends { display:flex; justify-content:space-between; font-size:.85rem; color:var(--muted) }`.
- The disclaimer box never intersects `nav.top` (fixed) either.

## 5. Data plumbing (additive)
- `lib/feed.ts`: `statusFacts(ids, states)` with the `recordStates` id set, one query per page, inside the existing
  `Promise.all` → `page.status?: Map<number, StatusFacts>`.
- `app/feed-rows.tsx`: `status={page.status?.get(id)}` to `TradeCard` and `ProfilePane`.
- Pane route: `status` as static segments in the JSON. `lib/trade-share-load.ts`, `lib/recap-load.ts`: `status` beside `state`.

## 6. Acceptance criteria → tests (new files only)
1. Demo/mixed stock-page builders (title, description, explainer, notes, image subtitle/corner, alt) contain no `/verified/i`; verified keeps "verified trades". → `lib/fixes-labels-copy.test.ts`.
2. Compare with a demo side: title, description, explainer, overlap have no "verified"; tails keep "Sample data". → same.
3. Demo scan: for `/`, pane, `/u/momentum_maya`, its trade and month (sell_id, ym from the DB), `/t/NVDA`, `/t/compare?a=NVDA&b=AMD` and the three image routes: main text, `<title>`, meta description and `og:image:alt` contain "Demo" and no `/verified/i` (footer excluded). → `e2e/fixes-labels.spec.ts`.
4. `dateText`: `'May 30'` same year, `'May 30, 2020'` otherwise, `'always'`, UTC 23:30/00:30 edges, `asOfDay` parity; `relativeText` boundaries. → `lib/date-text.test.ts`.
5. A 2020 close on a feed card prints "2020"; the at-rest subline reads "All time · last close ‹date›"; `.chart-ends` inside `figure.chart` shows first and last close; scrub stays `M/D/YYYY`. → e2e.
6. Baseline copy builders contain no "above", "below", "difference", "sits", "geometric", "all"; → `lib/fixes-labels-copy.test.ts`; section and `data-kind` render → existing e2e.
7. **C1 route walk**: the spec walks `app/**/page.tsx` and maps each to a URL from a fixture map (`/u/momentum_maya`, `/t/NVDA`, `/t/compare?a=NVDA&b=AMD`, trade sell_id and month ym from the DB as app.spec:473); `/me/*` and `/settings` signed in through `/login/dev` as an owner with trades; an unmapped dynamic route fails. A route "shows performance" when one regex `/[+−-]?\d+(\.\d+)?%/` matches main text; then the F3 line is in the viewport at 360×740 and intersects none of `nav.top`, `.signin-line:not(:empty)`, `.hide-bar` (bars raised first, as `likes.spec.ts`); `/how`: in view when its first `%` is scrolled into view. `/connect/*` and `/login/*` show no `%` figure. Also the open pane and the first card of the second appended feed page; feed fixture card carries a 280-char thesis. → `e2e/fixes-labels.spec.ts`.
8. Trade and month: the F3 line is the last child of the "This trade" / "This month" box and in the viewport. → e2e.
9. `statusParts`: frozen → `frozen` text, line2 = `lastClose` only, no "Connected", no "updated", no idle even when 40 days stale (frozen wins); live → exact `connectedLine` text; **two connections, one disconnected** → "Connected: Fake Brokerage (1 account)" plus "Fake Brokerage disconnected ‹date›"; demo → "Demo data"; importing/failed/filing → `show:false`; static mode has no `rel` and no "ago"; a failed sync (unchanged `lastSyncedAt`) leaves line2 unchanged; `now` injected, no clock read. → `lib/record-status.test.ts`.
10. `idleSince`: null `lastSyncedAt` with consent 2 days ago → not idle; consent 31 days ago → idle with that date; 29 d 23 h → not idle; 30 d → idle; per record. `accountLabels`: 2 real + 1 paper → "Account 1 of 2", "Account 2 of 2"; 1 → empty. `segments` puts every `rel` in a time segment with its `abs`. → `lib/record-status.test.ts`.
11. `removed_at`: vendor list throws → no `removed_at`; list empty → no `removed_at` (disconnect path); one of two accounts unlisted → only that one stamped, and re-listing does not clear it. Sync tick JSON carries a numeric `idle`. → `lib/sync-removed.test.ts` (dbTest).
12. Every `FIXES_LABELS` string passes PROMO, BANNED, MARKS and has no `/\b(every|complete|whole record|full record)\b/i` or `/\ball (trades|stocks|others)\b/i`. → `lib/fixes-labels-copy.test.ts`.
13. Disconnected fixture (`/_remove {all}` → sync): profile, pane, trade and month pages show "Disconnected ‹date› · record frozen", no "Connected:"; the feed card shows the frozen line; a live non-idle card shows no status line; trades stay listed. → e2e.
14. Two-account fixture, one removed (`/_remove {accountId}` → sync): "Account 1 of 2 · …", "Account 2 of 2 removed ‹date›"; profile line2 "Last close ‹date› · updated … ago (‹date›)" inside `<time datetime>`. → e2e.
15. Month: no "Past results:" in "This month", a range or "No range yet: k of the 10 separate bets needed", "1 of N months on record"; `monthCard` record size == month size. → `lib/fixes-labels-month.test.ts` + e2e.
16. Images: month model and `image-fit` specs fit 502 px with every optional line; each disclaimer line ≥ 28 px and ≤ 1072 px wide; no relative time; dates carry the year. → `lib/fixes-labels-month.test.ts`, `lib/image-fit.test.ts`; e2e fetches each image (200, PNG).
17. Test count does not drop; `npx tsc --noEmit`, `npm test`, guard pass.

## 7. Open questions: decided (committee picks, 2026-11-01)
1. **OD-8 baseline wording** — reword now; the AI legal committee confirms; the owner rules.
2. **OD-9 positions of a disconnected account** — no change in this PR (F-6 rule kept). Recommendation to the owner:
   include and label "last known ‹date›", a one-predicate change.
3. **`removed_at` write** — in this PR, with the §3 guards.
4. **Idle counter** — a count field in the sync tick log.
5. **Public sync time** — ship; privacy confirms the consent line's "dates" covers it before real users.
6. **"Account i of n" on open-position rows** — rejected for this PR (breaks f6:118); deferred with a ponytail note.
7. **Trade-page disclaimer** — last line of "This trade", verified by e2e at 360×740.

## 8. Planned ponytail notes (each also a "Known limits" line in the PR body)
- `lib/record-status.ts` `idleSince`: `// ponytail: idle is per record (users.last_synced_at) — a per-connection last_synced_at would let each account say it`.
- `app/u/[handle]/page.tsx` positions list: `// ponytail: open-position rows number accounts per symbol, not "Account i of n" — map rows through accountLabels with an f6 spec update`.
- `Baseline.tsx` (only if the pooled range is unavailable): `// ponytail: other-stocks line prints a count without a range — pool the others' rows into confidence() in load()`.
- `lib/sync.ts` removed_at: `// ponytail: an account removed while the vendor list is empty is recorded as a disconnect, not a removal — vendor per-account removal events`.
- `lib/image-fit.ts`: `// ponytail: widths use a 0.6 em average glyph — measure with the image font's metrics`.
- `app/pane.tsx`: `// ponytail: OD-9 open positions of a frozen record keep F-6's rule — owner decision pending`.

## 9. Compliance (COMPLIANCE §1)
1 Performance: yes — F3 line in view on every performance route and image; baseline verdict and geometric-vs-range mix
removed (F3b, D-10); month verdict removed (F4); Demo never verified (F3a, P2). 2 Personal data: shows `last_synced_at`,
account labels, removal and disconnect dates (stored fields; decided item 5). 3 Money: no. 4 Comms/tracking: one count field
in an existing counts-only log. 5 User text: no. 6 Accounts: no. 7 Vendors/deps: none. 8 Accessibility: words, `<time
datetime>`, ≥ 4.5:1, static text, 44 px targets unchanged. 9 Security: no. 10 Claims: AC12. 11 Checkout: no.

## Debate log
| # | Round 1 (UX lead) | Raised by | Resolution (round 2) |
|---|---|---|---|
| 1 | Baseline "others" line as geometric mean beside this stock's range | BL 1 | One mean on both sides: range vs range; geometric tiles removed |
| 2 | Heading "…this stock and all others" | BL 2 | "…this stock and other stocks"; `all (trades\|stocks\|others)` banned in AC12 |
| 3 | Disconnect only when every connection is gone; partial unhandled | BL 3 | Partial: live-only `connectedLine` + one `‹inst› disconnected ‹d›` part each; AC9 |
| 4 | Frozen line 2 kept "updated" | BL 4 | Frozen: `lastClose` only; frozen wins over idle; tested |
| 5 | Null `lastSyncedAt` counted as idle | BL 5, Eng 12 | `lastSyncedAt ?? consentAt`, 30 d, per record; tested |
| 6 | Feed card always showed a status line | BL 6 | Only when frozen or idle |
| 7 | `removed_at` set and cleared on every sync | BL 7, Eng 11 | Only after a successful non-empty list; once, never cleared; not on the disconnect path; `lib/sync-removed.test.ts` |
| 8 | Separate `idle_connections` log line, `idleCount(rows)` | BL 8, Eng 13 | One SQL count as a field of the existing tick JSON; helper dropped |
| 9 | Trade/month line in the whole-record box, with fallback | BL 9 | Last line of "This trade"/"This month"; no fallback; e2e asserts |
| 10 | `No range yet (k of min bets)` | BL 10 | `No range yet: k of the min separate bets needed` |
| 11 | Compare demo/mixed explainers lacked the wide-range sentence | BL 11 | Added |
| 12 | Demo scan over page text only | BL 12 | Also `<title>`, meta description, `og:image:alt` |
| 13 | Scrub date → `dateText` | Eng 1 | Scrub stays numeric; only the at-rest subline changes |
| 14 | `.chart-ends` placement unstated | Eng 2 | Inside `figure.chart`, outside the figcaption |
| 15 | `demoLink: 'Demo'`; status shown while failed | Eng 3 | `'Demo data'`; hidden while importing or failed |
| 16 | Pane opt-out by prop only | Eng 4 | Memo key `user_id:flag` in `feed-rows.tsx`; `pane(id, false)` from the section |
| 17 | Month disclaimer one nowrap line at 28 px (1294 > 1072 px) | Eng 5 | Two lines, counted; label 64, month/record 36; trade 136, stock 96; `image-fit` tests |
| 18 | `fitSize` max changed to 80 | Eng 6 | Default 96 kept; 64 passed at the call site |
| 19 | `compareTail` dropped "Sample data" | Eng 7 | Kept as the description phrase; "Demo" stays the state name |
| 20 | Overlap kept "verified" on demo pages | Eng 8 | Per kind; empty-side strings kept; demo scan uses NVDA/AMD |
| 21 | Render-based unit tests | Eng 9 | Pure models in `.ts`; DOM in e2e |
| 22 | No way to remove an account in e2e | Eng 10 | Vendor fake `POST /_remove` |
| 23 | Three queries in `statusFacts` | Eng 14 | One query, `recordStates` id set |
| 24 | C1 fixtures unstated | Eng 15 | Fixture map, signed-in `/me/*`, one `%` regex, `/how` scroll rule, 280-char thesis |
| 25 | One commit | Eng 16 | Three green commits (§0) |
| 26 | F-7 filing profiles unhandled | Eng 17 | `source:'filing'` → no line; value coordinated with F-7 |
| 27 | Fix #8 and D-04 wording | BL | Declined here; out of scope |
| 28 | Open positions as "Account i of n" | committee | Rejected for this PR; ponytail note |
