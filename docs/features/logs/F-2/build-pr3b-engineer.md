# F-2 PR-3b: "Similar trades" on profiles (engineer build log)

2026-10-24. Built to owner decision O2 (F-2 file, Decisions) and the business lead's rulings: committee PR-3 round 1 (the section
comes after the trader's own trades and stays visually secondary, so a visitor from a shared link stays with that trader), 3
rows, a "…" menu with "Not interested" on each row signed in, reason lines from fixed templates that are copy-scanned, a heading
that is true signed out. No schema change, no dependency, no change to package.json, CI or CODEOWNERS.

## What it does

- **Placement.** On `/u/[handle]`, after the "Closed trades" list and its paging links, and before "← Feed". A top border sets it
  apart, and the heading is smaller than the profile's own headings.
- **Rows.** 3 closed trades from other traders, one trade per trader: that trader's most recent close in the same holding bucket
  as this record's median holding period. The buckets are the section's own (`holdBucket`: under a day, 1 to 7 days, 1 to 4
  weeks, 1 to 6 months, over 6 months). Each row shows the name, the handle, "SYMBOL · closed <date>", the Verified or Demo badge
  and "Held <bucket>". It shows no return and no other number about performance. Rows are not grouped by symbol and are not the
  ticker page.
- **Order.** Rows come from the feed's section pool (`sectionPool`), ordered by the TR-9 lower bound, then closes, then id.
  Verified records come first and Demo records after them. No raw average, size of move or sign is read, so losses are counted
  exactly like gains (tested on an all-loss fixture).
- **Tap.** A tap opens that trader's pane as a sheet (the PR-3 `SuggestRow`, the same pane and F3 line as the feed section), with
  the full profile one step further. Without JavaScript the row links to that trade's page, `/u/<h>/trade/<sell_id>`.
- **The same for every viewer.** Signed out, nothing is read about who is viewing. Signed in, the viewer's own record and their
  running "Not interested" traders are left out (`lib/follows.ts#hiddenTraders`). An unfollow is never a hide (O4). Signed in,
  each row has "…" → "Not interested" and the row's reject swipe, as in the feed. `FeedHides` gained a `scope` prop, so the row
  collapses in place with "Hidden for 90 days." and Undo.
- **When it is shown.** Only when this record has at least 5 closes, no import is running, and 3 rows qualify. Otherwise the
  section is absent.
- **Cost.** The pool is the feed's at the start of the UTC hour (`feedList`, ~47 ms at 500 traders). It is kept in memory and
  rebuilt in the background once it is 10 s old (`SIMILAR_REFRESH_MS`); the old pool serves until the rebuild finishes. The row
  traders' records for the sheet are kept for the same 10 s, at most 32 traders. Most profiles in one bucket show the same few
  traders, so each heavy record is read once per window. The reads start with the page's other reads.

Files: `lib/discovery/similar.ts` (pure), `lib/similar.ts`, `lib/follows.ts` (+`hiddenTraders`), `lib/feed.ts` (`records`
exported), `lib/copy.ts` (`SIMILAR`, scanned via `allCopy`), `app/u/[handle]/similar-section.tsx`, `app/u/[handle]/page.tsx`,
`app/suggest-row.tsx` (`href`), `app/feed-hides.tsx` (`scope`), `app/globals.css`.
**Product diff: +199 / −9** (cap 800).

## O4 not built: left for PR-4

`WEIGHTS.unfollow = -1` needs a per-viewer demotion in the feed and in the section ("ranked below an otherwise identical trader;
after 90 days, equal"). It also needs the pinned `lib/feed.section.test.ts` case restated. That is a change to the ranking with
its own tests, and the committee already put it in PR-4. Similar trades already follows O4: an unfollow does not hide a trader
there.

## Measurements: profile server time, signed out, `next start`

Fixture: 500 traders with 25 closes each, plus a 50-close trader and a 5,000-close trader, both in bucket 1. 150 sequential
requests per run after 10 warm-up requests.

| Trader | Before p95 (4 runs) | After p95 (3 runs) | Change |
|---|---|---|---|
| 50 closes | 32.4 / 27.5 / 35.9 / 28.0 ms | 53.5 / 47.2 / 52.5 ms | about +20 ms |
| 5,000 closes | 167.6 / 168.1 / 156.2 / 193.7 ms | 187.5 / 175.0 / 167.3 ms | about +10 ms |

The budget is +50 ms, so both traders are inside it. A first version that read records on every view and did not run the reads
in parallel measured about +40 ms. HTML for the 50-close trader grew from 64 KB to 90 KB, because the 3 sheets carry the panes.

## Tests (none weakened or deleted)

- `lib/discovery/similar.test.ts` (+3): the bucket filter, the profile's own trader and skipped traders, Verified before Demo,
  rows in order, fewer than 3 rows → none, sign-invariance.
- `lib/discovery/imports.test.ts` (+1 case): `similar.ts` is pure.
- `lib/similar.test.ts` (+3, database): rows match the pool's TR-9 order and are each trader's latest close in the bucket; the
  same on repeat; fewer than 5 closes → none; a hidden trader is out signed in; an unfollow is not a hide; the viewer's own
  record is never a row; all hidden → none; losses fill the section; Demo comes after Verified.
- `lib/feed.signed-out.test.ts` (+1): signed out reads no viewer table; signed in reads only `viewer_exclusions`, keyed by the
  viewer's id.
- `e2e/similar.spec.ts` (+3): placement after the closes; no number on a row; the same rows for two visitors; tap → sheet with
  the F3 line, Esc returns focus, no non-GET request; no JavaScript → trade link; signed in, rows at rest, "…" → hidden with
  Undo, one exclusion; the viewer's own record is never a row. The screenshots are in `screenshots/pr3b/`.

## Checks
| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` ×4 (3 after the last product change) | **622 tests: 610 pass, 12 skipped (LOAD), 0 fail** on every run |
| `LOAD=1` feed, sync, follows | **12 / 12 pass** |
| `CI=1 npm run build` (stdin closed) | exit 0. The first attempt of each build stops on the framework's security advisory, which is tool output; the retry passes. |
| `npm run test:e2e` ×2 | **112 passed, 3 skipped, 0 failed**, both runs (4.2 and 4.3 min). An earlier run failed 2 profile tests in `app.spec.ts`: the sheets' panes added charts and close links to the profile page. Fix: on profiles the sheet's pane now enters the page only when the sheet first opens (`SuggestRow lazy`); the feed is unchanged. Committed screenshots from other PRs that the runs rewrite were restored. |
| `node scripts/compliance.ts diff origin/main` | only the existing wasm license line |
| `node scripts/autopilot.ts guard main` | ok |

The timings above were measured before the `lazy` change. That change only removes nodes from the profile page; the server still
renders the panes.

## Environment

The checks used my own databases (`ss_pr3b` and `ss_pr3b_e2e`, owned by the shared role) and a server on port 3471, started from
a temporary Playwright config that has been deleted. Port 3000 was not touched. The fixtures and test users were deleted, both
databases were dropped, and my servers were stopped.
