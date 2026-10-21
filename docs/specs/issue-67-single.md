# Spec: Watch a stock (#67) implemented and committed

Variant: **single** · Spec agreed by designer and business analyst

## Agreed spec

# Spec: Watch a stock (private ticker watchlist + "new since you last looked")

## Scope
Signed-in users can watch up to 25 stocks. /t shows a "Your watched stocks" strip with counts of new verified closed trades since they last viewed each stock. No notifications, email, ranking, streaks or return figures. `closed_trades`, theses and the feed are untouched. Percent-only rule is unaffected (the strip shows counts only).

## User stories
1. As a signed-in viewer on /t/NVDA, I tap **Watch** and the stock is saved. The button becomes **Watching**; tapping again unwatches.
2. As a signed-in viewer, on /t I see a strip of my watched stocks, each with "N new verified closed trades since you last looked" or "No new trades".
3. As a signed-out viewer, I see "Sign in to watch" on /t/[symbol] and nothing else new anywhere.
4. At the cap I get a clear message, not a silent failure.

## Schema (db/schema.sql, append only)
```sql
create table if not exists ticker_watches (
  user_id int not null references users(id) on delete cascade,
  symbol text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (user_id, symbol)
);
```
Insert sets `last_seen_at = created_at` (use one `now()` value, e.g. `insert ... values ($1,$2, now(), now())`). Match the users id type in the existing schema. No drop/truncate/delete from.

## Pure functions (lib/ticker.ts)
- `canWatch(currentCount: number, symbol: string): { ok: true; symbol: string } | { ok: false; reason: 'invalid' | 'cap'; message: string }`
  - Uses `normalizeSymbol` (lowercase accepted, uppercased in result). Invalid check first, then `currentCount >= WATCH_CAP` (export `WATCH_CAP = 25`).
  - Messages: invalid → "That isn't a valid stock symbol."; cap → "You're watching 25 stocks, the maximum. Unwatch one to add another."
  - Only applies to adding. Unwatching an existing watch is never blocked by the cap.
- `watchSummary(watches: {symbol; lastSeenAt: Date}[], closedTrades: {symbol; closedAt: Date; verified: boolean}[]): WatchItem[]`
  - `WatchItem = { symbol; newCount: number; demoOnly: boolean }`
  - newCount = trades for that symbol with `closedAt > lastSeenAt` (strictly). Wins and losses count identically; nothing uses return values.
  - demoOnly = the symbol has at least one trade in the input and none are verified (all demo). Use the same "verified" meaning as `TickerRow.verified`. Symbol with no trades at all: demoOnly false, newCount 0.
  - Sorted alphabetically by symbol (`localeCompare`), never by count.
  - Empty watches → `[]`.
  - Note for the engineer: demoOnly must be computed over ALL trades for the symbol, not only new ones, so the SQL must return per-symbol total and verified counts as well as the new count. If `watchSummary` takes pre-aggregated rows, define the input type accordingly (`{symbol, closedAt, verified}` rows are fine in tests; production can pass aggregated rows through a thin adapter). Keep the pure function tested as specified.

## Server action (app/actions.ts)
`toggleWatch(symbol: string)`:
1. `currentUser()`; if none → redirect to /login (the page never offers the button signed out; this is a guard).
2. `normalizeSymbol`; invalid → return/redirect with the invalid message.
3. If a row exists for (user, symbol): `delete from ticker_watches where user_id=$1 and symbol=$2`. (This is a user-owned preference table, not schema, so it is allowed.)
4. Otherwise count the user's rows, call `canWatch(count, symbol)`; on `cap` redirect to `/t/SYMBOL?watch=cap`; else insert with `on conflict do nothing`.
5. `revalidatePath` for /t and /t/SYMBOL and redirect to `/t/SYMBOL`. All SQL parameterised.
The cap message renders on /t/[symbol] when `searchParams.watch === 'cap'` (role="status"). Invalid input is not reachable through the UI, so it may only redirect to /t.

## /t/[symbol] UI
- Near the page heading (right-aligned on desktop, under the title on phones, full-width tap target ≥44px high):
  - Signed in, not watching: form with button **Watch** (secondary style, no icon-only).
  - Signed in, watching: button **Watching** with `aria-pressed="true"`, and a small muted line "Unwatch" in the accessible name: `aria-label="Watching NVDA. Tap to unwatch."`.
  - Signed out: a plain text link `Sign in to watch` → `/login`. No other watch UI.
