# F-33 committee record (cycle opened 2026-11-01, built 2026-11-02)

Members (fresh-context subagents): UX lead (plan), business lead (BL), engineer (ENG), tester, independent reviewer.
Owner decisions this build works inside (2026-11-02): cycle-5 Q3 (moderate tier, 1-point spread floor), OD 2.32 (one
arithmetic range rule, "Too early to tell" for a zero-width range, card wording), OD 2.33 (method (c), near-edge
distance from 0, on /how). Plan: [plan.md](plan.md).

## Round 1 — plan review

**UX lead (plan).** New pure `lib/rank-weight.ts` (`rankWeight`, simple-return pace interval, near-edge weight,
`RANK_FORMULA` in the weight-cache key); the floor v = max(ss/(K−1), 0.01²·n/K); zero width = equal one-decimal
printed ends; one producer `RECORD_STRIP.early`; /how copy; readout counts-only line; AC → test map. Raised R1 (section
tie-break by closes counted), R2 (a zero-width record still weighs through the floor), R3 (log ranges elsewhere).

**Business lead: sign off with demands.** R1 fix in this build (weight, then score, then id). R2 accept, pin with a
40 × +1% test and tell the owner. R3 accept with a tracked open question. /how: "can gain weight", no "yet" about open
positions, define independent bets before use, no "weight times the base order" jargon, at most 6 added sentences,
360 px screenshot. Card: drop "Right now" from the share prompt; check the unfurl label break.

**Engineer: not signed off, 13 demands.** Formulas, symmetry, finiteness and import graph verified. Demands: gate
before arithmetic; do not widen the unfurl (pinned 0.24 chart share); the label split and the full retarget list for
the card label change; list zero-width fixtures before coding; literal-source test on .ts/.tsx without comments;
measure the e2e heavy fixture before changing it; measure the 40 × +1% probe at the tier and record it for the owner
(do not assert a direction the code does not meet); keep two weighted traders and the mirrored tie in the section
fixture; AC8 condition on ss/(K−1) ≥ 1e-4·n/K; "can gain weight"; readout loader from shared predicates with an
EXPLAIN rows-read test; split the PR by size. R1: reject score (F-2 fix rounds removed size of a move from the
section order). R2 accept. R3 accept only as a tracked hand-off.

## Orchestrator rulings (end of round 1)
1. **R1 → weight, then trader id.** BL and ENG disagree on score; both agree a count order breaks F-33's decision "no
   order ever uses trade count or frequency" (BL) or needs the owner (ENG). Weight then id uses neither count, size nor
   recency, so it satisfies F-33 and F-2's later fix rounds at once. The section line changes from "Ordered by how
   much evidence each record has" to a line that stays true for weight-0 rows (tested against the comparator). The
   new-record slot (fewest closes) is unchanged and goes to the owner as an open question (alt: latest first close).
2. **R2 accepted** by both: zero width is a printing rule; weight comes from the floored error term. Pinned by a test
   and stated for the owner. The 40 × +1% probe at the tier is measured and recorded, never asserted against its result.
3. **R3 accepted as a tracked hand-off** (feature file Hand-offs): ticker, recap, trade-share and tools ranges keep the
   log rule plus the zero-width rule until a follow-up moves them to OD 2.32's arithmetic rule.
4. **The OD 2.32 card label ("average per trade so far, likely between X and Y") is a tracked hand-off, not this
   PR.** It is not one of F-33's acceptance criteria, and ENG demands 2-4 show it moves pinned image layouts, a
   snapshot and nine test files. Keeping it out also answers ENG demand 13 (size) without splitting the PR. Recorded
   for the owner in the PR and the feature file.
5. All other demands accepted as written (ENG 1, 5-12; BL /how demands).
