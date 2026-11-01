# Approval council, cycle 3: 2026-11-01

The approval council (`team/approval-council.md`) met for its third cycle on 2026-11-01, started by the owner's
orchestrating session under the owner's delegation (POLICY H; owner decision 2026-11-01: decide by the committee's
recommended option; anything POLICY or COMPLIANCE reserves for the owner or counsel uses the AI legal committee's
findings and still goes to the owner as a flag). Fifteen members voted, each a separate agent with fresh context, in
parallel within each round (the owner asked not to limit the rate). The chair ran the rounds and counted the votes and
did not vote. Base for the rounds: `origin/main` **f467293** (#63, the council cycle 3 record); members' ballots cite
f467293. Main then moved to **d98f32d** (#56, F-7 public traders, merged into this branch); F-7 moved lines in the
files this record cites but changed no prerequisite or finding, so this record's own citations and the feature files
are at **d98f32d** unless marked (mapping in Appendix A). Not legal advice. Every probe trade named here is fictional.

## Result

| Rank | Candidate | Second-vote mean | Final vote | Outcome | Can start / blocked on |
|---|---|---|---|---|---|
| 1 | C3-17 Exclusion counts beside the headline (reshaped: pane and strip, not feed cards) | 4.13 | 15/15 (all AC) | **Approved: F-21** | Blocked: fix F3-2 (same pane file) and F-22 (ledger slot) |
| 2 | C3-2 Transfers as share moves, not repricings | 4.07 | 15/15 (all AC) | **Approved, conditional on the owner's yes: F-22** | Blocked: owner's yes (amends a decided rule), F-14, fixes F3-1, F3-5, F3-15 |
| 2 | L-16 F-16 trust-and-safety slice, plus K18's under-18 report (lapsed, re-voted) | 4.07 | 15/15 (all AC) | **Re-approved: F-16** | Blocked: F-9 merging from `claude/fix-user-text-safety` |
| 4 | L-17 F-17 handle and name integrity (lapsed, re-voted) | 3.93 | 15/15 (all AC) | **Re-approved: F-17** | Blocked: the same F-9 branch merging |
| 5 | C3-36 Public payloads no more precise than the screens | 3.67 | 15/15 (all AC) | **Approved: F-23** | Blocked: fix F3-2 (same pane route) |
| 5 | L-20 F-20 design tokens and contrast test (lapsed, re-voted) | 3.67 | 15/15 (all AC) | **Re-approved: F-20** | Blocked: PR #55 (contrast test) and cycle-2 fixes #12, #13, #26 |
| 7 | C3-9a Late-posted trades reach the record (insert-only reconciliation) | 3.60 | 15/15 (all AC) | **Approved: F-24** | Blocked: F-14 (`claude/f14-sync-cadence`) |

No veto applied to any approved item as conditioned. The decisions keeper, legal and common sense named the
conditions whose removal would trigger their veto; the feature files mark them "(veto condition: …)".

**Nothing can start today.** Every approved item waits on work that is in flight but not on main (verified with
`git log origin/main` and `git ls-remote` on 2026-11-01): F-9 is built on `claude/fix-user-text-safety` (53b74e3, no
open PR); F-14 is on `claude/f14-sync-cadence` (unmerged); PR #55 (F-13, with `lib/a11y-contrast.test.ts`) is open;
the cycle-3 fixes F3-1..F3-27 are being built and none is on main; cycle-2 fixes #1, #2 (`claude/fix-truthful-labels`),
#10, #12, #13, #26 are unmerged. Each approved file is `Status: blocked` with a `Blocked:` line the pipeline reads
(`scripts/features.ts` `blockedOn`) and a lapse clause: **if its prerequisite has not merged by the next approval
council (cycle 4), the approval lapses to that council.** The orchestrator flips each to `ready` as its prerequisites
merge.

**Slots: four of six.** Ledger slot: F-22 + F-24 (`lib/trades.ts`, `lib/sync.ts`, after F-14). Pane and payload slot:
F-21 + F-23 (`app/pane.tsx`, `lib/pane.ts`, the pane routes, `lib/feed.ts`, `lib/record-strip.ts`, after F3-2). Trust
and safety slot: F-16 + F-17 (`lib/reports.ts`, `lib/handles.ts`, `lib/auth/attempts.ts`, on the F-9 branch).
F-20 alone (`app/globals.css`). Four new features (F-21..F-24) plus three re-approvals. **Cap reading (council's,
flagged to the owner):** `team/approval-council.md` caps "new features" and counts shared-file features as one build
slot; the council read re-approvals of lapsed features as not new (they keep their F-number and file) and counted
slots. Under the stricter reading (seven approvals against a cap of six) the cap is still met in slots (four), and
nothing here can start before cycle 4 anyway. The decisions keeper accepted this reading as a flag, not a veto.

**Numbering.** F-21 to F-24 by second-vote rank of the new items. Re-approved features keep F-16, F-17, F-20, each
with one new dated decision; no earlier dated line was edited.

**Lapsed and not re-approved.** F-18 (one trust language) was voted again and fell below the cut (3.13 after the
debate); it goes to `Status: draft` with a dated lapse decision, its file kept. F-19's call-site sweep (2.80) lapses;
F-19 stays `built` (first slice, #57) with a dated decision. F-15 did not lapse: its clause is "if not started", and
it is building on `claude/f15-measurement` (its prerequisite fix #28 merged in #59).

## Process

- **Round 0 (consistency check).** The chair drafted a 32-item ballot: the 18 briefs of `docs/direction/cycle3-2026-11-01.md`
  §6, the nine cycle-2 waiting items (K18, K20, K22, K19, K16, K15, K11, K21, KV) and five cycle-2 approvals that lapse
  under the lapse rule (F-16, F-17, F-18, F-20, F-19's sweep). The design-system amendments routed to the idea board
  (IDEAS #53: DSP-2, 3, 4, 8) reword idea-board decisions, so they are not ballot items. The decisions keeper, legal
  and common sense checked every item; a helper re-read every C3 citation at f467293 (all 18 problems still exist on
  main; none fixed by #52, #60 or #61; moved lines listed below). Chair's rulings (Appendix A): C3-41, C3-45 → design
  session; C3-44 → chore; K20, K22 → chores; K19, K16, K15, K11, K21, KV → not ballotable (their own bring-back
  conditions are unmet); K18 → merged into L-16; C3-9 split into C3-9a (late rows, ballotable) and C3-9b (revisions
  table, owner flag Q3); C3-39 and C3-40 merged; C3-17 reshaped (no feed-card line). Ballot: 19 items.
- **Round 1 (first vote).** 15 independent ballots, 0-5 with a reason each.
- **Round 3 (debate).** The five highest and five lowest scorers on each item (counted only among members above or
  below its mean; ties at the cut by roster order) stated their strongest argument. The chair added one verified state
  correction: F-9 is built on `claude/fix-user-text-safety`, so L-16 and L-17 wait on a merge, not a start. Every
  member then gave post-debate scores, naming the argument behind each change.
- **Round 4 (second vote)** on the top half: 10 of 19 (the cut fell cleanly between 3.40 and 3.13).
- **Round 5 (final vote).** The red team wrote the case against each of the seven items at 3.5 or more; then every
  member voted approve / approve with conditions / reject, and the three veto holders stated "veto: none" or a ground.

Members (roster order in the tables): BL business lead, MR market research lead, PF pricing and finance, GR growth, UX
UX lead, PD product designer, DV data-visualization designer, A11Y accessibility specialist, EN engineer, RE
reliability engineer, LG legal and compliance, TS trust and safety, DK decisions keeper, CS common sense, RT red team.

Every mean and count below was recomputed by script from the ballots (`r1`, `r3b`, `r4` score lines cross-checked
against each member's ballot table: 0 mismatches; round 5: 15 ballots × 7 items = 105 approve-with-conditions, 0
rejections). All ballots are in [Appendix B](approval-2026-11-01-cycle3-ballots.md).

## Votes

### Round 1: first vote (0-5)

| Item | BL | MR | PF | GR | UX | PD | DV | A11Y | EN | RE | LG | TS | DK | CS | RT | Mean |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| C3-17 | 4 | 4 | 4 | 3 | 4 | 4 | 5 | 4 | 4 | 4 | 4 | 5 | 4 | 4 | 4 | 4.07 |
| C3-2 | 4 | 4 | 3 | 4 | 4 | 4 | 4 | 3 | 4 | 4 | 4 | 5 | 3 | 4 | 4 | 3.87 |
| C3-39/40 | 4 | 4 | 4 | 4 | 5 | 5 | 3 | 4 | 4 | 3 | 3 | 3 | 3 | 4 | 4 | 3.80 |
| L-16 | 3 | 4 | 4 | 4 | 3 | 4 | 3 | 4 | 3 | 4 | 5 | 5 | 4 | 3 | 3 | 3.73 |
| L-17 | 3 | 4 | 4 | 4 | 3 | 4 | 3 | 4 | 3 | 3 | 5 | 5 | 4 | 3 | 4 | 3.73 |
| C3-36 | 3 | 4 | 3 | 3 | 3 | 4 | 4 | 3 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 3.67 |
| L-20 | 3 | 3 | 3 | 3 | 4 | 5 | 4 | 5 | 4 | 3 | 3 | 3 | 4 | 4 | 4 | 3.67 |
| C3-9a | 3 | 4 | 3 | 3 | 3 | 3 | 4 | 3 | 3 | 4 | 4 | 4 | 4 | 4 | 4 | 3.53 |
| C3-37 | 5 | 5 | 4 | 5 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3.47 |
| C3-34 | 3 | 3 | 4 | 3 | 3 | 3 | 3 | 3 | 4 | 5 | 3 | 3 | 4 | 3 | 4 | 3.40 |
| C3-15 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 4 | 3 | 3 | 4 | 3 | 3 | 3 | 3 | 3.13 |
| L-18 | 2 | 4 | 2 | 3 | 3 | 4 | 3 | 4 | 3 | 3 | 4 | 4 | 3 | 2 | 3 | 3.13 |
| C3-42 | 2 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 4 | 2 | 2 | 2 | 3 | 2.80 |
| C3-43 | 3 | 4 | 2 | 3 | 3 | 3 | 3 | 3 | 2 | 2 | 2 | 4 | 2 | 3 | 3 | 2.80 |
| L-19s | 2 | 3 | 2 | 2 | 2 | 4 | 4 | 4 | 3 | 3 | 3 | 3 | 3 | 2 | 2 | 2.80 |
| C3-38 | 4 | 3 | 3 | 4 | 2 | 2 | 2 | 3 | 3 | 3 | 3 | 2 | 3 | 2 | 2 | 2.73 |
| C3-16 | 2 | 3 | 3 | 3 | 3 | 2 | 2 | 3 | 2 | 4 | 2 | 3 | 3 | 2 | 3 | 2.67 |
| C3-35 | 2 | 2 | 2 | 2 | 2 | 3 | 2 | 3 | 2 | 3 | 2 | 2 | 3 | 1 | 2 | 2.20 |
| C3-3 | 2 | 2 | 2 | 3 | 3 | 2 | 2 | 2 | 1 | 1 | 1 | 3 | 1 | 2 | 2 | 1.93 |

### Round 3: scores after the debate (every stated change applied)

| Item | BL | MR | PF | GR | UX | PD | DV | A11Y | EN | RE | LG | TS | DK | CS | RT | Mean |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| C3-2 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 5 | 4 | 4 | 4 | 4.07 |
| C3-17 | 4 | 4 | 4 | 3 | 4 | 4 | 5 | 4 | 4 | 4 | 4 | 5 | 4 | 4 | 4 | 4.07 |
| L-16 | 4 | 4 | 4 | 4 | 4 | 4 | 3 | 4 | 4 | 4 | 5 | 5 | 4 | 4 | 4 | 4.07 |
| L-17 | 4 | 4 | 4 | 4 | 4 | 4 | 3 | 4 | 3 | 3 | 5 | 5 | 4 | 4 | 4 | 3.93 |
| C3-36 | 3 | 4 | 3 | 3 | 3 | 4 | 4 | 3 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 3.67 |
| L-20 | 3 | 3 | 3 | 3 | 4 | 5 | 4 | 5 | 4 | 3 | 3 | 3 | 4 | 4 | 4 | 3.67 |
| C3-9a | 3 | 4 | 3 | 4 | 3 | 3 | 4 | 3 | 3 | 4 | 4 | 4 | 4 | 4 | 4 | 3.60 |
| C3-37 | 5 | 5 | 4 | 5 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3.47 |
| C3-34 | 3 | 3 | 4 | 3 | 3 | 3 | 3 | 3 | 4 | 5 | 3 | 3 | 4 | 3 | 4 | 3.40 |
| C3-39/40 | 4 | 3 | 3 | 4 | 4 | 4 | 3 | 3 | 4 | 3 | 3 | 3 | 2 | 4 | 4 | 3.40 |
| C3-15 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 4 | 3 | 3 | 4 | 3 | 3 | 3 | 3 | 3.13 |
| L-18 | 2 | 4 | 2 | 3 | 3 | 4 | 3 | 4 | 3 | 3 | 4 | 4 | 3 | 2 | 3 | 3.13 |
| C3-16 | 2 | 3 | 3 | 2 | 3 | 2 | 2 | 3 | 3 | 4 | 2 | 4 | 3 | 3 | 4 | 2.87 |
| L-19s | 2 | 3 | 2 | 2 | 2 | 4 | 4 | 4 | 3 | 3 | 3 | 3 | 3 | 2 | 2 | 2.80 |
| C3-38 | 4 | 3 | 3 | 3 | 2 | 2 | 2 | 3 | 3 | 3 | 3 | 2 | 3 | 2 | 2 | 2.67 |
| C3-42 | 2 | 3 | 3 | 2 | 2 | 2 | 3 | 3 | 3 | 3 | 4 | 2 | 2 | 2 | 3 | 2.60 |
| C3-43 | 2 | 3 | 2 | 2 | 2 | 2 | 3 | 3 | 2 | 2 | 2 | 3 | 2 | 2 | 3 | 2.33 |
| C3-35 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 3 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 2.00 |
| C3-3 | 2 | 1 | 1 | 2 | 2 | 1 | 2 | 2 | 1 | 1 | 1 | 2 | 1 | 2 | 1 | 1.47 |

Main movements: C3-3 fell (1.93 → 1.47) after the engineer showed the matcher has no input that rules out an unseen
inflow (in the decisions keeper's probe an unreported split taints nothing, so every drawn lot reads "recorded and
untainted"). L-16 and L-17 rose (3.73 → 4.07, 3.93) on the F-9 correction plus legal's U2/U3 launch prerequisites.
C3-39/40 fell (3.80 → 3.40) after legal and the decisions keeper showed C3-40 demotes Delete against P6's easy deletion
and reverses the signed F-1 plan (`docs/features/logs/F-1/plan.md:75-77`). C3-43 fell (2.80 → 2.33): `consent_at` is
per connection (`db/schema.sql:289`), so "public since" has no defined value with two connections or a reconnect.
C3-16 rose (2.67 → 2.87) when reliability showed it could use the stored refusal streak instead of an unverified
vendor signal.

### Round 4: second vote on the top half

| Item | BL | MR | PF | GR | UX | PD | DV | A11Y | EN | RE | LG | TS | DK | CS | RT | Mean |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| C3-17 | 4 | 4 | 4 | 4 | 4 | 4 | 5 | 4 | 4 | 4 | 4 | 5 | 4 | 4 | 4 | 4.13 |
| C3-2 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 5 | 4 | 4 | 4 | 4.07 |
| L-16 | 4 | 4 | 4 | 4 | 4 | 4 | 3 | 4 | 4 | 4 | 5 | 5 | 4 | 4 | 4 | 4.07 |
| L-17 | 4 | 4 | 4 | 4 | 4 | 4 | 3 | 4 | 3 | 3 | 5 | 5 | 4 | 4 | 4 | 3.93 |
| C3-36 | 3 | 4 | 3 | 3 | 3 | 4 | 4 | 3 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 3.67 |
| L-20 | 3 | 3 | 3 | 3 | 4 | 5 | 4 | 5 | 4 | 3 | 3 | 3 | 4 | 4 | 4 | 3.67 |
| C3-9a | 3 | 4 | 3 | 4 | 3 | 3 | 4 | 3 | 3 | 4 | 4 | 4 | 4 | 4 | 4 | 3.60 |
| C3-37 | 5 | 5 | 4 | 5 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3.47 |
| C3-34 | 3 | 3 | 4 | 3 | 3 | 3 | 3 | 3 | 4 | 5 | 3 | 3 | 4 | 3 | 4 | 3.40 |
| C3-39/40 | 4 | 3 | 3 | 4 | 4 | 4 | 3 | 3 | 4 | 3 | 3 | 3 | 2 | 4 | 4 | 3.40 |

Shortlist: the seven items with a second-vote mean of 3.5 or more. C3-37 (3.47), C3-34 (3.40) and C3-39/40 (3.40)
could not be approved.

### Round 5: final vote (A approve, AC approve with conditions, R reject)

| Item | BL | MR | PF | GR | UX | PD | DV | A11Y | EN | RE | LG | TS | DK | CS | RT | Approve | Veto |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| C3-17 | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | 15/15 | none |
| C3-2 | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | 15/15 | none (as conditioned) |
| L-16 | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | 15/15 | none |
| L-17 | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | 15/15 | none |
| C3-36 | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | 15/15 | none |
| L-20 | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | 15/15 | none |
| C3-9a | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | 15/15 | none |

**Chair's notes on placing conditions in the feature files.** Every condition an approving member attached is an
acceptance criterion or a dated decision; duplicates were merged and the strictest kept. Where ballots disagreed:
(1) **L-17 old handles.** EN, RE, RT, MR and DK asked that an old handle "redirect"; F-17 decided a neutral 404 with no
301 and no link to the new handle (veto condition: CS), and LG, TS, PD and CS kept it in round 5. The council may not
reword a decided line, so the 404 stands and the redirect wording is recorded as not adopted. (2) **C3-36 precision.**
The brief's 4 decimals was replaced by "printed precision, or a fictional probe proving a finer one defeats size
recovery" (red team, adopted by 12 ballots). (3) **L-20 floor placement.** The red team's "floor in a protected file"
would change `scripts/invariants.test.ts`, a guardrail the council may not touch (`team/approval-council.md` "What
approval can and cannot do"); it goes to the owner as a request (flag 7) and F-20 gets a test that the floors never
drop below the cycle-2 values. (4) **C3-17 order.** Most ballots build it after the ledger slot so the count includes
transfers out; because F-22 waits on the owner, F-21's open question says it starts after F3-2 alone if the owner
declines F-22. (5) **C3-9a re-issued rows.** Reliability, engineer and common sense refined "dedupe": a suspected
re-issue (new id, same account, symbol, time, units, price) is counted for the owner, never merged and never
published twice silently; two genuine identical fills both survive.

## Not approved (waiting for the next cycle, with the council's reasons)

| Candidate | Last mean | Why it waits | What would bring it back |
|---|---|---|---|
| C3-37 Day-7 marker as an F-15 amendment | 3.47 (R4) | Growth, business and market research rate it the only way the G4 gate can be read at week 8 (sessions purge at 30 days, `lib/auth/sessions.ts:10`, `:33`, `:46`; `lib/privacy-purge.ts:52`); most others see a new stored field the privacy committee has not ruled on, for a reading with no real viewers yet. | Flagged to the owner (flag 5): fold into F-15's rework if the owner and the privacy committee agree (one first-seen day and one returned-after-day-7 day per account, purged with the account, never G4 itself). |
| C3-34 Health endpoint and cron 401 log line | 3.40 (R4) | Size S, no prerequisites, but owner-facing ops with no trader or viewer effect; most members want it as a chore. | The orchestrator may build it as a chore with the cycle-3 fixes: public body ok/degraded only, detail behind the cron bearer, `no-store`, threshold from the schedule constant (not a fixed 20 minutes), one rate-limited 401 line with no token fragment, header or IP. |
| C3-39/40 Record tools while billing is off + settings order | 3.40 (R4) | C3-39 (no primary button to locked /tools, `app/account/page.tsx:61`; a way back from `app/tools/page.tsx:69-78`) has broad support; C3-40 demotes "Delete my profile", against P6 easy deletion and the signed F-1 plan (`logs/F-1/plan.md:75-77`). | C3-39 alone, with C3-44, as a settings-lane chore if the business lead signs off the F-3 entry-point change (`logs/F-3/plan.md:142`) in the billing-closed state; C3-40 only with Delete visible at 360 px and an explicit amendment of the F-1 plan. |
| C3-15 In-app disconnect | 3.13 (R3) | Needed before real users (consent `lib/copy.ts:91` promises a rule the app cannot act on), but blocked three ways: fix F3-3, F-11, owner Q1/Q2 (OD-9). | When F3-3 and F-11 merge and the owner answers Q1 and Q2. No reads after disconnect; step 1 links Delete; no confirm-shaming; no vendor delete before BC-16. |
| L-18 F-18 one trust language (lapsed) | 3.13 (R3) | Six unmerged prerequisites (F-20, F-11, F-13, fixes #1, #2, #10); its false-label parts are already fixes. | Once F-20 and those prerequisites merge. File kept at `Status: draft`. |
| C3-16 Connection health | 2.87 (R3) | 0 connections; vendor authorization signal unverified; needs F3-3. Reliability showed a first slice can use the stored refusal streak (`users.sync_failure_kind`, `db/schema.sql:458`). | After F3-3, built on the stored refusal streak; trader-only line; no email until owner Q5. |
| L-19s F-19 call-site sweep (lapsed) | 2.80 (R3) | Waits on F-18. | After F-18 is re-approved; the range property test could run once fix #7 merges (DV). |
| C3-38 Drop-off aggregate before the purge | 2.67 (R3) | No sign-ups while the gate is closed; PR #62 edits the same purge (`lib/privacy-purge.ts:180`). | Before the launch gate opens, after #62: weekly or small-cell-suppressed counts, in the purge's transaction, never delaying it. |
| C3-42 Full data export | 2.60 (R3) | Scope is owner Q7 and BC-10; F-3 committee condition 11 fixes today's file; a full export under dev-stub auth is an account-takeover prize. | After real sign-in and the owner's Q7: a separate route, re-authentication, rate limit. |
| C3-43 "Public since" | 2.33 (R3) | A new public field (P6, owner Q8); undefined with several connections or a reconnect. | Owner Q8 plus a rule: the first-ever consent date, never reset; inside F-11's status line. |
| C3-35 Versioned share images | 2.00 (R3) | Saving below build cost at beta volume; a long-cached stale image under Verified fights takedowns; needs F3-26. | When F-15 shows real image traffic; short shared cache unless a purge on hide, delete, rename and disconnect is wired. |
| C3-3 Oversell publishes its recorded part | 1.47 (R3) | Rejected in substance: the matcher cannot rule out an unseen inflow; the decisions keeper's probe (buy 100 @100, unreported 2:1 split, sell 101 @50) would publish −50% Verified when the truth is 0%. | Only with a vendor position-units check that rules out an unseen inflow. Its wrong-cause copy (`lib/copy.ts:69`) goes to the fixes list (below). |

**Routed in round 0 (not voted).** C3-41 (one link rule for trade rows) and C3-45 (a quieter "No thesis posted.") go
to a design session (F-2 gestures, F-10's card). C3-44 (subscriber-notes line on delete) is a chore in the F-3
committee's words (`logs/F-3/plan.md:151-152`). K20 (home link preview: no product name, logo, figure or completeness
claim before T5a) and K22 (billing hygiene tests in test mode) stay chores. K19 (after fix #1), K16 (after fixes #14,
#17 and F-13), K15 (real traders), K11 (owner O-2/O-4), K21 (real records, after F-17) and KV (traffic) are carried
forward unchanged: their own bring-back conditions are unmet. K18 joined F-16 (re-approved).

## Flags for the owner (the council's recommendation; not approved)

1. **F-22 amends a decided rule.** It changes the matcher's "an unpriceable action taints them" (`lib/trades.ts:52`)
   for transfers and the corporate-actions committee's "when in doubt, exclude and count"
   (`docs/features/logs/corporate-actions/committee-2026-11-01.md:44-45`, `:57-58`). **Recommendation: yes**, with the
   basis rule (oldest first only where it cannot change a basis), moved-in units excluded and counted, every transfer
   out counted, and unknown kinds still tainted. F-22 stays blocked until the owner answers. The owner may also amend
   POLICY's list of exclusion causes to name transfers out.
2. **F-9 is the bottleneck.** It is built on `claude/fix-user-text-safety` (53b74e3; no open PR) and holds F-16, F-17
   and K18, all launch prerequisites (POLICY U2/U3). **Recommendation:** open its PR and merge it next; this is the
   second council at which F-16 and F-17 would otherwise lapse.
3. **Cap reading.** The council counted re-approvals of lapsed features as not new and counted build slots (four).
   `team/approval-council.md` is protected; the owner may confirm or correct the reading.
4. **C3-9b (vendor corrections in an append-only revisions table)** is cycle-3 owner question Q3 (CLAUDE.md "raw,
   immutable"). **Recommendation (council cycle 3):** yes, read as "never updated in place". F-24 (insert-only) does
   not need it.
5. **C3-37 day-7 marker** missed the cut by 0.03. **Recommendation:** fold it into F-15's rework if the owner and the
   privacy committee agree; MRC2-3 gate definitions stay the owner's.
6. **K18's age-assurance method** stays the owner's (POLICY; no date of birth, ID or age estimation in F-16).
7. **L-20 floor placement.** The council asks the owner whether the contrast floors should sit in a protected file
   (for example `scripts/invariants.test.ts`), so the change that breaks them cannot lower them.
8. **Process (owner Q1, `docs/process/decisions-and-authority.md`).** Until the owner answers whether product changes
   in lane C need three versions, CLAUDE.md's rule applies as written; F-21..F-24 change no look or flow beyond one
   line (F-21) and the product designer asked that F-21's line follow the three-version rule unless the owner exempts
   it.
9. Still with the owner, not re-asked: cycle-3 owner questions Q1-Q10 (`docs/direction/cycle3-2026-11-01.md` §7),
   OD-6, OD-9, BC-16, MRC2-3, C16/K17, D27 wording, and decisions-and-authority Q1-Q14.

## Fixes found during the vote (for the fixes list; no vote)

These are defects against existing rules, found or confirmed by members at f467293. They go to the orchestrator's
fixes list (cycle-3 fixes are building; these are not yet on it):
- **Rename-chain shared-account leak.** The rename-chain read (`lib/sync.ts:123-129`) has no `notShared` filter,
  though the main stream applies it (`:101`); a marked shared account in a rename chain still feeds the record. The
  existing test only counts filter uses (`lib/shared-accounts.test.ts:14`). Needs a behavioural test (reliability).
  F-21 also depends on it.
- **"No thesis posted." over a held thesis.** `app/ui.tsx:82` prints "No thesis posted." when a thesis exists but is
  held, which states something untrue (legal). F-9's `UserNote` on `claude/fix-user-text-safety` may already change
  this line; check after that branch merges.
- **Oversell copy.** With C3-3 not approved, `lib/copy.ts:69` keeps blaming missing history for a sell that drew only
  recorded lots; members ask F3-15 to name both possible causes (a short sale or unseen history) without guessing.
- Fixes that need a feature to land: F3-2 unblocks F-21 and F-23; F3-1, F3-5 and F3-15 unblock F-22; F3-3 unblocks
  C3-15 and C3-16 (not approved); F3-26 unblocks C3-35 (not approved).

## Known limits of this record

- Members read the code and the records; no app was run for this vote. Vendor behaviour (transfers, late postings,
  re-issued rows, authorization health) is unverified, as in the cycle-3 audit (§9).
- Round 3's speaker rule broke ties at the cut by roster order, so the business lead and market research spoke on more
  items than others; every member saw every argument before changing scores.
- The members' round-5 messages were relayed as compact `VOTES:` lines; the chair cross-checked each against the
  member's ballot file (Appendix B).
- Re-approved features keep every earlier condition; where a new condition sharpens an old one, both are in the file.
- The council did not check the in-flight branches' code beyond what each item needed; their own reviews decide them.

## Appendix A: the ballot, round 0 and the chair's rulings

### Evidence at f467293 (round 0 helper)
All 18 C3 problems still exist on main; #52, #60 and #61 fixed none. Moved citations: counts block
`app/u/[handle]/page.tsx:289-292` (was 284-287); `lib/sync.ts:37` (on conflict do nothing, was 36), `:378` (7-day
window, was 376); `lib/privacy-purge.ts:52` (sessions, was 47), `:180` (funnel delete, was 118), `:22`
(`UNFINISHED_SIGNUP_DAYS`, was 19); `lib/feed.ts:197-198` (epochs, was 185-186); `db/schema.sql:289` (`consent_at`,
was 285); `app/ui.tsx:82` (was 65); `lib/billing.ts:212-217` (was 206-211). New: #52's `notShared` exclusion
(`lib/sync.ts:101`) has no count. The brief's "cycle-2 K6 condition 2" citation for C3-35 does not resolve (K6 went to
the owner).

**Lines at d98f32d (after #56 merged).** Counts block `app/u/[handle]/page.tsx:301-310`; `lib/sync.ts:101`
(`notShared`), `:123-129` (rename-chain read without it), `:12` and `:381` (7-day window), `:37` unchanged;
`app/u/[handle]/pane/route.ts:23` (`closedAt` in ms), `:28` (public cache); `lib/feed.ts:202-203` (epochs);
`app/ui.tsx:82` ("No thesis posted."); `db/schema.sql:694` (`excluded_corporate`), `:458` (`sync_failure_kind`),
`:289` (`consent_at`) and `:34`, `:319` unchanged; `lib/copy.ts:69`, `:79`, `:91`, `lib/trades.ts:41-42`, `:52`, `:171`,
`lib/corporate-actions.ts:200` unchanged. Still open: PR #55 (F-13) and PR #62 (options); F-7 is no longer an open PR.

### The 32-item draft ballot
- **A. Cycle 3 briefs (18):** C3-2, C3-3, C3-17, C3-15, C3-9, C3-16, C3-37, C3-36, C3-34, C3-39, C3-40, C3-42,
  C3-35, C3-41, C3-43, C3-38, C3-44, C3-45 (`docs/direction/cycle3-2026-11-01.md` §6).
- **B. Waiting from cycle 2 (9):** K18, K20, K22, K19, K16, K15, K11, K21, KV.
- **C. Lapsed cycle-2 approvals (5):** F-16 (F-9 unmerged; fix #4 merged in #59), F-17 (F-9), F-18 (F-11, F-13, F-20,
  fixes #1, #2, #10 unmerged), F-20 (PR #55, fixes #12, #13, #26 unmerged), F-19's sweep (F-18 unmerged). F-15 did not
  lapse (its clause is "if not started"; it is building). Cycle-1 approvals (F-9, F-11, F-13, F-14) have no lapse
  clause; applying one retroactively is the owner's call (DK).

### Round 0 verdicts (decisions keeper, legal, common sense)
- No item breaks POLICY as scoped (legal). Owner flags: C3-2, C3-3 (amend decided rules), C3-9 (Q3), C3-15 (Q1, Q2,
  BC-16), C3-42 (Q7, BC-10), C3-43 (Q8; P6 bars rendering `consent_at` before the owner changes the consent line), K18
  (age-assurance method), K22 (Terms, LIVE_BILLING).
- Decisions keeper: C3-2 owner-conditional with the basis veto condition; C3-3 conflicts with the "whole, matched part
  included" ruling (committee log `:24`, `:115-119`), with the unreported-split probe; C3-17 reshaped (no feed-card
  line, D22); C3-40 amends F-1 plan `:75-77`; C3-39 amends F-3 plan `:142`; C3-42 amends F-3 condition 11; C3-41,
  C3-44, C3-45 not ballotable; K19, K16, K15, K11, K21, KV not ballotable; K18 into L-16; "waiting" is not a feature
  status (use `draft`).
- Common sense: C3-9, C3-16, C3-35, C3-38, C3-42 premature; C3-34, K20, K22, C3-44 chores; recommended three slots this
  cycle because the 27 cycle-3 fixes and the open branches already need review.

### Chair's rulings
1. Routed off the ballot as listed under "Routed in round 0".
2. C3-9 split (9a ballotable, 9b owner flag); C3-39 + C3-40 merged; C3-17 reshaped; K18 merged into L-16.
3. Lapsed approvals are re-voted. A re-approval keeps its F-number, file and every earlier decision word for word,
   adds one dated decision and a new lapse clause. A lapsed item not re-approved goes to `Status: draft` with a dated
   lapse decision.
4. L-18 depends on L-20; L-19s on L-18.
5. Cap reading as in Result (flag 3).
6. Round 3 state correction: F-9 is built on `claude/fix-user-text-safety` (verified: its `docs/features/F-9-thesis-safety.md`
   reads `Status: built`; `lib/reports.ts` and `lib/handles.ts` exist on that branch).

## Appendix B: every ballot

All 15 members' statements, by round (round 0 statements, round 1 ballots, round 3 arguments and score changes, round 4
ballots, the red team's case and round 5 ballots), verbatim:
[approval-2026-11-01-cycle3-ballots.md](approval-2026-11-01-cycle3-ballots.md).