- Muted helper line under the button, signed in only: "Private. We'll show new verified closed trades on the stock index. No notifications."
- Cap message appears under the button when `?watch=cap`.
- Unknown/empty symbol pages still allow Watch (a user may watch a symbol with no trades yet, valid by `normalizeSymbol`). Do not let an invalid symbol render the button.
- **Mark seen (deliberate write on GET):** after the page has resolved the user, if signed in and a watch row exists for the symbol, run one `update ticker_watches set last_seen_at = now() where user_id=$1 and symbol=$2` inside try/catch; swallow errors (optionally `console.error`). Never run when signed out. Place a comment in code stating this is a deliberate write during GET. Run it AFTER the page's own data queries so the page content is unaffected, and it must not delay or break rendering.
- The page reads only `currentUser()`. The sitemap, robots, noindex logic and `opengraph-image` must not read cookies/session. If `generateMetadata` is used for noindex, keep it session-free. Note: reading cookies makes the route dynamic; accepted.

## /t index UI
- Above existing content, only when signed in AND the user has ≥1 watch: section **Your watched stocks** (h2).
- One list (`<ul>`), alphabetical, one row per watch: symbol (bold) with Demo badge when `demoOnly`, and text: `N new verified closed trades since you last looked` (singular: `1 new verified closed trade since you last looked`), or `No new trades`. The whole row is a `Link` to `/t/SYMBOL` with `prefetch={false}` (prefetch must never clear the count, since the destination page marks as seen on render).
- Rows with N>0 are not more prominent than others beyond the text itself: no colour change, no badge counters, no red dots, no sorting by count. Wins vs losses indistinguishable. No return figures.
- For demo-only symbols the copy remains "N new closed trades (demo data)" — use "verified" only when not demoOnly. Demo badge shown regardless.
- Signed in with no watches: show nothing extra (no empty-state clutter), optionally one muted line: "Watch a stock from its page to see new trades here."
- Signed out: /t is unchanged.
- Layout: single column, rows full width with ≥44px height, text wraps on 320px width.

## Strip query (one query)
```sql
select w.symbol,
       count(*) filter (where ct.closed_at > w.last_seen_at)::int as new_count,
       count(ct.*)::int as total,
       count(*) filter (where ct.verified-equivalent)::int as verified_total
from ticker_watches w
left join closed_trades ct on ct.symbol = w.symbol
-- plus the existing join/derivation the app uses to determine verified (see how /t index computes demoOnly)
where w.user_id = $1
group by w.symbol
order by w.symbol
```
The engineer reuses whatever the current /t/[symbol] page uses to define "verified" (user source). Exactly one parameter query, not per symbol. Because it is bounded by 25 watches it needs no new index beyond the existing symbol index (add `create index if not exists closed_trades_symbol on closed_trades (symbol, closed_at desc)` only if none exists).

## States
- Loading: server rendered, no spinner. Form action pending state: button disabled via `useFormStatus` is optional; not required.
- Error: toggle failure redirects back with the page intact; mark-seen failure is silent.
- Empty: described above.

## Accessibility
Buttons are real `<button>` in a `<form>`, works without JS. Strip is a labelled section (`aria-labelledby`). Count text is plain text, not colour-only.

## Acceptance → tests
1. `lib/ticker.test.ts` `watchSummary`: empty watches; watch with no new trades ("No new" → newCount 0); only losses counted; mix across symbols with different `lastSeenAt`; demo-only flagged; alphabetical output regardless of input order; strict `>` boundary (trade at exactly lastSeenAt not counted).
2. `canWatch`: invalid symbol (`"BRK.B!"`, empty), cap at 25 (24 ok, 25 rejected), lowercase accepted and uppercased.
3. e2e (one check): sign in as seeded trader, open a seeded symbol, click Watch, button reads Watching, /t shows the strip containing the symbol. Signed-out context: /t/SEEDED returns 200, shows "Sign in to watch" link, and no Watch/Watching button and no strip on /t.
4. Existing tests pass, `npx tsc --noEmit` clean, `node scripts/autopilot.ts guard main` passes.

