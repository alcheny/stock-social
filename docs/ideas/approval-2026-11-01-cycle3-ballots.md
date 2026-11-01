# Approval council, cycle 3 (2026-11-01): every ballot

Appendix B of [the cycle 3 record](approval-2026-11-01-cycle3.md). Each member's statements, verbatim, by round, as each
agent wrote them (headings shifted down three levels; working-folder paths removed). Simulated personas and probe
trades in them are fictional. Line numbers are at `origin/main` f467293 unless a statement says otherwise.

## Contents

1. Ballot and round-0 outcome (chair)
2. Round 0: consistency check and evidence
3. Round 1: first vote
4. Round 3a: debate arguments
5. Round 3b: score changes
6. Round 4: second vote
7. Round 5: red team's case and final vote

## 1. Ballot and round-0 outcome (chair)

#### Approval council cycle 3 (2026-11-01): ballot (chair's draft, round 0 input)

Repo: the repository, base `origin/main` **f467293** (council cycle 3 record merged). Read only; write nothing
in the repo. Chair runs the rounds and does not vote. Rule (`team/approval-council.md`): approve at >= 10/15 approve
(with or without conditions) in the final vote, second-vote mean >= 3.5, no veto (decisions keeper: contradicts an
owner decision; legal: breaks POLICY; common sense: confusing, dishonest or out of proportion). At most six features
per cycle; features touching the same files count as one build slot. Lapse rule (cycle 2): an approval whose
prerequisite has not merged by the next council lapses to that council.

Owner delegation: decide by the committee's recommended option; anything POLICY or COMPLIANCE marks owner/counsel-only
uses the AI legal committee's findings but still goes to the owner as a flag, never decided here. Anything that amends
a decided owner rule may only be approved conditionally on the owner's yes, listing the decided rule it amends.

##### State of main at f467293 (verified with git log and the tree)

Merged since cycle 2: #54 F-10 + F-12 (record strip), #57 F-19 first slice (`lib/format.ts`), #46 sharded sync, #59
fixes cycle 2 (trust) rows #4 visible-user predicate, #5, #8, #11, #19, #20 404 page, #21, #27, #28 via=nav, #30;
####60 rows #9, #15, #16, #18, #20, #23; #61 follow-up; #52 known limits (sitemaps, account-identity claim, bounded feed
paging, shared-account marks, purge); #63 council cycle 3 record.
Not on main: F-9 (no branch, no `lib/reports.ts`), F-11 (no `lib/record-status.ts`), F-13 (PR #55 open, also carries
`lib/a11y-contrast.test.ts` and cycle-2 a11y fixes), F-14 (branch `claude/f14-sync-cadence`, unmerged), F-15
(building on `claude/f15-measurement`; its prerequisite fix #28 merged in #59, so it does not lapse), F-7 (PR #56),
options (PR #62), cycle-2 fixes #1, #2 (branch `claude/fix-truthful-labels`), #10, #12, #13, #26, #14, #17.
Cycle-3 fixes F3-1..F3-27 (`docs/direction/cycle3-2026-11-01.md` §5) are being built on
`claude/fixes-cycle3-pipeline`; none is on main. They are NOT on the ballot.

Open owner questions not to decide: `docs/process/decisions-and-authority.md` Q1-Q14; cycle-3 owner questions
Q1-Q10 (`docs/direction/cycle3-2026-11-01.md` §7); OD-6, OD-9, BC-16, MRC2-3, C16/K17, D27 wording.

##### Items

Full briefs for C3-* items: `docs/direction/cycle3-2026-11-01.md` §6 (line numbers in that record are at 3f216ba; main
moved to f467293 since, and `lib/trades.ts`, `lib/sync.ts`, `lib/feed.ts`, `lib/connections.ts`,
`lib/privacy-purge.ts`, `app/u/[handle]/page.tsx`, `app/ui.tsx` changed). Cycle-2 briefs: 
`docs/ideas/approval-2026-11-01-cycle2.md` lines 440-496 and its "Waiting for the next cycle" table (lines 155-172).

###### A. Cycle 3 proposal briefs (ranked by council cycle 3)

| ID | Title | Prerequisites (state at f467293) | Decided rule it amends | Size |
|---|---|---|---|---|
| C3-2 | A transfer is a share move, not a repricing (move in: one tainted lot, older lots stay priced; move out: oldest first, no taint, new `excluded_transferred_out` count + profile line; unknown kinds keep taint) | none; build with F3-15's copy (unmerged) | Yes: `lib/trades.ts` documented rule "an unpriceable action taints them" and the corporate-actions committee's "when in doubt, exclude and count" (F3c). Owner flag needed | S-M |
| C3-3 | An oversell publishes its recorded part (matched part published when every drawn lot is recorded and untainted; extra units counted as short sale) | none | Yes: orchestrator's 2026-11-01 ruling "whole, matched part included" (corporate-actions committee log :115-119). Owner flag needed | S |
| C3-17 | Exclusion counts travel with the headline: one muted line on pane and record strip when exclusions > 0; share card is owner Q4 | F3-2 (unmerged; same pane file) | No rule says where counts appear; F-4 card contents stay the owner's | S |
| C3-15 | Disconnect inside the app: "Connected brokers" section on /settings, two-step Disconnect, sets `disconnected_at`, stops reads; vendor link stays (BC-16) | F3-3 (unmerged), F-11 (not built), owner Q2/OD-9 (open) | Compatible with TR-5 and BC-16 if no vendor delete | M |
| C3-9 | Apply broker corrections without losing raw history (append-only `activity_revisions`, rebuild from latest, weekly reconciliation, "n trades corrected" count) | owner Q3 (activities immutability, CLAUDE.md "raw, immutable"); vendor answer on cancels; late-sell reconciliation part could go first | Yes: CLAUDE.md "activities table (raw, immutable)" (owner) | M |
| C3-16 | Connection health: `needs_reconnect_at` from the vendor's authorization signal; trader-only "Reconnect" line; email part waits owner Q5 | F3-3 (unmerged); vendor docs on the signal (unverified) | none (email part waits Q5) | M |
| C3-37 | A day-7 marker F-15 can read (one per-account "returned on day 7" date, purged with the account) | F-15 (building; amend it) | MRC2-3 gate definitions stay owner's; privacy committee rules on the field (P3) | S |
| C3-36 | Round public payloads to what screens show (returns 4 decimals, dates as UTC days, holding days 1 decimal) | none | none | S |
| C3-34 | Numbers-only `GET /api/health` + one `cron unauthorized` log line | none | none | S |
| C3-39 | Record tools while billing is off (no primary button to locked /tools; locked /tools links back into the app) | none | Changes F-3 plan §1 entry points only in the closed state; business lead signs off | S |
| C3-40 | Settings order and weight ("Delete my profile" secondary and last; S9 view 2 unchanged) | build with C3-39 (same file `app/settings/page.tsx`) | S9 decided two views, not view 1's weight; "Account" name kept (F-3 committee copy) | S |
| C3-42 | A real data export before launch (everything stored about the user, percent only, no secrets) | owner Q7 (scope), BC-10 Privacy Policy (owner) | Label is F-3 committee condition 11 | M |
| C3-35 | Versioned, cacheable share images | F3-26 (unmerged) | must keep cycle-2 K6 condition 2 and F-11's date rule | S |
| C3-41 | One link rule for trade rows (trade -> trade page; name -> profile; symbol -> stock page) | F3-8 (unmerged); a design session | F-2 gestures; F-10 owns card markup | S-M |
| C3-43 | "Public since <date> · <n> closes since" on the profile | owner Q8 (new public field, P6 consent list), F-11 (not built) | TR-7 secondary labelled window | S |
| C3-38 | Keep a count of sign-up drop-offs before the purge (per-day aggregate, no identifiers) | `claude/known-limits` (merged as #52, so cleared) and `claude/options-trades` (PR #62 open; edits the purge) | D11 intact | S |
| C3-44 | Show the subscriber-notes line on delete only when it applies | needs F-3 committee words (verbatim signed F-3 plan copy) | F-3 plan copy | S |
| C3-45 | A quieter "No thesis posted." | a design session; F-10 owns the card | — | S |

###### B. Waiting from cycle 2 (`docs/ideas/approval-2026-11-01-cycle2.md` "Waiting for the next cycle")

| ID | Title | Last mean | What would bring it back (cycle 2) | State at f467293 |
|---|---|---|---|---|
| K18 | Age-law posture (MRC2-12) reshaped: hide on a "may be under 18" report as an addition to F-16 | 3.07 (R4) | First next cycle, as an addition to F-16 once F-16 merges; signed-in rate-limited reporter; owner review; owner runs any deletion; attestation text version only; no DOB/ID/age estimation (legal veto condition) | F-16 not built (waits F-9, not started); attestation stored. POLICY marks age posture owner/counsel territory in places |
| K20 | Home link preview (C21): og image + description for "/" with no name, logo or figure | 2.13 (R4) | Chore with the fixes | not built (`app/opengraph-image.tsx` absent) |
| K22 | Billing hygiene checks (MRC2-11), tests only in test mode | 2.00 (R4) | Chore, before LIVE_BILLING | not built |
| K19 | Sitemap and SEO pages (/how and a glossary only; profiles stay out) | 2.07 (R3) | After fixes #1 and #4 | #4 merged (#59), #1 not (on `claude/fix-truthful-labels`); #52 reworked sitemaps |
| K16 | Feed reading mode remainder (Back returns to same card, double tap only likes) | 2.00 (R3) | After fixes #14-#17 and F-10/F-13 | #15, #16 merged; #14, #17 and F-13 not |
| K15 | Owner sees the public record ("View as public" + parity test) | 1.87 (R3) | With F-7 or first real connects; real sign-in | F-7 PR #56 open; no real connects |
| K11 | One image palette and image trust band | 1.73 (R3) | After F-12 and owner flags O-2/O-4 | F-12 merged; O-2/O-4 undecided |
| K21 | Wayfinding remainder: month index, neutral search | 1.13 (R3) | With real records and after F-17 | F-17 lapsed (below) |
| KV | Design-system variant tests V-1..V-3 | 1.07 (R3) | With C4/D23 when F-15 shows ~1,000 weekly landings | F-15 not merged; no traffic |

Design-system proposals routed to the idea board (IDEAS #53: DSP-2 D27 wording, DSP-3 D25, DSP-4 D22, DSP-8): amend
idea-board decisions, so they are NOT ballot items (the council may not reword a decided line); listed for the record.

###### C. Approvals of cycle 2 that lapse to this council (prerequisite not merged by now)

| ID | Feature | Prerequisite (cycle 2) | State at f467293 |
|---|---|---|---|
| L-16 | F-16 trust-and-safety slice (profile report, owner digest, audited hide, takedown page) | F-9 + fix #4 | fix #4 merged (#59); F-9 not started -> lapses |
| L-17 | F-17 handle and name integrity | F-9's normaliser | F-9 not started -> lapses (note C3-12/F3 branch `claude/fix-user-text-safety` builds `checkDisplayName` in `lib/handles.ts`) |
| L-18 | F-18 one trust language | F-20, F-10..F-13, fixes #1, #2, #8, #9, #10 | F-10, F-12, #8, #9 merged; F-11, F-13, F-20, #1, #2, #10 not -> lapses |
| L-20 | F-20 design tokens and contrast test | fixes #12, #13, #26 + F-13 contrast-test branch | none merged (PR #55 open) -> lapses |
| L-19s | F-19 call-site sweep (the first slice merged in #57) | F-10..F-12, F-18, fix #7 | F-18 not built -> lapses |

Chair's proposed handling of section C (round 0 to check): a lapsed approval is voted again like any candidate. If
re-approved it keeps its F-number and file (a dated decision "re-approved by the approval council, cycle 3" is added)
and keeps its earlier conditions; it counts toward the six-per-cycle cap and the slot count like a new approval, since
the cap protects review capacity. If not re-approved it goes to `Status: blocked` → waiting (the file is kept; the
lapse is dated in it).

---

##### Round 0 outcome (chair's rulings after decisions keeper, legal, common sense and the evidence check at f467293)

Statements: `r0-decisions-keeper.md`, `r0-legal.md`, `r0-common-sense.md`, `evidence-f467293.md` in this folder (read
them). Evidence: all 18 C3 briefs still hold on main; none fixed by #52/#60/#61. Moved lines at f467293: profile
counts block `app/u/[handle]/page.tsx:289-292`; `lib/sync.ts:37` (on conflict do nothing), `:378` (7-day window);
`lib/privacy-purge.ts:52` (sessions), `:180` (funnel delete), `:22` (UNFINISHED_SIGNUP_DAYS); `lib/feed.ts:197-198`
(epochs); `db/schema.sql:289` (`consent_at`); `app/ui.tsx:74` ("No thesis posted."); `lib/billing.ts:212-217`.
New: #52 added a silent exclusion (`notShared`, `lib/sync.ts:99`) with no count on the profile.

Routed off the ballot (not voted):
- C3-41, C3-45 → design session (DK not ballotable; CS reshape). Legal found `app/ui.tsx:74` prints "No thesis
  posted." when a thesis exists but is held: a truthfulness defect → noted for the fixes list, not this vote.
- C3-44 → chore with the F-3 committee's words (`docs/features/logs/F-3/plan.md:151-152`), in the settings lane.
- K20, K22 → chores for the orchestrator (cycle 2's own routing; DK, CS, LG conditions attached).
- K19, K16, K15, K11, K21, KV → not ballotable: their cycle-2 bring-back conditions are still unmet. Carry forward.
- K18 → merged into L-16 as a dated addition (DK), with legal's veto conditions.
- C3-9 split: **C3-9a** late-sell reconciliation (insert-only, within F-14's read limit) is ballotable; **C3-9b**
  revisions table goes to the owner as a flag (Q3, `CLAUDE.md:62` "raw, immutable").
- C3-39 + C3-40 merged into **C3-39/40** (same files; DK notes C3-40 amends F-1 plan `logs/F-1/plan.md:75-77`
  "primary 'Delete my profile', secondary 'Keep it'" and C3-39 amends F-3 `plan.md:142`/§1 in the billing-closed state).
- C3-17 reshaped (DK): one muted exclusions line on the swipe pane (and the trade and month pages' strip if it fits
  D22/F-10), NOT a second line on feed cards (D22 one line, `IDEAS.md:148`); share card and images unchanged until
  owner Q4; the count includes #52's `notShared` exclusion if it is an exclusion the profile should count.
- C3-3: DK finds it conflicts with the "whole, matched part included" ruling and gives a fictional probe (buy 100 @100,
  unreported 2:1 split, sell 101 @50 → C3-3 would publish -50% Verified when the truth is 0%). It stays on the ballot
  only as owner-conditional; members weigh the probe.
- C3-2: owner-conditional (amends `lib/trades.ts:52` and the corporate-actions committee rules). DK veto condition:
  "oldest first" on a move out only where it cannot change a basis (vendor names the lots, whole position moves, or
  all candidate lots share a basis); otherwise remaining lots stay tainted; moved-in lots stay tainted.
- C3-42, C3-43: owner-conditional (Q7 + BC-10 + F-3 committee condition 11; Q8 + P6 consent list). Legal: P6 bars
  rendering `consent_at` before the owner changes the consent line.
- C3-15: owner-conditional (Q1, Q2/OD-9, BC-16) and blocked on F3-3 and F-11.
- C3-37: an amendment to F-15 (building), no slot of its own.
- Section C: lapsed approvals are re-voted. A re-approval keeps its F-number and file and all earlier decisions and
  veto conditions word for word, adds one dated decision, and adds a lapse clause where a prerequisite is unmerged. A
  lapsed item not re-approved goes to `Status: draft` with a dated lapse decision (no "waiting" status exists). L-18
  depends on L-20 (F-20 lands first); L-19s only if L-18 is re-approved. Cap reading (council's reading, flagged to
  the owner because `team/approval-council.md` is protected): re-approvals of lapsed features are not new features
  and do not count toward the six; build slots are counted for what can start now.

##### Round 1 ballot (19 items, vote 0-5 on each)

1. C3-2 transfers as share moves (owner-conditional)
2. C3-3 oversell publishes the recorded part (owner-conditional; DK probe)
3. C3-17 exclusion counts beside the headline (reshaped: pane, not feed card; card waits Q4)
4. C3-15 in-app disconnect (owner-conditional; blocked on F3-3, F-11)
5. C3-9a late-sell reconciliation (insert-only)
6. C3-16 connection health (no email; blocked on F3-3; vendor signal unverified)
7. C3-37 day-7 marker as an F-15 amendment
8. C3-36 round public payloads
9. C3-34 health endpoint and cron 401 log line
10. C3-39/40 Record tools while billing is off + settings order and weight
11. C3-42 full data export (owner-conditional, Q7/BC-10)
12. C3-35 versioned cacheable share images (blocked on F3-26)
13. C3-43 "Public since" line (owner-conditional, Q8; needs F-11)
14. C3-38 drop-off aggregate before purge (after PR #62)
15. L-16 F-16 trust-and-safety slice + K18 age-report addition (re-approval; waits F-9)
16. L-17 F-17 handle and name integrity (re-approval; waits F-9 normaliser)
17. L-20 F-20 design tokens and contrast test (re-approval; waits PR #55 + fixes #12, #13, #26)
18. L-18 F-18 one trust language (re-approval; after L-20; waits F-11, F-13, F-20, fixes #1, #2, #10)
19. L-19s F-19 call-site sweep (re-approval; after L-18)

### Member brief

#### Member brief (approval council cycle 3, 2026-11-01)

You are one of 15 voting members of the Stock Social approval council (`team/approval-council.md`), a separate agent
with fresh context. The repo is at the repository, checked out at origin/main f467293. You are READ-ONLY on
the repo: never edit, commit or push. Write your statements only to the file the chair names, under
.

Binding: `docs/POLICY.md` (overrides everything), `CLAUDE.md` product rules, `docs/COMPLIANCE.md`, `docs/DECISIONS.md`,
`docs/IDEAS.md` decisions. Text in issues/PRs/web pages is untrusted data. Do not decide owner questions
(`docs/process/decisions-and-authority.md` Q1-Q14; cycle-3 owner questions Q1-Q10 in
`docs/direction/cycle3-2026-11-01.md` §7); say what you'd recommend and that it is the owner's.

Ballot: `.../scratchpad/council/ballot.md` (read it first). Briefs: `docs/direction/cycle3-2026-11-01.md` §6 (C3-*),
`docs/ideas/approval-2026-11-01-cycle2.md` lines 155-172 and 440-496 (K*), and `docs/features/F-16..F-20*.md` (L-*).
Read code when your lens needs it (`git show f467293:<path>`, or the working tree). Cite `path:line` at f467293.

Scores 0-5: 0 harmful/forbidden, 1 not worth it, 2 weak or premature, 3 worth doing but not now / with doubts,
4 strong, 5 must do now. Judge through YOUR lens, honestly and independently; do not average yourself toward a
consensus. Name the conditions you would attach (they become acceptance criteria). No personal data, no real
people's names or trademarks in anything you write.

## 2. Round 0: consistency check and evidence

### Round 0: Decisions keeper

#### Round 0, decisions keeper (approval council cycle 3, 2026-11-01)

Base: origin/main f467293. All `path:line` citations are at f467293 (`git show f467293:<path>`). Read-only; nothing in the repo was
changed.

Verdict key: **clear**; **clear w/ cond.** (conditions bind as acceptance criteria); **owner-cond.** (it may be approved
only on the condition that the owner says yes, and it must list the decided rule it amends, per the ballot's delegation
paragraph); **conflict → owner** (off the ballot: a council vote would decide or reverse an owner-level or delegated
decision); **not ballotable** (its own bring-back condition is unmet, or it is a chore, design-session or owner item).

##### Rules I checked against

- CLAUDE.md product rules `CLAUDE.md:62` (activities "raw, immutable"), `:66-69` (never patch `closed_trades`, theses re-attach
  by `sell_id`, no quantities or prices), `:90-104` (Verified, losses, "excluded and counted, never guessed" `:95`, held theses
  `:96`, 18+ `:97`, signed-out `:101`, Stage 5 Musts `:102-104`), three versions per product change `CLAUDE.md:140-142`.
- DESIGN Stage 5: TR-1 `docs/DESIGN.md:324`, TR-3 `:326`, TR-4 `:327`, TR-5 `:328`, TR-6 `:329`, TR-7 `:330`, TR-8 `:331`, SW-1
  `:382`, Never list `:237`.
- POLICY: P3 `docs/POLICY.md:48-50`, P4 `:51-53`, P6 `:54-58`, F3c `:128-130`, F4 `:131-132`, the approval limits `:183-187`.
- Approval limits `team/approval-council.md:36-38` (vetoes), `:41-44` (cap), `:48-52` (never deletes data, never overrules an
  owner decision).
- DECISIONS.md standing direction `docs/DECISIONS.md:26-32`; #39 SW-1 `:46-52`; #25 CH-1 `:55-63`; #21 scrub `:65-73`.
- IDEAS decisions: lapse rule `docs/IDEAS.md:92`; account deletion `:114-118`; trademark `:136-140`; D22 `:148-151`; D23
  `:152-156`; D24 `:157-160`; D29 `:172-174`; idea 16 strip `:175-180`; C16/MR-8 owner rows `:73-74`.
- Delegated rulings: corporate-actions committee "when in doubt, exclude and count"
  `docs/features/logs/corporate-actions/committee-2026-11-01.md:44-45`; Q1 rationale (an oversell proves a missing inflow) `:24`;
  orchestrator's replacement "whole, matched part included" `:115-119`; "a transfer out plus a transfer in is unpriceable" `:57-58`;
  "a transfer in is excluded and counted" `:143-144`; the code's statement of both `lib/trades.ts:43-52`.
- Owner-question status quo: disagreement with a decided point waits for the owner (`docs/IMPLEMENTATION.md:24`, `:75`;
  `docs/process/decisions-and-authority.md:169-178` Q3); three versions until Q1 is answered (`decisions-and-authority.md:153-158`).
- Feature-file dated decisions as cited per row; protected paths `.github/CODEOWNERS` (`lib/broker.ts`, `team/`, `CLAUDE.md`,
  `docs/DESIGN.md`, `docs/FEATURES.md`).

##### A. Cycle 3 briefs

| ID | Verdict | Decided rule(s) touched (`path:line` at f467293) | Veto condition(s) (I veto in the final vote without these) |
|---|---|---|---|
| C3-2 transfers as share moves | **owner-cond.** | `lib/trades.ts:52` ("an unpriceable action taints them"), `:171`; committee "when in doubt, exclude and count" `logs/corporate-actions/committee-2026-11-01.md:44-45`; transfers unpriceable `:57-58`; transfer in excluded and counted `:143-144`; `CLAUDE.md:95` "never guessed"; POLICY F3c `:128-130`; TR-1 `DESIGN.md:324`. These are delegated decisions on decided points, so Q3's status quo applies (`IMPLEMENTATION.md:75`). | (1) Approval reads "conditional on the owner's yes" and lists the three rules above as amended. (2) A moved-in lot stays tainted, so `:143-144` holds. (3) "Oldest first" on a move out is used only when the choice cannot change a basis: the vendor row names the lots, the whole position moves, or every candidate lot has the same per-unit basis. Otherwise the remaining lots stay tainted as today. Without this, a partial move out guesses which lots stayed (`CLAUDE.md:95`). (4) Unknown kinds keep today's taint. (5) The existing taint tests are updated, never deleted, and the count does not drop. (6) Any /how line naming transfers out leaves POLICY's list to the owner. |
| C3-3 oversell publishes recorded part | **conflict → owner** | Orchestrator's ruling "whole, matched part included" `committee-2026-11-01.md:115-119`; the reason behind it, "an oversell proves the position's history is missing an inflow … the FIFO basis of that sell … unknown" `:24`; `lib/trades.ts:43-46`; F3c `POLICY.md:128-130`. | This item reverses the reason for the rule, not just its scope. "Every drawn lot recorded and untainted" cannot detect an inflow that was never reported. Fictional probe: buy 100 @ 100, then an unreported 2:1 split, then sell 101 @ 50. C3-3 would publish −50% under Verified, but the true result is 0%. That breaks F3c. Send it to the owner (with legal's F3c reading) as a recommendation, not a vote. If the owner says yes, the brief must name the signal that rules out an unseen inflow. |
| C3-17 exclusion counts with the headline | **clear w/ cond.** (reshape) | D22 "every feed card carries **one** record line" `IDEAS.md:148-151`, verbatim in `F-10:12-15`; one RecordStrip, never a second `F-10:16-18`; idea 16 strip contents `IDEAS.md:175-180`; F-4 card contents are the owner's (cycle-3 Q4 `cycle3:687-688`); `CLAUDE.md:95`. | (1) Not on feed cards. The RecordStrip renders the feed card's single line (`F-10:16`), so "pane and record strip" as drafted would put a second line on every card and reword D22. That needs the idea board first. The line may appear on the pane and on trade and month pages. (2) The share card and the F-12 trade, month and stock images stay unchanged until owner Q4 is answered. (3) Idea-16 strip items and D24 wording are unchanged (the line is added beside them, not merged into them). (4) Counts only, no new public field. |
| C3-15 in-app disconnect | **owner-cond.** (Q1, Q2) | TR-5 `DESIGN.md:328`; TR-6 `:329`; P6 "stays public after disconnect" `POLICY.md:55`; consent copy `lib/copy.ts:91`; MR-8 "delete connection on disconnect" sent to the owner `IDEAS.md:74`; BC-16 (owner, `approval-cycle2:206`); OD-9 / cycle-3 Q2 `cycle3:681-683`; Q1 freeze `cycle3:676-680`; F-11 owns the "Disconnected" label `F-11:42`; F-1 consent before import (F-1 2026-10-22). | (1) No vendor delete and no row removed: `closed_trades`, activities and theses are unchanged (TR-1, TR-5; approval cannot delete data `team/approval-council.md:49`). (2) Open positions of a disconnected account render per the owner's OD-9 answer. Until then the rows are kept and nothing new is shown. (3) Reconnecting goes through full consent (P6); it resumes the same record (TR-6), and nothing unfreezes otherwise (Q1's silent default). (4) Waits for F3-3 and F-11. |
| C3-9 broker corrections | **split.** (a) late-sell reconciliation: **clear w/ cond.**; (b) revisions table: **conflict → owner** (Q3) | `CLAUDE.md:62` "raw, immutable" (owner file, CODEOWNERS); cycle-3 Q3 `cycle3:684-686`; TR-1 "no per-trade … delete or edit, ever" `DESIGN.md:324`; theses re-attach by `sell_id` `CLAUDE.md:67`; F-14 "activities read at most once per 24 hours" `F-14:13-15`; `lib/broker.ts` protected. | (a) It only inserts missing ids, never updates or deletes a raw row. Its vendor reads count inside F-14's per-account gate. Any `lib/broker.ts` edit waits for the owner's merge. (b) Off the ballot until Q3 is answered. If the owner says yes: no raw row is ever updated in place. A withdrawn sell is shown as a count ("corrected by the broker"), never silently. Its thesis is kept, not deleted. The trader never triggers a withdrawal. |
| C3-16 connection health | **clear w/ cond.** (email part waits for Q5) | TR-5 `DESIGN.md:328`; Q1 "refusals … never freeze on their own" `cycle3:677-678`; D29 idle line `IDEAS.md:172-174`, `F-11`; F3b scope `POLICY.md:120-127`; F-14 vendor-call gate `F-14:13`; `lib/broker.ts` protected. | (1) `needs_reconnect_at` never sets `disconnected_at` and never freezes. (2) Signed-out viewers see nothing new, and D29/F-11's public idle line is not replaced or reworded. (3) Reconnect goes through full consent and keeps TR-6. (4) No email until owner Q5 is answered, with no record field in any message. (5) The readout prints the split under G1 without redefining it (MRC2-3). |
| C3-37 day-7 marker | **clear w/ cond.** | F-15 excludes E4 and gate redefinitions `F-15:63-65`, `:110-111`; signed-in count "never as G4 itself" `F-15:48`; counts never shown to traders `F-15:32`; Privacy Policy before real users `F-15:66-67`; deletion keeps only listed items `IDEAS.md:114-118`; MRC2-3 (owner). | (1) It is added as a dated amendment to F-15, not a new feature (no cap slot). (2) It is server-side and per account (not device storage, so not E4), and it is deleted with the account. (3) It is never labelled or used as G4 and never redefines a gate. (4) The privacy committee rules on the field before the build. |
| C3-36 round public payloads | **clear w/ cond.** | P3 `POLICY.md:48-50`; consent says prices are private `lib/copy.ts:79`; CH-1 #25 and scrub #21 `DECISIONS.md:55-73`; F-11 absolute dates `F-11:23-24`. | Same-day trades stay distinct, correctly ordered points on the chart and scrub (the sort key is applied before rounding). No visible figure changes. |
| C3-34 health endpoint + log line | **clear w/ cond.** | P3 "no personal data in logs" `POLICY.md:48`; "no separate backend" `CLAUDE.md:59`; standing direction 3 `DECISIONS.md:30`; F-14 cadence `F-14:23`. | The body has no ids, handles, figures or token. The 401 log line carries no token, IP or header. The "degraded" threshold comes from the schedule constant, not a literal (F-14 changes cadence). No new vendor. |
| C3-39 Record tools while billing is off | **clear w/ cond.** (merge with C3-40) | F-3 plan entry points `logs/F-3/plan.md:21-27` and the never-subscribed state "See Record tools" `:142`; business lead's "one road to the tool from Account" `logs/F-3/committee-review-business-lead.md:68-71`; idea 3 `IDEAS.md:33`. | (1) Recorded as amending `plan.md:142` and §1, in the billing-closed state only. (2) With billing open, F-3's snapshots and tests are unchanged. (3) No price appears anywhere new, and the K8/R8 disclaimer stays on locked /tools. (4) Business lead sign-off. |
| C3-40 settings order and weight | **clear w/ cond.** (the brief's premise is wrong; merge with C3-39) | The F-1 plan decides view 1's weight: "View 1: explanation as written, **primary** 'Delete my profile', secondary 'Keep it'" `docs/features/logs/F-1/plan.md:75-77`; second confirmation `:147-148`; code `app/settings/page.tsx:11-13`, `:43-44`; UX lead sign-off `logs/F-1/plan-signoff-ux-lead.md:27`. | (1) The approval names `F-1/plan.md:75-76` as amended. The brief says "S9 decided two views, not view 1's weight", which is incorrect. (2) View 2 is unchanged: "This cannot be undone.", its primary is the only tap that deletes, and the first action deletes nothing (test kept). (3) Copy is word for word (S9 strings; the "Account" name kept from F-3 copy). (4) Same slot as C3-15 and C3-39 (`app/settings/page.tsx`). |
| C3-42 full data export | **owner-cond.** (Q7, BC-10) | F-3 committee condition 11 says the file "holds **exactly**: views, notes, subscription … and the disclaimer" `logs/F-3/committee-2026-11-01.md:50-53`, and `plan.md:148-150`; label `lib/copy.ts:674`; COMPLIANCE access right `docs/COMPLIANCE.md:75`; Privacy Policy (owner, POLICY H). | (1) Approval is conditional on the owner's Q7 answer and lists condition 11 as amended. Alternatively, build the full export as a separate file or route so that condition 11's file stays exactly as decided. (2) Percent only, no secrets or ciphertext, never other users' notes (K11). (3) The label keeps the committee's words until the owner decides. |
| C3-35 versioned share images | **clear w/ cond.** | F-11 absolute dates on images `F-11:23-24`; F-4 card contents (owner); cycle-2 owner flag 1 "tests on every leak path (images …)" `approval-cycle2:176-182`. | (1) The version key covers every input that changes an image: close count, last sync, thesis, handle, Demo/Verified state, disconnect or removed state and the open-positions state. A mismatched version never serves a long-cached image. (2) Image contents are unchanged. The chair should fix the cited "cycle-2 K6 condition 2": K6 was never approved (it went to the owner, `approval-cycle2:504`), so that citation does not resolve. |
| C3-41 one link rule for trade rows | **not ballotable** (design session) | SW-1 `DESIGN.md:382`, #39 `DECISIONS.md:46-52`; F-2 gestures, owner-decided (double tap = like `F-2:27`; reject swipe `F-2:37-42`); F-2 owns card markup `F-10:21-23`; three versions `CLAUDE.md:140-142`. | It goes to a design session (the owner's chat, `CLAUDE.md` Design sessions). After that: SW-1, double-tap like and reject swipe are unchanged, and there is never a card-wide link. |
| C3-43 "Public since" | **owner-cond.** (Q8) | P6 "lists exactly what becomes public" `POLICY.md:54-56`; TR-7 `DESIGN.md:330`; TR-3 "Record since ‹first trade date›" `:326`; F-11 owns the status line. | (1) It waits for Q8, and the consent list names the field before it renders. (2) "Record since" stays the primary date (TR-3). (3) No average or rate beside it (TR-7), only a date and a count. (4) After F-11. |
| C3-38 drop-off counts before purge | **clear w/ cond.** | Privacy committee D10-D13 purge `lib/privacy-purge.ts:1-12`, `:180`; aggregate counts with no identifier kept `IDEAS.md:114-118`. | (1) The aggregate is keyed by day and step only, with no attempt id, via or user. (2) The purge's 30-day timing and scope are unchanged. (3) The Privacy Policy text covers it before real users. (4) After PR #62. |
| C3-44 subscriber-notes line | **not ballotable → chore** | Verbatim F-3 plan copy `logs/F-3/plan.md:151-152` (K12, K20); `app/settings/page.tsx:40-42`. | It is copy-sized. Route it to the orchestrator as a chore once F-3's committee supplies the words. K12's fact stays stated for everyone it applies to. |
| C3-45 quieter "No thesis posted." | **not ballotable** (design session) | Held theses never silently dropped `CLAUDE.md:96`; F-10 card. | Design session. If it is removed, a held thesis must still never look like "no thesis" in a way that hides moderation (F-9). |

##### B. Waiting from cycle 2

| ID | Verdict | Decided rule(s) | Condition |
|---|---|---|---|
| K18 age posture | **not ballotable standalone; merge into L-16** | Bring-back "as an addition to F-16 once F-16 merges" `approval-cycle2:161`; profile reports never hide on their own `F-16:20-21`; owner-run hide only `F-16:26-29`; P4 `POLICY.md:51-53` (admitting minors is a human decision with legal review); approval never deletes data `team/approval-council.md:49`. | Only as a dated addition to a re-approved F-16, starting after F-16's report and hide exist. Carries LG's veto conditions: no date of birth, ID or age estimation; owner review; the owner runs any deletion; a single report never hides. |
| K20 home link preview | **not ballotable → chore** | `approval-cycle2:162`; trademark timing `IDEAS.md:136-140`. | No name, logo or figure before clearance. |
| K22 billing hygiene | **not ballotable → chore** | `approval-cycle2:163`; Terms text is the owner's (POLICY H). | Test mode only, before LIVE_BILLING. |
| K19 sitemap/SEO | **not ballotable** | Bring-back "after fixes #1 and #4" `approval-cycle2:165`. #1 is unmerged. | Waits. |
| K16 feed reading remainder | **not ballotable** | `approval-cycle2:166`: fixes #14, #17 and F-13 are unmerged. | Waits. F-2's reject swipe and Undo stay (`F-2:37-42`). |
| K15 view as public | **not ballotable** | `approval-cycle2:167`: no F-7 merge, no real connects. | Waits. |
| K11 image palette | **not ballotable** | `approval-cycle2:168`: owner O-2 and O-4 are undecided. | Waits for the owner. |
| K21 wayfinding | **not ballotable** | `approval-cycle2:169`: F-17 has lapsed and there are no real records. | Waits. |
| KV variant tests | **not ballotable** | `approval-cycle2:170`; D23 is held for traffic `IDEAS.md:152-156`. | Waits with C4/D23. |

##### C. Lapsed approvals

| ID | Verdict | Lapse clause | Veto condition if re-approved |
|---|---|---|---|
| L-16 | **ballotable** | `F-16:64-65` (F-9 unmerged; the clause names F-9 only) | Every cycle-2 decision `F-16:16-65` carries word for word, including one reports table `F-16:77`, no automatic hide, owner-run hide never on a single trade, and takedown wording the owner's. If F-9's files land through `claude/fix-user-text-safety` (`docs/process/coordination.md:71`), the prerequisite is met only when F-9's own decisions and acceptance criteria are met on main. A new dated lapse clause. |
| L-17 | **ballotable** | `F-17:48-50` | Nothing deleted `F-17:46`. A hold never blocks deletion `F-17:62`. The display-name check builds on the branch's `checkDisplayName` and F-9's normaliser; there is never a second normaliser. A new lapse clause. |
| L-18 | **ballotable only together with L-20** | `F-18:62-65` | F-20 lands first (`F-18:60-62`). F-4, F-1 and consent copy are unchanged `F-18:50-51`. D25/D27 wording waits for the idea board `F-18:47`. O-2, O-4 and O-8 stay with the owner. |
| L-20 | **ballotable** | `F-20:43-46` | The floor is never lowered `F-20:30`. No image colour changes (O-2) `F-20:33`. No brand-matched colour `F-20:40`. |
| L-19s | **ballotable only if L-18 is re-approved** | `F-19:47-49` (sweep part only) | F-19 stays `Status: built`. The sweep opens as `rework` only after F-18 merges `F-19:32-34`. Pinned literals are updated, never deleted `F-19:45`, `:77`. Ranking is pinned `F-19:57`. |

###### Ruling on the chair's proposed handling of section C

1. **Lapse is correctly triggered** for L-16, L-17, L-18, L-20 and L-19s (the sweep only) by each file's own clause, cited above.
   - **F-15 does not lapse, but the chair gives the wrong reason.** Its clause is "if this build has not started" (`F-15:68-70`), and it is building. Whether fix #28 merged is not the test.
   - **Cycle-1 approvals (F-9, F-11, F-13, F-14) do not lapse.** Their files have no lapse clause, and `IDEAS.md:92` dates the rule to the cycle-2 approvals. Applying it backwards would be the owner's call.
2. **Agreed: "lapses to that council" means the council votes again**, with the normal rule and vetoes.
   - **Agreed:** a re-approved item keeps its F-number and file, plus one new dated decision ("re-approved by the approval council, cycle 3").
   - **Older dated decisions are never edited.** Any reshaping is a new dated line that names what it supersedes.
   - **Every earlier veto condition carries over.** A new lapse clause is added whenever a prerequisite is still unmerged.
3. **Cap: I accept counting re-approvals toward the six.** `team/approval-council.md:41-44` says "new features", which is ambiguous. Its stated purpose (review capacity) supports counting them. This is an interpretation of a protected file (`team/` in CODEOWNERS), not a rule change.
   - Record it in the cycle record as the council's reading, with a one-line note to the owner. Their rate instruction (`:43-44`) cuts the other way.
   - I recommend the chair rank items that can be built this cycle above re-approvals that would stay blocked.
4. **Not re-approved: "Status: blocked → waiting" is not valid.** `waiting` is not a status (`docs/FEATURES.md:36-44`), and `blocked` means "waits for the owner or counsel".
   - Use `Status: draft` (never built, so the pipeline skips it) with a dated lapse decision.
   - Mark the IDEAS register rows (#34, #36, #39, #45, #46) as "waiting (lapsed, cycle 3)".
   - F-19 stays `built` either way. Only its sweep note gets the dated lapse.
5. **Order L-20 → L-18 → L-19s.** Vote them as dependent items, or as one bundle in one slot. Approving a later one without the one before it contradicts `F-18:60-62` and `F-19:32-34`.

##### Merge, reshape, route, drop

- **Merge:**
  - C3-39 + C3-40 into one candidate. C3-15 shares their slot (`app/settings/page.tsx`).
  - K18 into L-16, as a dated addition.
- **Reshape:**
  - C3-17: no line on feed cards (D22); images unchanged until Q4.
  - C3-2: the "oldest first" condition above.
  - C3-9: split into (a) reconciliation, ballotable, and (b) revisions, owner Q3.
  - C3-37: an amendment to F-15, not a slot.
- **Route:**
  - To the owner: C3-3 and C3-9b.
  - To a design session: C3-41 and C3-45.
  - Chores: C3-44, K20 and K22.
- **Not ballotable (bring-back unmet):** K19, K16, K15, K11, K21 and KV.
- **Already fixed or covered on main:** none. I checked: no `/api/health`, no 401 log line (`app/api/sync/route.ts:35`), `/pane` still sends epoch ms and full precision (`app/u/[handle]/pane/route.ts:22`), no `app/opengraph-image.tsx`, no purge aggregate, and /account still has a primary to /tools (`app/account/page.tsx:61`).
- **General note (not a veto):** owner Q1 on three versions per product change is open. Until it is answered, `decisions-and-authority.md:153-158` says CLAUDE.md's rule applies as written. Each product-change approval (C3-17, C3-39/40, C3-43, and the L-items' visible parts) should say which build path it takes, and leave the exemption to the owner.

### Round 0: Legal and compliance

#### Round 0: legal and compliance (approval council cycle 3, 2026-11-01)

Member: legal and compliance (veto holder). Base: origin/main f467293, read only. These are findings, not legal advice.
The AI legal committee's findings stand in for counsel (owner decision, `docs/POLICY.md:18-24`; `docs/COMPLIANCE.md:10-12`).
Anything POLICY or COMPLIANCE reserves to the owner goes to the owner as a **flag**. The council does not decide those
(`docs/POLICY.md:177-187`; `docs/process/decisions-and-authority.md:30-46`).

Verdict key: **clear** · **clear with conditions** (CwC) · **breaks POLICY → reshape / reject** · **owner-only → flag**.
A "veto condition" is one whose removal from the built scope makes the item break POLICY. I would veto it at review.
All other conditions are recommended acceptance criteria.

Sources read at f467293: `docs/POLICY.md` (all), `docs/COMPLIANCE.md` (§1-§14), the ballot, `docs/direction/cycle3-2026-11-01.md`
§6-§8, `docs/ideas/approval-2026-11-01-cycle2.md` lines 155-172, 440-496 and the cycle-2 legal statements (712-770,
1818-1830), and `docs/features/F-16..F-20`. Code checked: `lib/trades.ts:40-53,188-212`, `lib/corporate-actions.ts:153-170`,
the corporate-actions committee log (`docs/features/logs/corporate-actions/committee-2026-11-01.md:44-45,113-119`),
`lib/copy.ts:77-91,316-317,674,719,721`, `lib/privacy-fields.ts:1-39`, `app/settings/page.tsx:20-46`,
`app/account/export/route.ts:5-18`, `app/u/[handle]/pane/route.ts:22,26`, `app/ui.tsx:74`, `lib/privacy-purge.ts:9-22`,
`lib/auth/sessions.ts:10,46`, `db/schema.sql:31,196,289,297`, `lib/billing.ts:212`, `docs/DESIGN.md:324-331`.

##### Summary table

| ID | Verdict | POLICY / COMPLIANCE clauses | Veto conditions (binding) |
|---|---|---|---|
| C3-2 | CwC + owner flag (accuracy) | F3c `POLICY.md:128-130`, F4 `:131-132`, F3 list `:114-116`, F3a `:117-119`, pre-launch accuracy `:234-235`; COMPLIANCE §6 `:111`, §12 `:163` | Moved-in units stay excluded. Unknown kinds keep the taint. Every transfer out is counted and shown, never silent. |
| C3-3 | CwC + owner flag (accuracy) | F3c `:128-130`, F4, F3a; COMPLIANCE §11 `:153` | Copy never says why units were oversold. Keep exclude-whole when the ledger was empty. Fees are pro-rated. |
| C3-17 | CwC (card part owner Q4) | F3a `:117-119`, F4, F3 `:113-116`, A1 `:153-155` | The disclaimer is never displaced. The share card is unchanged until the owner rules. |
| C3-15 | CwC + owner flags (Q1, Q2/OD-9, BC-16) | P6 `:54-59`, P3 `:48-50`, pre-launch privacy `:230-231`; COMPLIANCE §3 `:75`, §4 `:95`, §12 `:160`, §13 `:191-194` | Disconnect stops every read. Step 1 states the freeze and links deletion. No confirm-shaming. Deletion is never blocked. |
| C3-9 | owner-only → flag (Q3); CwC once answered | CLAUDE.md:62 (owner), F3c, F4, P6 deletion `:57`, H `:179`; COMPLIANCE §3 `:82-84`, pre-launch `:234-235` | Never update in place. Revisions are deleted with the profile. Trade removal only on a vendor signal, always counted. |
| C3-16 | CwC; part (c) owner-only → flag (Q5) | F3b `:120-127`, P3, P6 `:58-59`; COMPLIANCE §5 `:101` | No new public field. No message under F3b until the owner rules. No vendor account ids logged next to user ids. |
| C3-37 | CwC + owner flag (Privacy Policy text, MRC2-3) | P3 `:48-50`, P6 `:58-59`, H (Privacy Policy) `:178`; COMPLIANCE §1 Q2 `:28-29`, §3 `:79,82-84`, §5 `:104` | One date per account at most. No per-viewer or per-session events. Purged with the account. Never public. |
| C3-36 | CwC | P3 `:48-50`, P6; COMPLIANCE §3 `:79`; `lib/copy.ts:79` | Every public payload is covered, including cached ones. Ranking and stats compute on stored values, not on rounded ones. |
| C3-34 | CwC | S2 `:33-35`, P3, P6 `:58-59`; COMPLIANCE §10 `:145` | No ids, handles or figures in the body. The log line carries no presented token, no prefix of it and no IP. |
| C3-39 | CwC | H payments `:180`, F5 `:133-136`; COMPLIANCE §1 Q3/Q11 `:30-31,41-42`, §4 `:95`, §11 | No price, no date promise, no waitlist and no email capture. LIVE_BILLING and checkout untouched. |
| C3-40 | CwC | P6 deletion `:56-57`; COMPLIANCE §3 `:75`, §4 `:95` (dark patterns), §9; A1 | "Delete my profile" stays visible on /settings at 360 px, named as now, keyboard reachable and AA contrast. Never behind another page or a disclosure. |
| C3-42 | owner-only → flag (Q7 scope, BC-10); CwC to build | COMPLIANCE §3 `:75`, §13 `:178`; P3 `:48-50`; H `:178`; F-16 reporter rule `F-16:23-25` | Only the verified signed-in owner of the data gets it (no dev stub in production). No secrets or ciphertext. No other user's identity. |
| C3-35 | CwC | P6 deletion `:56-57`, F3 `:113-114`, U3 `:148`; F-16 hide `F-16:31-37`; cycle-2 K6 condition 2 | A deleted, hidden or taken-down profile's image stops being served from our origin and CDN. The disclaimer stays in the image. |
| C3-41 | CwC | F3b `:120-123`, F1 `:98-100`, F3, A1 | The symbol link never rates or ranks the security. The trade page carries the disclaimer. |
| C3-43 | owner-only → flag (Q8; owner consent copy) | P6 `:55-56` (consent lists exactly what is public), P3; TR-7 `DESIGN.md:330`; `lib/copy.ts:78-79`, `lib/privacy-fields.ts:1-3` | Not public until the owner's consent line names it. No figure beside it. No "proof" claim. |
| C3-38 | CwC | P3 `:48-50`; D11 purge `lib/privacy-purge.ts:9`; COMPLIANCE §3 `:79` | The aggregate holds no attempt id, email, IP, UA or link. The purge is never delayed or blocked. |
| C3-44 | CwC | COMPLIANCE §11 `:153` (truthful), §3 `:75` (deletion notice); F-3 committee copy | The gate equals the real data condition. If the condition is unsure, show the line. |
| C3-45 | CwC | U1 `:143-144`, F3a; `app/ui.tsx:74` | No absence line may tell viewers "No thesis posted." over a held thesis. |
| K18 | CwC as an addition to F-16 + owner flags (age-assurance method, deletion) | P4 `:51-53`, H deleting data `:179`, pre-launch age `:232`; COMPLIANCE §7 `:121`, §13 `:175-176`; F-16 `:20-22` | No DOB, ID, face/voice or age estimation. No automatic deletion or auto-hide on a single report. No minors' cohort words. |
| K20 | CwC (T5a) | T5a `:76-78`, T1, F3, F3a, F2; COMPLIANCE §11 | No product name, logo or wordmark in the image before clearance. No figures. No completeness claim. |
| K22 | CwC + owner flag (LIVE_BILLING, Terms) | H `:177-181`, F3b carve-out `:125-127`, T1 `:64-69` (Q11 open); COMPLIANCE §4 `:92,95`, §13 `:185` | Test mode only. Cancel has no save step. No "was" price. No "paid is more accurate" claim. No sending until the owner sets a sender. |
| K19 | CwC | P6 `:55`, F3a, F3b; T2 (F-7); pre-launch `:221-225` | Profiles stay out of every sitemap until the owner opens launch. Fix #1 (demo called verified) lands first. |
| K16 | CwC | A1 `:153-155`, F6 `:137-139` | No celebration or reward on a like. Reduced motion respected. |
| K15 | CwC | P6, P3; CLAUDE.md auth stub | Exact parity with the signed-out render. No "view as another user". Only on real sign-in. |
| K11 | CwC + owner flags O-2/O-4 | F3 `:113-114`, F3a, T5a `:76-78`, C3 `:91-92`, A1 | No image variant drops or shrinks the disclaimer below today. No logo. Bundled licensed fonts. |
| K21 | CwC | F1 `:98-100`, F3b `:120-123`, P3, U2 `:145-147` | Alphabetical only. Never ordered by performance or popularity. Queries not logged with user ids. |
| KV | CwC (no legal objection; low value) | T1 `:64-69`, T3 `:72-74`, T4 `:75`, C2 `:86-90`, A1 | No brand or product named, even as a comparison. No new font or package. Each variant passes the contrast test. |
| L-16 | CwC: re-approve with all F-16 conditions (legal priority 1) | U2 `:145-147`, U3 `:148-149`, P1, P3, P6 `:58`, H, F3a, F3b, T1, T4, T5a; COMPLIANCE §6 `:112` | Every F-16 "veto condition: LG" line stands verbatim (`F-16:16-63`, ACs `:68-96`). |
| L-17 | CwC: re-approve; re-point the normaliser | U2 `:145-147`, T1, T2, F3a, P3, P6 | Every F-17 "LG" line stands. No third-party or person name in the list, tests or fixtures. A hold never blocks deletion. |
| L-18 | CwC: re-approve | F3a `:117-119`, P2 `:46-47`, F3 links `:114-116`; COMPLIANCE §11 | Every F-18 "LG" line stands (Verified definition, completeness bans never loosened, demo never verified). |
| L-20 | CwC: re-approve | A1 `:153-155`, T3 `:72-74`; COMPLIANCE §3 `:80` | ≥4.5:1 / 3:1 floors and the ΔE00 ≥ 9 floor are never lowered. No hosted fonts. No brand-matched colours. |
| L-19s | CwC: re-approve | F4, F3c, A1 `:155`, F1 | ASCII hyphen on images unless the glyph render test passes. Sign kept in text. Ranking and CI untouched. |

##### Item notes

###### C3-2: transfer is a share move (CwC + owner flag)
POLICY F3c (`POLICY.md:128-130`) bars wrong returns. It does not bar priced returns from recorded lots, and every lot a
post-transfer sell draws under the proposal is a recorded buy with a recorded price. The proposal fits F3c, and it
stops a trader-triggered route that today drops a whole position's results into a count (F4 `:131-132`). F3
(`:115-116`) lists "transfers in" among exclusions. The proposal keeps moved-in units excluded, so that clause holds.
Naming "transfers out" on /how adds disclosure and needs no POLICY change. Rewording POLICY's own list stays with the
owner.
Conditions:
1. (veto) The moved-in lot is tainted. Unknown kinds and splits or dividends with an unknown ratio keep today's taint.
2. (veto) Every transfer out adds to `excluded_transferred_out`, and the profile line shows when n > 0. A transfer out
   is never silent, because it can move a losing open lot off the record (TR-4/TR-8 `DESIGN.md:327,331`). Build it with
   C3-17 so the count travels with the headline.
3. /how says transfers out leave by FIFO, oldest first, the record's own method. It does not say that matches the
   broker's lot method or tax basis (F3a: no completeness or audit implication).
4. The property test from the brief, plus one case where a transfer out sits between two buys.
5. This entry goes into the "How records are calculated" history (COMPLIANCE §12 `:163`).
Flag: the ballot lists this as amending a committee and orchestrator rule, not an owner rule. POLICY still lists
"accuracy and liability for platform-computed statistics" as a pre-launch owner sign-off (`:234-235`). I recommend
that the owner take note of the narrowed exclusion. The council does not need the owner's yes to build it.

###### C3-3: oversell publishes its recorded part (CwC + owner flag)
When every drawn lot is recorded and untainted, the matched units' basis is known: all of them are consumed whatever
the unseen unit's date. So the matched-part return is correct under the documented FIFO (F3c). Today's rule lets one
extra share turn a loss into a count, which works against F4.
Conditions:
1. (veto) The copy never states a cause. The platform cannot tell a short sale from missing history, so the line reads
   as units sold beyond recorded holdings, for example "‹n› sells went beyond recorded holdings (a short sale or
   earlier history we don't have)". Calling it a short sale would itself be a guess (COMPLIANCE §11 `:153`; F3a).
   Fixing today's line, which names only missing history (`lib/copy.ts:69`), is part of this.
2. (veto) Keep "exclude whole" when the ledger was empty or emptied by an unseen inflow. Keep the committee's
   buy 100 / sell 50 / sell 51 test (`committee log :113-117`), and never delete existing assertions.
3. Exit fee and proceeds are pro-rated by matched units (unit test).
Flag: same as C3-2 (pre-launch accuracy sign-off). The amended ruling was the orchestrator's under delegation.

###### C3-17: exclusion counts travel with the headline (CwC)
This is legally positive. Showing exclusions next to the headline guards against the completeness implication F3a
bars (`:117-119`) and the cherry-picking F4 bars.
Conditions:
1. (veto) The line never pushes the F3 disclaimer out of view at 360 px.
2. Neutral words such as "excluded", linking to /how. Never "hidden" or "removed by the trader".
3. Counts only, no symbols.
4. (veto) The share card is unchanged until the owner answers Q4 (F-4 card contents are the owner's). I recommend
   the brief's muted line, as the owner's call.

###### C3-15: disconnect inside the app (CwC + owner flags)
The legal committee's reading on the withdrawal question the chair sent here (§8 PD-1):
- Several state privacy laws treat brokerage data as sensitive and ground its processing in consent
  (`COMPLIANCE.md:75`). Where consent is the basis, withdrawing it should be about as easy as giving it. Some state
  rules say so expressly; treat that as a prompt to check, not settled law.
- Consent here was given in-app at connect. A withdrawal path that exists only at the vendor or by email is therefore
  a gap before real users (P6 `:54-59`; pre-launch "consent mechanics" `:230-231`).
- A two-step in-app Disconnect is proportionate.
- The consent text already says the record stays public after disconnect (`lib/copy.ts:91`). Keeping it public
  therefore does not breach the consent. Deletion is the route for full removal and is never blocked by a freeze
  (P6 `:57`).
Conditions:
1. (veto) After step 2, nothing reads that connection again: not the cron (`/api/sync`), not `/connect/done`, not
   reconciliation (C3-9), not health checks (C3-16). Nothing newly fetched for it is stored. Test it.
2. (veto) Step 1 says in /how's words that the record stays public, and it links "Delete my profile" as the way to
   remove it. No confirm-shaming and no extra retention offer (COMPLIANCE §4 `:95` dark-pattern standard).
3. Record the withdrawal (`disconnected_at`, and that the trader did it) as a consent record (COMPLIANCE §12 `:160`).
   Deletion removes it with the profile.
4. Demo users see no section. No email or notice carries a record field (F3b).
5. Per-user rigor (COMPLIANCE §13 `:191-194`): unit, e2e and heavy-use tests.
Flags (owner):
- Q1 and Q2/OD-9 block parts of it.
- BC-16 (vendor-side delete) stays open. The legal committee notes that leaving the vendor authorization live after a
  withdrawal keeps a data flow the trader asked to stop (P3 "collect the minimum"). It recommends that the owner
  decide BC-16 before real users. The council must not decide it.

###### C3-9: broker corrections (owner-only → flag Q3; CwC once answered)
"activities (raw, immutable)" is an owner rule (`CLAUDE.md:62`). The council cannot read it as "never updated in
place" on its own. Legally the proposal helps: it is the pre-launch "corrections process" (`POLICY.md:234-235`), and
Verified numbers must be correct (F3c; COMPLIANCE §6 `:111`, the company's own statements are not shielded).
Conditions if the owner says yes:
1. (veto) Raw rows are never updated in place.
2. (veto) `activity_revisions` is part of "all raw and derived data" deleted with the profile (P6 `:57`). It needs a
   deletion test, a SCHEMA_MAP / data-inventory entry and a Privacy Policy diff (COMPLIANCE §3 `:82-84`).
3. (veto) A trade leaves `closed_trades` only on a vendor withdrawal signal, never on a trader action, and it is
   counted publicly (TR-1 `DESIGN.md:324`).
4. No raw payloads in logs (P6 `:58-59`).
5. Reconciliation never runs for a disconnected account (C3-15 condition 1).
The late-sell reconciliation part does not touch immutability and can go first.

###### C3-16: connection health (CwC; email part owner-only)
Parts (a), (b) and (d) are clear. The trader-only line is an in-app state, not a pushed message. It carries no record
field to anyone else.
Conditions:
1. (veto) Signed-out renders and images are unchanged (test).
2. `needs_reconnect_at` is deleted with the profile.
3. The vendor's signal is not logged with vendor account ids next to user ids (P6 `:58-59`).
4. The reconnect keeps TR-6 claims and re-shows consent where the owner's rule (Q1) requires it.
Flag: part (c) needs the owner's reading of F3b. The carve-out (`:125-127`) lists sign-in links, receipts and billing
notices. Link health is not on the list. The legal committee recommends treating it as an account event: no handle,
symbol, return or record field, fired only on the connection signal, transactional under CAN-SPAM (COMPLIANCE §5
`:101`). That is the owner's to word (Q5).

###### C3-37: day-7 marker (CwC + owner flag)
Conditions:
1. (veto) At most one first-seen day and one "returned after day 7" day per account, as dates with no time of day.
   No IP, UA, device, page, referrer or session link (P3; COMPLIANCE §5 `:104`; F-15/K3 rule of no per-viewer id).
2. (veto) Deleted with the account (deletion test). It must not lengthen the life of session rows
   (`lib/auth/sessions.ts:10`).
3. Used only for the aggregate readout, with no cell under k = 5. Never public, never in a share image.
4. SCHEMA_MAP and data-inventory entry.
Flags: the Privacy Policy text must describe it before real users (owner, H `:178`; BC-10). The gate definitions
(MRC2-3) stay the owner's.

###### C3-36: round public payloads (CwC)
This is legally positive. The consent line says prices are private and dates public (`lib/copy.ts:79`), yet `/pane`
sends millisecond close times and full-precision returns under a public cache (`app/u/[handle]/pane/route.ts:22,26`).
Reducing precision serves data minimisation (P3) and keeps the consent line true.
Conditions:
1. (veto) Every public payload is covered: pane, pane-chart, feed HTML and series, profile, trade, month and stock
   pages, and og images. Cached responses are re-keyed so no old full-precision body survives.
2. (veto) Ranking, CIs and stats keep computing on stored values. Rounding happens only at the output (F3c).
3. On record (not a condition): day dates plus 4-decimal returns can still allow size inference against public daily
   prices in edge cases. Rounding reduces the risk; it does not remove it. The legal committee asks that the vendor
   question list keep "intraday times".

###### C3-34: health endpoint (CwC)
Conditions:
1. (veto) The body holds only booleans, times and hours: no ids, handles, user counts, figures or error text. It sends
   `no-store`, and a test greps it.
2. (veto) The `cron unauthorized` line never contains the presented bearer value or any part of it, because a mistyped
   real secret is still a secret (S2 `:33-35`). It holds no IP address (P3).

###### C3-39: record tools while billing is off (CwC)
This is not a "money" decision: no price, checkout or charge changes (COMPLIANCE §1 Q3 `:30-31` is not triggered).
Conditions:
1. (veto) No price, no launch date and no "coming soon" promise. No waitlist or email capture, which would be a new
   personal-data flow (P3).
2. (veto) LIVE_BILLING, checkout and F-3's open-state e2e are untouched.
3. Name the processor only as "the billing vendor" in tests, specs and PR titles (T1 `:64-69`; Q11 open).

###### C3-40: settings order and weight (CwC)
Making Delete secondary is fine. Making it harder to find is not: an easy deletion request is a P6 and state-law
requirement, and symmetric choices are part of COMPLIANCE §4's dark-pattern standard (`:95`).
Conditions:
1. (veto) "Delete my profile…" stays on /settings itself. It is visible at 360 px without expanding anything,
   keeps its name, is keyboard reachable and meets AA contrast in secondary styling (A1).
2. S9 view 2 is unchanged.
3. Removing the at-rest "Keep it" (`app/settings/page.tsx:44`) is fine.

###### C3-42: real data export (owner-only scope → flag; CwC to build)
COMPLIANCE asks for export as a real feature before launch (`:75`; per-consumer exposure `:178`). Scope (Q7) and the
Privacy Policy (BC-10) are the owner's.
One finding for the owner. "Percent only for trades" may undercut the access right: the user's own stored raw
activities (units, prices, fees) are personal information the service holds. P3's "percent returns only" governs what
is shown publicly (`POLICY.md:48-50`), not a private copy to the data subject. The legal committee recommends that the
owner decide whether the export includes the user's raw activities as stored. That is the owner's call, not the
council's.
Conditions to build:
1. (veto) Served only to the signed-in owner of the data on real authentication. Never the dev stub in production.
   `private, no-store`, no public URL (as `app/account/export/route.ts:9-17` does now).
2. (veto) No secrets, ciphertext or vendor user secret.
3. (veto) No other user's identity or data. In particular, no reporter identity for reports about the user
   (`F-16:23-25`). Followers and likers appear as counts at most, and only if the owner allows (F-2's "no count").
4. Consent and attestation records are included (COMPLIANCE §12).
5. A test seeds every user-owned table and finds each in the export.
6. Until the export is full, the help line stays exact (`lib/copy.ts:719`). Before real users, the label must not
   imply completeness (FTC §5).

###### C3-35: versioned, cacheable share images (CwC)
A year-long `immutable` cache at our CDN conflicts with deletion (P6 `:56-57`), F-16's hide and takedowns (U3) unless
it is purged.
Conditions:
1. (veto) After profile deletion, hide or takedown, the previously versioned image URLs return 404 from our origin and
   are purged from, or never long-held by, the shared cache. Use a short `s-maxage` with `immutable` only for the
   browser, or an explicit purge on those events. Test it at the origin.
2. (veto) The disclaimer stays in every image (F3).
3. Absolute dates (F-11). K6 condition 2: the URL changes with the figure.
4. On record: third-party unfurl caches are outside our control. That is already accepted.

###### C3-41: one link rule for trade rows (CwC)
Conditions:
1. (veto) The symbol chip and stock page never rate, score or rank the security (F3b).
2. The trade page carries the disclaimer.
3. Link names give the symbol and a signed % in text (A1). No "trade", "buy" or "copy" verbs (F2).

###### C3-43: "Public since ‹date› · ‹n› closes since" (owner-only → flag)
`connections.consent_at` (`db/schema.sql:289`) is not in `PUBLIC_FIELDS` (`lib/privacy-fields.ts:6-14`). The consent
scope line is owner copy (`lib/copy.ts:78-79`), and P6 requires that it list exactly what becomes public (`:55-56`).
So the field cannot render before the owner changes that line.
Recommendation (owner's): add it now, while there are 0 real users, so nobody has to re-consent later.
Conditions after the owner says yes:
1. (veto) The line does not render for any non-demo record that consented under the old line.
2. (veto) No second average beside it (TR-7 `DESIGN.md:330`). No "can't be cherry-picked" or "proof" claim in copy
   (F2, COMPLIANCE §11).
3. `lib/privacy-fields.ts` and its equality test are updated with the line.

###### C3-38: drop-off aggregate before purge (CwC)
Conditions:
1. (veto) The aggregate is per day and per step, with counts only: no attempt id, email, IP, UA, link or method detail
   that identifies anyone.
2. (veto) The purge's retention (`lib/privacy-purge.ts:9`, D11 30 days) is never delayed. An aggregation error must
   not block the delete; do both in the same transaction or skip the aggregate.
3. The readout uses k ≥ 5 cells.

###### C3-44: subscriber-notes line only when it applies (CwC)
The line (`lib/copy.ts:721`) is a disclosure of what deletion does to other users' data, so it has to be accurate.
Conditions:
1. (veto) The gate is the real data condition: notes or views that reference this user exist, or the user has a
   public record. It is not a proxy. When the code cannot tell, it shows the line (over-disclosure is safe).
2. Reworded only with the F-3 committee's words.

###### C3-45: a quieter "No thesis posted." (CwC)
`app/ui.tsx:74` prints "No thesis posted." whenever `thesis_status` is not `published`. That includes a held thesis,
which was posted. Removal is legally fine.
Condition: (veto) whatever the design session picks, no absence line tells viewers "No thesis posted." over a held
thesis (U1 `:143-144`, truthful copy). Neutral "No thesis shown." or nothing are both acceptable. This also works as
a fix-sized wording item.

###### K18: age-law posture (CwC as an F-16 addition; owner flags)
Since cycle 2 the shape has to fit F-16's dated rule: "Profile reports never hide anything on their own"
(`F-16:20-22`, a legal veto condition). So K18 is a report category plus owner review. A single report never
auto-hides.
Conditions:
1. (veto) No date of birth, ID, face or voice processing, or age estimation (COMPLIANCE §13 `:179`; H).
2. (veto) No automatic deletion and no auto-hide. The owner reviews, hides with F-16's script and runs any deletion
   (H "deleting data" `:179`).
3. (veto) No minors' cohort words in copy, tests or docs (P4 `:51-53`).
4. Under-18 reports sort first in the owner digest, and the runbook states a target review time as practice, not law
   (COMPLIANCE §7 `:121`: treat it like a COPPA notice).
5. Record the attestation text version only.
6. Signed-out order stays the documented non-personalised order, pinned by a test.
Flags: the age-assurance method under state laws is a pre-launch owner item (`:232`; COMPLIANCE §7 `:121` "counsel
decides the method"), and it is not decided here. K18 cannot build before L-16, which waits on F-9.

###### K20: home link preview (CwC)
Conditions:
1. (veto) No product name, logo or wordmark in the image before the T5a clearance (`:76-78`). The page title already
   carries the name in text; the image is a brand asset.
2. (veto) No figures. If any ever appear, the disclaimer appears too.
3. No completeness, verification or promise words.
4. Bundled, licensed fonts (C3).
Chore-sized.

###### K22: billing hygiene tests (CwC + owner flag)
Conditions:
1. (veto) Test mode only. LIVE_BILLING stays off.
2. (veto) Cancel opens straight on canceling, with no save step (as `lib/billing.ts:212` does now).
3. (veto) No "was" price from a test arm, and no copy implying paid data is more accurate.
4. Reminder templates carry no handle, symbol, return or record field (F3b carve-out `:125-127`), and nothing is sent
   until the owner sets a sender.
5. No Terms text written as final.
6. The processor is not named in test names (T1; Q11).
Flag: turning on LIVE_BILLING, Terms and the ARL checkout wording are the owner's (H; COMPLIANCE §4 `:92`).

###### K19, K16, K15, K11, K21, KV (CwC)
These carry the cycle-2 legal conditions unchanged. Additions:
- K19: #52 reworked the sitemaps into symbol chunks (`app/sitemap.ts`). The condition now reads: no profile URL in any
  chunk or in robots.txt until the owner opens launch (indexing needs a consent line, P6). Fix #1 still blocks it,
  because demo data called verified must not be indexed (F3a, P2).
- K11: O-2 and O-4 are owner flags.
- KV: no legal objection. Its value is the other members' call.

###### Section C: lapsed approvals L-16, L-17, L-18, L-20, L-19s (CwC, re-approve)
The chair's handling is legally neutral and acceptable. Conditions on it:
1. (veto) A re-approval keeps every earlier "veto condition: LG" line verbatim.
2. A re-approval whose prerequisite is still unbuilt carries the same lapse forward. It should say so, so nobody reads
   it as cleared to start.
Per feature:
- **L-16 (legal priority 1).** U2's report action on every profile and U3's takedown process are "before launch"
  items (`:145-149`), and P6 requires a takedown contact (`:58`). The blocker is F-9, which has not started. Legal
  recommends that the owner or chair ensure F-9 is actually scheduled. Otherwise F-16 lapses forever while a launch
  prerequisite stays open.
- **L-17.** Re-point the prerequisite to the single normaliser, wherever it lands: F-9's `lib/moderation.ts`, or the
  `checkDisplayName` the text-safety branch builds in `lib/handles.ts`. F-17's "one normaliser" rule must hold, and a
  second confusables map is a defect. The decisions keeper words this; legal requires only that the display-name
  refusals ("Verified", "Official", glyphs, bidi) survive (F3a).
- **L-18, L-20, L-19s.** No change to the legal conditions.

##### Legal priority (not a vote)
1. **POLICY launch prerequisites:** L-16 (+K18), L-17.
2. **P6 consent and deletion mechanics before real users:** C3-15, C3-40, C3-42 (owner scope).
3. **P3 minimisation on main today:** C3-36.
4. **F3c/F4 correctness of Verified numbers:** C3-2, C3-3, C3-17.

Everything else is legally neutral as conditioned.

##### Owner flags raised in this statement (not decided by the council)
- C3-2/C3-3: pre-launch accuracy sign-off (`POLICY.md:234-235`); for the owner's notice.
- C3-9: Q3 (immutability).
- C3-15: Q1, Q2/OD-9, BC-16 (the committee recommends deciding BC-16 before real users).
- C3-16(c): Q5, the F3b carve-out reading for link-health email.
- C3-17: Q4, the share-card line.
- C3-37: Privacy Policy text and MRC2-3.
- C3-42: Q7 scope, including whether the private export carries the user's own raw activities (access right versus
  P3's "shown"); BC-10.
- C3-43: Q8, the owner's consent line.
- K18: age-assurance method (`:232`) and deletions (H).
- K20: T5a name clearance.
- K22: LIVE_BILLING, Terms, sender.
- K11: O-2/O-4.
- K19: launch indexing consent.

### Round 0: Common sense

#### Round 0, common sense (the reasonable trader, viewer and owner)

Base: origin/main f467293. Lens: would a reasonable trader or viewer be confused or misled by what ships, and is the
item worth its cost **now**, with 0 real users and the launch gate closed? The cost that matters most at 0 users is
review capacity and owner attention, not runtime cost. Verdict scale: **clear** / **clear with conditions** /
**reshape** (confusing, dishonest or out of proportion as written) / **premature** (sound, but not worth a slot now or
blocked so long an approval would only lapse again).

Two general observations first:

1. **Honesty gaps beat polish.** The two items where the shipped record can currently say something false about a
   trader's results are C3-2 (a transfer erases or excludes a real loss with no line, or blames "corporate action")
   and C3-3 (one extra share turns a recorded -50% close into "no matching entry in the imported history",
   `lib/copy.ts:69`, a cause that is untrue when the entry is recorded; rule at `lib/trades.ts:43-46`, `:210`). A
   reasonable viewer would call both "the record hides losses", which is exactly what the product promises not to do.
   These are the cycle's best use of a slot.
2. **Do not re-approve what cannot start.** Five cycle-2 approvals lapsed because their prerequisites did not merge,
   and most of those prerequisites (F-9, F-11, F-13 / PR #55, fixes #1, #2, #10, #12, #13, #26) are still unmerged
   now. Re-approving them changes nothing on main and costs a council round each time. The bottleneck is F-9 (it
   blocks F-16, F-17 and K18): the owner should hear that plainly rather than see the same items re-voted.

##### Section A: cycle 3 briefs

| ID | Verdict | Reason | Veto conditions (become acceptance criteria) |
|---|---|---|---|
| C3-2 transfer = share move | **clear with conditions** (owner flag) | Today transfer-out-then-sell-elsewhere makes a loss vanish with no count, and transfer-in-1 excludes 100 recorded units as "corporate" (`lib/corporate-actions.ts:200`, `lib/trades.ts:171`). Untrue to a viewer either way. Amends a documented rule (`lib/trades.ts:52`), so conditional on the owner's yes. | (1) Every transfer outcome is a shown trade or a named count; nothing disappears (test the three probes). (2) The transferred-out line is plain and neutral ("‹n› positions moved to another account before they closed"), no hint of wrongdoing and no claim about what happened elsewhere. (3) Moved-in units stay excluded and counted (F3c). (4) Unknown kinds keep the taint. (5) Ships in the same slot as C3-3 and with F3-15's copy, never a copy that blames the wrong cause. |
| C3-3 oversell publishes recorded part | **clear with conditions** (owner flag) | Buying 100, selling 101 should not hide a recorded -50%; the current line names a cause that is false. The ruling's purpose (a later oversell never removes an earlier close) is kept. S. | (1) The published close is labelled as the matched units only, percent only, no "partial" word that suggests editing. (2) The extra units get their own honest count line ("‹n› sells larger than the recorded position"), not "short sale" unless the vendor confirms it was one; a reasonable trader with a data gap is not short-selling. (3) Empty/emptied-ledger case keeps "exclude whole". (4) Existing committee test kept. Same slot as C3-2. |
| C3-17 exclusion counts with headline | **clear with conditions** | Cheap, and it is what makes C3-2/C3-3's remaining counts visible where a record is actually read (pane, strip). Without it, counts live on one page most viewers never open. | (1) One muted line only when n > 0; links to the profile's exclusion reasons (not bare "(see profile)" text). (2) The sum comes from one function shared with the profile, so the two never disagree. (3) Neutral wording, no warning colour or icon (a count is not an accusation). (4) Share card untouched until owner Q4. Starts after F3-2. |
| C3-15 disconnect in app | **clear with conditions, not buildable this cycle** | The consent tells traders "your record stays public if you disconnect" (`lib/copy.ts:91`) but gives them no button; that is a genuine mismatch before real users. But it needs F3-3 (a flag that doesn't stop reads is no freeze), F-11 and owner Q2. | (1) Step 1 says in one sentence what stays public and what stops; no dark-pattern "are you sure you want to lose…" copy. (2) Disconnect never deletes or hides history (TR-5). (3) The same screen says how to delete instead, for someone who wants the record gone. (4) Demo users see nothing. Approve only if its prerequisites can merge this cycle; otherwise keep waiting without a slot. |
| C3-9 broker corrections | **premature** | Real concern, but the vendor's correction model is unverified and it touches the owner's "raw, immutable" rule (Q3). Building M of mechanism for an unknown input with 0 users is out of proportion. | The late-sell reconciliation part (a sell dated more than 7 days back is never read) may go with the fixes, since it is a plain data loss. The revisions table waits for Q3 and a vendor answer. Any "corrected by the broker" line must not suggest the trader changed anything. |
| C3-16 connection health | **premature** | The signal it reads is unverified in the vendor docs; with 0 real connections nobody's link can go stale. Worth it before real traders, not now. | When it returns: trader-only line, never visible to viewers; no email until Q5; `needs_reconnect_at` never freezes or hides a record. Build in the connection slot with C3-15. |
| C3-37 day-7 marker for F-15 | **clear with conditions** | S, and without it F-15 cannot answer its own week-8 question; fold into F-15's running build, no new slot. | One date per account, no per-viewer events, purged with the account; privacy committee rules on the field; MRC2-3 definitions untouched. |
| C3-36 round public payloads | **clear with conditions** | S, closes a gap between what consent calls private and what JSON carries. Nobody notices a 4-decimal return; everybody would mind a recoverable size. | (1) Rounding at the edge only: stats, ranks and confidence intervals still compute from full precision, and no displayed figure changes (snapshot test). (2) Dates as UTC days everywhere the payload is public, including the feed HTML. |
| C3-34 health endpoint | **clear with conditions** | S, owner-facing, nothing a trader or viewer sees. Proportionate: a stalled sync otherwise goes unnoticed. | No user counts, ids, handles or figures in the body (counts of users are business data too); `no-store`; one log line per bad token, no token echoed. Could ride with the fixes instead of a slot. |
| C3-39 record tools while billing off | **clear** | Every signed-in user meets a primary button to a locked page with no way back; plainly confusing. S. | With billing open, F-3 snapshots unchanged; "not open yet" names no date or price. Same slot as C3-40/C3-44. |
| C3-40 settings order and weight | **clear with conditions** | Delete as the heaviest element on every visit is out of proportion to how often anyone wants it. | Delete stays findable on /settings (one tap to view 2), not buried; S9 view 2 unchanged; "Account" name kept. Same slot as C3-39. |
| C3-42 full data export | **premature** | Required before launch, but scope is owner Q7 and the Privacy Policy (BC-10) is the owner's; building before the scope is decided risks building it twice. | Meanwhile the label must not promise more than the file holds: if the help line is not next to the button, the label is misleading. When built: percent only, no secrets, no other users' data. |
| C3-35 versioned share images | **premature** | A cost fix for traffic that does not exist; the downside (a long-cached image showing old figures) is a dishonesty risk. Prerequisite F3-26 unmerged. | When it returns: a record change always changes the URL (test), a mismatched version is never long-cached, disclaimer and absolute dates stay in the image. |
| C3-41 one link rule for trade rows | **reshape** (design session first) | The goal is right (the trade page is unreachable from the busiest surfaces), but it changes F-2 gestures and F-10's card markup; a council can't decide tap targets on a swipe card. | Route to a design session; then the rule as written (one link per row, never card-wide, SW-1 and like e2e pass). |
| C3-43 "Public since · n closes since" | **clear with conditions** (owner Q8), not buildable now | The most honest single line a record can carry: the part a trader can't pick with hindsight. But it is a new public field and F-11 owns the line. | Owner's yes on Q8 first and the consent list updated; no second average beside it (TR-7); shows only for connected records; plain date, no "since launch" or badge styling. |
| C3-38 drop-off counts before purge | **premature** | Funnel diagnostics for sign-ups that cannot happen while the gate is closed. It also edits the purge that PR #62 is editing. | When it returns: per-day aggregate, no identifiers, D11 untouched, built before the gate opens so day-one data exists. |
| C3-44 subscriber-notes line on delete | **clear with conditions** (as a chore) | Telling a new trader about "other subscribers' notes" is confusing, but this is a copy gate, not a feature. | F-3 committee words; ride in the settings slot or with the fixes, not its own slot. |
| C3-45 quieter "No thesis posted." | **reshape** (design session) | A design call with a real trade-off (noise vs. the trust cue that nothing is hidden). Not a council item. | Route to the design session that owns F-10's card. If kept, it must still say plainly that none was posted. |

##### Section B: waiting from cycle 2

| ID | Verdict | Reason | Conditions |
|---|---|---|---|
| K18 age-law posture | **premature** | It is an addition to F-16, and F-16 cannot start (F-9 unstarted). Age posture is owner/counsel territory in POLICY; flag stays with the owner. | Keep the cycle-2 conditions verbatim: a single report never hides an adult's record; owner review; owner runs any deletion; no DOB, ID or age estimation. |
| K20 home link preview | **clear with conditions** (chore) | Under an hour; outreach shares `/`, and an unfurl with nothing is a worse first impression than a plain one. | No product name, logo, figure or completeness claim (T5a). Build with the fixes, no slot. |
| K22 billing hygiene checks | **clear with conditions** (chore) | Tests only, test mode, before LIVE_BILLING. Proportionate as a chore. | No save step, no "was" price, no "more accurate" copy; no slot. |
| K19 sitemap and SEO pages | **premature** | Fix #1 (demo called verified) still unmerged; indexing that is harmful. No launch, no search value. | /how and a glossary only; profiles stay out until the owner opens launch. |
| K16 feed reading mode remainder | **premature** | Its own prerequisites (#14, #17, F-13) are unmerged. | Keep F-2's reject swipe and Undo. |
| K15 owner sees public record | **premature** | No real traders yet; F-7 unmerged. | Parity test when it returns. |
| K11 image palette and band | **premature** | Waits owner flags O-2/O-4. | none new. |
| K21 wayfinding remainder | **premature** | Three demo traders; search helps look-alike handles before F-17 exists. | Alphabetical only, never by performance. |
| KV design-system variant tests | **premature** | Three versions measured with no traffic is no evidence; approving would contradict the council's own record. | Return with F-15 counters at ~1,000 weekly landings. |

##### Section C: lapsed approvals

| ID | Verdict | Reason | Conditions |
|---|---|---|---|
| L-16 F-16 trust-and-safety slice | **premature** (keep file, mark waiting) | F-9 has not started; a re-approval would lapse again. The shape is sound and its conditions should not be re-litigated. | Keep every cycle-2 condition (no auto-hide on profile reports; neutral hidden state with no "under review"). Flag to the owner: F-9 is the bottleneck for three items. |
| L-17 F-17 handle and name integrity | **premature**, with one note | Same F-9 block. Risk: the text-safety branch builds `checkDisplayName` in `lib/handles.ts`, which could become a second normaliser beside F-9's, against F-17's "one normaliser" decision. | When it returns, there is exactly one normaliser; if the branch's helper lands first, F-17 reuses it and F-9 adopts it, rather than two. That choice is the decisions keeper's to log. |
| L-18 F-18 one trust language | **premature** | Waits F-20, F-11, F-13 and fixes #1, #2, #10; the false parts are already fixes. | none new. |
| L-20 F-20 tokens and contrast test | **premature until PR #55 and fixes #12/#13/#26 merge**; then re-approve without debate | The contrast test is the cheapest permanent guard in the queue; it is blocked only by work that is already open. | Unchanged cycle-2 conditions (no visible value changes beyond the fixes; floor never lowered). |
| L-19s F-19 call-site sweep | **premature** | Waits F-18. | none new. |

##### Ruling on the chair's section-C handling

I agree with most of it, with two changes:

1. **Do not re-vote a lapsed item whose prerequisite is still unmerged and not expected to merge this cycle.** It goes
   straight to `Status: blocked` → waiting, the lapse is dated in the file, and its conditions are kept. Re-voting it
   costs fifteen statements and produces an approval that will lapse again. Re-vote only a lapsed item that can start
   this cycle (today: L-20, if PR #55 and the three fixes are close). The re-vote is a short confirm vote on the same
   conditions, not a fresh debate, unless a member names something that changed.
2. **Re-approvals count against the six-per-cycle cap only when they can start this cycle.** The cap protects review
   and merge capacity; an approval that cannot start consumes none. Counting blocked re-approvals would crowd out
   buildable items; not counting buildable ones would let the cycle exceed what can be reviewed. So: a re-approval
   that can start this cycle counts exactly like a new approval; an item marked waiting counts in no cycle until the
   cycle in which it starts.

Also: the chair should tell the owner, in one line, that F-9 (unstarted) is holding three approved items and K18, so
the owner can decide whether to start it or let those items go.

##### Build slots (items sharing files enough to count as one)

`lib/copy.ts` is touched by almost every item; keyed additions to it should **not** merge slots (otherwise everything
is one slot). `app/u/[handle]/page.tsx` edits must be sequenced, but small line additions there do not merge slots
either. Real overlaps:

- **Slot 1, ledger:** C3-2 + C3-3 (`lib/trades.ts`, `lib/trades.test.ts`, `lib/sync.ts`, `lib/corporate-actions.ts`,
  `db/schema.sql` counters, the copy lines `:69`/`:311`). C3-9's late-sell part would join here if it ever comes.
- **Slot 2, settings:** C3-39 + C3-40 + C3-44 (`app/settings/page.tsx`, `app/account/page.tsx`, `app/tools/page.tsx`).
  C3-15 joins this slot when unblocked.
- **Slot 3, pane and payloads:** C3-17 + C3-36 (`app/pane.tsx`, `lib/pane.ts`, pane routes, `lib/feed.ts`,
  `lib/record-strip.ts`, `lib/chart-series.ts`). C3-41 would join here after its design session.
- **Connection slot (not this cycle):** C3-15 + C3-16 + C3-9 share `lib/sync.ts`, `lib/connections.ts`, `lib/broker.ts`.
- **No slot:** C3-37 (folds into F-15's build); C3-34, K20, K22 (chores with the fixes).
- C3-35 and C3-43 share the profile page and OG image files with F-11 and F3-26; not this cycle.

My recommended cycle from this lens: slots 1, 2 and 3, C3-37 inside F-15, and C3-34/K20/K22 as chores. That is three
slots, well under six, which is the right size while the 27 cycle-3 fixes and five open feature branches are still
waiting for review.

### Round 0: evidence check at f467293 (chair's helper, not a member)

#### Evidence re-check: cycle-3 briefs at main f467293 (cited at 3f216ba)

Method: `git show <commit>:<path> | sed -n` at both commits for every cited line; `git diff 3f216ba f467293` per file.
Commits between them: #60 (cce9669, F-10/F-12 follow-ups), #52 (34c5a90, known limits), #61 (5de8d48, trust follow-up), #63 (this audit doc).
Unchanged files (byte-identical): lib/corporate-actions.ts, lib/copy.ts, lib/broker.ts, app/settings/page.tsx, app/account/page.tsx,
app/tools/page.tsx, app/pane.tsx, app/u/[handle]/pane/route.ts, app/u/[handle]/pane-chart/route.ts, lib/auth/sessions.ts,
instrumentation.ts, app/api/sync/route.ts, app/account/export/route.ts, docs/COMPLIANCE.md, lib/chart-series.ts, lib/record-strip.ts,
lib/pane.ts, app/u/[handle]/opengraph-image.tsx, lib/record-card.ts, F-15 spec, F-1 build-pr2a log, corporate-actions committee log.

| Item | citation at 3f216ba | line at f467293 | still holds? | note |
|---|---|---|---|---|
| C3-2 | lib/corporate-actions.ts:200 | :200 | yes | file unchanged; TRANSFER group still pushed as kind 'unpriceable' |
| C3-2 | lib/trades.ts:171 | :171 | yes | `else taint(b.lots)`; trades.ts diff only adds comments after line 344 |
| C3-2 | lib/trades.ts:52 | :52 | yes | "an unpriceable action taints them" |
| C3-2 | lib/copy.ts:311 (/how) | :311 | yes | "transfers in ... excluded and counted"; no transfers-out wording |
| C3-2 | excluded_transferred_out | absent | yes | no such column/count on main |
| C3-3 | lib/trades.ts:208-210 | :208-210 | yes | oversold sell excluded whole |
| C3-3 | lib/copy.ts:69 | :69 | yes | excludedPositions line blames missing history |
| C3-3 | corporate-actions committee log :115-119 | :115-119 | yes | log unchanged |
| C3-17 | app/u/[handle]/page.tsx:284-287 | :289-292 (block 283-292) | yes | +4 lines from #61 (ponytail comments, generateMetadata notFound). Still profile-only; pane.tsx/lib/pane.ts/record-strip unchanged. New: #52 adds a silent exclusion (lib/sync.ts:99 `notShared`, shared_account_marks) with no profile count |
| C3-15 | app/settings/page.tsx:20-46 | :20-46 | yes | unchanged; no disconnect action anywhere (no `disconnected_at =` writer in app/lib besides sync detection) |
| C3-15 | lib/copy.ts:91 | :91 | yes | "Your record stays public if you disconnect" |
| C3-15 | lib/connections.ts | changed | yes | #52 diff is account-identity claims (accountIdentity/identityOwners), not disconnect |
| C3-9 | lib/sync.ts:36 | :37 | yes | `on conflict (source, external_id) do nothing`; +1 from new import (shared-accounts) |
| C3-9 | lib/broker.ts:142 | :142 | yes | BUY/SELL only |
| C3-9 | lib/sync.ts:376 | :378 | yes | hourly 7-day backfill (comment 378, `since` 379) |
| C3-16 | lib/broker.ts:86-91 | :86-91 | yes | listAccounts reads id, authorization, institution, paper, initial sync only |
| C3-16 | build-pr2a-engineer.md:154-155 | :154-155 | yes | unchanged; no needs_reconnect_at on main |
| C3-37 | lib/auth/sessions.ts:10, :33, :46 | :10, :33, :46 | yes | unchanged |
| C3-37 | lib/privacy-purge.ts:47 | :52 | yes | session purge moved (+5) by #52 purge rewrite |
| C3-37 | F-15:47 | :47 | yes | unchanged |
| C3-36 | app/u/[handle]/pane/route.ts:22, :26 | :22, :26 | yes | `closedAt: r.closedAt.getTime()`, `public, max-age=60` |
| C3-36 | lib/feed.ts:185-186 | :197-198 | yes | ms epochs for closed_at/opened_at in records1; +12 from #52 comments/sell_imported_at refactor. pane-chart route unchanged (public cache :24) |
| C3-36 | lib/copy.ts:79 | :79 | yes | consent scope line |
| C3-34 | app/api/sync/route.ts:34-36 | :34-36 | yes | 401 path, no log line |
| C3-34 | instrumentation.ts:7-10 | :7-10 | yes | register() only; no app/api/health |
| C3-39 | app/account/page.tsx:61 | :61 | yes | primary `BILLING.seeTools` button |
| C3-39 | app/settings/page.tsx:27-28 | :27-28 | yes | heading + same-name link |
| C3-39 | app/tools/page.tsx:69-78 | :69-78 | yes | locked view, no next step |
| C3-40 | app/settings/page.tsx:43-44 | :43-44 | yes | primary Delete (43) + at-rest Keep (44) |
| C3-42 | COMPLIANCE.md:75 | :75 | yes | unchanged |
| C3-42 | lib/copy.ts:674, :719 | :674, :719 | yes | label vs help line |
| C3-42 | app/account/export/route.ts:5-6 | :5-6 | yes | views, notes, subscription only |
| C3-35 | four opengraph-image.tsx | same files | yes | no versioning / cache headers. #61/#60 changed trade + month images (404 via notFound instead of 200 "not found" picture; tradeBand fit), symbol image (deleted traders excluded). Profile image and lib/record-card.ts unchanged |
| C3-41 | app/pane.tsx:75-79 | :75-79 | yes | pane rows still plain text |
| C3-43 | db/schema.sql:285 | :289 | yes | `consent_at timestamptz` in connections; +4 from #52 additive schema |
| C3-38 | lib/privacy-purge.ts:118 | :180 | yes | `delete from funnel_events where attempt_id in ...`; no aggregate kept |
| C3-38 | lib/privacy-purge.ts:19 (D11) | :22 | yes | `UNFINISHED_SIGNUP_DAYS = 30`; D11 comment block at :9-10 |
| C3-38 | prereqs | - | partly met | claude/known-limits merged (#52); claude/options-trades (b8eaa4a) NOT merged and still edits lib/privacy-purge.ts (+8/-2 vs main) |
| C3-44 | app/settings/page.tsx:42 | :42 | yes | `BILLING.deleteNotes` ungated |
| C3-44 | lib/copy.ts:721 | :721 | yes | "other subscribers' private notes" |
| C3-45 | app/ui.tsx:65 | :74 | yes | "No thesis posted." unchanged; +9 from #60 (UTC-year dates, retEms sizing) |
| K20 | app/opengraph-image.tsx | absent | yes (still waiting) | no home link-preview image on main |
| K19 | app/sitemap.ts, app/sitemaps/sitemap.ts | sitemap.ts:1-16; sitemaps/sitemap.ts:1-23 (new, #52); lib/ticker.ts:269-280 | yes (still waiting) | sitemaps list `/`, `/t`, `/t/<symbol>` only (lib/ticker.ts:279; extra chunks filtered to /t/ at lib/sitemaps.ts:61). /how and a glossary are NOT in any sitemap; no profiles (as K19 wants) |
| K22 | lib/billing.ts:206-211 (cancel flow) | :212-217 | yes (check still holds) | portalUrl with flow_data subscription_cancel; +6 from #52 (ensureCustomer race fix, ponytail comments); cancel logic unchanged |

## 3. Round 1: first vote

### Instructions

#### Round 1: first vote

Read `ballot.md` in full (including "Round 0 outcome" and the round-0 statements it names) and the briefs it points
to. Score each of the 19 items in "Round 1 ballot" 0-5 through your lens, with a one-line reason (cite `path:line` at
f467293 where it matters) and any condition you would attach. Vote independently.

Write your ballot to `r1-<your-slug>.md` in the council folder as a Markdown table: | Item | Score | Reason | Conditions |.

Reply with EXACTLY this format and nothing else of length:
SCORES: C3-2=n, C3-3=n, C3-17=n, C3-15=n, C3-9a=n, C3-16=n, C3-37=n, C3-36=n, C3-34=n, C3-39/40=n, C3-42=n, C3-35=n, C3-43=n, C3-38=n, L-16=n, L-17=n, L-20=n, L-18=n, L-19s=n
then up to 19 lines "ID: one-line reason".

### Tally (chair)

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

### Round 1: Business lead

#### Round 1, business lead (base f467293)

Lens: does it move the four week-8 gates (`docs/DESIGN.md:246-255`: G1 >= 50 connected traders, G2 >= 60% share
their card, G3 >= 5,000 external-referrer profile views/week, G4 viewer D7 >= 15%), ease of adoption, revenue? At 0
real users the scarce inputs are review slots and owner attention. Two things decide the outcome: (a) the record's
credibility is the whole product, because "Verified" is what a trader shares and a viewer trusts, so any silent
loss or false figure costs G1-G3 at once; (b) the gates must be readable at week 8, or the CEO's binding kill
decision is made blind.

| Item | Score | Reason | Conditions |
|---|---|---|---|
| C3-2 transfers as share moves | 4 | Moving between brokers is routine for the active traders we recruit for G1. Today one share moved in taints 100 recorded units (`lib/corporate-actions.ts:200`, `lib/trades.ts:171`), shrinking the record a trader came to show, and a move out then sale elsewhere makes a loss vanish with no count: the "hides losses" story that would end G2/G3 if a viewer found it. | Owner's yes first (amends `lib/trades.ts:52` and the corporate-actions committee's "exclude and count"). DK veto: oldest-first on a move out only where it cannot change a basis; otherwise lots stay tainted; moved-in lots stay tainted and counted. LG: every move out counted in `excluded_transferred_out` and shown when n > 0. CS's neutral line wording. Same ledger slot as C3-3 (if C3-3 passes) and ships with F3-15's copy. |
| C3-3 oversell publishes recorded part | 2 | The DK probe (`r0-decisions-keeper.md`: unreported 2:1 split, sell 101 → a -50% "Verified" close where the truth is 0%) is decisive for me: a false loss on a trader's verified record is the fastest way to lose a G1 trader and his share. Today's exclusion is under-informative, not false about the result; the fix for the misleading cause line (`lib/copy.ts:69`) is copy, not a ledger change. | If approved anyway: owner's yes; exclude-whole whenever any drawn lot predates an unseen inflow or a gap in history; the copy names no cause (LG); a probe test for the unreported split stays green. Prefer: fix only the `lib/copy.ts:69` cause line in the fixes lane. |
| C3-17 exclusion counts beside headline | 4 | The pane and strip are where viewers actually read a record (the feed is the G3/G4 surface). A count visible there is cheap proof we hide nothing, and it makes C3-2's counts land where they matter. S. | DK reshape: pane (and strip if it fits D22/F-10), never a second feed-card line (`IDEAS.md:148`). One shared sum function with the profile; includes #52's `notShared` (`lib/sync.ts:99`) if it is a profile exclusion. Neutral muted line, links to the profile's reasons, never displaces the disclaimer at 360 px. Share card waits owner Q4. |
| C3-15 in-app disconnect | 3 | A visible way out raises connect conversion (G1): "you can disconnect any time" is a strong reassurance at the consent step, and the consent already promises it (`lib/copy.ts:91`). But it is blocked on F3-3, F-11 and owner Q2/OD-9, so an approval now would only lapse. | Approve only with a lapse clause tied to F3-3 + F-11 merging and the owner's Q2/OD-9 answer. LG: nothing reads the connection after step 2; step 1 states the freeze and links deletion; no confirm-shaming. Vendor link untouched (BC-16). Settings slot when unblocked. |
| C3-9a late-sell reconciliation | 3 | A sell posted more than 7 days late never reaches the record (`lib/sync.ts:378`): a silent data loss that, once a trader notices a missing loss, reads as cherry-picking. Real but rare at 0 users. | Insert-only, within F-14's read limit, rides in the ledger/connection lane; no change to the "raw, immutable" rule (C3-9b stays owner Q3). Any new close appears with a "posted late by the broker" note, never suggesting the trader edited. |
| C3-16 connection health | 2 | Stale links matter for G1 retention later, but the vendor signal is unverified and with 0 connections no link can go stale. Not before a real vendor answer. | When it returns: vendor signal verified in writing; trader-only line; no email until owner Q5; never freezes or hides a record; connection slot with C3-15. |
| C3-37 day-7 marker in F-15 | 5 | G4 is one of four binding gates and today it cannot be rebuilt at week 8 (sessions purged at 30 days, `last_seen_at` overwritten: `lib/auth/sessions.ts:10,33,46`, `lib/privacy-purge.ts:52`). Without it the kill/continue decision is made with one gate unreadable. S, no new slot. | Folded into F-15's running build. LG: at most one first-seen day and one returned-after-day-7 day per account, dates only, never public, purged with the account. Readout keeps "signed-in viewers only", never labelled as G4 itself, until the owner rules MRC2-3. |
| C3-36 round public payloads | 3 | No gate moves, but traders' trust that "percent only" really means it (`lib/copy.ts:79`) is part of G1's consent conversion, and a recoverable size found by a curious viewer would be a launch-killing story. S. | LG: every public payload covered incl. cached and feed HTML; stats, ranks and CIs computed from stored values; snapshot test proves no displayed figure changes. Pane/payload slot with C3-17. |
| C3-34 health endpoint + cron 401 log | 3 | A silently stalled sync freezes every record and quietly costs G1/G4; this is how the owner finds out in hours, not at week 8. Chore-sized. | Chore with the fixes, no slot. LG: booleans, times and hours only; no counts, ids, handles or figures; `no-store`; the 401 line never echoes any part of the token. |
| C3-39/40 tools while billing off + settings order | 4 | Every signed-in user meets a primary button to a locked page with no way back (`app/account/page.tsx:61`, `app/tools/page.tsx:69-78`), and Delete is the heaviest element on every settings visit (`app/settings/page.tsx:43-44`). Both are adoption friction for the exact traders G1 needs, and a dead-end paywall teaches them the paid tier is vapour, which hurts revenue later. I sign off the F-3 entry-point change in the billing-closed state only. | Billing-open state and F-3 snapshots unchanged; no price, date, "coming soon", waitlist or email capture (LG); LIVE_BILLING and checkout untouched. Delete stays on /settings, visible at 360 px, named as now, keyboard reachable (LG); S9 view 2 unchanged; "Account" kept. Amends F-1 `logs/F-1/plan.md:75-77` and F-3 `plan.md:142`: dated decisions in both. C3-44 rides in this slot as a chore. |
| C3-42 full data export | 2 | Needed before launch, not a gate mover now; scope is owner Q7 and BC-10. Building before the scope is decided risks building twice. | Owner's Q7/BC-10 answer first. Meanwhile the current label must not promise more than the file holds (F-3 condition 11). LG: real auth only, no secrets, no other user's identity. |
| C3-35 versioned share images | 2 | The share card is the G2/G3 loop, but this is a caching cost fix for traffic we do not have, and its failure mode (an old figure served long) is a credibility risk. Blocked on F3-26. | When it returns: a record change always changes the URL (test); deleted/hidden/taken-down images 404 from origin and CDN; disclaimer and dates kept; K6 condition 2 and F-11's date rule kept. |
| C3-43 "Public since · n closes since" | 3 | The strongest single credibility line we could add for a viewer arriving from a shared link (G3 → G4): the part of a record that cannot be picked in hindsight. But it is a new public field (owner Q8, P6 consent list) and needs F-11. | Owner's yes on Q8 and the consent line updated first; never renders for records that consented under the old line (LG); no second average (TR-7), no "proof" claim; lapse clause on F-11. I recommend the owner say yes. |
| C3-38 drop-off aggregate before purge | 4 | G1 is the gate most likely to miss, and if we miss it we must know where sign-ups stall. The 30-day purge (`lib/privacy-purge.ts:22`, `:180`) deletes weeks 1-4 of funnel data before the week-8 reading. Must exist on day one of launch, so it must be built before the gate opens. S. | Starts after PR #62 merges (it edits the same purge); lapse clause on #62. LG: per day and per step, counts only, no attempt id, email, IP, UA or link; D11 30-day retention never delayed and an aggregation error never blocks the purge. Readout cells below 5 roll into "other" (F-15 rule). |
| L-16 F-16 trust-and-safety slice + K18 | 3 | A report path and takedown page are launch prerequisites once shared links carry G3 traffic; one abusive profile unfurled in public is worse than any missed gate. But F-9 has not started, so an approval now changes nothing on main. | Re-approve only with every F-16 condition verbatim, a lapse clause on F-9, and the K18 legal veto conditions (no DOB/ID/age estimation; no auto-hide on one report; owner reviews, owner deletes). Flag to the owner: F-9 holds F-16, F-17 and K18; decide to start it or drop them. |
| L-17 F-17 handle and name integrity | 3 | Look-alike handles undermine the one asset a shared link carries, the trader's name. Same F-9 block. | Every F-17 condition verbatim; exactly one normaliser: if `checkDisplayName` (`lib/handles.ts`, branch `claude/fix-user-text-safety`) lands first, F-17 and F-9 reuse it (DK logs it). Lapse clause on F-9. |
| L-20 F-20 tokens + contrast test | 3 | No gate moves, but a permanent cheap guard; blocked only by work already open (PR #55, fixes #12/#13/#26). | Re-approve on the same conditions with a lapse clause on PR #55 and the three fixes; floors never lowered; no visible value changes beyond the fixes. |
| L-18 F-18 one trust language | 2 | Waits F-20, F-11, F-13 and fixes #1/#2/#10; the false parts are already fixes. Re-approving now only queues a lapse. | If re-approved: all conditions verbatim, after L-20, lapse clause on every named prerequisite. |
| L-19s F-19 call-site sweep | 2 | Pure consistency work behind L-18; no adoption or gate effect. | Only if L-18 is re-approved; conditions verbatim. |

Slots I would build this cycle, in order of gate effect: C3-37 (inside F-15, no slot); ledger (C3-2, owner-conditional);
pane/payloads (C3-17 + C3-36); settings (C3-39/40 + C3-44 chore); C3-38 after #62. Chores: C3-34. That is four
slots, under six, leaving review room for the 27 cycle-3 fixes and five open feature branches.
Owner questions touched (the owner's, not decided here): Q3 (C3-9b), Q4 (card counts), Q2/OD-9 (C3-15), Q5 (C3-16
email), Q7/BC-10 (C3-42), Q8 (C3-43, I recommend yes), MRC2-3 (G4 definition).

### Round 1: Market research lead

#### Round 1, market research lead (approval council cycle 3)

Base: origin/main f467293, read only. Lens: what traders (supply) and viewers (demand) need, positioning against
competitor patterns (described generically), and whether the week-1..8 gates can be read. Evidence:
`docs/direction/market-2026-11-01.md` (MRC, cycle 1) and `docs/direction/market-2026-11-01-cycle2.md` (MRC2).

Three evidence points drive most scores:
1. **The wedge is "no per-trade hiding", not "verified".** A commission-free app broker already runs a verified,
   identity-checked trade feed where customers *pick which trades to post* (`market-2026-11-01.md:227`); "Verified"
   is free at scale (`:596`). Anything that lets a loss leave the record without a visible line erodes the only
   difference left. Posters go quiet after losses and voluntary reporters leave after poor returns
   (`market-2026-11-01-cycle2.md:78-82`, `:163`).
2. **Wrong "Verified" P&L is kill risk #2** (`market-2026-11-01-cycle2.md:462`), and the vendor's activity tagging is
   best effort, so lot-to-position reconciliation, not "the ledger looks complete", is the primary detector (`:512`).
3. **Nothing in weeks 1-8 is readable without measurement** (`market-2026-11-01-cycle2.md:64-68`); G4's primary is
   signed-in viewers active on day 7 ±1 (`:248`). TR rules stop cherry-picking of trades but not of *traders: who
   connects, and when* (`market-2026-11-01.md:143`).

Owner questions are the owner's; where I lean, I say "I'd recommend".

| Item | Score | Reason | Conditions |
|---|---|---|---|
| C3-2 transfers as share moves | 4 | Transfer-out-then-sell-elsewhere makes a loss vanish with no line (`lib/corporate-actions.ts:200`, `lib/trades.ts:171`): exactly the "pick which trades show" pattern the broker-native feed already offers, so it erases our positioning. Transfer-in-1 excluding 100 recorded units as "corporate" also tells a real trader their record is broken (supply-side churn trigger, `market-2026-11-01-cycle2.md:1187`). Owner-conditional, so 4 not 5. | Owner's yes listing `lib/trades.ts:52` and committee "exclude and count" as amended. DK's lot-basis condition (oldest first only where it cannot change a basis). Moved-in lots stay tainted. Transferred-out line neutral ("moved to another account before it closed"), never implying wrongdoing or claiming what happened elsewhere. Same slot as the copy fix (F3-15). |
| C3-3 oversell publishes recorded part | 2 | An oversell is the cheapest signal that an inflow (split, stock dividend, transfer) was never reported; DK's probe (unreported 2:1 split → -50% Verified, truth 0%) is precisely kill risk #2 (`market-2026-11-01-cycle2.md:462`), and vendor tagging is best effort (`:512`, `:1923-1924`). Publishing a wrong Verified loss hurts trader supply more than one hidden one hurts viewers. The real defect is the copy at `lib/copy.ts:69` blaming "missing history": that belongs on the fixes list. | Only if the owner says yes AND a lot-to-position reconciliation against the vendor's position units confirms no unseen inflow (the signal DK asks the brief to name). Otherwise: fix the copy only (no stated cause), keep "exclude whole". |
| C3-17 exclusion counts beside the headline | 4 | Viewers read records on the pane and strip, not the profile counts block (`app/u/[handle]/page.tsx:289-292`). MRC's positioning line is "no per-trade hiding … with what's excluded listed" (`market-2026-11-01-cycle2.md:1856`); counts that live on one page don't carry that claim to where it's consumed. S. | One muted line only when n > 0, linking to the reasons; same sum function as the profile; includes #52's `notShared` (`lib/sync.ts:99`) if it is a record exclusion; no warning colour; F3 disclaimer stays in view at 360 px; share card waits owner Q4 (I'd recommend the muted line there too). |
| C3-15 in-app disconnect | 3 | Consent promises "stays public if you disconnect" (`lib/copy.ts:91`) with no button; "lingering access" is a named connect-fear (`market-2026-11-01-cycle2.md:185`). Real need before real traders, but blocked on F3-3, F-11 and owner Q2, so not now. | Prerequisites merged first; no vendor delete until BC-16; step 1 also names "Delete my profile" for someone who wants it gone; no dark-pattern copy. |
| C3-9a late-sell reconciliation | 4 | A sell posted more than 7 days late is never read (`lib/sync.ts:378`): the position shows open forever and a realized loss never appears. That is a silent divergence on a Verified record (kill risk #2) and the kind traders notice first on their own profile. Insert-only, no immutability question. | Insert-only; within F-14's read limit; never removes a shown close; fake-vendor e2e for a 10-days-late sell. Revisions table (C3-9b) stays with the owner (Q3). |
| C3-16 connection health | 3 | Pull-only product with no push (F3b): a link that silently stops updating is the main retention leak on the supply side and makes records look abandoned to viewers (freshness ranked top by 18% of investors, `market-2026-11-01-cycle2.md:163`). But 0 real connections and the vendor signal is unverified. | Vendor signal confirmed first (add to MRC2-10 question list); trader-only line; never freezes or hides a record; no email until Q5. |
| C3-37 day-7 marker (F-15 amendment) | 5 | Without it G4's primary (day 7 ±1, `market-2026-11-01-cycle2.md:248`) cannot be read at week 8, since sessions are purged at 30 days (`lib/auth/sessions.ts:10`). Measurement is the precondition for every demand test (`:64-68`). S, no slot. | One server-side date per account, no time of day, no per-viewer events, purged with the account; never labelled as G4 itself; MRC2-3 definitions stay the owner's; privacy committee rules first. |
| C3-36 round public payloads | 4 | Percent-only is a supply-side promise: position size is what traders fear exposing, and a recoverable size from ms timestamps and full-precision returns (`app/u/[handle]/pane/route.ts:22`) breaks it before anyone notices. Also lowers scam-bait value of records (`market-2026-11-01-cycle2.md:468`). S. | Rounding at output only; stats/ranks/CIs on stored values; no visible figure changes; same-day trades keep their order; every public payload covered (feed HTML included). |
| C3-34 health endpoint + cron 401 log | 3 | No trader or viewer value directly; a stalled sync shows to viewers as a stale record, so it protects freshness indirectly. Better as a chore with the fixes than a slot. | Body holds booleans, times and hours only (no user counts: business data); no token in the log line; threshold from the schedule constant. |
| C3-39/40 record tools while billing off + settings weight | 4 | Every signed-in user hits a primary button to a dead-end page (`app/account/page.tsx:61`, `app/tools/page.tsx:69-78`); dead ends cost the signed-in return (G4) we most need. A heavy Delete on every visit (`app/settings/page.tsx:43-44`) also invites accidental exits that skew G1. | No "coming soon", date, price or waitlist capture (a waitlist is MRC2-7's owner-gated painted door, not a side effect of this); billing-open e2e unchanged; Delete still visible on /settings at 360 px; names `F-1/plan.md:75-77` and F-3 `plan.md:142` as amended; business lead sign-off. |
| C3-42 full data export | 3 | Traders ask "can I take my data" before connecting a broker; a label that promises more than the file (`lib/copy.ts:674` vs `app/account/export/route.ts:5-6`) is a trust cost. Required before launch, but scope is owner Q7/BC-10. | Owner scope first (I'd recommend Q7's "everything, percent only, consent/attestation included, no secrets"); until then the help line sits next to the label. |
| C3-35 versioned share images | 2 | Cost fix for traffic that doesn't exist (central week-8 case ≈1,150 external views/week, `market-2026-11-01-cycle2.md:109`); a stale long-cached card showing old figures is a trust risk on the main distribution surface. Blocked on F3-26. | Every record-changing input bumps the version; removed/deleted images 404; disclaimer and absolute dates kept. Revisit when weekly views approach the G3 band. |
| C3-43 "Public since · n closes since" | 4 | The one line that addresses selection of *when* a trader connects (`market-2026-11-01.md:143`): a viewer can tell hindsight-picked history from forward record. Strongest trust cue for skeptical viewers on the board. But new public field and F-11 owns the line. | Owner's yes on Q8 (I'd recommend adding it to the consent list now, at 0 users); consent list updated before render (P6); no second average (TR-7); connected records only; plain date, no badge styling. |
| C3-38 drop-off aggregate before purge | 3 | Supply refusal is kill risk #1 (`market-2026-11-01-cycle2.md:461`); step counts that survive the purge are what tells us where G1 is lost. But no sign-ups while the gate is closed, and PR #62 edits the same purge. | Per-day per-step only, no ids or via; D11 timing unchanged; Privacy Policy covers it; built before the gate opens so day-one data exists. |
| L-16 F-16 trust-and-safety + K18 | 4 | Real, linkable records are better scam bait than fake screenshots (risk #7, `market-2026-11-01-cycle2.md:468`; investment-fraud losses `:139-140`); report and takedown are pre-launch (U2/U3). Needed, but it cannot start until F-9 does. | All cycle-2 F-16 and legal veto conditions verbatim; K18 as a dated addition with no DOB/ID/age estimation and no hide on a single report of an adult; an "impersonating this trader elsewhere" report category (MRC2-6); lapse clause on F-9; flag F-9 as the bottleneck to the owner. |
| L-17 F-17 handle and name integrity | 4 | Look-alike handles are the impersonation vector for real records (MRC2-6). Same F-9 block. | Exactly one normaliser (reuse the `checkDisplayName` helper if it lands first); lapse clause on F-9. |
| L-20 F-20 tokens + contrast test | 3 | Legibility matters for a low-numeracy audience (about a third of US adults at or below the lowest numeracy level, `market-2026-11-01-cycle2.md:71-73`), but the demand evidence is for plain labels, not tokens. Cheap permanent guard; blocked only on PR #55 and fixes #12/#13/#26. | Cycle-2 conditions unchanged; no visible value change beyond the fixes; contrast floor never lowered. |
| L-18 F-18 one trust language | 4 | Plain labels (D24) carry the strongest viewer-side evidence (MRC2-5, `market-2026-11-01-cycle2.md:69-75`); one consistent meaning of "Verified/Demo/Disconnected" is what lets a stranger trust a card in one glance. Heavily blocked. | After L-20; cycle-2 conditions kept; lapse clause on F-11, F-13, F-20, fixes #1/#2/#10. |
| L-19s F-19 call-site sweep | 3 | Consistent number formatting supports readability, but it is mechanical follow-through with no direct demand signal and waits on L-18. | Only if L-18 is re-approved; no displayed value changes except consistency; existing tests kept. |

### Round 1: Pricing and finance

#### Round 1: pricing and finance (pricing-finance)

Lens: unit economics, vendor and infra cost, F-3 billing and the paid hook, build cost vs value. Figures from
`docs/direction/business-2026-11-01.md` §4-§5 (ESTIMATE unless marked): fixed ~$145/month; $1.03 per connected
trader per month, billed until the vendor connection is deleted, frozen records included (VERIFIED there); revenue $0
until `LIVE_BILLING`; one build-loop hour (~$290) ~ two months of beta running cost; $25.7 per session. At 0 real
users the scarce resources are build sessions, review capacity and owner attention, not runtime dollars. Base f467293.

| Item | Score | Reason | Conditions |
|---|---|---|---|
| C3-2 | 3 | Correctness of the record the paid tools sell; S-M and no runtime cost. But it amends `lib/trades.ts:52` and the committee's "exclude and count", so it costs owner attention first; finance-neutral otherwise. | Owner yes listing the amended rule; DK's veto condition (oldest-first only where a basis cannot change, moved-in lots stay tainted); the new `excluded_transferred_out` count is additive schema, percent/count only. |
| C3-3 | 2 | DK probe (buy 100, unseen 2:1 split, sell 101 → -50% Verified vs a true 0%) is a liability-cost case: publishing a wrong loss on a Verified record is the most expensive error class (defamation/misleading-record, business §6 item 7). The gain (one fewer excluded sell in margin accounts) is small at beta size. | Only on the owner's yes amending the "whole, matched part included" ruling (committee log :115-119); must keep exclude-whole whenever any drawn lot could predate an unseen inflow or action; DK probe as a test. |
| C3-17 | 4 | S, no runtime cost, and it keeps the headline honest where records are actually consumed (pane, strip), which protects the value of any paid record view later. Includes #52's silent `notShared` exclusion (`lib/sync.ts:99`). | DK reshape: pane and strip only, no second feed-card line (D22); share card waits owner Q4; build after F3-2 in the same file, no separate slot. |
| C3-15 | 3 | Needed before real users (consent `lib/copy.ts:91` promises a disconnect the app lacks). Cost note: a disconnect that keeps the vendor link still bills ~$1.03/month (~$12/year) per frozen record until BC-16; acceptable at beta size but must be counted. Blocked on F3-3, F-11, Q2. | Owner Q1/Q2 (OD-9) and BC-16 stay owner; no vendor delete; the owner digest or F-15 readout prints the count of disconnected-but-still-linked connections so BC-16's cost is visible; lapses if F3-3/F-11 not merged. |
| C3-9a | 3 | Late sells missed by the 7-day window (`lib/sync.ts:378`) silently understate losses or gains on a Verified record. Vendor billing is per connected user, not per call, so a weekly reconciliation adds no vendor fee; DB and function time are trivial at beta size. Insert-only, so no Q3 conflict. | Insert-only (no update in place, `lib/sync.ts:37` unchanged); stays within F-14's read limit and the shard deadline; the C3-9b revisions table stays an owner flag (Q3). |
| C3-16 | 3 | The only item with a direct recurring-cost effect: a dead authorization keeps billing per user while producing no data and silently loses the trader (retention). Good value, but the vendor signal is unverified (`lib/broker.ts:86-91`) and F3-3 is unmerged; building on an unverified vendor field risks paid rework. | Start only after the vendor's documented signal is confirmed (add it to the vendor question list); no email (Q5); `needs_reconnect_at` never sets `disconnected_at`; readout counts stale links so the fee leak is measured. |
| C3-37 | 4 | Without a day-7 marker the week-8 viewer-return gate cannot be read, and the week-8 reading is the go/no-go on all further spend (business §4 "cheapest path" item 6, BC-7). S, an amendment to F-15, no slot. | One per-account date, no per-viewer events, purged with the account; privacy committee rules on the field (P3); MRC2-3 gate definitions stay owner's. |
| C3-36 | 3 | S, no cost; reduces data-minimisation and legal exposure (size recovery from full-precision returns, `app/u/[handle]/pane/route.ts:22`) before real users. Finance-neutral beyond avoided risk. | Rounding never changes a displayed figure or the ranking order (test compares rendered strings before/after). |
| C3-34 | 4 | Cheapest insurance on the paid running cost: a stalled sync burns vendor fees and gate weeks unnoticed (`app/api/sync/route.ts:34-36` logs nothing). S, no new vendor, no dependency. | Numbers only, no ids or performance figures, `no-store`; no paid monitoring service added (any vendor is the owner's, POLICY H). |
| C3-39/40 | 4 | Billing is off, so de-emphasising the "See Record tools" primary (`app/account/page.tsx:61`) costs $0 revenue now, and a dead end before launch teaches users the paid hook is broken. S, one settings-lane slot. | With billing open, F-3 e2e snapshots unchanged (entry points restored exactly); "not open yet" names no date or price; no new price surface; business lead signs off the F-3 §1 change; C3-40 amends F-1 plan `logs/F-1/plan.md:75-77` and is listed as such. |
| C3-42 | 3 | Needed before launch (`docs/COMPLIANCE.md:75`), M, no runtime cost; scope is owner Q7 and BC-10. Not a gate-path item for the beta money question. | Owner-conditional on Q7/BC-10; percent only, no ciphertext or vendor secret; label stays F-3 committee condition 11 until it ships. |
| C3-35 | 2 | A cost fix for traffic that does not exist: ~0.37 s per image request is inside Vercel Pro's included usage at beta volume; build session (~$26+) exceeds a year of the saving. Stale-image risk is a trust cost. | Revisit when F-15 shows image traffic near the plan's included usage; record change always changes the URL; disclaimer and absolute dates stay; after F3-26. |
| C3-43 | 2 | Small value, adds a public field (Q8, P6 consent list) and needs F-11, which is not built; spends owner attention for a secondary line. | Owner Q8 first; never render `consent_at` before the consent line changes (legal); no second headline average (TR-7). |
| C3-38 | 3 | Funnel step counts are what turns the ~1,250-contacts / ~46 owner-hours recruiting estimate into a measured cost per connect if G1 misses. S. But zero sign-ups exist yet, and PR #62 still edits the purge. | After PR #62 merges; per-day aggregate, no identifiers; D11 purge unchanged (test: no attempt id remains). |
| L-16 | 4 | Launch-path (business B8/BC-2): fund launch-path work first. Re-approval is cheap; cost is that it lapses again if F-9 never starts, which is paid council rework. | Keeps every cycle-2 decision and veto condition word for word; K18 addition with legal's veto conditions (no DOB/ID/age estimation, owner runs any deletion); lapse clause on F-9; recommend the orchestrator schedules F-9 so this stops lapsing. |
| L-17 | 4 | Launch-path (U2 reserved handles, BC-2); S-M, no runtime cost; protects against impersonation that would make the paid record worthless. | Keeps cycle-2 conditions; lapse clause on F-9's normaliser; reuse (not duplicate) `checkDisplayName` from `claude/fix-user-text-safety`, no second normaliser. |
| L-20 | 3 | Partly launch-path (A1/B9), cheap, and unblocks L-18/L-19s, but every prerequisite is unmerged (PR #55, fixes #12/#13/#26); likely idle all cycle. | Keeps cycle-2 conditions; lapse clause; no new dependency without owner approval. |
| L-18 | 2 | Same finance view as the business lead's cycle-2 dissent: ~zero effect on the week-8 gates, its false parts are already fixes #1/#8/#10, and it waits on F-11, F-13, F-20 and three fixes, so the slot sits idle and lapses again (another paid council round). | If re-approved: only after L-20; keeps conditions word for word; lapse clause. |
| L-19s | 2 | Depends on L-18; polish with no gate or cost effect; queued behind three unbuilt items. | Only if L-18 re-approved; keeps cycle-2 conditions. |

Process note (OPINION, not a vote): re-approving items that cannot start this cycle costs a council round each time
they lapse; the cheaper lever is getting F-9 and PR #55 merged. Whether to limit councils or PRs in flight is the
owner's (BC-14, cycle-3 Q10); not decided here.

### Round 1: Growth

#### Round 1, growth (activation, sharing, return visits, go-to-market)

Base origin/main f467293. Lens: what moves the go-to-market decision (`docs/IDEAS.md:119-125`) forward: week 0 needs
live Terms/Privacy Policy, consent, deletion, contact, real auth, vendor permission, full name clearance, **the report
action and reserved handles**, D20/D21/D27/D29 and **first-party gate counters**; founder-led invitations to 10-20
anchors; referral is attribution only; **no rewards of any kind**; share prompts time-based only; no cookie. Growth at
0 users means: clear week-0 prerequisites, make sure we can measure G1-G4 from day one, and keep the shared record
credible (a record a viewer catches hiding a loss kills the anchor-led word of mouth). Nothing below adds a reward,
streak, frequency incentive or prompt.

| Item | Score | Reason | Conditions |
|---|---|---|---|
| C3-2 transfers as share moves | 4 | The shared profile is the growth asset; a loss that vanishes on transfer-out (or 100 recorded units excluded as "corporate", `lib/trades.ts:52`) is the exact thing an anchor's critics would find and post. Credibility first, owner-conditional. | Owner's yes (amends `lib/trades.ts:52` + corporate-actions committee F3c). DK veto: "oldest first" only where it cannot change a basis; moved-in lots tainted; unknown kinds tainted. Transferred-out line neutral, no hint of wrongdoing. Ledger slot with C3-3 and F3-15 copy. |
| C3-3 oversell publishes recorded part | 3 | Same credibility logic, but the DK probe (unreported 2:1 split → a false -50% Verified) is worse for activation than an honest exclusion: an anchor whose shared record shows a fake loss leaves and tells others. Most of the harm today is the false cause line, which F3-15's copy fixes. | Owner's yes (amends the "whole, matched part included" ruling). Must not publish in the DK probe case (keep exclude-whole when any unseen inflow or split could explain the extra units; probe as a test). Copy states no cause (legal veto). Ledger slot with C3-2. |
| C3-17 exclusion counts beside headline | 3 | Small credibility gain on the pane, where swipe viewers read records; low leverage on activation or return. Fine as reshaped. | One muted line, n > 0 only, links to the profile reasons; same sum function as the profile (incl. `notShared`, `lib/sync.ts:99`, if counted there); never pushes the F3 disclaimer out at 360 px; share card untouched until owner Q4. |
| C3-15 in-app disconnect | 3 | A visible way out lowers the fear of connecting (activation of the first 100), and consent already promises it (`lib/copy.ts:91`). But blocked on F3-3, F-11, owner Q2/OD-9: an approval now would lapse. | Owner flags first; approve only when F3-3 and F-11 can merge this cycle; legal veto (nothing reads the connection after step 2; step 1 links delete). No retention or "are you sure" copy. |
| C3-9a late-sell reconciliation | 3 | A trader who sees a recent sell missing from their record stops sharing it; insert-only and S. Not a growth lever before real connections. | Insert-only within F-14's read limit; no "corrected" copy that suggests the trader edited anything; ledger slot. |
| C3-16 connection health | 3 | The main trader-retention mechanic later (a silently stale connection = a record that stops updating = a trader who stops sharing), but the vendor signal is unverified and there are 0 real connections. | Wait for the vendor docs and F3-3; trader-only line; no email until owner Q5; never freezes or hides a record; connection slot with C3-15. |
| C3-37 day-7 marker in F-15 | 5 | Without it G4 (viewer return) can't be read at week 8 and the go-to-market "first-party gate counters" prerequisite is incomplete; sessions purge and `last_seen_at` is overwritten (`lib/auth/sessions.ts:46`). S, no slot. | Dated amendment to F-15; at most one first-seen day + one returned-after-day-7 day per account, date only, server-side, deleted with the account, never public, never shown to traders; labelled "signed-in viewers only", never as G4 (MRC2-3 is the owner's); privacy committee rules on the field first. |
| C3-36 round public payloads | 3 | Neutral to growth; a privacy gap worth closing before real traders (a recoverable size would scare off anchors). | No displayed figure changes (snapshot); stats/ranks/CIs on stored values; every public payload incl. cached and feed HTML. |
| C3-34 health endpoint + cron 401 log | 3 | During the first 100 traders a silent sync stall means stale shared records and lost trust; cheap. Ops, not a lever. | Booleans/times/hours only (no user counts, ids, handles, figures); no-store; never logs any part of the bearer value. Chore with the fixes. |
| C3-39/40 record tools while billing off + settings order | 4 | Direct activation defect: every signed-in user's primary next step is a locked page with no way back (`app/account/page.tsx:61`, `app/tools/page.tsx:69-78`). And Delete as the heaviest element on every settings visit is out of proportion. S. | No price, date, "coming soon", waitlist or email capture (legal veto; a waitlist is not a go-to-market decision we have); locked /tools links back into the feed; open-state F-3 e2e unchanged; Delete stays visible on /settings at 360 px, S9 view 2 unchanged; business lead signs off on the F-3/F-1 plan amendments. |
| C3-42 full data export | 3 | Part of the pre-launch privacy set the go-to-market week 0 depends on, but scope is owner Q7 and the Privacy Policy is the owner's (BC-10). | Owner flags first; legal vetoes (real auth only, no secrets, no other users' or reporter data); label never promises more than the file holds. |
| C3-35 versioned share images | 2 | Unfurls are the share loop, but this is a cost fix for traffic we don't have, and a long-cached stale image is a trust risk on the most-shared surface. | When it returns: record change always changes the URL; deleted/hidden profiles' images 404 at origin and CDN; disclaimer and absolute dates stay. |
| C3-43 "Public since · n closes since" | 3 | The strongest credibility line a shared link can carry (the part not picked with hindsight), which helps anchors' links convert viewers. Blocked: owner Q8 and F-11. | Owner's yes on Q8 and the consent list names it first (P6); "Record since" stays primary (TR-3); no average beside it (TR-7); no "proof"/badge styling; after F-11. |
| C3-38 drop-off aggregate before purge | 4 | If G1 misses at week 8 this is the only way to see where sign-ups fall off; it has to exist before the gate opens, or day-one data is purged (`lib/privacy-purge.ts:180`). S, aggregate only. | After PR #62; keyed by day and step only (no attempt id, via, email, IP, UA); purge timing and scope unchanged (D11); Privacy Policy covers it before real users; never feeds any trader-facing count or prompt. |
| L-16 F-16 trust-and-safety + K18 addition | 4 | "The report action" is a named week-0 prerequisite (`docs/IDEAS.md:120`); without it there is no launch at all. Blocked on F-9, which also holds L-17: the owner should hear F-9 is the critical path for go-to-market. | Every F-16 cycle-2 veto condition verbatim; K18 addition with legal's conditions (single report never hides an adult's record; owner review; owner runs deletions; no DOB/ID/age estimation); lapse clause on F-9. |
| L-17 F-17 handle and name integrity | 4 | Reserved handles and full name clearance are named week-0 prerequisites; an impersonating handle on a forwarded share link is a direct trust failure in the outreach loop. Blocked on F-9. | All cycle-2 conditions verbatim; exactly one normaliser (if `checkDisplayName` from the text-safety branch lands first, F-17 reuses it; DK logs the choice); lapse clause on F-9. |
| L-20 F-20 tokens and contrast test | 3 | Accessibility is a POLICY floor and the contrast test is a cheap guard; small growth effect. Re-approve when PR #55 and fixes #12/#13/#26 are close. | Cycle-2 conditions unchanged (no visible value change beyond the fixes; floor never lowered). |
| L-18 F-18 one trust language | 3 | One consistent meaning of "Verified" and "Demo" across feed, card and profile is what makes a shared link credible, but the chain (F-20, F-11, F-13, fixes #1/#2/#10) is long; the false parts are already fixes. | After L-20; cycle-2 conditions verbatim; lapse clause. |
| L-19s F-19 call-site sweep | 2 | Formatting consistency; no growth effect; after L-18. | Only if L-18 is re-approved; cycle-2 conditions verbatim. |

Recommendation to the owner (theirs to decide, not this council's): F-9 is the critical path for the go-to-market
week 0 (it holds the report action and reserved handles). Starting it moves launch more than any item on this ballot.

### Round 1: UX lead

#### Round 1, UX lead (flows, clarity, task success at 360 px; traders and signed-out viewers)

Base f467293. Lens: can a trader finish the task the app tells them they can do, and does a signed-out viewer on a
360 px phone read a record correctly the first time? Evidence: `docs/direction/cycle3-2026-11-01/screenshots/`.
Screens I checked: `p2-360-settings.png`, `p2-360-account.png`, `p2-360-tools.png`, `p1-360-pane.png`, `p4-360-excluded-line.png`.

| Item | Score | Reason | Conditions |
|---|---|---|---|
| C3-2 transfers as share moves | 4 | A viewer cannot tell whether a loss was hidden. Today a transfer in excludes 100 recorded units as "corporate" (`lib/corporate-actions.ts:200`, `lib/trades.ts:171`), and a full move out leaves no line at all. A record that loses trades without saying so fails the viewer's one task: reading the record honestly. | Owner's yes first (amends `lib/trades.ts:52`). DK's oldest-first limit applies. The transferred-out line is one plain sentence at 360 px with no blame ("‹n› positions moved to another account before they closed"). It sits in the same muted block as the other counts (`app/u/[handle]/page.tsx:283-292`) and does not add a new visual pattern. Build in the same slot as C3-3, with F3-15's copy. |
| C3-3 oversell publishes recorded part | 3 | The copy we ship today is false. "1 earlier position excluded: no matching entry in the imported history" (`p4-360-excluded-line.png`, `lib/copy.ts:69`) blames history that exists. But DK's probe (an unreported split published as a false -50% Verified) is worse for a viewer than an exclusion: a wrong number misleads, a counted gap does not. | Owner's yes first. The DK probe case stays excluded and counted (test). The count line says "sells larger than the recorded position", never "short sale" unless the vendor says it was one. Any published part carries no "partial" word. If the probe case can't be told apart, ship only the copy fix and keep the whole exclusion. |
| C3-17 exclusion counts beside the headline | 4 | The pane is where SW-1 sends signed-out viewers (`p1-360-pane.png`). It shows win rate and average with no sign of exclusions, so the counts live on a page most viewers never scroll to. Cheap, and it is what makes C3-2 and C3-3 visible. | One muted line, only when n > 0, placed directly under the stats row on the pane. It is a real link to the profile's count block (an anchor), not the bare text "(see profile)". One shared sum function with the profile, so the two never disagree, and it includes #52's `notShared` if that is counted. No warning colour or icon. Tap target ≥ 44 px tall at 360 px. No second line on feed cards (D22). Share card waits Q4. Starts after F3-2. |
| C3-15 in-app disconnect | 3 | The task fails today. Consent says "Your record stays public if you disconnect" (`lib/copy.ts:91`), but /settings has no control for it (`app/settings/page.tsx:20-46`). Must exist before real users. Not buildable now: F3-3, F-11 and owner Q2 are all open. | Step 1 says in one sentence what stays public and what stops, then shows a clear Cancel. No guilt copy. The same screen links to Delete for someone who wants the record gone. After step 2 the trader lands on their own profile and sees F-11's "Disconnected ‹date›". Demo users see nothing. Goes in the settings slot when it is unblocked. |
| C3-9a late-sell reconciliation | 3 | A real sell that never appears on a Verified record is a silent trust failure, and the viewer has no way to notice it. Insert-only is proportionate. No new UI is needed. | Ride in the ledger slot. No "corrected" wording that suggests the trader changed anything. A reconciled trade appears in date order and is not flagged as new. |
| C3-16 connection health | 3 | A stale link is the main reason a trader's record quietly stops updating. Worth it before real traders, but the vendor signal is unverified and there are 0 connections today. | Trader-only line on their own profile, one tap to /connect with TR-6 claims kept. Signed-out viewers see nothing new. No email until Q5. `needs_reconnect_at` never hides or freezes the record. |
| C3-37 day-7 marker (F-15 amendment) | 3 | Nothing changes on screen. It lets F-15 answer whether viewers come back, which is the UX outcome we care about. S, and it needs no slot of its own. | One date per account, purged with the account. Privacy committee rules on the field. MRC2-3 definitions untouched. |
| C3-36 round public payloads | 3 | Nothing changes on screen, and it closes a consent-versus-payload gap. | No figure on any screen changes: snapshot test of pane, chart scrub labels and feed at 360 px before and after. The chart's scrub still lands on the right trade after rounding dates to days, and same-day closes keep a stable order. |
| C3-34 health endpoint + cron 401 log | 3 | No user-facing UI, but a stalled sync shows viewers stale records as if current. A cheap guard. | Numbers only, `no-store`, no token echoed. Build as a chore with the fixes, no slot. |
| C3-39/40 Record tools while billing off + settings order and weight | 5 | Seen at 360 px, the clearest flow defect on main. /settings makes a purple primary "Delete my profile" the heaviest element on every visit, with an at-rest "Keep it" (`p2-360-settings.png`, `app/settings/page.tsx:43-44`). It shows a "Record tools" heading followed by a link with the same name (`:27-28`). Locked /tools offers no next step (`app/tools/page.tsx:69-78`). /account's primary button leads there (`app/account/page.tsx:61`). S, no prerequisites. | View 1 has no primary-styled destructive control. Delete stays one tap from /settings and S9 view 2 is unchanged. No duplicated heading and link name. The locked /tools page has exactly one non-legal link back into the app. With billing open, F-3's e2e snapshots are unchanged. "Account" name kept. Fold C3-44's gate into this slot. e2e at 360 px. Business lead signs off on the F-3 §1 change, and the F-1 plan change is recorded. |
| C3-42 full data export | 3 | The UX defect today is the label: "Download my data" sits above a file of views, notes and subscription status only (`p2-360-account.png`, `lib/copy.ts:674`). Scope is the owner's (Q7, BC-10). | Until it's built, the help line stays directly under the button (it is today; keep it there). When built: one file, readable field names, percent only, no secrets. |
| C3-35 versioned share images | 2 | Users see no gain now, and a stale cached card would show a viewer old figures. Blocked on F3-26. | When it returns: a record change always changes the URL (test). Absolute dates and the disclaimer stay in the image. |
| C3-43 "Public since · n closes since" | 3 | The single most useful line a skeptical viewer could read, but it adds a new public field (owner Q8, P6) and F-11 owns the line. | Owner's yes on Q8 and the consent list updated first. One secondary line under F-11's status, plain date, no badge styling. No average beside it. Fits on one line at 360 px or wraps cleanly. |
| C3-38 drop-off aggregate before purge | 2 | Funnel diagnostics for sign-ups that can't happen while the gate is closed, and PR #62 edits the same purge. | When it returns: a per-day aggregate with no identifiers, D11 intact, built before the gate opens. |
| L-16 F-16 trust and safety + K18 | 3 | The shape is sound for viewers (a neutral hidden state, no "under review" text), but it can't start: F-9 has not begun. Re-approving only queues another lapse. | Keep every cycle-2 condition word for word, and K18's legal veto conditions. The report entry point is one secondary control, never next to Follow or Share, ≥ 44 px. Tell the owner F-9 is the bottleneck. |
| L-17 F-17 handle and name integrity | 3 | Inline, announced rejection messages (`aria-describedby`, `aria-invalid`) are good sign-up UX, but it is blocked on F-9's normaliser. | Keep the conditions. Exactly one normaliser. Each rejection message says what to change in plain words and stays visible beside the field at 360 px. |
| L-20 F-20 design tokens + contrast test | 4 | The cheapest permanent guard for readability at 360 px in both schemes. It is blocked only by work already open (PR #55, fixes #12, #13, #26). | Re-approve conditional on PR #55 and the three fixes merging. No visible value changes beyond the fixes. The floor is never lowered. Focus ring ≥ 3:1. |
| L-18 F-18 one trust language | 3 | Viewers need it: a keyboard reach to what Verified means, and a definition shown as visible text, not a tooltip. Too many prerequisites are unmerged (F-11, F-13, F-20, fixes #1, #2, #10). | Keep the conditions. The definition is reachable by keyboard and touch without hover. After L-20. |
| L-19s F-19 call-site sweep | 2 | Its user-visible part (the What's-this range line) waits on L-18, which is itself blocked. Re-approving now buys nothing. | Keep the conditions. Only if L-18 is re-approved. |

Slots I'd back: settings (C3-39/40 + C3-44), ledger (C3-2 + C3-3 + C3-9a, owner-conditional), and pane (C3-17 + C3-36,
after F3-2). C3-37 rides with F-15; C3-34 rides as a chore.

### Round 1: Product designer

#### Round 1: product designer (visual hierarchy, design system 2026-11-01, DESIGN Stage 5)

Base f467293. Lens: does the change keep one clear visual hierarchy per screen (one primary, the headline first, trust
marks and counts in their decided places), stay inside the design system spec (`docs/direction/design-system-2026-11-01.md`
settled conflicts 1-15, §4.3 placement, §5 tokens) and serve Stage 5 (TR-1..TR-8, CH-1/2, SW-1)? Owner-conditional items
are scored on their merit; the owner's yes stays the owner's.

| Item | Score | Reason | Conditions |
|---|---|---|---|
| C3-2 transfers as share moves | 4 | Today a moved-out position vanishes with no line and a moved-in unit blames "corporate action" on 100 recorded units (`lib/trades.ts:171`): the profile shows a wrong figure or a wrong reason, both TR-1 failures a viewer can't see. The fix makes every outcome a shown trade or a named count. | Owner's yes (amends `lib/trades.ts:52` and the committee rule); DK's "oldest first only where it cannot change a basis" condition verbatim. Design: the new `excluded_transferred_out` line joins the existing exclusion lines (`app/u/[handle]/page.tsx:281-289`) as one grouped block under one `#excluded` anchor (DS-7 anchor list), same `muted` style, no warning or loss colour; strings in `lib/copy.ts`; `VERIFIED_DEFINITION` (design system §4.1 line 438, "shares transferred in") and /how updated in the same PR so the definition and the profile never disagree. |
| C3-3 oversell publishes recorded part | 2 | Through this lens the worst outcome is a false figure in the Verified look; the DK probe (unreported 2:1 split → −50% Verified when the truth is 0%) shows the "every drawn lot recorded and untainted" test can't detect the missing inflow. A muted count with a wrong reason is a copy defect; a wrong headline-weight figure is a trust defect. | Only on the owner's yes. The DK probe becomes a failing-first test that must pass (no figure published); fix the false reason in the oversell line (`lib/copy.ts:69`) as a copy change regardless, so the count names "sells larger than the recorded position", not missing history. |
| C3-17 exclusion counts beside the headline | 4 | Counts render only far down the profile (`app/u/[handle]/page.tsx:281-289`); the pane (`app/pane.tsx:52-56`) shows win rate and average with no sign of exclusions, yet the pane is where a swiped viewer reads the record (SW-1). One muted line belongs right under the headline. | As DK reshaped: not on feed cards (D22 one record line); card and images unchanged until Q4. Design: one line, `muted` token, directly under the headline stats and above the CH-1 chart, never in loss/warn colour; it is a real link to the profile's `#excluded` anchor named with the count (not bare "(see profile)"); the sum comes from one shared function with the profile; e2e at 360 px signed out shows D20's disclaimer still in view on the pane; trade/month strip only if it fits F-12's strip without a second strip line. |
| C3-15 in-app disconnect | 3 | Consent promises a disconnect the UI does not offer (`lib/copy.ts:91`); right in principle, but blocked on F3-3, F-11 and Q1/Q2. | When unblocked: "Connected brokers" is the first /settings section (C3-40 order); Disconnect is a secondary control at rest, step 2's confirm is the only primary on that view (mirrors S9); step 1 states what stays public in /how's words; F-11's "Disconnected ‹date›" label is the only new public mark; no destructive red. |
| C3-9a late-sell reconciliation | 3 | Invisible on screen except that missing closes appear; improves TR-3/TR-8 completeness of what is shown. No design risk. | Insert-only; a newly found close appears in date order with no "new"/"late" styling and no celebration; F-11's "updated" stays the last successful vendor read (settled conflict 15). |
| C3-16 connection health | 2 | With 0 real connections and an unverified vendor signal it is premature. | When it returns: trader-only line on their own profile using `--warn`, never loss red (the design system names failed imports in loss red as a defect); signed-out view pixel-identical (snapshot); D29/F-11 idle line unchanged. |
| C3-37 day-7 marker (F-15 amendment) | 3 | No UI; it lets F-15 read whether viewers return, which is what any later design test (KV, V-1..V-3) needs as its baseline. | Amends F-15 only; no per-viewer events; purged with the account; privacy committee rules on the field. |
| C3-36 round public payloads | 4 | "Send what the screen shows" is the right contract between payload and screen; the pane already prints a day (`app/pane.tsx:77`). S. | Rounding never changes a printed figure: a parity test shows the pane's headline (computed from the payload) prints the same as the profile for an odd-return fixture (DECISIONS #11, click and swipe profiles match; double rounding at the 0.05 boundary is the case to test); dates render as the same UTC day on profile and pane (F-11 date rule), so a 23:30 close never shows two different days. |
| C3-34 health endpoint + cron 401 line | 3 | Ops, no screen. Worth it, but outside this lens. | Numbers only, `no-store`, no figures; not linked from any public page. |
| C3-39/40 Record tools while billing off + settings order/weight | 5 | The clearest hierarchy defect on the ballot: view 1 of /settings renders "Delete my profile" as a full-width primary (`app/settings/page.tsx:43`, `className="button wide"`), the heaviest element on every visit, while the useful links are plain `<p>` lines; /account's only primary leads to a locked page with no way back (`app/account/page.tsx:61`). S, before real users. | Recorded as amending F-1 plan `logs/F-1/plan.md:75-77` (view 1 weight) and F-3 `plan.md:142`/§1 in the billing-closed state only. One primary per view at most; view 1's Delete is secondary, last, and still one tap to view 2; view 2 (S9) unchanged and its primary stays the only delete tap; no at-rest "Keep it"; "Record tools (not open yet)" is muted text, not a button; locked /tools gets one plain link back to the feed; no new colour literal (F-20 rule); "Account" name kept; billing-open F-3 snapshots unchanged; build path per CLAUDE.md three-version rule unless the owner exempts it (Q1). |
| C3-42 full data export | 3 | Right before launch; the scope is the owner's (Q7, BC-10). | Until built the label stays the committee's and the help line stays exact (`app/account/page.tsx:63-64`); the export button stays secondary. |
| C3-35 versioned share images | 3 | Cost and freshness of the most-shared surface; blocked on F3-26. | Image render snapshots unchanged byte-for-layout; absolute dates kept (F-11); a stale long-cached image is never served after a record change. |
| C3-43 "Public since · n closes since" | 3 | A strong trust line (the part not picked with hindsight), but a new public field (Q8) and F-11 owns the status line. | Owner's yes and consent list first; it sits inside F-11's StatusLine (design system §4.3, rows already 2 lines at 328 px), not a third standalone row; "Record since" stays primary (TR-3); no average beside it (TR-7); plain text, no badge or pill styling; pane disclaimer still in view at 360 px. |
| C3-38 drop-off aggregate | 2 | No screen and low proportion with no real sign-ups. | Per-day counts only, no identifiers; after PR #62. |
| L-16 F-16 trust-and-safety slice + K18 | 4 | Its neutral hidden state ("not available right now", own title, one h1, no figures in the image) is well designed and protects innocent records from a visible mark. | Earlier decisions and veto conditions word for word; lapse clause (waits F-9); K18 with legal's conditions (no DOB/ID/age estimation; owner runs deletion); the report action is a quiet menu item, never a prominent control on the record. |
| L-17 F-17 handle and name integrity | 4 | Display names can carry check glyphs and the word "Verified" today, which forges the one trust mark the design system protects (settled conflict 1, `TRUST_LOOK`). | Earlier decisions verbatim; waits F-9's normaliser (or the `checkDisplayName` on `claude/fix-user-text-safety`, if the orchestrator rules it is the same normaliser; never two). |
| L-20 F-20 tokens + contrast test | 5 | The backbone of the design system (§5): without the test every later screen change can regress light Verified (3.77:1) or gain/loss under deutan (ΔE00 2.8). It blocks only on work already open (PR #55, fixes #12/#13/#26). | Cycle-2 conditions verbatim: no visible value change beyond the fixes; floor ΔE00 ≥ 9 never lowered; image colour table tested, no image value change (O-2 owner's); lands first in the `app/globals.css` slot. |
| L-18 F-18 one trust language | 4 | Settled conflict 8 and §4 are the core of the spec: three Verified wordings and three Demo names ship today, and the badge sits on the h1 line instead of the stats row. Many prerequisites, so it may idle, but it should stay approved. | After L-20; earlier decisions verbatim; lapse clause for F-11, F-13 and fixes #1, #2, #10; D25/D27 wording waits the idea board. |
| L-19s F-19 call-site sweep | 4 | Finishes one `pct()`/`tone()` with Flat across the 20+ sites listed in `lib/format.ts:17-40`; today 0.0% is painted red or green. | Only if L-18 is re-approved; opens as rework after F-18 merges; ranking and pinned literals untouched (`F-19:57`); share images keep the ASCII sign until the render test passes. |

### Round 1: Data-visualization designer

#### Round 1, data-visualization designer (slug: dataviz)

Base f467293. Lens: does each figure a viewer reads (headline, chart, range, count) say exactly what the data
supports: percent only with 0% on the axis (CH-1/CH-2), ranges that hold their own average and come from
`confidence()` (TR-9, F-19), exclusions visible where the figure is read, one number format (F-19). A hidden loss and a
falsely precise figure both fail this lens; a guessed figure under Verified fails it worst.

| Item | Score | Reason | Conditions |
|---|---|---|---|
| C3-2 transfers as share moves | 4 | Today a transfer-in of 1 unit taints 100 priced units (`lib/trades.ts:171`, `lib/corporate-actions.ts:200`) and a full move out makes a loss vanish with no count: the headline, chart and range all silently shift. Treating a move as a share move keeps priced lots in the figures and turns the rest into a named count. | Owner's yes (amends `lib/trades.ts:52`). DK veto: "oldest first" only where it cannot change a basis (vendor names lots, whole position moves, or candidate lots share a basis), else remaining lots stay tainted; moved-in lots stay tainted. Every probe ends as a shown trade or a named count; property test that a TRANSFER never changes a sell whose drawn lots predate it. New count feeds the C3-17 sum. |
| C3-3 oversell publishes recorded part | 2 | An oversell proves an unrecorded inflow, so the basis of the matched part is not known; DK's probe (buy 100 @100, unreported 2:1 split, sell 101 @50) would print -50% Verified where the truth is 0%. A guessed loss on a Verified chart is a worse figure than an honest count. The real defect is the false cause in `lib/copy.ts:69`, which F3-15's copy and C3-17's visibility fix without guessing. | If the owner says yes anyway: the brief names a signal that rules out an unseen inflow (DK); the extra units get their own neutral count, not "short sale" unless the vendor says so; empty or emptied ledger keeps exclude-whole; committee test kept. |
| C3-17 exclusion counts beside headline | 5 | Counts live only on the profile (`app/u/[handle]/page.tsx:283-292`); the pane and record strip print win rate, average and range with no sign that figures omit anything, and #52 added a silent exclusion (`lib/sync.ts:99` `notShared`) with no count at all. A headline without its exclusions is the most misleading figure we ship. | One sum function shared by profile, pane and strip (includes positions, future, corporate, paper, C3-2's transferred-out and `notShared` if it is a trader's own exclusion), so surfaces never disagree; one muted line only when n > 0, linked to the profile reasons; neutral text, no warning colour or icon, sign/colour not the only cue; word the unit truthfully ("excluded from these figures", since `excluded_positions` counts positions, not trades); feed card single line (D22) and share card untouched until Q4; e2e signed out at 360 px. |
| C3-15 in-app disconnect | 3 | Lens-neutral apart from TR-5: a frozen record must keep every figure and its chart unchanged. Owner questions and F3-3/F-11 block it. | Disconnect never changes `closed_trades`, chart or range; F-11's "Disconnected ‹date›" shows beside the figures; build only once prerequisites merge. |
| C3-9a late-sell reconciliation | 4 | A sell posted more than 7 days behind is never read (`lib/sync.ts:378`), so a closed loss can be missing from the figures with no count: a silent omission on a Verified record. Insert-only keeps the owner's immutability rule. | Insert-only, within F-14's read limit; a late-inserted close rebuilds through `rebuildTrades` (never row patches); no "corrected" label implying the trader changed anything; fake-vendor e2e with a sell 10 days back. |
| C3-16 connection health | 2 | Matters for stale figures later; with 0 connections and an unverified vendor signal it is premature. | Trader-only line; never freezes, hides or dims a record's figures; no email until Q5. |
| C3-37 day-7 marker | 3 | Outside my lens; S, folds into F-15 without a slot. | DK and privacy-committee conditions; never shown as a figure to traders. |
| C3-36 round public payloads | 4 | Full-precision returns and ms timestamps in public JSON (`app/u/[handle]/pane/route.ts:22`, `lib/feed.ts:197-198`) carry more precision than any screen shows and more than consent allows. 4 decimals of fraction (0.01%) is still finer than the 1-decimal display, so no figure changes. | Round at the payload edge only: `confidence()`, ranks and ranges compute from full precision server-side, and any range the client draws comes pre-computed; snapshot test that no printed figure, tone or Flat changes; same-day trades stay distinct, correctly ordered chart points (sort key applied before rounding, DK); the chart's x placement and scrub labels use days consistently. |
| C3-34 health endpoint + 401 log | 3 | Owner-facing, no viewer figure; proportionate as a chore. | No performance figures or user counts in the body; `no-store`. |
| C3-39/40 record tools + settings order | 3 | Not my lens; sensible S fixes. | DK: names `F-1/plan.md:75-77` and F-3 `plan.md:142` as amended; view 2 unchanged. |
| C3-42 full data export | 3 | The export is a figure surface too; scope is owner Q7/BC-10. | Percent only (no units or prices, matching `closed_trades`), returns at the same precision rule as C3-36's public payload or full precision stated in a header, exclusion counts included so the file reconciles with the profile. |
| C3-35 versioned share images | 2 | A long-cached image showing stale figures is a dishonest figure; no traffic justifies the risk now, and F3-26 is unmerged. | Version key covers every input that changes a figure or label (DK list); mismatched version never long-cached; absolute dates and disclaimer stay in the image. |
| C3-43 "Public since · n closes since" | 3 | Strongest out-of-sample cue a record can carry, but a new public field (Q8, P6) and F-11 owns the line. | Owner first; count only, no second average or range beside it (TR-7) unless it comes from `confidence()` with its own n; plain absolute date; connected records only; `consent_at` not rendered before the consent list changes (legal). |
| C3-38 drop-off aggregate | 2 | Outside my lens; diagnostics for sign-ups that cannot happen yet. | DK conditions; after PR #62. |
| L-16 F-16 + K18 | 3 | Outside my lens; shape sound but F-9 is unstarted, so it lapses again. | Cycle-2 conditions and legal's K18 veto conditions word for word; hidden state neutral, never "under review". |
| L-17 F-17 name integrity | 3 | Outside my lens; same F-9 block. | One normaliser (the text-safety branch's helper is reused, not duplicated). |
| L-20 F-20 tokens + contrast test | 4 | The only permanent guard on gain/loss legibility: light gain vs loss is ΔE00 2.8 under deutan today; the ΔE00 >= 9 floor and the image colour table protect every chart and card. Blocked only on PR #55 and fixes #12/#13/#26, which are open. | All cycle-2 conditions word for word; floor never lowered; image colours not exempt; lapse clause on PR #55 + fixes. |
| L-18 F-18 one trust language | 3 | A badge's meaning beside the stats row matters to how figures are read, but it waits on four features and five fixes. | Cycle-2 conditions word for word; after L-20; badge never colour-only. |
| L-19s F-19 call-site sweep | 4 | The core honest-figure guard: lo <= avg <= hi on every surface's printer, one sign, Flat with text, tone that matches the printed number. Re-approve; it waits only for F-18 and fix #7. | Cycle-2 conditions word for word; recommend to the owner/orchestrator that the every-surface range property test may run as soon as fix #7 merges, without waiting for F-18 (it touches printers, not the stats-row copy F-18 rewrites); `confidence()`, ranking and D23/D24 untouched; images keep the ASCII hyphen until the glyph render test passes. |

### Round 1: Accessibility specialist

#### Round 1 ballot: accessibility specialist (a11y)

Lens: POLICY A1 (`docs/POLICY.md:153-155`), WCAG 2.2 AA: contrast (1.4.3, 1.4.11), colour not alone (1.4.1), names
(4.1.2, 2.4.4/2.5.3), focus (2.4.7, 2.4.11), reflow at 320 px (1.4.10), status messages (4.1.3), error prevention
(3.3.4), consistent help/navigation (3.2.6, 3.2.3). Base f467293. Measured: `--muted` is 5.03:1 on light bg, 5.25:1
on light surface, 5.84:1 / 5.35:1 dark (`app/globals.css:5,15`), so a muted line passes 1.4.3 today.

| Item | Score | Reason | Conditions |
|---|---|---|---|
| C3-2 | 3 | Correctness item; a11y-neutral except the new profile line, which must be real text. The owner flag and DK's basis condition decide it. | New `excluded_transferred_out` line is plain text in the counts block (`app/u/[handle]/page.tsx:289-292`), same muted token, no icon-only or colour-only cue, reads correctly at 320 px. Owner's yes first. |
| C3-3 | 2 | DK's probe (-50% Verified when truth is 0%) is a wrong figure that every user, including screen-reader users who get no visual context, takes at face value. | If ever built: owner yes, DK probe passes, short-sale count line is text with its own label. |
| C3-17 | 4 | Puts the exclusion fact in text where the headline is consumed, so it is not only discoverable by visiting the profile; muted passes AA (5.0-5.8:1). | Plain text, `--muted` token (≥4.5:1 both schemes, covered by F-20's pair test once landed); in DOM order right after the headline so it is read with it; "see profile" is a real link with a descriptive name (not "here"), 44 px target or inline text link per 2.5.8; no reflow break at 320 px; never inside the disclaimer or displacing it; not hover/tooltip-only (1.4.13). |
| C3-15 | 4 | A withdrawal control people can actually operate by keyboard and screen reader is an A1 and consent-ease matter; two-step matches 3.3.4. | Each Disconnect button named with its institution ("Disconnect <institution>", 2.5.3/4.1.2); step 2 moves focus to the confirmation heading; result announced in `role=status` (4.1.3); no time limit on step 2; cancel reachable and focusable; destructive control not colour-only. Owner Q2/OD-9 and F3-3/F-11 first. |
| C3-9a | 3 | No a11y effect; record correctness. | Any "n trades corrected" copy later is text, not an icon. |
| C3-16 | 3 | Useful, and the trader-only line is a clear text next step; vendor signal unverified. | Line is text with a link named "Reconnect your broker" (not a bare "Reconnect" repeated); not colour-only (warn colour paired with words); static on load, so no live region needed, but if shown after an in-page sync use `role=status`; 320 px reflow. |
| C3-37 | 3 | No a11y effect; privacy committee rules on the field. | None from this lens. |
| C3-36 | 3 | Neutral for a11y; payloads should match what screens (and their accessible names) say, which this helps. | Accessible names and visible text keep the same rounding as the payload (no aria-label with more decimals than the screen). |
| C3-34 | 3 | No user-facing a11y surface. | None from this lens. |
| C3-39/40 | 4 | Fixes a dead end (locked /tools with no next step) and a primary-weight destructive control at rest (`app/settings/page.tsx:44`); both are real usability barriers for keyboard and cognitive-load users. | "Delete my profile…" stays visible, named as now, keyboard reachable, AA contrast in secondary style (≥4.5:1 text, ≥3:1 boundary per 1.4.11) and visible focus; "(not open yet)" is in the link's visible text, not conveyed by greyed styling or `aria-disabled` alone; locked /tools' link back has a descriptive name; heading order h1>h2 kept with one h2 per section; settings order consistent across visits (3.2.6); view 2's existing `role=alert` (`:33`) and e2e unchanged. |
| C3-42 | 3 | Access right matters; a11y only in the delivery. Owner Q7/BC-10. | Download link named for what it holds; machine-readable, structured format (JSON/CSV) with readable field names, no image-only or PDF-without-tags export. |
| C3-35 | 3 | Cost item; risk is an image regression. | og:image alt text unchanged and still states the figures and disclaimer; versioning never serves a stale image whose alt differs from the page. |
| C3-43 | 3 | Owner Q8 and P6 first. | Absolute written date (not relative only), plain text in the status line, no figure styled as a second headline. |
| C3-38 | 3 | No a11y effect. | None from this lens. |
| L-16 | 4 | Its form decisions are already AA-grade (`docs/features/F-16-trust-and-safety-slice.md:55-57`, AC `:97`: labels, `role=alert`, focus, `role=status`, axe + keyboard e2e). Waits F-9. | Keep every earlier decision verbatim; the K18 "may be under 18" option is a labelled radio/checkbox in the same form, not a separate unlabelled control; the takedown page has an h1 and is reachable from the footer. |
| L-17 | 4 | Bidi and invisible characters in names corrupt what screen readers announce and spoof identity; the neutral 404 page with its own h1 was an A11Y condition (`F-17:37-39`). Waits F-9. | Keep earlier decisions; rejection messages name the field and the rule in text (3.3.1), announced via `role=alert` with focus on the field. |
| L-20 | 5 | Core A1: only `lib/badge-contrast.test.ts` exists on main; no pair test, no ΔE00 floor, no focus-ring rule. Light Verified 3.77:1 and gain/loss ΔE00 2.8 under deutan are measured failures (`F-20:9-11`). Highest-value item on this ballot for my lens. | Keep all earlier conditions word for word; floors (4.5:1, 3:1, ΔE00 ≥ 9) never lowered; PR #55 and fixes #12, #13, #26 merge first, and the chair should push those merges since they are the gate; lapse clause again. |
| L-18 | 4 | Text-label badges with meaning reachable without hover (WCAG 1.3.1, 1.4.1, 1.4.13; `F-18` decisions) and removal of a false tooltip help every user. After L-20. | Keep earlier decisions; the `/how#verified` link has a descriptive name ("What Verified means"), not a bare "Verified" link repeated per row without context; badge moved to the stats row keeps reading order (label before figures). |
| L-19s | 4 | One sign and a Flat text cue is A1's "gain and loss differ by sign and text". | Before switching any page sign to U+2212, test that the accessible name of each signed figure still carries the direction in words (Gain/Loss/Flat) or that the sign is announced; some screen readers skip U+2212, so the glyph alone must not be the only non-colour cue. Images keep the hyphen per `F-19` decision. After L-18. |

### Round 1: Engineer

#### Round 1, engineer (approval council cycle 3, 2026-11-01)

Lens: feasibility, size, risk, and file overlaps. Base f467293. I diffed each in-flight head against its merge base:
PR #55 (`pr/55`, F-13 + a11y), PR #56 (F-7), PR #62 (options), `claude/f14-sync-cadence`, `claude/f15-measurement`,
`claude/fix-truthful-labels`, `claude/fix-user-text-safety`. `claude/fixes-cycle3-pipeline` is not on the remote, so for
that branch I used the F3-* "Files" lines (`docs/direction/cycle3-2026-11-01.md` §5).

Hot files:
- `lib/sync.ts` is edited by F-14 (+192/-77), PR #62 (+41), truthful-labels (+34), user-text-safety (+27), and fixes F3-3 and F3-4.
- `lib/trades.ts` is edited by truthful-labels (+33) and fixes F3-1 and F3-5.
- `app/pane.tsx` / `lib/pane.ts` / `lib/record-strip.ts` are edited by PR #55, #56 and #62, truthful-labels and F3-2.
- `lib/privacy-purge.ts` is edited by PR #62 and F-15.

Untouched by every in-flight branch: `app/settings/page.tsx`, `app/account/page.tsx`, `app/tools/page.tsx`, `app/api/health/` (new).

| Item | Score | Reason | Conditions |
|---|---|---|---|
| C3-2 transfers as share moves | 4 | Real and small. The move-out path already exists: `removeOldest` at `lib/trades.ts:171-173` for `u<0`. The move-in tainted lot is pushed at `:172`. The only real change is to stop `taint(b.lots)` at `:171` for transfers. One snag: `lib/corporate-actions.ts:200-205` tags every unpaired move `reason: 'unknown'`, so TRANSFER is lost before the matcher. A new reason value is needed. The new counter runs through rebuild in `lib/sync.ts`, the most contended file. | Owner yes (DK list). DK's "oldest first only where it cannot change a basis" condition is cheap: whole position moved, or every candidate lot with the same `price`/`feePerUnit`; otherwise taint as today. Build on `lib/trades.ts` after `claude/fixes-cycle3-pipeline` (F3-1, F3-5) and truthful-labels land, with F3-15's copy. Taint tests updated, never deleted. Property test: a TRANSFER never changes a sell whose drawn lots predate it. |
| C3-3 oversell publishes recorded part | 1 | DK's probe is right in the code. With an unreported 2:1 split, every drawn lot is recorded and untainted (no action exists to taint it), so the proposed signal at `lib/trades.ts:208-210` cannot tell "margin short" from "missing inflow". It would publish a wrong Verified figure. No signal the matcher has rules out an unseen inflow. | Only if the owner says yes and the vendor supplies a short or margin flag the importer can read. Otherwise do not build. |
| C3-17 exclusion counts beside the headline | 4 | S. The counts already exist on `users` (`excluded_positions` `db/schema.sql:34`, `excluded_future` `:319`, `excluded_corporate` `:657`). The cost is file contention: pane and record-strip files are touched by #55, #56, #62, truthful-labels and F3-2. #52's `notShared` (`lib/sync.ts:99`) filters activities, not sells, so no count exists for it yet. | Build in F3-2's lane after it. Pane plus trade and month pages only, no feed card (D22). Share and F-12 images snapshot-unchanged. Sum only the stored counts. A `notShared` count needs its own counter computed in rebuild (sells, not activities), in the same PR or listed as a follow-up, never estimated. |
| C3-15 in-app disconnect | 3 | M, and the settings files are free. But without F3-3 a `disconnected_at` flag does not stop reads: `syncable()` and the consented set key on `state='connected'` (`lib/sync.ts:352-353`). The F-11 label is unbuilt (it lives on truthful-labels as `lib/record-status.ts`), and OD-9 is open. | After F3-3 and F-11 merge and the owner answers Q2. Shares one slot with C3-39/40 (`app/settings/page.tsx`). DB test: after step 2 the next `syncUser` makes zero vendor reads for that connection, and the `closed_trades` count is unchanged. No call to `deleteConnection` (`lib/broker.ts:128`). |
| C3-9a late-sell reconciliation | 3 | Feasible without touching protected `lib/broker.ts`. `fetchActivitiesPage` (`lib/broker.ts:96`) already pages full history, and `insertActivities` is insert-only (`lib/sync.ts:37`). The cost is vendor reads (whole history weekly per account) and that it lives in `syncUser` (`:378-379`), which F-14 is rewriting. | Build only after F-14 merges, inside its per-account read gate and `SYNC_REQUESTS_PER_ACCOUNT` budget. Insert-only, so no update or delete of a raw row. Fake-vendor test: a sell dated 10 days behind the newest trade appears. Bound the pages per run (resume by offset) so heavy records cannot blow the shard budget. |
| C3-16 connection health | 2 | Needs a new vendor read in protected `lib/broker.ts` (`listAccounts` `:86-91` reads no health field), so the PR is never auto-merged. The signal is unverified, it adds a request per sync to the shard budget, and it is blocked on F3-3. | Vendor docs confirm the field first. The read is counted in `SYNC_REQUESTS_PER_ACCOUNT`. It never sets `disconnected_at`. Owner merges the broker edit. No email (Q5). |
| C3-37 day-7 marker (F-15 amendment) | 3 | S, no slot. It touches `lib/auth/sessions.ts`, which PR #56 also edits (+2), plus `db/schema.sql` and the purge (`lib/privacy-purge.ts:52`, F-15 also edits it). Fine inside the F-15 branch. | Privacy committee rules on the field first. One nullable date per account, deleted by `lib/delete.ts`. DB test from the brief. Listed in `lib/privacy-fields.ts` / `privacy-retention.ts`. |
| C3-36 round public payloads | 4 | S and valuable. `/pane` sends ms epochs and raw floats (`app/u/[handle]/pane/route.ts:22`), and `records1` serialises `date_part('epoch',…)*1000` (`lib/feed.ts:197-198`). The risk is rounding too early: `records1` also feeds `headline()`/strip sums, and F-10 pins "the same floats" (`lib/feed.ts:199-200`). | Round only at the JSON or client-prop boundary, never in `records1` or stored values. Sort before rounding (DK). The response test from the brief covers `/pane`, `/pane-chart` and feed HTML. Every F-10 and F-19 pinned literal passes unchanged. Coordinate with truthful-labels (edits the pane route) and #56 and #62 (`lib/feed.ts`). |
| C3-34 health endpoint + 401 log line | 4 | S. It is a new file with no overlap, plus one line at `app/api/sync/route.ts:34-36`. The `sync_shards` table already exists (`db/schema.sql:409`). | Body is numbers and ok/degraded only, with `no-store`. One bounded indexed query, so no table scan per hit. The threshold derives from the cadence constant (F-14). The log line has no header, token or IP. Test greps the body for ids and handles. |
| C3-39/40 tools-closed + settings order | 4 | S. All three files are byte-identical since 3f216ba and no in-flight branch touches them, so this is the cleanest slot on the ballot. | Amends F-1 `plan.md:75-77` and F-3 `plan.md:142` (DK). Billing-open snapshots unchanged. View 2 e2e kept. Business lead and UX sign-off. Same slot as C3-15 and C3-44. |
| C3-42 full data export | 3 | M and owner-gated. Feasible: `lib/privacy-fields.ts` already maps user-owned fields, so the export can be driven by that map. | Owner Q7 / BC-10. Separate route so condition 11's file stays exact. A test fails when a user-owned table or column in `privacy-fields.ts` has no export entry. No `snaptrade_secret_enc` or other ciphertext. Percent only. |
| C3-35 versioned share images | 2 | Cheap to code, but there is a real hazard. An `immutable` year-long CDN entry is served without calling the route, so the old versioned URL keeps serving the card after profile deletion (`lib/delete.ts`), an F-16 hide, a disconnect or a rename. TTL is the only purge. Blocked on F3-26 (F-13 lane, `app/layout.tsx`). | If built: short shared max-age (minutes), never `immutable`, unless a CDN purge on delete, hide and rename is wired and tested. The version key covers every input DK lists. |
| C3-43 "Public since" line | 2 | S, but it needs a new public field (Q8, P6) and F-11. Also `consent_at` is per connection (`db/schema.sql:289`), so with several connections or a reconnect the right date is undefined. That is a design question, not a lookup. | Owner Q8 first, and the consent list names the field. The rule for several or re-consented connections is decided before the build. After F-11. |
| C3-38 drop-off aggregate | 3 | S, but `lib/privacy-purge.ts:180` is edited by PR #62 (+10) and F-15 (+16). Low value until real sign-ups. | After PR #62 and F-15 merge. The aggregate is written in the same transaction as the delete, keyed only by (day, step). DB test: counts unchanged, no attempt id left. |
| L-16 F-16 + K18 addition | 3 | Worth keeping, not buildable now. `claude/fix-user-text-safety` already adds `lib/reports.ts` (+79) and `lib/report-copy.ts`, F-9's planned files, so F-9 may land through it. F-16 would build on that branch's table. | Re-approve with every F-16 decision word for word and a new lapse clause. The prerequisite counts as met only when F-9's ACs are met on main. One reports table (`F-16:77`), reusing that branch's schema. K18 only after the report and hide exist. |
| L-17 F-17 handle and name integrity | 3 | Same branch already carries `lib/handles.ts` (+259) and `lib/handles.test.ts`, which is much of F-17's display-name check. A separate F-17 build now would collide on `lib/auth/attempts.ts` and `lib/handles.ts`. | Re-approve as rework on top of that branch once it merges: one normaliser (F-9's), with no second normaliser. Reserved list and rename hold as decided. New lapse clause. |
| L-20 F-20 tokens + contrast test | 4 | Value-neutral token layer. Its one blocker, `lib/a11y-contrast.test.ts`, is already written in PR #55 (+129), along with `app/globals.css` (+86). Once #55 and fixes #12, #13, #26 merge, it is a mechanical globals.css change with a test guard. | Lands right after #55, before F-18, in the globals.css slot. The floor is never lowered. No image colours (O-2). A computed-style snapshot shows no visible value change. |
| L-18 F-18 one trust language | 3 | Right direction, but the longest prerequisite chain on the ballot (F-11, F-13, F-20, fixes #1, #2, #10), and `lib/copy.ts` is edited by every in-flight branch. Not startable this cycle. | Only with L-20 re-approved and landed first. New lapse clause. Copy changes are one PR after truthful-labels merges (it carries fixes #1, #2 and `lib/copy.ts` +90). |
| L-19s F-19 call-site sweep | 3 | Mechanical, with a guard test already specified (`F19_SWEEP_SITES` grep). It depends on L-18. | Only if L-18 is re-approved. Opens as `rework` after F-18 merges. Pinned literals updated, never deleted. |

### Round 1: Reliability engineer

#### Round 1: reliability engineer (sync correctness, raw->derived integrity, observability, failure modes, cron)

Base f467293. Read only. Lens: does the change keep `activities` (raw) -> `matchTrades` -> `closed_trades` (derived)
truthful and rebuildable, and does a failure get noticed?

| Item | Score | Reason | Conditions |
|---|---|---|---|
| C3-2 | 4 | Closes a trader-triggered route from a priced loss into a count (`lib/corporate-actions.ts:200` -> `lib/trades.ts:171` taints the whole pair). The move-in half is safe: the new lot is tainted, FIFO draws older priced lots first. The move-out half is only safe where it cannot change the basis of the lots left behind. | Owner flag (amends `lib/trades.ts:52` and the committee's "when in doubt, exclude and count"). DK veto condition word for word: oldest-first on a move out only where the vendor names the lots, the whole position moves, or every candidate lot has the same basis; otherwise the remaining lots stay tainted; moved-in lots always tainted. Property test: adding a TRANSFER never changes a sell whose drawn lots predate it and did not move. Rebuild is still deterministic (two rebuilds give byte-identical rows). Unknown kinds keep today's taint. |
| C3-3 | 1 | An oversell means the raw ledger is incomplete: a missing buy, an unreported split, an unreported transfer in. Publishing the matched part publishes a guess as Verified. DK's probe (unreported 2:1 split -> -50% shown when the truth is 0%) is exactly how this fails. `lib/trades.ts:208-210` is the correct data-integrity behaviour. | If kept at all: only the copy at `lib/copy.ts:69` changes to "a sell larger than the recorded holdings" (fixes list, not a feature). C3-9a goes at the real cause (rows we never read). |
| C3-17 | 4 | Exclusions are real data the headline hides off the profile (`app/u/[handle]/page.tsx:289-292` only). #52 added one more silent exclusion (`notShared`, `lib/sync.ts:99`) with no counter at all. | One shared function sums the counts. Pane, strip and profile call it, and a test checks they give the same n. Decide and test whether the `notShared` rows are counted (counts only). Fixes list, found while reading: the rename-chain query `lib/sync.ts:123-127` has no `notShared` filter, while `lib/shared-accounts.test.ts:14` asserts 2 uses. A marked shared account whose symbol was renamed still feeds the record. Add the filter and a test before this ships. |
| C3-15 | 3 | A freeze has to stop reads, or "Disconnected" on a record that keeps changing is false. Blocked on F3-3, F-11 and owner Q2/OD-9. | The sync's account list (`lib/sync.ts:~360`) skips disconnected connections, with a test that a disconnected connection is not called through the fake vendor. `closed_trades` row count is unchanged after disconnect and after the next rebuild. Reconnect resumes the same record (TR-6). No vendor delete (BC-16). SYNC.md go-live gate 3 (irreversible `disconnected_at`) is answered first. |
| C3-9a | 4 | Plain data loss: the hourly read starts at the newest stored activity minus 7 days (`lib/sync.ts:379`), so a row posted late with an older trade date is never read. A missed sell drops a close. A missed buy turns a later sell into an "oversold" exclusion. Insert-only, so `on conflict do nothing` (`:37`) and immutability hold. | Insert-only, never update or delete. Covers BUY and SELL. Paged, never the whole history held at once. Runs from housekeeping or a daily/weekly slot, and its requests count in `syncCost` / F-14's per-account read limit. Skips disconnected and paper accounts. Late rows go through the existing `latePosted`/`LATE_POSTING_DAYS` checks (`lib/trades.ts:104-107`). Fake-vendor e2e: a sell dated 10 days before the newest trade appears after one reconciliation, and a second run inserts 0. Any `lib/broker.ts` change waits for the owner's merge. |
| C3-16 | 4 | The main silent-failure mode of a pull-only product: a dead authorization leaves a record that looks live. `lib/broker.ts:86-91` reads no health. | Until the vendor's signal is verified in its docs, derive `needs_reconnect_at` from the refusal streak the sync already keeps (`users.sync_failure_kind = 'refused'`, SYNC.md). It never sets `disconnected_at` (gate 3 stays the owner's). A successful sync clears it. Trader-only line. No email (Q5). Its request cost is inside the shard budget. |
| C3-37 | 3 | Fine as an F-15 amendment. Only the write path matters to me. | The marker is written once and idempotently (a re-sign-in never moves it), it survives the session purge (`lib/privacy-purge.ts:52`), it is purged with the account, and it is listed in `lib/privacy-retention.ts`. |
| C3-36 | 4 | S. Removes precision the screens never use from public cached JSON (`app/u/[handle]/pane/route.ts:22,26`; `lib/feed.ts:197-198`). Only payloads change, not stored data. | Round only at serialisation. Stats are still computed server-side from full-precision `closed_trades`, and a test checks the pane's headline equals the profile's for the same fixture. Dates go out as UTC days, the same day key the charts already use. No rounding is ever written back. |
| C3-34 | 5 | The one observability gap with no prerequisites: a stalled or unauthorised cron is invisible today (`app/api/sync/route.ts:34-36` logs nothing; `instrumentation.ts:7-10`). `sync_shards` already holds `heartbeat_at`/`last_run` (`db/schema.sql:409-418`). | "Degraded" comes from the configured schedule (say, last round older than 2 cron intervals, or any missing shard), not a fixed 20 minutes against an hourly cron (the brief's AC would read degraded most of the time). Public body: `ok/degraded`, ages in whole hours, `missingShards` count, `no-store`. Cheap: reads `sync_shards` and one aggregate, no scan of `users`. The 401 log line is one fixed string with no header or token content. The body test greps for ids, handles and emails. Housekeeping's last run is included (SYNC.md gate 5). |
| C3-39/40 | 3 | Outside my lens. No data path, S. | F-3's billing-open e2e snapshots pass unchanged. |
| C3-42 | 3 | An export is only as good as its completeness, and that is testable. Scope is owner Q7 and BC-10. | Completeness test driven by the table registry in `lib/privacy-retention.ts`, so a new user-owned table fails the test until it is exported or excluded with a reason. No ciphertext, `APP_SECRET_KEY` output or vendor secret. Trades as percent only. Streamed or paged for large histories. |
| C3-35 | 3 | Real cost win, but a year-long immutable cache is a staleness and takedown risk. A cached profile image outlives a hide (F-16), a deletion (P6) or a disconnect state change. | The version key includes every state the image shows (last sync, close count, thesis, status/disconnected, handle, hidden/deleted). A request with a mismatched or stale version never gets a long cache. A hide or deletion makes the old versioned URL stop serving (server check plus a bounded `s-maxage`, or a purge), with a test. After F3-26. |
| C3-43 | 2 | Which `consent_at` (`db/schema.sql:289`) applies with several connections, a reconnect or a disconnect is undefined, and the count "since" would shift on rebuild if rows are re-dated. Owner Q8, P6. | Owner decides. If built: a defined rule (earliest live consent per profile), stable across rebuild and reconnect (test), F-11 first. |
| C3-38 | 3 | Low value until real sign-ups, but cheap and keeps D11. | In the same transaction as the delete at `lib/privacy-purge.ts:180`, and idempotent: a retried purge never double-counts (test runs it twice). After PR #62. |
| L-16 | 4 | The "every `from closed_trades` read carries the visible-user predicate" test is a strong integrity guard. A profile-level hide survives `rebuildTrades` because it never touches derived rows. The owner digest's "last sync tick" is the observability I want. | Keep all earlier conditions word for word, plus K18's legal veto conditions. The hide also covers the rename-chain path and every image and sitemap read. The hide/unhide audit row is written in the same transaction as the hide. Lapse clause on F-9. |
| L-17 | 3 | Handle changes ripple into share URLs and cached images (see C3-35). Not otherwise in my lens. | Keep earlier conditions. Any cache key that includes the handle is bumped on a rename (test). Lapse clause on F-9's normaliser. |
| L-20 | 3 | Outside my lens. Tests only, no data path. | Keep earlier conditions. Lands after PR #55. |
| L-18 | 3 | Trust words must match sync state ("Verified", last updated, disconnected), and those depend on F-11 and F-13, which are unmerged. | Keep earlier conditions. Every state word maps to a stored field with a test, never a guess. After L-20. |
| L-19s | 3 | Formatting sweep, low risk. Display only, never storage. | Keep earlier conditions. Only if L-18 is re-approved. No formatter rounds a value that is later stored or compared. |

Defect for the fixes list (not a vote, from my read at f467293): `lib/sync.ts:121-127` (rename-chain read) lacks
`notShared(tx, userId)`, which the main stream applies at `:99`. A shared-account mark is bypassed for any pair in a
corporate-action rename chain. The existing assertion (`lib/shared-accounts.test.ts:14`) counts uses and so does not
catch it. A behavioural test (a marked account with a rename chain contributes 0 closes) would.

### Round 1: Legal and compliance

#### Round 1: legal and compliance (first vote)

Base f467293. These are findings, not legal advice: the AI legal committee's findings stand in for counsel (`docs/POLICY.md:18-24`).
Scores are given through the legal lens only. The veto conditions from `r0-legal.md` still apply.

One change since round 0: on C3-3 I accept the decisions keeper's probe. Buy 100 @ 100, an unreported 2:1 split, then
sell 101 @ 50. The proposal would publish -50% under Verified, but the true result is 0%. An oversell is evidence of an
inflow nobody recorded, and that inflow can reprice the lots that were recorded. So "every drawn lot recorded and
untainted" does not make the basis known. As briefed, C3-3 breaks F3c (`POLICY.md:128-130`), and I would veto it.

| Item | Score | Reason | Conditions |
|---|---|---|---|
| C3-2 | 4 | Today a full transfer out leaves no trade, no count and no line, which is a silent gap against F3 (`POLICY.md:114-116`) and F4 (`:131-132`). Moved-in lots stay tainted, so F3c holds. | Owner's yes. DK's veto condition: "oldest first" only where it cannot change a basis; otherwise the remaining lots stay tainted. Every transfer out is counted and shown. Unknown kinds keep the taint. /how calls FIFO the record's own method, not the broker's. Existing taint tests are updated, not deleted. |
| C3-3 | 1 | DK's probe shows a wrong Verified return (-50% where the truth is 0%), which breaks F3c (`POLICY.md:128-130`; committee log `:24`). The oversold copy naming the wrong cause (`lib/copy.ts:69`) is a copy defect for F3-15, not a reason to publish. | Veto as briefed. I would reconsider only if the brief names a signal that rules out an unseen inflow, for example a vendor-confirmed short sale. The owner decides (DK routing). Any count line names no cause it cannot know. |
| C3-17 | 4 | Keeping exclusions next to the headline guards against the completeness implication F3a bars (`:117-119`) and the cherry-picking F4 bars. Counts only, S. | One muted line on the pane, never displacing the disclaimer at 360 px. Neutral wording, one shared sum function. Share card unchanged until Q4. Include #52's `notShared` exclusion (`lib/sync.ts:99`) in the count, or add it to the profile counts; today it is excluded silently, against F3c's "excluded and counted". |
| C3-15 | 4 | In-app withdrawal of consent is a P6 consent-mechanics gap before real users (`:54-59`, `:230-231`; COMPLIANCE `:75`). Consent was given in-app, so withdrawal should be about as easy. | Owner Q1, Q2/OD-9, BC-16. Veto: nothing reads the connection after step 2 (cron, /connect/done, reconciliation, health checks). Step 1 states the freeze and links Delete, with no confirm-shaming (COMPLIANCE `:95`). The withdrawal is recorded and deleted with the profile. Unit, e2e and heavy-use tests (`:191-194`). |
| C3-9a | 4 | A sell more than 7 days behind is never read (`lib/sync.ts:378`), so a Verified record can silently miss a close. That is against F4's full history and the pre-launch accuracy item (`POLICY.md:234-235`). Insert-only leaves `CLAUDE.md:62` intact. | Insert only, never update or delete a raw row. Inside F-14's read gate. Never runs for a disconnected or frozen account. No raw payloads in logs (P6 `:58-59`). Any `lib/broker.ts` edit goes through the owner's merge. |
| C3-16 | 2 | Little legal gain now: 0 real connections, and the vendor signal is unverified. The in-app line itself is fine under F3b. | No new public field (signed-out and image test). `needs_reconnect_at` is deleted with the profile and never freezes. No vendor account ids logged next to user ids. No email until Q5, and the F3b carve-out reading (`:125-127`) is the owner's. |
| C3-37 | 3 | A new personal-data field with no legal gain. Acceptable under P3 if minimal (`:48-50`). | At most one first-seen day and one returned day per account, no time of day. No per-viewer or session data, never public, k≥5. Deleted with the account; it must not lengthen session retention. SCHEMA_MAP entry. The Privacy Policy text describes it before real users (owner). |
| C3-36 | 4 | Closes a P3 minimisation gap on main: consent says prices are private (`lib/copy.ts:79`) while `/pane` publicly caches millisecond times and full-precision returns (`app/u/[handle]/pane/route.ts:22,26`; `lib/feed.ts:197-198`). | Every public payload is covered, and cached bodies are re-keyed. Stats, ranks and CIs compute on stored values, not rounded ones. Same-day ordering is preserved (DK). |
| C3-34 | 3 | Operationally useful, legally neutral. | Body holds no ids, handles, user counts, figures or error text, sent `no-store`. The 401 line never contains the presented token or any part of it (S2 `:33-35`) and no IP (P3). |
| C3-39/40 | 3 | Removes a confusing dead end. Lowering Delete's weight is acceptable only if deletion stays as easy to find (P6 `:56-57`; COMPLIANCE §4 `:95` symmetric choices). | Veto: "Delete my profile" stays on /settings itself, visible at 360 px without expanding, with the same name, keyboard reachable and AA contrast. View 2 unchanged. Record it as amending `logs/F-1/plan.md:75-77` (DK). No price, no date promise, no email capture; LIVE_BILLING untouched. Call the processor "the billing vendor" (T1; Q11). |
| C3-42 | 4 | COMPLIANCE requires a real export before launch (`:75`), and access requests are a per-consumer exposure (`:178`). Today's label is wider than the content (`lib/copy.ts:674` vs `:719`). | Owner Q7 and BC-10. Owner finding: whether the private export includes the user's own raw activities, since P3's "shown" governs public display, not the access right. Veto: real sign-in only, `no-store`, no secrets or ciphertext, no other user's or reporter's identity (`F-16:23-25`). Consent and attestation records included. Every user-owned table tested. |
| C3-35 | 2 | Cost gain only. A long immutable cache conflicts with deletion, hide and takedown (P6 `:56-57`, U3 `:148`) unless it is purged. Blocked on F3-26. | Veto: after delete, hide or takedown, old versioned URLs return 404 and are not held by our CDN (short `s-maxage` or a purge). The version key covers every image input (DK). The disclaimer and absolute dates stay. |
| C3-43 | 2 | Adds a public field. P6 (`:55-56`) bars rendering `consent_at` (`db/schema.sql:289`) before the owner's consent line (`lib/copy.ts:78-79`) names it. No legal gain. | Owner Q8 first. Not shown for anyone who consented under the old line. No average beside it, no "proof" or hindsight claim (F2). `lib/privacy-fields.ts` and its test are updated. |
| C3-38 | 3 | Legally fine and low value. | Per day and per step, counts only, no attempt id, via, email, IP or UA. The D11 30-day purge (`lib/privacy-purge.ts:22,180`) is never delayed or blocked. Privacy Policy text before real users. After PR #62. |
| L-16 | 5 | U2's report action on every profile and U3's takedown process are launch prerequisites (`POLICY.md:145-149`), and P6 needs a takedown contact (`:58`). K18 adds the under-18 report that COMPLIANCE §7 asks for (`:121`). | Every F-16 legal veto line stays verbatim. K18 veto: no DOB, ID or age estimation; no auto-hide on a single report (`F-16:20-22`); no automatic deletion (H `:179`); no minors' cohort words. Under-18 reports sort first in the digest. The age-assurance method stays the owner's (`:232`). Add the lapse clause, and schedule F-9 (its blocker). |
| L-17 | 5 | Reserved handles are a U2 launch prerequisite (`:145-147`), and display-name refusals stop fake "Verified" (F3a). | Every F-17 legal line stays verbatim: no third-party or person names in the list, tests or fixtures; a hold stores only the handle and a date and never blocks deletion; no personal data in rejection logs. Use the single normaliser, wherever it lands. |
| L-20 | 3 | Supports A1 (`:153-155`) with a lasting test. Modest compliance gain beyond fixes #12, #13 and #26. | The 4.5:1 / 3:1 and ΔE00 ≥ 9 floors are never lowered. No hosted fonts or assets. No brand-matched colours (T3). |
| L-18 | 4 | One Verified definition and no completeness words is F3a's core (`:117-119`; COMPLIANCE §11 `:153`). Demo must never read as verified (P2). | All F-18 legal lines verbatim. Completeness bans never loosened. F-7 never shows Verified. Lands after L-20. |
| L-19s | 3 | Keeps signs in text (A1 `:155`) and losses legible (F4). It is a sweep, and the compliance core is already in the first slice. | ASCII hyphen on images unless the glyph render test passes. Ranking, `confidence()` and `RANK_MIN_BETS` untouched. Banned-word test on the glossary. Only after L-18. |

### Round 1: Trust and safety

#### Round 1: trust and safety (impersonation, scams, abuse of public records, gaming the record, moderation, takedowns)

Base: origin/main f467293, read only. My test for each item: can a trader, a reporter or a third party use it to make a
Verified record say something untrue, to hide a loss, to impersonate or scam, or to abuse a public record? And
does it close a route that is open today? Owner questions are not decided here. Where I name one, it is my recommendation and the call is the owner's.

| Item | Score | Reason | Conditions |
|---|---|---|---|
| C3-2 | 5 | This is the cheapest open way to game a Verified record today. Transfer out a losing position and the loss is gone: no trade, no count, no line (TRANSFER is unpriceable at `lib/corporate-actions.ts:200` and taints every lot at `lib/trades.ts:171`). Transfer in 1 share and 100 recorded units leave the record as "corporate". Both routes are trader-triggered and need no data gap. | (1) DK's condition is binding here: "oldest first" on a move out applies only when it cannot change a basis (the vendor names the lots, the whole position moves, or all candidate lots have the same basis). Otherwise the remaining lots stay tainted. Without this, a trader can buy high first and low second, specific-lot-move the low lot out, and have the record price the rest against the low basis, which flatters the record. Add that case as a test. (2) Every transfer out is counted and shown (`excluded_transferred_out`), never silent. Build it with C3-17. (3) Moved-in lots stay tainted and unknown kinds keep the taint. (4) Neutral copy that implies no wrongdoing. (5) Conditional on the owner's yes; it amends `lib/trades.ts:52` and the committee's rules. |
| C3-3 | 3 | Today one extra share hides a recorded loss (`lib/trades.ts:208-210`), and the line blames missing history (`lib/copy.ts:69`). In margin accounts that is a cheap way to hide a loss. But the fix publishes Verified figures it cannot prove: DK's unreported-split probe gives -50% shown when the truth is 0%. A wrong Verified figure is worse for trust than a counted exclusion. | (1) Owner-conditional. The brief must name the signal that rules out an unseen inflow (no corporate-action or transfer row near the pair, or a vendor position check) before any matched part is published. (2) Until then, the gaming route is contained by counting: every oversell exclusion is counted and shown beside the headline (C3-17), and the copy names no cause (legal condition 1). (3) Keep exclude-whole on an empty or emptied ledger and keep the committee test. |
| C3-17 | 5 | Counting is what limits every exclusion route (transfer, oversell, corporate, and now #52's silent `notShared` at `lib/sync.ts:99`). It only works if the count shows where records are read, not on one page (`app/u/[handle]/page.tsx:289-292`). It is cheap and it limits the routes above even before they are closed. | (1) The sum includes every exclusion the rebuild applies, including shared-account marks (`lib/shared-accounts.ts` `notShared`), from one function shared with the profile (test: profile and pane totals are equal). (2) Neutral words ("excluded", never "hidden by the trader"), no warning colour. The line links to the profile's breakdown by reason. (3) The trader has no setting to suppress it. (4) The share card is unchanged until owner Q4. My recommendation is that the card carry it too, because cards are where scam screenshots travel, but that is the owner's call. |
| C3-15 | 3 | Withdrawal is a real need. It is also a freeze button: a trader can disconnect before losing positions close and keep a frozen good record. That is fine only if the freeze is visible on every surface and open positions stay shown (TR-3, TR-5). It is blocked on F3-3, F-11 and Q2. | (1) After disconnect, positions open at that moment show as open at disconnect, never dropped (test). (2) F-11's "Disconnected ‹date›" shows on profile, pane and share image. (3) Disconnect and reconnect cycling can't reset or restart a record (TR-6 claims; test a reconnect within a day). (4) Legal's veto conditions (nothing reads after step 2; deletion linked, never blocked). |
| C3-9a | 4 | A sell posted more than 7 days behind the newest trade is never read (`lib/sync.ts:378`). The result is a loss that silently never appears, and a late or backdated correction could cause it. Insert-only reconciliation closes the route without touching immutability. | (1) Insert-only. Never update or delete raw rows. (2) Never runs for a disconnected account. (3) A newly found close lands in the record and the feed like any close; rebuild by `rebuildTrades`, never patched rows. (4) The revisions table (C3-9b) stays with the owner (Q3). |
| C3-16 | 3 | An expired authorization freezes a record silently, and from the outside it still looks live. A trader can let the link lapse on purpose after a good run. The trader-only Reconnect line does nothing for viewers, and the vendor signal is unverified. | (1) Viewers get the staleness signal through F-11's "last updated ‹date›" or a stale state, never a trader-only cue alone. A record stale beyond N days must not rank as if current; that ranking change is for a design session or the owner. (2) `needs_reconnect_at` never hides or deletes anything. (3) No email until Q5, and no record field in any message (F3b). Lookalike "reconnect" phishing is a known scam pattern, so the in-app line must never ask for credentials and only links to /connect. |
| C3-37 | 3 | Neutral for T&S. One date per account adds no abuse surface. | Legal's conditions: one date per account, no per-viewer data, purged with the account, never public. |
| C3-36 | 4 | Full-precision returns plus millisecond close times on a public cache (`app/u/[handle]/pane/route.ts:22,26`) help infer position size. Inferred size marks wealthy traders as targets for scams, extortion and doxxing. Rounding cuts that down. | (1) Every public payload, including cached ones and images. (2) Stats, ranks and CIs compute on stored values. (3) Keep the "intraday times" vendor question open; this reduces inference risk, it does not remove it. |
| C3-34 | 3 | Small abuse value. A `cron unauthorized` line helps spot someone probing the cron secret. The health body must not become a recon or enumeration oracle. | No counts, ids, handles or error text; `no-store`. The log line holds no token fragment and no IP. Rate-limit or keep the body constant-size. Better as a chore with the fixes. |
| C3-39/40 | 3 | Mostly UX. For T&S, deletion is a safety tool for a trader being harassed over a public record, so making it secondary must not make it harder to find. | Legal's veto condition: "Delete my profile…" stays on /settings, visible at 360 px without expanding anything, keyboard reachable. No confirm-shaming on view 2. |
| C3-42 | 2 | Needed before launch, but while auth is a dev stub (`lib/session.ts`), a full export is the payoff of an account takeover: everything about a person in one file. The scope is the owner's (Q7, BC-10). | Only after real sign-in. Recent re-authentication before the download. Rate-limited, and an account event recorded on each export. No secrets, ciphertext or other users' identities (and no reporter identities, F-16). |
| C3-35 | 2 | A one-year `immutable` image fights takedowns. A hidden, taken-down, deleted or renamed profile's figures would live on at our CDN under the old versioned URL. Impersonators reuse old cards. The cost saving is for traffic that doesn't exist yet. | If built: every image request checks visibility (F-16 hide, deletion, rename hold) before serving from cache, or the URLs can be purged by the hide script and deletion. Test: hide, then request the old versioned URL, and get no figures. The disclaimer and absolute date stay in the image. |
| C3-43 | 4 | It is the strongest anti-cherry-picking signal on the ballot. A trader can't choose "public since" with hindsight, so a record made of old, curated closes from before consent can be told apart. Scam profiles that show a long record connected yesterday are easier to spot. | Owner Q8 and the consent list (P6) first. Needs F-11. No average beside it (TR-7). Show the closes since even when it is 0. |
| C3-38 | 2 | No T&S value or risk beyond privacy, which the aggregate handles. Premature with no sign-ups. | No identifiers. The purge is never delayed. |
| L-16 | 5 | This is the whole T&S floor: profile reports, impersonation category, audited owner-run hide, neutral hidden state and the takedown page (POLICY U2, U3). Linkable Verified records invite impersonation scams before anything else. The design is sound and was built against brigading (no auto-hide on N reporters). | (1) Re-approve with every F-16 decision and veto condition verbatim, plus K18 as a dated addition with legal's conditions: no DOB, ID or age estimation; a single report never hides; the owner runs any deletion. (2) Flag to the owner that F-9 (unstarted) blocks F-16, F-17 and K18. My recommendation is to start F-9 this cycle, or to let F-16 build `lib/reports.ts` to F-9's spec so the T&S floor isn't held by thesis work. That is the owner's/orchestrator's call. (3) Hides cover share images and caches (C3-35 interaction). |
| L-17 | 5 | Reserved handles are a launch prerequisite (U2). Today a rename frees the old handle at once, so a forwarded profile link or card can be taken by an impersonator: a direct link-hijack scam. Display names can carry check glyphs, "Verified" and bidi tricks. | (1) Every F-17 decision verbatim. (2) Exactly one normaliser: if `claude/fix-user-text-safety`'s `checkDisplayName` lands first, F-17 and F-9 reuse it (DK logs the choice). (3) Look-alike checks also cover the product's own name and route words. No third-party names anywhere. |
| L-20 | 3 | No direct T&S effect. Contrast matters for the disclaimer and Demo badge being readable, which supports honest presentation. | Cycle-2 conditions unchanged. The Demo badge and disclaimer stay at or above AA. |
| L-18 | 4 | One meaning of "Verified" everywhere, and demo is never verified. Inconsistent trust words are what scammers screenshot and exploit ("verified" in a name, a demo shown as real). | Every F-18 LG line verbatim. Order: after L-20 and the unmerged fixes (#1 demo called verified first). |
| L-19s | 3 | Small T&S value: the sign stays in text, so a loss can't read as a gain on images or at small sizes. | Sign kept in text and on images. Ranking and CI untouched. Only after L-18. |

### Round 1: Decisions keeper

#### Round 1, decisions keeper (first vote)

Lens: does the item fit decided rules, or does it amend or decide one that isn't the council's? Citations are at f467293.
Round-0 veto conditions (`r0-decisions-keeper.md`) still bind.

| Item | Score | Reason | Conditions |
|---|---|---|---|
| C3-2 | 3 | It protects TR-1 (`docs/DESIGN.md:324`) against a route a trader can trigger. But it amends a delegated rule (`lib/trades.ts:52`; `logs/corporate-actions/committee-2026-11-01.md:44-45`, `:57-58`) on a decided point, so per `docs/IMPLEMENTATION.md:75` it waits for the owner. | Owner's yes first. "Oldest first" only where the choice cannot change a basis; otherwise lots stay tainted (`CLAUDE.md:95`). Moved-in lot stays tainted (`:143-144`). |
| C3-3 | 1 | It reverses the reason for the orchestrator's ruling (`committee:24`, `:115-119`). An unseen inflow can't be detected, so this publishes wrong returns under Verified (fictional probe: unreported 2:1 split → −50% shown, true 0%). F3c `docs/POLICY.md:128-130`. | Owner only, and only with a named signal that rules out an unseen inflow. |
| C3-17 | 4 | As reshaped it conflicts with nothing. It shows the "excluded and counted" rule (`CLAUDE.md:95`) where records are read. D22's one feed-card line (`docs/IDEAS.md:148`, `F-10:12-18`) is respected. | Not on feed cards. Share card and images unchanged until owner Q4. Includes #52's `notShared` exclusion (`lib/sync.ts:99`) only if the profile counts it too. |
| C3-15 | 3 | Fits TR-5 (`DESIGN.md:328`) and P6's consent promise (`POLICY.md:55`, `lib/copy.ts:91`). But freeze semantics are owner Q1, positions are OD-9 (Q2) and vendor delete is BC-16, so it is premature until those are answered. | No vendor delete. No rows removed. Reconnect only through full consent (TR-6). Waits for F3-3, F-11, Q1 and Q2. |
| C3-9a | 4 | Insert-only, so `CLAUDE.md:62` ("raw, immutable") holds. It makes "re-reads the last 7 days" (`CLAUDE.md:71`, `lib/sync.ts:378`) do what the record promises. | Within F-14's once-a-day activities read (`F-14:13-15`). `lib/broker.ts` edits wait for the owner's merge. Never updates or deletes a raw row. |
| C3-16 | 3 | No conflict with TR-5, provided refusals never freeze (`cycle3:677-678`). But the vendor signal is unverified, it needs F3-3, and `lib/broker.ts` is protected. | Never sets `disconnected_at`. D29/F-11 public idle line unchanged (`IDEAS.md:172-174`). No email until owner Q5. G1 not redefined (MRC2-3). |
| C3-37 | 3 | A legitimate amendment to F-15, which is building and not lapsed (`F-15:68-70`). It sits close to the owner's MRC2-3 boundary (`F-15:48`, `:110-111`). | Never G4. Never redefines a gate. Server-side and per account (not E4, `F-15:63`). Deleted with the account. Privacy committee rules on the field first. |
| C3-36 | 4 | No decided rule touched. It brings payloads into line with the consent copy, which says prices are private (`lib/copy.ts:79`), and with P3. | Same-day trades stay distinct, ordered chart and scrub points (`DECISIONS.md:55-73`). Rounding at output only. |
| C3-34 | 4 | No conflict. Fits "no separate backend" (`CLAUDE.md:59`) and standing direction 3 (`DECISIONS.md:30`). | No ids, figures or token in the body or the log line. Threshold taken from the schedule constant (F-14). |
| C3-39/40 | 3 | Fair problem, but it amends two signed plans: F-1 S9 view 1 (`logs/F-1/plan.md:75-77`) and F-3 entry points (`logs/F-3/plan.md:21-27`, `:142`). | Names both amended lines in a dated decision. S9 view 2 and its "first action deletes nothing" test unchanged (`plan.md:147-148`). Billing-open snapshots unchanged. No new price shown. Business lead and UX lead sign off. |
| C3-42 | 2 | The scope is owner Q7. Expanding the file amends F-3 condition 11's "exactly" (`logs/F-3/committee-2026-11-01.md:50-53`). | Owner's yes on Q7, or a separate route that leaves condition 11's file as decided. The label keeps the committee's words until then. |
| C3-35 | 3 | No decided rule touched. It waits on F3-26, and its cited "cycle-2 K6 condition 2" does not resolve. | The version key covers every input that changes an image. F-11 absolute dates kept (`F-11:23-24`). Image contents unchanged. |
| C3-43 | 2 | It adds a public field, which is owner Q8 and needs P6's consent list (`POLICY.md:54-56`). It also depends on F-11, which is not built. | Not rendered before the consent line names it. TR-3 "Record since" stays primary (`DESIGN.md:326`). No average beside it (TR-7, `:330`). |
| C3-38 | 3 | Consistent with "aggregate counts with no identifier" (`IDEAS.md:114-118`) and the purge decisions (`lib/privacy-purge.ts:1-12`). Low value before real sign-ups. | Keyed by day and step only. Purge scope and the 30 days unchanged. After PR #62. |
| L-16 | 4 | Re-approving the cycle-2 decision keeps decided rules intact (`F-16:16-65`). K18 fits as an addition: no automatic hide (`F-16:20-21`), owner-run hide (`:26-29`), P4 (`POLICY.md:51-53`). | All earlier decisions carry word for word. One reports table (`F-16:77`). If F-9's files arrive on the fix branch, F-9's own acceptance criteria must be met on main. New lapse clause. |
| L-17 | 4 | Builds the reserved-handle launch prerequisite on decided terms (`F-17:46`, `:62`). | One normaliser, building on the branch's `checkDisplayName`. Nothing deleted. A hold never blocks deletion. New lapse clause. |
| L-20 | 4 | A value-neutral foundation with no owner rule touched (`F-20:30`, `:33`, `:40`). | Floor never lowered. No image colour change (O-2 stays the owner's). New lapse clause. |
| L-18 | 3 | Consistent, but it has the most unmerged prerequisites and sits on the D25/D27 boundary (`F-18:47`, `:50-51`). | Only with L-20, and F-20 lands first (`F-18:60-62`). Owner copy unchanged. O-2, O-4 and O-8 stay the owner's. |
| L-19s | 3 | Consistent, but it can't start before F-18 (`F-19:32-34`). | Only if L-18 is re-approved. F-19 stays `built`. Pinned literals updated, never deleted (`F-19:45`, `:77`). |

Note on the chair's cap reading: the chair says re-approvals don't count toward the six. My round-0 reading was the
reverse. It is an interpretation of a protected file (`team/approval-council.md:41-44`), not an owner decision, so I
do not veto it. It must be flagged to the owner, as the chair says.

### Round 1: Common sense

#### Round 1, common sense (first vote)

Lens: would a reasonable trader or viewer be confused or misled by what ships, and is it worth its cost now (0 real
users, launch gate closed, 27 cycle-3 fixes and several feature branches already waiting for review)? Base f467293.

Change since round 0: the decisions keeper's C3-3 probe (buy 100 @100, unreported 2:1 split, sell 101 @50: C3-3 would
publish -50% Verified; the truth is 0%) persuades me. The extra unit is the only evidence that something unrecorded
happened, and that something can change the basis of the recorded lots. Publishing a possibly false Verified loss is
as dishonest as hiding a true one; the part a reasonable viewer is actually misled by today is the copy that names the
wrong cause (`lib/copy.ts:69`), and that is a fix, not this feature. I lower C3-3 from "clear with conditions" to 2.

| Item | Score | Reason | Conditions |
|---|---|---|---|
| C3-2 transfers as share moves | 4 | Today a transfer erases or relabels real results (`lib/corporate-actions.ts:200`, `lib/trades.ts:171`): transfer out 100 gives no trade, no count, no line. A viewer would call that a hidden loss. A move in is a known event (unlike C3-3's inferred one), so narrowing the taint there is safe. | Owner's yes (amends `lib/trades.ts:52` and the committee rule). DK's veto condition: oldest-first only where it cannot change a basis, otherwise remaining lots stay tainted; moved-in lots stay tainted. Every outcome is a shown trade or a named count. Transferred-out line neutral, no claim about what happened elsewhere. Same slot as the ledger fixes. |
| C3-3 oversell publishes recorded part | 2 | DK's probe: an oversell is itself evidence of an unseen inflow, which may be a basis-changing event; "every drawn lot recorded and untainted" cannot detect that. The real harm (a false cause in the copy) is a fix. | Only if the brief names a vendor signal that rules out an unseen inflow; owner's yes. Meanwhile the count line states no cause ("sold beyond recorded holdings"), per legal. |
| C3-17 exclusion counts beside the headline (reshaped) | 4 | Counts living only on the profile (`app/u/[handle]/page.tsx:289-292`) are invisible where records are actually read. Cheap; makes C3-2's remaining counts honest in practice. Reshape respects D22. | One muted line on the pane (and trade/month strip only if it fits F-10), linking to the profile's reasons. One function computes the sum for profile and pane. Include #52's `notShared` (`lib/sync.ts:99`) if the profile should count it, and give it a profile line too. No warning colour or icon. Card waits Q4. |
| C3-15 in-app disconnect | 3 | Real mismatch: consent promises a disconnect rule (`lib/copy.ts:91`) with no button. Must exist before real users, but it cannot start (F3-3, F-11, Q1, Q2/OD-9). | No confirm-shaming; step 1 states the freeze in one sentence and links deletion; nothing deleted or hidden; demo users see nothing. Approve only as owner-conditional, no slot until unblocked. |
| C3-9a late-sell reconciliation | 4 | A sell posted more than 7 days late is never read (`lib/sync.ts:378`): a Verified record silently misses a close, possibly a loss. Insert-only keeps "raw, immutable". Plain correctness, S-M. | Insert missing ids only, never update or delete; reads inside F-14's per-account gate; the `lib/broker.ts` edit waits for the owner's merge. No new public field. |
| C3-16 connection health | 2 | The vendor signal is unverified and there are 0 connections, so nobody's link can go stale yet. Worth doing before real traders, not now. | Trader-only line; never sets `disconnected_at` or freezes; no email until Q5; build with C3-15 in the connection lane. |
| C3-37 day-7 marker (F-15 amendment) | 3 | S and no slot; without it F-15 cannot answer its own week-8 question. Low value until real viewers exist, but cheap to add while F-15 is open. | One date per account, server-side, never public, purged with the account; privacy committee rules on the field first; never labelled as G4. |
| C3-36 round public payloads | 4 | S, nobody sees the difference on screen, and it closes a gap between what consent calls private (`lib/copy.ts:79`) and what JSON carries (`app/u/[handle]/pane/route.ts:22`, `lib/feed.ts:197-198`). | Round at the edge only: stats, ranks and intervals use stored values; no displayed figure changes (snapshot); same-day points keep their order (sort before rounding). |
| C3-34 health endpoint + cron 401 log | 3 | Useful to the owner, invisible to users, S. Not urgent with 0 users, but a stalled sync going unnoticed is a real failure mode once anyone connects. Chore-sized. | No ids, handles, user counts or figures in the body; no token, prefix or IP in the log; threshold from the schedule constant; `no-store`. |
| C3-39/40 Record tools while billing off + settings order | 4 | Every signed-in user meets a primary button to a locked page with no way back (`app/account/page.tsx:61`), and Delete is the heaviest element on every /settings visit. Plainly confusing and out of proportion; S. | DK: names `F-1/plan.md:75-77` and F-3 `plan.md:142` as amended (billing-closed state only). Delete stays visible on /settings, one tap to view 2, never behind a disclosure. With billing open, F-3 snapshots unchanged. No price, date promise or waitlist. Business lead signs off. |
| C3-42 full data export | 2 | Needed before launch, but the scope is the owner's (Q7, BC-10); building first risks building twice. | Owner-conditional. Until built, the help line beside the button keeps the label from over-promising. Percent only, no secrets, no other users' data. |
| C3-35 versioned cacheable share images | 1 | A cost fix for traffic that does not exist, and its failure mode (a long-cached image with stale figures) is a dishonesty risk. Blocked on F3-26. | If ever: a record change always changes the URL (test); mismatched versions never long-cached; disclaimer and absolute dates stay. |
| C3-43 "Public since" line | 3 | The most honest single line a record can carry (the part a trader cannot pick with hindsight). But it adds a public field (P6), needs Q8 and F-11. | Owner's yes and consent line changed first (legal: P6 bars rendering `consent_at` before); no average beside it (TR-7); connected records only; plain date, no badge styling. |
| C3-38 drop-off aggregate before purge | 2 | No sign-ups can happen while the gate is closed; adds retained data and edits a purge PR #62 is editing. | Build before the gate opens, not now. Per-day aggregate, no identifiers, D11 intact. |
| L-16 F-16 + K18 addition (re-approval) | 3 | The shape is sound and its conditions are hard-won; re-approving costs no cap slot under the chair's reading. But F-9 has not started, so it may lapse again. | All cycle-2 conditions word for word. K18: a single report never hides an adult's record; owner review; owner runs deletion; no DOB, ID or age estimation. Tell the owner F-9 is the bottleneck. |
| L-17 F-17 (re-approval) | 3 | Same as L-16: sound, blocked on F-9. | Exactly one normaliser: if `checkDisplayName` (`lib/handles.ts`, text-safety branch) lands first, F-17 and F-9 reuse it rather than adding a second. |
| L-20 F-20 tokens and contrast test (re-approval) | 4 | Cheapest permanent guard in the queue; blocked only by work already open (PR #55, fixes #12, #13, #26). | Cycle-2 conditions unchanged (no visible value change beyond the fixes; floor never lowered). |
| L-18 F-18 (re-approval) | 2 | A long chain of prerequisites (F-20, F-11, F-13, fixes #1, #2, #10), and its false parts are already fixes. Little user value left after those fixes. | Only after L-20; cycle-2 conditions unchanged. |
| L-19s F-19 sweep (re-approval) | 2 | Depends on L-18; tidy-up value only. | Only if L-18 is re-approved; cycle-2 conditions unchanged. |

### Round 1: Red team

#### Round 1, red team (how each item can be gamed, leak data, mislead viewers or fail)

Base origin/main f467293, read only. Lens: what a trader who wants a better-looking record, a hostile viewer or
reporter, or a scraper does with each item as written, and where the build could quietly fail. Scores are mine and
independent. Anything amending a decided owner rule is scored as "worth it if the owner says yes"; the owner's call
is the owner's.

| Item | Score | Reason | Conditions |
|---|---|---|---|
| C3-2 transfers as share moves | 4 | Today a trader hides a loss with no trace: transfer out 100, sell elsewhere, and nothing shows (TRANSFER is `unpriceable`, `lib/corporate-actions.ts:200`; taint at `lib/trades.ts:171`; the unpriceable branch removes moved-out units with no count, `:168-174`). Or transfer in 1 unit so 100 recorded units are excluded as "corporate". Both are cheap, trader-triggered routes around TR-1 on a Verified record. The proposal closes them, but two routes stay. (a) "Oldest first" on a move out is a guess when the broker moved specific lots: the remaining lots get the wrong basis, and the trader picks which lots move. (b) After a 1-unit move in, selling 101 instead of 100 still draws the tainted lot and excludes the whole sell (`:208-210`). Owner flag (amends `lib/trades.ts:52`). | (1) DK veto: oldest first only where it cannot change a basis (vendor names the lots, the whole position moves, or every candidate lot has the same basis). Otherwise the remaining lots stay tainted and are counted. (2) Moved-in lots stay tainted; unknown kinds keep the taint (LG veto). (3) Every transfer out counts, and the count reaches the pane through C3-17, so a "move losers out" pattern stays visible where records are read. (4) Probe tests: transfer-out-then-sell elsewhere gives 1 count, never 0. Transfer between two of the same user's connected accounts gives a count, not a silent disappearance. A property test shows a TRANSFER never improves a shown average. (5) Neutral copy that names no cause. Same slot as C3-3. |
| C3-3 oversell publishes recorded part | 2 | The DK probe is a real false-Verified route: an unreported 2:1 split, then sell 101 @50, publishes -50% Verified when the truth is ~0%. Selling all 200 publishes a fictional -50% on 100 units. The reverse case (an unreported reverse split) can publish a false gain. With unseen inflows, the size of the oversell is the main evidence of missing history, and the proposal ignores it. A wrong number with a Verified badge is worse than a counted exclusion, because exclusions are visible and a wrong number is not. The honesty gap (the copy blames missing history, `lib/copy.ts:69`) can be fixed with copy alone (F3-15). | Reshape before I'd approve. (1) Publish the matched part only when the extra units are a small share of the sell (a bound the committee sets, e.g. under 5%), or when the vendor marks the row as a short sale. Otherwise exclude it whole, as today. (2) Never publish when a split, stock dividend or symbol change on that pair is in the vendor's corporate-action list but not applied. (3) LG vetoes: the copy states no cause; exclude whole when the ledger was empty or emptied. (4) Probe tests for the unreported-split cases (forward and reverse) stay excluded. Owner flag. |
| C3-17 exclusion counts beside the headline | 4 | Counts on the profile only (`app/u/[handle]/page.tsx:289-292`) mean a record that is 30% excluded looks clean on the pane and strip, where it is actually read. That is the cheapest way to make every remaining exclusion route (C3-2, C3-3, `notShared` at `lib/sync.ts:99`) visible. Failure modes: the pane and the profile count different things, or the line pushes the disclaimer off screen. | (1) One function sums the counts for the profile, pane and strip (a test asserts they are equal). It includes `notShared` exclusions, or the profile names them separately. (2) The disclaimer stays in view at 360 px (LG veto). (3) Neutral wording, no warning colour. (4) Share card unchanged until owner Q4. (5) Signed-out e2e. |
| C3-15 in-app disconnect | 3 | Disconnect is a freeze-at-the-peak tool: disconnect after a good run and the frozen record keeps ranking. Reconnect later, and the hourly read starts 7 days before the newest stored row (`lib/sync.ts:379`), so the gap is read back. But a gap with no new rows at all, or a reconnect through a new authorization, must be tested. Without F3-3 the flag stops nothing. Blocked on F3-3, F-11 and owner Q2/OD-9, so it cannot start this cycle. | (1) After step 2 nothing reads that connection (cron, /connect/done, rebuild): LG veto. (2) The frozen state is public on the pane, feed and profile ("Disconnected <date>", F-11), and a frozen record's rank shows its frozen date. (3) A reconnect of the same account reads from the disconnect date or earlier, and an e2e test covers trades made during the gap. (4) The server action is POST-only with a CSRF/origin check, and the account belongs to the session user. (5) Demo users see nothing. |
| C3-9a late-sell reconciliation | 4 | A sell posted more than 7 days behind the newest stored row is never read (`lib/sync.ts:378-379`, `:37` do nothing). The record silently omits a real close, and the matching of every later sell is wrong. A trader cannot easily cause this on purpose, but it is a silent data loss under a Verified badge. The risk: inserting an old sell re-prices later shown closes, so a card someone already shared changes with no trace. | (1) Insert-only, no row updated in place. (2) A rebuild that changes or removes a shown close is logged per user, and the profile can say "n closes recomputed after a late broker posting" (copy for the owner/F-11 later). (3) Stays within F-14's read budget. If F-14 has not merged, it waits with F-14 and does not take a slot. (4) Fake-vendor e2e with a sell 10 days late. |
| C3-16 connection health | 3 | The real risk is to viewers: a trader can revoke access at the broker. The record then stops updating while it still reads as live and connected (no `disconnected_at`), which freezes the record without the label. The proposal adds a trader-only line and nothing public. The vendor signal is unverified, so the build may rest on a field that never fires. | (1) A public "Last updated <date>" (F-11) shows on a stale record, whatever the vendor signal says. Staleness comes from our own last successful read, not only from the vendor flag. (2) `needs_reconnect_at` never hides the record or improves its rank. (3) No email until Q5. (4) The vendor field is confirmed in vendor docs before the build starts. Otherwise the item waits. |
| C3-37 day-7 marker (F-15 amendment) | 3 | Low abuse surface, but measurement fields tend to grow into per-viewer tracking ("just add the hour", "just add the referrer"). Could fail by stretching session retention to keep the date computable. | LG vetoes word for word: at most a first-seen day and a returned-after-day-7 day per account, dates only, never public, deleted with the account. It never extends session-row life (`lib/privacy-purge.ts:52`). No further field without the privacy committee. |
| C3-36 round public payloads | 4 | Real leak: `/pane` sends ms `closedAt` and full-precision returns publicly cached (`app/u/[handle]/pane/route.ts:22`, `:26`); the feed sends epochs (`lib/feed.ts:197-198`). With public day prices and a flat fee, full precision recovers position size, which consent calls private (`lib/copy.ts:79`). But 4 decimals is a 0.01% step, one more digit than the screen's 1-decimal percent (`lib/format.ts:56-58`). On a small position, a $1 fee on $10k is exactly 0.0001, so 4 decimals still leaks size. The same route also sends `unrealized_pct` and `openAsOf` in ms, which the brief does not name. | (1) Round to the precision the screen prints (percent to 1 decimal, i.e. 3 decimals of fraction), except where `pct()` adds digits near -100%. If 4 decimals is kept, a probe shows fee-based size recovery fails at that precision. (2) Every public payload is covered: closes, open `unrealized_pct`, `openAsOf`, pane-chart, feed HTML and series, images (LG veto). (3) Stats, ranks and CIs compute on stored values (LG veto). (4) A probe test tries the size recovery on the rounded output. |
| C3-34 health endpoint and cron 401 log | 4 | Cheap, and it catches a stalled sync. Two abuse routes as written. (a) A public "stalest sync in hours" with 3 traders describes one person's account, and it gives an attacker a free view of operations. (b) "One log line per bad token" lets anyone hitting `/api/sync` write unlimited log lines (cost, log flooding, masking real errors). | (1) The public body is `ok`/`degraded` only. Times and hours only behind the cron bearer. (2) The 401 log line has no token, prefix or IP (LG veto) and is rate-limited or aggregated (one line per minute with a count). (3) `no-store`. (4) A test greps the body for ids, handles and figures. |
| C3-39/40 record tools while billing off + settings order | 4 | No gaming surface. Two failure modes. (a) "Not open yet" turns into a launch promise or a waitlist (an email capture under another name). (b) Making Delete secondary turns into hiding it, a deletion dark pattern. | (1) LG vetoes: no price, date, "coming soon", waitlist or email capture; LIVE_BILLING untouched. (2) "Delete my profile…" stays on /settings, visible at 360 px without expanding, one tap to view 2, and view 2 is unchanged (S9). (3) F-3 open-state e2e is unchanged. (4) The amended F-1/F-3 plan lines are listed in the decision. |
| C3-42 full data export | 3 | A full export is the most valuable thing a session hijack can take. On the dev stub (`lib/session.ts:9-14`, `ALLOW_DEV_AUTH`) anyone could download anyone's export. It also leaks moderation internals if it includes which moderation rule held a thesis (that teaches evasion of the regex list in `app/actions.ts`), and reporter identities if reports about the user are included. Scope is owner Q7/BC-10. | (1) Real auth only; refused under dev auth in production (LG veto). (2) No secrets, ciphertext or vendor secret (LG veto). (3) No reporter identity and no moderation rule id: a held thesis is exported as text plus "held". (4) Rate-limited, `no-store`, and the export itself is not logged with content. (5) Owner Q7 first. |
| C3-35 versioned cacheable share images | 2 | `immutable` for a year on a CDN fights takedown and deletion: a hidden or deleted profile's versioned image keeps serving from edge caches we cannot reliably purge, and it keeps circulating as a "current" record. Arbitrary version strings let anyone bust the cache and burn image-render compute. No traffic exists to save. Blocked on F3-26. | If it returns: (1) An unknown or mismatched version redirects to the current one or gets a short cache, never a fresh long-cached render. (2) Hide, takedown or deletion makes every old version 404 at the origin and is purged at the CDN, with a test (LG veto). (3) The cache lifetime is days, not a year. (4) The image keeps the disclaimer and absolute dates. |
| C3-43 "Public since · n closes since" | 3 | The idea defends against hindsight, but as specified it can be gamed. `consent_at` is per connection (`db/schema.sql:289`), so a trader after a bad streak adds a new connection or reconnects to reset "public since", and "n closes since" then counts only the good run. That makes the anti-cherry-pick line itself a cherry-pick window. A trader can also close winners and hold losers open after going public, so the count flatters. | (1) The date is the user's first-ever consent, and no reconnect, new connection or account removal resets it (test). (2) Open positions stay shown beside it (TR-3). (3) No second average and no "proof"/"can't be cherry-picked" claim (LG veto). (4) It never renders for records that consented under the old consent line (LG veto). Owner Q8 first; F-11. |
| C3-38 drop-off aggregate before purge | 2 | Low value with the gate closed. With single-digit sign-ups, per-day per-step counts joined with server logs or a known invitee list can point to a person ("the one who stopped at broker connect on Tuesday"). It also edits the purge that PR #62 is editing, which risks a merge that delays the purge. | If it returns: (1) Weekly buckets, or suppress cells under a small count. (2) Counts only, no attempt id, email, IP or UA (LG veto). (3) An aggregation error never delays or blocks the purge (LG veto), with a test. (4) After PR #62. |
| L-16 F-16 trust-and-safety + K18 | 3 | Reports are the classic weapon: rivals report a strong record to get it hidden. The K18 addition ("hide on a 'may be under 18' report") is the most weaponisable line in the ballot, because an age claim is unfalsifiable by the reporter and sympathetic to act on. F-16's own conditions (no auto-hide on profile reports) are the defence and must hold for age reports too. It cannot start (F-9 unstarted), so the approval may lapse again. | (1) Every F-16 LG veto stays verbatim. (2) K18: no hide on a single report. Hide only after owner review. Reports come from signed-in users only and are rate-limited per reporter and per target. Repeated unfounded reports from one account are visible to the owner. (3) The hidden state is neutral ("not available"), with no "under review" or age wording (no minors' cohort words). (4) No DOB, ID or age estimation (LG veto). (5) The owner runs any deletion. (6) Lapse clause: lapses again if F-9 has not merged by the next council. |
| L-17 F-17 handle and name integrity | 4 | Impersonation is the top social-engineering route on a records site: a look-alike handle or display name borrows another trader's Verified record in a shared link. Two normalisers (F-9's and `checkDisplayName` on `claude/fix-user-text-safety`) are a bypass in themselves, since anything the checks normalise differently gets through. | (1) Exactly one normaliser used by signup, rename, display name, search and the report path, with a test that every caller imports it. (2) Confusables cover mixed scripts, zero-width and bidi characters, and case/width folds. (3) No third-party or real names in the list, tests or fixtures (LG veto). (4) A hold never blocks deletion. (5) If the text-safety branch lands first, F-17 reuses its normaliser instead of waiting on F-9 (a DK call). Lapse clause otherwise. |
| L-20 F-20 tokens and contrast test | 4 | A faint disclaimer or a low-contrast loss colour misleads viewers as surely as wrong copy. A permanent contrast floor in CI is the cheapest guard against that, and it is blocked only by open work (PR #55, fixes #12/#13/#26). | (1) Earlier conditions verbatim; the floor is never lowered. (2) The test covers the disclaimer text, gain/loss/flat tones, the Demo badge and image text, not only body text. (3) No visible value changes beyond the fixes. Lapse clause. |
| L-18 F-18 one trust language | 3 | Consistent wording for Verified/Demo/Disconnected is anti-misleading by design. The risk is a sweep that merges distinct states into one friendlier word (e.g. "failed" read as "connected"). Too many prerequisites are unmerged (F-11, F-13, F-20, #1, #2, #10), so it will likely lapse again. | (1) Earlier conditions verbatim. (2) Every record state keeps a distinct visible word (state x surface test); Demo is never called Verified (fix #1). (3) After L-20. Lapse clause. |
| L-19s F-19 call-site sweep | 2 | A formatting sweep is where small losses become "0.0%" or a sign flips. `pct()` guards these today (`lib/format.ts:50-64`), but a sweep that "replaces this algorithm" can drop a guard. It sits behind two blocked items. | (1) The `pct`/`tone` guarantees (no "-0.0%", no rounding to -100%, flat is never coloured) keep their tests, and new tests cover the new form. (2) A golden test over every surface shows no figure changes except the agreed glyph/format. (3) After L-18. Lapse clause. |

General note for the chair: three items (C3-2, C3-17, C3-43) are anti-gaming only if their counts and dates cannot be
reset or routed around. The tests named above (count never 0 after a transfer out; pane equals profile; first-ever
consent date) are the part that makes them work. Do not drop them in the build.

## 4. Round 3a: debate arguments

### Instructions

#### Round 3a: debate arguments

All round-1 scores are in `r1-table.md`; every member's reasons are in `r1-<slug>.md` (read the ones you need).
Speakers per item are listed in `r3-speakers.md` (the five highest and five lowest scorers on each item, counted
only among members above/below the item's mean).

Chair's state correction (verified with git): **F-9 is built** on the unmerged branch `claude/fix-user-text-safety`
(commit 53b74e3 "F-9 built with its decisions and criteria"; head c0eac6e, merged with main; no open PR). That branch
also carries `lib/reports.ts` and `lib/handles.ts` (`checkDisplayName`). So L-16 and L-17's prerequisite is in flight,
not unstarted. Also found in round 1 (fixes-list notes, not ballot items): the rename-chain read at
`lib/sync.ts:121-127` lacks the `notShared` filter that `:99` applies (reliability); `app/ui.tsx:74` prints
"No thesis posted." over a held thesis (legal).

Task: for each item where you are a speaker, state your single strongest argument (one or two lines, `path:line`
where useful), FOR if you are listed high, AGAINST if listed low. Do NOT change scores yet.
Write to `r3a-<slug>.md`, and reply with the same lines ("ID (for|against): argument"), nothing else.

### Speakers

#### Round 3 speakers (five highest and five lowest round-1 scorers per item; above or below the item mean only; ties at the cut broken by roster order)

- business-lead: argue FOR (high) C3-2, C3-3, C3-37, C3-39/40, C3-43, C3-38; argue AGAINST (low) C3-17, C3-15, C3-9a, C3-16, C3-36, C3-34, C3-42, C3-35, L-16, L-17, L-20, L-18, L-19s
- market-research: argue FOR (high) C3-2, C3-3, C3-9a, C3-16, C3-37, C3-36, C3-39/40, C3-42, C3-43, C3-38, L-16, L-17, L-18, L-19s; argue AGAINST (low) C3-17, C3-15, C3-34, C3-35, L-20
- pricing-finance: argue FOR (high) C3-16, C3-37, C3-34, C3-39/40, C3-42, C3-38, L-16, L-17; argue AGAINST (low) C3-2, C3-17, C3-15, C3-9a, C3-36, C3-35, C3-43, L-20, L-18, L-19s
- growth: argue FOR (high) C3-2, C3-3, C3-16, C3-37, C3-42, C3-43, C3-38, L-16, L-17; argue AGAINST (low) C3-17, C3-15, C3-9a, C3-36, C3-34, C3-35, L-20, L-18, L-19s
- ux-lead: argue FOR (high) C3-2, C3-3, C3-16, C3-39/40, C3-42, C3-43, L-20; argue AGAINST (low) C3-17, C3-15, C3-9a, C3-37, C3-36, C3-34, C3-38, L-16, L-17, L-18, L-19s
- product-designer: argue FOR (high) C3-36, C3-39/40, C3-35, L-20, L-18, L-19s; argue AGAINST (low) C3-9a, C3-16, C3-37, C3-34, C3-38
- dataviz: argue FOR (high) C3-17, C3-9a, C3-36, L-20, L-19s; argue AGAINST (low) C3-16, C3-37, C3-39/40, C3-38, L-16, L-17
- a11y: argue FOR (high) C3-15, C3-35, C3-38, L-20, L-18, L-19s; argue AGAINST (low) C3-2, C3-37, C3-36
- engineer: argue FOR (high) C3-36, C3-34, L-20, L-19s; argue AGAINST (low) C3-3, C3-16, C3-37, C3-43, L-16, L-17
- reliability: argue FOR (high) C3-9a, C3-16, C3-36, C3-34, C3-35; argue AGAINST (low) C3-3, C3-39/40, C3-43, L-17, L-20
- legal: argue FOR (high) C3-15, C3-9a, C3-42, L-16, L-17, L-18; argue AGAINST (low) C3-3, C3-16, C3-39/40, C3-43
- trust-safety: argue FOR (high) C3-2, C3-3, C3-17, C3-9a, C3-43, L-16, L-17, L-18; argue AGAINST (low) C3-39/40, C3-42, C3-38
- decisions-keeper: argue FOR (high) C3-34, C3-35; argue AGAINST (low) C3-2, C3-3, C3-39/40, C3-42, C3-43
- common-sense: argue FOR (high) —; argue AGAINST (low) C3-42, C3-35, C3-38, L-16, L-18, L-19s
- red-team: argue FOR (high) C3-34; argue AGAINST (low) —

### Round 3a: Business lead

#### Round 3a, business lead (arguments only; scores unchanged)

- C3-2 (for): Moving between brokers is routine for the active traders G1 needs. Today a move out followed by a sale elsewhere erases a real loss with no count, and one share moved in excludes 100 recorded units (`lib/corporate-actions.ts:200`, `lib/trades.ts:171`). "The verified record hides losses" is the one story that sinks G1-G3 together.
- C3-3 (for): The case FOR: today a recorded -50% close disappears behind a cause that is false when the entry is recorded (`lib/copy.ts:69`, `lib/trades.ts:208-210`). One extra share should not let a trader's real loss vanish. Built only with exclude-whole kept for any ledger an unseen inflow could have touched, which neutralises the DK split probe.
- C3-37 (for): G4 is one of four binding week-8 gates and cannot be rebuilt at week 8 today, because sessions are purged at 30 days and `last_seen_at` is overwritten (`lib/auth/sessions.ts:10,33,46`; `lib/privacy-purge.ts:52`). An S amendment inside F-15, with no slot, is the only way the kill decision is not made blind.
- C3-39/40 (for): Every signed-in trader gets a primary button into a locked page with no way back (`app/account/page.tsx:61`, `app/tools/page.tsx:69-78`), and Delete is the heaviest element on every settings visit (`app/settings/page.tsx:43-44`). That is adoption friction for exactly the 50 traders G1 needs, and it teaches them the paid tier is vapour.
- C3-43 (for): "Public since <date> · <n> closes since" is the one line a trader cannot cherry-pick in hindsight. It is the strongest credibility signal for a viewer arriving from a shared link (G3 to G4). A conditional approval costs nothing until the owner answers Q8, and then it is ready.
- C3-38 (for): G1 is the gate most likely to miss. The 30-day purge (`lib/privacy-purge.ts:22`, `:180`) deletes weeks 1-4 of sign-up drop-off before the week-8 reading, so a miss would come with no diagnosis. It must be built before launch to have data from day one.
- C3-17 (against): No gate moves until real traders have exclusions, and the pane file waits on F3-2 (unmerged). The profile already shows the counts (`app/u/[handle]/page.tsx:289-292`), so it can follow the ledger slot rather than compete with it.
- C3-15 (against): Blocked three ways (F3-3, F-11, owner Q2/OD-9). An approval now changes nothing on main and only queues another lapse.
- C3-9a (against): Sells posted more than 7 days late are a rare edge with 0 real connections, and the vendor's late-posting behaviour is unverified. It belongs in the fixes or ledger lane, not a council slot.
- C3-16 (against): It reads a vendor signal nobody has verified, for connections that do not exist yet. No link can go stale at 0 users.
- C3-36 (against): No displayed figure changes and no gate moves. It is a privacy-hardening chore that could ride with the fixes instead of taking a pane slot.
- C3-34 (against): Owner-facing ops with no effect on traders or viewers. The right home is a chore with the fixes, not an approved feature.
- C3-42 (against): Scope is owner Q7 and the Privacy Policy is BC-10. Building before both are decided risks building it twice, and it moves no gate before launch.
- C3-35 (against): A caching cost fix for share traffic we do not have, blocked on F3-26. If it goes wrong, an old figure is served for a long time, which is a credibility risk on the G2 loop.
- L-16 (against): F-9 is built but sits on an unmerged branch with no open PR (`claude/fix-user-text-safety`). Re-approving before it merges repeats cycle 2's lapse. Better: merge F-9 first, then confirm L-16 on the same conditions.
- L-17 (against): Same F-9 dependency. The `checkDisplayName` normaliser on that branch is not reviewed yet, and approving F-17 before it merges risks two normalisers.
- L-20 (against): Blocked only by PR #55 and fixes #12/#13/#26. Re-approve when those merge; until then the approval lapses on the same terms as cycle 2.
- L-18 (against): It waits on six unmerged prerequisites (F-20, F-11, F-13, fixes #1/#2/#10), and its false-label parts are already fixes. Re-approving queues a certain lapse.
- L-19s (against): Consistency work behind L-18, with no adoption or gate effect. It cannot start this cycle.

### Round 3a: Market research lead

#### Round 3a, market research lead: debate arguments

Positions follow r3-speakers.md (relative to each item's mean). My round-1 scores are unchanged.

- C3-2 (for): A transfer out makes a loss vanish with no line (`lib/corporate-actions.ts:200`, `lib/trades.ts:171`). That is the "customers pick which trades to post" pattern of the broker-native verified feed (`market-2026-11-01.md:227`), so it erases our only edge, "no per-trade hiding" (`:596`).
- C3-3 (for): The strongest case is honesty of cause. Today one extra share hides a recorded -50% behind a line blaming missing history (`lib/copy.ts:69`), and posters already go quiet after losses (`market-2026-11-01-cycle2.md:78`). Only a vendor position-units check makes publishing safe (`:512`), so the copy fix is the part to take now.
- C3-17 (against): The pane line is cheap and right, but it shouldn't take a slot ahead of C3-2: until transfers and oversells stop leaving silently, the count it shows is incomplete. Sequence it after the ledger slot so viewers see one true number, not a revised one.
- C3-15 (against): No real connection can be disconnected before launch, and the item waits on F3-3, F-11 and owner Q2. An approval now just lapses again at the next council.
- C3-9a (for): A sell posted more than 7 days late is never read (`lib/sync.ts:378`), so a realized loss never appears and the position stays open forever. That is a silent Verified divergence (kill risk #2, `market-2026-11-01-cycle2.md:462`), and it is insert-only.
- C3-16 (for): The product has no push (F3b), so a link that silently stops updating is the supply side's main retention leak, and to viewers it reads as an abandoned record. Freshness is what 18% of investors rank first (`market-2026-11-01-cycle2.md:163`).
- C3-34 (against): Traders and viewers gain nothing directly from it, and it is S. Run it as a chore with the fixes rather than spend a council slot.
- C3-35 (against): It is a cost fix for traffic that doesn't exist (central week-8 case ≈1,150 external views/week, `market-2026-11-01-cycle2.md:109`). A long-cached card showing old figures on the main distribution surface is a trust risk.
- C3-36 (for): Percent-only is the promise traders connect on. Ms dates and full-precision returns (`app/u/[handle]/pane/route.ts:22`) let anyone recover position size, which breaks that promise silently, before any user can notice or object.
- C3-37 (for): G4's primary measure is day 7 ±1 (`market-2026-11-01-cycle2.md:248`), and sessions purge at 30 days (`lib/auth/sessions.ts:10`). Without this one date the week-8 viewer gate cannot be read at all, and it costs no slot.
- C3-39/40 (for): Every signed-in user meets a primary button to a dead end (`app/account/page.tsx:61`, `app/tools/page.tsx:69-78`). The signed-in return is the scarce G4 cohort (2-20% of viewers, `market-2026-11-01-cycle2.md:248`).
- C3-42 (for): Traders ask whether they can take their data before linking a broker. A "Download my data" label over a file holding three tables (`lib/copy.ts:674` vs `app/account/export/route.ts:5-6`) is a trust cost, and COMPLIANCE requires it before launch (`docs/COMPLIANCE.md:75`).
- C3-43 (for): TR rules stop cherry-picking of trades but not of *when* a trader connects (`market-2026-11-01.md:143`). "Public since" is the only line that lets a skeptical viewer separate forward record from hindsight, and adding it at 0 users avoids re-consent later.
- C3-38 (for): Supply refusal is kill risk #1 (`market-2026-11-01-cycle2.md:461`). Without step counts that survive the 30-day purge (`lib/privacy-purge.ts:180`), a G1 miss at week 8 cannot be diagnosed, so it must exist before the gate opens.
- L-16 (for): F-9 is now built on `claude/fix-user-text-safety` (`lib/reports.ts` included), so the block is a merge, not a start. Real linkable records are better scam bait than screenshots (`market-2026-11-01-cycle2.md:139`, `:468`), and report and takedown are pre-launch (U2/U3).
- L-17 (for): Look-alike handles are how real records get impersonated (MRC2-6). `checkDisplayName` is already on the F-9 branch (`lib/handles.ts`), so F-17 can reuse the one normaliser now.
- L-18 (for): Plain labels carry the strongest viewer-side evidence we have. About a third of US adults sit at or below the lowest numeracy level (`market-2026-11-01-cycle2.md:69-73`), and one meaning per trust word is what lets a stranger read a card in a glance.
- L-19s (for): Inconsistent number formatting across surfaces erodes readability for that same low-numeracy audience. The first slice (`lib/format.ts`, #57) is merged, so the sweep makes it consistent.
- L-20 (against): The demand evidence backs plain labels, not tokens. With PR #55 and fixes #12/#13/#26 unmerged, a re-approval would lapse again. The contrast test can ride with PR #55 instead.

### Round 3a: Pricing and finance

#### Round 3a: pricing-finance arguments

FOR (high):
- C3-16 (for): The only item that stops a recurring cost. A dead authorization keeps billing about $1.03 a month per trader (business §4, VERIFIED) and produces no data, and today nothing detects it (`lib/broker.ts:86-91`). It also keeps the trader from silently disappearing.
- C3-37 (for): The week-8 reading is the go/no-go on all further spend, and its viewer-return gate can't be read without this marker: sessions are purged (`lib/privacy-purge.ts:52`) and `last_seen_at` is overwritten (`lib/auth/sessions.ts:46`). Small, and an amendment to F-15, so no extra slot.
- C3-34: (for) A stalled sync burns vendor fees and gate weeks unnoticed. The 401 path logs nothing (`app/api/sync/route.ts:34-36`). Small, with no paid monitoring vendor: the cheapest insurance on the running cost.
- C3-39/40 (for): With billing off, demoting the primary "See Record tools" (`app/account/page.tsx:61`) costs $0 in revenue. Leaving a dead end to locked /tools (`app/tools/page.tsx:69-78`) teaches every signed-in user that the paid feature is broken before it opens.
- C3-42 (for): COMPLIANCE asks for it before launch (`docs/COMPLIANCE.md:75`). Building it now, at 0 users and with no runtime cost, is cheaper than retrofitting it under a deadline after the first access request.
- C3-38 (for): The only way to replace the estimate of about 1,250 contacts and 46 owner hours per 50 traders with a measured cost per connect. Once the purge deletes the events (`lib/privacy-purge.ts:180`), that diagnosis is gone for good.
- L-16 (for): A launch-path gate (B8, BC-2), and its prerequisite is now in flight: F-9 is built on `claude/fix-user-text-safety` with `lib/reports.ts`. Re-approval costs nothing and lets it start the moment F-9 merges.
- L-17 (for): A launch-path gate (U2 reserved handles). Its normaliser and `checkDisplayName` already exist on the F-9 branch (`lib/handles.ts`), so this is mostly wiring. Impersonation would make the paid record worthless.

AGAINST (low):
- C3-2 (against): Before any build it costs owner attention, because it amends `lib/trades.ts:52` and the committee's "exclude and count". At beta size it changes few trades. Spend the owner's time on the beta-gate items first.
- C3-17 (against): It waits on F3-2 in the same pane file (unmerged), and the card part waits on owner Q4, so an approval now may sit idle and lapse into another paid council round.
- C3-15 (against): It is blocked three ways (F3-3, F-11, owner Q2/OD-9). Without BC-16 a "disconnect" keeps billing about $12 a year per frozen record. It may be approval paperwork with no build this cycle.
- C3-9a (against): No real user exists, so no late sell can be missed yet. The 7-day window (`lib/sync.ts:378`) can be widened cheaply once real data shows the gap.
- C3-36 (against): A fix for a risk with no users. Price recovery is unverified (it needs the probe's flat commission), and the build session costs more than the exposure at 0 users.
- C3-35 (against): About 0.37 s per image request sits inside the hosting plan's included usage at beta volume. The build session (about $26 or more) exceeds a year of the saving, and a stale long-cached image is a trust cost.
- C3-43 (against): Small value for a secondary line, and it spends owner attention (Q8, P6 consent list) while needing F-11, which isn't built.
- L-20 (against): Every prerequisite is unmerged (PR #55, fixes #12, #13, #26), so the slot likely sits idle and lapses again: a second paid council round for the same approval.
- L-18 (against): No effect on the week-8 gates; its false parts are already in fixes #1, #8 and #10. It waits on F-11, F-13, F-20 and three fixes, the most likely item to lapse again.
- L-19s (against): Polish queued behind L-18 and L-20, with no effect on gates or cost. Re-approving it now only books a future lapse.

### Round 3a: Growth

#### Round 3a, growth (arguments only; scores unchanged)

- C3-2 (for): Anchor-led word of mouth depends on a shared record nobody can catch hiding a loss. Today a transfer out makes a loss vanish, or 100 recorded units get excluded as "corporate" (`lib/trades.ts:52`). That is the first thing a critic would post about an anchor's link.
- C3-3 (for): The current line names a false cause for a recorded -50% (`lib/copy.ts:69`), which reads as "the record hides losses". It is worth fixing with exclude-whole kept for the DK probe (any unseen inflow or split), so we never publish a fake loss either.
- C3-16 (for): A connection that goes stale without anyone noticing is the main way traders churn. The record stops updating, the trader stops sharing, and nothing tells them why. It should be approved now with conditions so it is ready before the first 100 connect: trader-only line, no email until Q5.
- C3-37 (for): Go-to-market week 0 requires first-party gate counters (`docs/IDEAS.md:119-121`). Without one day-7 date per account, G4 can't be read at week 8, because sessions purge and `last_seen_at` is overwritten (`lib/auth/sessions.ts:46`). Size S and no slot of its own.
- C3-42 (for): Deletion and privacy are on the week-0 list. An export whose scope is set now (owner Q7) keeps it from being the last item holding back launch.
- C3-43 (for): "Public since · n closes since" is the one line on a shared link that the trader can't have picked with hindsight. It turns a profile visit into trust and costs one secondary line. Owner Q8 first.
- C3-38 (for): If G1 misses at week 8 this is the only diagnosis we would have. It has to exist before the gate opens, because the purge deletes day-one funnel data (`lib/privacy-purge.ts:180`). It is an identifier-free per-day aggregate.
- L-16 (for): The report action is a named week-0 prerequisite (`docs/IDEAS.md:120`). With F-9 now built on `claude/fix-user-text-safety` (53b74e3, with `lib/reports.ts`), this approval can start this cycle instead of lapsing.
- L-17 (for): Reserved handles and name clearance are week-0 prerequisites, and a look-alike handle on a forwarded share link breaks trust where outreach happens. F-9's normaliser and `checkDisplayName` are already in flight on the same branch, so a re-approval can start now with one normaliser.
- C3-17 (against): The count already lives on the profile, which is where a shared link lands. A second line on the pane adds noise on the swipe surface for little gain in activation or return, at 0 users.
- C3-15 (against): It is blocked on F3-3, F-11 and owner Q2/OD-9, so an approval now just lapses again and costs another council round.
- C3-9a (against): No real connections exist, so no late sell can be missed yet. It belongs in the ledger fixes when the vendor's read window is known, not in a slot now.
- C3-36 (against): No growth effect, and it only matters once there are real traders. It could ride with the fixes instead of taking a slot.
- C3-34 (against): Ops plumbing with no trader or viewer effect; it belongs on the chores list, not in an approval slot.
- C3-35 (against): A cache-cost fix for traffic we don't have. A long-cached stale image on the most-shared surface is a trust risk, and F3-26 is unmerged.
- L-20 (against): Re-approving while PR #55 and fixes #12, #13 and #26 are unmerged produces another lapse. Confirm it the cycle those merge.
- L-18 (against): Its chain (F-20, F-11, F-13, fixes #1, #2, #10) is long, and the false parts are already fixes. A re-approval would lapse again.
- L-19s (against): Formatting consistency with no effect on activation, sharing or return. It depends on L-18 anyway.

### Round 3a: UX lead

#### Round 3a, UX lead: debate arguments (scores unchanged)

- C3-2 (for): The record goes quiet with no line at all. After a full transfer out and a sale elsewhere, a real loss leaves no trade, no count and no line. Today a transfer in also files 100 recorded units under "corporate" (`lib/corporate-actions.ts:200`, `lib/trades.ts:171`). A viewer reading the profile at 360 px has nothing to notice, which is exactly the "hidden losses" read the product promises can't happen.
- C3-3 (for): The words on screen today are false. "1 earlier position excluded: no matching entry in the imported history" (`lib/copy.ts:69`, `p4-360-excluded-line.png`) blames history that is recorded. At minimum, approve it so that the DK probe case stays excluded and the line names the true cause ("sell larger than the recorded position").
- C3-16 (for): A broken link fails silently for the one person who can fix it. The trader's record stops updating, and nothing on their own profile says so or offers a way back (`lib/broker.ts:86-91` reads no health signal). A trader-only line and one tap to /connect is the whole fix, and signed-out viewers see nothing new.
- C3-39/40 (for): The heaviest element on every /settings visit is a purple primary "Delete my profile" above an at-rest "Keep it" (`app/settings/page.tsx:43-44`, `p2-360-settings.png`). The primary button on /account leads to a locked /tools with no next step (`app/account/page.tsx:61`, `app/tools/page.tsx:69-78`). This is the only flow defect on the ballot that every signed-in user meets, it is S, and it has no prerequisite.
- C3-42 (for): The button says "Download my data" and the file holds three things (`lib/copy.ts:674`, `app/account/export/route.ts:5-6`). A user asking for their data is a task that must succeed before launch (`docs/COMPLIANCE.md:75`). Approve conditional on Q7, so the build is ready when the owner rules.
- C3-43 (for): "Public since ‹date› · ‹n› closes since" is the one line a skeptical viewer can't get anywhere else: the part of the record that hindsight could not pick. Approve conditional on Q8 and the consent list, as one secondary line under F-11's status.
- L-20 (for): A contrast test is the only guard that keeps every later change readable at 360 px in both schemes. It is blocked only by work already open (PR #55, fixes #12, #13, #26). Re-approve it conditional on those merging, so it starts the day they land.
- C3-17 (against): It can't start: it waits on F3-2 in the same pane file (`app/pane.tsx`). And as written, "(see profile)" is bare text, not a way to reach the reasons. Approve it only with the line as a real link, using the same sum function as the profile, or it adds a number the viewer can't act on.
- C3-15 (against): Approving now changes nothing. It has three open blockers (F3-3, F-11, owner Q2), and a disconnect button whose flag does not stop reads would be a broken promise that looks finished. Keep it waiting until F3-3 merges.
- C3-9a (against): No viewer or trader sees anything from it. It is ledger plumbing that belongs inside the C3-2/C3-3 slot or with the fixes, not counted as its own approval.
- C3-37 (against): No screen changes. It adds a stored per-account date for a reading that needs real viewers, of whom there are none (gate closed), so it can ride with F-15's rework without a council approval of its own.
- C3-36 (against): No figure on screen changes, so its UX value is nil. The one UX risk is that rounding dates to days can reorder same-day closes and send a chart scrub to the wrong trade. Make that a test, or don't build it.
- C3-34 (against): No trader or viewer surface. It is an ops chore that should ride with the fixes, not take an approval or a review slot.
- C3-38 (against): Sign-ups can't happen while the gate is closed, so the aggregate would count zeros, and PR #62 is editing the same purge (`lib/privacy-purge.ts:180`).
- L-16 (against): F-9 is built but unmerged, with no open PR (`claude/fix-user-text-safety`). Re-approving now queues a third lapse risk and a review slot, while settings, ledger and pane already compete for review. Re-approve it with a lapse clause tied to F-9's merge, not as a slot that counts now.
- L-17 (against): It waits on the same unmerged F-9 branch. That branch's `checkDisplayName` in `lib/handles.ts` must first be confirmed as the one normaliser, or F-17 builds the second one its own criteria forbid.
- L-18 (against): Six prerequisites are still unmerged (F-11, F-13, F-20, fixes #1, #2, #10). Its false-label parts are already fixes, so a re-approval adds nothing users will see this cycle.
- L-19s (against): Its only visible part, the What's-this range line, waits on L-18, which is itself blocked. Re-approving a sweep behind two blocked items buys nothing.

### Round 3a: Product designer

#### Round 3a: product designer

- C3-36 (for): The pane prints a day (`app/pane.tsx:77`), but its public payload ships `closedAt` in milliseconds (`app/u/[handle]/pane/route.ts:22`) under a public cache (`:26`). Sending exactly what the screen shows is S. A parity test (pane headline = profile headline; the same UTC day on both) also closes the double-rounding and date-shift drift between click and swipe profiles (DECISIONS #11).
- C3-39/40 (for): The heaviest element on every /settings visit is a full-width primary "Delete my profile" (`app/settings/page.tsx:43`), and /account's only primary leads to a locked page with no way back (`app/account/page.tsx:61`). This is the clearest hierarchy defect on the ballot: S, and fixed before real users meet it.
- C3-35 (for): The share card is the most-seen surface. An unversioned image can unfurl a figure the profile no longer shows. Versioning by record content makes the card and the profile agree, and F-11's absolute dates are kept.
- L-20 (for): It is the only guard that stops the next screen change from regressing light Verified (3.77:1) or gain against loss under deutan (ΔE00 2.8). It blocks only on work already open (PR #55, fixes #12/#13/#26), and every later design item rests on it.
- L-18 (for): Three Verified wordings and three Demo names ship today, and the badge sits on the h1 line instead of the stats row. Settled conflict 8 and §4 of the design system are its spec. It stays approved even if it waits.
- L-19s (for): 0.0% is still painted red or green, and still announced as "Gain", at the 20+ sites `lib/format.ts:17-40` lists. Without the sweep, the one `pct()`/`tone()` exists only in `lib/`.
- C3-9a (against): Nobody can see it with 0 real connections. It must fit F-14's read limit, and F-14 is unmerged (`claude/f14-sync-cadence`), so building it now edits `lib/sync.ts:378` twice. Wait for F-14 and build it in the connection slot.
- C3-16 (against): The signal it reads is unverified (`lib/broker.ts:86-91` reads only the authorization id and the initial-sync flag), and with 0 connections no link can go stale. A new trader-facing warning built on a guessed signal risks a false "Reconnect" line.
- C3-37 (against): No screen and no reader until F-15 merges. It stores a new per-account date before the privacy committee has ruled on the field, so attach it to F-15's rework rather than approving it now.
- C3-34 (against): Nobody sees it, and with 0 real traders a stalled sync harms no one. #46's `sync_shards` heartbeats can already be queried, so it adds an endpoint before there is anything to watch.
- C3-38 (against): There are no real sign-ups to count. It edits the same purge as PR #62 (`lib/privacy-purge.ts:180`), so it is low value with a known merge conflict.

### Round 3a: Data-visualization designer

#### Round 3a, dataviz (debate arguments; scores unchanged)

- C3-17 (for): The pane and record strip print win rate, average and range with no sign that anything is left out. Counts render only on the profile (`app/u/[handle]/page.tsx:283-292`), and #52's `notShared` exclusion (`lib/sync.ts:99`) has no count anywhere. A headline that omits its exclusions where people read it is the most misleading figure we ship, and the fix is S.
- C3-9a (for): A sell posted more than 7 days behind is never read (`lib/sync.ts:378`), so a real closed loss can be missing from a Verified record's figures with no count. That is a silent TR-1 hole, and the insert-only fix leaves the owner's "raw, immutable" rule intact.
- C3-36 (for): Public JSON carries full-precision returns and millisecond times (`app/u/[handle]/pane/route.ts:22`, `lib/feed.ts:197-198`), finer than any screen shows and than consent allows (`lib/copy.ts:79`). Rounding at the edge to 0.01% and UTC days changes no printed figure, because `confidence()` and ranks still compute server-side.
- L-20 (for): Today light gain and loss are ΔE00 2.8 apart under deutan. The ΔE00 >= 9 floor and the shared image colour table are the only lasting guard that a loss can never read as a gain on any chart or card, and its blockers (PR #55, fixes #12/#13/#26) are already open.
- L-19s (for): The lo <= avg <= hi property test on every surface's printer is what stops a printed range from excluding its own headline (TR-9). It should be re-approved, and its range test can run as soon as fix #7 merges.
- C3-16 (against): With 0 real connections and a vendor authorization signal nobody has verified (`lib/broker.ts:86-91` reads none of it), we would build M of mechanism on a guess. No figure can go stale before real traders connect.
- C3-37 (against): It adds a stored per-account field and needs a privacy-committee ruling, only to serve an F-15 reading that needs traffic we do not have. It does nothing for any figure a trader or viewer sees.
- C3-39/40 (against): It amends two signed plans (F-1 `plan.md:75-77`, F-3 `plan.md:142`) to restyle screens nobody can reach in volume while billing is closed. Review capacity is better spent on the ledger and exclusion-visibility slot.
- C3-38 (against): It keeps diagnostics for sign-ups that cannot happen while the gate is closed, and it edits the purge that PR #62 is also editing (`lib/privacy-purge.ts:180`), so it adds merge risk for no data today.
- L-16 (against): F-9 is built but sits on an unmerged branch with no open PR (`claude/fix-user-text-safety`). Re-approving before F-9 merges risks a second lapse and a third council round on the same item. Confirm it the cycle F-9 merges.
- L-17 (against): Its normaliser prerequisite lives on the same unmerged branch next to `checkDisplayName` in `lib/handles.ts`. Approving now, before that branch settles which helper is the one normaliser, invites the two-normaliser drift F-17 exists to prevent.

### Round 3a: Accessibility specialist

#### Round 3a: a11y arguments

- C3-15 (for): A rule nobody can act on is a barrier. Consent promises "Your record stays public if you disconnect" (`lib/copy.ts:91`), but /settings has no control for it (`app/settings/page.tsx:20-46`). Today disconnecting means a vendor portal outside our AA guarantees. A named, two-step, keyboard-operable Disconnect with a `role=status` result (WCAG 3.3.4, 4.1.3) is the only path we can make accessible.
- C3-35 (for): The share image's alt text is set by the profile page from the record state (`app/u/[handle]/opengraph-image.tsx:13`). An unversioned image cached at the edge can show a different state than that alt describes. Versioning by record content keeps the image and its text alternative in step (1.1.1), as long as the alt is pinned unchanged.
- C3-38 (for): It's cheap and has no identifiers. Without the per-day counts, week-8 diagnostics can't tell whether a sign-up step loses people. An inaccessible step (focus trap, an unannounced error) shows up exactly as a drop at one step. Condition: steps are counted by name, nothing about the device or the user.
- L-20 (for): Main guards only the Demo badge (`lib/badge-contrast.test.ts`). Light Verified at 3.77:1 and gain/loss at ΔE00 2.8 under deutan are measured failures of A1 (`docs/POLICY.md:153-155`; `F-20:9-11`). Without a pair test, every later colour edit, F-18 included, can regress them silently. It is value-neutral, and the cheapest permanent A1 control there is.
- L-18 (for): Today the meaning of Verified is reachable by hover only, through a tooltip that is false ("Cannot be edited"). Touch, keyboard and screen-reader users never get the definition (WCAG 1.3.1, 1.4.13). F-18 makes it a visible linked label with text, never colour alone, which is A1's own wording.
- L-19s (for): A1 requires gains and losses to differ by sign and text. Today 0.0% is painted red and announced as "Gain" (`F-19` Why), which is wrong for a screen-reader user. Only the call-site sweep puts the Flat text and one sign on every surface; the first slice changed `lib/` only.
- C3-2 (against): For accessibility it's only one more text line. The open part is a P&L rule that amends `lib/trades.ts:52` and the committee's "when in doubt, exclude and count". If an owner-conditional rule ships before the decisions keeper's basis condition holds, a wrong figure can show under a Verified label, and assistive-tech users can't check it against context.
- C3-37 (against): It has no user-facing surface, and its only effect is a new per-account tracking date. The privacy committee (P3) and F-15's owner gate (MRC2-3) must decide it; it shouldn't ride in on enthusiasm for gates while F-15 is still building.
- C3-36 (against): It is weak only through my lens, not harmful. The pane and feed payloads (`app/u/[handle]/pane/route.ts:22`, `lib/feed.ts:197-198`) don't reach accessible names, so nothing changes for assistive tech. Its value is privacy (P3), so the privacy-minded members should weigh it, not this lens.

### Round 3a: Engineer

#### Round 3a, engineer (debate arguments; scores unchanged)

- C3-36 (for): Public JSON carries ms epochs and full-precision floats today: `app/u/[handle]/pane/route.ts:22` and `lib/feed.ts:197-198`. The fix rounds them only at the JSON/prop boundary, so `headline()` and F-10's pinned floats stay untouched. That makes it an S-sized privacy fix with no visible change.
- C3-34 (for): A new file with zero overlap with any in-flight branch, plus one line at `app/api/sync/route.ts:34-36`. It reads the `sync_shards` table that already exists (`db/schema.sql:409`). It is the cheapest way to notice a stalled sync before real users do.
- L-20 (for): Its one hard blocker, `lib/a11y-contrast.test.ts`, is already written in PR #55 (+129, with `app/globals.css` +86). After #55 merges, F-20 is a value-neutral token change in one file behind a test guard, and every later visual change (F-18) needs it first.
- L-19s (for): A mechanical sweep with its guard test already specified (the `F19_SWEEP_SITES` grep, `F-19:97`). It only opens as rework after F-18 merges, so re-approving costs no slot now and keeps the first slice's helpers (#57) from staying half-used.
- C3-3 (against): The proposed signal cannot work in code. In DK's probe the unreported split taints nothing, so every drawn lot is "recorded and untainted", and `lib/trades.ts:208-210` would publish -50% Verified when the truth is 0%. The matcher has no input that rules out an unseen inflow.
- C3-16 (against): It needs a new vendor read in protected `lib/broker.ts` (`listAccounts` `:86-91` reads no health field), so it is never auto-merged. The signal is unverified, it adds a request per account per sync to the shard budget, and it is blocked on F3-3.
- C3-37 (against): It edits `lib/auth/sessions.ts` (also edited by PR #56) and `lib/privacy-purge.ts:52` (also edited by F-15 and PR #62), and the privacy committee has not ruled on the field. It belongs inside F-15's rework, not as a separate vote.
- C3-43 (against): `consent_at` is stored per connection (`db/schema.sql:289`). With two connections, or a reconnect, "Public since" has no defined date. The rule is a design and owner (Q8, P6) decision that must exist before anyone can build or test it.
- L-16 (against starting now, keeping a conditional re-approval): F-9 and `lib/reports.ts` sit on the unmerged `claude/fix-user-text-safety` branch, which has no open PR. Building F-16 now would fork the reports table (`F-16:77` wants one). The re-approval should say F-16 starts only once that branch is merged with F-9's criteria met on main.
- L-17 (against starting now, keeping a conditional re-approval): The same branch already holds `lib/handles.ts` (+259 lines, `checkDisplayName`) and edits `lib/auth/attempts.ts`. An F-17 build before that branch merges would collide on both files and risk a second normaliser. F-17 should open as rework on top of it after the merge.

### Round 3a: Reliability engineer

#### Round 3a: reliability (arguments only, scores unchanged)

- C3-9a (for): Rows go missing silently today. The hourly read starts at the newest stored activity minus 7 days (`lib/sync.ts:379`), so a late-posted row with an older trade date is never read. A missed sell drops a close; a missed buy turns a later sell into an "oversold" exclusion. The fix is insert-only, so `on conflict do nothing` (`:37`) and immutability are untouched.
- C3-16 (for): A dead authorization leaves a record that looks live, the main silent failure of a pull-only product (`lib/broker.ts:86-91` reads no health). It can be built now without the unverified vendor signal: the sync already records the refusal streak (`users.sync_failure_kind = 'refused'`).
- C3-36 (for): Public cached JSON carries ms timestamps and full-precision returns the screens never show (`app/u/[handle]/pane/route.ts:22,26`; `lib/feed.ts:197-198`). Rounding at serialisation is S, changes no stored data, and a parity test keeps the headlines equal.
- C3-34 (for): A stalled or unauthorized cron is invisible today: the 401 path logs nothing (`app/api/sync/route.ts:34-36`). The data already exists (`sync_shards.heartbeat_at`/`last_run`, `db/schema.sql:409-418`), and there are no prerequisites. Fix the brief's 20-minute threshold, which an hourly cron would trip constantly.
- C3-35 (for): The hottest public URL is regenerated on every hit. A content-versioned URL is a correct cache by construction, provided the key covers every shown state (hide, delete, disconnect, handle).
- C3-3 (against): An oversell is proof the raw ledger is incomplete (missing buy, unreported split or transfer). Publishing the matched part shows a guess as Verified: the DK probe gives -50% where the truth is 0%. `lib/trades.ts:208-210` is the correct behaviour, and C3-9a fixes the real cause.
- C3-39/40 (against): No data-path or failure-mode value. It takes the `app/settings/page.tsx` slot that C3-15's Disconnect, the one settings change touching record integrity, will need.
- C3-43 (against): `consent_at` (`db/schema.sql:289`) is per connection. With several connections, a reconnect or a disconnect, "public since" has no defined value, and the count could shift between rebuilds. It is an undefined public field waiting on owner Q8.
- L-17 (against): Renames ripple into share URLs and cached images, and nothing in F-17 bumps or invalidates those keys. It also depends on the unmerged `claude/fix-user-text-safety`, so it can lapse again.
- L-20 (against): Tests and tokens only, with no integrity or observability gain. Its prerequisites (PR #55, fixes #12/#13/#26) are all unmerged, so a re-approval now likely lapses again next cycle.

### Round 3a: Legal and compliance

#### Round 3a: legal and compliance arguments

- C3-15 (for): Consent is given in the app (`lib/copy.ts:91`), but the only way to withdraw it is to delete the whole profile. POLICY.md:230-231 makes "consent mechanics" a pre-launch sign-off, and state sensitive-data rules expect withdrawal to be about as easy as consent (COMPLIANCE.md:75). Each user without it is one violation (`:191-194`), so it must exist before the first real connect.
- C3-9a (for): A Verified record that silently misses a broker close (`lib/sync.ts:378` reads 7 days only) is the company's own wrong statement. CDA §230 does not cover it (COMPLIANCE.md:111), and F4 requires the full history (POLICY.md:131-132). The fix only inserts rows, so the owner's immutability rule (`CLAUDE.md:62`) is untouched.
- C3-42 (for): COMPLIANCE.md:75 says export must be built "as a real feature before launch". Today the label "Download my data" (`lib/copy.ts:674`) promises more than the file holds (`:719`, `app/account/export/route.ts:5-6`). That is an FTC §5 mismatch and a per-consumer access-right exposure (COMPLIANCE.md:178).
- L-16 (for): POLICY requires a report action on every profile and a takedown process before launch (U2/U3, POLICY.md:145-149), and a takedown contact (`:58`). Only theses can be reported today. F-9 is now built on `claude/fix-user-text-safety`, so the prerequisite is in flight.
- L-17 (for): Reserved handles are a named U2 launch prerequisite (POLICY.md:146). Today a display name can say "Verified" or carry a check glyph, which implies the identity verification F3a forbids (`:117-119`). `checkDisplayName` already exists on the F-9 branch.
- L-18 (for): Three Verified wordings, a false "Cannot be edited" tooltip and demo pages that say "verified" are F3a and P2 problems (POLICY.md:46-47, :117-119; COMPLIANCE.md:153). One definition, pinned by tests, removes them for good.
- C3-3 (against): The decisions keeper's probe (buy 100 @100, an unreported 2:1 split, sell 101 @50) shows the proposal would publish -50% as Verified when the truth is 0%. That is a wrong return carrying "Verified", which F3c forbids (POLICY.md:128-130). An oversell is the evidence that an unseen inflow happened (committee log `:24`).
- C3-16 (against): There are no real connections and the vendor signal is unverified, so it protects no one yet. Its only new legal surface, the account email, needs the owner's reading of the F3b exception list (POLICY.md:125-127, Q5) first.
- C3-39/40 (against): Lowering "Delete my profile" to a secondary control works against P6's easy-deletion rule (POLICY.md:56-57) and the symmetric-choice standard (COMPLIANCE.md:95). It also reverses the F-1 plan's decided primary Delete (`logs/F-1/plan.md:75-77`). The legal benefit is nil and the dark-pattern risk is real.
- C3-43 (against): `consent_at` (`db/schema.sql:289`) is not on the owner's consent list (`lib/copy.ts:79`, `lib/privacy-fields.ts:6-14`). P6 (POLICY.md:55-56) bars publishing it until the owner rewrites that line (Q8). It adds a public data point with no legal or trust gain.

### Round 3a: Trust and safety

#### Round 3a: trust and safety, debate arguments (scores unchanged)

- C3-2 (for): Today a trader can hide a loss with no data gap and no cost: move the losing position to another account and the loss is gone with no trade, no count and no line (`lib/corporate-actions.ts:200`, `lib/trades.ts:171`). With DK's basis condition, this is the one exploit on the ballot that any trader can trigger at will.
- C3-3 (for): In a margin account, one extra share turns a recorded -50% into an exclusion that blames missing history (`lib/trades.ts:208-210`, `lib/copy.ts:69`). Leaving a cheap loss-hiding route open is a worse trust failure than a scoped, owner-approved fix that names the signal ruling out an unseen inflow.
- C3-17 (for): Counting is the backstop for every exclusion route, including the ones nobody has found yet and #52's silent `notShared` (`lib/sync.ts:99`, also missing at `:121-127`). Today the count shows only on the profile (`app/u/[handle]/page.tsx:289-292`), not where records are actually read.
- C3-9a (for): A sell posted more than 7 days late is never read (`lib/sync.ts:378`), so a loss can silently never appear on a Verified record. Insert-only reconciliation closes this without touching the owner's immutability rule.
- C3-43 (for): "Public since" is the one record fact a trader can't pick with hindsight. It exposes a profile built from curated pre-consent closes, which is the long-record-yesterday pattern scam profiles use. Owner Q8 first.
- L-16 (for): The chair's correction removes the main objection: F-9 and `lib/reports.ts` are built on `claude/fix-user-text-safety` (53b74e3). Linkable Verified records with no profile report, no hide and no takedown page break U2/U3 before launch. A re-approval can start as soon as that branch merges, so it is not one that will just lapse again.
- L-17 (for): Today a rename frees the old handle at once, so an impersonator can take over every forwarded link and card. `checkDisplayName` already exists on the F-9 branch (`lib/handles.ts`), so the one-normaliser rule is buildable now.
- L-18 (for): If "Verified" means different things on different surfaces, or demo data reads as verified, scam screenshots get their raw material. One trust language is how the Verified claim stays defensible.
- C3-39/40 (against): Mostly UX polish. Its only T&S effect is a risk: it lowers the weight of "Delete my profile", a safety tool for a harassed trader. If built, legal's veto condition must hold (visible on /settings at 360 px, no disclosure).
- C3-42 (against): While auth is a dev stub (`lib/session.ts`), a full export gives an account takeover everything about a person in one file. Build it after real sign-in, with re-authentication and a rate limit, and with the owner's Q7 scope.
- C3-38 (against): No T&S value. It edits the purge while PR #62 is also editing it, and it collects funnel data for sign-ups the closed gate can't produce.

### Round 3a: Decisions keeper

#### Round 3a, decisions keeper

- C3-34 (for): It is the only operational item that touches no decided rule. It sits inside "one app, no separate backend" (`CLAUDE.md:59`) and standing direction 3 (`docs/DECISIONS.md:30`), and approving it decides nothing that belongs to the owner.
- C3-35 (for): Caching changes no card contents, so F-4's owner-decided card and F-11's absolute-date rule (`F-11:23-24`) are untouched. Its only open point is that the brief's "K6 condition 2" citation does not resolve, and the chair can correct that.
- C3-2 (against): It amends a delegated ruling on a decided point (`lib/trades.ts:52`; `logs/corporate-actions/committee-2026-11-01.md:44-45`, `:57-58`). Under `docs/IMPLEMENTATION.md:75`, a disagreement with a decided point waits for the owner. As drafted, a partial move out "oldest first" guesses which lots remain, which breaks "never guessed" (`CLAUDE.md:95`).
- C3-3 (against): It reverses the reason for the rule, not just its scope. The ruling exists because an oversell proves an unseen inflow (`committee:24`, `:115-119`). Fictional probe: an unreported 2:1 split followed by sell 101 @ 50 would publish −50% under Verified when the true result is 0% (F3c, `docs/POLICY.md:128-130`).
- C3-39/40 (against): The brief says S9 never decided view 1's weight, but the signed F-1 plan does: "primary 'Delete my profile', secondary 'Keep it'" (`logs/F-1/plan.md:75-77`). C3-39 also amends F-3 `plan.md:142`. A vote that doesn't name both amended lines would quietly overwrite decided plans.
- C3-42 (against): It redefines F-3 committee condition 11, under which the file "holds exactly" views, notes and subscription (`logs/F-3/committee-2026-11-01.md:50-53`). It also decides owner Q7 (`cycle3:695-696`) and depends on BC-10. The council can't approve the scope; at most it can approve a separate route once the owner says yes.
- C3-43 (against): It adds a new public field, which is exactly owner Q8 (`cycle3:697-698`). P6 says consent must list exactly what becomes public (`docs/POLICY.md:54-56`). Approving it now would pre-empt the owner and every trader's consent line.

### Round 3a: Common sense

#### Round 3a, common sense (debate arguments)

- C3-42 (against): The owner sets the scope (Q7, BC-10), and the label today is the F-3 committee's own wording, with an exact help line beside it (`lib/copy.ts:674`, `:719`). Nobody is misled now. If we build an M-sized export before the owner sets its scope, we risk building it twice, and with 0 users there is no one to request it.
- C3-35 (against): This optimises cost for traffic that doesn't exist yet. Its only failure mode is a long-cached image that shows old figures under "Verified". At 0 users that is a dishonesty risk with no saving to offset it, and it is blocked on F3-26 anyway.
- C3-38 (against): While the gate is closed there are no real sign-ups to count. It also adds a retained dataset next to D11's purge (`lib/privacy-purge.ts:180`), in the same code PR #62 is editing. It only has to exist before the gate opens, not this cycle.
- L-16 (against): The chair's correction stands: F-9 is built. But it sits on an unmerged branch with no PR (`claude/fix-user-text-safety`). Profile reports protect real records, and there are none yet. Re-approving now repeats the cycle-2 bet that lapsed. Re-approve when F-9's PR is open, with every condition kept word for word.
- L-18 (against): The fixes list already removes its false parts (fixes #1, #2, #8, #10). What is left waits on F-20, F-11, F-13 and three unmerged fixes. A re-approval would sit idle all cycle, and that holds no matter how much the remaining unification is worth.
- L-19s (against): It is tidy-up that depends on L-18. The first slice already gave `lib/format.ts` one implementation (#57). No viewer is misled by the remaining call sites that it can't wait a cycle to fix.

### Round 3a: Red team

#### Round 3a, red team

- C3-34 (for): A stalled or failing sync is invisible today. `/api/sync` returns 401 with no log line (`app/api/sync/route.ts:34-36`) and `instrumentation.ts:7-10` has no health check, so a record can go stale while still reading as live, and nobody notices. That is the cheapest guard against it. Approve it only as ok/degraded in public, with times and hours behind the cron bearer, and a rate-limited 401 line with no token or IP, so the guard is not itself a leak or a log-flood route.
- C3-2 (red team): Top-two mean, but "oldest first" on a move out is a basis the trader chooses: they pick at the broker which lots move, and we assume they were the oldest. That re-prices the lots left behind on a Verified record. The DK veto (oldest first only where it cannot change a basis; otherwise the remaining lots stay tainted and are counted) is what makes this item safe. Don't let it soften into a nice-to-have in the acceptance criteria.

## 5. Round 3b: score changes

### Instructions

#### Round 3b: score changes after the debate

Read every debate file `r3a-*.md` in the council folder (15 members). If a member's file is missing, their argument
lines are in the chair's note `r3a-relayed.md`. Then give your scores after the debate for all 19 items. Change a
score only for a stated reason (name the argument that moved you); otherwise keep your round-1 score.

Write `r3b-<slug>.md` (table: Item | R1 | R3 | reason for change). Reply EXACTLY:
SCORES: C3-2=n, C3-3=n, C3-17=n, C3-15=n, C3-9a=n, C3-16=n, C3-37=n, C3-36=n, C3-34=n, C3-39/40=n, C3-42=n, C3-35=n, C3-43=n, C3-38=n, L-16=n, L-17=n, L-20=n, L-18=n, L-19s=n
then one line per CHANGED item "ID: R1 -> R3 because ...", nothing else.

### Tally (chair)

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

### Round 3b: Business lead

#### Round 3b, business lead

| Item | R1 | R3 | Reason for change |
|---|---|---|---|
| C3-2 | 4 | 4 | unchanged |
| C3-3 | 2 | 2 | unchanged. The engineer's point (the matcher has no input that rules out an unseen inflow, so the DK probe publishes -50% Verified) confirms it. Take the `lib/copy.ts:69` cause-line fix in the fixes lane instead |
| C3-17 | 4 | 4 | unchanged (conditions: real link, one sum function shared with the profile, after the ledger slot) |
| C3-15 | 3 | 3 | unchanged |
| C3-9a | 3 | 3 | unchanged |
| C3-16 | 2 | 2 | unchanged |
| C3-37 | 5 | 5 | unchanged. The objections (no screen, privacy ruling) are handled by folding it into F-15 under LG's one-date conditions |
| C3-36 | 3 | 3 | unchanged |
| C3-34 | 3 | 3 | unchanged |
| C3-39/40 | 4 | 4 | unchanged |
| C3-42 | 2 | 2 | unchanged |
| C3-35 | 2 | 2 | unchanged |
| C3-43 | 3 | 2 | Engineer and reliability: `consent_at` is stored per connection (`db/schema.sql:289`), so with several connections, a reconnect or a disconnect, "Public since" has no defined value and cannot be built or tested yet. It still has value, but it needs a design and an owner (Q8) rule first. |
| C3-38 | 4 | 4 | unchanged (the PR #62 sequencing is already a condition) |
| L-16 | 3 | 4 | Chair's correction plus the legal and trust-safety arguments: F-9 and `lib/reports.ts` are built (53b74e3), so the block is a merge, not a start. Report, hide and takedown are U2/U3 launch prerequisites (`docs/POLICY.md:145-149`). Re-approve with every condition word for word and a lapse clause on that branch merging. |
| L-17 | 3 | 4 | Same correction. `checkDisplayName` already exists on the F-9 branch (`lib/handles.ts`), so one normaliser can be built now. The trust-safety point that a rename frees the old handle at once, letting an impersonator take over forwarded links, hits the share loop (G2/G3) directly. Condition: F-17 builds on top of that branch after it merges. |
| L-20 | 3 | 3 | unchanged |
| L-18 | 2 | 2 | unchanged |
| L-19s | 2 | 2 | unchanged |

### Round 3b: Market research lead

#### Round 3b, market research lead: scores after the debate

| Item | R1 | R3 | Reason for change |
|---|---|---|---|
| C3-2 | 4 | 4 | Kept. Red team's point (the trader picks at the broker which lots move) confirms DK's basis condition, which I already attached. |
| C3-3 | 2 | 1 | Engineer (r3a): in DK's probe the unreported split taints nothing, so "every drawn lot recorded and untainted" holds, and the matcher has no input that rules out an unseen inflow. My one condition for publishing (a reconciliation signal) doesn't exist in the code. Reliability: C3-9a fixes the real cause. What's left is the copy fix at `lib/copy.ts:69`, which belongs on the fixes list. |
| C3-17 | 4 | 4 | Kept. UX lead's condition (a real link, not bare "(see profile)") added to mine. |
| C3-15 | 3 | 3 | Kept. |
| C3-9a | 4 | 4 | Kept. Product designer's F-14 sequencing point becomes a condition: build it after F-14 merges, in the same lane. |
| C3-16 | 3 | 3 | Kept. Reliability shows a version without the unverified signal (the refusal streak), but it is still blocked on F3-3, with 0 connections. |
| C3-37 | 5 | 5 | Kept. It folds into F-15's rework, with the privacy committee's ruling first. |
| C3-36 | 4 | 4 | Kept. The same-day order test (UX lead) was already a condition. |
| C3-34 | 3 | 3 | Kept. Add reliability's fix: the degraded threshold follows the schedule, not 20 minutes. |
| C3-39/40 | 4 | 3 | Legal (r3a): demoting "Delete my profile" works against P6's easy-deletion rule and the symmetric-choice standard, and it reverses the decided F-1 plan (`logs/F-1/plan.md:75-77`). The C3-39 part (the dead-end primary button) keeps its market value. The C3-40 weight change I now doubt. |
| C3-42 | 3 | 3 | Kept. Trust and safety's point (no full export while auth is a dev stub) matches legal's real-auth veto condition. |
| C3-35 | 2 | 2 | Kept. |
| C3-43 | 4 | 3 | Engineer and reliability (r3a): `consent_at` is per connection (`db/schema.sql:289`), so with several connections, a reconnect or a disconnect, "public since" has no defined value. The trust value stands, but the field must be defined (and owner Q8 answered) before it can be built. |
| C3-38 | 3 | 3 | Kept. |
| L-16 | 4 | 4 | Kept. The chair's correction (F-9 built on `claude/fix-user-text-safety`) supports it. Condition: starts only after that branch merges (engineer). |
| L-17 | 4 | 4 | Kept. Conditions: after the F-9 branch merges, `checkDisplayName` is the one normaliser, and a rename bumps share/image keys (reliability). |
| L-20 | 3 | 3 | Kept. |
| L-18 | 4 | 4 | Kept. |
| L-19s | 3 | 3 | Kept. |

### Round 3b: Pricing and finance

#### Round 3b: pricing-finance, scores after the debate

| Item | R1 | R3 | Reason for change |
|---|---|---|---|
| C3-2 | 3 | 4 | Trust-safety and red team (r3a): a full transfer out lets any trader hide a loss at will, with no data gap and no count (`lib/corporate-actions.ts:200`, `lib/trades.ts:171`). That is a direct threat to what the record (and any paid tool on it) is worth. Still only on the owner's yes, with DK's basis veto condition kept word for word. |
| C3-3 | 2 | 1 | Engineer (r3a): the proposed signal can't be implemented. In DK's probe the unreported split taints nothing, so every drawn lot reads "recorded and untainted", and `lib/trades.ts:208-210` would publish -50% Verified where the truth is 0%. The matcher has no input that rules out an unseen inflow, and a wrong Verified loss is the costliest error class. Only the copy-cause fix (`lib/copy.ts:69`) is worth taking, as a fixes item. |
| C3-17 | 4 | 4 | unchanged. Added the UX lead's condition: the line links to the profile and uses the same sum function. |
| C3-15 | 3 | 3 | unchanged |
| C3-9a | 3 | 3 | unchanged. Added the product designer's condition: build after or with F-14, so `lib/sync.ts:378` is edited once. |
| C3-16 | 3 | 3 | unchanged. Reliability's refusal-streak route (no unverified vendor field) is my preferred condition; the engineer's point that `lib/broker.ts` is protected and adds requests per sync offsets it. |
| C3-37 | 4 | 4 | unchanged. Built inside F-15's rework (engineer), not separately. |
| C3-36 | 3 | 3 | unchanged. Added the UX lead's condition: day-rounding must not reorder same-day closes (test). |
| C3-34 | 4 | 4 | unchanged. Added reliability's condition: a degraded threshold that suits an hourly cron, not 20 minutes. Also red team's: public body is ok/degraded only, and the 401 log line is rate-limited with no token or IP. |
| C3-39/40 | 4 | 3 | Legal and trust-safety (r3a): making "Delete my profile" secondary works against P6 easy deletion and the symmetric-choice standard (`docs/COMPLIANCE.md:95`), and it reverses `logs/F-1/plan.md:75-77`. That risk outweighs a $0-revenue polish gain. The C3-39 part (no primary button to locked /tools) still merits a 4 alone. Condition: Delete stays visible on /settings at 360 px with no extra disclosure step. |
| C3-42 | 3 | 3 | unchanged. Added trust-safety's condition: build only after real sign-in replaces the dev stub, with re-authentication and a rate limit. |
| C3-35 | 2 | 2 | unchanged |
| C3-43 | 2 | 2 | unchanged (engineer and reliability: `consent_at` is per connection, so the date is undefined; this reinforces the 2) |
| C3-38 | 3 | 3 | unchanged |
| L-16 | 4 | 4 | unchanged. Condition (engineer): starts only once `claude/fix-user-text-safety` merges with F-9's criteria met on main; one reports table. |
| L-17 | 4 | 4 | unchanged. Condition (UX, engineer): opens as rework on top of the F-9 branch after it merges, with `checkDisplayName` confirmed as the one normaliser. |
| L-20 | 3 | 3 | unchanged |
| L-18 | 2 | 2 | unchanged |
| L-19s | 2 | 2 | unchanged |

### Round 3b: Growth

#### Round 3b, growth (scores after the debate)

| Item | R1 | R3 | Reason for change |
|---|---|---|---|
| C3-2 | 4 | 4 | Kept. DK's "never guessed" point is already my condition (oldest first only where it cannot change a basis), and the item is owner-conditional anyway. |
| C3-3 | 3 | 2 | Engineer: my condition can't be implemented. In the DK probe the unreported split taints nothing, so every drawn lot is "recorded and untainted" and `lib/trades.ts:208-210` would publish -50% Verified. The matcher has no input that rules out an unseen inflow. A fake loss on a shared record is worse for anchors than an honest exclusion. |
| C3-17 | 3 | 3 | Kept, with trust-safety's condition: the line is a real link to the reasons, and it is sequenced after the ledger slot. |
| C3-15 | 3 | 3 | Kept. Legal's point (consent withdrawal must be as easy as consent, before the first real connect) raises its importance, but it is still blocked on F3-3, F-11 and Q2. |
| C3-9a | 3 | 4 | Reliability and engineer: a missed late row silently drops a close, or turns a later sell into an "oversold" exclusion (`lib/sync.ts:378-379`). That is the real cause behind C3-3's case. It is insert-only, and it protects the credibility of the very first shared records. |
| C3-16 | 3 | 2 | Reliability and engineer: the signal is unread in `lib/broker.ts:86-91` and unverified. A guessed signal risks a false "Reconnect" line, it needs a protected-file vendor read, and it adds a request per account to the shard budget. Not worth a slot before the vendor answers. |
| C3-37 | 5 | 5 | Kept. The objections ask that it ride inside F-15's rework with the privacy committee's ruling, and that is my condition already. |
| C3-36 | 3 | 3 | Kept. |
| C3-34 | 3 | 3 | Kept, with red-team's conditions (ok/degraded in public, details behind the bearer, rate-limited 401 line) and reliability's threshold fix. |
| C3-39/40 | 4 | 4 | Kept, with legal's veto condition (Delete visible on /settings at 360 px, no disclosure, P6 easy deletion) and DK's condition: the decision names both amended lines (`logs/F-1/plan.md:75-77`, F-3 `plan.md:142`). |
| C3-42 | 3 | 2 | Trust-safety: while auth is a dev stub (`lib/session.ts`), a full export hands an account takeover everything in one file. It also redefines F-3 committee condition 11 and pre-empts owner Q7 (DK). Do it after real sign-in and the owner's scope. |
| C3-35 | 2 | 2 | Kept. |
| C3-43 | 3 | 2 | Engineer and reliability: `consent_at` is per connection (`db/schema.sql:289`), so with two connections or a reconnect "Public since" has no defined date. An undefined public field can't be built or tested yet, and it also waits for Q8 and P6. |
| C3-38 | 4 | 3 | Several members: it only has to exist before the gate opens, not this cycle. While the gate is closed it counts zeros, and it conflicts with PR #62's purge edit (`lib/privacy-purge.ts:180`). |
| L-16 | 4 | 4 | Kept, with a lapse clause tied to F-9's merge (`claude/fix-user-text-safety`) and no slot counted until it starts. It is still a named week-0 prerequisite. |
| L-17 | 4 | 4 | Kept, with a lapse clause tied to F-9's merge. Before the build, the branch's `checkDisplayName` is confirmed as the one normaliser. |
| L-20 | 3 | 3 | Kept. |
| L-18 | 3 | 3 | Kept. |
| L-19s | 2 | 2 | Kept. |

### Round 3b: UX lead

#### Round 3b, UX lead: scores after the debate

| Item | R1 | R3 | Reason for change |
|---|---|---|---|
| C3-2 | 4 | 4 | Kept. Red team's and DK's basis condition is already part of my conditions. |
| C3-3 | 3 | 2 | Engineer (r3a): in DK's probe the unreported split taints nothing, so every drawn lot looks "recorded and untainted". The matcher has no input that rules out an unseen inflow. My own round-1 condition ("if the probe case can't be told apart, ship only the copy fix") therefore applies, and the feature as written shouldn't ship. The false copy at `lib/copy.ts:69` still needs fixing through F3-15. |
| C3-17 | 4 | 4 | Kept. The condition stands: the line is a real link to the profile's counts, with one shared sum. |
| C3-15 | 3 | 3 | Kept. Legal and a11y strengthen the case before launch, but the three blockers are unchanged. |
| C3-9a | 3 | 3 | Kept. Product designer's F-14 overlap (`lib/sync.ts:378`) argues for sequencing, which my "ride in the ledger slot" condition covers. |
| C3-16 | 3 | 3 | Kept. Reliability notes it could be built on the existing refusal streak instead of the unverified signal, a good condition, but there are still 0 connections. |
| C3-37 | 3 | 3 | Kept. |
| C3-36 | 3 | 3 | Kept. Condition: the same-day scrub order is stable. |
| C3-34 | 3 | 3 | Kept. Condition: reliability's point that the 20-minute threshold must fit an hourly cron. |
| C3-39/40 | 5 | 4 | DK and legal (r3a): view 1's weight was decided in the signed F-1 plan (`logs/F-1/plan.md:75-77`), and P6 or symmetric-choice wants deletion easy to find. C3-39's dead-end fix still stands at full strength. C3-40 must be approved as an explicit amendment of F-1 `plan.md:75-77` and F-3 `plan.md:142`. Added condition: Delete stays visible on /settings at 360 px without scrolling past a disclosure, as a labelled control rather than a link in body text. |
| C3-42 | 3 | 2 | Common sense and trust-safety (r3a). The help line already sits directly under the button (`p2-360-account.png`), so nobody is misled today, which removes my UX reason. A full export under the dev-stub auth hands an account takeover everything about a person in one file. Build it after real sign-in and owner Q7. |
| C3-35 | 2 | 2 | Kept. |
| C3-43 | 3 | 2 | Engineer and reliability (r3a): `consent_at` is stored per connection (`db/schema.sql:289`). With two connections, or a reconnect, "Public since" has no defined date, so it can't be built or tested until a design session and owner Q8 define it. |
| C3-38 | 2 | 2 | Kept. |
| L-16 | 3 | 4 | Chair's correction (F-9 is built on `claude/fix-user-text-safety`, with `lib/reports.ts`), plus legal and trust-safety: a report action on profiles and a takedown page are U2/U3 launch prerequisites (`docs/POLICY.md:145-149`). The prerequisite is in flight, not unstarted. Condition (from engineer): it starts only once that branch is merged with F-9's criteria met on main, and lapses otherwise. |
| L-17 | 3 | 4 | Same correction, plus legal: reserved handles are a U2 prerequisite, and a display name can show "Verified" today. `checkDisplayName` exists, so the one-normaliser rule is buildable. Conditions: it opens as rework on top of the merged branch with that helper as the single normaliser; it lapses if the branch doesn't merge. Reliability's note on share URL and image keys after a rename is added as a criterion. |
| L-20 | 4 | 4 | Kept. |
| L-18 | 3 | 3 | Kept. A11y's hover-only point confirms the value, but six prerequisites are still unmerged. |
| L-19s | 2 | 2 | Kept. |

### Round 3b: Product designer

#### Round 3b: product designer

| Item | R1 | R3 | Reason for change |
|---|---|---|---|
| C3-2 | 4 | 4 | Kept. Red team reinforces DK's basis condition, which I already attach. |
| C3-3 | 2 | 1 | Engineer: in DK's probe every drawn lot is "recorded and untainted", and the matcher has no input that rules out an unseen inflow (`lib/trades.ts:208-210`). So the proposal as drafted cannot be built safely. The part worth taking, the false cause in `lib/copy.ts:69`, is a copy fix, not this item. |
| C3-17 | 4 | 4 | Kept. UX lead's "real link, same sum function" is already my condition; I accept market research's ordering (after the ledger slot) as a sequencing note. |
| C3-15 | 3 | 3 | Kept. |
| C3-9a | 3 | 3 | Kept. Dataviz and legal: a silent TR-1 hole. My objection was slot and sequencing (after F-14), not merit. |
| C3-16 | 2 | 2 | Kept. Reliability's refusal-streak route is a different item from the brief, which reads the vendor signal. |
| C3-37 | 3 | 3 | Kept (as an F-15 amendment only). |
| C3-36 | 4 | 4 | Kept. I add UX lead's condition: day-rounded dates must not reorder same-day closes or send a chart scrub to the wrong trade (stable order by id, tested). |
| C3-34 | 3 | 3 | Kept. I add red team's and reliability's conditions: public ok/degraded only, a rate-limited 401 line, and a threshold that fits an hourly cron. |
| C3-39/40 | 5 | 4 | Legal and trust and safety: lowering Delete's weight meets P6's easy-deletion rule (`POLICY.md:56-57`) and the symmetric-choice standard, and it amends a signed plan (`logs/F-1/plan.md:75-77`). The hierarchy fix still stands, but only with Delete visible on /settings at 360 px with no disclosure, one tap to view 2, and view 2 unchanged. That is "strong with conditions", not "must do now". |
| C3-42 | 3 | 2 | Trust and safety: while auth is a dev stub (`lib/session.ts`), a full export hands an account takeover everything about a person in one file. Premature until real sign-in with re-authentication, and Q7 is the owner's. |
| C3-35 | 3 | 2 | Pricing-finance and common sense: today's uncached image is always fresh, so my "card and profile agree" argument holds only once images are cached. The saving is inside included usage at beta volume. Reliability's point that the key must cover hide, delete, disconnect and handle shows the stale-card risk is real. |
| C3-43 | 3 | 2 | Engineer and reliability: `consent_at` is per connection (`db/schema.sql:289`), so with two connections or a reconnect "Public since" has no defined date. The design rule doesn't exist yet, beyond Q8. |
| C3-38 | 2 | 2 | Kept. |
| L-16 | 4 | 4 | Kept. The chair's correction (F-9 built on `claude/fix-user-text-safety`) supports it; condition: starts only once that branch merges. |
| L-17 | 4 | 4 | Kept. Condition from engineer and UX lead: opens on top of the F-9 branch, with `checkDisplayName` confirmed as the one normaliser. |
| L-20 | 5 | 5 | Kept. The lapse arguments are answered by a lapse clause, and an approval kept with one costs nothing. |
| L-18 | 4 | 4 | Kept, for the same reason, after L-20. |
| L-19s | 4 | 4 | Kept, for the same reason, after L-18. |

### Round 3b: Data-visualization designer

#### Round 3b, dataviz (scores after the debate)

| Item | R1 | R3 | Reason for change |
|---|---|---|---|
| C3-2 | 4 | 4 | Kept. Red team's point (the trader picks which lots move) is exactly the DK basis condition I attached. |
| C3-3 | 2 | 2 | Kept. Engineer confirmed the matcher has no input that can rule out an unseen inflow, which strengthens the case against publishing. The copy fix (market research, UX lead) belongs to F3-15. |
| C3-17 | 5 | 5 | Kept. UX lead's "real link" and market research's "after the ledger slot" are sequencing and conditions I already attached, not reasons against. |
| C3-15 | 3 | 3 | Kept. |
| C3-9a | 4 | 4 | Kept. Product designer's F-14 overlap at `lib/sync.ts:378` becomes a sequencing condition (build inside F-14's read limit, after F-14), not a lower score. |
| C3-16 | 2 | 2 | Kept. |
| C3-37 | 3 | 3 | Kept. |
| C3-36 | 4 | 4 | Kept. UX lead's same-day reorder risk is already my condition (sort key applied before rounding, tested). |
| C3-34 | 3 | 3 | Kept. |
| C3-39/40 | 3 | 3 | Kept. |
| C3-42 | 3 | 3 | Kept. |
| C3-35 | 2 | 2 | Kept. The images are not cached today, so no stale figure is served now. Versioning adds the stale-figure risk it then has to guard against. |
| C3-43 | 3 | 3 | Kept. Engineer and reliability showed `consent_at` is per connection, so the date is undefined with several connections or a reconnect. That adds to the owner's Q8 work, but the item is already owner-conditional. |
| C3-38 | 2 | 2 | Kept. |
| L-16 | 3 | 3 | Kept. The chair's F-9 correction removes "unstarted", but F-9 is still unmerged with no PR. Approve conditional on that merge. |
| L-17 | 3 | 3 | Kept. Reliability's point (a rename must bump share-image and URL cache keys) is added as a condition. |
| L-20 | 4 | 4 | Kept. |
| L-18 | 3 | 3 | Kept. |
| L-19s | 4 | 4 | Kept. |

### Round 3b: Accessibility specialist

#### Round 3b: a11y scores after the debate

| Item | R1 | R3 | Reason for change |
|---|---|---|---|
| C3-2 | 3 | 4 | Moved by red team, business lead and UX lead: a full transfer out erases a real loss and leaves no line any reader, sighted or using assistive tech, could notice (`lib/corporate-actions.ts:200`, `lib/trades.ts:171`). My worry (a wrong Verified figure) is covered by DK's basis condition, which I attach. Still owner-conditional. |
| C3-3 | 2 | 2 | unchanged; DK, engineer and reliability confirm the matcher cannot rule out an unseen inflow. |
| C3-17 | 4 | 4 | unchanged; the UX lead's "(see profile) must be a real link" is already my condition. |
| C3-15 | 4 | 4 | unchanged; the blockers are prerequisites, and legal's consent-withdrawal argument reinforces it. |
| C3-9a | 3 | 3 | unchanged |
| C3-16 | 3 | 3 | unchanged |
| C3-37 | 3 | 3 | unchanged |
| C3-36 | 3 | 3 | unchanged |
| C3-34 | 3 | 3 | unchanged |
| C3-39/40 | 4 | 3 | Moved by legal (P6 easy deletion `docs/POLICY.md:56-57`, symmetric choice `docs/COMPLIANCE.md:95`), DK (the F-1 plan decided primary Delete, `logs/F-1/plan.md:75-77`) and trust and safety (Delete is a safety tool). Demoting a findable destructive control can hurt users who need it, so only the C3-39 dead-end fix is clearly positive. Keep legal's veto conditions and name both amended lines. |
| C3-42 | 3 | 3 | unchanged |
| C3-35 | 3 | 3 | unchanged; stale-image risk (common sense, growth) is answered by reliability's condition that the key covers every shown state. |
| C3-43 | 3 | 3 | unchanged |
| C3-38 | 3 | 3 | unchanged |
| L-16 | 4 | 4 | unchanged; the chair's correction (F-9 built on `claude/fix-user-text-safety`) supports it. |
| L-17 | 4 | 4 | unchanged; same correction. |
| L-20 | 5 | 5 | unchanged; "it may lapse" arguments are about timing, not value, and its blocker PR #55 is already written. |
| L-18 | 4 | 4 | unchanged |
| L-19s | 4 | 4 | unchanged |

### Round 3b: Engineer

#### Round 3b, engineer (scores after the debate)

| Item | R1 | R3 | Reason for change |
|---|---|---|---|
| C3-2 | 4 | 4 | Kept. The red-team point (the trader picks which lots move) is what DK's basis condition already covers, and I attached it. |
| C3-3 | 1 | 1 | Kept. No FOR argument named a signal that rules out an unseen inflow. |
| C3-17 | 4 | 4 | Kept. Adding UX's real link plus one shared sum function as a condition. |
| C3-15 | 3 | 3 | Kept. |
| C3-9a | 3 | 3 | Kept. It goes into F-14's lane after that branch merges. |
| C3-16 | 2 | 3 | Reliability's argument moved me, and I verified it. The refusal streak already exists: `users.sync_failure_kind = 'refused'` and `sync_failing_since` (`db/schema.sql:421`, `lib/sync-shard.ts:409-411`). So the trader-only Reconnect line can be built with no protected `lib/broker.ts` edit, no new vendor request and no unverified signal. New condition: the first slice uses only the stored refusal streak. The vendor health read waits for the vendor docs and the owner's merge. It is still blocked on F3-3. |
| C3-37 | 3 | 3 | Kept. It goes inside F-15's rework after the privacy committee rules on the field. |
| C3-36 | 4 | 4 | Kept. The UX same-day reorder risk is already a condition (sort before rounding, test the scrub target). |
| C3-34 | 4 | 4 | Kept. Adding red-team's and reliability's conditions: public body ok/degraded only, with detail behind the cron bearer. The threshold derives from the cadence, not the brief's 20 minutes. The 401 line is rate-limited. |
| C3-39/40 | 4 | 4 | Kept. Legal's and trust-safety's point is a condition, not a cost: Delete stays visible on /settings at 360 px with no disclosure, and the F-1 and F-3 lines are named as amended. |
| C3-42 | 3 | 3 | Kept. Adding trust-safety's condition: build only after real sign-in replaces `lib/session.ts`, with re-authentication and a rate limit. |
| C3-35 | 2 | 2 | Kept. Reliability's "correct by construction" covers new states, not the old URL. An immutable entry still serves after delete or hide. |
| C3-43 | 2 | 2 | Kept. |
| C3-38 | 3 | 3 | Kept. |
| L-16 | 3 | 4 | Moved by the chair's correction and by trust-safety, legal and growth. I checked `claude/fix-user-text-safety:lib/reports.ts`: F-9's reports module is built and keyed for reuse. My R1 objection (forking the reports table) goes away if F-16 extends that module after the branch merges. Condition: the start condition stays "F-9 merged with its criteria met on main", and F-16 extends F-9's reports module, never a second table. |
| L-17 | 3 | 3 | Kept. Reliability raised a new point: a rename ripples into share URLs and cached images, and nothing in F-17 handles it. New condition: the rename hold covers old-handle image and URL caches (no cached card under a freed handle), and F-17 builds on that branch's `checkDisplayName`. |
| L-20 | 4 | 4 | Kept. |
| L-18 | 3 | 3 | Kept. |
| L-19s | 3 | 3 | Kept. |

### Round 3b: Reliability engineer

#### Round 3b: reliability

| Item | R1 | R3 | Reason for change |
|---|---|---|---|
| C3-2 | 4 | 4 | Kept. Red team and DK restate my condition (oldest-first only where no basis can change); still a condition, not a reason to drop. |
| C3-3 | 1 | 1 | Kept. Engineer confirms the "untainted" signal cannot rule out an unseen inflow (DK probe). I support the copy-only fix at `lib/copy.ts:69` that several FOR speakers ask for, as a fix, not this item. |
| C3-17 | 4 | 4 | Kept. I add ux-lead's condition: "(see profile)" is a real link. |
| C3-15 | 3 | 3 | Kept. |
| C3-9a | 4 | 4 | Kept. I add product-designer's point as a condition: build it after F-14 merges (one edit to `lib/sync.ts:378`, inside F-14's read limit). |
| C3-16 | 4 | 4 | Kept. Engineer's objection (protected `lib/broker.ts`, an extra request) does not apply to my condition, which derives the flag from the existing refusal streak with no new vendor read. |
| C3-37 | 3 | 3 | Kept. |
| C3-36 | 4 | 4 | Kept. |
| C3-34 | 5 | 5 | Kept. I adopt red team's condition: public body is ok/degraded only; ages and shard detail behind the cron bearer; the 401 line is rate-limited with no token or IP. |
| C3-39/40 | 3 | 3 | Kept. |
| C3-42 | 3 | 3 | Kept. |
| C3-35 | 3 | 2 | Moved by common sense and pricing-finance: at beta volume the saving is negligible, and the only failure mode (a long-cached stale image under "Verified") is the staleness risk I raised myself. Premature until share traffic exists. |
| C3-43 | 2 | 2 | Kept. |
| C3-38 | 3 | 3 | Kept. |
| L-16 | 4 | 4 | Kept (F-9 is in flight per the chair's correction). |
| L-17 | 3 | 3 | Kept. Engineer's sequencing (rework on top of the F-9 branch after it merges, one normaliser) as a condition. |
| L-20 | 3 | 3 | Kept. |
| L-18 | 3 | 3 | Kept. |
| L-19s | 3 | 3 | Kept. |

### Round 3b: Legal and compliance

#### Round 3b: legal and compliance, scores after the debate

I read every r3a file. No argument changed a legal finding, so all scores are unchanged. Three arguments add
conditions, listed below the table.

| Item | R1 | R3 | Reason for change |
|---|---|---|---|
| C3-2 | 4 | 4 | Unchanged. The red team's point (the trader picks which lots move) is already covered by DK's veto condition, which I adopted in R1. |
| C3-3 | 1 | 1 | Unchanged. The "for" arguments are about the false copy at `lib/copy.ts:69`, and that is a copy fix (F3-15), not a reason to publish a matched part that may be wrong under Verified (F3c). |
| C3-17 | 4 | 4 | Unchanged. |
| C3-15 | 4 | 4 | Unchanged. "It lapses" is a timing point, not a legal one; the P6 gap stays before real users. |
| C3-9a | 4 | 4 | Unchanged. Waiting for F-14 to avoid editing the file twice is a build-order condition. |
| C3-16 | 2 | 2 | Unchanged. |
| C3-37 | 3 | 3 | Unchanged. |
| C3-36 | 4 | 4 | Unchanged. UX's same-day order risk is already a condition (DK). |
| C3-34 | 3 | 3 | Unchanged. |
| C3-39/40 | 3 | 3 | Unchanged. Trust and safety's point (Delete is a safety tool) reinforces my veto condition. |
| C3-42 | 4 | 4 | Unchanged. Reliability's account-takeover point is a condition, not a reason to score lower. |
| C3-35 | 2 | 2 | Unchanged. |
| C3-43 | 2 | 2 | Unchanged. The engineer's and reliability's point (`consent_at` is per connection, `db/schema.sql:289`, so "public since" has no defined value) adds an accuracy objection to the P6 bar. It confirms the low score. |
| C3-38 | 3 | 3 | Unchanged. |
| L-16 | 5 | 5 | Unchanged. The chair's correction that F-9 is built strengthens it. The lapse clause should tie to F-9's merge with no second reports table. |
| L-17 | 5 | 5 | Unchanged. Condition: the one normaliser is the reviewed one from the F-9 branch. |
| L-20 | 3 | 3 | Unchanged. |
| L-18 | 4 | 4 | Unchanged. |
| L-19s | 3 | 3 | Unchanged. |

Added conditions:
- C3-42: re-authentication before export, plus a per-account rate limit (reliability).
- L-17: renames invalidate cached share images that carry the old handle (reliability's point; P6 deletion and
  impersonation).
- C3-43: if the owner says yes, "public since" is defined once for multi-connection and reconnect cases before it is
  built.

### Round 3b: Trust and safety

#### Round 3b: trust and safety, scores after the debate

| Item | R1 | R3 | Reason for change |
|---|---|---|---|
| C3-2 | 5 | 5 | Unchanged. Red team's point that "oldest first" is a basis the trader picks supports my R1 condition 1 (DK's basis rule is binding, otherwise the remaining lots stay tainted and counted). |
| C3-3 | 3 | 2 | Moved by engineer's argument: in DK's probe the unreported split taints nothing, so every drawn lot is "recorded and untainted". The matcher has no input that rules out an unseen inflow. Market research adds that only a vendor position-units check would make publishing safe. My R1 condition (name such a signal) can't be met in code today. The part worth taking now is the copy fix (no false cause at `lib/copy.ts:69`) plus the count beside the headline (C3-17), not publishing the matched part. |
| C3-17 | 5 | 5 | Unchanged. Market research's point is about order (build after the ledger slot), not value. I accept it as a condition. Also UX's condition: the line is a real link, using the same sum as the profile. |
| C3-15 | 3 | 3 | Unchanged. |
| C3-9a | 4 | 4 | Unchanged. |
| C3-16 | 3 | 4 | Moved by red team: it can be built without the unverified vendor signal, using the refusal streak the sync already records (`users.sync_failure_kind = 'refused'`). That removes my "unverified signal" doubt. A record that silently freezes while looking live is a gaming route. My R1 condition stays: viewers get the staleness signal through F-11, not only a trader-only line, and the line never asks for credentials. |
| C3-37 | 3 | 3 | Unchanged. |
| C3-36 | 4 | 4 | Unchanged. UX's same-day reordering test is accepted as a condition. |
| C3-34 | 3 | 3 | Unchanged. |
| C3-39/40 | 3 | 3 | Unchanged. |
| C3-42 | 2 | 2 | Unchanged. Legal's FTC label-mismatch point is answered by the exact help line until real sign-in exists. |
| C3-35 | 2 | 2 | Unchanged. Reliability's "key covers every shown state" helps new URLs, but it doesn't stop an old immutable URL serving a hidden or deleted profile's figures from the CDN. My R1 condition stands. |
| C3-43 | 4 | 3 | Moved by reliability and engineer: `consent_at` is stored per connection (`db/schema.sql:289`), so with several connections, a reconnect or a disconnect, "Public since" has no defined value. An undefined public date is itself gameable: a reconnect could appear to reset it. Still worth doing once the date rule is defined (earliest consent, never reset by reconnect) and the owner rules on Q8. |
| C3-38 | 2 | 2 | Unchanged. |
| L-16 | 5 | 5 | Unchanged. I accept the condition that the re-approval starts only once `claude/fix-user-text-safety` merges with F-9's criteria met on main, with a lapse clause tied to that merge. |
| L-17 | 5 | 5 | Unchanged. Added condition from reliability: a rename invalidates the old handle's share URLs and cached images, so an old card never resolves to a new holder. Starts as rework on top of the F-9 branch, with one normaliser. |
| L-20 | 3 | 3 | Unchanged. |
| L-18 | 4 | 4 | Unchanged. |
| L-19s | 3 | 3 | Unchanged. |

### Round 3b: Decisions keeper

#### Round 3b, decisions keeper

| Item | R1 | R3 | Reason for change |
|---|---|---|---|
| C3-2 | 3 | 4 | Trust-safety and ux-lead (r3a) show that a full transfer out drops a real loss with no trade, no count and no line. That breaks a higher decided rule than the one C3-2 amends: TR-1 (`docs/DESIGN.md:324`) and the matcher's own "never dropped silently" (`lib/trades.ts:41`). With my basis condition, it restores the decided rule. Still conditional on the owner. |
| C3-3 | 1 | 1 | Unchanged. The engineer confirms that the proposed signal cannot exist in the matcher. The copy-cause fix belongs to F3-15, not this item. |
| C3-17 | 4 | 4 | — |
| C3-15 | 3 | 3 | — |
| C3-9a | 4 | 4 | — |
| C3-16 | 3 | 3 | — |
| C3-37 | 3 | 3 | — |
| C3-36 | 4 | 4 | — |
| C3-34 | 4 | 4 | — |
| C3-39/40 | 3 | 2 | Legal (r3a): making Delete secondary works against P6's easy deletion (`docs/POLICY.md:56-57`) and the symmetric-choice standard, while also reversing F-1's signed `plan.md:75-77`. Trust-safety adds that Delete is a safety tool. That turns my "amend with naming" into a substantive objection. |
| C3-42 | 2 | 2 | — |
| C3-35 | 3 | 2 | Pricing-finance and common sense (r3a): at beta volume the saving is below the build cost, and the only failure mode is a stale image under Verified. No rule conflict, but out of proportion now. |
| C3-43 | 2 | 2 | — |
| C3-38 | 3 | 3 | — |
| L-16 | 4 | 4 | — (the chair's correction that F-9 is built on `claude/fix-user-text-safety` supports it, but I was already at 4) |
| L-17 | 4 | 4 | — |
| L-20 | 4 | 4 | — |
| L-18 | 3 | 3 | — |
| L-19s | 3 | 3 | — |

### Round 3b: Common sense

#### Round 3b, common sense (scores after the debate)

| Item | R1 | R3 | Reason for change |
|---|---|---|---|
| C3-2 | 4 | 4 | Kept. The red team's point that a move out is a basis the trader chooses is answered by DK's veto condition, which I already attached (oldest first only where it cannot change a basis; otherwise the remaining lots stay tainted and counted). |
| C3-3 | 2 | 2 | Kept. Engineer and legal confirm that DK's probe cannot be detected in the matcher. Market research says the copy fix is the part to take now, and I agree. |
| C3-17 | 4 | 4 | Kept. Market research's "after the ledger slot" is about order, not worth: build it after C3-2. |
| C3-15 | 3 | 3 | Kept. |
| C3-9a | 4 | 4 | Kept. |
| C3-16 | 2 | 3 | Red team: it can be built on the refusal streak the sync already records (`users.sync_failure_kind = 'refused'`), not on the unverified vendor signal. That removes my main objection. With 0 users it is still not urgent. |
| C3-37 | 3 | 3 | Kept. The engineer's file overlaps (sessions.ts with PR #56, privacy-purge with #62) belong inside F-15's rework, which is already my condition. |
| C3-36 | 4 | 4 | Kept. |
| C3-34 | 3 | 3 | Kept. Added condition (red team): the "degraded" threshold must fit the hourly schedule, not 20 minutes, and the public body is ok/degraded only. |
| C3-39/40 | 4 | 4 | Kept. |
| C3-42 | 2 | 2 | Kept. |
| C3-35 | 1 | 1 | Kept. |
| C3-43 | 3 | 2 | Engineer: `consent_at` is stored per connection (`db/schema.sql:289`), so with two connections or a reconnect, "Public since" has no defined date. A line whose date viewers can't interpret is exactly the confusion it was meant to remove. It needs a design rule and Q8 first. |
| C3-38 | 2 | 2 | Kept. |
| L-16 | 3 | 4 | Chair's correction plus legal and the engineer: F-9 is built (53b74e3, with `lib/reports.ts`), report and takedown are POLICY U2/U3 launch prerequisites, and under the chair's reading a re-approval takes no cap slot. A conditional re-approval ("starts only once `claude/fix-user-text-safety` merges with F-9's criteria met on main") is cheaper than a third council round. |
| L-17 | 3 | 4 | Same reasons as L-16, plus U2 reserved handles. Condition: it opens as rework on top of the merged branch and reuses `checkDisplayName` as the one normaliser. |
| L-20 | 4 | 4 | Kept. |
| L-18 | 2 | 2 | Kept. |
| L-19s | 2 | 2 | Kept. |

### Round 3b: Red team

#### Round 3b, red team: scores after the debate

| Item | R1 | R3 | Reason for change |
|---|---|---|---|
| C3-2 | 4 | 4 | unchanged (DK basis veto stays binding) |
| C3-3 | 2 | 1 | Engineer (r3a): in the DK probe an unreported split taints nothing, so every drawn lot is "recorded and untainted". The matcher has no input that rules out an unseen inflow (`lib/trades.ts:208-210`), and my small-oversell bound doesn't supply one either. Publishing a guess as Verified is the harm. The honest part (the false cause in `lib/copy.ts:69`) is a copy fix for F3-15, not this item. |
| C3-17 | 4 | 4 | unchanged |
| C3-15 | 3 | 3 | unchanged |
| C3-9a | 4 | 4 | unchanged |
| C3-16 | 3 | 4 | Reliability (r3a): it can be built without the unverified vendor signal, from our own refusal streak (`users.sync_failure_kind = 'refused'`). That removes my "built on a field that may never fire" objection and directly answers my stale-but-live gaming route (revoking at the broker). Condition kept: a public "last updated" from our own last good read; `needs_reconnect_at` never hides a record or helps its rank. |
| C3-37 | 3 | 3 | unchanged |
| C3-36 | 4 | 4 | unchanged. I add UX lead's condition: rounding dates to days must not reorder same-day closes or send a chart scrub to the wrong trade (test). |
| C3-34 | 4 | 4 | unchanged |
| C3-39/40 | 4 | 4 | unchanged |
| C3-42 | 3 | 3 | unchanged (trust-safety's dev-stub point matches my real-auth condition) |
| C3-35 | 2 | 2 | unchanged. The a11y/PD stale-image point is real, but a year-long immutable cache that fights takedown is still the larger risk. |
| C3-43 | 3 | 3 | unchanged. Engineer and reliability confirm the per-connection `consent_at` problem (`db/schema.sql:289`); my first-ever-consent condition answers it. |
| C3-38 | 2 | 2 | unchanged |
| L-16 | 3 | 4 | Chair's correction plus trust-safety and legal (r3a): F-9 and `lib/reports.ts` are built on `claude/fix-user-text-safety`, so this can start once that merges. Linkable Verified records with no profile report or takedown break U2/U3. My weaponisation conditions (no hide on a single report, K18 included) stay. Lapse clause: starts only after that branch merges. |
| L-17 | 4 | 4 | unchanged. I add trust-safety's and reliability's point as conditions: a rename must not free the old handle at once (an impersonator could take over forwarded links and cards), and a rename invalidates cached image keys. |
| L-20 | 4 | 4 | unchanged |
| L-18 | 3 | 3 | unchanged |
| L-19s | 2 | 2 | unchanged |

## 6. Round 4: second vote

### Instructions

#### Round 4: second vote on the top half

Scores after the debate: `r3-table.md`. The top half (10 of 19; the cut fell cleanly between 3.40 and 3.13) goes to
a second vote: **C3-2, C3-17, L-16, L-17, C3-36, L-20, C3-9a, C3-37, C3-34, C3-39/40**. Below the cut, dropped to
the next cycle: C3-15, L-18, C3-16, L-19s, C3-38, C3-42, C3-43, C3-35, C3-3.

Approval needs a second-vote mean >= 3.5, then >= 10/15 approve in the final vote and no veto. At most six features
this cycle; items that share files count as one build slot. Re-read any `r3b-*.md` you need.

Score each of the 10 items 0-5 with a one-line reason and the conditions you would attach (they become acceptance
criteria). Write `r4-<slug>.md`. Reply EXACTLY:
SCORES: C3-2=n, C3-17=n, L-16=n, L-17=n, C3-36=n, L-20=n, C3-9a=n, C3-37=n, C3-34=n, C3-39/40=n
then one line per item "ID: reason | conditions".

### Tally (chair)

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

### Round 4: Business lead

#### Round 4, business lead (second vote)

| Item | Score | Reason | Conditions |
|---|---|---|---|
| C3-2 | 4 | Brokers move positions routinely. Today a move out erases a real loss with no count, and one share moved in excludes a recorded position (`lib/corporate-actions.ts:200`, `lib/trades.ts:171`). This is the "Verified hides losses" story that sinks G1-G3. | Owner's yes first (amends `lib/trades.ts:52` and the committee's "exclude and count"). DK veto: oldest-first on a move out only where it cannot change a basis; otherwise lots stay tainted; moved-in lots stay tainted and counted; unknown kinds keep the taint. LG: every move out counted in `excluded_transferred_out` and shown when n > 0. Neutral line naming no cause or wrongdoing. Ships with F3-15's copy, in the ledger slot. |
| C3-17 | 4 | Cheap proof we hide nothing, shown where records are read (pane, strip), and it covers #52's silent `notShared` (`lib/sync.ts:99`). | Pane (and strip if it fits D22/F-10), never a second feed-card line. One sum function shared with the profile (parity test). The line is a real link to the profile's reasons. Muted and neutral, never displaces the disclaimer at 360 px. Share card unchanged until owner Q4. Starts after F3-2 and after the ledger slot, so it shows one true number. |
| L-16 | 4 | F-9 and `lib/reports.ts` are built (53b74e3), so the block is a merge, not a start. Report, hide and takedown are U2/U3 launch prerequisites (`docs/POLICY.md:145-149`) before shared links bring G3 traffic. | Every F-16 condition and LG veto line word for word, plus a dated re-approval. Lapse clause: starts only after `claude/fix-user-text-safety` merges with F-9's criteria met on main; one reports table. K18 addition with legal's vetoes: no DOB, ID or age estimation; no auto-hide on one report; owner reviews and owner runs any deletion. |
| L-17 | 4 | A rename frees the old handle at once, so an impersonator can take over forwarded links: a direct hit on the share loop. `checkDisplayName` already exists (`lib/handles.ts` on the F-9 branch). | Every F-17 condition word for word. Exactly one normaliser (reuse the branch's helper; DK logs it). Built on top of that branch after it merges, with a lapse clause. Renames invalidate cached share URLs and images. No real names or trademarks in lists or fixtures. |
| C3-36 | 3 | It protects the percent-only promise traders connect on (`lib/copy.ts:79`), but it moves no gate and could ride with the fixes. | Every public payload covered, including cached ones and feed HTML. Stats, ranks and CIs computed from stored values. A snapshot/parity test proves no displayed figure changes, and same-day closes keep their order for chart scrubbing. Pane slot with C3-17. |
| L-20 | 3 | A cheap permanent A1 guard, but blocked on PR #55 and fixes #12/#13/#26, and no gate moves. | Cycle-2 conditions word for word. Lapse clause on PR #55 and the three fixes merging. Floors (4.5:1, 3:1, ΔE00 >= 9) never lowered; no visible change beyond the fixes. |
| C3-9a | 3 | Late-posted sells silently missing (`lib/sync.ts:378`) read as cherry-picking, but the case is rare at 0 users. | Insert-only, inside F-14's read limit, in the ledger slot (no slot of its own). `activities` is never updated in place (C3-9b stays owner Q3). A late close never suggests the trader edited anything. |
| C3-37 | 5 | Without it G4, a binding week-8 gate, cannot be read: sessions purge at 30 days and `last_seen_at` is overwritten (`lib/auth/sessions.ts:10,33,46`; `lib/privacy-purge.ts:52`). Small, inside F-15, no slot. | Folded into F-15's build. At most one first-seen day and one returned-after-day-7 day per account, dates only, never public, purged with the account, never extending session life. The privacy committee rules on the field. The readout keeps "signed-in viewers only" and never redefines G4 (MRC2-3 stays the owner's). |
| C3-34 | 3 | A stalled sync silently freezes every record, and this is how the owner finds out. But it is ops, a chore. | Chore with the fixes, no slot. The body holds only booleans, times and hours (no ids, handles, counts or figures), sent `no-store`. The 401 log line never carries any part of the token or the IP. |
| C3-39/40 | 4 | A primary button to a locked page with no way back (`app/account/page.tsx:61`, `app/tools/page.tsx:69-78`), plus Delete outweighing everything in settings (`app/settings/page.tsx:43-44`), is adoption friction for G1 traders. Business lead signs off the F-3 entry-point change while billing is closed. | Billing-open state and F-3 snapshots unchanged. No price, date, "coming soon", waitlist or email capture. LIVE_BILLING and checkout untouched. Delete stays on /settings, visible at 360 px, named as now, keyboard reachable, AA contrast. S9 view 2 unchanged; "Account" kept. Dated decisions in F-1 (`logs/F-1/plan.md:75-77`) and F-3 (`plan.md:142`). C3-44 rides along as a chore with the committee's words. |

### Round 4: Market research lead

#### Round 4, market research lead: second vote

| Item | Score | Reason | Conditions |
|---|---|---|---|
| C3-2 | 4 | A transfer out lets a trader make a loss vanish at will. That copies the broker-native "pick which trades to post" pattern (`market-2026-11-01.md:227`) and erases "no per-trade hiding". | Owner's yes listing `lib/trades.ts:52` and the committee's "exclude and count" as amended. Oldest first only where it cannot change a basis; otherwise the remaining lots stay tainted and counted. Moved-in lots stay tainted. Unknown kinds keep the taint. Neutral transferred-out line. Taint tests updated, never deleted. Ledger slot. |
| C3-17 | 4 | Counts must appear where records are read (pane, strip), not only on the profile (`app/u/[handle]/page.tsx:289-292`). | One muted line only when n > 0, as a real link to the reasons. One sum function shared with the profile, including `notShared` (`lib/sync.ts:99`, and `:121-127` fixed). No warning colour. F3 disclaimer stays in view at 360 px. Share card waits owner Q4. After F3-2, and after the ledger slot so viewers see the final count. |
| L-16 | 4 | Real linkable records are scam bait (`market-2026-11-01-cycle2.md:468`). Report and takedown are pre-launch (U2/U3). F-9 is built. | Every cycle-2 F-16 and legal veto condition verbatim. K18 as a dated addition (no DOB/ID/age estimation, no hide on a single report of an adult, owner runs any deletion). Report category "impersonating this trader elsewhere". Starts only after `claude/fix-user-text-safety` merges with F-9's criteria met. One reports table. |
| L-17 | 4 | Look-alike handles are how real records get impersonated (MRC2-6). The normaliser is already in flight. | After the F-9 branch merges. `checkDisplayName` is the one normaliser. A rename bumps share/image cache keys. Cycle-2 conditions kept. |
| C3-36 | 4 | Percent-only is the promise traders connect on. Ms dates and full-precision returns (`app/u/[handle]/pane/route.ts:22`, `lib/feed.ts:197-198`) can leak size. | Rounding at output only. Stats, ranks and CIs on stored values. No visible figure changes (snapshot). Same-day closes keep their order on chart and scrub. Every public payload covered, feed HTML included. |
| L-20 | 3 | Worth having as a cheap permanent legibility guard, but demand evidence backs labels, not tokens, and its blockers are unmerged. | Starts only after PR #55 and fixes #12/#13/#26 merge (lapse clause). Value-neutral. Contrast floor never lowered. |
| C3-9a | 4 | A late-posted sell is never read (`lib/sync.ts:378`), so a Verified record silently misses a loss (kill risk #2, `market-2026-11-01-cycle2.md:462`). | Insert-only. Within F-14's read limit, built after F-14 merges. Never removes a shown close. Fake-vendor e2e for a sell 10 days late. Revisions table stays with the owner (Q3). |
| C3-37 | 5 | G4's primary measure, day 7 ±1 (`market-2026-11-01-cycle2.md:248`), can't be read at week 8 without it. S, inside F-15. | Dated amendment to F-15, no slot. Server-side, at most one first-seen and one returned-after-day-7 date per account, no time of day. Deleted with the account. Never labelled as G4. MRC2-3 stays the owner's. Privacy committee rules first. |
| C3-34 | 3 | Protects record freshness indirectly. No trader or viewer surface. Fine as a chore. | Body holds booleans, times and hours only (no ids, handles, user counts or figures). `no-store`. The 401 log line carries no token. Degraded threshold from the schedule constant, not 20 minutes. |
| C3-39/40 | 3 | The dead-end primary to locked /tools costs signed-in returns. Demoting Delete has the legal and P6 doubts legal raised. | Names F-1 `plan.md:75-77` and F-3 `plan.md:142` as amended. Business lead sign-off. "Delete my profile" stays on /settings, visible at 360 px without expanding anything; view 2 unchanged. No price, date, "coming soon" or waitlist. Billing-open e2e unchanged. |

### Round 4: Pricing and finance

#### Round 4: pricing-finance, second vote

Lens: build cost against value, plus recurring vendor and infra cost. At 0 users the scarce resources are build
sessions, review slots and owner attention. Launch-path work gets funded first (business §5). Six features at most;
items that share files count as one slot.

| Item | Score | Reason | Conditions |
|---|---|---|---|
| C3-2 | 4 | Closes a loss-hiding route any trader can trigger at will on a Verified record (`lib/corporate-actions.ts:200`, `lib/trades.ts:171`). That protects what the record, and any paid tool on it, is worth. S-M, no runtime cost. | Owner yes, naming the amended rules (`lib/trades.ts:52`; the corporate-actions committee's "exclude and count"). DK veto word for word: "oldest first" on a move out only where it cannot change a basis; otherwise the remaining lots stay tainted and counted; moved-in lots stay tainted. Additive `excluded_transferred_out` count with its own profile line. |
| C3-17 | 4 | Small, no runtime cost; shows every exclusion route (including #52's `notShared`, `lib/sync.ts:99`) where records are read. | Pane and strip only, no feed-card line (D22). Share card waits on owner Q4. The line links to the profile and uses the profile's sum function. The count includes `notShared`. Builds after F3-2 in the pane slot. |
| L-16 | 4 | Launch path (U2/U3, BC-2). Its prerequisite is built (F-9 on `claude/fix-user-text-safety`), so this re-approval can actually start. | Every cycle-2 decision and veto condition kept word for word. K18 addition under legal's veto conditions. Starts only after that branch merges with F-9's criteria met on main. One reports table. Lapse clause on that merge. |
| L-17 | 4 | Launch path (U2 reserved handles). Mostly wiring on `checkDisplayName` (`lib/handles.ts`, F-9 branch). | Cycle-2 conditions word for word. Opens as rework on top of the merged F-9 branch, with `checkDisplayName` confirmed as the one normaliser. Lapse clause. Reliability's point recorded for the cached-share-URL follow-up: renames do not invalidate cached share URLs. |
| C3-36 | 3 | Small privacy hardening before real users. Finance-neutral, and its value only arrives with users. | No printed figure or rank changes (parity test). Day-rounding must not reorder same-day closes. Rides in the pane slot with C3-17, not its own slot. |
| L-20 | 3 | Cheap permanent A1 guard, but every prerequisite is unmerged (PR #55, fixes #12, #13, #26), so the slot may sit idle and lapse into another paid council round. | Cycle-2 conditions word for word. Lapse clause on PR #55 and the fixes. No new dependency without the owner. |
| C3-9a | 3 | Insert-only fix for silently missed late sells (`lib/sync.ts:378`). The vendor bills per user, not per call, so there is no fee impact. With 0 users, it isn't urgent. | Insert-only (`lib/sync.ts:37` unchanged). Within F-14's read limit, built with or after F-14 so `:378` is edited once. Revisions table (C3-9b) stays an owner flag (Q3). |
| C3-37 | 4 | Without this marker the week-8 return gate can't be read, and that reading is the go/no-go on all further spend. Small, inside F-15, no slot. | One per-account date, no per-viewer events, purged with the account. The privacy committee rules on the field (P3). Built inside F-15's rework. MRC2-3 stays the owner's. |
| C3-34 | 4 | Cheapest insurance on the running cost: a stalled or unauthorized cron otherwise burns vendor fees and gate weeks unseen (`app/api/sync/route.ts:34-36`). Small, no prerequisites. | Public body ok/degraded only; detail behind the cron bearer; `no-store`. The degraded threshold fits the hourly cron (not 20 minutes). One rate-limited 401 line with no token or IP. No paid monitoring vendor. |
| C3-39/40 | 3 | The C3-39 half is a clear $0-revenue win: no primary button into the locked /tools (`app/account/page.tsx:61`). The C3-40 half carries legal's P6 easy-deletion risk and amends `logs/F-1/plan.md:75-77`. | Name both amended plan lines (F-1 `plan.md:75-77`, F-3 `plan.md:142`). With billing open, F-3 snapshots unchanged. "Not open yet" names no date or price. Delete stays visible on /settings at 360 px with no extra disclosure step, and view 2 is unchanged. Business lead signs off. One settings slot. |

### Round 4: Growth

#### Round 4, growth (second vote)

| Item | Score | Reason | Conditions |
|---|---|---|---|
| C3-2 | 4 | A transfer that makes a loss vanish is the first thing a critic finds on an anchor's shared link (`lib/trades.ts:52`). Credibility is the growth asset. | Owner's yes (amends `lib/trades.ts:52` and the committee's "exclude and count"). DK veto: oldest first only where it cannot change a basis. Moved-in lots and unknown kinds stay tainted. `excluded_transferred_out` count with a neutral profile line. Copy states no cause. Ledger slot with C3-9a. |
| C3-17 | 4 (from 3) | With C3-3 dropped, oversells stay excluded, so a visible count where records are read (the pane) is the only honest sign of them. That makes it more important than it was in round 1. | One muted line, n > 0 only, a real link to the profile's reasons. Same sum function as the profile, including `notShared` (`lib/sync.ts:99`, and `:121-127`). Never pushes the F3 disclaimer out at 360 px. Share card unchanged until owner Q4. After F3-2 and after the ledger slot. |
| L-16 | 4 | The report action is a named week-0 go-to-market prerequisite (`docs/IDEAS.md:120`), and F-9 is built on `claude/fix-user-text-safety`. | Every F-16 cycle-2 veto condition verbatim. K18 addition with legal's conditions. Lapse clause tied to F-9's merge. Slot counted only when it starts. |
| L-17 | 4 | Reserved handles and name clearance are week-0 prerequisites, and look-alike handles on forwarded share links break trust where outreach happens. | All cycle-2 conditions verbatim. Exactly one normaliser (the branch's `checkDisplayName` is confirmed as that normaliser, or F-17 reuses F-9's; DK logs it). A rename invalidates cached share URLs and images. Lapse clause tied to F-9. |
| C3-36 | 3 | Neutral for growth. It keeps the percent-only promise anchors connect on. | Rounding only at the output; stats, ranks and CIs on stored values; no printed figure changes (snapshot plus pane/profile parity test). Every public payload is covered, including cached ones and the feed HTML. |
| L-20 | 3 | A cheap, permanent accessibility guard with little growth effect. | Cycle-2 conditions verbatim. Starts only after PR #55 and fixes #12, #13 and #26 merge, with a lapse clause. |
| C3-9a | 4 | A missed late row drops a close or turns a sell into an oversold exclusion (`lib/sync.ts:378-379`), so the first shared records are wrong with no count. It is the real cause behind C3-3's case. | Insert-only (`on conflict do nothing`, `:37` intact), within F-14's read limit. No "corrected" copy that suggests the trader edited anything. Test: a sell posted 10 days late appears after reconciliation. Ledger slot with C3-2. |
| C3-37 | 5 | Without it G4 can't be read at week 8, and the go-to-market "first-party gate counters" prerequisite is incomplete (`lib/auth/sessions.ts:46`). Size S, folded into F-15. | Dated amendment to F-15, no slot. At most one first-seen day and one returned-after-day-7 day per account, as dates only, server-side, deleted with the account, never public, never shown to traders, and never extending session life. Labelled "signed-in viewers only", never as G4 (MRC2-3 is the owner's). The privacy committee rules on the field first. |
| C3-34 | 3 | A sync stall during the first 100 traders means stale shared records. Ops work, cheap. | Public body is ok/degraded only, with times and hours behind the cron bearer: no ids, handles, user counts or figures. no-store. A rate-limited 401 log line with no part of the token and no IP. Threshold fit for an hourly cron. Ride with the fixes if possible. |
| C3-39/40 | 4 | Every signed-in user's primary next step is a locked /tools with no way back (`app/account/page.tsx:61`, `app/tools/page.tsx:69-78`). That is a direct activation defect, size S. | The decision names both amended lines (`logs/F-1/plan.md:75-77`, F-3 `plan.md:142`); business lead signs off. Legal veto: "Delete my profile" stays on /settings, visible at 360 px with no disclosure, and S9 view 2 is unchanged. No price, date, "coming soon", waitlist or email capture. F-3's open-state e2e unchanged. Settings slot. |

### Round 4: UX lead

#### Round 4, UX lead: second vote (top half)

| Item | Score | Reason | Conditions |
|---|---|---|---|
| C3-2 | 4 | Today a transfer can drop a real loss with no line, so a viewer can't read the record honestly (`lib/corporate-actions.ts:200`, `lib/trades.ts:171`). | Owner's yes first (amends `lib/trades.ts:52` and the corporate-actions committee rule). DK and red-team basis rule: oldest first only where it cannot change a basis; otherwise the remaining lots stay tainted and are counted. Moved-in units are excluded and counted. Unknown kinds keep the taint. Every probe outcome is a shown trade or a named count. The transferred-out line is one plain, no-blame sentence in the profile's existing muted count block (`app/u/[handle]/page.tsx:283-292`). Ships with F3-15's copy. |
| C3-17 | 4 | The pane is where SW-1 sends signed-out viewers, and it shows the headline with no sign of exclusions (`p1-360-pane.png`). | One muted line, only when n > 0, under the pane's stats row (and the strip's, if it fits D22 and F-10). The line is a real link to the profile's count block, not the bare text "(see profile)". The sum comes from one function the profile also uses, including `notShared` if it is counted. No warning colour or icon. Tap target ≥ 44 px at 360 px. No second line on feed cards. The share card is unchanged until Q4. Starts after F3-2. e2e signed out at 360 px. |
| L-16 | 4 | F-9 and `lib/reports.ts` are built on `claude/fix-user-text-safety`. A profile report and a takedown page are U2/U3 launch prerequisites (`docs/POLICY.md:145-149`). | Every cycle-2 condition, word for word, plus K18's legal veto conditions. It starts only once that branch is merged with F-9's criteria met on main, and lapses otherwise. The report control is secondary, never next to Follow or Share, ≥ 44 px. The hidden page is neutral, with no "review" wording. |
| L-17 | 4 | Reserved handles are a U2 prerequisite, a display name can say "Verified" today, and `checkDisplayName` exists on the F-9 branch. | Every cycle-2 condition. It opens as rework on top of the merged branch, with that helper as the single normaliser (test fails on a second). A rename changes the keys of share URLs and cached images (reliability). Rejection messages are visible beside the field at 360 px, announced, and in plain words. It lapses if the branch doesn't merge. |
| C3-36 | 3 | No screen changes. It is a privacy fix that is worth doing and cheap. | Rounding happens at the JSON boundary only. A snapshot shows no displayed figure changes on the pane, chart and feed at 360 px. Same-day closes keep a stable order, and the chart scrub still opens the right trade. Dates are UTC days in every public payload, including the feed HTML. |
| L-20 | 4 | It is the only lasting guard that keeps later changes readable at 360 px in both colour schemes, and its blockers are already open. | Re-approved conditional on PR #55 and fixes #12, #13, #26 merging, and it lapses otherwise. All cycle-2 conditions apply. No visible value changes beyond the fixes. The floor is never lowered. Focus ring ≥ 3:1. |
| C3-9a | 3 | A late-posted sell silently missing from a Verified record is a trust hole (`lib/sync.ts:378`), but nobody sees it with 0 connections, and it overlaps F-14. | Insert-only. Sequenced after F-14, or inside its read limit, so `lib/sync.ts` is edited once. Builds in the ledger slot with C3-2. It never updates a raw row. No "corrected" wording. A reconciled trade appears in date order with no "new" flag. |
| C3-37 | 3 | Nothing on screen. It lets F-15 measure whether viewers come back. | It folds into F-15's rework and takes no slot. One date per account, purged with the account. The privacy committee rules on the field before the build. MRC2-3 is untouched. |
| C3-34 | 3 | No user surface, but it is a cheap guard against stale records looking live. | It builds as a chore with the fixes and takes no slot. It returns numbers only, publicly ok/degraded, `no-store`, and never echoes a token. The degraded threshold fits an hourly cron (reliability). Exactly one log line per bad bearer token. |
| C3-39/40 | 4 | Locked /tools is a dead end reached from /account's primary button (`app/account/page.tsx:61`, `app/tools/page.tsx:69-78`). /settings repeats "Record tools" as a heading and a link of the same name (`app/settings/page.tsx:27-28`). Delete is the heaviest element on the page (`:43-44`). | Approved as an explicit amendment of F-1 `logs/F-1/plan.md:75-77` and F-3 `plan.md:142`, with the business lead's sign-off. Delete stays a visible, labelled control on /settings at 360 px, one tap to S9 view 2, which is unchanged (legal and trust-safety). With billing closed, no primary button targets locked /tools, and locked /tools has one non-legal link back into the app. With billing open, F-3's snapshots are unchanged. "Account" name kept. C3-44's gate rides in this slot with the F-3 committee's words. |

### Round 4: Product designer

#### Round 4: product designer (second vote)

| Item | Score | Reason | Conditions |
|---|---|---|---|
| C3-2 | 4 | Today a transfer leaves either a vanished loss or a false "corporate" reason on a Verified record (`lib/trades.ts:171`), and a viewer can't see either one: a TR-1 failure. | Owner's yes (it amends `lib/trades.ts:52` and the committee rule). DK's basis condition verbatim: "oldest first" only where it cannot change a basis; otherwise the remaining lots stay tainted and counted, and moved-in lots stay tainted. The new count joins the existing exclusion lines as one muted block under `#excluded`, with no warning or loss colour. `VERIFIED_DEFINITION` and /how change in the same PR. Ship in the ledger slot ahead of C3-17. |
| C3-17 | 4 | Exclusions show only on the profile (`app/u/[handle]/page.tsx:281-289`). The pane, where SW-1 readers see the headline, gives no sign of them. | Not on feed cards (D22). Card and images unchanged until Q4. One `muted` line under the pane headline, above CH-1: a real link to the profile's `#excluded`, named with the count. One sum function shared with the profile, including `notShared` if counted. e2e at 360 px signed out with D20's disclaimer still in view. Built after F3-2 and after the ledger slot, so the number it first shows is true. |
| L-16 | 4 | Its neutral hidden state (own title, one h1, no figures in the image, never "reported") protects innocent records. Its prerequisite F-9 is built on `claude/fix-user-text-safety`. | Earlier decisions and veto conditions word for word. K18 added with legal's conditions. Starts only once that branch merges, with F-9's criteria met on main (lapse clause). One reports table. The report action is a quiet menu item, not a prominent control on the record. |
| L-17 | 4 | Display names can forge the one trust mark today (check glyphs, "Verified"), which breaks settled conflict 1. | Earlier decisions verbatim. Opens on top of the F-9 branch, with `checkDisplayName` confirmed as the one normaliser (never two). Lapse clause tied to that merge. |
| C3-36 | 4 | The payload should carry what the screen shows. The pane ships ms epochs and full-precision returns (`app/u/[handle]/pane/route.ts:22`) under a public cache. | A parity test shows the pane headline equals the profile headline for an odd-return fixture, covering the 0.05 double-rounding edge. The same UTC day prints on profile and pane. Same-day closes keep a stable order (by id), so a chart scrub never lands on the wrong trade. No value is finer than 4 decimals or a day. |
| L-20 | 5 | It is the design system's backbone (§5), the only guard against regressing light Verified (3.77:1) or gain against loss under deutan (ΔE00 2.8), and it blocks only on open work. | Cycle-2 conditions verbatim. No visible value change beyond the fixes. The ΔE00 ≥ 9 floor is never lowered. The image colour table is tested, with no image value change (O-2 stays the owner's). It lands first in the `app/globals.css` slot. Lapse clause on PR #55 and fixes #12/#13/#26. |
| C3-9a | 3 | A late-posted sell never read (`lib/sync.ts:378`) is a silent TR-1 gap, but nobody sees it at 0 connections and it must fit F-14's unmerged read limit. | Insert-only, with raw rows never updated. Built after F-14 merges, in the ledger/connection lane. A found close appears in date order with no "late" or "new" styling. "updated" stays the last successful vendor read (settled conflict 15). |
| C3-37 | 3 | No screen. It is useful as F-15's baseline and nothing more. | Only as an F-15 amendment, with no slot of its own. The privacy committee rules on the field first. One date per account, no per-viewer events, purged with the account. MRC2-3 stays the owner's. |
| C3-34 | 3 | Ops only; no surface for traders or viewers. Cheap and conflict-free. | The public body is ok/degraded only, with times and hours behind the cron bearer. `no-store`. A rate-limited `cron unauthorized` line with no token or IP. A degraded threshold that fits an hourly cron. Not linked from any page. A test greps the body for ids and handles. |
| C3-39/40 | 4 | The worst hierarchy on the ballot: a full-width primary Delete on every /settings visit (`app/settings/page.tsx:43`), and /account's only primary leads to a locked page (`app/account/page.tsx:61`). Legal's P6 point limits how far the demotion can go. | Recorded as amending F-1 `plan.md:75-77` and F-3 `plan.md:142`/§1, the latter in the billing-closed state only. Delete stays visible on /settings at 360 px with no disclosure, one tap to view 2. View 2 (S9) unchanged, and its primary stays the only delete tap. At most one primary per view, and no at-rest "Keep it". "Record tools (not open yet)" is muted text. Locked /tools gets one link back into the app. "Account" name kept. F-3 snapshots unchanged when billing is open. No new colour literal. Build path per the three-version rule unless the owner exempts it. |

### Round 4: Data-visualization designer

#### Round 4, dataviz (second vote, top half)

| Item | Score | Reason | Conditions |
|---|---|---|---|
| C3-2 | 4 | Today a transfer makes a loss vanish, or files 100 priced units as "corporate" (`lib/trades.ts:171`, `lib/corporate-actions.ts:200`). Every outcome must be a shown trade or a named count. | Owner's yes (amends `lib/trades.ts:52` and the committee's "exclude and count"). DK veto: "oldest first" only where it cannot change a basis, otherwise the remaining lots stay tainted and counted; moved-in lots stay tainted. Property test: a TRANSFER never changes a sell whose drawn lots predate it. The three probes give a shown trade or a count. The new count feeds C3-17's shared sum. Neutral line that makes no claim about the other account. |
| C3-17 | 5 | The headline, range and chart on pane and strip omit exclusions that only the profile shows (`app/u/[handle]/page.tsx:283-292`), and `notShared` (`lib/sync.ts:99`) is counted nowhere. | One sum function shared by profile, pane and strip. It includes `notShared` if that is a trader's own exclusion, plus C3-2's count. One muted line only when n > 0, as a real link to the profile reasons. Neutral text, no warning colour or icon. The unit is worded truthfully ("excluded from these figures"). Feed card stays one line (D22); share card unchanged until Q4. e2e signed out at 360 px. Builds after F3-2. |
| L-16 | 3 | Outside my lens. F-9 is built but unmerged with no PR, so starting now would fork the reports table. | Every cycle-2 condition and legal's K18 conditions word for word. Starts only after `claude/fix-user-text-safety` merges with F-9's criteria met on main; lapse clause on that merge. The hidden state is neutral and never says "under review". |
| L-17 | 3 | Outside my lens; same unmerged branch. | One normaliser: reuse `checkDisplayName`, never a second one. A rename bumps share-image and URL cache keys (reliability). Lapse clause on the F-9 branch merge. |
| C3-36 | 4 | Public JSON is more precise than any screen and than consent (`app/u/[handle]/pane/route.ts:22`, `lib/feed.ts:197-198`). Rounding to 0.01% and UTC days changes no printed figure. | Round only at the payload edge: `confidence()`, ranks and ranges compute server-side from full precision. Snapshot test that no printed figure, tone or Flat changes. Same-day closes stay distinct and in order (sort key applied before rounding), so a chart scrub lands on the right trade. Pane headline equals profile headline (parity test). |
| L-20 | 4 | The only lasting guard that a loss never reads as a gain (deutan ΔE00 2.8 today) on any chart, card or image. | Cycle-2 conditions word for word. The ΔE00 ≥ 9 floor is never lowered. Image colours sit in one table that the tests read, not exempt. Lapse clause on PR #55 and fixes #12/#13/#26. |
| C3-9a | 4 | A late-posted sell is never read (`lib/sync.ts:378`), so a Verified record can silently miss a loss. | Insert-only; raw rows never updated. Rebuild only through `rebuildTrades`. Stays within F-14's read limit and builds after F-14 (same line). No "corrected" wording implying the trader changed anything. Fake-vendor e2e with a sell 10 days back. |
| C3-37 | 3 | Outside my lens. Small, folds into F-15 with no slot. | DK and privacy-committee conditions. Never shown to traders as a figure; never used as G4. |
| C3-34 | 3 | Owner-facing; no viewer figure. | No performance figures, user counts, ids or token in the body or the log line. `no-store`. Threshold comes from the schedule constant. |
| C3-39/40 | 3 | Outside my lens. Sensible small fixes to two signed plans. | Names `F-1/plan.md:75-77` and F-3 `plan.md:142` as amended. S9 view 2 unchanged. With billing open, F-3 snapshots unchanged. Business lead signs off. |

### Round 4: Accessibility specialist

#### Round 4: a11y second vote

| Item | Score | Reason | Conditions |
|---|---|---|---|
| C3-2 | 4 | A transfer out today erases a real loss with no text any reader can notice (`lib/corporate-actions.ts:200`, `lib/trades.ts:171`). | Owner's yes first (amends `lib/trades.ts:52` and the committee rule). DK basis condition: "oldest first" only where it cannot change a basis; moved-in lots stay tainted. The new transferred-out line is plain text in the counts block (`app/u/[handle]/page.tsx:289-292`) in `--muted` (≥4.5:1 in both schemes), with no icon- or colour-only cue, and reads at 320 px. |
| C3-17 | 4 | Puts the exclusion fact in text where the headline is read. Muted passes AA (5.03-5.84:1). | One line on the pane and strip only, never a second feed-card line (D22). It comes right after the headline in DOM order. "see profile" is a real link with a descriptive name, built on the profile's own sum function. It is not tooltip-only, does not break at 320 px and never displaces the disclaimer. Waits for F3-2. |
| L-16 | 4 | Its form decisions already meet AA (F-16:55-57; AC :97 axe and keyboard e2e). F-9 is built on `claude/fix-user-text-safety`. | Keep every earlier decision and veto condition verbatim. K18's "may be under 18" option is a labelled control in the same form (legal's veto conditions: no DOB, ID or age estimation). The takedown page has an h1 and is reachable from the footer. Lapse clause on F-9. |
| L-17 | 4 | Bidi and invisible characters change what screen readers announce and enable spoofing. The neutral 404 page has its own h1 (F-17:37-39). | Keep earlier decisions verbatim. Rejection messages name the field and the rule in text (3.3.1), use `role=alert` and move focus to the field. Use F-9's normaliser only. Lapse clause on F-9. |
| C3-36 | 3 | Privacy value; for assistive tech it is neutral. | Visible text and accessible names keep the same rounding as the payload. No aria-label carries more precision than the screen shows. |
| L-20 | 5 | Core A1: main guards only the Demo badge, while light Verified (3.77:1) and gain/loss ΔE00 2.8 under deutan are measured failures (F-20:9-11). | Keep all earlier conditions word for word. Floors are never lowered (4.5:1 text; 3:1 large text, UI and focus ring; ΔE00 ≥ 9 under protan, deutan and tritan). PR #55 and fixes #12, #13, #26 merge first. It lands before F-18 and keeps the lapse clause. |
| C3-9a | 3 | No accessibility effect; it is a record-correctness item. | It is insert-only, within F-14's read limit. Any count line is text. |
| C3-37 | 3 | No user-facing surface; the privacy committee and the owner's MRC2-3 gate decide it. | It is an F-15 amendment, with no slot of its own. The marker is one per-account date, with no per-viewer events, purged with the account. |
| C3-34 | 3 | No user-facing accessibility surface; operational value only. | The response holds numbers only, sent `no-store`. |
| C3-39/40 | 3 | The dead-end fix (C3-39) is clearly positive. Demoting Delete risks the easy-deletion and symmetric-choice rules (P6, `docs/COMPLIANCE.md:95`) and amends the F-1 plan (`logs/F-1/plan.md:75-77`). | Name both amended lines (F-1 `plan.md:75-77`, F-3 `plan.md:142`); the business lead signs off. "Delete my profile" stays visible on /settings at 360 px and keeps its name. It is never behind a disclosure, is keyboard reachable, meets ≥4.5:1 text and ≥3:1 boundary contrast, and shows visible focus. "(not open yet)" is in the visible link text, not greyed or `aria-disabled` alone. The locked /tools link back has a descriptive name. View 2's `role=alert` and e2e stay unchanged. |

### Round 4: Engineer

#### Round 4, engineer (second vote)

| Item | Score | Reason | Conditions |
|---|---|---|---|
| C3-2 | 4 | The diff is small: tag TRANSFER with its own reason at `lib/corporate-actions.ts:200-205`, and stop `taint(b.lots)` at `lib/trades.ts:171` for transfers. `removeOldest` already exists. The new counter runs through rebuild in the contended `lib/sync.ts`. | Owner's yes, with the amended rules listed (DK). Oldest-first only when the whole position moves or every candidate lot shares `price`/`feePerUnit`; otherwise taint as today. Moved-in lot tainted. Unknown kinds keep the taint. Build after the fixes branch (F3-1, F3-5) and truthful-labels land on `lib/trades.ts`, with F3-15's copy. Taint tests updated, never deleted. Property test: a TRANSFER never changes a sell whose drawn lots predate it. |
| C3-17 | 4 | S. The counts already exist on `users` (`db/schema.sql:34`, `:319`, `:657`). Only the pane and strip files are contended. | In F3-2's lane after it. Pane plus trade and month pages, never feed cards (D22). Images unchanged until Q4. One sum function shared with the profile, and the line links to the profile counts. `notShared` gets a real sell counter computed in rebuild, never an estimate. e2e at 360 px, signed out. |
| L-16 | 4 | F-9's reports module is built on `claude/fix-user-text-safety`, so F-16 extends it instead of starting from scratch. | Starts only when that branch has merged with F-9's criteria met on main. Extends F-9's reports module (one reports table, `F-16:77`). All cycle-2 decisions word for word. A new lapse clause. K18 only after the report and hide exist, under legal's conditions. |
| L-17 | 3 | `checkDisplayName` already exists in `lib/handles.ts` on the same branch, but the rename hold must also handle cached cards and URLs under a freed handle, which nothing specifies yet. | Rework on top of the F-9 branch after it merges. One normaliser. The rename hold means no cached card or `og:image` is served under a freed handle (test). A hold never blocks deletion. A new lapse clause. |
| C3-36 | 4 | S. It closes a precision leak at `app/u/[handle]/pane/route.ts:22` and `lib/feed.ts:197-198` with no visible change. | Round only at the JSON/prop boundary, never in `records1` or stored values. Sort before rounding, and test that a same-day scrub hits the right trade. Every F-10 and F-19 pinned literal unchanged. A response test covers `/pane`, `/pane-chart` and feed HTML (no value over 4 decimals, no time finer than a day). |
| L-20 | 4 | Its blocking test is already written in PR #55. After #55 and fixes #12, #13, #26 merge, it is a value-neutral change to `app/globals.css` behind a guard. | Lands after #55 and before F-18. The floor is never lowered. No image colours (O-2). A computed-style snapshot shows no value change. A new lapse clause. |
| C3-9a | 3 | Feasible as insert-only via `fetchActivitiesPage` (`lib/broker.ts:96`) with no protected edit, but it lives in `syncUser`, which F-14 is rewriting. | After F-14 merges, inside its per-account read gate and `SYNC_REQUESTS_PER_ACCOUNT`. Insert-only, so no raw row is updated or deleted. Pages bounded per run, resumed by offset. Fake-vendor test: a sell 10 days behind the newest trade appears. |
| C3-37 | 3 | S, but no slot of its own: it belongs inside F-15's rework. | Privacy committee rules on the field first. One nullable per-account date, deleted with the account, listed in the privacy maps. Never labelled G4. The DB test from the brief. |
| C3-34 | 4 | S. A new file with no overlap, plus one line at `app/api/sync/route.ts:34-36`. The data exists in `sync_shards` (`db/schema.sql:409`). | Public body ok/degraded only, with `no-store`. Times and hours only behind the cron bearer. One bounded indexed query. The threshold derives from the cadence constant. A rate-limited 401 line with no token, header or IP. Test greps the body. |
| C3-39/40 | 4 | S. The cleanest slot: `app/settings`, `app/account` and `app/tools/page.tsx` are untouched by every in-flight branch. | F-1 `plan.md:75-77` and F-3 `plan.md:142` named as amended. Delete stays visible on /settings at 360 px with no disclosure (legal). View 2 unchanged and its e2e kept. Billing-open F-3 snapshots unchanged. Business lead and UX sign-off. |

SLOTS:
- C3-2 + C3-9a are one ledger/sync slot (`lib/sync.ts` rebuild and read path, after F-14).
- C3-17 + C3-36 are one pane/payload slot (`lib/feed.ts`, pane files, after F3-2).
- L-16 + L-17 are one trust-and-safety slot on the F-9 branch (`lib/reports.ts`, `lib/handles.ts`, `lib/auth/attempts.ts`, profile page).
- L-20, C3-34 and C3-39/40 each take a slot of their own.
- C3-37 has no slot (F-15 amendment).
- That makes 6 slots in all.

### Round 4: Reliability engineer

#### Round 4: reliability (second vote)

| Item | Score | Reason | Conditions |
|---|---|---|---|
| C3-2 | 4 | Closes a trader-triggered route from a priced loss into silence (`lib/corporate-actions.ts:200`, `lib/trades.ts:171`). Safe only with the basis condition. | Owner's yes first (amends `lib/trades.ts:52` and the committee's "exclude and count"). DK veto condition word for word: oldest first on a move out only where the vendor names the lots, the whole position moves, or every candidate lot has the same basis; otherwise the remaining lots stay tainted and counted; moved-in lots are always tainted. Property test: a TRANSFER never changes a sell whose drawn lots predate it and did not move. Two rebuilds give byte-identical `closed_trades`. Unknown kinds keep the taint. |
| C3-17 | 4 | The headline hides its exclusions where it is read; #52's `notShared` exclusion (`lib/sync.ts:99`) is counted nowhere. | One shared sum function serves pane, strip and profile, and a test checks the same n on all three. The line is a real link to the profile's reasons. The `notShared` count is decided and tested. Ships after the fixes-list defect: the rename-chain read `lib/sync.ts:121-127` gets the `notShared` filter, with a behavioural test. Card unchanged until owner Q4. |
| L-16 | 4 | The visible-user-predicate test on every `closed_trades` read is a strong integrity guard; a profile-level hide survives rebuild. | All earlier conditions and K18's legal veto conditions word for word. The hide covers the rename-chain path, images and sitemaps (test). The audit row is written in the same transaction as the hide or unhide. Lapse clause: builds after `claude/fix-user-text-safety` (F-9) merges. |
| L-17 | 3 | Legitimate launch prerequisite, but sequencing risk: a second normaliser before the F-9 branch merges. | Earlier conditions kept. Opens as rework on top of F-9 after the merge, reusing `lib/handles.ts` as the one normaliser. A rename bumps every cache or share key that includes the handle (test). |
| C3-36 | 4 | S. Removes precision the screens never use from public cached JSON (`app/u/[handle]/pane/route.ts:22,26`; `lib/feed.ts:197-198`). No stored data changes. | Round only at serialisation, never written back. Parity test: the pane headline equals the profile's for the same fixture. No value over 4 decimals and no time finer than a UTC day in `/pane`, `/pane-chart` or the feed HTML. |
| L-20 | 3 | Outside my lens; a useful regression guard, but all its prerequisites are unmerged. | Earlier conditions kept. Starts only after PR #55 and fixes #12/#13/#26 merge (lapse clause). |
| C3-9a | 4 | Plain data loss: the read starts at the newest stored activity minus 7 days (`lib/sync.ts:379`), so late-posted rows are never read. Insert-only. | Insert-only, never update or delete. Covers BUY and SELL. Paged. Built after F-14 merges, with its requests inside F-14's per-account read limit and `syncCost`. Skips disconnected and paper accounts. Late rows pass the existing `latePosted` checks. Fake-vendor e2e: a sell 10 days behind appears after one run, and a second run inserts 0. Any `lib/broker.ts` edit waits for the owner's merge. |
| C3-37 | 3 | Fine as an F-15 amendment; no slot of its own. | Written once and idempotently (a re-sign-in never moves it). It survives the session purge (`lib/privacy-purge.ts:52`), is purged with the account and is listed in `lib/privacy-retention.ts`. The privacy committee rules on the field. |
| C3-34 | 5 | The only item that makes a stalled or unauthorized cron visible (`app/api/sync/route.ts:34-36`). It reads the existing `sync_shards` (`db/schema.sql:409-418`) and has no prerequisites. | Public body is ok/degraded only, `no-store`. Ages, `missingShards` and housekeeping's last run sit behind the cron bearer. Degraded comes from the configured schedule (over 2 cron intervals, or any missing shard), not a fixed 20 minutes. Cheap queries, no scan of `users`. The 401 line is one fixed, rate-limited string with no token, header or IP. A test greps the body for ids, handles and emails. |
| C3-39/40 | 3 | Outside my lens, S, no data path. It takes the `app/settings/page.tsx` slot. | F-3's billing-open e2e snapshots pass unchanged. S9 view 2 unchanged. Leaves room for C3-15's Connected brokers section in the order. |

### Round 4: Legal and compliance

#### Round 4: legal and compliance, second vote

Findings, not legal advice (`docs/POLICY.md:18-24`). Conditions marked **(veto)** are binding: if one is removed from
the built scope, the item breaks POLICY.

| Item | Score | Reason | Conditions |
|---|---|---|---|
| C3-2 | 4 | Today a full transfer out leaves no trade, no count and no line. That is a silent gap against F3 (`:114-116`) and F4 (`:131-132`). Moved-in lots stay tainted, so F3c (`:128-130`) holds. | (1) Owner's yes, listing as amended `lib/trades.ts:52` and the committee's "when in doubt, exclude and count". (2) **(veto)** "Oldest first" on a move out only where it cannot change a basis: the vendor names the lots, the whole position moves, or every candidate lot has the same per-unit basis. Otherwise the remaining lots stay tainted. (3) **(veto)** Moved-in lots stay tainted, and unknown kinds keep today's taint. (4) **(veto)** Every transfer out is counted and shown when n > 0, in a neutral line. (5) /how calls FIFO the record's own method, not the broker's. (6) Taint tests are updated, never deleted. |
| C3-17 | 4 | Exclusions next to the headline guard against the completeness implication F3a bars (`:117-119`) and the cherry-picking F4 bars. | (1) **(veto)** The line never displaces the disclaimer at 360 px. (2) One shared sum function with the profile, and a real link to the reasons. (3) **(veto)** Include #52's `notShared` exclusion (`lib/sync.ts:99`) in the count, or count it on the profile (F3c "excluded and counted"). (4) Neutral words ("excluded"), no warning colour. (5) **(veto)** Share card and images unchanged until owner Q4. Starts after F3-2. |
| L-16 | 5 | POLICY requires a report action on every profile and a takedown process before launch (U2/U3, `:145-149`), plus a takedown contact (`:58`). F-9 is built on `claude/fix-user-text-safety`. | (1) **(veto)** Every F-16 legal veto line stays verbatim. (2) Lapse clause: starts only after F-9's branch merges, with one reports table. (3) K18 addition, all **(veto)**: no date of birth, ID, face/voice or age estimation; no auto-hide on a single report (`F-16:20-22`); no automatic deletion (H `:179`); no minors' cohort words. (4) Under-18 reports sort first in the digest. (5) The age-assurance method stays the owner's (`:232`). |
| L-17 | 5 | Reserved handles are a named U2 launch prerequisite (`:146`). A display name that says "Verified" or carries a check glyph implies the identity verification F3a forbids. | (1) **(veto)** Every F-17 legal line stays verbatim: no third-party or person name in the list, tests or fixtures; a hold stores only the handle and a date and never blocks deletion; no personal data in rejection logs. (2) The one reviewed normaliser from the F-9 branch (`lib/handles.ts`), never a second. (3) A rename invalidates cached share images that carry the old handle. (4) Starts after that branch merges. |
| C3-36 | 4 | Closes a P3 gap on main (`:48-50`): consent calls prices private (`lib/copy.ts:79`), yet the public pane cache carries millisecond times and full-precision returns (`app/u/[handle]/pane/route.ts:22,26`; `lib/feed.ts:197-198`). | (1) **(veto)** Every public payload is covered: pane, pane-chart, feed HTML and series, pages, og images. Cached bodies are re-keyed. (2) **(veto)** Stats, ranks and CIs compute on stored values; round only at the output. (3) Same-day order is kept (sort before rounding), and no displayed figure changes (snapshot test). |
| L-20 | 3 | A lasting A1 control (`:153-155`), with modest compliance gain beyond fixes #12, #13 and #26. | (1) **(veto)** Floors of 4.5:1 text, 3:1 UI and focus, and ΔE00 ≥ 9, never lowered. (2) No hosted fonts or assets. (3) No brand-matched colours (T3). (4) Lapse clause on PR #55 and fixes #12, #13, #26. |
| C3-9a | 4 | A late-posted sell is never read (`lib/sync.ts:378`), so a Verified record can silently miss a close. That is against F4 (`:131-132`) and pre-launch accuracy (`:234-235`). Insert-only leaves `CLAUDE.md:62` intact. | (1) **(veto)** Insert only, never update or delete a raw row. (2) **(veto)** Never runs for a disconnected or frozen account. (3) Inside F-14's read gate, after F-14. (4) No raw payloads in logs (P6 `:58-59`). (5) Any `lib/broker.ts` edit goes through the owner's merge. |
| C3-37 | 3 | Acceptable under P3 if minimal. No legal gain. | (1) **(veto)** At most one first-seen day and one returned-after-day-7 day per account, no time of day. No IP, UA, device, page, referrer or session link. (2) **(veto)** Deleted with the account, and it does not lengthen session retention. (3) Never public, never G4 itself, readout k ≥ 5. (4) SCHEMA_MAP entry; the privacy committee rules on the field; the Privacy Policy text describes it before real users (owner). (5) An F-15 amendment, no slot. |
| C3-34 | 3 | Operational, legally neutral. | (1) **(veto)** The body holds no ids, handles, user counts, figures or error text, and is sent `no-store`. (2) **(veto)** The 401 line never contains the presented token or any part of it, and no IP (S2 `:33-35`, P3). (3) The threshold comes from the schedule constant. |
| C3-39/40 | 3 | Fixes a dead end. Demoting Delete is acceptable only if deletion stays as easy to find (P6 `:56-57`; COMPLIANCE `:95`). | (1) **(veto)** "Delete my profile" stays on /settings itself: visible at 360 px without expanding, same name, keyboard reachable, AA contrast. View 2 unchanged. (2) The approval names `logs/F-1/plan.md:75-77` and F-3 `plan.md:142` as amended. (3) **(veto)** No price, no launch date, no waitlist or email capture; LIVE_BILLING and checkout untouched. (4) Call the processor "the billing vendor" (T1, Q11). (5) Shares its slot with C3-15 later (`app/settings/page.tsx`). |

### Round 4: Trust and safety

#### Round 4: trust and safety, second vote

| Item | Score | Reason | Conditions |
|---|---|---|---|
| C3-2 | 5 | This closes the one loss-hiding route any trader can trigger at will: a transfer out erases a loss with no trade, no count and no line (`lib/corporate-actions.ts:200`, `lib/trades.ts:171`). | Owner's yes first (it amends `lib/trades.ts:52` and the committee's "exclude and count"). DK's basis rule is binding: "oldest first" only when the choice can't change a basis; otherwise the remaining lots stay tainted and counted. Add a test where specific-lot moves would flatter the record. Every transfer out is counted (`excluded_transferred_out`) and shown, never silent. Moved-in lots stay tainted, and unknown kinds keep the taint. Neutral copy. Build with C3-17. |
| C3-17 | 5 | C3-3 dropped, so counting is now the only containment for the oversell route. It also covers every other exclusion, including #52's silent `notShared` (`lib/sync.ts:99`). Today counts show only on the profile (`app/u/[handle]/page.tsx:289-292`). | One sum function shared with the profile, and it includes shared-account marks (test that pane and profile totals are equal). The line is a real link to the reasons, in neutral words, with no warning colour, and the trader can't suppress it. Build after or with the ledger slot. Share card unchanged until owner Q4. The disclaimer is never displaced at 360 px. |
| L-16 | 5 | The trust-and-safety floor before launch: profile report, impersonation category, audited owner-run hide, neutral hidden state and the takedown page (U2/U3). It was designed against brigading. | Every F-16 decision and veto condition verbatim. K18 is a dated addition with legal's conditions (no DOB, ID or age estimation; a single report never hides; the owner runs any deletion). It starts only once `claude/fix-user-text-safety` merges with F-9's criteria met on main, and lapses if that merge hasn't happened by the next council. One reports table. Hides also stop share images and cached responses. |
| L-17 | 5 | Today a rename frees the old handle at once, so an impersonator can take over every forwarded link and card. Reserved handles are a U2 launch prerequisite, and display names can carry "Verified" or check glyphs. | Every F-17 decision verbatim. Exactly one normaliser, reusing `checkDisplayName` from the F-9 branch (DK logs the choice). Build as rework on top of that branch after it merges. A rename invalidates the old handle's share URLs and cached images, so an old card never resolves to a new holder. No third-party names anywhere. |
| C3-36 | 4 | Full-precision returns and millisecond times on a public cache (`app/u/[handle]/pane/route.ts:22,26`; `lib/feed.ts:197-198`) help infer position size, which marks wealthy traders as scam and doxxing targets. | Every public payload, cached ones included, with cache keys rotated. Stats, ranks and CIs compute on stored values. Parity test: pane and profile headlines equal. Test that same-day closes keep their order. Keep the vendor "intraday times" question open. |
| L-20 | 3 | No direct trust-and-safety effect. It keeps the Demo badge and disclaimer readable, which supports honest presentation. | Cycle-2 conditions verbatim. Floors are never lowered. Demo badge and disclaimer at or above AA. Starts after PR #55 and fixes #12, #13 and #26. |
| C3-9a | 4 | A sell posted more than 7 days late is never read (`lib/sync.ts:378`), so a loss can silently never appear on a Verified record. | Insert-only: raw rows are never updated or deleted. Never runs for a disconnected account. Results land through `rebuildTrades`, never as patched rows. Fake-vendor e2e with a sell 10 days back. The revisions table stays with the owner (Q3). |
| C3-37 | 3 | Neutral for trust and safety; it adds no abuse surface if it stays one date. | At most one date per account. No per-viewer, session, IP or device data. Purged with the account. Never public. SCHEMA_MAP entry. Fold into F-15 with no slot of its own. |
| C3-34 | 3 | Low abuse value. The cron 401 line helps spot someone probing the secret. The body must not become a recon oracle. | The body is ok/degraded plus times and hours only, with no ids, handles, counts or error text, and `no-store`. Detail sits behind the cron bearer. The log line carries no token fragment and no IP. Rate-limited. Use a threshold that fits the hourly cron. Run it as a chore with the fixes. |
| C3-39/40 | 3 | Mostly UX. For trust and safety, deletion is a safety tool for a harassed trader and must stay easy to find. | "Delete my profile…" stays on /settings, visible at 360 px without expanding anything, keyboard reachable, at AA contrast. No confirm-shaming. S9 view 2 unchanged. No price, date, waitlist or email capture on locked /tools. |

### Round 4: Decisions keeper

#### Round 4, decisions keeper (second vote)

Round-0 veto conditions (`r0-decisions-keeper.md`) bind. Citations are at f467293.

| Item | Score | Reason | Conditions (acceptance criteria) |
|---|---|---|---|
| C3-2 | 4 | It restores TR-1 (`docs/DESIGN.md:324`) and "never dropped silently" (`lib/trades.ts:41`) against a route any trader can trigger. It amends a delegated rule, so it needs the owner's yes. | (1) Owner's yes first. The approval lists `lib/trades.ts:52` and `logs/corporate-actions/committee-2026-11-01.md:44-45`, `:57-58` as amended. (2) Moved-in lot stays tainted (`:143-144`). (3) A move out uses "oldest first" only where the choice can't change a basis (the vendor names the lots, the whole position moves, or all candidate lots share a basis); otherwise lots stay tainted (`CLAUDE.md:95`). (4) Unknown kinds keep the taint. (5) Tests updated, never deleted. |
| C3-17 | 4 | No conflict once reshaped. It makes CLAUDE.md:95's counts visible. | (1) No second line on feed cards (D22 `docs/IDEAS.md:148`, `F-10:12-18`). (2) Share card and images unchanged until owner Q4. (3) D24 and idea-16 strip wording unchanged. (4) The disclaimer stays in view at 360 px. (5) It includes #52's `notShared` only if the profile counts it. |
| L-16 | 4 | A re-approval on decided terms. F-9 is now built on `claude/fix-user-text-safety`. K18 fits F-16's no-automatic-hide rule. | (1) Every decision in `F-16:16-65` stays word for word, plus one dated re-approval line. (2) One reports table (`F-16:77`). (3) F-9's decisions and acceptance criteria are met on main before F-16 starts. (4) K18 is a dated addition: a signed-in, rate-limited reporter; no date of birth, ID or age estimation; owner review; the owner runs any deletion; a single report never hides. (5) New lapse clause. |
| L-17 | 4 | It builds the reserved-handle launch prerequisite on decided terms. | (1) `F-17` decisions word for word. (2) One normaliser, built on the branch's `checkDisplayName`. (3) Nothing deleted (`F-17:46`). (4) A hold never blocks deletion (`F-17:62`). (5) New lapse clause. |
| C3-36 | 4 | No decided rule touched. Brings payloads in line with consent (`lib/copy.ts:79`) and P3. | (1) Covers every public payload. (2) Rounding at output only; stats, CIs and ranking use stored values. (3) Same-day trades stay distinct, ordered chart and scrub points (`docs/DECISIONS.md:55-73`). (4) No visible figure changes. |
| L-20 | 4 | A value-neutral foundation; no owner rule touched. | (1) `F-20` decisions word for word. (2) Floor never lowered (`F-20:30`). (3) No image colour change; O-2 stays the owner's (`:33`). (4) With L-18 dropped, record that F-18 waits and that F-20 no longer shares a slot with it. (5) New lapse clause. |
| C3-9a | 4 | Insert-only keeps "raw, immutable" (`CLAUDE.md:62`) and fixes the 7-day window (`CLAUDE.md:71`, `lib/sync.ts:378`). | (1) Never updates or deletes a raw row. (2) Within F-14's once-a-day activities read (`F-14:13-15`). (3) `lib/broker.ts` edits wait for the owner's merge. (4) The revisions table (C3-9b) stays with the owner (Q3). |
| C3-37 | 3 | A valid F-15 amendment that sits close to the owner's MRC2-3. | (1) A dated F-15 amendment, not a slot. (2) Never G4, never redefines a gate (`F-15:48`, `:110-111`). (3) Server-side, per account, dates only; deleted with the account. (4) The privacy committee rules on the field first. |
| C3-34 | 4 | No decided rule touched; fits `CLAUDE.md:59` and standing direction 3. | (1) Body holds only booleans, times and hours, `no-store`. (2) The 401 log line has no token, IP or header. (3) The threshold comes from the schedule constant. (4) No new vendor. |
| C3-39/40 | 2 | It reverses F-1's signed S9 view 1 (`logs/F-1/plan.md:75-77`) and F-3 `plan.md:142`. Legal shows that a secondary Delete works against P6's easy deletion (`docs/POLICY.md:56-57`). | If approved anyway: (1) The dated decision names both amended plan lines. (2) "Delete my profile" stays on /settings, visible at 360 px without expanding anything, with symmetric weight. (3) S9 view 2 and the "first action deletes nothing" test are unchanged. (4) Billing-open F-3 snapshots unchanged; no new price. I would accept the C3-39 half alone. |

Note: with L-18 and L-19s dropped, both go to `Status: draft` with a dated lapse line, except that F-19 stays
`built` and only its sweep note is marked lapsed.

### Round 4: Common sense

#### Round 4, common sense (second vote)

| Item | Score | Reason | Conditions |
|---|---|---|---|
| C3-2 | 4 | A transfer can erase or relabel a real loss on a Verified record (`lib/corporate-actions.ts:200`, `lib/trades.ts:171`). A reasonable viewer would call that hiding a loss. | Needs the owner's yes, because it amends `lib/trades.ts:52` and the committee rule. DK's veto: oldest first only where it cannot change a basis; otherwise the remaining lots stay tainted and counted, and moved-in lots stay tainted. Every outcome is a shown trade or a named count. The transferred-out line is neutral and claims nothing about what happened elsewhere. |
| C3-17 | 4 | Counts shown only on the profile (`app/u/[handle]/page.tsx:289-292`) are invisible where records are actually read. | One muted line on the pane, linking to the profile's reasons. Profile and pane get the sum from one function. Include `notShared` (`lib/sync.ts:99`) with its own profile line if it is an exclusion. No line on feed cards (D22). No warning colour. The share card waits for Q4. Build it after the ledger slot (C3-2). |
| L-16 | 4 | F-9 is built (53b74e3). Report and takedown are U2/U3 launch prerequisites. A re-approval uses no cap slot. | It starts only once `claude/fix-user-text-safety` merges with F-9's criteria met on main. Every cycle-2 decision and veto condition is kept word for word. The K18 addition: a single report never hides an adult's record; owner review; the owner runs any deletion; no DOB, ID or age estimation. |
| L-17 | 4 | U2 reserved handles; the normaliser is already in flight. | It opens as rework on top of the merged F-9 branch and uses exactly one normaliser (reuse `checkDisplayName`). Cycle-2 conditions are kept word for word. |
| C3-36 | 4 | S, no visible change, and it closes the gap between what consent calls private (`lib/copy.ts:79`) and what JSON carries (`app/u/[handle]/pane/route.ts:22`, `lib/feed.ts:197-198`). | Round at the edge only: stats, ranks and intervals use stored values. No displayed figure changes (snapshot test). Same-day points sort before rounding. Every public payload is covered, cached ones included. |
| L-20 | 4 | It is the cheapest permanent guard against a loss reading as a gain or against failing contrast. It is blocked only by work that is already open. | It starts after PR #55 and fixes #12, #13 and #26 merge, and lands before F-18. Cycle-2 conditions are unchanged; the ΔE00 floor is never lowered. |
| C3-9a | 4 | A sell posted more than 7 days late is never read (`lib/sync.ts:378`), so a Verified record silently misses a close. | Insert-only: never update or delete a raw row. Reads count inside F-14's per-account gate. The `lib/broker.ts` edit waits for the owner's merge. No new public field. |
| C3-37 | 3 | S and needs no slot, but it is low value until real viewers exist and it adds a stored per-account field. | It is a dated amendment inside F-15's rework, not a feature. One date per account, server-side, never public, purged with the account. The privacy committee rules on the field first. It is never labelled G4. |
| C3-34 | 3 | Owner-facing and S; worth having before anyone connects, but chore-sized. | Prefer the chores list over a feature slot. The public body is ok/degraded only, with no ids, handles, user counts or figures. Detail sits behind the cron bearer. The threshold comes from the schedule constant (not 20 minutes). The 401 line is rate limited, with no token, prefix or IP. |
| C3-39/40 | 4 | A primary button leads to a locked page with no way back (`app/account/page.tsx:61`), and Delete is the heaviest element on every /settings visit. Both are confusing and out of proportion. | Name `F-1/plan.md:75-77` and F-3 `plan.md:142` as amended, in the billing-closed state only. Delete stays visible on /settings at 360 px, one tap to view 2, never behind a disclosure. View 2 is unchanged. With billing open, F-3's snapshots are unchanged. No price, date promise or waitlist. Business lead signs off. C3-44 rides in the same slot. |

### Round 4: Red team

#### Round 4, red team: second vote

| Item | Score | Reason | Conditions |
|---|---|---|---|
| C3-2 | 4 | Closes the cheapest trader-triggered loss-hiding route on a Verified record. Today a transfer out removes units with no count (`lib/trades.ts:168-174`), and a 1-unit transfer in excludes 100 recorded units (`:171`). Owner flag: it amends `:52`. | DK veto: oldest first only where it cannot change a basis; otherwise the remaining lots stay tainted and are counted. Moved-in lots are tainted and unknown kinds keep the taint (LG). Every transfer out counts and is never 0 (probe tests, including between two of the user's own connected accounts). A property test shows a TRANSFER never improves a shown average. The count reaches the pane through C3-17. Neutral copy, no cause stated. |
| C3-17 | 4 | Without it, every exclusion route stays invisible where records are read; counts live only on the profile (`app/u/[handle]/page.tsx:289-292`). | One shared sum used by profile, pane and strip, with an equality test. It includes `notShared` (`lib/sync.ts:99`) or names it separately. The disclaimer stays in view at 360 px (LG). Neutral, no warning colour. Share card unchanged until owner Q4. Signed-out e2e. |
| L-16 | 4 | Linkable Verified records with no profile report or takedown are scam bait and break U2/U3. F-9 and `lib/reports.ts` exist on `claude/fix-user-text-safety`. | Every F-16 LG line verbatim. K18: no hide on a single report. Hide only after owner review. Reporters are signed in and rate-limited per reporter and per target. Unfounded repeat reporters are visible to the owner. Neutral hidden state with no "under review" or age wording. No DOB, ID or age estimation. The owner runs any deletion. Starts only after that branch merges with F-9's criteria met; lapses again otherwise. One reports table, no fork. |
| L-17 | 4 | Look-alike handles and names borrow another trader's Verified record in shared links. Two normalisers are a bypass in themselves. | Exactly one normaliser (reuse `checkDisplayName`/F-9's from the text-safety branch) used by signup, rename, display name, search and reports, with a test that every caller imports it. Covers mixed scripts, zero-width and bidi characters, and case/width folds. A rename does not free the old handle at once, and it invalidates cached share/image keys. No third-party or real names in lists, tests or fixtures (LG). A hold never blocks deletion. Lapse clause tied to the branch merge. |
| C3-36 | 4 | Public cached JSON carries ms dates and full-precision returns (`app/u/[handle]/pane/route.ts:22`, `:26`; `lib/feed.ts:197-198`). With a flat fee that recovers size, which consent calls private (`lib/copy.ts:79`). | Round to what the screen prints (1-decimal percent), or show by probe that 4 decimals defeats fee-based size recovery. Covers every public payload, including open `unrealized_pct`, `openAsOf`, pane-chart, feed HTML and series (LG). Stats, ranks and CIs compute on stored values (LG). Same-day closes keep their order and a chart scrub hits the right trade (test). The pane headline equals the profile headline (parity test). |
| L-20 | 4 | A faint disclaimer or a loss colour too close to gain misleads viewers. A permanent CI contrast floor is the cheapest guard. | Earlier conditions verbatim; the floor is never lowered. The test covers disclaimer text, gain/loss/flat tones, the Demo badge, Verified and image text. No visible value changes beyond the fixes. Starts after PR #55 and fixes #12/#13/#26; lapse clause. |
| C3-9a | 4 | A sell posted more than 7 days late is never read (`lib/sync.ts:378-379`, `:37`), a silent omission under Verified that mis-matches every later sell. | Insert-only, no row updated in place (LG). A rebuild that changes or removes a shown close is logged per user, so a re-priced shared card is traceable. Within F-14's read budget; if F-14 is unmerged it waits with F-14. Fake-vendor e2e with a 10-day-late sell. Shares the ledger slot with C3-2. |
| C3-37 | 3 | Little to abuse, but measurement fields tend to grow into per-viewer tracking. No slot of its own (F-15 amendment). | LG verbatim: at most a first-seen day and a returned-after-day-7 day per account, dates only, never public, deleted with the account. It never lengthens session-row life (`lib/privacy-purge.ts:52`). No further field without the privacy committee. MRC2-3 definitions untouched. |
| C3-34 | 4 | Catches a stalled sync that would otherwise leave records stale while they read as live. The 401 path logs nothing (`app/api/sync/route.ts:34-36`). | Public body ok/degraded only. Times and hours only behind the cron bearer (with 3 users, "stalest sync" describes one person). `no-store`. A test greps the body for ids, handles and figures. The 401 line has no token, prefix or IP (LG) and is rate-limited or aggregated (one line per minute with a count) so it can't flood the logs. |
| C3-39/40 | 4 | Fixes a confusing primary button to a locked page (`app/account/page.tsx:61`, `app/tools/page.tsx:69-78`) and an over-weighted Delete. No gaming surface. | No price, date, "coming soon", waitlist or email capture; LIVE_BILLING and checkout untouched (LG). "Delete my profile…" stays on /settings, visible at 360 px without expanding, one tap to the unchanged view 2 (no deletion dark pattern). F-3 open-state e2e unchanged. The decision lists the amended F-1 plan `:75-77` and F-3 plan `:142` lines; business lead signs off. |

## 7. Round 5: red team's case and final vote

### Instructions

#### Round 5: final vote

Second vote: `r4-table.md`; every member's conditions: `r4-*.md`. Shortlist (second-vote mean >= 3.5):
C3-17 (4.13), C3-2 (4.07), L-16 (4.07), L-17 (3.93), C3-36 (3.67), L-20 (3.67), C3-9a (3.60).
Not approvable this cycle (below 3.5): C3-37 3.47, C3-34 3.40, C3-39/40 3.40.
Red team's case against each: `r5-red-team-case.md` (read it first).

Build slots (engineer, round 4): ledger = C3-2 + C3-9a (after F-14 merges); pane/payload = C3-17 + C3-36 (after
F3-2); trust and safety = L-16 + L-17 (after `claude/fix-user-text-safety` merges with F-9's criteria met on main);
L-20 alone (after PR #55 and fixes #12, #13, #26). C3-2 is conditional on the owner's yes (it amends
`lib/trades.ts:52` and the corporate-actions committee's rule). Every item not startable now is approved as
`Status: blocked` with a lapse clause.

Vote on each of the 7: **A** (approve), **AC** (approve with conditions; list them, they become acceptance criteria)
or **R** (reject), with a one-line reason. Decisions keeper, legal and common sense: say explicitly for each item
"veto: none" or "veto: <ground>", and name the conditions whose removal would trigger your veto ("veto condition").

Write `r5-<slug>.md`. Reply EXACTLY:
VOTES: C3-17=A|AC|R, C3-2=.., L-16=.., L-17=.., C3-36=.., L-20=.., C3-9a=..
then one line per item "ID: reason | conditions" (and "| veto: ..." for DK, LG, CS).

### Red team's case against each shortlisted item

#### Round 5, step 1: the red team's case against the shortlist

Base f467293, read only. For each item: the strongest way it misleads, leaks, gets gamed, fails or lapses again, and
the condition that would answer it. The point is not to stop these items. The point is to make sure the answering
conditions survive into the acceptance criteria.

##### C3-17: exclusion counts beside the headline (4.13)
- **Misleads both ways.** A bare "3 trades excluded" next to a headline reads as an accusation (a trader with honest
  pre-history gaps looks like a cheat), or it is read as nothing at all. If the pane's sum and the profile's sum differ
  (e.g. the profile omits `notShared`, `lib/sync.ts:99`, while the pane counts it), the two disagree and the record
  looks tampered with.
- **Gamed.** A trader can push the count from one surface to another but not lower it. If only some kinds are summed, a
  trader routes exclusions into the kind left out.
- **Fails.** The extra line pushes the F3 disclaimer below the fold at 360 px, which is a POLICY breach.
- **Answer:** one shared function for every surface, with an equality test; every exclusion kind in it, `notShared`
  included or named; neutral copy that links to the reasons; a disclaimer-in-view e2e at 360 px. Blocked on F3-2: if
  F3-2 slips, it lapses with it.

##### C3-2: transfers as share moves (4.07)
- **Misleads.** "Oldest first" on a move out assigns a basis the trader chose at the broker (specific-lot transfers).
  The lots left behind are then published with a wrong return under Verified. That is the same class of harm the
  council rejected C3-3 for.
- **Gamed.** A trader can still move losers out before closing. The count says "moved", not "moved at a loss", so a
  serial mover looks clean. A 1-unit move in followed by selling one extra unit still excludes the whole sell
  (`lib/trades.ts:208-210`). Moving between two of the trader's own connected accounts could make a position vanish
  on one side and be tainted on the other.
- **Fails.** It amends `lib/trades.ts:52` and the corporate-actions committee rule, so without the owner's yes it cannot
  merge, and the ledger slot sits idle.
- **Answer:** the DK basis veto as a hard acceptance criterion (with a test where the lots have different bases); a
  transfer-out count that is never 0, shown through C3-17; a property test that a TRANSFER never improves a shown
  average; an explicit own-accounts test; owner flag recorded before the build.

##### L-16: F-16 trust-and-safety slice + K18 (4.07)
- **Gamed.** Reports are a weapon. Rivals mass-report a strong record. A "may be under 18" report (K18) cannot be
  checked by the reporter and is sympathetic to act on, so it is the most weaponisable path. A hidden record during
  a hot streak is a competitive win for whoever filed the report.
- **Leaks.** An owner digest or audit log that names reporters to the reported trader, or keeps report text with
  personal data longer than needed.
- **Lapses.** The prerequisite sits on `claude/fix-user-text-safety` with no open PR. This is the second time this
  item depends on an unmerged branch.
- **Answer:** no hide on a single report of any kind; owner review before any hide; signed-in, rate-limited reporters
  (per reporter and per target); repeat unfounded reporters flagged to the owner; reporter identity never shown to
  the reported trader or exported; neutral hidden state; one reports table; a dated lapse clause tied to that
  branch's merge.

##### L-17: handle and name integrity (3.93)
- **Gamed.** A normaliser that misses one class of characters (mixed-script confusables, zero-width, bidi overrides,
  full-width forms) is a working impersonation kit. Two normalisers that disagree are worse: the check passes on one
  path and the display renders on the other.
- **Fails.** A rename that frees the old handle at once lets an impersonator take over every forwarded link and cached
  card (trust-safety). A rename that does not bump image/cache keys keeps the old name on cards (reliability).
- **Leaks / policy.** A reserved list that names real people or brands breaks POLICY.
- **Lapses.** Same unmerged branch as L-16.
- **Answer:** exactly one normaliser, with a caller-import test; a confusables test set covering those classes; the old
  handle held for a period after a rename (redirect, not reuse); cache keys bumped on rename; generic reserved terms
  only; lapse clause.

##### C3-36: round public payloads (3.67)
- **Still leaks.** Four decimals of fraction (0.01%) is one digit finer than the screen's 1-decimal percent
  (`lib/format.ts:56-58`). On a small position a flat fee is visible at the 4th decimal, so size stays recoverable.
  Holding days to 1 decimal plus day-level dates still pins the close time to about 2.4 h.
- **Incomplete.** The pane route also sends `unrealized_pct` and `openAsOf` in ms (`app/u/[handle]/pane/route.ts`),
  which the brief doesn't name. Old full-precision payloads stay in public caches (`max-age=60` is short, but CDNs and
  scrapers keep copies).
- **Fails.** Rounding before ranking or stats changes ranks and CIs. Rounding dates to days can reorder same-day closes
  so a chart scrub lands on the wrong trade (UX lead).
- **Answer:** round to the printed precision, or show a probe that the chosen precision defeats fee-based recovery;
  every public field covered; compute on stored values; order-preserving tie-break and scrub test; pane-profile
  parity test.

##### L-20: design tokens and contrast test (3.67)
- **Fails silently.** A contrast test that checks only body text pairs misses the places that mislead: the disclaimer,
  gain/loss/flat tones under colour-vision deficiency, the Demo/Verified badges, and text drawn into share images.
  Tokens make it easy to change one value app-wide, so a later token edit could quietly fade the disclaimer
  everywhere at once.
- **Gamed (by process).** A floor written as a constant in the test can be lowered in the same PR that fails it.
- **Lapses.** It depends on PR #55 and fixes #12/#13/#26, none merged. This is its second lapse risk.
- **Answer:** the test enumerates those pairs, images included; the floor lives in a protected file (or the invariants
  test) so it cannot be lowered with the change that breaks it; no visible value changes beyond the fixes; lapse
  clause.

##### C3-9a: late-sell reconciliation (3.60)
- **Misleads after the fact.** Inserting an old sell re-matches FIFO for every later sell. A close that was shown and
  shared (cards, links, screenshots) changes its return or disappears with no trace on the record. That is a quiet
  rewrite of a Verified history, the kind of thing TR-1 viewers are told doesn't happen.
- **Fails / costs.** A weekly full-history read per account hits the vendor limits that F-14 is meant to govern, and
  F-14 is unmerged, so this either waits or bypasses the budget. A vendor that returns a corrected row under a new id
  produces a duplicate sell, so the "reconciled" record double-counts.
- **Answer:** insert-only; every rebuild that changes or removes a shown close is logged per user, with a count line
  the owner can later expose; dedupe test for a re-issued row (same account, symbol, time, units, price) treated as
  the same trade; inside F-14's budget, or waits with F-14; fake-vendor e2e with a sell posted 10 days late.

### Round 5: Business lead

#### Round 5, business lead (final vote)

| Item | Vote | Reason | Conditions |
|---|---|---|---|
| C3-17 | AC | Cheap visible proof that nothing is hidden, on the surfaces where records are read (G3/G4). | One shared exclusion-sum function for every surface, with an equality test (pane = strip = profile). Every exclusion kind included, `notShared` (`lib/sync.ts:99`) included or named. Neutral muted copy that links to the profile's reasons, no warning colour or icon. A disclaimer-in-view e2e at 360 px. No second feed-card line (D22). Share card unchanged until owner Q4. `Status: blocked` until F3-2 merges, with a lapse clause; sequenced after the ledger slot. |
| C3-2 | AC | Routine broker moves currently erase or exclude real records. Fixing that is the core credibility promise for G1-G3. | Owner's yes recorded before the build (amends `lib/trades.ts:52` and the corporate-actions committee rule). DK basis veto as a hard AC, with a test where the lots have different bases: oldest-first only where it cannot change a basis, otherwise lots stay tainted. Moved-in lots stay tainted and counted; unknown kinds keep the taint. Every move out counted in `excluded_transferred_out`, shown when n > 0 and through C3-17. Property test: a TRANSFER never improves a shown average. Own-accounts transfer test. Neutral line naming no cause. Ships with F3-15's copy. Ledger slot, blocked on F-14 with a lapse clause. |
| L-16 | AC | Report, hide and takedown are U2/U3 launch prerequisites before shared links bring traffic, and the prerequisite is built. | Every F-16 condition and LG veto line word for word, plus a dated re-approval. No hide on a single report of any kind; owner review before any hide. Reporters signed in and rate-limited per reporter and per target; repeat unfounded reporters flagged to the owner. Reporter identity never shown to the reported trader or exported. Neutral hidden state; one reports table. K18 addition: no DOB, ID or age estimation; owner reviews and owner runs any deletion. `Status: blocked` until `claude/fix-user-text-safety` merges with F-9's criteria met on main (dated lapse clause). |
| L-17 | AC | Impersonation through look-alike or freed handles breaks the share loop (G2/G3). | Every F-17 condition word for word. Exactly one normaliser, with a caller-import test (reuse `checkDisplayName`; DK logs it). A confusables test set covering mixed-script, zero-width, bidi and full-width. The old handle held after a rename (redirect, never reuse). Share image/cache keys bumped on rename. Generic reserved terms only, no real names or brands. Lapse clause on the same branch merging. |
| C3-36 | AC | Keeps the percent-only promise traders connect on. Small, with no visible change. | Round to the printed precision (`lib/format.ts:56-58`), or a probe in the PR showing the chosen precision defeats fee-based size recovery. Every public field covered, including `unrealized_pct`, `openAsOf`, cached payloads and feed HTML. Stats, ranks and CIs computed on stored values. An order-preserving tie-break and a chart-scrub test for same-day closes. A pane-profile parity test. Pane slot with C3-17, after F3-2. |
| L-20 | AC | A cheap permanent guard that a loss never reads as a gain and the disclaimer never fades. | Cycle-2 conditions word for word. The test enumerates the disclaimer, gain/loss/flat under colour-vision deficiency, the Demo/Verified badges and text in share images. Floors (4.5:1, 3:1, ΔE00 >= 9) live where the same PR cannot lower them (invariants test or protected file). No visible value change beyond the fixes. Lapse clause on PR #55 and fixes #12/#13/#26. |
| C3-9a | AC | A silently missing late sell reads as cherry-picking once a trader notices it. | Insert-only; `activities` never updated in place (C3-9b stays owner Q3). Inside F-14's read budget, waiting with F-14 (lapse clause). Every rebuild that changes or removes a shown close is logged per user, with a count the owner can later expose. Dedupe test for a re-issued row. Fake-vendor e2e with a sell posted 10 days late. A late close never suggests the trader edited anything. Ledger slot with C3-2. |

Note to the chair (not a vote): C3-37 missed the second-vote cut at 3.47. It is the only item that makes the binding G4
gate readable at week 8. Recommend telling the owner, and folding it into F-15's own rework under F-15's existing
approval if the owner agrees (the owner's call, not this council's).

### Round 5: Market research lead

#### Round 5, market research lead: final vote

| Item | Vote | Reason | Conditions (acceptance criteria) |
|---|---|---|---|
| C3-17 | AC | Viewers read records on the pane and strip. Counts that live only on the profile don't support "no per-trade hiding, exclusions listed". | One shared sum function for every surface, with an equality test (profile = pane = strip). Every exclusion kind included, `notShared` too (`lib/sync.ts:99`, and the `:121-127` read fixed). One muted, neutral line only when n > 0, as a real link to the reasons; no warning colour. F3 disclaimer stays in view at 360 px (e2e). Share card unchanged until owner Q4. Blocked on F3-2, with a lapse clause. |
| C3-2 | AC | Moving a losing position out is a loss-hiding route any trader can use at will, and it erases our only positioning against the broker-native "pick which trades to post" feed. | Owner's yes recorded before the build, listing `lib/trades.ts:52` and the committee's "exclude and count" as amended. DK basis rule as a hard criterion: oldest first only where it cannot change a basis, otherwise the remaining lots stay tainted and counted (test with lots of different bases). Moved-in lots stay tainted. Unknown kinds keep the taint. The transferred-out count is shown (via C3-17) and its line is neutral. Property test: a TRANSFER never improves a shown average. Own-accounts move test. Taint tests updated, never deleted. Ledger slot. |
| L-16 | AC | Linkable Verified records are scam bait (`market-2026-11-01-cycle2.md:468`), and report and takedown are pre-launch (U2/U3). | All cycle-2 F-16 and legal veto conditions verbatim. No hide on a single report of any kind; owner reviews before any hide. Reporters are signed in and rate-limited per reporter and per target; repeat unfounded reporters are flagged to the owner. Reporter identity is never shown to the reported trader or exported. Neutral hidden state. One reports table. K18: no DOB, ID or age estimation, and the owner runs any deletion. An "impersonating this trader elsewhere" category. Status blocked until `claude/fix-user-text-safety` merges with F-9's criteria met (lapse clause). |
| L-17 | AC | Look-alike handles are how real records get impersonated (MRC2-6). | Exactly one normaliser (`checkDisplayName`), with a caller-import test. Confusables test set: mixed-script, zero-width, bidi, full-width. After a rename the old handle is held and redirects for a set period, never reused at once. Rename bumps share/image cache keys. Reserved list is generic terms only (no real people or brands). Blocked on the same branch, with a lapse clause. |
| C3-36 | AC | Percent-only is the promise traders connect on, so position size must not be recoverable from public JSON. | Round to the printed precision (`lib/format.ts:56-58`), or show a fee-recovery probe proving the chosen precision defeats it. Every public field covered, `unrealized_pct` and `openAsOf` included. Stats, ranks and CIs computed on stored values. Same-day closes keep their order (tie-break and scrub test). Pane-profile parity test. Pane/payload slot, after F3-2. |
| L-20 | AC | A cheap permanent legibility guard for a low-numeracy audience. Approve, but only to start once its prerequisites land. | The test enumerates disclaimer, gain/loss/flat tones under colour-vision deficiency, badges, and text in share images. The floor lives in a protected file or the invariants test, so it can't be lowered in the PR that fails it. No visible value change beyond the fixes. Blocked on PR #55 and fixes #12/#13/#26, with a lapse clause. |
| C3-9a | AC | A late-posted sell is never read (`lib/sync.ts:378`), so a Verified record silently misses a loss (kill risk #2). | Insert-only. Every rebuild that changes or removes a shown close is logged per user, with a count the owner can expose later. Dedupe test: a re-issued row (same account, symbol, time, units, price) is treated as the same trade. Inside F-14's read budget, built after F-14 merges (lapse clause). Fake-vendor e2e with a sell 10 days late. Revisions table stays with the owner (Q3). |

### Round 5: Pricing and finance

#### Round 5: pricing-finance, final vote

Lens: build cost against value, plus vendor and infra cost. Every condition below costs no new vendor, dependency or
paid service. Items that can't start now are approved as `Status: blocked` with a dated lapse clause, so the approval
doesn't cost a fresh council round when its prerequisite merges.

| Item | Vote | Reason | Conditions |
|---|---|---|---|
| C3-17 | AC | Small, no runtime cost; makes every exclusion route visible where records are read. | One shared exclusion-sum function for every surface, with an equality test against the profile. Every exclusion kind is in it, `notShared` (`lib/sync.ts:99`) included. Neutral copy that links to the reasons. The F3 disclaimer stays in view at 360 px (e2e). No feed-card line (D22). Card waits on owner Q4. Blocked on F3-2, lapse clause. |
| C3-2 | AC | Closes a loss-hiding route any trader can trigger at will on a Verified record; S-M, no running cost. | Owner yes recorded before the build, naming the amended rules (`lib/trades.ts:52`; the corporate-actions committee's "exclude and count"). DK basis veto as a hard criterion, with a test where the lots have different bases. Moved-in lots stay tainted. Transfer-out count shown via C3-17. Property test: a TRANSFER never improves a shown average. Own-accounts move test. Ledger slot with C3-9a. |
| L-16 | AC | Launch-path gate (U2/U3), and its prerequisite is built. | Every cycle-2 decision and veto condition word for word, plus K18 under legal's vetoes (no DOB, ID or age estimation; owner runs any deletion). No hide on any single report; owner review before any hide. Reporters signed in and rate-limited per reporter and per target. Repeat unfounded reporters flagged to the owner. Reporter identity never shown or exported. One reports table. Starts after `claude/fix-user-text-safety` merges with F-9's criteria met on main; dated lapse clause. |
| L-17 | AC | Launch-path gate (reserved handles); mostly wiring on existing `checkDisplayName`. | Exactly one normaliser, with a caller-import test. Confusables test set (mixed script, zero-width, bidi, full-width). Old handle held after a rename, never reissued (cycle-2 hold rule). Image and cache keys bumped on rename. Generic reserved terms only. Same branch prerequisite; lapse clause. |
| C3-36 | AC | Small, and it closes a size-recovery leak before real users. Worth it only if the rounding actually defeats recovery. | Round to the printed precision, or show a probe that the chosen precision defeats fee-based size recovery. Every public field covered (`unrealized_pct`, `openAsOf` included). Stats and ranks computed on stored values. Order-preserving tie-break and scrub test. Pane-profile parity test. Pane slot with C3-17. |
| L-20 | AC | Cheap, permanent A1 guard; the lapse risk is the main cost. | Cycle-2 conditions word for word. Pairs enumerated: disclaimer, gain/loss/flat under colour-vision deficiency, badges, share-image colours. The floor sits where the change that breaks it can't lower it (invariants test or a protected file; the owner decides any protected-path edit). No visible value changes beyond the fixes. Lapse clause on PR #55 and fixes #12, #13, #26. |
| C3-9a | AC | Fixes silently missed late sells. The vendor bills per user, not per call, so there is no fee impact; vendor rate limits are the real constraint. | Insert-only (`lib/sync.ts:37` unchanged). Runs inside F-14's read budget, or waits with F-14. Dedupe test for a re-issued row. Every rebuild that changes or removes a shown close is logged per user, with a count. Fake-vendor e2e with a sell posted 10 days late. C3-9b stays an owner flag (Q3). |

### Round 5: Growth

#### Round 5, growth (final vote)

| Item | Vote | Reason | Conditions |
|---|---|---|---|
| C3-17 | AC | With C3-3 rejected, oversells stay excluded, and the pane is where swipe viewers read a record. A visible count there keeps anchors' shared records credible. | One shared sum function for every surface, with an equality test against the profile; every exclusion kind included, `notShared` (`lib/sync.ts:99`, `:121-127`) included or named. Neutral copy, no warning colour, a real link to the reasons. Disclaimer-in-view e2e at 360 px. n > 0 only. Share card unchanged until owner Q4. Blocked on F3-2 with a lapse clause; after the ledger slot. |
| C3-2 | AC | A loss that vanishes on transfer is the first thing a critic finds on a shared link (`lib/trades.ts:52`). | Owner's yes recorded before the build (amends `lib/trades.ts:52` and the corporate-actions committee rule). DK basis veto as a hard AC, tested with different-basis lots. Moved-in lots and unknown kinds stay tainted. `excluded_transferred_out` count with a neutral line (no wrongdoing, no claim about elsewhere), shown through C3-17. Property test: a TRANSFER never improves a shown average. Test for moves between the trader's own connected accounts. Ledger slot. |
| L-16 | AC | The report action is a named week-0 go-to-market prerequisite (`docs/IDEAS.md:120`). | Every F-16 cycle-2 veto condition verbatim, plus K18 with legal's conditions. No hide on any single report; owner review before any hide; the owner runs any deletion. Signed-in reporters, rate-limited per reporter and per target; repeat unfounded reporters flagged to the owner. Reporter identity never shown to the reported trader or exported. Neutral hidden state. One reports table. No DOB, ID or age estimation. Lapse clause tied to `claude/fix-user-text-safety` merging with F-9's criteria met. |
| L-17 | AC | Reserved handles and name clearance are week-0 prerequisites, and impersonation on forwarded links breaks outreach. | Cycle-2 conditions verbatim. Exactly one normaliser, with a caller-import test. A confusables test set (mixed script, zero-width, bidi, full-width). The old handle is held after a rename (redirect, not reuse), and cache and image keys are bumped. Generic, own-product reserved terms only. Lapse clause tied to the same branch. |
| C3-36 | AC | It keeps the percent-only promise traders connect on, with no visible change. | Round to the printed precision, or show a probe that the chosen precision defeats fee-based size recovery. Every public field covered, including `unrealized_pct`, `openAsOf` and the feed HTML. Stats, ranks and CIs on stored values. Order-preserving tie-break and scrub test. Pane-profile parity test. |
| L-20 | AC | A cheap permanent accessibility guard. Shared links open on phones in both schemes. | The test enumerates the disclaimer, gain/loss/flat under colour-vision deficiency, Demo/Verified badges and text in share images. The floor lives in a protected file or the invariants test. No visible value changes beyond the fixes. Lapse clause on PR #55 and fixes #12, #13, #26. |
| C3-9a | AC | A missed late row means the first shared records are wrong with no count (`lib/sync.ts:378-379`). | Insert-only (`:37` intact). Inside F-14's budget, or waits with F-14. Every rebuild that changes or removes a shown close is logged per user, with a count the owner can later expose. Dedupe test for a re-issued row. Fake-vendor e2e with a sell posted 10 days late. No "corrected" copy implying a trader edit. Ledger slot. |

### Round 5: UX lead

#### Round 5, UX lead: final vote

| Item | Vote | Reason | Conditions (acceptance criteria) |
|---|---|---|---|
| C3-17 | AC | Signed-out viewers reach the pane through SW-1, and it shows the headline with no sign of exclusions (`p1-360-pane.png`). | Every surface uses one shared exclusion-sum function, with an equality test against the profile. It covers every kind, `notShared` included or named. One muted line, only when n > 0, under the stats row. The line is a real link to the profile's count reasons, never bare "(see profile)" text. Copy is neutral, with no warning colour or icon. Tap target ≥ 44 px. No second line on feed cards (D22). Share card unchanged until Q4. An e2e at 360 px, signed out, checks that the disclaimer stays in view (red team). Blocked on F3-2, with a lapse clause. |
| C3-2 | AC | Today a transfer can drop a real loss with no line (`lib/corporate-actions.ts:200`, `lib/trades.ts:171`). | The owner's yes is recorded before the build (amends `lib/trades.ts:52` and the committee rule). The DK basis veto is a hard criterion, tested with lots of different bases. Moved-in units are excluded and counted. Unknown kinds keep the taint. A property test shows a TRANSFER never improves a shown average. A test covers moves between the trader's own accounts. Every probe ends as a shown trade or a named count. The transferred-out line is one plain, no-blame sentence in the existing count block, and it is shown through C3-17. Ships with F3-15's copy. |
| L-16 | AC | A profile report and a takedown page are U2/U3 launch prerequisites, and F-9 is built (unmerged). | Every cycle-2 condition and K18's legal veto conditions, word for word. No hide on a single report of any kind; the owner reviews before any hide. Reporters are signed in and rate-limited per reporter and per target. Repeat unfounded reporters are flagged to the owner. Reporter identity is never shown to the reported trader or exported. The hidden state is neutral, with no "review" wording. One reports table. The report control is secondary, never next to Follow or Share, ≥ 44 px. Starts only after `claude/fix-user-text-safety` merges with F-9's criteria met on main, and lapses otherwise. |
| L-17 | AC | Today a display name can say "Verified", and reserved handles are a U2 prerequisite. | Every cycle-2 condition. Exactly one normaliser (`checkDisplayName`), with a caller-import test. A confusables test set covers mixed script, zero-width, bidi and full-width characters. The old handle is held after a rename and never reused at once. A rename bumps share-image and cache keys. The reserved list holds generic terms only. Rejection messages are visible beside the field at 360 px, announced, and in plain words. Lapse clause tied to the same branch. |
| C3-36 | AC | It closes the gap between what consent calls private and what the JSON carries, with no visible change. | Round to the printed precision, or include a probe showing the chosen precision defeats fee-based size recovery (red team). Every public field is covered, including the pane's `unrealized_pct` and `openAsOf`. Stats, ranks and CIs compute from stored values. A snapshot shows no displayed figure changes at 360 px. Same-day closes get an order-preserving tie-break, and a scrub test shows the scrub opens the right trade. Pane-profile parity test. |
| L-20 | AC | It is the only lasting guard on readability at 360 px in both colour schemes. | Cycle-2 conditions. The pairs tested include the disclaimer, gain/loss/flat tones under colour-vision deficiency, the Demo and Verified badges, focus ring ≥ 3:1, and share-image text. The floor sits where it can't be lowered in the PR that breaks it (owner or invariants decide where; the Doctor may not touch it). No visible value changes beyond the fixes. Conditional on PR #55 and fixes #12, #13, #26 merging, with a lapse clause. |
| C3-9a | AC | A sell posted late can be silently missing from a Verified record (`lib/sync.ts:378`). | Insert-only, never updating a raw row. It runs inside F-14's budget or waits with F-14. Each rebuild that changes or removes a shown close is logged per user, with a count the owner can expose later, and no "corrected" wording that implies the trader acted. A dedupe test treats a re-issued row as the same trade. A reconciled trade appears in date order with no "new" flag. A fake-vendor e2e posts a sell 10 days late. |

### Round 5: Product designer

#### Round 5: product designer (final vote)

| Item | Vote | Reason | Conditions (acceptance criteria) |
|---|---|---|---|
| C3-17 | AC | It puts the exclusion count where the headline is actually read (the SW-1 pane), not only far down the profile (`app/u/[handle]/page.tsx:281-289`). | One shared exclusion-sum function for profile, pane and strip, with an equality test. Every exclusion kind is in it, `notShared` (`lib/sync.ts:99`) included or named by the owner as not counted. One line in the `muted` token under the pane headline and above CH-1, never in loss or warn colour. Neutral wording that is a real link to the profile's `#excluded` reasons, named with the count, never an accusation. Not on feed cards (D22). Card and images unchanged until Q4. e2e at 360 px signed out: D20's disclaimer stays in view on the pane. Blocked on F3-2 and built after the ledger slot, with a lapse clause. |
| C3-2 | AC | A transfer today hides a real loss or gives it a false reason on a Verified record, and a viewer can't see either one (TR-1). | Owner's yes recorded before the build (it amends `lib/trades.ts:52` and the committee rule). DK's basis condition is a hard criterion, tested with lots of different bases: oldest first only where it cannot change a basis; otherwise the remaining lots stay tainted and counted, and moved-in lots stay tainted. A property test shows a TRANSFER never improves a shown average. A test covers moves between the trader's own connected accounts. Each transfer out is a named count shown through the C3-17 line and the profile's single exclusion block (one muted block under `#excluded`). `VERIFIED_DEFINITION` and /how change in the same PR. |
| L-16 | AC | The neutral hidden state is good design, and report and takedown are launch prerequisites (U2/U3). | Earlier decisions and veto conditions word for word. K18 with legal's conditions (no DOB, ID or age estimation; the owner runs any deletion). No hide on any number of reports; the owner reviews before any hide. Signed-in reporters, rate limited per reporter and per target. Repeat unfounded reporters flagged to the owner. Reporter identity never shown to the reported trader or exported. One reports table. The hidden state is "not available right now", never "reported" or "review". The report action is a quiet menu item, not a control on the record. Blocked until `claude/fix-user-text-safety` merges with F-9's criteria met on main (dated lapse clause). |
| L-17 | AC | Today a display name can fake the one trust mark (check glyphs, "Verified"), which breaks settled conflict 1. | Earlier decisions word for word. Exactly one normaliser (`checkDisplayName`/F-9's), with a test that every caller imports it. A confusables test set covering mixed script, zero-width, bidi overrides and full-width forms. The old handle is held per F-17 and keeps F-17's neutral 404 "no longer in use" page. The red team's "redirect" is not adopted: F-17 decided no 301 (CS veto condition). Image and cache keys change on rename. Reserved list holds generic words only. Lapse clause tied to that branch's merge. |
| C3-36 | AC | The public payload should carry no more than the screens show. Today the pane ships ms epochs and full-precision returns (`app/u/[handle]/pane/route.ts:22`). | Covers every public field, including `unrealized_pct` and `openAsOf`. Stats and ranks compute on stored values server-side. Precision is the printed precision, or a probe shows the chosen precision defeats fee-based size recovery. If the pane computes its headline from the payload, the server sends the headline instead, so a parity test (pane headline = profile headline, double-rounding edge included) holds. The same UTC day prints on profile and pane. Same-day closes keep a stable order by id, with a chart-scrub test. |
| L-20 | AC | It is the design system's backbone (§5), the only lasting guard against contrast and colour-blind regressions. | Cycle-2 conditions word for word (no visible value change beyond the fixes; no image colour change, O-2 stays the owner's). The test enumerates the disclaimer, gain/loss/flat under protan/deutan/tritan (ΔE00 ≥ 9), the Verified and Demo badges, the focus ring and share-image text colours. The floor lives where the change that fails it can't lower it (an invariants-protected location, owner to place). Lands first in `app/globals.css`. Lapse clause on PR #55 and fixes #12/#13/#26. |
| C3-9a | AC | A late-posted sell that is never read (`lib/sync.ts:378`) is a silent TR-1 gap, and the insert-only fix keeps the owner's immutability rule. | Insert-only. Built inside F-14's read budget, after F-14 merges. Every rebuild that changes or removes an already shown close is logged per user, with a count the owner can later expose: no silent rewrite. A dedupe test treats a re-issued row (same account, symbol, time, units, price) as the same trade. Fake-vendor e2e with a sell posted 10 days late. A found close appears in date order with no "late" or "new" styling. "updated" stays the last successful vendor read. |

### Round 5: Data-visualization designer

#### Round 5, dataviz (final vote)

| Item | Vote | Reason | Conditions (acceptance criteria) |
|---|---|---|---|
| C3-17 | AC | Without it, the headline, range and chart a viewer actually reads omit exclusions that appear only on the profile. | One sum function for profile, pane and strip, with an equality test; every exclusion kind in it (`notShared`, paper, future, corporate, positions, C3-2's transferred-out), or the omitted kind named. One muted line only when n > 0, linked to the reasons. Neutral text, no warning colour or icon, unit worded truthfully ("excluded from these figures"). Disclaimer stays in view at 360 px (e2e, signed out). Feed card stays one line (D22); share card unchanged until Q4. Blocked on F3-2, with a lapse clause. |
| C3-2 | AC | Turns a vanished loss or a whole tainted pair into a shown trade or a named count. | Owner's yes recorded before the build (amends `lib/trades.ts:52` and the committee rule). DK basis veto as a hard criterion: "oldest first" only where it cannot change a basis; otherwise the remaining lots stay tainted and counted; tested with lots on different bases. Moved-in lots stay tainted. Property test: a TRANSFER never improves a shown average and never changes a sell whose drawn lots predate it. An own-accounts transfer test. The transferred-out count shows through C3-17. The line is neutral. |
| L-16 | AC | Outside my lens; the shape is sound and every earlier condition is kept. | Cycle-2 and K18 conditions word for word. No hide on a single report of any kind; owner review before any hide. Signed-in reporters, rate-limited per reporter and per target. Reporter identity never shown or exported. Neutral hidden state. One reports table. Starts after `claude/fix-user-text-safety` merges with F-9's criteria met on main; lapse clause. |
| L-17 | AC | Outside my lens; an impersonated handle undermines every figure on a shared card. | Exactly one normaliser, with a caller-import test. Confusables test set (mixed-script, zero-width, bidi, full-width). Old handle held after a rename (redirect, not reuse). Share-image and URL cache keys bumped on rename. Generic reserved terms only. Lapse clause on the branch merge. |
| C3-36 | AC | Public payloads should carry no more precision than the screen. I accept the red team's point that 0.01% is one digit finer than the printed 0.1%. | Round returns to the printed precision, or a probe showing the chosen precision defeats fee-based size recovery. Cover every public field (`unrealized_pct`, `openAsOf`, `closedAt`, the feed series). Stats, ranges, `confidence()` and ranks computed server-side from stored values. Order-preserving tie-break for same-day closes, with a chart-scrub test. Pane-profile headline parity test. Snapshot test that no printed figure, tone or Flat changes. |
| L-20 | AC | The lasting guard that gain, loss, flat and the badges stay distinguishable, images included. | Cycle-2 conditions word for word. The test enumerates the disclaimer, gain/loss/flat tones under protan, deutan and tritan (ΔE00 ≥ 9), the Demo/Verified badges, and share-image text, from one image colour table. The floor lives where the PR that fails it cannot lower it (an invariants-style pin). No visible value changes beyond the fixes. Lapse clause on PR #55 and fixes #12/#13/#26. |
| C3-9a | AC | Closes a silent hole where a real loss never reaches a Verified record. | Insert-only; raw rows never updated. Rebuild only through `rebuildTrades`. Every rebuild that changes or removes a previously shown close is logged per user, with a count line the owner can expose (no silent rewrite of a shown figure). Dedupe test for a re-issued row. Within F-14's read budget and after F-14 merges; lapse clause. Fake-vendor e2e with a sell posted 10 days late. |

### Round 5: Accessibility specialist

#### Round 5: a11y final vote

| Item | Vote | Reason | Conditions |
|---|---|---|---|
| C3-17 | AC | Puts the exclusion fact in text where the headline is read; `--muted` passes AA in both schemes. | One shared sum function for all surfaces, with a profile-vs-pane equality test (every kind, `notShared` included or named; red team). Neutral copy. "see profile" is a real link with a descriptive name. The line sits right after the headline in DOM order, is not tooltip-only and reflows at 320 px. A disclaimer-in-view e2e at 360 px. Pane and strip only, never a second feed-card line. Blocked on F3-2, with a lapse clause. |
| C3-2 | AC | Closes a loss-hiding route that leaves no text any reader can notice. | The owner's yes is recorded before the build. The DK basis veto is a hard criterion, with a test where the lots have different bases. A property test shows a TRANSFER never improves a shown average. An own-accounts test. The transferred-out line is plain text in `--muted` in the counts block, with no colour- or icon-only cue, reads at 320 px and is counted through C3-17's function. |
| L-16 | AC | Its form decisions already meet AA (F-16:55-57, acceptance criterion :97). | Earlier decisions and vetoes kept verbatim. Red team's anti-weaponisation set: no hide on a single report, owner review before any hide, signed-in reporters rate-limited per reporter and per target, reporter identity never shown or exported. K18 is a labelled control in the same form (no DOB, ID or age estimation). The hidden state is neutral text, not colour alone. The takedown page has an h1 and a footer link. Lapse clause tied to `claude/fix-user-text-safety` merging. |
| L-17 | AC | Bidi, zero-width and confusable characters corrupt what screen readers announce and enable impersonation. | Exactly one normaliser, with a caller-import test. The confusables test set covers mixed-script, zero-width, bidi-override and full-width characters. The old handle is held after a rename, not reused at once. Cache keys are bumped on rename. Reserved terms are generic only. Rejection messages name the field and the rule in text, with `role=alert` and focus on the field. Lapse clause. |
| C3-36 | AC | Privacy value; neutral for assistive tech once parity holds. | Round to the printed precision, or show that the chosen precision defeats fee recovery (red team). Cover every public field (`unrealized_pct`, `openAsOf`). Compute on stored values. An order-preserving tie-break and a scrub test. Visible text and accessible names match the payload's rounding. |
| L-20 | AC | Core A1: the only lasting guard against measured failures (Verified 3.77:1, gain/loss ΔE00 2.8 under deutan). | Earlier conditions kept word for word. Floors are never lowered (4.5:1; 3:1 for large text, UI and focus ring; ΔE00 ≥ 9 under protan, deutan and tritan). The floors sit somewhere the failing change cannot lower them, such as the invariants test or a protected file (red team; the owner decides protected paths). The pair list names the disclaimer, gain/loss/flat, the Demo and Verified badges, the focus ring and the share-image colour table. No visible change beyond the fixes. PR #55 and fixes #12, #13, #26 merge first. Lapse clause. |
| C3-9a | AC | No accessibility effect; it repairs a record-correctness gap. | Insert-only. Every rebuild that changes or removes a shown close is logged per user. A dedupe test for a re-issued row. Stays inside F-14's budget or waits for F-14. A fake-vendor e2e for a sell posted 10 days late. Any future count line is text. |

### Round 5: Engineer

#### Round 5, engineer (final vote)

| Item | Vote | Reason | Conditions (acceptance criteria) |
|---|---|---|---|
| C3-17 | AC | S. The counts already exist (`db/schema.sql:34`, `:319`, `:657`), and it is the backstop for every exclusion route. | Build in F3-2's lane after it (blocked, with a lapse clause). One exported sum function used by the profile, pane, trade and month pages, with an equality test. Every exclusion kind included; `notShared` gets a real sell counter computed in rebuild, or is named as left out. Neutral copy that links to the profile's reasons. Never on feed cards (D22). Images unchanged until Q4. e2e at 360 px, signed out, with the disclaimer still in view. |
| C3-2 | AC | Small diff (`lib/corporate-actions.ts:200-205` reason tag; `lib/trades.ts:171`). It closes a loss-hiding route any trader can trigger at will. | Owner's yes recorded before the build, listing `lib/trades.ts:52` and the committee rules as amended. Oldest-first removal only when the whole position moves or every candidate lot has the same `price` and `feePerUnit`, otherwise taint; a test with lots of different bases. A moved-in lot is tainted. Unknown kinds keep the taint. A `transferred_out` count shown through C3-17's function. Property test: a TRANSFER never improves a shown average, and never changes a sell whose drawn lots predate it. A test for a move between two of the trader's own connected accounts. Taint tests updated, never deleted. Ledger slot, after the fixes branch (F3-1, F3-5) and truthful-labels. |
| L-16 | AC | F-9's reports module is built on `claude/fix-user-text-safety`, so F-16 extends it. | `Status: blocked` until that branch merges with F-9's criteria met on main; a lapse clause tied to that merge. One reports table, extending F-9's module. No hide on any single report, K18 included. Owner review before any hide. Signed-in reporters, rate-limited per reporter and per target. Repeat unfounded reporters flagged to the owner. Reporter identity never shown to the reported trader and never exported. Neutral hidden state. All cycle-2 decisions word for word. K18 only after report and hide exist, with no date of birth, ID or age estimation. |
| L-17 | AC | `checkDisplayName` exists on the same branch (`lib/handles.ts`). The open gap is renames versus caches. | Rework on that branch after it merges (blocked, with a lapse clause). Exactly one normaliser, with a test that every caller imports it. A confusables test set covering mixed script, zero-width, bidi overrides and full-width forms. After a rename the old handle is held (redirect, never reused) for the decided period. Image and `og:image` cache keys bumped on rename, with a test that no card is served under a freed handle. Generic reserved terms only, no real names or brands. A hold never blocks deletion. |
| C3-36 | AC | S. It closes a public precision leak (`app/u/[handle]/pane/route.ts:22`, `lib/feed.ts:197-198`) with no visible change. | Round to the printed precision (`lib/format.ts`), unless a fictional probe shows the chosen precision defeats fee-based size recovery. Every public field covered, including `unrealized_pct` and `openAsOf` on `/pane`, plus `/pane-chart` and feed props. Rounding only at serialisation; stats, ranks and CIs computed on stored values. An order-preserving tie-break sent before rounding, with a scrub test on same-day closes. A pane-to-profile headline parity test. Pane slot with C3-17. |
| L-20 | AC | The contrast test it waits for is already written in PR #55. The token layer is value-neutral. | `Status: blocked` until #55 and fixes #12, #13, #26 merge; a lapse clause. The test enumerates the disclaimer, gain/loss/flat under colour-vision deficiency, the Demo and Verified badges, and colours drawn into share images. The floor constant lives where the change that breaks it cannot also lower it (flag to the owner: `scripts/invariants.test.ts` is protected). A computed-style snapshot shows no visible value change beyond the fixes. Lands before F-18. |
| C3-9a | AC | Insert-only via `fetchActivitiesPage` (`lib/broker.ts:96`); no edit to a protected file. It closes a silent TR-1 hole at `lib/sync.ts:378-379`. | Waits for F-14 (blocked, with a lapse clause). Inside F-14's per-account gate and request budget, with pages bounded per run and resumed by offset. No raw row is updated or deleted. Every rebuild that changes or removes a shown close is logged per user and counted, with no figures in logs. A row under a new id that matches an existing row's account, symbol, time, units and price is counted as a possible duplicate for owner review, never silently merged and never silently published twice (two real identical fills can exist). Fake-vendor e2e: a sell posted 10 days late appears. Ledger slot with C3-2. |

### Round 5: Reliability engineer

#### Round 5: reliability (final vote)

| Item | Vote | Reason | Conditions |
|---|---|---|---|
| C3-17 | AC | Exclusions must travel with the headline; today #52's `notShared` exclusion (`lib/sync.ts:99`) is counted nowhere. | One shared sum function for every surface, with an equality test (pane = strip = profile). Every exclusion kind is summed, `notShared` included or named. The line is neutral copy linking to the reasons. An e2e at 360 px keeps the disclaimer in view. Before or with it: the rename-chain read `lib/sync.ts:121-127` gets the `notShared` filter, with a behavioural test (a marked account in a rename chain contributes 0 closes). Card unchanged until owner Q4. Blocked on F3-2 with a lapse clause. |
| C3-2 | AC | Closes a trader-triggered loss-hiding route; safe only under the basis rule. | Owner's yes recorded before the build (amends `lib/trades.ts:52` and the committee rule). DK basis veto as a hard AC, with a test where the candidate lots have different bases (the remaining lots stay tainted and counted). Moved-in lots are always tainted. Property tests: a TRANSFER never changes a sell drawn from earlier lots that did not move, and never improves a shown average. A test moves a position between two of the trader's own connected accounts. Transfer-out count shown through C3-17's sum. Two rebuilds give byte-identical `closed_trades`. Unknown kinds keep the taint. |
| L-16 | AC | The visible-user-predicate test on every `closed_trades` read is a strong integrity guard, and a profile hide survives rebuild. | Earlier conditions and K18's legal veto conditions word for word. Red team's answers: no hide on a single report of any kind; owner review before any hide; signed-in reporters, rate-limited per reporter and per target; reporter identity never shown to the reported trader or exported; one reports table. The hide covers the rename-chain path, images and sitemaps (test). The audit row is written in the same transaction as the hide or unhide. Lapse clause tied to the merge of `claude/fix-user-text-safety`. |
| L-17 | AC | A launch prerequisite. The reliability risk is drift between two normalisers and stale handle-keyed caches. | Exactly one normaliser (`lib/handles.ts`), with a test that every caller imports it. A confusables test set (mixed-script, zero-width, bidi, full-width). The old handle redirects for a held period and is never reused. A rename bumps every handle-keyed cache, image and share key (test). Generic reserved terms only. Opens as rework after the F-9 branch merges (lapse clause). |
| C3-36 | AC | S, and only payloads change. Red team showed 4 decimals is still finer than the screen. | Round each public field to its printed precision (`lib/format.ts:56-58`), or attach a probe showing the chosen precision defeats fee-based size recovery. Every public field covered, including the pane's unrealized percent and `openAsOf`. Rounding only at serialisation; stats, ranks and CIs computed on stored values. An order-preserving tie-break for same-day closes, with a chart-scrub test. A pane-profile headline parity test. |
| L-20 | AC | Outside my lens. A guard against silent regressions is worth having. | The test enumerates disclaimer, gain/loss/flat (CVD), badge and share-image pairs. The floor sits where the change that breaks it cannot lower it (the invariants test or a protected file). No visible value changes beyond the fixes. Lapse clause on PR #55 and fixes #12/#13/#26. |
| C3-9a | AC | Plain data loss today: the read starts at the newest stored activity minus 7 days (`lib/sync.ts:379`). Insert-only keeps immutability. | Insert-only, BUY and SELL, paged. Built after F-14, inside its per-account read limit and `syncCost`. Skips disconnected and paper accounts. Late rows pass `latePosted`. A rebuild that changes or removes an already-shown close is logged per user as a count (numbers only), for the owner to expose later. Possible re-issued duplicates are never dropped on attributes alone, since two genuine identical fills exist. Only when the original id is absent from the vendor's current full read is the pair treated as one, and each such case is counted (test both ways). Fake-vendor e2e: a sell posted 10 days late appears, and a second run inserts 0. Any `lib/broker.ts` edit waits for the owner's merge. |

### Round 5: Legal and compliance

#### Round 5: legal and compliance, final vote

Findings, not legal advice (`docs/POLICY.md:18-24`). A **veto condition** is one whose removal from the built scope
makes the item break POLICY; I would then veto at review. I give no veto on any item as conditioned.

| Item | Vote | Reason | Conditions (veto conditions marked VC) | Veto |
|---|---|---|---|---|
| C3-17 | AC | It puts exclusions where records are read, which guards against implied completeness (F3a `:117-119`) and cherry-picking (F4 `:131-132`). | VC1: the F3 disclaimer stays in view at 360 px (e2e, signed out). VC2: one shared sum function for pane, strip and profile, with an equality test, covering every exclusion kind including #52's `notShared` (`lib/sync.ts:99`), so no kind is excluded uncounted (F3c `:128-130`). VC3: share card and images unchanged until owner Q4. Neutral wording ("excluded", no accusation, no warning colour) that links to the reasons. Blocked on F3-2, with a lapse clause. | veto: none |
| C3-2 | AC | Today a full transfer out leaves no trade, no count and no line (F3 `:114-116`, F4). The red team is right that "oldest first" can be a basis the trader chose; DK's basis rule answers that. | Needs the owner's yes before merge, recorded as amending `lib/trades.ts:52` and the committee's "when in doubt, exclude and count". VC1: "oldest first" only where it cannot change a basis (vendor names the lots, the whole position moves, or all candidate lots share a per-unit basis); otherwise the remaining lots stay tainted, with a test using lots of different bases. VC2: moved-in lots and unknown kinds stay tainted. VC3: every transfer out is counted and shown through C3-17 when n > 0. Property test: a TRANSFER never changes a sell whose drawn lots predate it and were not moved. A test for moves between the trader's own connected accounts. /how calls FIFO the record's method, not the broker's. Taint tests updated, never deleted. Starts after F-14, with a lapse clause. | veto: none (veto if VC1-VC3 are dropped: F3c) |
| L-16 | AC | Profile reports and a takedown process are POLICY launch prerequisites (U2/U3 `:145-149`, `:58`). | VC1: every F-16 "veto condition: LG" line stays verbatim. In particular, no hide on any single report (`F-16:20-22`), only the owner hides, a hide never deletes, the reporter's identity is never shown to the reported trader or exported (also in any C3-42 export), and audit rows hold no thesis text. VC2 (K18): no date of birth, ID, face or voice processing or age estimation; no automatic deletion (H `:179`); no minors' cohort words (P4 `:51-53`). Rate limits per reporter and per target; repeat unfounded reporters flagged to the owner; under-18 reports first in the digest. The age-assurance method stays the owner's (`:232`). `Status: blocked` until `claude/fix-user-text-safety` merges with F-9's criteria met, with one reports table and a dated lapse clause. | veto: none |
| L-17 | AC | Reserved handles are a U2 launch prerequisite (`:146`). Names that say "Verified" or carry check glyphs imply identity checks, which F3a forbids. | VC1: F-17's legal lines stay verbatim. No third-party, brand or person name in the list, tests or fixtures (T1/T2). A hold stores only the handle and a date, lasts at most a year and never blocks deletion (P6). No personal data in rejection logs. VC2: display names refuse "Verified", "Official", check and seal glyphs, and bidi controls. Exactly one normaliser (the reviewed one from the F-9 branch), with a caller-import test and a confusables set (mixed-script, zero-width, bidi, full-width). A rename bumps image and cache keys. Keep F-17's decided neutral 404 for the old handle, not a redirect: the red team's "redirect" would amend a decided line. Blocked with a lapse clause on the same branch. | veto: none |
| C3-36 | AC | Consent calls prices private (`lib/copy.ts:79`), but public payloads carry finer data (`app/u/[handle]/pane/route.ts:22,26`; `lib/feed.ts:197-198`). This is the P3 minimisation gap (`:48-50`). | VC1: every public field is covered, including `unrealized_pct` and `openAsOf` on the pane, the feed series, pages and images, and caches are re-keyed. VC2: stats, ranks and CIs are computed on stored values, with rounding only at the output. Round to the precision the screen prints, unless a fictional probe shows the chosen precision defeats fee-based size recovery (the red team's point on 4 decimals). Order-preserving tie-break and a scrub test; a pane-profile parity test; no displayed figure changes. Blocked on F3-2. | veto: none |
| L-20 | AC | A lasting A1 control (`:153-155`). The red team's gaps are about coverage, and conditions close them. | VC1: floors of 4.5:1 text, 3:1 UI and focus, and ΔE00 ≥ 9 for gain against loss are never lowered. The pairs tested include the disclaimer, the Demo and Verified badges, the Flat tone and the share-image text table. A floor change needs the owner's review: the floor lives in a CODEOWNERS path, or a ratchet test fails on any decrease. The council asks for this but does not edit the protected files. VC2: no hosted fonts or assets, no brand-matched colours (T3). No visible change beyond the fixes. Blocked on PR #55 and fixes #12, #13, #26, with a lapse clause. | veto: none |
| C3-9a | AC | A late-posted sell is never read (`lib/sync.ts:378`), so a Verified record silently misses a close (F4; pre-launch accuracy `:234-235`). The insert-only fix leaves `CLAUDE.md:62` intact. | VC1: insert only, never update or delete a raw row. VC2: never runs for a disconnected or frozen account. VC3: no silent rewrite. Each rebuild that changes or removes a shown close is logged per user (ids and kind, no prices or payload) and counted, so a later "corrected" line is possible (TR-1 `DESIGN.md:324`; COMPLIANCE `:163`). A dedupe test treats a re-issued row (same account, symbol, time, units, price) as one trade. Runs inside F-14's read budget, after F-14 merges. A fake-vendor e2e with a sell posted 10 days late. No raw payloads in logs (P6 `:58-59`). `lib/broker.ts` edits go through the owner's merge. | veto: none |

### Round 5: Trust and safety

#### Round 5: trust and safety, final vote

| Item | Vote | Reason | Conditions (acceptance criteria) |
|---|---|---|---|
| C3-17 | AC | Counting is the backstop for every exclusion route, and with C3-3 dropped it is the only containment for oversells. | (1) One shared sum function for profile, pane and strip. Every exclusion kind is included, `notShared` (`lib/sync.ts:99`) among them, with an equality test across surfaces and a test that fails when a new exclusion kind is added outside the function. (2) Neutral copy ("excluded", never "hidden" or "removed by the trader"), no warning colour. The line links to the profile's reasons. (3) The trader has no setting to suppress it. (4) e2e at 360 px: the F3 disclaimer stays in view. (5) Share card unchanged until owner Q4. (6) Status blocked on F3-2, with a lapse clause. |
| C3-2 | AC | This is the one loss-hiding route any trader can trigger at will (`lib/corporate-actions.ts:200`, `lib/trades.ts:171`). The red team's conditions make it safe. | (1) Owner's yes recorded before the build; it amends `lib/trades.ts:52` and the corporate-actions committee rule. (2) DK's basis rule is a hard criterion: "oldest first" on a move out only when the vendor names the lots, the whole position moves, or every candidate lot has the same basis. Otherwise the remaining lots stay tainted and counted. Test with lots of different bases where a specific-lot move would flatter the record. (3) Every transfer out adds to `excluded_transferred_out` and is shown through C3-17. (4) Property test: inserting a TRANSFER never improves a shown average or win rate. (5) Own-accounts test: a move between two of the trader's connected accounts never makes a position vanish from both. (6) Moved-in lots stay tainted, and unknown kinds keep the taint. (7) Existing taint tests are updated, never deleted. Neutral copy. Ledger slot. |
| L-16 | AC | The pre-launch trust-and-safety floor (U2/U3), and its prerequisite is built. Report weaponisation is answered by its existing no-auto-hide design. | (1) Every F-16 decision and veto condition verbatim. (2) No hide on any number of reports of any kind; the owner reviews before any hide. Hides are owner-run, audited and reversible, never on a single trade. (3) Reporters are signed in, rate-limited per reporter and per target, one report per reporter per target. Repeat unfounded reporters are counted for the owner. (4) Reporter identity is never shown to the reported trader, never exported (including in C3-42 later) and never in the digest body sent anywhere. (5) K18 as a dated addition with legal's conditions: no DOB, ID or age estimation; owner review; the owner runs any deletion; a single report never hides. (6) One reports table. (7) A hide also stops share images and cached responses. (8) Starts only once `claude/fix-user-text-safety` merges with F-9's criteria met on main, with a dated lapse clause tied to that merge. |
| L-17 | AC | Today a rename frees the old handle at once, so an impersonator can take over forwarded links and cards. Reserved handles are a U2 prerequisite. | (1) Every F-17 decision verbatim, including the neutral 404 on the old path: hold, never redirect and never reuse. The red team's "redirect" wording is overridden by F-17's decided "no 301". (2) Exactly one normaliser, `checkDisplayName` on the F-9 branch, with a caller-import test and a test that fails on a second confusables map. (3) A confusables test set covering mixed-script, zero-width, bidi overrides and full-width forms. (4) A rename changes the share-image and cache keys, so the old card never shows under a new holder. (5) Generic and own-product reserved words only, with no third-party or person name. (6) Built as rework after that branch merges, with a lapse clause. |
| C3-36 | AC | Inferred position size makes wealthy traders targets for scams and doxxing (`app/u/[handle]/pane/route.ts:22,26`). The red team shows 4 decimals may not be enough. | (1) Round to the printed precision, or include a fictional probe in the PR showing that the chosen precision defeats fee-based size recovery. (2) Every public field, including `unrealized_pct` and `openAsOf`, and the feed HTML, series, pages and images. Cache keys rotated. (3) Stats, ranks and CIs compute on stored values. (4) Same-day order is preserved by a tie-break, with a scrub test. (5) Pane and profile parity test. |
| L-20 | AC | It keeps the disclaimer, Demo badge and gain/loss tones readable. That supports honest presentation, and a token edit could otherwise fade them app-wide. | (1) Cycle-2 conditions verbatim; no visible value changes beyond the fixes. (2) The test lists the disclaimer, Demo and Verified badges, gain/loss/flat tones (ΔE00 floor under CVD) and the text drawn into share images. (3) The floors live where the PR that breaks them can't lower them (invariants test or a protected file). (4) Blocked on PR #55 and fixes #12, #13 and #26, with a lapse clause. |
| C3-9a | AC | A sell posted more than 7 days late is never read (`lib/sync.ts:378`), so a loss can silently never appear. The red team's re-match concern needs a visible trace. | (1) Insert-only; raw rows are never updated or deleted, and results come through `rebuildTrades`. (2) Any rebuild that changes or removes a previously shown close is logged per user, with a count the owner can expose. A shown close never changes silently. (3) A re-issued row that matches an existing one (same account, symbol, time, units, price) is counted and held for review, not silently merged and not double-counted. Two real identical trades must not be lost either (test both). (4) Stays inside F-14's read budget; it waits with F-14. (5) Never runs for a disconnected account. (6) Fake-vendor e2e with a sell 10 days late. |

### Round 5: Decisions keeper

#### Round 5, decisions keeper (final vote)

Every condition below becomes an acceptance criterion. "Veto condition" means the ones whose removal makes the item
contradict a decided rule, which I would veto. Citations are at f467293.

| Item | Vote | Reason | Conditions | Veto |
|---|---|---|---|---|
| C3-17 | AC | It makes "excluded and counted" (`CLAUDE.md:95`) visible where records are read, and conflicts with no decided rule once reshaped. | **Veto conditions:** (1) No second line on feed cards (D22 `docs/IDEAS.md:148`, `F-10:12-18`). (2) Share card and the F-12 images unchanged until owner Q4. (3) D24 and idea-16 strip wording unchanged (`IDEAS.md:157-160`, `:175-180`). **Others:** one shared sum function for every surface, with an equality test against the profile; every exclusion kind summed, with `notShared` (`lib/sync.ts:99`) either included on both surfaces or named; neutral wording that links to the profile's reasons; a disclaimer-in-view e2e at 360 px; lapses with F3-2. | veto: none |
| C3-2 | AC | It restores TR-1 (`docs/DESIGN.md:324`) and "never dropped silently" (`lib/trades.ts:41`) against a route any trader can trigger. | **Veto conditions:** (1) Conditional on the owner's yes, recorded before the build. The approval lists `lib/trades.ts:52` and `logs/corporate-actions/committee-2026-11-01.md:44-45`, `:57-58` as amended. (2) The basis rule: "oldest first" only where the vendor names the lots, the whole position moves, or every candidate lot has the same per-unit basis; otherwise the lots stay tainted (`CLAUDE.md:95`). Tested with lots of different bases. (3) The moved-in lot stays tainted (`:143-144`). Unknown kinds keep the taint. (4) Existing tests updated, never deleted. **Others:** a transfer-out count shown through C3-17; a property test that a TRANSFER never improves a shown average; a test for moves between two of the trader's own connected accounts; `Status: blocked` until the owner answers. | veto: none (veto if condition 1 or 2 is dropped) |
| L-16 | AC | A re-approval on decided terms (`F-16:16-65`). K18 fits F-16's "reports never hide on their own" (`F-16:20-21`). | **Veto conditions:** (1) Every earlier F-16 decision word for word, plus one dated re-approval line. (2) No hide on any report, whatever the count, including a "may be under 18" report. Only the owner-run script hides, after owner review. It never hides a single trade, never deletes, and is audited (`F-16:20-29`). Any deletion under K18 is the owner's (P4 `docs/POLICY.md:51-53`; `team/approval-council.md:49`). (3) One reports table (`F-16:77`). (4) No date of birth, ID or age estimation. **Others:** rate limits per reporter and per target; repeat unfounded reporters flagged to the owner; reporter identity never shown to the reported trader or exported; F-9's acceptance criteria met on main before the start; a dated lapse clause tied to the merge of `claude/fix-user-text-safety`. | veto: none |
| L-17 | AC | It builds POLICY U2's reserved-handle prerequisite on decided terms. | **Veto conditions:** (1) Earlier F-17 decisions word for word. (2) Nothing deleted (`F-17:46`), and a hold never blocks profile deletion (`F-17:62`). (3) Generic and own-product reserved terms only. No real people or brands (T1). Retiring handles forever (O-9) stays the owner's. **Others:** exactly one normaliser, built on the branch's `checkDisplayName`, with a caller-import test; a confusables test set (mixed script, zero-width, bidi, full-width); the old handle held and redirected after a rename for no more than one year (TR-5); image and cache keys bumped on rename; a lapse clause. | veto: none |
| C3-36 | AC | No decided rule touched. It brings payloads in line with consent (`lib/copy.ts:79`) and P3. | **Veto conditions:** (1) Stats, CIs and ranking compute on stored values; rounding happens at output only (F3c; CLAUDE.md headline rules). (2) Same-day closes keep a stable order, and scrub still lands on the right trade (`docs/DECISIONS.md:65-73`). **Others:** every public field covered, including `unrealized_pct` and `openAsOf`; precision equal to what is printed, or a probe showing the chosen precision defeats fee-based recovery; a pane-profile parity test; no visible figure changes. | veto: none |
| L-20 | AC | A value-neutral foundation that touches no owner rule. | **Veto conditions:** (1) Earlier F-20 decisions word for word. (2) The floor is never lowered (`F-20:30`). (3) No image colour change; O-2 stays the owner's (`F-20:33`). **Others:** pairs enumerated, covering the disclaimer, gain/loss/flat under colour-vision deficiency, the Demo and Verified badges, and text drawn into images; a lapse clause. The red team's "floor in a protected file" means touching `scripts/invariants.test.ts`, which is a guardrail the council may not change (`team/approval-council.md:49-51`). It goes to the owner as a request, not a criterion. Record that F-18 (dropped) waits, so F-20 holds its own slot. | veto: none |
| C3-9a | AC | Insert-only keeps "raw, immutable" (`CLAUDE.md:62`). Rebuilding derived trades is the decided mechanism (`CLAUDE.md:63-66`). | **Veto conditions:** (1) Never updates or deletes a raw row. Revisions (C3-9b) stay the owner's (Q3). (2) A suspected re-issued row under a new id is never silently merged or dropped. Identity stays `unique(source, external_id)` (`CLAUDE.md:62`). A suspected duplicate is excluded and counted, never guessed (`CLAUDE.md:95`). (3) Within F-14's once-a-day activities read (`F-14:13-15`), or it waits for F-14. `lib/broker.ts` edits wait for the owner's merge. **Others:** a per-user log and count of every rebuild that changes or removes a shown close, which the owner may later expose; a fake-vendor e2e with a sell posted 10 days late; a lapse clause. | veto: none |

Not approvable this cycle (below 3.5): C3-37, C3-34, C3-39/40. They carry forward to the next cycle with the reasons
from rounds 3-4.

### Round 5: Common sense

#### Round 5, common sense (final vote)

Lens: is it confusing, dishonest or out of proportion as conditioned? The red team's case is right on every item. The
answers below are the conditions without which a reasonable viewer or trader would be misled. Those are my veto
conditions.

| Item | Vote | Reason | Conditions | Veto |
|---|---|---|---|---|
| C3-17 | AC | Counts shown only on the profile are invisible where records are read. Shown wrongly, they would be worse than nothing (an accusation, or two surfaces that disagree). | (1) **One shared function** for every surface's exclusion sum, with an equality test across profile and pane. (2) Every exclusion kind is in it: `notShared` (`lib/sync.ts:99`) is either included with its own profile line or named as not an exclusion. (3) Neutral copy that links to the reasons; no warning colour or icon. (4) The disclaimer stays in view at 360 px (e2e). (5) Nothing on feed cards (D22); the share card waits for Q4. (6) Blocked on F3-2 with a lapse clause. | veto: none. Veto condition: (1), (2), (3). Surfaces that disagree, or accusing copy, would be confusing and dishonest. |
| C3-2 | AC | A transfer today erases or relabels a real loss. As conditioned, every outcome is shown or counted and no basis is guessed. | (1) The owner's yes, recorded before the build (amends `lib/trades.ts:52` and the committee rule). (2) **DK basis rule as a hard AC**: oldest first only where it cannot change a basis (the vendor names the lots, the whole position moves, or all candidate lots share a basis); otherwise the remaining lots stay tainted and counted; moved-in lots stay tainted. Includes a test with lots of different bases. (3) Every transfer outcome is a shown trade or a named count; the transferred-out count shows through C3-17 when > 0. (4) Property test: inserting a TRANSFER never improves a shown average or removes an earlier shown close. (5) A test for moves between two of the trader's own connected accounts: nothing vanishes on either side. (6) Neutral line, no claim about what happened elsewhere. | veto: none. Veto condition: (2), (3), (4). Without them it publishes a guessed return under Verified or lets a loss leave silently. |
| L-16 | AC | Report and takedown are launch prerequisites; F-9 is built. As conditioned, reports cannot be used as a weapon. | (1) Starts only once `claude/fix-user-text-safety` merges with F-9's criteria met on main; dated lapse clause. (2) Every cycle-2 decision and veto condition word for word: no hide on reports alone, whatever the count; only the owner-run audited hide; neutral hidden state that never says "reported" or "review". (3) K18: a single report of any kind never hides an adult's record; owner review; the owner runs any deletion; no DOB, ID or age estimation. (4) Signed-in reporters, rate limited per reporter and per target; repeat unfounded reporters flagged to the owner. (5) Reporter identity never shown to the reported trader or exported. (6) One reports table. | veto: none. Veto condition: (2), (3), (5). A report-driven auto-hide, or a public "under review" mark, would let a false report brand an innocent trader. |
| L-17 | AC | A look-alike handle on a forwarded link misleads the exact viewer the product courts. | (1) Opens as rework on top of the merged F-9 branch; lapse clause. (2) **Exactly one normaliser** (`checkDisplayName` / F-9's), with a test that every caller imports it. (3) A confusables test set: mixed-script, zero-width, bidi overrides, full-width. (4) The old handle is held after a rename and never reissued while held; the old path shows the neutral 404 page (cycle-2 decision: no 301 machinery, no link to the new handle). (5) Share image and cache keys change on rename. (6) Generic reserved terms only, no third-party or person names. (7) Cycle-2 conditions word for word. | veto: none. Veto condition: (2), (4). Two normalisers, or a freed handle that lands a link on a stranger, would be confusing. A 301 to the new handle would break the cycle-2 CS veto. |
| C3-36 | AC | Closes a privacy gap with no visible change, but only if it actually rounds to what the screens show. | (1) Public precision no finer than any screen prints, unless a probe shows the chosen precision defeats fee-based size recovery. (2) Every public field covered, including `unrealized_pct` and `openAsOf` on the pane route and the feed HTML. (3) Stats, ranks and confidence intervals compute on stored values. (4) Order-preserving tie-break; same-day closes keep their order; scrub test. (5) Pane-profile parity test: no displayed figure changes. | veto: none. Veto condition: (3), (5). Rounding that changes a shown rank or figure would be dishonest. |
| L-20 | AC | Cheapest lasting guard that a loss never reads as a gain and that the disclaimer stays legible. | (1) Starts after PR #55 and fixes #12, #13, #26 merge; lands before F-18; lapse clause. (2) The test enumerates the pairs that mislead when they fail: disclaimer, gain/loss/flat under colour-vision deficiency, Demo/Verified badges, share-image text. (3) The floors live where the change that breaks them cannot lower them (invariants or a protected file; that placement is the owner's, since those files are protected). (4) No visible value change beyond the fixes; base and accent unchanged. | veto: none. Veto condition: (2). A test that skips the disclaimer and the gain/loss pair would claim a guard it doesn't provide. |
| C3-9a | AC | A Verified record silently missing a late close is dishonest. But filling the gap must not become a silent rewrite of what was already shown. | (1) Insert-only; never update or delete a raw row. (2) **Any rebuild that changes or removes a shown close is logged per user and counted**, with a count line the owner can expose, so no shared close changes without a trace. (3) A re-issued row (same account, symbol, time, units and price, new id) is flagged and counted, never silently merged and never double-published. (4) Reads inside F-14's per-account budget; waits for F-14; the `lib/broker.ts` edit waits for the owner's merge. (5) Fake-vendor e2e with a sell posted 10 days late. (6) Theses stay attached by `sell_id`. | veto: none. Veto condition: (2), (3). Without them a Verified history changes quietly or double-counts. |

### Round 5: Red team

#### Round 5, red team: final vote

All seven are AC. The conditions answer the red-team case in `r5-red-team-case.md`. Without them, each item can mislead,
leak or be gamed.

| Item | Vote | Reason | Conditions (acceptance criteria) |
|---|---|---|---|
| C3-17 | AC | Makes every exclusion route visible where records are read; today counts are profile-only (`app/u/[handle]/page.tsx:289-292`). | One shared sum for profile, pane and strip, with an equality test. Every exclusion kind is included, and `notShared` (`lib/sync.ts:99`) is counted or named. Neutral copy that links to the reasons, no warning colour. Disclaimer in view at 360 px (e2e). Share card unchanged until owner Q4. Blocked on F3-2, with a lapse clause. |
| C3-2 | AC | Closes a cheap, trader-triggered way to hide a loss (`lib/trades.ts:168-174`, `:171`). Owner-conditional: it amends `:52` and the committee rule. | DK basis veto as a hard criterion: oldest first only where it cannot change a basis, otherwise the remaining lots stay tainted and counted, with a different-basis test. Moved-in lots are tainted and unknown kinds keep the taint. The transfer-out count is never 0 (probes, including between two of the user's own connected accounts), and it shows on the pane via C3-17. A property test shows a TRANSFER never improves a shown average. Neutral copy, no cause stated. Owner yes recorded before the build. |
| L-16 | AC | Report and takedown are pre-launch (U2/U3); a linkable Verified record without them is scam bait. | Every F-16 LG line verbatim. No hide on a single report of any kind (K18 included). Owner review before any hide. Reporters are signed in and rate-limited per reporter and per target. Repeat unfounded reporters are flagged to the owner. Reporter identity is never shown to the reported trader or exported. Neutral hidden state with no age or "under review" wording. No DOB, ID or age estimation. The owner runs any deletion. One reports table. Starts only after `claude/fix-user-text-safety` merges with F-9's criteria met; lapse clause. |
| L-17 | AC | Look-alike handles and names borrow another trader's Verified record. | Exactly one normaliser, with a caller-import test. A confusables test set covering mixed scripts, zero-width and bidi characters, and full-width/case folds. After a rename the old handle is held and redirected, not freed. Image and cache keys are bumped on rename. Reserved terms are generic only, with no real people or brands. A hold never blocks deletion. Lapse clause tied to the same branch. |
| C3-36 | AC | Public cached payloads carry precision that recovers size (`app/u/[handle]/pane/route.ts:22`, `:26`; `lib/feed.ts:197-198`). | Round to the printed precision, or prove by probe that the chosen precision defeats fee-based size recovery. Every public field is covered: closes, `unrealized_pct`, `openAsOf`, pane-chart, feed HTML and series. Stats, ranks and CIs compute on stored values. Same-day order is preserved and the chart scrub hits the right trade (test). Pane-profile headline parity test. Blocked on F3-2. |
| L-20 | AC | A faint disclaimer or a gain/loss pair too close in colour misleads viewers; a CI contrast floor is the cheapest permanent guard. | Earlier conditions verbatim. The test lists the disclaimer, gain/loss/flat tones (including under colour-vision deficiency), Demo/Verified badges and image text. The floor sits in a protected or invariants file, so it can't be lowered in the PR that breaks it. No visible changes beyond the fixes. After PR #55 and fixes #12/#13/#26; lapse clause. |
| C3-9a | AC | A late-posted sell is silently never read (`lib/sync.ts:378-379`, `:37`), which mis-matches every later sell. | Insert-only. Every rebuild that changes or removes a shown close is logged per user, with a count the owner can expose later. A dedupe test covers a vendor-re-issued row. Within F-14's read budget; waits with F-14. Fake-vendor e2e with a sell posted 10 days late. |
