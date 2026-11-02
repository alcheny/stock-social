# F-34 committee log (cycle opened 2026-11-01, build 2026-11-02)

Build session for F-34 (`docs/features/F-34-one-open-positions-line.md`), branch `claude/f34-open-positions-line`.

## Prerequisites
- OD 2.25 answered by the owner on 2026-11-02, overriding the council: real users' unrealized values keep showing
  (F-6 as today); no "aren't shown yet" line. F-34 builds the shown-values variant (F-4's card line, lowest first).
- F-23 (#97) is on main (ca34767). F-16/F-17 (#100) and F-25 (#102) are open; the build starts now and merges main as
  each lands (orchestrator instruction).
- F-21 and F-29 (slot partners) are not built: this build owns the pane line order and leaves their slots empty.

## Round 1
- UX lead's plan: `plan.md`.
- Business lead: DEMANDS (6).
  1. The feed card is in scope and required; its line meets TR-4 (body size and weight, toned values, only the as-of
     words muted).
  2. No reserved blank space in the pane.
  3. Two unfurl rows in the typical case; a chart floor of 15%.
  4. "losses included" ≥ 26 px, ≥ 4.5:1 and inside the anti-crop band.
  5. Minimal hunks in the files shared with #100 and #102.
  6. The ChartNote change is a deletion; banned words in openLine output.
- Engineer: DEMANDS (7).
  1. The §3 band fit is false in most states (measured with the real `stripImageLines` / `tradeBand`).
  2. Alts use commas (F-12 pins no "·" and no parentheses in trade and month alts).
  3. The full list of expectation changes.
  4. The real merge hunks with #100 and #102.
  5. The account filter goes into display-log's batch `exists()` too.
  6. The `allCopy` walker must not call the open-line words.
  7. The query AC counts statements; asOf is the minimum `fetched_at`.
  - Optional, adopted by the orchestrator: the pane JSON carries the server-built line.
- Settled by both reviewers: Q2 lower-case up/down/flat; Q3 keep the count tile; Q5 the stock pages get the account
  filter only; Q6 a ponytail note; Q1 the feed card is in scope (business lead, over the plan's "droppable").

## Round 2
- The UX lead revised the plan to meet all 13 demands.
- The full open line cannot fit the 1200×630 images (44 of 192 states fail), so those images draw an image form from
  the same producer; the square and story print the full text.
- Business lead: DEMANDS (3).
  - BL-R2-1: one `imageRows` producer, with fact-coverage and round-trip tests.
  - BL-R2-2: "record frozen" never dropped from an image with open values.
  - BL-R2-3: the 320 px feed-card e2e (at most 3 lines, the trade return stays the largest text).
- Engineer: DEMANDS (3).
  - EN-R2-1: step 11 is a separate last pass.
  - EN-R2-2: test the real `monthHero` / `monthBand`.
  - EN-R2-3: name the record-row size change.
- Q11 accepted by both reviewers, under the orchestrator's condition: the image form is one deterministic function of
  the canonical line, and a test pins every fact.

## Round 3: SIGN-OFF (business lead, engineer)
- Fit matrix against the real `stripImageLines`, `tradeHero`, `recordStrip` and `monthHero` (`export` added):
  `total=192 fit=192 violations=0`.
  - Disclaimer: 35 px in 110 states, 32 px in 46, 28 px in 36.
  - Step 11 (the last pass) runs in 14 month states and drops only the failed note and/or the "Disconnected ‹date›"
    row.
  - "record frozen" is kept in 96/96 frozen states.
  - Script: `fit/f34-fit-matrix.ts.txt`.
- Decisions recorded in the feature file (2026-11-02).
- Build conditions:
  - The source scan matches string literals only, not comments (avoids comment edits in files #100 touches).
  - The month label may reach 26 px in 6 states, never below the record rows.

## Build (2026-11-02)
- The engineer wrote the tests first (9a8c3e8), then the build. Main was merged after #100 (F-16/F-17) and #102 (F-25)
  landed (e02bb5d). The open_positions statements keep both conditions (F-16 visibility AND `positionInRecord`), and the
  trade view keeps F-25's `tradeKey` with `openOf(openRead)`.
- Deviations, recorded for the business lead:
  - BL-R2-3: the feed card's line needs four lines at 320 px (measured 3.998). The as-of words step down and the
    leading tightens at ≤ 340 px; F-10 AC8's 15% headroom check is unchanged and passes.
  - The band search lives in `lib/open-band.ts`.
  - `layoutBand` skips the gaps inside a wrapped open block (2 px minimum), only when an open block is present.
  - The unfurl's "failed note onto the label line" (BL3, worst-case chart share 12.5%) is not built: an owner note.
- Not run: the tester's QA round, the 360 px user test and the independent code review. The owner paused review rounds
  on 2026-11-02 (orchestrator message).
