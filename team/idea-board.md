# Idea board

The idea board reviews every non-technical idea before it becomes a decision: product direction, pricing and
packaging, legal and policy positions, privacy choices, growth and marketing, partnerships and vendors, copy that
makes a claim, and changes to how the team works. Code changes go through the committee cycle instead
(`docs/IMPLEMENTATION.md`); an idea that becomes a feature goes to a design session after the board.

## Members (each a separate agent with fresh context; no one reviews their own idea)

| Member | Lens | Asks |
|---|---|---|
| **Business lead** ([business-lead.md](business-lead.md)) | Market demand, revenue, adoption | Who wants this, what do they pay or give up, what does it do to the week-8 gates? |
| **UX lead** ([ux-lead.md](ux-lead.md)) | The people using it | Does a first-time trader and a first-time viewer understand it and trust it? |
| **Legal and compliance** | POLICY and COMPLIANCE | Which rule or law does it touch; what condition makes it safe? Findings, not legal advice. |
| **Trust and safety** | Harm and misuse | How could a bad actor, a scammer or a careless reader misuse it; who gets hurt? |
| **Growth** | Distribution | Does it make records travel (share card, links) without rewarding trading activity (POLICY F6)? |
| **Finance** | Unit economics | Cost per user, break-even, the projection dashboard's assumptions. |
| **Red team** | The strongest case against | Argues the idea is wrong; names the cheapest test that would show it. |
| **Decisions keeper** | Consistency | Checks every idea against every existing decision: the feature files' Decisions, POLICY, DESIGN (Stage 5 rules), DECISIONS.md, COMPLIANCE, and the owner's answers in design sessions. Lists each conflict with the decision it contradicts and its date. |
| **Common sense** | The reasonable person | Would a first-time trader, a first-time viewer and a careful owner find this sensible, honest and worth the cost? Flags anything that is technically allowed but obviously odd, confusing, self-defeating or out of proportion. |
| **Chair** | Synthesis | Weighs the members, separates fact from opinion, writes the recommendation. |

## The process (several rounds)

1. **Independent review.** Every member reviews every idea alone: verdict (adopt, adopt with conditions, test
   first, reject), reasons, conditions, the evidence it rests on, and confidence.
2. **Debate.** Each member reads the others' reviews and answers the strongest disagreement with its own view,
   changing its verdict only for a reason it states.
3. **Verification.** Factual claims the verdicts depend on (laws, market numbers, vendor terms, competitor
   patterns described generically) are checked by a fact-checker with sources; anything unverified is marked.
4. **Recommendation.** The chair writes, per idea: the recommended option, its conditions, the dissent, what
   would change the call, and the cheapest test.

## Enforcing existing decisions and common sense

Every review starts with the decisions keeper's conflict list and ends with the common-sense check. An idea that
contradicts an existing decision is not adopted by the board: the board names the conflict and either proposes a
version that fits the existing decisions or flags it for the owner, who alone can change an owner decision. An
idea that fails the common-sense check is rejected or sent back with the reason, even when every rule allows it.
Proposals from the direction councils (`team/direction-councils.md`) pass through the board the same way.

## What happens to the result

- An idea the owner has already decided is never overruled by the board: the board flags risks and proposes
  conditions, and the owner decides.
- An open idea is decided by the board's recommended option when the owner has delegated it (the owner's
  instruction of 2026-11-01), recorded as a dated decision with "decided by the idea board" in the feature file or
  in `docs/IDEAS.md`.
- Every review is filed in `docs/ideas/` (one file per review session) and indexed in `docs/IDEAS.md`.
- The board's text follows POLICY like everything else: no third-party names except integrated vendors, cases
  cited by reporter or docket, no advice.