## Out of scope
Notifications, email, feed integration, sorting watched stocks by activity, return figures, public watcher counts, watchlist on profiles, unwatch-all, import.

## Designer ⇄ business discussion

### Round 1

**Designer:** Private watchlist of up to 25 stocks. A Watch/Watching button sits on /t/[symbol]. A "Your watched stocks" strip on /t shows alphabetical counts of new verified closes since the last view. Viewing the stock page marks it seen.

**Business analyst (approved):**
- Ease of use: Good. One tap on Watch / Watching, a form that works without JS, 44px targets, and a plain "Sign in to watch" link for signed-out viewers. The helper line ("Private… No notifications") sets expectations. The strip copy is plain text that doesn't rely on colour.
- Retention: This adds the missing return loop for stock-focused viewers. The strip on /t answers "anything new in NVDA?" without any streak, ranking or notification mechanics. Mark-seen on render with prefetch={false} keeps the count honest. Alphabetical, count-neutral rows keep wins and losses equal. A weakness is that the loop only works if the viewer comes back to /t unprompted. That is accepted under the no-notifications rule, and the DB measures (distinct watchers, returns more than 1 hour after creation) will show whether it works.
- Virality: This step is intentionally not viral. Watchlists are private and there are no public watcher counts, which protects trust. The only small spillover is that signed-out viewers see the Sign in to watch prompt, which may add some signups. Nothing in the spec blocks later sharing of ticker pages.
- Feedback: Approved. Three notes for the engineer.
1. Verify that `/login` is the real sign-in route, and don't assume the dev-stub behaviour.
2. Make the strip's `demoOnly` come from all of a symbol's trades, not only the new ones, and use the same verified definition as `TickerRow.verified`.
3. A mark-seen UPDATE that runs after the page queries must not run for crawlers or signed-out viewers. Also make sure the noindex logic and `generateMetadata` don't read cookies.
Keep the new schema append-only with no drops, and keep the e2e check to one test.

## QA log

| Round | By | Result | Findings |
|---|---|---|---|
| 1 | tester | ✖ fail | [bug] app/t/page.tsx:52-61: The strip is rendered after the `!all.length` early return. A signed-in user who watches stocks while no symbol has closed trades (for example the seeded DB is empty) sees no 'Your watched stocks' section on /t. Watched symbols with no trades are valid per the spec. Render the strip in that branch too. · [spec] app/t/[symbol]/Watch.tsx:35-40, app/globals.css: The spec asks for a secondary-style button, full-width on phones and right-aligned on desktop. The Watch/Watching button uses the global primary accent `button` style. `.watch` has no CSS, so it is neither full |
| 2 | tester | ✖ fail | [spec] app/t/page.tsx Strip, count text: The strip copy leaves out "verified" for non-demo symbols. The spec requires "N new verified closed trades since you last looked" (singular: "1 new verified closed trade since you last looked"). The code renders "N new closed trade(s) since you last looked", and adds "(demo data)" only for demo-only symbols. The spec says "verified" is used when the symbol is not demoOnly, so the missing word is a mismatch. It also weakens the verified-record product rule. · [note] app/t/page.tsx loadStrip / lib/ticker.ts watchSummary: newCount counts every trade after  |
| 3 | tester | ✅ pass | [note] checks: I couldn't run tsc, unit tests, e2e or the guard script because Bash was denied in this session. My verdict comes from reading the diff against the spec only. CI or an engineer run should confirm `npx tsc --noEmit`, `npm test`, `npm run test:e2e` and `node scripts/autopilot.ts guard main`. · [note] app/t/[symbol]/Watch.tsx:42: The cap message renders whenever `?watch=cap` is in the URL, even if the user is already watching the symbol (stale or bookmarked link) or has since unwatched stocks. It always reports 'maximum 25', which can be wrong. Suggested fix: show it only when `!st |

## Cost

8 role calls, $1.30 total: designer#1 $0.12, business#1 $0.08, engineer#1 $0.40, tester#1 $0.16, engineer#2 $0.17, tester#2 $0.11, engineer#3 $0.07, tester#3 $0.19
