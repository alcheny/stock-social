# F-6 review (independent code review, 2026-11-01)

Branch `claude/f6-open-positions`, diff `origin/main...HEAD` without `docs/features/logs/**`.

**Scope note.** `origin/main...HEAD` is 144 files. The F-6 work is 17 of them: `lib/open-split*`, `lib/feed.ts`,
`lib/feed.open.test.ts`, the `OPEN` block in `lib/copy.ts`, `app/open-rows.tsx`, `app/pane.tsx`, `app/ui.tsx`,
`app/feed-rows.tsx`, `app/u/[handle]/page.tsx`, `app/t/**`, `app/how/page.tsx`, `app/globals.css` and
`e2e/f6-open-positions.spec.ts`. The rest arrives through merge `64e164a` of `origin/claude/serene-faraday-f45ffc`.
That branch is not yet in `origin/main`; it holds F-4 record-card code, workflows, POLICY, `team/` and `scripts/`.
I reviewed the 17 F-6 files against `git diff origin/claude/serene-faraday-f45ffc...HEAD`.

**What I ran.** `node --test lib/open-split.test.ts lib/feed.open.test.ts` passed 10/10, with the DB tests running.
`lib/copy.test.ts` and `lib/feed.signed-out.test.ts` passed 31/31. `npx tsc --noEmit` was clean.
`node scripts/compliance.ts diff origin/main` reported ok. I did not run e2e because there was no built server.

## Verdict: not approved (2 BLOCKING, 1 merge-order condition)

---

### BLOCKING

