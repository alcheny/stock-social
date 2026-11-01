# Approval council: from ideas to approved features

The owner delegated (2026-11-01) the choice of new functions and requirements to a large committee: the ideas the
council elects most strongly over several rounds are approved without waiting for the owner, become feature files,
and are built by the parallel committee process (`docs/process/coordination.md`,
`docs/IMPLEMENTATION.md`). The owner can still overrule any approval, and owner decisions always win.

## Where ideas come from

The market research, creative direction and design direction councils (`team/direction-councils.md`), the idea
board (`team/idea-board.md`), committee records, design sessions and the owner. Every candidate is in
`docs/IDEAS.md` and has been through the idea board's consistency and common-sense check before the vote.

## Members (15, each a separate agent with fresh context)

Business lead; market research lead; pricing and finance; growth; UX lead; product designer; data-visualization
designer; accessibility specialist; engineer (feasibility, size, risk); reliability engineer; legal and compliance;
trust and safety; decisions keeper (conflicts with existing decisions); common sense (the reasonable trader, viewer
and owner); red team. The chair runs the rounds and counts the votes; it does not vote.

## Rounds

1. **Pitch.** For each candidate the chair writes a one-page brief: the problem, who it serves, evidence (with
   sources from the councils), cost, risks and the conflicts the decisions keeper found.
2. **First vote.** Every member gives each candidate a score from 0 to 5 and a one-line reason, independently.
3. **Debate.** The members read all scores; the five lowest and five highest scorers on each candidate state their
   strongest argument; anyone may change a score for a stated reason.
4. **Second vote** on the top half; candidates below the cut drop to the next cycle with the reasons.
5. **Final vote** on the shortlist after the red team's case against each: approve, approve with conditions, or
   reject.

## Approval rule

A candidate is **approved** when, in the final vote, at least 10 of 15 members approve it (with or without
conditions), its mean score in the second vote is at least 3.5, and none of these vetoes applies:
- the decisions keeper finds it contradicts an owner decision (it goes to the owner instead);
- legal and compliance finds it breaks POLICY (it is rejected or reshaped to fit);
- common sense finds it confusing, dishonest or out of proportion.
Conditions attached by the approving members become acceptance criteria.

At most **six** new features are approved per cycle, the highest-scoring first, so the parallel build stays
within what can be reviewed and merged safely; features that touch the same files count as one build slot. The
rest wait for the next cycle. (Raised from three on 2026-11-01 after the owner asked to increase the rate of
development.)

## What approval can and cannot do

Approval creates a feature file with `Status: ready`, decisions dated and marked "approved by the approval
council", and acceptance criteria. It never changes POLICY, overrules an owner decision, turns on real charges,
opens the product to real users, deletes data, adds a dependency, touches credentials or deploy settings, or
changes the loop's guardrails; an idea that needs any of these is flagged for the owner with the council's
recommendation.

## After approval

The orchestrator numbers the feature (F-<n>), adds it to the coordination map with the files it owns and its
merge position, and starts a build session for it (or folds it into a running session that owns the same files).
The build follows the committee cycle: plan debate, tests first, tester, user tests, independent review, CI.
Steps in `docs/IMPLEMENTATION.md` → The cycle (interactive differences: `docs/process/lifecycle.md`).
Every cycle's votes are filed in `docs/ideas/approval-<date>.md` and the register in `docs/IDEAS.md` is updated.
