# Approval council, cycle 4: 2026-11-01

The approval council (`team/approval-council.md`) met for its fourth cycle on 2026-11-01. The owner's orchestrating
session started it under the owner's delegation (POLICY H; owner decision 2026-11-01: decide by the committee's
recommended option; anything POLICY or COMPLIANCE reserves for the owner or counsel uses the AI legal committee's
findings and still goes to the owner as a flag).

Fifteen members voted, each a separate agent with fresh context, in parallel within each round (the owner asked not to
limit the rate). The chair ran the rounds and counted the votes and did not vote. Base for every round: `origin/main`
**e6731d5** (#83, the council cycle 4 audit). Main did not move during the council (re-checked with `git fetch` before
the record was written). Every probe trade named here is fictional. Not legal advice.

## Result

| Rank | Candidate | Second-vote mean | Final vote | Outcome | Can start / blocked on |
|---|---|---|---|---|---|
| 1 | C4-2 A short's cover never prices a later long trade | 4.67 | 15/15 (all AC) | **Approved: F-28** | Blocked: owner Q1(b) |
| 2 | C4-26ab Gated options wording true for every record (parts a, b) | 3.87 | 15/15 (all AC) | **Approved: F-29** | Blocked: `claude/fix-truthful-labels`, PR #77, the AI legal committee's words |
| 2 | C4-1 Same-instant order on date-only stamps (narrowed by probe C) | 3.87 | 15/15 (all AC) | **Approved: F-30** | Blocked: owner Q1(a) |
| 2 | C4-4/31 The readout states its limits and splits trader and filer views | 3.87 | 15/15 (all AC) | **Approved: F-31** | Blocked: fixes F4-11 and F4-12 (same file), or the same builder |
| 5 | L-23 F-23 public payload precision (lapsed, re-voted) | 3.73 | 15/15 (all AC) | **Re-approved: F-23** | Blocked: fix F3-2 (on `claude/fix-truthful-labels`) and F-26 |

Three items tied at 3.87 in round 4. They were numbered by round-1 mean: C4-26ab 3.93, C4-1 3.87, C4-4/31 3.80.

No veto applied to any approved item as conditioned. The decisions keeper, legal and common sense each named the
conditions whose removal would trigger their veto, and the feature files mark them "(veto condition: …)".

**Nothing can start today.** This was verified against `origin/main` e6731d5 and `git ls-remote` on 2026-11-01:
- F-28 and F-30 wait for the owner's answer to cycle-4 Q1.
- F-29 waits for `claude/fix-truthful-labels` (no PR; 6 behind main with 7 conflicting files at the council's live
  check) and PR #77 (F-20), and for the legal committee's words.
- F-31 waits for fixes F4-11 and F4-12. `claude/fixes-cycle4` is not pushed yet.
- F-23 waits for F3-2, which exists only on `claude/fix-truthful-labels`, and for F-26 (`claude/f26-held-like-none`).

Each file is `Status: blocked` with a `Blocked:` line the pipeline reads (`scripts/features.ts` `blockedOn`) and a
lapse clause. **If its prerequisite has not merged by the next approval council (cycle 5), the approval lapses to that
council.** The orchestrator flips each one to `ready` as its prerequisites merge.

**Slots: four of six.** Four new features (F-28 to F-31) and one re-approval (F-23), counted as cycle 3 did:
re-approvals of lapsed features are not new, and features touching the same files are one build slot.
- **Matcher slot:** F-28 + F-30 (`lib/trades.ts`, its tests; one builder). It has no branch conflict, because the
  labels branch edits only `confidence()`.
- **Readout slot:** F-31 (`scripts/f15-readout.ts`, its test).
- **/how and options copy slot:** F-29 (`lib/copy.ts` OPTIONS, `app/how/page.tsx`, `app/pane.tsx`,
  `app/u/[handle]/chart.tsx`, `lib/record-strip.ts`).
- **Pane and payload slot:** F-23 alone, now that F-21 is not re-approved.

Common sense asked for three *active* slots at most (V5). Only the readout slot can start without an owner answer or
the labels rebase, so the active count stays within that.

**Numbering.** F-28 to F-31, by second-vote rank of the new items. F-23 keeps its number and file, with dated decisions
appended. No earlier dated line was edited.

**Lapsed and not re-approved.** F-21 (exclusion counts beside the headline) and F-22 (transfers as share moves) both
finished at 3.47 in the second vote, 0.03 below the floor. Each goes to `Status: draft` with a dated lapse decision, and
its file and decisions are kept word for word. F-21 returns once F3-2 merges. F-22 returns once the owner answers flag 1.