**B1. e2e: the feed-eligible fixture lives outside the feed lock, so the exclusive feed tests can flake.**
`e2e/f6-open-positions.spec.ts:39-58` and `:150`.
`f6_mixed` has 5 closes from the last ~1.2 h with |r| ≥ 20%, so it ranks near the top of the feed. It is inserted in
`beforeAll` and removed in `afterAll`, but the shared lock is held only inside the feed test (`:150-178`). While the
profile and `/t` tests in this file run, a parallel worker can take `feedLock('exclusive')`. Those tests are the
heavy-feed test (`e2e/app.spec.ts:979`, which needs all 50 fresh cards to be its own) and the `e2e/section.spec.ts`
tests (`:79`, `:92` and others). They then find an `f6_mixed` card on their pages. That is the failure
`e2e/feed-lock.ts` was written to prevent. Its header says a feed-eligible fixture holds the lock shared, as
`e2e/similar.spec.ts:19-23` does for the whole life of its fixture. The comment at `:5-6` ("so no other spec's feed
loses cards to them") is also wrong for `f6_mixed`.
*Fix:* take `feedLock('shared')` at the top of `beforeAll`, before the insert, and release it in `afterAll` after the
delete. Remove the lock from the feed test, or keep it there as a re-entrant no-op.

**B2. The Similar-trades pane (`LazyPane`) shows realized-only numbers for a trader who has open positions.**
`app/u/[handle]/pane/route.ts:21` and `app/lazy-pane.tsx:23`.
`ProfilePane` is the pane on the feed and also the pane in a profile's Similar trades sheet. That sheet gets its data
from `/u/<h>/pane`. The route returns `{ state, trades }` with no unrealized percents, and `LazyPane` passes no
`open`. Scenario: trader B has 5 losing open positions. On trader A's profile a viewer opens B's Similar row. The sheet
shows B's realized grid with no label, no unrealized grid, no combined line and no chart note. The same pane on the
feed shows all four. This breaks AC1 ("feed card and pane … shows realized and unrealized results separately") and the
owner's decision of 2026-11-01 ("all other information should reflect them"). It also makes the same pane show
different numbers depending on where it is opened.
*Fix:* in the route, when `state` is `connected` or `failed`, add
`open: (await sql\`select unrealized_pct from open_positions where user_id = ${id}\`).map(r => r.unrealized_pct)`.
Pass `open={data.open}` in `LazyPane`. Extend the existing pane-route test, or add a case to `feed.open.test.ts`,
covering connected, failed, none and importing.

### Merge-order condition (procedural, not a code defect)

**M1. The PR carries unmerged work from another branch.**
It contains `origin/claude/serene-faraday-f45ffc` (F-4 record card, workflows, POLICY, `team/`, `scripts/`), which
is not on main. If this PR merges first, all of that lands under an F-6 title, and F-4 lands ahead of its turn in the
coordination map. That breaks reviewer rule 1 ("nothing unrelated changed").
*Fix:* merge only after that branch's PR is on main, then merge main in again so the PR diff is the 17 F-6 files.

---

### NON-BLOCKING

**N1. Two "no closed trades" messages on an open-only profile.**
`app/u/[handle]/page.tsx:258-262` and `:285`.
For a connected trader with positions and no closes, the page renders `OPEN.noCloses` ("No closed trades, so there are
no realized results."). Lower down it still renders `recordBodyCopy` ("No closed trades yet. Your record starts with
your first close."), which `e2e/connect.spec.ts:1236` asserts. The second message also contains the "yet" the plan's
copy rules ban.
*Fix:* drop `OPEN.noCloses` and keep the existing record-body line, or suppress the record-body line when `open`.
Then assert one message in `f6_openonly`.

**N2. "Not included in the figures above" appears where there are no figures above.**
`app/t/[symbol]/OpenPositions.tsx:11`, used in the no-closes branch at `app/t/[symbol]/page.tsx:80`.
`app/t/compare/page.tsx:67` has the same problem: on `/t/F6D` and on an empty compare column, the text points to
figures that do not exist.
*Fix:* add an `open-only` variant without that clause, or say "Closed-trade figures, when there are any, exclude these."

**N3. Freshness claims for failed records.**
The feed card, the pane, `/t` and compare say "at current value" or "what is open now" with no date. A `failed` record
may hold positions from an old read, and the profile is the only surface that shows "as of". This leans against F2/F3a
("never imply completeness"). Scenario: an import fails on Oct 1, and on Nov 1 the feed card still reads "Also open: …"
as if current.
*Fix:* add "as of {date}" to the pane's chart note and the `/t` paragraph, or leave failed records out of `/t`
aggregates. At minimum, record the decision.

**N4. `/t` and compare do two unbounded, uncached reads on every view.**
`app/t/open-positions.ts:13-16`.
`open_positions` has PK `(user_id, account_id, symbol)` and no index on `symbol`, so `where p.symbol = any(...)` scans
the whole table on every `/t/<sym>` and compare view. `recordStates` then runs `rows.filter` once per holder, which is
O(holders × connections) for a widely held symbol. That is fine at demo scale.
*Fix:* add an additive `create index if not exists open_positions_symbol on open_positions(symbol)` (outside this
plan's "no schema change", so it needs a follow-up), or a `ponytail:` note. Running `symbolOpen` inside the page's
existing query batch would also remove one sequential round trip (`page.tsx:123`).

**N5. `combined()` filters non-finite unrealized values but not closed ones.**
`lib/open-split.ts:28-35`.
`open_positions.unrealized_pct` and `closed_trades.return_pct` are both `double precision`, which can hold NaN or
Infinity. One NaN close makes the combined line print "NaN%" while `stats()` prints its own value. The module is
shared with the share-card session, so make it total.
*Fix:* `const c = closed.filter(Number.isFinite)` and use `c` for `n` and the sum. Add a unit case.

**N6. Duplicated tone-class logic.**
`app/ui.tsx:58` inlines `tone(open.avg) === 'flat' ? undefined : tone(open.avg)`, which is the same as `toneClass`
in `app/open-rows.tsx:9`.
*Fix:* import `toneClass` from `./open-rows.tsx`, or move it next to `tone` as a non-string helper.

**N7. Test gaps against the plan and the ACs.**
- AC3 ("exactly today's numbers") is checked only by `[data-open]` count 0, "win rate" text and the figcaption. No
  test compares the no-positions HTML before and after. A unit render test of `ProfilePane` and `TradeCard` with
  `open` undefined against `open: []`, comparing `renderToStaticMarkup` output, would pin it cheaply.
- `OPEN` is not in `allCopy()` (`lib/copy.ts`), so `lib/copy.test.ts`'s banned-claims scan never sees it.
  `open-split.test.ts` copies the list, which can drift. Add `OPEN` with arguments that work: `allCopy` calls
  functions with `('x', 2, 1)`, so `OPEN.line` needs a wrapper.
- `e2e/f6-open-positions.spec.ts:174` (`.row:not([data-handle^="f6_"]) [data-open]` count 0) assumes no other worker's
  feed-eligible trader has positions. Scope it to the demo handles.
- AC1 and AC6 also cover the share card at every size. That work belongs to the F-4 session, so the PR body must not
  tick those boxes. Until it lands, the unfurl's `og:description` mentions open positions and the card image does not.

**N8. Policy note for the owner (no change asked).**
The `/t` paragraph prints a live count of current holders ("held by 3 traders") next to an up/down tally for one
security. That is an aggregate with no handles, as the committee decided under F1/F3b. Still, it is the closest thing
in the product to a crowd-positioning figure about a security. It is worth one explicit line in the PR's
`## Compliance` answer to item 1.

---

### Checked and fine
- **State filtering:**
  - Profile: positions are read only when the state is not `none`, and the summary only for connected or failed.
  - Feed: `openOf` keeps rows only for traders that are on the page and connected or failed. Deleted traders are
    excluded through `onPage`, since cards join `users.deleted_at is null` and the section requires `who.has`.
  - `/t`: joins non-deleted users, then filters on `recordStates`.
  - Importing: the profile shows the list with its old classes and no aggregate. Nothing leaks on any surface for
    `none` or importing.
- **No-positions path:** every new node sits behind `open &&` or `both &&`, with `open` null when there are no rows.
  The position-list class falls back to the old `> 0 ? 'up' : 'down'` when `open` is null.
- **`Math.min` on an empty array:** `openAsOf` is computed only when `open` is non-null, which needs at least one row.
  `fetched_at` is `not null`.
- **Profile and pane agree:** both use the full record (`records()` against the profile's full select) and the same
  unrealized set, so the combined numbers match. The e2e asserts +2.1% (8 results) on both.
- **Server and client:** `TradeCard` renders only from `feed-rows.tsx`, either on the server or inside the server
  action `feed-actions.tsx`, never in a client component. `FeedPage` (with its Map) never crosses a client boundary.
  `LazyPane` (client) imports `open-rows.tsx` and `open-split.ts`, which are pure. The only locale date is
  server-only, with `timeZone: 'UTC'`.
- **Feed cost:** one indexed query (PK prefix `user_id`) inside the existing `Promise.all`. It is additive and does
  not read viewer tables. The feed-order test pins the ranking.
- **Units:** percent only. No `$`, units or price appear in the copy. The compliance scan passes.
