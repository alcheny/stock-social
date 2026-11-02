# F-21 plan · Exclusion counts beside the headline (UX lead)

Feature: `docs/features/F-21-exclusion-counts-beside-the-headline.md` (decisions and ACs fixed by the approval council,
cycle 5). Base: `origin/main` at ca34767. This plan changes no decision; where I think a decision needs another look I
say so in §9 rather than planning around it.

## 0. Where main stands (verified at ca34767)

- **Prerequisites are met.** #84 (F-24, `excluded_held`, the future-count query) merged as bdf3ea9. #97 (F-23, pane
  model) merged as ca34767. The `Blocked:` line in the feature file is out of date. The orchestrator sets
  `Status: ready` when it records the start.
- **Slot partners.** F-29 is `ready` but not built: the pane still prints `ShareTradesLabel` above the stats
  (`app/pane.tsx:79`), and "Excluding options" still repeats. F-34 is blocked and its line does not exist: the strip
  still says `SHARE_CARD.openShort` (`lib/record-strip.ts:122`), and the pane has F-6's `OpenGrid`. In this plan the
  pane's line order is exclusions, then whatever open block is there (OpenGrid today, F-34's line later), then the
  options qualifier wherever F-29 puts it. The builder who owns the slot keeps that order.
- **Today's counters** (`db/schema.sql`): `excluded_positions` (:39), `excluded_future` (:330), `excluded_corporate`
  (:778, which includes F3-1's unusable rows, `lib/sync.ts:178`), `excluded_options_short` and `excluded_options_other`
  (:1030-1031), `excluded_exercise_shares` (:1041) and `excluded_held` (:1195). Public filers have
  `public_filers.excluded` jsonb (:343) with keys `no_price`, `unreconciled`, `derivative`, `gift`, `other` and
  `indirect` (`lib/copy.ts:968-972`).
- **Profile lines now** (`app/u/[handle]/page.tsx:377-391`): positions, future, corporate, held, paper, then public. The
  option count lines live in `OptionsLines` (`app/u/[handle]/options-block.tsx:53-68`). The short and technical lines
  render only while the gate is open. The exercise-share line renders in both gate states. The profile shows **no
  total**.

## 1. One shared function

**File `lib/exclusions.ts`** (pure, no db import, so the client `lazy-pane` bundle can import the line component):

```ts
export type ExclusionCounts = {           // stored columns only; no per-request scan
  excluded_positions: number; excluded_future_sells: number; excluded_corporate: number; excluded_held: number;
  excluded_shared: number; excluded_options_short: number; excluded_options_other: number; excluded_exercise_shares: number;
  public?: Record<string, number>;        // public_filers.excluded for an F-7 record, else undefined
};
export const SUMMED = { excluded_positions, excluded_future_sells, excluded_corporate, excluded_held, excluded_shared,
  excluded_options_short, excluded_options_other, excluded_exercise_shares, 'public.no_price', 'public.unreconciled' } (reason per key)
export const NOT_SUMMED = {               // each with its reason, in code
  excluded_future:   'counts buys too; its sell part is excluded_future_sells (decision 2026-11-01, unit rule)',
  paper:             'whole simulated accounts the record never includes; not a trade exclusion; the profile keeps its own line',
  'public.derivative' | 'public.gift' | 'public.other' | 'public.indirect': 'not an open-market sale, so never a trade in the headline unit',
};
export function exclusionTotal(c: ExclusionCounts): number   // integer sum of SUMMED keys
export function exclusionReasons(c, optionsGate): string[]    // the profile's per-reason lines, in order, from existing copy constants
```

- **Inputs** are stored columns only: `users.*` plus `public_filers.excluded`. A batch loader in
  `lib/exclusions-load.ts`, `exclusionCounts(ids): Map<number, ExclusionCounts>`, reads them in **one** query
  (`users u left join public_filers pf on pf.id = u.public_filer_id where u.id in …`). Each surface uses the user query
  it already makes where it can (§5).
- **Reason lines reuse their constants:** `PROFILE.excludedPositions/Future/Corporate/Held`, `OPTIONS.short/technical/
  exerciseShares` and `PUBLIC.excluded.*`. The builder adds no copy for them and duplicates none. That matters most for
  `excludedHeld`: the fixes-cycle5 session is changing its words to "N sells excluded while a possible duplicate is
  checked.", and F-21 picks the new words up because it only calls `PROFILE.excludedHeld(n)`. The future reason uses
  `PROFILE.excludedFuture(excluded_future_sells)`, which already says "imported trade", so it stays true for sells
  only. Unknown public keys keep going to `PUBLIC.excludedOther` and are not summed; the guard below stops a new
  literal key from slipping through unclassified.
- **Guard test, `lib/exclusions.test.ts`.** A pure `unclassified(sources)` scans source text and returns every key
  that is in neither `SUMMED` nor `NOT_SUMMED`:
  1. `lib/trades.ts`: the `excluded\w*` keys of `export type MatchResult = {…}`.
  2. `lib/options.ts`: the keys of `matchOptions`' return-type annotation, plus `rebuildOptionTrades`' return type in
     `lib/options-sync.ts`. Any `excluded\w*` key, or any key outside `{trades, counts, short, other}`, must be
     classified. `Counts` sub-keys fold into `other` by construction (`lib/options.ts:169`), so a new cause is summed
     automatically.
  3. `lib/public-trades.ts`: every `count('<k>')` literal, plus the `excluded*` keys of `matchPublic`'s return type.
  4. `db/schema.sql`: every `excluded_\w+` column on `users` (the `create table` block and every
     `schema_add_column('users', 'excluded_…')`).
  5. Rebuild writers: every `update users set … excluded_\w+` in `lib/*.ts` (sync, options-sync, and any later
     writer).

  **Mutation check, permanent and in the PR:** the same test calls `unclassified` with the real sources (expects `[]`)
  and with three mutated copies: `excludedX: number;` injected into MatchResult, the same key injected into
  matchOptions' return type, and `count('x_dummy')` injected into matchPublic. Each copy must return the dummy key. A
  fourth copy adds an `excluded_x` schema column, which must also fail. The PR body pastes the four failing assertion
  messages. When F-22 or F-32 add kinds later, the guard forces them to classify those kinds.

## 2. The future-BUY problem

- **#84 stores no sells-only count.** Its query (`lib/sync.ts:187-189`) is `count(*)` over every future-dated row,
  buys included, written to `excluded_future`.
- **Minimal fix:** the same query gains `count(*) filter (where a.side = 'SELL')::int as future_sells`, so there is no
  second scan. The rebuild writes it beside `excluded_future` (:190) into a new column. Schema, appended and
  idempotent: `select schema_add_column('users', 'excluded_future_sells', 'int not null default 0');` with a comment
  citing F-21. `excluded_future` stays as it is (the owner's /me view and existing tests read it) and is listed in
  `NOT_SUMMED`.
- **Backfill:** a trader's new column fills on their next rebuild. The hourly sync rebuilds the records it reads.
  Frozen records (TR-5) are not read, so the owner runs the existing `scripts/rebuild-records.ts` once after the deploy.
  This goes in the build log as an owner step. No schema update statement.
- **Test (DB):** the record has a future-dated BUY, a matched pair and one corporate-excluded sell. The total is 1 and
  `excluded_future` is 1. In the test DB, the BUY's `executed_at` is then moved into the past (it matures) and the
  record is rebuilt: the total is still 1 and `excluded_future` is 0. A second fixture has a future SELL: the total
  counts it while it is future-dated.
- **Known limit, out of scope** (a ponytail note in `lib/exclusions.ts`): future-dated option rows and future-dated
  unusable corporate rows are uncounted today. That is not F-21's work, since F-21 only sums.

## 3. notShared

- **The gap is closed on main.** Fixes cycle 3 (#79, 63843a7) added `notShared(tx, userId)` to the rename-chain read,
  now at `lib/sync.ts:166`. The other two reads are at :137 (stream) and :189 (future count). The chain's
  corporate-action read also leaves marked accounts out (`lib/corporate-actions.ts:319-321`), and so do the option
  reads (`lib/options-sync.ts:21`, :91, :108, :126, :139).
- **Tests on main.** A behavioural test already exists: `lib/fixes-cycle3.test.ts:360` (a marked account's rename chain
  publishes nothing). There is also the source count in `lib/shared-accounts.test.ts:15`, which expects exactly 3 uses.
- **No count exists.** The decision asks for a real per-sell counter, so the plan adds `users.excluded_shared` (an
  appended `schema_add_column`). It is computed in the rebuild as the number of SELL activities in marked accounts,
  after the same paper, future, stored-first and duplicate filters as the stream, plus option close rows in marked
  accounts using the options matcher's close predicate. The fragment is a new export,
  `onlyShared(db, userId)`, in `lib/shared-accounts.ts` (the inverse of `notShared`). That keeps the
  `notShared(tx, userId)` source count at 3, so the existing test needs no edit.
- **New behavioural test,** in a new file `lib/f21-exclusions.test.ts` so `fixes-cycle3.test.ts` is not touched. The
  rename-chain fixture (OLD→NEW, buy and sell) is rebuilt and has 1 close and a total of 0. The account is then marked
  and rebuilt again: there are 0 closes, `excluded_shared` is 1 and `exclusionTotal` is 1. A second marked account
  outside any chain is checked the same way.
- **Profile reason line:** new copy, additive in `lib/copy.ts`:
  `PROFILE.excludedShared(n)` = "‹n› sells excluded: their account belongs to another profile's record." It names no
  other profile (P3). See Q2.

## 4. The line

- **Copy** (an additive `EXCLUSIONS` block in `lib/copy.ts`):
  - `EXCLUSIONS.line(n)` = `${counted(n, 'trade')} excluded from these figures` is the pane and strip link text, with
    a visible tail ` · reasons on the profile` inside the same link. The accessible name is the whole visible text
    (label-in-name, WCAG 2.5.3) and is descriptive out of context.
  - `EXCLUSIONS.title(n)` = the same `line(n)` words, used as the profile block's heading.
  - The unit is "trade": sells and option closes only, never buys.
  - No "hidden", "removed", "you" or "your", "failed", "missing", "error" or "!".
- **Look:** `<p className="muted small exclusions-line" data-exclusions>` wrapping a real `<Link className="tap44">`.
  Muted colour, underlined (so the link is not shown by colour alone), no icon, no `WarnNotice`, no warn or loss
  token. The trader has no setting to turn it off. It renders only when `exclusionTotal > 0` and the record is not
  importing (counts are partial mid-import, TR-3).
- **Pane placement** (`app/pane.tsx`, inside `figures`): directly after `<section className="stats">`, so it sits after
  the headline in DOM order in **both** orders. With open positions (figures lead, then f3) the order is: stats →
  exclusions → open block (OpenGrid, later F-34's line) → CombinedLine → options (F-29). Without open positions the
  order is chart → f3 → … → figures, and the line sits in the same place inside figures. That order already puts the
  disclaimer above the line, so the line cannot push it out.
- **Strip, decided:** the line rides the trade and month pages' **page** surface only, as its own line in
  `record-strip-block` between the figures `<p data-strip>` and the disclaimer. Why this fits F-10's one-line rule:
  D22's rule binds the feed card's record line, and on pages the figures stay one line. The block already has its own
  label, note, disclaimer and link lines, and the exclusion line is a qualifier line like those. It is **not** added
  to `recordStrip()`'s `figures`, `text` or `alt`, so feed cards, the images, alt texts and link-preview descriptions
  (`lib/month-card.ts:55`, the og routes) are unchanged by construction. `RecordStrip` takes an optional
  `exclusions?: { n: number; handle: string }` prop and draws it only when `strip.surface === 'page'`. On the month
  page it goes on the whole-record strip (:113), never on the month's own `figures` strip.
- **Profile target** (`app/u/[handle]/page.tsx`): the summed reason lines are wrapped in
  `<section id="excluded" tabIndex={-1} aria-labelledby="excluded-h" data-exclusions-block>`, with
  `<h2 id="excluded-h" className="small">{EXCLUSIONS.title(n)}</h2>` and then `exclusionReasons(...)` as `p.muted`
  lines. It renders only when n > 0.
  - The paper line and the non-sale public lines stay after the section, outside the total.
  - The exercise-share, short and technical option lines **move** into the section (they are not copied) and leave
    `OptionsLines`. Under the gate, see Q1. That edits `options-block.tsx`, which F-29 also edits: the slot builder owns
    both.
  - `data-excluded-held` stays on its line, for the F-24 e2e.
  - **Focus:** `RowFocus` (`app/u/[handle]/row-focus.tsx`) accepts the id `excluded` as well (regex
    `^(trade-\d+|excluded)$`, an additive change), so the section takes focus on load and on hash change. Without
    JavaScript the browser still scrolls there.
  - Once F-32 adds its "transfer" reason, it is classified in `SUMMED` and appears among these lines.
- **Targets and reflow:** `.tap44` gives a 44 px minimum height. `.exclusions-line a { overflow-wrap: anywhere }`. The
  line wraps at 320 px and 360 px with no horizontal scroll.
- **Contrast:** `--muted` against the pane, strip and profile background in both themes, at least 4.5:1. The tokens
  are already pinned by `lib/a11y-contrast.test.ts`. The e2e also checks the computed colour of `[data-exclusions] a`.
- **States:**
  - Signed out: works. The counts are public, as the profile lines already are.
  - Demo: shown. Seeded demo traders may have `excluded_positions`.
  - F-7 public record: public sum.
  - Frozen or failed: shown from the last rebuild.
  - Importing: none.
  - New trader with 0 closes: no pane. The profile section still shows when n > 0.
  - All losses: no effect.
  - Lazy-pane loading or error: the existing loading and "could not be loaded" lines. The count arrives with the
    model.

## 5. How the count reaches each surface

- **Pane model:** `PaneModel` gains `excluded: number`, an integer count with nothing rounded.
  `paneModel(trades, state, now, unrealized, openAsOf, excluded = 0)` adds it and forces 0 when `state === 'importing'`.
  - Feed: `FeedPage` gains `exclusions: Map<number, number>` from one `exclusionCounts([...onPage])` call next to
    `optionHeadline` (`lib/feed.ts:582`). The query count stays constant in cards (the F-10 load test). `feed-rows.tsx`
    passes it **only** to `ProfilePane`, never to `TradeCard`.
  - `/u/<h>/pane?v=2`: `app/u/[handle]/pane/route.ts` adds `exclusionCounts([user.id])` to its `Promise.all` and passes
    the total into `paneModel`. `lazy-pane` renders `model.excluded`.
  - F-23's payload scan accepts the field because it is an integer.
  - PAYLOAD_V: see Q4.
- **Trade page:** `lib/trade-share-load.ts` adds `u.excluded_*` and `pf.excluded` (left join) to its single existing
  query. **Month page:** `lib/recap-load.ts:15` adds them to its existing user select. Both pages pass
  `exclusionTotal(...)` to `<RecordStrip exclusions>`. No new query; the og routes are untouched.
- **Profile:** the same `exclusionTotal` and `exclusionReasons` over the user row it already loads (plus `filer.excluded`).

## 6. Surfaces that must not change

- **Feed card:** a render test (react-dom/server over `FeedRows` with a trader whose `excluded_corporate = 2` and
  `excluded_held = 1`) checks four things: each card has exactly one `[data-strip]`; no `[data-exclusions]` sits inside
  a card (`.card`, outside `.pane`); the card markup is byte-identical to the same render with every count at 0; and
  the pane in that row does have the line. The e2e checks the same on `/`.
- **Share card and images:** the existing snapshot tests (`e2e/share-card.spec.ts`, `lib/f12-strip.test.ts`, the trade,
  month and stock og tests) pass unchanged. A new test adds that `recordStrip(i, s).text`, `.alt` and
  `stripImageLines(...)` are identical with and without exclusions for `s ∈ {feed, image, figures, page}` (true by
  construction, since exclusions never enter `StripInput`). It also checks that the og route files contain no
  `exclusion` identifier (source scan).

## 7. e2e: `e2e/f21-exclusions.spec.ts` (signed out, 360 px)

**Fixture:** a SQL-seeded trader in the F-24 spec style, under its own handle, with 5 closes (feed-eligible, so it holds
`feed-lock` shared), `excluded_corporate = 2`, one open position, option rows (so the options label shows), and a
second trader with every count at 0.

1. **At 360×740:** the feed pane for the fixture shows `[data-exclusions]` with `EXCLUSIONS.line(2)`. The zero trader's
   pane has none. The pane disclaimer's `getBoundingClientRect().bottom` is ≤ 740 with the line present. The vertical
   DOM order is stats, exclusions, open block, options.
2. The lazy pane (a Similar row sheet) shows the same line.
3. **Equality:** the counts in the pane line, the profile `#excluded-h` and the trade-page and month-page strip lines
   are all equal.
4. **The link:** clicking it lands on `/u/<h>#excluded`. `document.activeElement.id === 'excluded'`, and the section
   lists the corporate reason (the F-32 transfer reason too, once it exists). The accessible name matches
   `/excluded from these figures/`, and the bounding box height is ≥ 44.
5. **At 320×640:** `scrollWidth ≤ 320` on the pane, profile and trade page.
6. **Contrast:** the computed contrast of the link colour against the resolved background is ≥ 4.5, in both colour
   schemes (`emulateMedia`).
7. **Feed card:** the card holds one `[data-strip]` and no `[data-exclusions]`.
8. **Slot AC (F-29/F-34):** the same disclaimer check as test 1 runs over whatever slot lines exist on main. Where a
   partner is unbuilt, an `expect` documents which line was absent. The builder who merges the last slot partner turns
   it into the full three-line check.

**Copy test, `lib/exclusions.test.ts`:** `EXCLUSIONS.line` and `EXCLUSIONS.title` for n of 1, 2 and 1000 contain none
of `hidden|removed|you|your|fail|missing|error|!`. A source scan finds no `warn`, `loss` or `<svg` in
`app/exclusions-line.tsx`.

## 8. Files touched

- **New:** `lib/exclusions.ts`, `lib/exclusions-load.ts`, `app/exclusions-line.tsx`, `lib/exclusions.test.ts`,
  `lib/f21-exclusions.test.ts` (DB), `lib/f21-surfaces.test.ts` (render: feed card, strip and image identity),
  `e2e/f21-exclusions.spec.ts`.
- **Additive edits:**
  - `db/schema.sql`: two appended `schema_add_column` lines.
  - `lib/sync.ts`: the future query gains the sells filter; the shared count; two column writes.
  - `lib/shared-accounts.ts`: the `onlyShared` export.
  - `lib/copy.ts`: an `EXCLUSIONS` block and `PROFILE.excludedShared`. `excludedHeld` is not touched.
  - `lib/pane-model.ts`: one field and one parameter.
  - `app/pane.tsx`: one line in `figures`.
  - `app/u/[handle]/pane/route.ts`, `lib/feed.ts` (`FeedPage.exclusions`), `app/feed-rows.tsx` (pane prop only).
  - `app/record-strip.tsx`: an optional prop.
  - The trade and month pages, `lib/trade-share-load.ts`, `lib/recap-load.ts`.
  - `app/u/[handle]/page.tsx`: the section wrapper and heading, with the public lines split.
  - `app/u/[handle]/options-block.tsx`: three lines move out.
  - `app/u/[handle]/row-focus.tsx`: the regex.
  - `app/globals.css`: `.exclusions-line`.
- **No protected path** (`.github/CODEOWNERS`) is touched. `lib/session.ts` is not touched either (the /me ponytails
  stay).
- **Shared with other work:** `lib/copy.ts` is shared with fixes-cycle5 (additive blocks; read `excludedHeld` from its
  constant). `app/pane.tsx`, `options-block.tsx` and `lib/record-strip.ts` are shared with F-29 and F-34 (one slot
  builder). `lib/feed.ts` and `app/feed-rows.tsx` are shared with F-26 and #102. The profile, trade and month pages
  are shared with #100 and #102. Check `docs/process/coordination.md` before claiming.

## Compliance (COMPLIANCE §1)

1. **Performance:** yes, it qualifies headline figures. The disclaimer is unchanged and stays in view (e2e). There are
   no advice words, losses are unaffected, and there is no completeness claim ("excluded from these figures" says
   less, not more) (§2, F3a, F4).
2. **Personal data:** counts only, already public on the profile, with no new field shown about anyone. The shared
   reason names no other profile (P3, §3). The two new integer columns are deleted with the user row (cascade).
3. **Money:** no. 4. **Messaging or tracking:** no. 5. **User content:** no. 6. **Signup, age or identity:** no.
7. **Vendor, dependency or asset:** none.
8. **Accessibility:** a real link with a descriptive name, a 44 px target, DOM order after the headline, focus moved
   to the target, 320 px reflow, AA contrast, and not shown by colour alone (§9, A1).
9. **Security:** no new endpoint. The pane route gains one read of public counts.
10. **Claims:** the copy is neutral and makes no claim.
11. **Checkout:** no.

## 9. Open questions (with recommendations)

- **Q1 (legal committee, options).** The sum covers `excluded_options_*` (decision 2026-11-01), but while the gate is
  closed the profile shows no short or technical reason line, so the link would land on a section missing those
  reasons. *Recommend A:* follow the decision. The short and technical count lines (counts only, the existing
  re-signed words) move into `#excluded` in both gate states, and the AI legal committee confirms that placement in the
  PR, as F-29 requires. *Alternative B:* sum option kinds only while the gate is open, and name them in `NOT_SUMMED`
  while it is closed ("every option close is outside the headline; F-29's qualifier says so"). B changes a decision,
  so it would wait for the owner. An observation for the owner either way: while gated, the line counts short options
  "excluded" next to "Excluding options", which says much the same twice. A keeps the rule simple.
- **Q2 (business lead or owner).** The shared-account reason wording is "‹n› sells excluded: their account belongs to
  another profile's record." *Recommend* these words. They name no profile, and marks are rare and owner-made.
- **Q3 (business lead).** The link text is "‹n› trades excluded from these figures · reasons on the profile".
  *Recommend* these words. The alternative, "… · see why", is shorter, but "why" can read as a cause the trader
  owns.
- **Q4 (engineer).** Bump `PAYLOAD_V` for the new model field? *Recommend no.* A cached pre-deploy body only lacks the
  line for 60 s or less (the profile always has the reasons), and #105 also touches the payload version, so this
  avoids a conflict.
- **Q5 (engineer or orchestrator).** Backfill of `excluded_future_sells` and `excluded_shared` for frozen records.
  *Recommend* the owner runs `scripts/rebuild-records.ts` once after the deploy, recorded in the build log. No schema
  update.
- **Q6 (UX, at build).** If the 360×740 disclaimer check fails in the open-positions order once all three slot lines
  exist, compact the slot lines first (caption size, one line each). Never move or shrink the disclaimer. If it still
  fails, return the slot to the council.
- **Q7 (owner, existing).** Cycle-3 Q4 (the share card) and OD 2.7 (the consent version names the public exclusion
  counts) stay open. F-21 changes neither the card nor the images.
- **Q8 (orchestrator).** The feature file still says `Blocked` on #97 and #84, which have both merged. Update its status
  when recording the start.