Not lapsed (their prerequisites merged; builds in flight), so they were not on the ballot:
- F-16 and F-17 (F-9 merged as #65; `claude/f16-f17-trust-safety`);
- F-24 (F-14 merged as #64; `claude/f24-late-postings`);
- F-20 (fix #26 merged in #71; PR #77 open).

Their `Blocked:` lines still name merged work; the decisions keeper asks F4-21 to refresh them.

## Process

- **Round 0 (consistency check).** The chair drafted the ballot:
  - the 21 briefs of `docs/direction/cycle4-2026-11-01.md` §6;
  - cycle 3's waiting items;
  - the three cycle-3 approvals that lapse (F-21, F-22, F-23).

  The decisions keeper, legal and common sense checked every item. A helper re-read every C4 citation at e6731d5: all
  21 problems still exist, and outside `docs/` dec669d and e6731d5 are identical. The chair's rulings are in Appendix A.
  The ballot came to **18 items**.
- **Round 1 (first vote).** 15 independent ballots, each item scored 0-5 with a reason.
- **Round 3 (debate).** The five highest and five lowest scorers on each item stated their strongest argument. Only
  members above or below the item's mean counted, and ties at the cut were broken by roster order. The chair added
  three verified notes:
  - the labels branch's live state (6 behind, 7 conflicts);
  - EN/RE/RT's finding that a tainted draw counts as `excludedCorporate` today (`lib/trades.ts:248-252`);
  - EN's finding that the beacon reads `via` at fire time (`app/view-beacon.tsx:36`).

  Every member then gave post-debate scores, naming the argument behind each change.
- **Round 4 (second vote)** on the top half: 9 of 18. The cut fell cleanly between 3.33 and 3.20.
- **Round 5 (final vote).** The red team wrote the case against each of the five items at 3.5 or more. Then every
  member voted approve / approve with conditions / reject, and the three veto holders stated "veto: none" or a ground.

Members (roster order in the tables):

| Code | Member |
|---|---|
| BL | business lead |
| MR | market research lead |
| PF | pricing and finance |
| GR | growth |
| UX | UX lead |
| PD | product designer |
| DV | data-visualization designer |
| A11Y | accessibility specialist |
| EN | engineer |
| RE | reliability engineer |
| LG | legal and compliance |
| TS | trust and safety |
| DK | decisions keeper |
| CS | common sense |
| RT | red team |

Every mean and count below was recomputed by script from the members' replies. Each `SCORES:`/`VOTES:` line was
cross-checked against the table in that member's ballot file for rounds 1, 3b, 4 and 5: 0 mismatches and 0 missing
cells in each round. Round 5 had 15 ballots × 5 items = 75 approvals with conditions and 0 rejections. Every ballot is
in [Appendix B](approval-2026-11-01-cycle4-ballots.md).

## Votes

### Round 1: first vote (0-5)

| Item | BL | MR | PF | GR | UX | PD | DV | A11Y | EN | RE | LG | TS | DK | CS | RT | Mean |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| C4-2 | 4 | 5 | 4 | 4 | 4 | 4 | 5 | 4 | 5 | 5 | 5 | 5 | 4 | 5 | 5 | 4.53 |
| C4-26ab | 3 | 4 | 3 | 4 | 5 | 5 | 4 | 4 | 4 | 3 | 4 | 4 | 4 | 4 | 4 | 3.93 |
| C4-1 | 4 | 4 | 4 | 4 | 4 | 3 | 4 | 3 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 3.87 |
| C4-4/31 | 4 | 4 | 4 | 5 | 3 | 3 | 4 | 3 | 4 | 4 | 3 | 4 | 4 | 4 | 4 | 3.80 |
| L-21 | 3 | 4 | 2 | 3 | 4 | 4 | 4 | 4 | 3 | 4 | 4 | 4 | 3 | 3 | 4 | 3.53 |
| C4-32 | 3 | 4 | 3 | 4 | 4 | 3 | 3 | 3 | 4 | 4 | 3 | 4 | 3 | 3 | 4 | 3.47 |
| L-22 | 3 | 4 | 2 | 3 | 3 | 3 | 4 | 3 | 3 | 4 | 4 | 5 | 3 | 3 | 4 | 3.40 |
| C4-27 | 3 | 3 | 3 | 3 | 4 | 4 | 3 | 3 | 4 | 3 | 4 | 3 | 3 | 4 | 3 | 3.33 |
| L-23 | 4 | 4 | 2 | 3 | 3 | 3 | 4 | 3 | 3 | 3 | 4 | 4 | 3 | 3 | 4 | 3.33 |
| C4-34bc | 3 | 3 | 3 | 3 | 4 | 4 | 3 | 5 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3.27 |
| C4-28 | 2 | 3 | 2 | 3 | 3 | 3 | 3 | 3 | 4 | 3 | 4 | 4 | 4 | 3 | 3 | 3.13 |
| C4-36 | 2 | 4 | 2 | 3 | 4 | 4 | 4 | 4 | 3 | 2 | 3 | 3 | 2 | 3 | 3 | 3.07 |
| C4-41 | 3 | 3 | 4 | 2 | 3 | 2 | 3 | 3 | 3 | 3 | 4 | 3 | 3 | 2 | 3 | 2.93 |
| C4-29 | 2 | 3 | 2 | 2 | 3 | 3 | 4 | 3 | 3 | 2 | 4 | 3 | 3 | 3 | 3 | 2.87 |
| C3-38 | 4 | 3 | 2 | 4 | 2 | 3 | 2 | 3 | 2 | 3 | 2 | 2 | 3 | 2 | 2 | 2.60 |
| C4-33 | 2 | 4 | 2 | 3 | 3 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 3 | 2 | 2 | 2.33 |
| C3-16 | 2 | 3 | 2 | 2 | 3 | 2 | 2 | 3 | 2 | 3 | 2 | 2 | 2 | 2 | 2 | 2.27 |
| C4-37 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 3 | 2 | 2 | 2 | 2 | 2.07 |

### Round 3: scores after the debate (every stated change applied)

| Item | BL | MR | PF | GR | UX | PD | DV | A11Y | EN | RE | LG | TS | DK | CS | RT | Mean |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| C4-2 | 4 | 5 | 4 | 5 | 4 | 5 | 5 | 4 | 5 | 5 | 5 | 5 | 4 | 5 | 5 | 4.67 |
| C4-1 | 4 | 4 | 4 | 4 | 4 | 3 | 4 | 3 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 3.87 |
| C4-4/31 | 4 | 4 | 4 | 5 | 3 | 4 | 4 | 3 | 4 | 4 | 3 | 4 | 4 | 4 | 4 | 3.87 |
| C4-26ab | 3 | 4 | 3 | 4 | 5 | 4 | 4 | 4 | 4 | 3 | 4 | 4 | 4 | 4 | 4 | 3.87 |
| L-23 | 4 | 4 | 3 | 4 | 3 | 4 | 4 | 3 | 4 | 3 | 4 | 4 | 3 | 4 | 4 | 3.67 |
| L-22 | 3 | 4 | 3 | 3 | 3 | 3 | 4 | 3 | 3 | 4 | 4 | 5 | 3 | 3 | 4 | 3.47 |
| C4-32 | 3 | 4 | 3 | 3 | 4 | 3 | 3 | 3 | 4 | 4 | 3 | 4 | 3 | 3 | 4 | 3.40 |
| L-21 | 3 | 4 | 2 | 3 | 4 | 4 | 4 | 4 | 3 | 3 | 4 | 4 | 2 | 3 | 4 | 3.40 |
| C4-27 | 3 | 3 | 3 | 3 | 4 | 4 | 3 | 3 | 4 | 3 | 4 | 3 | 3 | 4 | 3 | 3.33 |
| C4-28 | 2 | 3 | 2 | 3 | 4 | 3 | 3 | 3 | 4 | 3 | 4 | 4 | 4 | 3 | 3 | 3.20 |
| C4-34bc | 3 | 3 | 3 | 3 | 4 | 4 | 3 | 4 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3.20 |
| C4-41 | 3 | 4 | 4 | 3 | 3 | 2 | 3 | 3 | 3 | 3 | 4 | 3 | 3 | 2 | 4 | 3.13 |
| C4-29 | 2 | 3 | 2 | 2 | 3 | 3 | 4 | 3 | 3 | 2 | 3 | 3 | 3 | 3 | 3 | 2.80 |
| C4-36 | 2 | 3 | 2 | 3 | 3 | 4 | 3 | 3 | 3 | 2 | 3 | 3 | 2 | 3 | 3 | 2.80 |
| C4-33 | 2 | 4 | 2 | 2 | 3 | 2 | 3 | 2 | 2 | 2 | 2 | 2 | 3 | 2 | 2 | 2.33 |
| C3-38 | 3 | 2 | 3 | 3 | 2 | 2 | 2 | 3 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2.27 |
| C3-16 | 2 | 3 | 2 | 2 | 3 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2.13 |
| C4-37 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 3 | 2 | 2 | 2 | 2 | 2.07 |


Main movements:
- **L-23 rose (3.33 → 3.67).** TS, RT and LG showed the precision leak is live on main for every connected trader
  (`app/u/[handle]/pane/route.ts:24`, `:28`), against the consent line (`lib/copy.ts:82`), not dormant.
- **C4-2 rose (4.53 → 4.67).** DV and LG argued it is the figure itself, while every other item is wording around
  figures.
- **C4-36 fell (3.07 → 2.80).** DK showed F-19 sequences the range line after F-18 (`F-19:25-27`), and RE showed a
  label-walking test would break on their reworks.
- **C3-38 fell (2.60 → 2.27).** EN and LG showed new statements inside the purge transaction
  (`lib/privacy-purge.ts:355`) could abort the delete, for counts that are zero today.
- **L-21 fell (3.53 → 3.40).** DK and EN showed it cannot start (F3-2 has no PR) and re-approval would schedule a third
  lapse.
- **C4-41 rose (2.93 → 3.13).** LG, PF and MR showed a charge that differs from the consent copy is a per-consumer
  auto-renewal exposure.

### Round 4: second vote on the top half

| Item | BL | MR | PF | GR | UX | PD | DV | A11Y | EN | RE | LG | TS | DK | CS | RT | Mean |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| C4-2 | 4 | 5 | 4 | 5 | 4 | 5 | 5 | 4 | 5 | 5 | 5 | 5 | 4 | 5 | 5 | 4.67 |
| C4-1 | 4 | 4 | 4 | 4 | 4 | 3 | 4 | 3 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 3.87 |
| C4-4/31 | 4 | 4 | 4 | 5 | 3 | 4 | 4 | 3 | 4 | 4 | 3 | 4 | 4 | 4 | 4 | 3.87 |
| C4-26ab | 3 | 4 | 3 | 4 | 5 | 4 | 4 | 4 | 4 | 3 | 4 | 4 | 4 | 4 | 4 | 3.87 |
| L-23 | 4 | 4 | 3 | 4 | 4 | 4 | 4 | 3 | 4 | 3 | 4 | 4 | 3 | 4 | 4 | 3.73 |
| L-22 | 3 | 4 | 3 | 3 | 3 | 3 | 4 | 3 | 3 | 4 | 4 | 5 | 3 | 3 | 4 | 3.47 |
| C4-32 | 3 | 4 | 3 | 4 | 4 | 3 | 3 | 3 | 4 | 4 | 3 | 4 | 3 | 3 | 4 | 3.47 |
| L-21 | 3 | 4 | 3 | 3 | 4 | 4 | 4 | 4 | 3 | 3 | 4 | 4 | 2 | 3 | 4 | 3.47 |
| C4-27 | 3 | 3 | 3 | 3 | 4 | 4 | 3 | 3 | 4 | 3 | 4 | 3 | 3 | 4 | 3 | 3.33 |


Shortlist: the five items with a second-vote mean of 3.5 or more. L-22, C4-32 and L-21 (each 3.47) and C4-27 (3.33)
could not be approved.

### Round 5: final vote (A approve, AC approve with conditions, R reject)

| Item | BL | MR | PF | GR | UX | PD | DV | A11Y | EN | RE | LG | TS | DK | CS | RT | Approve |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| C4-2 | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | 15/15 |
| C4-1 | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | 15/15 |
| C4-4/31 | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | 15/15 |
| C4-26ab | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | 15/15 |
| L-23 | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | 15/15 |


Veto: none for every item, as conditioned (DK, LG, CS). The veto conditions they named:
- **C4-2:**
  - DK: one count per sell, and a thesis is never deleted.
  - LG: the rule never publishes a figure priced off a cover, the pending count travels with renames, and the cause
    wording is true.
  - CS: the rule only ever counts more.
- **C4-1:**
  - DK, LG, CS: no rule the trader can steer by choosing when to close (the probe C test).
  - LG: the scope widens only on the vendor's written answer.
  - DK: the F3-5 test is rewritten only after the owner's yes, with a twin.
- **C4-4/31:**
  - DK, LG, CS: R-1 (partial rows only).
  - LG: no handle or id in any row, and suppression holds across weekly and cumulative rows.
  - CS: the counts are never presented as verified.
- **C4-26ab:**
  - DK, LG: the legal committee signs the words.
  - LG: the kept qualifier sits in the headline block (a position test), and no public surface tells "not asked" from
    "declined".
  - CS: no surface loses its last qualifier.
- **L-23:**
  - DK: F-23's earlier conditions are kept word for word.
  - LG: one scan over every signed-out response, and the sent stats are rounded.
  - CS: no public payload is more precise than the screen.

**Chair's notes on placing conditions in the feature files.** Every condition an approving member attached is an
acceptance criterion or a dated decision. Duplicates were merged and the strictest kept. Where ballots disagreed:
1. **C4-1 narrowed (red team probe C).** As briefed, counting every same-day round trip on date-only stamps would let a
   trader close losing trades the same day (counted) and hold winners overnight (published). In the fictional probe a
   50% win rate and 0% average become 100% and +3%. All 15 ballots adopted the evidence rule: a same-day long round trip
   keeps F3-5 unless the pair shows an earlier oversell, a pending cover, `unknownFrom`, or a broker position above the
   ledger. Three members (A11Y, PD, RT) said they would vote R without it, and legal and common sense made it a veto condition. The cost is on record: a same-day short with no evidence
   still publishes. The owner is told this trade-off in Q1(a).
2. **C4-2's probe A release.** RT and several ballots asked that a broker position snapshot release the taint when the
   shares were held. EN showed the snapshot reads flat after a cover and after a pre-history sale alike, so it cannot
   tell the two apart. CS and EN read probe A as the over-count POLICY F3c accepts. The file keeps the `k`-unit taint,
   pins probe A as counted under the true cause, and allows an early release only on evidence that tells a cover from a
   re-buy, never on a time guess. Whether such evidence exists is an owner open question.
3. **C4-4/31 "not readable".** RT and some ballots asked that G3 print "not readable" in place of its figure when the
   address cap is not live. EN and DK showed that replacing the strict row would break R-1. The flag prints beside the
   strict rows, which always print. EN also showed the script cannot see the per-request address state
   (`lib/views.ts:59` decides at ingestion). The cap state comes from a deploy setting or a stored weekly aggregate,
   which is an owner open question.
4. **C4-26ab's gate-opening line.** Every ballot recommends that `optionsPublic()` not open publicly until a trader-only
   "not asked yet" view or a wording true in both cases exists. Opening the gate is the owner's (options committee
   decision 8 is not amended), so this is a recommendation and a flag, not a decided line.
5. **L-23's scope.** The red team found that the profile page's RSC payload (`packPoints`, `lib/paging.ts:41`) carries
   the same precision. All 15 ballots added one scan over every signed-out response and rounded sent stats. Members
   asked for a fee probe that names the smallest revealing position size. That is in the file, and any change
   to the consent words is the owner's and the legal committee's.

## Not approved (waiting for the next cycle, with the council's reasons)

| Candidate | Last mean | Why it waits | What would bring it back |
|---|---|---|---|
| L-22 F-22 transfers as share moves (lapsed) | 3.47 (R4) | The facts are unchanged since cycle 3 and owner flag 1 is unanswered. Most members would not re-vote it on the same facts. TS, RT, RE and LG rate it the one at-will way to remove a loss today. | The owner's yes on flag 1, put with cycle-4 Q1 in one sitting. Then the next council places it in the matcher slot after F-28 and F-30. The file is kept at `Status: draft`. |
| L-21 F-21 exclusion counts beside the headline (lapsed) | 3.47 (R4) | It cannot start: F3-2 sits on `claude/fix-truthful-labels` (no PR, 7 conflicts), and its shared sum waits on F-22. | Once F3-2 merges (owner Q6, rebase first). It starts after F3-2 alone if the owner declines F-22. The file is kept at `Status: draft`. |
| C4-32 Strip `?via=` from the address bar | 3.47 (R4) | As briefed, it breaks the measure it protects: the beacon reads `via` when it fires, after a 2 s timer (`app/view-beacon.tsx:36`), so stripping it on mount sends no `via`. | Re-briefed: read `via` once at mount, then `replaceState` with the existing `history.state`. A test that the beacon still carries `via`; no extra history entry; hash and other parameters kept. It fits the F-31 readout slot. |
| C4-27 /how describes filer records only when they exist | 3.33 (R4) | A real but low-reach untruth while the switch is off. Most members want it on the switch-on checklist (owner Q2), or riding F-29's slot. | With F-29's slot or on owner Q2's checklist. It shares F4-8's predicate, `/public-records` and its contact stay reachable, and `/how#public-filings` never lands on a missing section. |
| C4-28 No symbol term for filers in the personal order | 3.20 (R3) | Dormant while `PUBLIC_TRADERS` is off. TS, EN, DK and LG wanted a pinned test because it is the only item that can start now with no conflict. | On owner Q2's switch-on checklist as a blocking item with a test (relevance, similar and suggest give filers no symbol term or reason). |
| C4-34bc SW-1 hint spoken text, no "Demo Demo" | 3.20 (R3) | A real accessibility clean-up, but near-chore sized. | The a11y fixes lane as a chore (A11Y, PD). Part (a) is owner Q4. |
| C4-41 Checkout refuses a price that differs from the screen | 3.13 (R3) | Live billing is off (`lib/billing.ts:49`). LG, PF, MR and RT showed a per-consumer auto-renewal exposure on the first live charge. | A blocking line on the live-billing checklist with a fake-processor test: configured amount, currency and interval equal `PLANS` before any `LIVE_BILLING=on`. This is the owner's call (Flags 6). |
| C4-29 "Before fees" beside public-filing figures | 2.80 (R3) | Matters only after switch-on, and it touches four surfaces, two of them in PR #77. | On owner Q2's switch-on checklist, with a copy test and the F-7 legal member's words. |
| C4-36 A "Range and evidence" section on /how | 2.80 (R3) | F-19 sequences the range line after F-18 (`F-19:25-27`). A label-walking test would break on their reworks, not on defects. | After F-18 is re-approved and built: F-19's words only, no glossary or profile control. |
| C4-33 Count pane opens | 2.33 (R3) | A new beacon surface with no viewers yet, and owner Q5 is open. DV: the ratio mixes surfaces with different visibility rules. A11Y: the pane is toggled inert. | Owner Q5 (drop bounce). Re-briefed as "views, not people", exact cells only, shipped with F-31's block, with no DOM, focus or inert change. |
| C3-38 Drop-off aggregate before the purge | 2.27 (R3) | No sign-ups while the gate is closed. New statements inside the purge transaction (`lib/privacy-purge.ts:355`) could abort the privacy delete. | Just before the launch gate opens: counts only, weekly, suppressed under 5, and a failing count never aborts or delays the delete (test). |
| C3-16 Connection health (trader-only) | 2.13 (R3) | 0 connections. A second status sentence beside F-11's unmerged line works against one word per state. | As an acceptance criterion on F-11's status line after `claude/fix-truthful-labels` merges: `role=status`, streak threshold, no email (owner Q5 of cycle 3). |
| C4-37 Exercise-day rule per lot | 2.07 (R3) | Size M. It publishes more, for option traders who cannot exist while the gate is closed. Choosing delivered lots is a basis guess. | After F-28/F-30, F-24 and F4-2, and once the options gate can open. Veto unless every candidate lot gives the same answer. |

**Routed in round 0 (not voted).**
- **Chores:** C4-38 (deploy-time work), C4-39/13h (bounded health read, under C3-34's terms), C4-42 (vendor letter; the
  owner sends it) and C4-43 (`capUsd` label). C4-40 (e2e traces) is a chore in owner Q7, because both files are
  protected; LG adds that uploads must come only from jobs with no repository secret.
- **Committees:** C4-8 goes to the options committee (option b) or the legal committee (option a; LG prefers a).
- **F-26 build:** C4-35 is a hand-off acceptance criterion there; Report stays on every note.
- **Fixes list:** C4-2's copy part ("a short sale or earlier history", `lib/copy.ts:70`). K16 also goes here: its
  bring-back is met in code, the double-tap part is decided in F-25, and "Back returns to the same card" is a SW-1 Must.
- **Owner:** C4-34 (a) to Q4 and C4-26 (c) to Q3.
- **Done:** C3-34 (#76, #78) and C3-39 (#76).
- **Not ballotable** (their bring-back conditions are unmet): C3-37 (owner flag 5 and the privacy committee), C3-40,
  C3-15, L-18, L-19s, C3-42 (cycle-3 Q7), C3-43, C3-35, C3-3, K19, K15, K11, K21 and KV.

## Flags for the owner (the council's recommendation; not approved)

1. **Matcher rulings (cycle-4 Q1, with cycle-3 flag 1).** In one sitting:
   - (a) May the matcher count, not publish, a same-instant sell on 00:00:00Z stamps when the pair shows evidence that
     it may not be a long close (F-30)?
   - (b) May it taint the next `k` units bought after a `k`-unit oversell (F-28)?
   - May transfers become share moves (F-22, draft)?

   **Recommendation: yes to (a) as narrowed, yes to (b), and yes to F-22 with its basis rule.** The trade-off in (a): a
   same-day short with no evidence still publishes, because counting every same-day round trip would let traders hide
   losing day trades at will. F-28 and F-30 stay blocked until you answer.
2. **Rebase first (cycle-4 Q6).** `claude/fix-truthful-labels` holds F3-2, F-11 and fix #1, and blocks F-29 and F-23 (and
   F-21, now draft). **Recommendation: yes.** Give it the next build slot for a rebase before a new F-file build starts.
3. **Gate opening for options (with Q3).** **Recommendation:** add to the gate-opening checklist that `optionsPublic()`
   does not open publicly until a trader-only "not asked yet" view, or a wording true in both cases, exists. Part (c)
   stays on the trader's own view only, because a public difference would publish a privacy choice (LG veto).
4. **Readout facts (MRC2-3).** **Recommendation:** name which source of truth says the address cap is live. Whether
   filer views count toward G3 stays your call; F-31 only shows them apart.
5. **F-23 consent words.** The fee probe will state the smallest position size that one-decimal output still reveals.
   **Recommendation:** have the legal committee decide whether `lib/copy.ts:80`/`:82` needs a caveat.
6. **Live billing (C4-41, not approved).** **Recommendation:** add a blocking line to the live-billing checklist: the
   configured price equals `PLANS` in amount, currency and interval, with a fake-processor test, before any
   `LIVE_BILLING=on`.
7. **Switch-on checklist (cycle-4 Q2).** **Recommendation:** add C4-28 (no symbol term for filers, with a test), C4-29
   ("before fees" beside public figures) and C4-27 to the F-7 checklist. Legal adds the first-visit line "Verified
   trades, straight from the broker" (`lib/copy.ts:362`), which becomes false once filer profiles are in the feed (D27,
   already with you).
8. **Cap reading.** Re-approvals of lapsed features are counted as not new (F-23), and build slots are counted (four), as
   in cycle 3. `team/approval-council.md` is protected, so you may confirm or correct this reading.
9. **Still open from earlier cycles, not re-asked:**
   - F-22's rule amendment (item 1 above; cycle-3 flag 1);
   - K18's age-assurance method (F-16 builds no date of birth, ID or age estimation);
   - whether the contrast floors sit in a protected file (cycle-3 flag 7);
   - C3-9b, vendor corrections in an append-only revisions table (cycle-3 Q3; recommend yes, read as "never updated in
     place");
   - the seven cycle-4 owner questions Q1-Q7 (`docs/direction/cycle4-2026-11-01.md` §7), of which Q1, Q2, Q3 and Q6 are
     above, Q4 is the SW-1 desktop hint, Q5 is F-13's bounce measure and Q7 is four protected-path merges;
   - cycle-3 Q1-Q10, OD-6, OD-9, BC-16, MRC2-3, C16/K17, D27 wording, and decisions-and-authority Q1-Q14.

## Fixes found during the vote (for the fixes list; no vote)

- **Stale `Blocked:` lines.** F-16, F-17, F-20 and F-24 still name prerequisites that merged (#65, #64, #71). The
  decisions keeper asks F4-21 (process docs and F-14's status) to refresh them. No decision changes.
- **Oversell cause line.** `lib/copy.ts:70` ("no matching entry in the imported history") is untrue for a counted short.
  It is cycle 3's oversell-copy item, still unbuilt, and must read "a short sale or earlier history" whatever Q1 brings.
- **SW-1 "Back returns to the same card"** (K16 remainder). It goes on the fixes list if it reproduces.
- **C4-34 (b, c).** The hint's arrow glyph is spoken, and the Demo sentence repeats the badge word
  (`lib/copy.ts:365-366`). These go to the a11y fixes lane.

## Known limits of this record

- Members read the code and the records; no app was run for this vote. Vendor behaviour is unverified, as in the cycle-4
  audit (§9): which brokerages send date-only stamps, and how those are stamped.
- `claude/fixes-cycle4` was not pushed during the council, so overlaps with F4 fixes were checked against the fix
  descriptions in the audit's §5, not their code.
- Round 3's speaker rule broke ties at the cut by roster order, so earlier roster members spoke on more items. Every
  member saw every argument before changing scores.
- The members' replies were relayed as compact `SCORES:`/`VOTES:` lines. The chair cross-checked each against the
  member's ballot file by script (Appendix B).
- Each member kept its own context across rounds (one agent per member, continued by message), so a member's later
  rounds could see its own earlier reasoning, as intended. No member saw another member's work except through the
  shared files the chair named.
- The re-approved F-23 keeps every earlier condition. Where a new condition sharpens an old one, both are in the file.

## Appendix A: the ballot, round 0 and the chair's rulings

### State at e6731d5 (round 0 helper)
- All 21 C4 problems still exist on main. Outside `docs/`, dec669d and e6731d5 are identical, so every audit citation
  holds. One line moved on the labels branch: C4-27's /how section is at `:29-32` there.
- `claude/fixes-cycle4` does not exist on the remote, and the only open PR is #77.
- No brief duplicates an F4 fix or an in-flight branch's work. The audit's splits are complementary: C4-4 and F4-11,
  C4-13 and F4-9, C4-8 and the withdrawn F4-3. `scripts/f15-readout.ts` is edited by F4-11, F4-12, C4-4, C4-31, C4-33
  and C4-37.
- Bring-backs:
  - F3-3 merged in #79, and `users.sync_failure_kind` is at `db/schema.sql:467` (cited as :458), so C3-16's literal
    condition is met.
  - C3-38's condition is met (#62 merged), and its purge delete is now at `lib/privacy-purge.ts:355`.
  - C3-39 and C3-44 were built in #76, and C3-34 in #76 and #78.
  - K16 is met in code: fix #14 in #71, fix #17 on main since #55 under the cycle-1 label "A11Y-FIXES #18", fixes #15
    and #16 in #60, and F-13 in #55.
  - K19 is unmet: fix #1 is only on the labels branch.
  - F3-2 is only on `claude/fix-truthful-labels` (`lib/pane-evidence.ts`).
  - Nothing answers F-22's flag 1.
- Lapses: F-9 (#65), F-14 (#64) and fix #26 with #12 and #13 (#71) merged, so F-16, F-17, F-24 and F-20 do not lapse.
  F-21, F-22 and F-23 lapse.

### The draft ballot
- **A. Cycle-4 briefs (21):** C4-2, C4-1, C4-4, C4-31, C4-26, C4-27, C4-28, C4-29, C4-33, C4-32, C4-36, C4-34, C4-41,
  C4-37, C4-38, C4-35, C4-40, C4-39/13h, C4-42, C4-43, C4-8.
- **B. Waiting or routed from cycle 3:** C3-37, C3-34, C3-39/40, C3-15, L-18, C3-16, L-19s, C3-38, C3-42, C3-43, C3-35,
  C3-3, and K19, K16, K15, K11, K21, KV.
- **C. Cycle-3 approvals that lapse:** L-21, L-22, L-23.

### Round 0 verdicts (decisions keeper, legal, common sense)
- **Legal:**
  - Nothing breaks POLICY as scoped, and nothing duplicates F4-1..F4-22.
  - C4-26 (c) with a public difference would publish a privacy choice (veto).
  - Needs the legal committee: C4-26 (a, b) words, C4-8 and C4-29.
  - Owner-only parts: C4-4's filer counting (MRC2-3), C4-34 (a) (Q4) and C4-40 (Q7).
  - C3-37 is not ballotable (a new stored behavioural field).
- **Decisions keeper:**
  - R-1: readout items add partial rows only (F-15:40-43).
  - R-2: a vote may amend a committee or orchestrator ruling; owner decisions and protected files are
    owner-conditional.
  - C4-2 amends `lib/trades.ts:46`, and C4-1 reverses part of F3-5 (committee:40-45).
  - C4-4 is reshaped to partial rows; C4-36 to no profile control and no glossary; C4-37 carries the lot veto.
  - C4-38, C4-39, C4-42 and C4-43 are chores, and C4-8 goes to the committees.
  - L-21, L-22 and L-23 are re-voted under cycle-3 ruling 3.
- **Common sense:**
  - Priority goes to anything false on screen today and anything that could publish a wrong Verified figure.
  - C4-33, C4-38, C4-41 and C4-37 are premature, and C4-40, C4-39/13h, C4-42 and C4-43 are chores.
  - Three new active slots at most (V5).
  - Re-approve L-21 and L-23 only if they can start; otherwise they go to draft.

### Chair's rulings
1. Routed off the ballot as listed under "Routed in round 0".
2. Merged and reshaped:
   - C4-4 and C4-31 merged as **C4-4/31** (partial rows plus the limits block).
   - C4-26 is reduced to parts (a) and (b), as **C4-26ab**; part (c) goes to Q3.
   - C4-34 is reduced to parts (b) and (c), as **C4-34bc**; part (a) goes to Q4.
   - C4-36, C4-37, C4-1 and C4-2 are reshaped as the decisions keeper ruled.
   - C3-16 becomes a trader-only slice; C3-38 is counts only, inside the purge transaction.
3. Lapsed approvals are re-voted (cycle-3 ruling 3). A re-approval keeps its F-number, file and every earlier decision
   word for word, and adds dated decisions and a new lapse clause. A lapsed item not re-approved goes to `Status: draft`
   with a dated lapse decision.
4. Cap reading as in Result (Flags 8).
5. Round 3 notes as in Process.

## Appendix B: every ballot

All 15 members' statements, by round, verbatim:
- round 0 statements and the evidence check;
- round 1 ballots;
- round 3 arguments and score changes;
- round 4 ballots;
- the red team's case and the round 5 ballots.

They are in [approval-2026-11-01-cycle4-ballots.md](approval-2026-11-01-cycle4-ballots.md).
