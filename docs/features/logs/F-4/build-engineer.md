# F-4 · Share card rework · engineer build log

Date: 2026-10-26. Feature: `docs/features/F-4-share-card.md` (owner decisions of 2026-10-22). Plan: `plan.md` (this
folder). The committee reviews this build next; nothing here is a committee verdict.

## What was built

- **One card, every size.** `lib/record-card.ts` (pure) turns a trader's closed trades and record state into the card
  model; `app/u/[handle]/record-card-image.tsx` is the card's only JSX; `app/u/[handle]/record-card-data.ts` is its one
  read. The link unfurl (`opengraph-image.tsx`, 1200×630) and the Share button's picture (`story/route.tsx`, square
  1080×1080 and story 1080×1920) both draw it, so they cannot drift. URLs are unchanged: the Share button and the share
  prompt still point at `/u/<handle>/story?format=square` and `/u/<handle>/opengraph-image`.
- **What the card shows** (AC1, AC2, AC4): name and handle; the record's percent chart (CH-1 series, one line, the
  dashed 0% baseline labelled "0%", the y range always holding 0% and every point, caption "If every trade were the
  same size"); "N closed trades · losses included"; "Record since ‹Mon YYYY› · ‹N› months"; one headline figure, the
  average per trade (the profile's number), with "likely between x% and y%" from 5 independent bets; the evidence label
  ("Evidence: thin", with "· New record" under TR-7 as before); one plain-language trust line from the owner's table;
  the Verified / Demo state; the disclaimer. No win rate, no per-trade rows, symbols, closing times, holding periods or
  worst/best trade (AC6). The square and story pictures also print the profile link (a saved picture has no preview).
- **Statistics** (AC2, AC3): `lib/confidence.ts` holds the owner's floor `MIN_BETS = 5` and the design record's
  threshold `TOO_WIDE_HALF_WIDTH = 0.10` (half-width of the per-trade simple-return interval; exactly 10 points is not
  too wide). `lib/trades.ts#confidence`: no range below 5 bets; from 5 bets the range is always computed with Student's
  t at K − 1 df (the existing `tCrit95`: exact table to df 30, then 1.96 + 2.4/df); a range wider than ±10 points makes
  the record "too early" but keeps its range (shown, widening as the sample thins) and gives it no verdict. The other
  pages that print "Too early to tell (k of 10 bets)" now read the floor from `MIN_BETS`.
- **Trust line** (AC4, AC5): `trustLine()` is the owner's 8-row table verbatim. N = closed trades in the too-early row,
  independent bets elsewhere; D = span in days (rounded, at least 1); M = whole 30-day months; Y = whole 365-day years
  (floors, so the sample is never overstated); counts grouped by thousands. `TRUST_BANNED` is the AC5 list.

## Decisions made within the owner's decisions

1. **The sign the trust line uses** (`trustSign`): positive only when the per-trade range on the card lies entirely
   above 0 *and* the TR-9 pace verdict is positive; negative mirrors it. So "consistent" never appears beside a range
   that crosses 0, and the card never contradicts the profile's "Past results" verdict. Symmetric for losses.
2. **Ranking keeps its floor of 10 bets** (`RANK_MIN_BETS`, `evidenceWeight`). F-4 decides what a record *shows*;
   lowering the floor in ranking changed F-2's feed and suggestions order (3 F-2 tests failed when I tried it: the
   section pool and the reach acceptance). A too-wide record also weighs 0. Measured on this database: every trader's
   ranking weight is identical before and after F-4 (8 of 8). Open question 1 below.
