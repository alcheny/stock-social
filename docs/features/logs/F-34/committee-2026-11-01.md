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