3. **The card never lacks a trust state** (AC8): where the old rule gave no label (no broker connected, or a record not
   wholly broker-sourced and not demo) the card reads "No broker connected" (empty) or "Not verified". "Verified" stays
   only for a whole broker-sourced record (POLICY F3a). The square and story pictures keep their own wording ("Imported
   read-only from the broker"; demo: "Demo data, not a real broker record"), as fix round 6 decided.
4. **Demo on the pictures** now follows the profile's rule (`isDemoUser`) like the unfurl. The old story route also
   called a record with any unverified trade "demo"; such a record now reads "Not verified", which is the accurate word.
5. **Line color** follows where the line ends (up color at or above 0%, down color below: the profile chart's rule);
   the headline color follows the sign of the average as shown (0.0% is neutral).
6. **Period**: whole calendar months from the first entry (TR-3's "Record since") to now, UTC; "under 1 month" below one.
7. **Readability at 375 px** (AC9): every text size is at least 9.5 CSS px when the image is 375 px wide (the unfurl's
   disclaimer is 31 px, one line, 9.7 CSS px; everything else 10 CSS px or more) and the headline at least 28 CSS px
   (`readableAt`, tested). The first render had the unfurl chart running off the right edge and the square picture's
   disclaimer pushed off the bottom; both layouts were re-budgeted (`CARD_LAYOUT`, `UNFURL_COLUMN_GAP`) and re-rendered.
8. `storyModel` is gone (win rate, worst trade and the "New record, wide uncertainty" pill come off the card by F-4's
   decisions); `lib/story-image.ts` keeps `FORMATS` and `parseFormat`.

## Existing tests changed (only where F-4 changes the rule)

- `lib/confidence.test.ts`: "K<10 is too early" → K<5 (n = 0, 1, 4); tier boundaries: K = 4 too early, K = 5 and 9
  thin (added), 10 thin (kept); "Too early to tell (4 of 10 bets)" → "of 5"; "(10 independent bets needed)" → 5 and the
  K = 9 example → K = 4. Reason: the owner's floor of 5 (F-4 decision "The minimum for showing the range is 5").
- `lib/story-image.test.ts`: rewritten one for one against the card model (7 tests before, 7 after): the uncertainty
  pill test → the TR-7 "New record" chip (9 yes, 10 no, 0 no); the worst-trade test → no worst or best trade on the
  picture; the field, demo, empty, `parseFormat` and fix-round-6 state tests keep their assertions on the new fields.
  Reason: F-4 takes win rate and per-trade detail off the card.
- No other existing test changed. `lib/share.test.ts` (every image route carries `{DISCLAIMER}`) passes as written:
  each route passes the disclaimer to the card itself.

## Test results (this worktree, Node 24.22.1)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm test` (`node --env-file=.env --test`) | 657 tests: 645 pass, 0 fail, 12 skipped (baseline 638: 626 pass, 12 skipped) |
| F-4 unit files (`lib/confidence.test.ts`, `lib/record-card.test.ts`, `lib/story-image.test.ts`) | 38 pass, 0 fail |
| `LOAD=1 node --expose-gc --test lib/sync.load.test.ts` (interim rule: `lib/trades.ts` changed) | 5 pass; heavy import 828 ms, rebuild 306 ms, fleet 500 traders in 5,335 ms |
| `BASE_REF=main node scripts/compliance.ts auto` | 1 violation, not from this change: `node_modules/@img/sharp-wasm32` license (Apache-2.0 AND LGPL-3.0-or-later AND MIT), an installed optional dependency; `package.json` and the lockfile are untouched. No violation in any changed file. |
| `node scripts/autopilot.ts guard main` | ok (after the build commit) |
| `npm run build` | exit 0 |
| `e2e/share-card.spec.ts` (new) | 2 pass |
| `e2e/app.spec.ts -g card` | 12 pass, 1 fail: "fix round 8, F-2 PR-1: 30-card pages…" (29 heavy cards, 30 expected). Pre-existing: it fails the same way on the untouched base commit 619ec80, built and run against the same database. |
| `e2e/app.spec.ts -g share` | 5 pass |
| `e2e/app.spec.ts -g story` | 1 pass |
| `e2e/app.spec.ts -g opengraph` | no test title matches |

E2E ran against `next start -p 3104` with this worktree's build and its own database (`stock_social_f4`), through a
local, uncommitted copy of the Playwright config (port 3104, so no other run's server on 3000 is reused).

Hand check of the AC2 snapshot range (12 bets, +4% / +2% alternating): m = 0.0295117, Σ(X − m)² = 0.00113119,
SE = √(12/11 · 0.00113119)/12 = 0.0029274, t(11) = 2.201, half = 0.0064432 → e^(m ± half) − 1 = +2.3% to +3.7%.

## Screenshots (`screenshots/`)

`winning`, `losing`, `empty`, `heavy` (4,200 closed trades over about 3 years) × `-unfurl.png` (1200×630),
`-square.png` (1080×1080, the Share button's picture), `-story.png` (1080×1920), and `-unfurl-375.png`,
`-square-375.png` (the image shown 343 px wide in a 375 px viewport with 16 px gutters). Looked at each: the disclaimer
and the trust state are on every one; the losing card has the same layout and sizes with the headline and line in the
down color; the 4,200-trade line is downsampled (at most 240 points) and the count reads "4,200".

## Open (for the owner or the committee)

1. **Ranking floor.** Should ranking (feed and suggestions) follow the display floor of 5 bets, or keep 10? Kept at 10
   here (decision 2). An owner call; it changes F-2's order.
2. **Headline vs range.** The headline is the arithmetic average (the profile's number); the range is built on log
   returns, so on a high-spread record the headline sits near or past the range's edge. The 4,200-trade fixture reads
   "+0.3% average per trade, likely between +0.1% and +0.3%". The profile has the same pairing today. A fix (headline
   from the same model, or a range for the arithmetic mean) changes the profile's number too, so it is not made here.
3. **Owner's table, negative rows.** In the thin and moderate tiers a range entirely below 0 gets the "unclear" words:
   the losing fixture, "likely between -2.3% and -0.7%", reads "A fair sample, with no clear pattern yet." That is the
   table as approved; the owner may want a negative-specific row (the strong tier has one).
4. The pre-existing heavy-feed e2e failure and the `sharp-wasm32` license finding above are outside F-4.
5. The default image font has one weight, so "bold" draws as regular (as before this change).
