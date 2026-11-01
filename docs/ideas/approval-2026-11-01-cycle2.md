# Approval council, cycle 2: 2026-11-01

The approval council (`team/approval-council.md`) met for its second cycle on 2026-11-01, started by the owner's
orchestrating session under the owner's delegation (POLICY H; owner decision 2026-11-01). Fifteen members voted, each
a separate agent with fresh context, in parallel within each round. The chair ran the rounds and counted the votes and
did not vote. Cap: six features per cycle; features that touch the same files count as one build slot. Base:
`origin/main` 31004e7 for the rounds; the record was rebased onto eb83430 after #40 (corporate actions) and #48 (design
system doc) merged. Line numbers in the fixes list are on 31004e7; #40 shifted some lines in `lib/trades.ts` and
`app/u/[handle]/page.tsx`.

## Result

| Rank | Candidate | Second-vote mean | Final vote | Outcome |
|---|---|---|---|---|
| 1 | K3 Privacy-safe measurement foundation, first slice (C17, MRC2-1, BC-7) | 4.13 | 15/15 | **Approved: F-15** |
| 2 | K45 Trust-and-safety slice: profile report, owner digest, audited hide, takedown page (BC-2, BC-17, MRC2-6) | 3.93 | 15/15 | **Approved: F-16** |
| 3 | K2 Handle and name integrity (C9 trimmed, BC-2 reserved handles and rename hold, DS-31) | 3.80 | 15/15 | **Approved: F-17** |
| 4 | K7 One trust language (C10, DS-5, 7, 8, 9, 18, 20, 24) | 3.80 | 14/15 | **Approved: F-18** |
| 5 | K8 Number format and ranges, lib slice first (C5, DS-10..13, DS-25, MRC2-5) | 3.73 | 15/15 | **Approved: F-19** |
| 6 | K9 Design tokens and the contrast CI test (C14, DS-1..4, DS-26, DS-27) | 3.67 | 15/15 | **Approved: F-20** |

No veto applied to any approved item as conditioned. The decisions keeper, legal and common sense named the
conditions whose removal would trigger their veto; the feature files mark them "(veto condition: …)". The business
lead rejected K7 (no effect on the week-8 gates; its slot would idle until F-10..F-13 merge); that dissent is recorded
in F-18.

**Slots: five of six.** F-15, F-16 and F-17 take one each. F-20 and F-18 share one (both edit `app/globals.css`;
F-20 lands first). F-19's `lib/` slice takes one; its call-site sweep rides in the F-20 → F-18 lane after F-18. The
sixth slot is left unused on purpose: the waiting items below did not reach 3.5, and the cap is a ceiling, not a target.

**Start now vs wait.** Only F-15 (after fix #28) and F-19's `lib/` slice can start today. F-16 waits for F-9 and fix
#4; F-17 for #42; F-20 for fixes #12, #13, #26 and the F-13 contrast-test branch; F-18 for F-10..F-13, fixes #1, #2,
#8, #9 and #10 (as voted), and F-20. **Lapse rule (attached by most members):** an approval whose prerequisite has not
merged by the next approval council lapses to that council.

Numbering: F-15 to F-20 by rank. Fix numbers below refer to this cycle's fixes list (not cycle 1's).

**Chair's notes on placing conditions in the feature files.** Every condition an approving member attached is an
acceptance criterion; duplicates were merged and the strictest kept. Where ballots disagreed: (1) F-19's "What's this?"
line: 13 members put its placement after F-18, two in the first slice, so the constant and its test land in the
first slice and it goes onto the stats row after F-18. (2) Conditions that only applied to K18 (an under-18 report
category that hides at once, DK and LG) are left out of F-16 because K18 did not pass. (3) F-15 has no single
prerequisite, so its lapse rule reads "if not started by the next council". (4) Common sense's round-0 timing for F-20
(after F-10..F-13's `app/globals.css` edits) is placed as merge timing. (5) F-19's first slice may start now, so only
its sweep can lapse.

## Process

- **Round 0 (consistency check).** The chair drafted 22 briefs (K1-K22) from the cycle-1 waiting list and the new
  sources: the market research council cycle 2 (MRC2-1..13), the business council (BC-1..18) and the design system
  council (#48: DS-1..34, DSP-1..8, V-1..V-3, O-1..O-18). In-flight work was excluded (#40, #42, #46, #48, F-7,
  F-9..F-14, options, known-limits sweep, token governor, process docs). The decisions keeper, legal and common sense
  checked every brief. **K6** (open-positions gate) went to the owner on the decisions keeper's veto. **K1** (disclaimer
  guard) and **K10** (layout and reflow) went to the fixes list. K12-K14 merged into one variant-test candidate **KV**;
  K4 and K5 merged into **K45**; K18 and K22 were reshaped. Ballot: 16 items.
- **Round 1 (first vote).** All 15 members scored all 16 items 0-5.
- **Round 3 (debate).** The five highest and five lowest round-1 scorers on each item stated their strongest argument
  (ties broken by member order for high and reverse order for low; no member on both sides). The chair adopted the
  narrowing reshapes the arguments converged on (K3 first slice, K45 sequencing and neutral hidden state, K8 lib slice
  first, K9 extending F-13's test, K18 via K45, K7 pins, K19 without profiles) and every member then changed scores
  only for a stated reason.
- **Round 4 (second vote).** The top half (8 of 16; K20 and K22 tied for 8th, so 9 items) went to a second vote. Six
  reached the 3.5 mean.
- **Round 5 (red team and final vote).** The red team wrote the case against each of the six with the cheapest test and
  a neutralising condition; all 15 members then voted approve, approve with conditions, or reject.

Member key: BL business lead, MR market research lead, PF pricing and finance, GR growth, UX UX lead, PD product
designer, DV data-visualization designer, A11Y accessibility specialist, EN engineer, RE reliability engineer, LG legal
and compliance, TS trust and safety, DK decisions keeper (veto), CS common sense (veto), RT red team. No ballot is
missing in any round.

Candidate key: K2 handle and name integrity; K3 measurement foundation; K45 trust-and-safety slice; K7 one trust
language; K8 number format and ranges; K9 design tokens and contrast test; K11 image palette and image band; KV
design-system variant tests V-1..V-3; K15 owner sees the public record (C12); K16 feed reading mode remainder (C11);
K17 Demo-record preview at connect (C16 reshaped); K18 age-law posture (MRC2-12); K19 sitemap and SEO pages
(MRC2-13); K20 home link preview (C21); K21 wayfinding remainder (C13); K22 billing hygiene checks (MRC2-11).

## Votes

### Round 1: first vote (0-5)

| Candidate | BL | MR | PF | GR | UX | PD | DV | A11Y | EN | RE | LG | TS | DK | CS | RT | Mean |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| K2 | 3 | 4 | 4 | 3 | 3 | 3 | 3 | 3 | 4 | 4 | 5 | 5 | 4 | 4 | 3 | 3.67 |
| K3 | 5 | 5 | 5 | 5 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 2 | 4 | 4 | 4 | 3.67 |
| K45 | 3 | 4 | 4 | 2 | 3 | 3 | 2 | 3 | 3 | 5 | 5 | 5 | 4 | 4 | 3 | 3.53 |
| K7 | 3 | 3 | 3 | 3 | 5 | 5 | 3 | 4 | 2 | 3 | 4 | 4 | 3 | 4 | 2 | 3.40 |
| K9 | 2 | 3 | 3 | 1 | 3 | 4 | 4 | 5 | 3 | 3 | 3 | 2 | 4 | 3 | 3 | 3.07 |
| K18 | 2 | 3 | 3 | 2 | 2 | 2 | 3 | 2 | 4 | 3 | 4 | 4 | 4 | 4 | 2 | 2.93 |
| K8 | 3 | 4 | 2 | 2 | 4 | 4 | 4 | 3 | 2 | 2 | 3 | 2 | 3 | 2 | 2 | 2.80 |
| K17 | 2 | 3 | 3 | 2 | 4 | 3 | 3 | 2 | 2 | 2 | 3 | 3 | 2 | 2 | 2 | 2.53 |
| K22 | 1 | 2 | 3 | 1 | 2 | 2 | 2 | 2 | 3 | 3 | 4 | 3 | 4 | 3 | 2 | 2.47 |
| K20 | 2 | 2 | 3 | 4 | 2 | 2 | 2 | 2 | 4 | 2 | 2 | 1 | 3 | 3 | 2 | 2.40 |
| K16 | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 4 | 2 | 2 | 2 | 1 | 3 | 2 | 1 | 2.00 |
| K15 | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 1.87 |
| K19 | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 3 | 2 | 1 | 1 | 3 | 2 | 1 | 1.87 |
| K11 | 1 | 2 | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 1 | 1.73 |
| K21 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 2 | 1 | 1 | 1 | 1 | 2 | 1 | 1 | 1.13 |
| KV | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 2 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1.07 |

### Round 3: scores after the debate (every stated change applied)

| Candidate | BL | MR | PF | GR | UX | PD | DV | A11Y | EN | RE | LG | TS | DK | CS | RT | Mean |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| K3 | 5 | 5 | 5 | 5 | 4 | 4 | 4 | 4 | 4 | 4 | 3 | 3 | 4 | 4 | 4 | 4.13 |
| K45 | 3 | 4 | 4 | 3 | 4 | 4 | 3 | 3 | 4 | 5 | 5 | 5 | 4 | 4 | 4 | 3.93 |
| K2 | 3 | 4 | 4 | 4 | 3 | 3 | 3 | 3 | 4 | 4 | 5 | 5 | 4 | 4 | 4 | 3.80 |
| K7 | 3 | 3 | 4 | 3 | 5 | 5 | 4 | 4 | 3 | 4 | 4 | 4 | 4 | 4 | 3 | 3.80 |
| K8 | 4 | 5 | 3 | 3 | 5 | 4 | 5 | 3 | 4 | 3 | 4 | 3 | 4 | 3 | 3 | 3.73 |
| K9 | 3 | 3 | 4 | 1 | 4 | 4 | 5 | 5 | 4 | 4 | 3 | 3 | 4 | 4 | 4 | 3.67 |
| K18 | 2 | 3 | 3 | 2 | 3 | 3 | 3 | 2 | 4 | 4 | 4 | 4 | 4 | 4 | 3 | 3.20 |
| K20 | 2 | 3 | 3 | 4 | 2 | 2 | 2 | 2 | 4 | 2 | 2 | 1 | 3 | 3 | 2 | 2.47 |
| K22 | 1 | 2 | 3 | 1 | 2 | 2 | 2 | 2 | 3 | 3 | 4 | 3 | 4 | 3 | 2 | 2.47 |
| K17 | 2 | 3 | 3 | 2 | 4 | 3 | 2 | 2 | 2 | 2 | 2 | 3 | 2 | 2 | 2 | 2.40 |
| K19 | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 3 | 2 | 2 | 2 | 3 | 2 | 2 | 2.07 |
| K16 | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 4 | 2 | 2 | 2 | 1 | 3 | 2 | 1 | 2.00 |
| K15 | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 1.87 |
| K11 | 1 | 2 | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 1 | 1.73 |
| K21 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 2 | 1 | 1 | 1 | 1 | 2 | 1 | 1 | 1.13 |
| KV | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 2 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1.07 |

### Round 4: second vote on the top half

Cut after round 3: the top 8 by mean, plus K22 tied with K20 at 2.47 for 8th (9 items). K17, K19, K16, K15, K11, K21 and KV dropped.

| Candidate | BL | MR | PF | GR | UX | PD | DV | A11Y | EN | RE | LG | TS | DK | CS | RT | Mean |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| K3 | 5 | 5 | 5 | 5 | 4 | 4 | 4 | 4 | 4 | 4 | 3 | 3 | 4 | 4 | 4 | 4.13 |
| K45 | 3 | 4 | 4 | 3 | 4 | 4 | 3 | 3 | 4 | 5 | 5 | 5 | 4 | 4 | 4 | 3.93 |
| K2 | 3 | 4 | 4 | 4 | 3 | 3 | 3 | 3 | 4 | 4 | 5 | 5 | 4 | 4 | 4 | 3.80 |
| K7 | 3 | 3 | 4 | 3 | 5 | 5 | 4 | 4 | 3 | 4 | 4 | 4 | 4 | 4 | 3 | 3.80 |
| K8 | 4 | 5 | 3 | 3 | 5 | 4 | 5 | 3 | 4 | 3 | 4 | 3 | 4 | 3 | 3 | 3.73 |
| K9 | 3 | 3 | 4 | 1 | 4 | 4 | 5 | 5 | 4 | 4 | 3 | 3 | 4 | 4 | 4 | 3.67 |
| K18 | 2 | 3 | 3 | 2 | 3 | 3 | 3 | 2 | 3 | 4 | 4 | 4 | 3 | 4 | 3 | 3.07 |
| K20 | 2 | 2 | 3 | 4 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 2.13 |
| K22 | 1 | 2 | 3 | 1 | 2 | 2 | 2 | 2 | 1 | 2 | 3 | 2 | 3 | 2 | 2 | 2.00 |

### Round 5: final vote (A approve, AC approve with conditions, R reject)

Shortlist: the six items with a second-vote mean of 3.5 or more. K18 (3.07), K20 (2.13) and K22 (2.00) could not be approved.

| Candidate | BL | MR | PF | GR | UX | PD | DV | A11Y | EN | RE | LG | TS | DK | CS | RT | Approve | Vetoes | Result |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| K3 | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | 15/15 | none | approved, F-15 |
| K45 | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | 15/15 | none | approved, F-16 |
| K2 | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | 15/15 | none | approved, F-17 |
| K7 | R | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | 14/15 | none | approved, F-18 |
| K8 | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | 15/15 | none | approved, F-19 |
| K9 | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | 15/15 | none | approved, F-20 |

## Waiting for the next cycle (with the council's reasons)

In order of the last mean each item received.

| Candidate | Last mean | Why it waits | What would bring it back |
|---|---|---|---|
| K18 Age-law posture (MRC2-12), reshaped | 3.07 (R4) | Most of it is already built (the attestation is stored, `db/schema.sql:31,194`). Its one new flow, hiding an account on a "may be under 18" report, needs F-16's rate-limited report and audited hide, and a single report must not hide an adult's record (red team). | First next cycle, as an addition to F-16 once F-16 merges: signed-in, rate-limited reporter; owner review; owner runs any deletion; attestation text version only; no date of birth, ID or age estimation (LG veto condition). |
| K20 Home link preview (C21) | 2.13 (R4) | Fix-sized (one new `app/opengraph-image.tsx`, under an hour). No product name, logo, figure or completeness claim may appear before clearance (T5a). | The orchestrator may build it as a chore with the fixes; growth asks that it not be dropped, because founder outreach shares `/`. |
| K22 Billing hygiene checks (MRC2-11), reshaped | 2.00 (R4) | The main check already holds: cancel opens the processor's flow directly (`lib/billing.ts:206-211`). The rest is test-only in test mode. | A chore with tests only (no save step; no "more accurate" copy; no "was" price). Before LIVE_BILLING at the latest. |
| K17 Demo-record preview at connect (C16 reshaped) | 2.40 (R3) | A vote would pre-empt the owner's pending ruling on C16 (cycle 1, flag 1). | **Sent to the owner** as the council's recommended shape (see flags). |
| K19 Sitemap and SEO pages (MRC2-13) | 2.07 (R3) | Effect after week 8; indexing pages that still call demo data verified (fix #1) or that include deleted users (fix #4) is harmful. | After fixes #1 and #4: /how and a glossary only; profiles stay out until the owner opens launch. |
| K16 Feed reading mode remainder (C11) | 2.00 (R3) | Its WCAG core is fixes #14-#17; the rest is in files F-10 and F-13 are editing. | After fixes #14-#17 and F-10/F-13 merge: Back returns to the same card, double tap only likes; keep F-2's reject swipe and Undo. |
| K15 Owner sees the public record (C12) | 1.87 (R3) | No real trader needs it yet; it needs real sign-in (#42), not the dev stub. | With F-7 or the first real connects, with a parity test that the visitor view equals the public render. |
| K11 Image palette and image band (DS-6, DS-19) | 1.73 (R3) | Its visible harms are fixes #2 and #9; the rest belongs to F-12 and owner flags O-2/O-4. | After F-12 merges and the owner rules on O-2/O-4: a palette table plus a parity test. |
| K21 Wayfinding remainder (C13) | 1.13 (R3) | Three demo traders; handle search would help find look-alike handles before F-17 exists (trust and safety). | With real records and after F-17; alphabetical only, never by performance. |
| KV Design-system variant tests V-1..V-3 | 1.07 (R3) | Three versions measured on demo data with no traffic give no evidence; the same reason holds C4/D23 (decisions keeper). Approving it would contradict the council's own record. | With C4/D23, once F-15's counters show about 1,000 weekly landings; V-3 alone first (market research, business lead). |
| C2 Sign-in by intent (D21), MRC2-8 return-to | not on ballot | Waits for #42 (auth files), then an F-1 rework design session (D21). | After #42 merges. |
| C4 Headline order (D23) | not on ballot | No traffic for /choose to read; MRC2-5 asks for the T10 comprehension test first (F-19 adds the "What's this?" line it needs). | When F-15's counters show traffic. |

## Flags for the owner (the council's recommendation; not approved)

1. **K6 Open-positions gate for real users (BC-3).** The decisions keeper vetoed a council approval: it narrows the
   owner's F-6 direction of 2026-11-01 and DESIGN TR-4, and the idea board already put this gate to the owner (F-6
   open questions). Legal notes that POLICY's vendor gate already blocks real users until the vendor answers on
   open-position prices. **Recommendation:** add a dated temporary exception to F-6: unrealized values hidden for real
   (non-demo) users by default until the vendor's written answer covers them, with the count-only line "Open positions
   exist and aren't shown yet" (TR-4 stays honest); tests on every leak path (images, API, feed averages, per-stock
   pages, sitemap); demo unchanged.
2. **K17 Demo-record preview at connect.** Recommended shape for the pending C16 ruling: Demo data only, no broker call
   before consent, F-1's step order, consent wording and 24-hour timer unchanged, consent button above the fold;
   `preview_viewed` once F-15 exists. If the owner wants the trader's own record previewed, the owner amends F-1.
3. **D27's decided line was reworded in a running build.** Commit 107d3f4 on `claude/f13-a11y-fixes` replaced D27's
   line ("Verified trades, straight from the broker. Losses included.") with the design system council's positioning
   line in `docs/features/F-13-first-visit-line.md`, `lib/f13-copy.test.ts` and `e2e/f13-first-visit.spec.ts`. The
   decisions keeper vetoes this as a council or build decision: D27 is an idea-board decision, F-13's own rule sends new
   wording back to the idea board, and DSP-2 is a proposal. **Recommendation:** revert to D27's words before that branch
   merges, or have the idea board (or the owner) amend D27 first; the council notes DSP-2's reason (D27's line calls
   demo cards verified) is a real F3a concern.
4. **Design system amendments to idea-board decisions** (DSP-2 D27 wording, DSP-3 D25 Stocks line, DSP-4 D22 "Held ·
   closed", DSP-8 one maturity signal) go to the idea board; the council may not reword a decided line. F-18 tests D25's
   line by data mix (real-only vs demo or mixed) rather than pinning it on demo data.
5. **Design system owner flags O-1..O-18** (`docs/direction/design-system-2026-11-01.md` §7) stay with the owner; F-18
   and F-20 leave O-2 (card Demo hue) and O-4 ("Disconnected" on cards) untouched, and F-19 leaves O-15..O-17 untouched.
   O-8 (adding the banned strings to `scripts/compliance.ts`, a protected path) should follow F-18.
6. **Market research cycle 2:** MRC2-3 gate definitions (the council asks the owner to decide before week 1; F-15's
   readout always prints the strict DESIGN §3.5 numbers), MRC2-4 go-to-market v2, MRC2-7 pricing research (prices
   other than $9.99/$99.99, a waitlist list, live arms), MRC2-10 vendor question list (send with BC-1), MRC2-11 Terms
   text for billing hygiene.
7. **Business council owner items:** BC-1 corrected vendor letter, BC-5 #42 and patches O1-O10, BC-8 pre-registration
   of the week-8 reading, BC-9 the accessibility checker (a dev dependency), BC-10 Privacy Policy and Terms (F-15's
   aggregate counters and F-16's report and takedown flows must be in that text before real users), BC-12 F-8 ceiling,
   BC-16 deleting the vendor connection on freeze (after the vendor answers; TR-5), BC-18 the "deferred until Open"
   table. Process proposals BC-13 (per-PR cost log), BC-14 (merge open PRs oldest first) and BC-15 ("state of main"
   note before councils) are the owner's to adopt.
8. **BC-11 (F-7 scope).** Legal notes that its legal calls are the owner's, not F-7's committee's: real people's names
   (T2), the legislator source's commercial-use bar, and F-7 profiles bypassing the launch gate and P6. The business
   council's real-filer switch (default off) is common ground.
9. **Inconsistency kept on record:** KV and C4/D23 both need traffic; the council held both rather than approve one.

## Fixes to build now (no vote; the orchestrator builds them directly)

Pure defects that are not features, verified against main by a separate agent on 2026-11-01. **Add to fix #2 (C1's
remainder, K1 on this ballot):** an e2e whose route list is generated from the app route tree, so that any performance
route or share image without the exact disclaimer text in view at 360 px fails, and no fixed bar covers it. Legal asks
fix #2 be built first. **Fix #4** becomes the shared visible-user predicate that F-16 extends with "hidden"; **fix
#28** goes before F-15. Several rows touch files that F-10..F-13 are editing; check "Possible overlap" before building.


Pure defects only, re-verified on `origin/main` 31004e7 on 2026-11-01. Every line number below was opened on that
commit. Ordered by severity: POLICY and record-trust first, then privacy, then wrong figures, then WCAG, then labels,
links and housekeeping. "Cn" = cycle-1 fix n (`docs/ideas/approval-2026-11-01.md`); "DS-n" = design-system council
change list (#48, `docs/direction/design-system-2026-11-01.md` §6); "B8" = `docs/direction/business-2026-11-01.md`;
"MR2" = `docs/direction/market-2026-11-01-cycle2.md` (FC rows F30/F31 at its lines 1060-1061).

Open-PR file overlaps: #40 touches `app/u/[handle]/page.tsx`, `lib/copy.ts`, `lib/trades.ts`; #42 touches
`app/u/[handle]/page.tsx`, `lib/copy.ts`, `app/actions.ts`, `app/auth/actions.ts`, `lib/recap-load.ts`,
`lib/trade-share-load.ts`; #46 touches `lib/sync.ts`; #48 is docs only. Running builds: F-9 (`lib/moderation.ts`,
thesis path in `app/actions.ts`), F-10 (feed card, `app/record-strip.tsx`), F-11 (status line in
`app/u/[handle]/page.tsx`, `app/pane.tsx`), F-12 (trade/month pages and images, `lib/month-card.ts`), F-13
(`app/first-visit.tsx`, nav label in `app/layout.tsx`), F-14 (`lib/sync.ts`).

| # | Fix | Evidence (source id + file:line on origin/main 31004e7) | Files | Rule | Possible overlap |
|---|---|---|---|---|---|
| 1 | Stop calling demo data "verified" on stock pages and the stock image. Build the wording from `demoOnly`/`mixed`; one state name, "Demo". | C2, DS-20. Still open, same lines: `app/t/[symbol]/page.tsx:25` EXPLAINER "Verified closed trades…" (shown on demo and empty pages, `:76`); `:49` title "‹SYM› verified trades"; `:50`, `:78` "No verified closed trades"; `:58` "‹n› verified closed trades … Sample data."; `opengraph-image.tsx:52` "verified closed trades" under the symbol while `:41` says "Sample data"; `:10`, `:33`, `:36`, `:75` "Verified trades by stock" / "verified trading records"; `app/t/page.tsx:16-17` title/description, and also `:77`, `:103`, `:116`, `:128` ("Stocks with at least one verified closed trade…", aria-label) on an index that lists demo symbols | `app/t/[symbol]/page.tsx`, `app/t/[symbol]/opengraph-image.tsx`, `app/t/page.tsx` | POLICY F3a, P2 | None (F-12 owns the stock image's strip and disclaimer, not its wording; coordinate if F-12 edits `opengraph-image.tsx`) |
| 2 | Put the F3 disclaimer in plain view beside the first stats block on every performance screen; raise it from 22 px on the trade, month and stock images. | C3, DS-19 (disclaimer part), DS-22 (pane part). Still open: `DISCLAIMER` (`lib/share.ts:16`) is not rendered in `app/pane.tsx`, `trade/[sellId]/page.tsx`, `month/[ym]/page.tsx`, `app/t/[symbol]/page.tsx`, `app/t/compare/page.tsx` (grep count 0); on the profile only in metadata (`app/u/[handle]/page.tsx:98`); otherwise only the footer (`app/layout.tsx:33-34`). Images at 22 px muted: `trade/[sellId]/opengraph-image.tsx:61`, `app/t/[symbol]/opengraph-image.tsx:69`, `lib/month-card.ts:40`. Keep cycle 1's added e2e (route list from the app tree, disclaimer in view at 360 px, never under a fixed bar) | those files | POLICY F3, A1 | F-10 (feed/pane, its AC at F-10 doc:43 depends on this fix); F-12 (trade/month pages and all three images: its ACs cover the image disclaimer); F-11 and #40/#42 on `app/u/[handle]/page.tsx` |
| 3 | When a connection has `disconnected_at`, show "Disconnected ‹date› · record frozen" instead of "Connected: …". | C4, DS-21. Still open: `lib/sync.ts:319` sets `disconnected_at`; nothing in `app/` reads it (only the type at `lib/connections.ts:98`). `app/u/[handle]/page.tsx:172` always builds `connectedLine` (`lib/copy.ts:259-261` "Connected: …"), printed at `:201` | `app/u/[handle]/page.tsx`, `lib/copy.ts`, `app/pane.tsx` | DESIGN TR-5 (Must); POLICY F4 | F-11 builds the status line around this fix (F-11 doc:7-8, AC :41-42): build together or hand the copy to F-11; #40, #42 (`page.tsx`, `lib/copy.ts`); #46/F-14 own `lib/sync.ts` (read-only here) |
| 4 | Skip users being deleted (`deleted_at` set) in every stock query. Today a deletion whose vendor step failed leaves the user marked but their trades still counted and charted. | B8 / F18 (TS-9 at business doc:1788). `lib/delete.ts:21-27` marks `deleted_at` first and keeps the rows until the vendor call succeeds. Unfiltered queries: `app/t/[symbol]/opengraph-image.tsx:34`; `app/t/page.tsx:27`, `:64-67`; `app/t/compare/page.tsx:21-23`; `app/t/[symbol]/page.tsx:95-98` (related), `:117-119` (baseline); `app/sitemap.ts:12-15`. The page's main reads already filter (`app/t/[symbol]/page.tsx:37`, `:106`; `app/t/open-positions.ts:17`; `lib/feed.ts:129`) | those files | POLICY P-rules (deleted data not shown); CLAUDE.md "data shown for deleted users" | None of the listed PRs (#42 adds `deleted_at` to other loaders, not these) |
| 5 | Correct untrue statements about what is public. | C5, partly fixed. `app/u/[handle]/join-cta.tsx:9` still "only percentages are ever public" (handle, name, symbols, dates, theses and positions are public). `app/u/[handle]/share-prompt.tsx:40` now lists open positions (#35) but still omits symbols, dates, theses and handle; compare the accurate `CONSENT_SCOPE_LINE` at `lib/copy.ts:67` | `app/u/[handle]/join-cta.tsx`, `app/u/[handle]/share-prompt.tsx` | POLICY P6, P3 | — |
| 6 | Stop the demo profile line from implying real accounts: "Record since … · Demo data. Only trades from connected accounts are shown." | C10, DS-20. Still open: `app/u/[handle]/page.tsx:172` (`'Demo data'`) and `:201` (fixed second sentence) | `app/u/[handle]/page.tsx` | POLICY P2, F3a | F-11 (same line); #40, #42 (`page.tsx`) |
| 7 | Make every printed "95% range" contain the headline average: move the remaining surfaces onto `arithmeticRange` / `cardEvidence`, then delete the `ponytail:` at `lib/record-card.ts:205-206`. | C6, DS-13, partly fixed by #35 (profile and record card use `cardEvidence`, `lib/record-card.ts:207-216`, `lib/bets.ts:42`). Still log-based (`lib/trades.ts:244`, `:270`, printed by `rangeText` `:299-300`) beside the arithmetic average (`:132`): stock page `app/t/[symbol]/page.tsx:87`, `:143-144`; `HoldTime.tsx:29`; `Concentration.tsx:28`; compare `app/t/compare/page.tsx:69`, `:77-78`; stock image `opengraph-image.tsx:40`, `:68`; month `lib/recap.ts:46`, `:53`; trade `lib/trade-share.ts:20`; record tools `lib/record-tools.ts:225`. `confidence()` itself stays (ranking) | `lib/recap.ts`, `lib/trade-share.ts`, `lib/record-tools.ts`, `app/t/**` | F-4 2026-10-31; DESIGN TR-9; POLICY F2 | F-12 (trade/month strip reads `lib/recap.ts` / `lib/trade-share.ts`); #40 only if `lib/trades.ts` is edited (not needed) |
| 8 | Remove completeness claims. | C8, DS-18. Still open: `app/t/page.tsx:17` "Browse every stock…"; `trade/[sellId]/opengraph-image.tsx:11` alt "…with the full record"; `month/[ym]/opengraph-image.tsx:12` alt "…with the whole record"; `month/[ym]/page.tsx:29` "whole record:"; back links "@h's full record" at `trade/[sellId]/page.tsx:44`, `month/[ym]/page.tsx:53`; headings "Their whole record" `trade/[sellId]/page.tsx:56`, `month/[ym]/page.tsx:75`; `lib/month-card.ts:35` "Whole record:"; `lib/claims.ts:7` "keeps every record verified" | those files | POLICY F3a | F-12 owns every trade/month file here and bans these strings (F-12 doc:30-32, AC :39): leave those to F-12, build `app/t/page.tsx` and `lib/claims.ts` here |
| 9 | The trade share image can clip its own figure: symbol (96 px) and figure (160 px) share one non-wrapping row inside `overflow: hidden`, so a 5-letter symbol with a return of four or more digits before the point loses its last characters. Size the row to fit. | DS-19 (fit part; DS doc:293-295 measured overflow). `app/u/[handle]/trade/[sellId]/opengraph-image.tsx:43` (`overflow: 'hidden'`), `:45-47` (row with gap 40, no shrink), image 1200 px with 64 px padding (`:9`, `:22`) | `app/u/[handle]/trade/[sellId]/opengraph-image.tsx` | Plainly wrong figure shown; POLICY F4 | F-12 (owns this image) |
| 10 | Fix the Verified badge's false tooltip "Cannot be edited" (theses and handles can be edited); use the F3a definition. Copy only. | C9, DS-7 (tooltip part). Still open: `app/ui.tsx:11` | `app/ui.tsx` | POLICY F3a | F-10 (feed card in `app/ui.tsx`) |
| 11 | Remove the banned words "signal" and "pick" from product copy. | C11. Still open: `app/t/[symbol]/HoldTime.tsx:39` "not a signal on its own"; `lib/ticker.ts:318` "Pick two stocks to compare." (shown `app/t/compare/page.tsx:93`, `:96`); `app/me/record/page.tsx:198` "Pick up to two rules…"; also `:76` "Your next sync will pick them up." | those files | POLICY F1a (copy never says … pick, signal; POLICY.md:106-107) | — |
| 12 | Fix text contrast: light Verified badge 3.77:1 on bg, 3.92:1 on surface; `:target` row tint (light: muted 4.01, up 3.83; dark: down 4.46 on bg, 3.97 on surface; muted 4.33 on surface); `.hl` current-row cue drawn in `--line` (1.20-1.31:1). | C13, DS-2/DS-3. Recomputed from tokens `app/globals.css:2-9`, `:15-16`: `.badge.verified` `:110`; `.rows li:target` `:180`; `.pane .rows .line.hl` `:411` | `app/globals.css` (+ pin in a token test) | WCAG 1.4.3, 1.4.11; POLICY A1 | — |
| 13 | Give inputs, `.secondary` buttons and `summary` controls a ≥ 3:1 boundary (`--line` is 1.20-1.31:1; surface on bg 1.04-1.09:1). | C14, DS-2 ("control borders"). `app/globals.css:137` `input, button, textarea { border: 1px solid var(--line) }`; same border on controls at `:188`, `:204`, `:212`, `:258`, `:278`, `:293`, `:331`, `:340`, `:442`, `:445`, `:462`, `:469` (F-2/F-3 added the last four) | `app/globals.css` | WCAG 1.4.11 | — |
| 14 | Stop the fixed nav hiding focus: `scroll-padding-top` (and bottom for the fixed bars). | C15, DS-2. `app/globals.css:72-73` `nav.top { position: fixed }`; bottom fixed bars `:344` `.hide-bar`, `:426` `.signin-line`, `:435` `.nojs-done`; no `scroll-padding` anywhere; only `.rows li { scroll-margin-top: 72px }` `:179` | `app/globals.css` | WCAG 2.4.11; POLICY A1 | — |
| 15 | Stop the signed-out "Sign in to like trades." bar covering the focused link: render inline, or dismiss on Esc and focus/scroll change. | C16. `app/globals.css:426` fixed, `z-index: 20`; `app/feed-gestures.tsx:100` renders it with no Escape handler (grep) | `app/feed-gestures.tsx`, `app/globals.css` | WCAG 2.4.11 | F-10 (feed) |
| 16 | Make off-screen feed panes non-focusable while the row rests on the card (`inert`), and move focus with → and Back. | C17. No `inert` in `app/` except the portal dialog comments (`app/connect/portal-button.tsx:10`, `:130`); `.feed .row` horizontal scroller `app/globals.css:85` | `app/pane.tsx`, feed row components, `app/globals.css` | WCAG 2.4.3, 2.4.7, 2.4.11 | F-10, F-11 (`app/pane.tsx`) |
| 17 | Like button: accessible name must contain the visible label ("Liked"). Use the visible text plus `aria-pressed`; move the note to `aria-describedby`. | C18. `app/card-menu.tsx:28-29` `aria-label={LIKES.likeLabel}` = `lib/copy.ts:397` "Like. Only you can see likes." while the text shows "Liked" | `app/card-menu.tsx`, `lib/copy.ts` | WCAG 2.5.3 | #40, #42 (`lib/copy.ts`) |
| 18 | Fix reflow: a 20-character handle widens `h1`; long names push the Demo badge off screen; the feed hero figure overflows its card at 360 px; feed cards clip at short heights; signed-in nav overflows at 360 px. | C19, DS-14, DS-15, DS-16. No `overflow-wrap` on profile `h1` or `.card .who` (`app/globals.css:100`); `.feed .row { height: 100dvh; overflow-y: hidden }` `:85`; `.ret { font-size: clamp(64px, 22vw, 120px) }` `:103` (DS-14 measured the overflow at 360×740); nav `:72-80` has no `flex-wrap`, links `white-space: nowrap`, handle `max-width: 34vw`, and signed in renders logo + Stocks + My record + handle (`app/layout.tsx:24-29`) | `app/globals.css` | WCAG 1.4.10, 1.4.4; POLICY P2 (Demo always visible) | F-10 (feed card), F-13 (nav label in `app/layout.tsx`; CSS only here) |
| 19 | Flat returns: 0.0% is painted in the loss colour, unsigned, and announced as "Gain". Use the existing `tone()`/`toneClass` (F-6, `app/open-rows.tsx:9`) everywhere, not only when open positions exist. | C23, DS-11, partly fixed (#33 uses `toneClass` only under `open`: `app/u/[handle]/page.tsx:245`, `:290`; `app/pane.tsx:55`). Still `> 0 ? 'up' : 'down'`: `app/ui.tsx:41`, `:55`; `app/pane.tsx:45`, `:78`; `app/u/[handle]/page.tsx:307`; `app/t/[symbol]/page.tsx:143`, `:183`; `Theses.tsx:26`; `similar-section.tsx:39`; `app/me/likes/page.tsx:31`; `chart.tsx:194`; `chart.tsx:135` `>= 0` (green); `< 0 ? 'Loss ' : 'Gain '` at `trade/[sellId]/page.tsx:51`, `month/[ym]/page.tsx:44`, `:96`, `new-trades-prompt.tsx:33`. `pct()` prints "0.0%" unsigned (`lib/trades.ts:165`) | those files | POLICY A1; WCAG 1.4.1, 1.3.1 | F-10 (`app/ui.tsx`), F-11 (`app/pane.tsx`), F-12 (trade/month), #40/#42 (`page.tsx`) |
| 20 | Real 404s: add `app/not-found.tsx`; `notFound()` for invalid ticker symbols; the trade and month share images return 404, not a 200 "not found" picture. | C21, B8/F22 (FC-repo-22 at business doc:865). No `not-found*` under `app/` (find empty); `app/t/[symbol]/page.tsx:68-74` renders "Ticker not found" with 200; `trade/[sellId]/opengraph-image.tsx:24-27` returns an image "Trade not found"; `month/[ym]/opengraph-image.tsx:26-29` "Recap not found". The profile image already 404s (`app/u/[handle]/opengraph-image.tsx:17-18`) | `app/not-found.tsx` (new), `app/t/[symbol]/page.tsx`, trade and month `opengraph-image.tsx` | WCAG 2.4.2; soft 404 (plain bug); POLICY U2 (impersonation via cards) | F-12 (owns both image routes) |
| 21 | Give each route a distinct page title. `/login`, `/login/sent`, `/connect/*`, `/terms`, `/privacy` all inherit "Stock Social". | C20. `app/layout.tsx:9`; no `metadata`/`generateMetadata` in `app/login/**`, `app/connect/**`, `app/terms`, `app/privacy` (grep) | those route files | WCAG 2.4.2 | #42 (edits `app/connect/{done,portal,start}/route.ts`, not the pages) |
| 22 | Fix stock-page thesis links: they target `#trade-<closed_trades.id>`, which changes on every rebuild and misses trades past the first window. Link to `/u/h/trade/<sell_id>`. | C22. `app/t/[symbol]/Theses.tsx:24`; anchor `id={`trade-${t.id}`}` on the windowed list `app/u/[handle]/page.tsx:303` (window `:175-176`) | `app/t/[symbol]/Theses.tsx`, `app/t/[symbol]/page.tsx` (select `sell_id`, `:105`) | CLAUDE.md (`sell_id` is the stable key); broken link | — |
| 23 | Show the year on card dates outside the current year ("closed May 30" on a 2020 trade). | C24, DS-21 (dates). `app/ui.tsx:35` `CLOSED_DAY` month + day only, used `:56` | `app/ui.tsx` | POLICY F4; DESIGN TR-3, TR-7 | F-10 (feed card); F-11 decides the same rule for images (F-11 doc:23) |
| 24 | Compare page prints "too early" twice ("too early. Too early to tell: …"). | C25. `app/t/compare/page.tsx:84` prints `COMPARE_COPY.tooEarly` (`lib/ticker.ts:327`) then `evidenceLine(c)`, which starts "Too early to tell" (`lib/trades.ts:290-291`) | `app/t/compare/page.tsx` | Wrong label (TR-9 copy) | — |
| 25 | Failed import is painted in the loss colour: a record state is not a loss. Use a warn style (icon + words). | DS-17. `className="down record-failed"` at `app/u/[handle]/page.tsx:197`, `app/pane.tsx:49`, `app/ui.tsx:52` (`.down` = `--down`, `app/globals.css:105`). Keep the `record-failed` class for e2e | `app/u/[handle]/page.tsx`, `app/pane.tsx`, `app/ui.tsx`, `app/globals.css` | DESIGN TR-3 (failed record never read as a result); POLICY A1 | F-11 (status line, `app/pane.tsx`), F-10 (`app/ui.tsx`), #40/#42 (`page.tsx`) |
| 26 | Light-scheme gain and loss colours are nearly indistinguishable under deuteranopia (ΔE00 2.8 light, 6.3 dark); retune `--up`/`--down` (no base change). | DS-4 (DS doc:505-506, `pass4/tokens.py`). Tokens `app/globals.css:7-8` (dark) and `:16` (light) | `app/globals.css` | POLICY A1 (colour never the only cue); WCAG 1.4.1 is met only where a sign or word is present (see #19) | — (same PR as #12/#13 per DS-2+3+4) |
| 27 | The profile "Share my record" button writes `share_image_saved_at`, a column documented as "first click of a Save image link". Correct the labels (schema and action comments) to what it records, or stop writing it. Also correct `trade-share.tsx:5-6`, which says it records month-recap shares (the month page passes `isOwner={false}`). | MR2 §1 finding 1, F31 (plain bug: data written to a mislabelled column). `app/u/[handle]/share-card.tsx:15-16` `onShared={() => best(markShareImageSaved())}`; `app/actions.ts:61-65` comment "Story-image adoption: first click on a Save link"; `db/schema.sql:63-64` "Set once, on the owner's first click of a Save image link". Month: `app/u/[handle]/month/[ym]/page.tsx:102` | `db/schema.sql` (comment only), `app/actions.ts`, `app/u/[handle]/share-card.tsx`, `trade-share.tsx` | Wrong label | #42 (`app/actions.ts`, `db/schema.sql`); F-9 (thesis path in `app/actions.ts`, different function); F-12 (`trade-share.tsx`, month page) |
| 28 | `via=nav` is sent by the nav but dropped by the allow-list, so the landing is recorded as `'profile'` and the nav comment's promise fails. Add `nav` to `REFERRED_SURFACES` (and its labels). | MR2 §1 finding 1, F30 (plain bug: a value produced in one place and dropped in another). `app/nav-login.tsx:5-6`, `:9` builds `/login?ref=…&via=nav`; `lib/referral.ts:12` `['profile', 'trade', 'month']`, `:14-18` `normalizeVia` returns null, `:22` `ctaVia` falls back to `'profile'`; callers `app/login/page.tsx:22`, `app/auth/actions.ts:31` | `lib/referral.ts` (+ `lib/referral` tests, any per-surface label map) | Wrong count | #42 (`app/auth/actions.ts`, read-only here) |
| 29 | Stale `ponytail:` note: "open positions (TR-4) are deferred" — F-6 (#33) shows open positions on every surface; only the confidence range stays closed-only by decision. Reword. | B-doc request; `lib/trades.ts:208`; open positions built (`app/u/[handle]/page.tsx:65-68`; F-6 doc:26) | `lib/trades.ts` (comment only) | CLAUDE.md (`ponytail:` notes must be true) | #40 (`lib/trades.ts`): one-line comment, rebase whichever lands second |
| 30 | Delete dead `.badge-embed` CSS (the embed panel was removed). | DS-26. `app/globals.css:209-211`; no `badge-embed` in any `.tsx` (grep); `share-card.tsx:7-8` "Replaces the old snippet, image-download and embed panels" | `app/globals.css` | Dead code | — |

#### Resolved since cycle 1

- **C1** (open positions in the consent list): resolved by #31 before cycle 1 (`lib/copy.ts:67`).
- **C7** (record-card span to last close, not today): fixed by #35 (6dde868): `lib/record-card.ts:271-273`
  `spanBetween(first, last)`; also `:122-124`.
- **C12** (developer `npm run db:seed` text on the public empty feed): fixed by #30 (e12a834): no `db:seed`/`npm run`
  string left under `app/`.
- **Partly fixed:** C5 (share prompt now names open positions, #35; join CTA untouched) → row 5; C6 (profile and
  record card use the arithmetic range, #35) → row 7; C23 (`tone()`/`toneClass` exists since #33 but is used only
  under open positions) → row 19.
- Every other cycle-1 fix (C2-C4, C8-C11, C13-C22, C24, C25) is still open; rows above carry the current lines.

#### Checked and left out

- **`trade_shared_at` overwritten** (MR2 F32): true (`app/actions.ts:95-98`, no `is null`), but the column is
  documented as the *latest* share for the measure "trade_shared_at > trades_prompt_seen_at" (`db/schema.sql:43-44`).
  Keeping a first-share date is a measurement change, not a bug.
- **Month-recap shares unrecorded** (MR2): no column exists for them; recording them needs a new column (measurement
  feature, MRC2-1). Only the inaccurate comment is fixed, in row 27.
- **Share links carry no source tag; invite/path codes in the allow-lists; view/referrer capture** (MR2 §3.1):
  measurement features (MRC2-1).
- **DS-31 display-name normalisation** (refuse "Verified", bidi controls, seal glyphs): a real spoofing risk, but it
  adds a validation rule (new behaviour) in `lib/auth/attempts.ts`, owned by #42.
- **DS-34 moderation HOLD patterns**: new rules in `lib/moderation.ts`, owned by F-9.
- **DS-27 focus ring**: accent ring measures 6.6-7.2:1 against bg and surface (`app/globals.css:144`); no measured
  failure. `.chart a:focus { outline: none }` (`:158`) is replaced by an accent stroke (`:159`).
- **DS-2 zero label 11 px** (`app/globals.css:172`): muted on bg passes 4.5:1; WCAG sets no minimum size.
- **DS-24 site meta description** "Verified trades, straight from the broker" (`app/layout.tsx:10`): positioning copy
  pending DSP-3, not a defect on its own.
- **DS-5, DS-9, DS-10, DS-25**: hand-rolled Demo spans look identical to `Badge`; footer literal text is correct;
  U+2212 minus and the glossary sweep are typography and copy choices.
- **DS-6, DS-7 (anchors), DS-8, DS-12 (beyond row 19), DS-14/15 (beyond the overflow in row 18), DS-16 labels,
  DS-19 (band layout beyond rows 2 and 9), DS-21 (status line), DS-22, DS-23, DS-28-DS-30, DS-33**: design changes,
  variants or features.
- **Other `ponytail:` notes** checked and still true: `lib/bets.ts:15` (confidence still clusters inline),
  `app/discovery-log.tsx:16` (mounted only in `app/page.tsx`), `lib/record-card.ts:205-206` (true until row 7 lands).
  `app/api/sync/route.ts:48` belongs to #46.
- **Hourly sync vs vendor polling guidance**: owned by F-14 / #46 (`lib/sync.ts`).
- **Cycle 1's design leftovers** (moderation hardening, badge redesign, baseline and month verdicts, open positions in
  the range, 44 px house target, skip-to-content, naming drift beyond row 1) remain out for the same reasons.

## Appendix A: pitch briefs, round 0 outcome and chair's rulings

The chair's briefs as written before round 0, followed by the round 0 outcome that replaced them on the ballot.

#### Approval council cycle 2 (2026-11-01): candidate briefs (chair's draft, before round 0)

Base: origin/main 31004e7. Process: team/approval-council.md. Binding: docs/POLICY.md.
Cycle 1 record: docs/ideas/approval-2026-11-01.md (C-ids below refer to it). Sources this cycle:
- MRC2-n: docs/direction/market-2026-11-01-cycle2.md §8 (and §3 for measurement).
- BC-n: docs/direction/business-2026-11-01.md §7 (and §2 checklist B1-B16).
- DS-n / DSP-n / V-n / O-n: design system council, PR #48, file at
  `docs/direction/design-system-2026-11-01.md` (merged in #48; §6 change list, §7 owner flags, §8 proposals).

Excluded as built or in flight (not on the ballot): PR #40 corporate actions (MRC2-2, BC-6), #42 security hardening,
#46 sharded sync incl. GET/cron (BC-4), #48 the design-system doc itself; running builds F-7 (public traders; BC-11 goes
to F-7's own committee), F-9 thesis safety (report on theses, review queue; DS-34 moderation patterns fold into F-9),
F-10 feed record line (DS-22 folds in as interface notes), F-11 status line (DS-21 and MRC2-8's freshness half fold
in), F-12 trade/month strip, F-13 first-visit (DS-23 folds in; DSP-2 wording is the idea board's), F-14 sync cadence,
options trades, known-limits sweep, token budget governor, process docs.
Not on the ballot, with reason:
- C2 sign-in by intent / MRC2-8 return-to half: still blocked; it waits for #42 (auth files), then an F-1 rework design session (D21).
- C4 / D23 headline order: no traffic yet for /choose; D23 stays "testing" (MRC2-5 adds T10 comprehension test first).
- C18 notify-me / MRC2-7 pricing research: owner flag (prices other than $9.99, waitlist list, live arms).
- MRC2-3 gate definitions, MRC2-4 go-to-market v2, MRC2-10 vendor questions, MRC2-11 billing hygiene Terms text: owner flags.
- BC-1, BC-5, BC-8, BC-9 (dev dependency), BC-10, BC-12, BC-14, BC-16 (TR-5; after vendor answer), BC-18: owner.
- BC-13 cost log, BC-15 state-of-main note: process proposals, to the owner.
- DSP-2, DSP-3, DSP-4, DSP-8: amend idea-board decisions (D27, D25, D22, register); the approval council may not
  reword a decided line, so they go back to the idea board.
- Design-system owner flags O-1..O-18: to the owner.
- Pure defects: go to the fixes list (separate, no vote).

Slot rule: max six approvals; features touching the same files count as one slot.

---

##### K1. Disclaimer guard on every performance route and image (C1 remainder, D20)
Problem: D20 requires the F3 disclaimer in plain view at 360 px on every performance surface. Fix #3 (cycle 1) places
it but is still unbuilt on main (no DISCLAIMER in app/pane.tsx, trade/month pages, /t pages). What remains after the
fix is a guard: an e2e whose route list is generated from the app route tree, failing any performance route or image
without the disclaimer in view at 360 px and never under a fixed bar.
Serves: every viewer; legal. Evidence: cycle 1 C1 passed 14/15 at 3.60, over the cap; D20 (idea board).
Cost: S (1 session, mostly e2e). Risks: flaky e2e on images; overlaps F-10..F-13 card/pane files (tests only).
Conflicts: none known.

##### K2. Handle and name integrity (C9 trimmed + BC-2 reserved handles and rename hold + DS-31 display-name normaliser)
Problem: no reserved-handle list; a rename frees the old handle at once; display names can carry check glyphs,
"Verified", bidi overrides, look-alike letters. POLICY U2 and idea 13/17 list reserved handles as launch prerequisites.
Scope: reserved list (product, staff, generic, "support"/"official"); look-alikes checked only against reserved, demo,
connected and F-7 public-profile handles; rename hold (old handle held, not reissued, for a period); display-name
rules (NFKC, strip bidi controls, refuse check glyphs and the words Verified/Official); rejection names the rule. No 301
rename machinery, no third-party names in the list. (Retiring handles forever = design O-9, owner.)
Serves: viewers (impersonation), traders. Evidence: cycle 1 C9 15/15 at 3.53; BC-2/B8; MRC2-6 (real linkable records
are scam bait, investment-fraud losses $8.65B in 2025 [FC-R28]); DS-31.
Cost: S-M. Files: new lib/handles.ts, signup/rename checks in lib/auth/** (#42 edits lib/auth/attempts.ts: starts after
#42 merges). Risks: false rejections; list itself must avoid trademarks (T1).

##### K3. Privacy-safe measurement foundation (C17 + MRC2-1 + BC-7)
Problem: nothing in weeks 1-8 can be read: no view or referrer capture, links carry no source tag, share events are
mis-recorded or overwritten, `via=nav` is dropped. Gates G1-G4 (DESIGN §3.5) can't be read without first-party counts.
Scope (MRC2-1 E1, E2, E3, E5 and fix-ups; BC-7): aggregate daily view rollup from a first-party beacon after 2 s
visible with a bot filter (no IP/user agent stored, no viewer id, no cookie); one shared `via` registry and `?via=`
appended on Share/copy-link (source class, never per-person); `share_action` rows replacing the four share columns;
nav/invite/path codes accepted; weekly descriptive readout (counts only). Deferred: E4 device-storage first-visit
date (legal committee), E8 painted door (owner, MRC2-7), test-and-roll (owner).
Serves: owner, the kill-gate reading. Evidence: MRC2 finding 1 (FACT, High); idea 13 lists counters as week-0
prerequisite; six cycle-1 members asked it go first. Cost: M (3-5 sessions). Risks: new P3/P6 data flow (Privacy
Policy text before real users); overlaps lib/display-log.ts, lib/funnel.ts, app/api/events/** (F-2 merged) and share
buttons (F-4 merged). Strict DESIGN numbers always reported beside any redefinition (MRC2-3 is owner's).

##### K4. Owner daily digest and audited hide switch (BC-2 digest + BC-17 kill-switch part)
Problem: nobody sees open reports, held theses, the last sync tick or `stoppedAtDeadline`; there is no fast audited way
to hide a public item (profile, thesis, card) while a report is handled; the runbook (restore with deletion replay,
30-day breach notice steps) does not exist.
Scope: an owner-only daily digest (counts and links, no personal data in email bodies), an owner-run hide switch that
hides (never deletes) an item with an audit row and a reason, and a runbook doc.
Serves: owner, trust and safety, reported people. Evidence: BC-2, BC-17, B8, O-6/O-7 (business council); POLICY U2/U3.
Cost: S-M. Risks: email sending = vendor/credentials (owner); digest could leak personal data; overlaps F-9's queue.

##### K5. Profile report action, takedown page and anti-impersonation line (BC-2 rest + MRC2-6)
Problem: F-9 covers reports on theses only; profiles (and F-7 profiles) have no report action (U2). No takedown/notice
page (U3). Real records invite impersonation scams: a fixed line on profiles and share cards ("Stock Social never runs
chat groups or messages you about trades") and a report category "impersonating this trader elsewhere".
Serves: viewers, traders. Evidence: BC-2/B8 (none built, VERIFIED); MRC2-6, RK-C2. Cost: S-M. Risks: takedown text is
legal-adjacent (owner approves wording); card space; overlaps F-9 lib/reports.ts (reuse it) and F-4 card images.

##### K6. Open-positions gate for real users (BC-3)
Problem: F-6 shows unrealized percentages publicly for every trader; the vendor's terms bar redistributing market data
without written consent and no written answer exists (B2/B11). Proposal: hide unrealized values for real (non-demo)
users until the vendor answers part B, showing a count-only line "Open positions exist and aren't shown yet" (keeps
TR-4 honest); demo unchanged.
Serves: owner (vendor terms), legal. Evidence: business council §1.4, B6. Cost: S (1 session). Risks: contradicts or
qualifies the owner's F-6 decision "open positions in every number" and DESIGN TR-4 (decisions keeper to check); trust
and safety accepts only with the count-only line; legal prefers the owner record it as a temporary exception.

##### K7. One trust language (C10 + DS-5, DS-7, DS-8, DS-9, DS-18, DS-20, DS-24)
Problem: three Verified wordings and three Demo names ship today; tooltip "Cannot be edited" is false; completeness
words ("full record", "every stock"); demo pages call trades verified; footer has literals.
Scope: one `TRUST_LOOK` table (bare "Verified" linking to /how#verified, tuned-plum dashed Demo, "Public source" for
F-7), Badge linked/plain, /how anchors, badge off the h1 onto the stats row with the definition visible, footer from
constants, completeness-word and "sample data" bans with tests, meta descriptions.
Serves: every viewer; F3a. Evidence: design-system council (signed by all ten); cycle-1 C10 3.20 waited for this
wording. Cost: M. Files: new lib/trust-look.ts, app/ui.tsx, lib/copy.ts, lib/record-card.ts, lib/month-card.ts,
app/how/page.tsx, app/u/[handle]/page.tsx, app/pane.tsx, app/layout.tsx, app/t/page.tsx, globals.css. Risks: collides
with F-10..F-13 files; some items are pure defects already on the fixes list (#2, #8, #9, #10).

##### K8. Plain labels, one number format and tone (C5 + DS-10, DS-11, DS-12, DS-13, DS-25 + MRC2-5's "What's this?" line)
Problem: hyphen signs, inconsistent decimals, 0.0% painted red and read as "Gain"; display ranges can exclude their
own headline (+25.2% vs −12.5% to +20.6%); jargon ("independent bet", "avg return"); lay readers misread a CI of an
average as the spread of single trades [FC-R18].
Scope: lib/format.ts pct()/winPct()/figureEms(), one tone() with Flat, chart line tone rule, display ranges from the
arithmetic cardEvidence with property test lo ≤ avg ≤ hi on every surface (confidence() and ranking untouched),
glossary sweep, "the range is for the average, not one trade" in What's this.
Serves: every viewer (a third of US adults at or below the lowest numeracy level [FC-R19]). Evidence: MRC2-5, D24,
DS council. Cost: M (about 45 sign assertions in 16 files). Risks: wide diff across files F-10..F-12 touch; pinned
tests updated (never deleted). Overlaps fixes #6, #23, #25.

##### K9. Design-token foundation and contrast CI test (C14 + DS-1, DS-2, DS-3, DS-4, DS-26, DS-27)
Problem: light Verified 3.77:1; light gain/loss ΔE00 2.8 apart under deutan; control borders 1.2-1.3:1; `:target` rows
fail AA; no test stops regressions.
Scope: value-neutral token layer, lib/tokens.test.ts contrast-pair test, meaning colours on today's base (up/down ink,
--control, --warn, --demo, --verified, --flat), every outline var(--focus) with 2 px offset, dead CSS removed.
Serves: low-vision and colour-blind viewers; POLICY A1. Evidence: DS council computed ratios; cycle-1 fixes #13-#15.
Cost: S-M. Files: app/globals.css, lib/tokens.test.ts. Risks: globals.css is edited by most sessions.

##### K10. Layout and reflow (DS-14, DS-15, DS-16, DS-17)
Problem: feed hero overflows at 360 px; tiles and long handles reflow badly (a 20-char handle widens the page to ~405
px at 320); nav doesn't fit signed in; failures shown in loss red rather than a warning.
Scope: content-fitted hero, stats grid reflow, nav with "Trades by stock · Sign in" / "Account" (interim), warn Notice.
Serves: phone viewers; WCAG 1.4.10. Cost: S-M. Risks: nav overlaps F-13's nav label; DS-16 "Account" is interim until V-3.

##### K11. One image palette and image trust band (DS-6, DS-19)
Problem: image colours are hard-coded per route; trade/month/stock images can clip "+12,346%" to "+12,34"; disclaimer at
22 px; a crop can cut the trust word.
Scope: lib/palette.ts {dark, light} with parity test; image band sizing, state line, disclaimer ≥ 35 px, crop rule.
Cost: M. Risks: F-12 owns trade/month images and lib/month-card.ts; F-4 card files. O-2/O-4 are owner flags.

##### K12. Variant test V-1: neutral base + ink accent (DSP-5, DS-28)
Product change: replace today's base and violet accent. Built as three versions (CLAUDE.md), chosen by /choose or the
Judge. Measures: pane-open rate, sign-in starts, focus-visible audit. Cost: S each. After K9 (DS-27). Risk: no traffic
yet to measure; trade-dress distance argued as reason.

##### K13. Variant test V-2: type, spacing and radius collapse (DSP-6, DS-29)
Product change: 24 font sizes → a rem scale, 428 px literals → --sp-*, 8 radii → 6/10/999. Three versions. Cost: L.
Risk: touches globals.css, app/me/record, month page broadly.

##### K14. Variant test V-3: signed-in nav labels (DSP-7, DS-30)
Product change: "My record" doesn't fit with a handle; three label sets. Cost: S. After K10's DS-16. Measure: nav fit,
taps on own record.

##### K15. Owner sees the public record (C12)
Problem: a signed-in trader can't see exactly what the public sees. Scope: "View as public" on own profile, a parity
test that the visitor view equals the public render. Was waiting on F-3 (#36, now merged). Cost: S. Serves: traders
(privacy confidence, P6). Risk: low value before real traders.

##### K16. Feed reading mode, non-visual remainder (C11)
Problem: after #30 merged: place memory on Back, double tap only likes, overscroll containment, keyboard pane. Cost: S-M.
Serves: keyboard and screen-reader users. Overlaps: F-10/F-13 feed files; fixes #16-#18.

##### K17. Demo-record preview at connect (C16 reshaped; MRC2-9 pre-launch part)
Problem: a trader can't see what will become public before connecting. F-1 2026-10-22 forbids import before consent,
so the preview uses a Demo record, labelled SIMULATION/Demo, showing exactly the public fields (P6), with
`preview_viewed` and a one-tap decline reason once counters exist. Cost: S. Risks: F-1 is owner-decided; cycle 1 flagged
C16 to the owner recommending this Demo version (the owner hasn't ruled).

##### K18. Age-law posture (MRC2-12)
Scope: signed-out surfaces use the documented non-personalized lower-bound order (test pins it); log the 18+
attestation event (date, version, no extra data); delete-on-report for a reported minor account. Legal committee
reviews a visible-end feed option (not built). Cost: S. Overlaps F-2 (merged) ordering, privacy-groundwork consent.

##### K19. Sitemap and SEO pages (MRC2-13)
Scope: /how in the sitemap, a glossary page (D24 terms), profiles past the 10-bet floor only. Cost: XS. Effect after
week 8. Overlap: app/sitemap.ts.

##### K20. Home link preview (C21)
Scope: an og image and description for "/" with the positioning line, no name or logo before clearance (T5a), disclaimer
if any figure appears (none planned). Cost: XS (< 1 h).

##### K21. Wayfinding remainder: month index and neutral search (C13)
Scope: month index per trader; search by handle/symbol, alphabetical only, never by performance. Cost: S-M. Low demand
with three demo traders.

##### K22. F-3 billing hygiene, code part (MRC2-11)
Scope (test mode only; LIVE_BILLING off): no cancel "save" step that delays cancellation; annual renewal reminder for
monthly plans; copy never implies paid data is more accurate; a test price never becomes a "was" price. Terms text is
the owner's (POLICY H). Cost: XS-S. Overlap: F-3 files (merged).

---

#### Round 0 outcome (chair): the ballot after the consistency check

Round 0 statements: decisions keeper, legal and compliance, common sense (Appendix B).
Every condition listed there by DK, LG or CS as a veto condition binds the candidate as reshaped below.

Off the ballot after round 0:
- **K6 open-positions gate → owner.** DK veto: it narrows the owner's F-6 direction of 2026-11-01 and DESIGN TR-4; the
  idea board already put this gate to the owner (F-6 open questions). LG: POLICY's vendor gate already blocks real users
  until the vendor answers. Recommendation to the owner: add a dated temporary exception to F-6 with the count-only line.
- **K1 disclaimer guard → fixes list** (rides with fix #3 as cycle 1 decided; LG asks it be first on the fixes list).
- **K10 layout and reflow → fixes list** (fix rows for DS-14/15/16 overflow and DS-17 warn notice); nav label stays F-13's.
- K12, K13, K14 merge into one candidate **KV**. K4 and K5 merge into **K45**.

Ballot (16): K2, K3, K45, K7, K8, K9, K11, KV, K15, K16, K17, K18, K19, K20, K21, K22.

Reshaped briefs (replace the drafts above):
- **K2** handle and name integrity: as drafted; starts after #42 merges; reuses F-9's text normaliser; reserved list
  holds generic and own-product words only (T1); rename hold ≤ 1 year (TR-5) and a held handle keeps no link to a
  deleted person; retiring handles forever (O-9) stays with the owner.
- **K3** measurement foundation, first slice: aggregate daily view rollup (beacon, bot filter; no IP, user agent,
  viewer or session id, no cookie stored), closed `via` registry of source classes appended on Share/copy-link,
  additive `share_action` rows (old `users` share columns stay; no drop), nav/invite/path codes accepted, weekly
  counts-only readout kept out of the repo; passes the privacy groundwork checks (SCHEMA_MAP, cookie table, log
  scanner); DESIGN §3.5 strict numbers always reported; device-storage date (E4), painted door (E8) and gate
  redefinitions (MRC2-3) excluded. The owner's Privacy Policy text covers it before real users.
- **K45** trust-and-safety slice (BC-2 rest, BC-17, MRC2-6): profile report action (signed in, rate limited, reuses
  F-9's lib/reports.ts; category "impersonating this trader elsewhere"); owner-only digest page (open reports, held
  theses, last tick, stoppedAtDeadline; no email until the owner sets a sender; no handle, thesis text or return in
  any email); owner-run hide script that hides a whole profile or a thesis (never a single trade, TR-1), never
  deletes, writes an audit row without thesis text; takedown/notice page whose wording the owner approves before real
  users can reach it (no DMCA safe-harbor claim, role mailbox); anti-impersonation line on profiles only (not on share
  cards), literally true, names no platform, never implies identity verification; runbook doc. After F-9 merges.
- **K7** one trust language: as drafted, with D25/D27/F-4 wording kept word for word, F-7's label left to F-7's
  committee, no DSP-3 description, card Demo hue (O-2) left to the owner. K7 and K9 share globals.css (one slot if both pass).
- **K8** plain labels, number format, tone: as drafted; "bet" stays; D23 order and win rate untouched; confidence(),
  ranking and RANK_MIN_BETS untouched; O-15/16/17 stay with the owner; pinned tests updated, never deleted.
- **K9** token foundation and contrast CI test: as drafted (value-neutral layer; the measured-defect colour fixes are on
  the fixes list).
- **K11** image palette and image band: as drafted; card Demo hue (O-2) and "Disconnected" on cards (O-4) stay with the
  owner; starts after F-12.
- **KV** design-system variant test: V-1 neutral base + ink accent, V-2 type/spacing/radius collapse, V-3 signed-in nav
  labels, each a three-version test (GitHub issue with a Variants section first; merge only via /choose or the Judge).
  Note the inconsistency DK found: C4/D23 is held for lack of traffic to measure, and these have the same problem.
- **K15, K16, K19, K20, K21**: as drafted (K20: no product name, logo or wordmark, no figures, no completeness claims).
- **K17** Demo-record preview: Demo data only, no broker call before consent, F-1's step order, consent wording and
  24-hour timer unchanged, consent button stays above the fold; the owner's pending ruling on C16 wins if it comes.
- **K18** age-law posture, reshaped: the attestation is already logged (signup_attempts, users); add only a version
  string of the attestation text; a "may be under 18" report hides the account at once and the owner runs any deletion
  (POLICY H); pin the signed-out non-personalized order with a test; no date of birth, ID or age estimation.
- **K22** billing hygiene, reshaped to three in-app checks in test mode: cancel has no step that delays it; copy never
  implies paid data is more accurate; a test price never becomes a "was" price. No reminder email (F-3 2026-11-01: the
  processor sends every billing email).

Context every voter should know: none of cycle 1's fixes is on main yet; the fixes list for this cycle (30
rows) will be built by the orchestrator without a vote, and a feature is what remains after its fixes. Six running
features (F-9..F-14) plus F-7 are editing card, pane, profile, trade and month files now.

#### Round 3 speakers

(five highest and five lowest round-1 scorers per candidate; ties broken by member order for high and reverse member order for low; no member speaks on both sides):
- K2: high LG, TS, MR, PF, EN; low RT, A11Y, DV, PD, UX
- K3: high BL, MR, PF, GR, DK; low TS, LG, RE, EN, A11Y
- K45: high RE, LG, TS, MR, PF; low DV, GR, RT, EN, A11Y
- K7: high UX, PD, A11Y, LG, TS; low RT, EN, DK, RE, DV
- K9: high A11Y, PD, DV, DK, MR; low GR, TS, BL, RT, CS
- K18: high EN, LG, TS, DK, CS; low RT, A11Y, PD, UX, GR
- K8: high MR, UX, PD, DV, BL; low RT, CS, TS, RE, EN
- K17: high UX, MR, PF, PD, DV; low RT, CS, DK, RE, EN
- K22: high LG, DK, PF, EN, RE; low GR, BL, RT, A11Y, DV
- K20: high GR, EN, PF, DK, CS; low TS, RT, LG, RE, A11Y
- K16: high A11Y, DK, BL, MR, PF; low RT, TS, GR, CS, LG
- K15: high BL, MR, PF, UX, PD; low RT, GR, CS, DK, TS
- K19: high EN, DK, MR, PF, GR; low RT, TS, LG, BL, CS
- K11: high MR, GR, UX, PD, DV; low RT, CS, PF, BL, DK
- K21: high A11Y, DK, BL, MR, PF; low RT, CS, TS, LG, RE
- KV: high A11Y, BL, MR, PF, GR; low RT, CS, DK, TS, LG

Per member:
- BL: K3 (high, 5), K9 (low, 2), K8 (high, 3), K22 (low, 1), K16 (high, 2), K15 (high, 2), K19 (low, 1), K11 (low, 1), K21 (high, 1), KV (high, 1)
- MR: K2 (high, 4), K3 (high, 5), K45 (high, 4), K9 (high, 3), K8 (high, 4), K17 (high, 3), K16 (high, 2), K15 (high, 2), K19 (high, 2), K11 (high, 2), K21 (high, 1), KV (high, 1)
- PF: K2 (high, 4), K3 (high, 5), K45 (high, 4), K17 (high, 3), K22 (high, 3), K20 (high, 3), K16 (high, 2), K15 (high, 2), K19 (high, 2), K11 (low, 1), K21 (high, 1), KV (high, 1)
- GR: K3 (high, 5), K45 (low, 2), K9 (low, 1), K18 (low, 2), K22 (low, 1), K20 (high, 4), K16 (low, 1), K15 (low, 1), K19 (high, 2), K11 (high, 2), KV (high, 1)
- UX: K2 (low, 3), K7 (high, 5), K18 (low, 2), K8 (high, 4), K17 (high, 4), K15 (high, 2), K11 (high, 2)
- PD: K2 (low, 3), K7 (high, 5), K9 (high, 4), K18 (low, 2), K8 (high, 4), K17 (high, 3), K15 (high, 2), K11 (high, 2)
- DV: K2 (low, 3), K45 (low, 2), K7 (low, 3), K9 (high, 4), K8 (high, 4), K17 (high, 3), K22 (low, 2), K11 (high, 2)
- A11Y: K2 (low, 3), K3 (low, 3), K45 (low, 3), K7 (high, 4), K9 (high, 5), K18 (low, 2), K22 (low, 2), K20 (low, 2), K16 (high, 4), K21 (high, 2), KV (high, 2)
- EN: K2 (high, 4), K3 (low, 3), K45 (low, 3), K7 (low, 2), K18 (high, 4), K8 (low, 2), K17 (low, 2), K22 (high, 3), K20 (high, 4), K19 (high, 3)
- RE: K3 (low, 3), K45 (high, 5), K7 (low, 3), K8 (low, 2), K17 (low, 2), K22 (high, 3), K20 (low, 2), K21 (low, 1)
- LG: K2 (high, 5), K3 (low, 3), K45 (high, 5), K7 (high, 4), K18 (high, 4), K22 (high, 4), K20 (low, 2), K16 (low, 2), K19 (low, 1), K21 (low, 1), KV (low, 1)
- TS: K2 (high, 5), K3 (low, 2), K45 (high, 5), K7 (high, 4), K9 (low, 2), K18 (high, 4), K8 (low, 2), K20 (low, 1), K16 (low, 1), K15 (low, 2), K19 (low, 1), K21 (low, 1), KV (low, 1)
- DK: K3 (high, 4), K7 (low, 3), K9 (high, 4), K18 (high, 4), K17 (low, 2), K22 (high, 4), K20 (high, 3), K16 (high, 3), K15 (low, 2), K19 (high, 3), K11 (low, 2), K21 (high, 2), KV (low, 1)
- CS: K9 (low, 3), K18 (high, 4), K8 (low, 2), K17 (low, 2), K20 (high, 3), K16 (low, 2), K15 (low, 2), K19 (low, 2), K11 (low, 1), K21 (low, 1), KV (low, 1)
- RT: K2 (low, 3), K45 (low, 3), K7 (low, 2), K9 (low, 3), K18 (low, 2), K8 (low, 2), K17 (low, 2), K22 (low, 2), K20 (low, 2), K16 (low, 1), K15 (low, 1), K19 (low, 1), K11 (low, 1), K21 (low, 1), KV (low, 1)

#### Chair's notes for the debate (round 3)

Reshapes proposed in the arguments by several members. The chair adopts them as the version under vote from part B
on, because they narrow scope and none adds anything a round-0 veto holder objected to. A member who preferred the
earlier version may say so in the score reason.
- **K3**: the first slice is the view beacon + daily rollup + closed `via` registry and appended `?via=` on Share
  (idempotent per-key upsert, fire-and-forget beacon that never blocks the page; a test fails on any stored
  identifier); the share-button `share_action` half starts after F-4/F-13 finish with `share-prompt.tsx` and
  `display-log.ts` (EN, RE, LG, TS). Screen reader announces the copy confirmation (A11Y).
- **K45**: profile report waits for F-9's `lib/reports.ts` and reuses it (EN); per-reporter rate limit (TS); a
  hidden profile shows "Hidden pending review" and its removal from rankings is tested and logged (DV); labelled
  report form, announced errors and "sent", takedown page with its own title (A11Y).
- **K8**: now = `lib/format.ts` helpers (pct, winPct, tone with Flat), the property test lo ≤ avg ≤ hi on every
  printed range, and the "the range is for the average, not one trade" What's-this line; the 16-file call-site sweep
  runs only after F-10..F-12 merge (UX, PD, DV, EN, BL, RE, CS).
- **K9**: extends F-13's contrast test (`lib/a11y-contrast.test.ts` on the F-13 branch) and keeps
  `lib/badge-contrast.test.ts`, changes no values beyond the fixes list, adds a gain-vs-loss colour-blind floor and
  fails on new colour literals; rides in K7's slot (A11Y, DK, DV, CS, RT).
- **K18**: a "may be under 18" report uses K45's signed-in, rate-limited report and its audited hide; the owner reviews
  before anything stays hidden and runs any deletion (RT, UX, PD, TS, GR, LG, EN, DK).
- **K7**: a test pins the decided lines of D25, D27, F-4 and F-1 verbatim; starts after F-10..F-13 merge and after
  fixes #1, #2, #8, #9, #10 (DK, A11Y, PD, UX).
- **K19**: only /how and the glossary enter the sitemap; profiles stay out until the owner opens launch (EN, DK, LG).
- **K17**: members note it pre-empts the owner's pending C16 ruling; several asked it go to the owner as the council's
  recommended shape instead.
- **KV**: MR and BL suggest, if anything, only V-3 after K3; DK, CS and RT note the inconsistency with holding C4.

Facts raised: the cancel flow already opens the hosted portal directly (`lib/billing.ts:206-211`, RE, BL, RT);
deleted handles are already held 365 days (`lib/delete.ts:13`, RT, UX); sign-up is gated closed
(`lib/launch-gate.ts:61`); the attestation date is already stored (`db/schema.sql:31,194`).

## Appendix B: every member's statements, by round

Copied from each member's ballot file without editing. A missing ballot would be shown as missing; none is.

### Round 0: consistency check

#### Round 0: decisions keeper

Checked against origin/main 31004e7: docs/features/F-1..F-14 (Decisions), docs/DECISIONS.md, docs/POLICY.md,
docs/DESIGN.md Stage 5 and §3.4/§3.5, docs/IDEAS.md (Decisions and owner flags), docs/COMPLIANCE.md, cycle 1's record
docs/ideas/approval-2026-11-01.md, the privacy groundwork committee record (docs/features/logs/privacy/committee-2026-11-01.md),
the design-system doc (PR #48) and the in-flight branches (corporate-actions #40, security-hardening #42,
sharded-sync #46, design-system #48, f10-f12-record-strip, f13-a11y-fixes, f7-public-traders, fix-truthful-labels).

Summary: 1 goes to the owner (K6). 3 reshape (K5, K22, K4). 18 clear with conditions. None clear without conditions.
One in-flight conflict found outside the ballot (F-13 branch rewrote D27's line; see notes).

| Candidate | Verdict | Conflicts (decision, date, file:line) | Veto conditions |
|---|---|---|---|
| K1 Disclaimer guard (D20) | clear with conditions | None with a decision. D20 2026-11-01 (IDEAS.md:121-123) asks for exactly this e2e. Gap: fix #3's placement is on no branch (f13-a11y-fixes covers fixes #5, #8, #10, #11, #13-#23, #25, not #3), so the "guard only" scope has nothing to guard yet. | (1) The placement itself (fix #3: disclaimer under the first stats block on feed card 1, pane, profile, /t, trade, month; images raised from 22 px) ships in this item or lands first. (2) Footer copy stays (D20). (3) Route list generated from the route tree, not hand-kept. (4) No existing disclaimer assertion removed or loosened (CLAUDE.md, test count). (5) "Never under a fixed bar" asserted. |
| K2 Handle and name integrity | clear with conditions | TR-5 handle hold after deletion is 1 year (DESIGN:328); deletion keeps "the bare handle reservation for one year" (IDEAS.md:94-98, Privacy Policy draft decision 2026-11-01; F-1 acceptance :195-197). Trademark timing reserves look-alike, "support" and "official" handles (IDEAS.md:116-120). Privacy groundwork D22: while closed nobody may rename onto a listed handle (privacy committee D22). F-9 2026-11-01 already owns one NFKC/bidi/confusables normaliser (F-9 Decisions line 2-4). Retiring handles forever (O-9) would contradict the one-year deletion rule: owner. | (1) No permanent retirement: the rename hold and any deletion hold never exceed TR-5's 1 year, and after deletion a held handle is a bare string with no link to the person. (2) Reuse F-9's normaliser (one function, `lib/moderation.ts`), no second confusables map, no new dependency. (3) Reserved list has no third-party marks and no real people's names (T1, T2); F-7 handles checked only at runtime, never listed in the repo. (4) Look-alike scope exactly as cycle 1's C9 (reserved, demo, connected, F-7 handles). (5) Starts after #42 merges (lib/auth/attempts.ts). (6) Keeps privacy D22's rename-onto-allowlist block. (7) Rejection names the rule; nothing deleted. |
| K3 Measurement foundation | clear with conditions | F-2 2026-11-01: implicit activity logging (impressions, dwell, skips) is opt-in, off by default, pending CIPA/notice work (F-2 Decisions :45-51). GTM 2026-11-01: "no cookie", referral is attribution only, DESIGN §3.5 thresholds unchanged (IDEAS.md:99-104). C17 return conditions: aggregate only, no cookie, IP and user agent in memory only, definitions committed before week 1 (approval-2026-11-01 "Waiting" C17 row). F-13 2026-11-01: no before/after claim until counters exist (F-13 Decisions :14-15). P3, P6 "no third-party trackers"; COMPLIANCE §5 (first-party, cookie-free, honour GPC). Privacy groundwork: every new table needs a `SCHEMA_MAP` row, every cookie a `COOKIE_TABLE` row, log scanner (pr-body note :68). CI fails on `drop` in db/schema.sql (CLAUDE.md). DESIGN §3.5 (:246-254). | (1) Strictly aggregate: no viewer id, session id, user id, cookie, local-storage id, IP or user agent stored; a daily rollup only. If any part is per-viewer it is F-2's opt-in activity log and stays off by default. (2) Never an ordering input. (3) Referrer reduced in memory to a class (internal / external / none / `via` code); no full referrer URL stored; no platform domain list or platform names in code or `via` codes (T1, T5). (4) `via` is a source class, never per person (GTM). (5) `share_action` is additive: the four share columns stay in the schema (no `drop`); reads move. (6) `SCHEMA_MAP`, cookie and log scanners green with no exceptions. (7) DESIGN §3.5 strict numbers reported beside any other definition; gate definitions stay the owner's (MRC2-3). (8) Privacy Policy text describing it is the owner's before real users (POLICY H). (9) E4 device-storage date and E8 painted door stay out. |
| K4 Owner digest and hide switch | reshape | TR-1 "no per-trade hide" and §3.4 Never (DESIGN:324, :237): the brief's "hide ... card" would hide one trade. F-9 2026-11-01: holds only hold or release, never delete, never touch trades; review page off until real admin identity, never the dev stub (F-9 Decisions :13-20). F3b scope amendment 2026-11-01 covers "any message, in any channel" built from records or theses (POLICY:123-127). Email sending needs a vendor/credentials (POLICY H). | Reshape to: (1) hide whole profile or thesis only, never a single trade or trade card; a hidden profile shows one neutral notice, not a partial record. (2) Owner-run script under `scripts/` (F-9 precedent), no web admin on the stub. (3) Hide never deletes; audit row (who, when, reason) with a `SCHEMA_MAP` entry. (4) Digest as numbers only in the tick JSON or an owner-run script (privacy D3 precedent); no email until the owner chooses a sender; any later email carries no handle, symbol, return or thesis text. (5) Runbook is a doc; it never instructs an agent to delete data. |
| K5 Profile report, takedown page, anti-impersonation line | reshape | F-9 2026-11-01 left profile and F-7 report actions out (F-9 Decisions :23-24): no conflict, K5 fills it. Share-card line conflicts with F-4 owner decisions on card contents and layout (F-4:11-29, :82-84 "keeps every element", chart share; :113-114 "owner copy changes only with the owner"). Trademark timing: full name clearance before "the first public card" (IDEAS.md:116-118). Takedown text and contact are owner's (POLICY U3, H; idea 12 "owner fills entity and contact details"); DMCA agent registration first (COMPLIANCE §6). | Reshape to: (1) the line on profiles and the pane only; nothing added to the F-4 record card, link preview or story images (owner). (2) Reuse F-9's `lib/reports.ts`, keyed reports, N-reporter rule; a report only holds, never deletes. (3) Takedown page wording waits for the owner; no personal email or address in the repo (P1). (4) The report category names no platform (T1). |
| K6 Open-positions gate for real users | goes to owner | F-6 2026-11-01 owner direction: records include open positions; "all other information should reflect them" (F-6:11-18). TR-4 open positions "as prominent as the headline" (DESIGN:327); POLICY F4 (:131-132). F-6 committee 2026-11-01 (F-6:26). The idea board already put this gate to the owner as an F-6 open question (F-6:60-63). POLICY "Before a public launch" already blocks real users until the vendor's written permission incl. market-data limits for open positions (POLICY:228-229), and GTM week 0 needs it (IDEAS.md:99-101). | Veto if built without a dated owner entry in F-6 recording a temporary exception. If the owner records it: (1) demo unchanged; (2) count-only line keeps TR-4 visible ("Open positions exist and aren't shown yet"), never silent; (3) the exception ends on the vendor's written answer. Note: before launch no real user exists, so the gate has no effect until the owner launches; it is the owner's launch condition, not a council feature. |
| K7 One trust language | clear with conditions | F-7 standing rule: public profiles carry "their own source label", decided by F-7's committee (F-7:13-14, open question :45); ds.md §9 agrees. D25 2026-11-01: "Browse stocks that have verified closed trades." (IDEAS.md:141-143); DS-24 "description per DSP-3" would change it; DSP-3 goes to the idea board. D27 line verbatim (F-13 :2-5). F-4 owner copy (trust lines F-4:67-81, caption :113-114) and F-1 trust notice (F-1:152-155) are owner wording. DECISIONS #11 2026-10-15 (human): profile from clicking and from swiping must match (DECISIONS.md:38). F-13 2026-11-01: Demo badge at equal weight in the line's viewport (F-13 :8-10). Fixes #2, #8, #9, #10 overlap (fix-truthful-labels, f13-a11y-fixes). | (1) The F-7 row's word comes from F-7's committee record; K7 does not set "Public source" for it. (2) D25's Stocks line and D27's line stay verbatim until the idea board rules on DSP-2/DSP-3. (3) No change to F-4 owner trust lines, chart caption, F-1 trust notice or owner consent copy. (4) Badge move applies to profile and pane alike (#11). (5) Demo stays visible at equal weight wherever F-13 requires. (6) `scripts/compliance.ts` additions (O-8) stay the owner's. (7) Built after fix branches merge; no duplicate fixes. |
| K8 Plain labels, number format, tone | clear with conditions | Consistent with F-4 2026-10-31 owner decision: the range is around the arithmetic average (F-4:64-66), and with F-4's code-review hand-off (F-4:180-182). D24 2026-11-01: "one word for a bet everywhere, checked by a test" (IDEAS.md:137-140); O-7 keeps "bet". TR-9 Display, Copy and Ranking Musts (DESIGN:363-370). F-4 2026-11-01 RANK_MIN_BETS 10 (F-4:93-94). D23 testing: headline order and win rate (IDEAS.md:132-136, owner flag :183); D24 owner flag on profit factor (:184). F-6 owner-committee wording "Including open positions at current value: X avg / result (N results)" (F-6:27). F-4 2026-11-01 "no font file is bundled" (F-4:95-96). O-15, O-16, O-17 are owner flags. Cycle 1 flag 6: D22 "Too early to tell" vs F-4 "Too few trades" both stay where decided. | (1) `confidence()`, `pace30`, ranking order and RANK_MIN_BETS untouched (TR-9 Ranking Must); a test pins `rankTraders` output. (2) "bet"/"separate bets" kept as the one word (D24); F-4 trust-line tables verbatim. (3) Headline order and win rate unchanged (D23, owner). Profit factor stays. (4) F-6's combined-figure wording verbatim. (5) "Evidence: tier" stays (TR-9); the "Past results" clause stays until the owner rules on O-15; no zero-width "Too early" rule (O-17). (6) No font file; images fall back to hyphen-minus if the U+2212 cmap test fails (O-18). (7) Pinned tests updated, never deleted; count does not drop. |
| K9 Token foundation and contrast test | clear with conditions | Settled conflict 9 (ds.md): base and accent change only with V-1. Overlaps fixes #13-#15, already built on f13-a11y-fixes (commit "A11y fixes #13-#19 ... design system council values"). | (1) Base, accent and on-accent values unchanged (that is K12, three versions). (2) `lib/badge-contrast.test.ts` kept or its assertions carried over; test count never drops. (3) Rebased on the merged fix branch; no second set of contrast values. |
| K10 Layout and reflow | clear with conditions | D27 "Trades by stock" (IDEAS.md:148-150; F-13 builds it). D21 2026-11-01: sign-in paths are an F-1 rework after #42 (IDEAS.md:125-127). Overlaps fix #19 (built on f13-a11y-fixes). | (1) "Trades by stock" verbatim; built after F-13 merges. (2) The nav label "Sign in" only; the two-path sign-in (D21) is not pre-empted. (3) "Account" is labelled interim until K14/V-3 chooses. (4) Warn tone never used for losses, and loss red never for failures. |
| K11 Image palette and trust band | clear with conditions | F-4 owner decisions on the record card layout and chart shares (F-4:82-84, :119-132) and no font file (:95-96). F-12 2026-11-01 owns the anti-crop band on trade and month images (F-12 :16-18) and is in flight (f10-f12-record-strip). O-2 (card Demo hue) and O-4 ("Disconnected" on cards) are owner flags. | (1) F-4 record card, link preview and story layouts unchanged except colour values from the palette. (2) Reuse F-12's band; no second crop rule; built after F-12 merges. (3) O-2 and O-4 parts left out until the owner rules. (4) No font file. |
| K12 V-1 neutral base and ink accent | clear with conditions | Three-version rule satisfied in form (CLAUDE.md "Three versions per product change"; DECISIONS.md:3-7). Same evidence problem as C4/D23, which cycle 1 held because "three versions picked on demo data give no evidence" (approval-2026-11-01 Waiting, C4 row). DECISIONS #25 2026-10-15: single-line chart coloured by sign (DECISIONS.md:55-63). T3/T5a. | (1) GitHub issue with `## Variants` first; three PRs labelled `autopilot` + `variant`; merged only via `/choose` or the Judge, recorded in DECISIONS.md; never by the council. (2) Each variant passes DS-2 and Stage 5 (chart colour by sign per #25, 0% on the axis, losses as prominent). (3) No logo, glyph or brand asset (T5a). (4) After K9. |
| K13 V-2 type, spacing, radius | clear with conditions | Same as K12 (three-version rule; no-traffic objection). Touches `app/me/record` (F-2/F-3 files). | Same as K12 (1) and (2); and the F-4/F-6 fit asserts (`used ≤ 0.80`) pass in every variant; no font file. |
| K14 V-3 signed-in nav labels | clear with conditions | Same as K12. D27 "Trades by stock" fixed. | Same as K12 (1); "Trades by stock" identical in all three; after K10. |
| K15 Owner sees the public record | clear with conditions | CLAUDE.md: don't build features that assume the dev auth stub. P6. TR-1 (no hiding). | (1) Reads the signed-in user through the session interface only, no stub behaviour; after #42. (2) Parity test: owner preview equals the signed-out render byte-for-byte in the record parts. (3) No control that hides or edits anything on the record. |
| K16 Feed reading mode remainder | clear with conditions | SW-1 Musts (DESIGN:388-392). F-2 2026-10-22/10-24: double-tap = private like; reject swipe in the non-opening direction amends SW-1 (F-2 Decisions :13-16, :23-28). Fixes #16-#18 built on f13-a11y-fixes (feed-inert, feed-keys). | (1) Every SW-1 Must holds (→ opens, ← closes, Back lands on the same card, reduced motion snaps). (2) Overscroll containment never disables F-2's reject swipe, its guards or the 5-second Undo. (3) Built on top of the fix branch; no duplicate keyboard pane. |
| K17 Demo-record preview at connect | clear with conditions | F-1 2026-10-22: first sync depth zero, import only after consent; 24-hour consent life; trust notice before the portal (F-1:102-105, :125-141). Cycle 1 flag 1 put C16 to the owner, recommending exactly this Demo version (approval-2026-11-01 Flags 1; IDEAS.md:164); the owner has not ruled. Privacy D9/D29: owner consent wording untouched, primary above the fold at 375×667 and 360×640. | (1) Nothing of the trader's own record is read or imported before consent; the preview uses only seeded Demo data, labelled Demo. (2) F-1's step order, trust notice, consent wording and 24 h timer unchanged; the preview is an optional link or section that keeps the consent primary above the fold. (3) Fields shown equal `CONSENT_SCOPE_LINE` exactly (P6). (4) `preview_viewed` and decline reason only after K3, under K3's no-identifier rules. (5) A real-record preview stays the owner's (F-1 amendment). The record notes the pending owner flag. |
| K18 Age-law posture | clear with conditions | TR-9 Ranking Must and RANK_MIN_BETS (DESIGN:368; F-4:93-94); F-2 "Personalize my feed: Off" order (F-2 :52-54). F-1 2026-10-22 (c): attestation lives on `signup_attempts` (F-1:156-163); D26: versioned consents once live (IDEAS.md:144-147). POLICY H and the delegation: approval never deletes data (POLICY:177-187). P4: never design for or mention minors' cohorts. | (1) Signed-out order is the documented lower-bound order; test pins it. (2) Attestation event reuses `signup_attempts` (date, version), no new personal field; `SCHEMA_MAP` row. (3) A report of a possible minor holds and hides the account; deletion happens only by the owner's decision through the existing deletion path, never automatically. (4) Copy says "18 or older", never a cohort name. |
| K19 Sitemap and SEO pages | clear with conditions | F-7 branch edits `app/sitemap.ts` (in flight). RANK_MIN_BETS 10 (F-4:93-94). D24 terms (IDEAS.md:137-140). Launching or making the product public is the owner's (POLICY H). COMPLIANCE §12: /how history kept. | (1) After F-7 merges; F-7 profiles listed only under F-7's own launch switch. (2) Sitemap never invites indexing while the launch gate is closed in production. (3) Glossary uses D24/F-4 wording verbatim; no performance ordering. (4) /how changes keep history. |
| K20 Home link preview | clear with conditions | T5a and trademark timing (POLICY:76-78; IDEAS.md:116-120). D27's line is under amendment (DSP-2 to the idea board). | (1) No product name as a logo, no glyph or brand art; name only as plain text if at all. (2) Uses the positioning constant, not D27's contested line. (3) No figure; if one appears, the F3 disclaimer. |
| K21 Month index and neutral search | clear with conditions | F3b: pages about a security never rank it (POLICY:120-123); F1. Cycle 1 C13 condition: alphabetical only, never by performance. | (1) Alphabetical only, by handle or symbol; no performance sort, score or "top". (2) Month index shows every month, losing months included (TR-1, F4). |
| K22 F-3 billing hygiene, code part | reshape | F-3 2026-11-01: "The processor sends every billing email; the app sends none" (F-3:52-53). Annual renewal reminder 30-40 days is decided for annual plans (F-3:67-71); notices for monthly plans (months 12, 24, 36) are only an idea-board proposal in Open questions (F-3:241-244), not a decision. Hosted portal handles cancel (F-3 "Hosted everything"); cancel any time, self-serve (F-3:61-62). Paid never fresher or richer than free (F-3:44-45). Terms text is the owner's (POLICY H). | Reshape to in-app tests only: (1) no app screen between "Cancel" and the hosted portal; (2) no copy implying paid data is more accurate or fresher; (3) no "was" or struck price from a test price. Drop the reminder: any reminder is sent by the processor, configured by the owner, and the monthly-plan notice needs an owner decision first. LIVE_BILLING stays off. |

## Notes

**K6.** This is an owner choice, not a council one. It narrows an owner direction (F-6 2026-11-01) and TR-4. The gate it
asks for already exists in a stronger form: POLICY's launch list needs the vendor's written permission on open-position
prices, and no real user can connect before launch. The council can recommend that the owner add one dated line to F-6
("until the vendor answers part B, real records show the count-only line"). It cannot build it first.

**K17.** The Demo version needs no F-1 change, which is why cycle 1 recommended it. But the owner has a pending flag on
C16. The record should say the council took the recommended Demo version, and that a real-record preview still needs
the owner to amend F-1.

**K2.** "Rename hold" must not turn into permanent retirement by the back door. A hold longer than TR-5's year, or one
that survives deletion with a link to the person, contradicts the decided deletion list (IDEAS.md:94-98). O-9 stays
with the owner.

**K3.** The F-2 opt-in rule is the hard line. An aggregate counter with no identifier is not F-2's activity log. Any
per-viewer or per-session event is, and it is then off by default. The schema change must be additive because of the CI
`drop` guard.

**K7/K8.** Both are consistent with F-4's owner decisions on the arithmetic range and the trust-line wording. They
touch three idea-board lines (D25, D27, D22) only through the DSP items. Those stay excluded, and K7's DS-24 must not
smuggle DSP-3 in.

**K12-K14.** The three-version rule is met in form. The chair held C4/D23 because three versions on demo data give no
evidence (cycle 1 Waiting table; briefs "not on the ballot"). K12-K14 have the same problem, and K12's measures
(pane-open rate, sign-in starts) need K3's counters. Either hold them for the same reason as C4, or put C4 back on the
ballot on equal terms. I don't veto either way. I flag the inconsistency.

**K22.** The F-3 committee decided that the app sends no billing email. A reminder built in the app contradicts it.

**Chair's "not on the ballot" list.**
- Correct: C2 (D21, F-1 rework after #42); C18/MRC2-7, MRC2-3/4/10/11 and the BC owner items; BC-11 to F-7's committee;
  DSP-2/3/4/8 to the idea board; O-1..O-18 to the owner; DS-34 into F-9 (F-9 already holds "verified" claims).
- Inconsistent: C4 excluded for no traffic while K12-K14 are included (above).
- Arguably misplaced: K6 belongs on the owner list, not the ballot. A council approval can't take effect without an
  owner F-6 entry.
- **In-flight conflict (outside the ballot, needs action before merge):** branch `claude/f13-a11y-fixes`, commit
  107d3f4, rewrote F-13's decided line from D27's verbatim "Verified trades, straight from the broker. Losses
  included." to the design-system positioning line. It also added a dated decision to F-13 citing the design system
  council. That contradicts D27 2026-11-01 (IDEAS.md:148-151), F-13's own decision that new wording "goes back to the
  idea board ..., which the council may not change" (F-13 Decisions :16-17), and the chair's ruling that DSP-2 goes to
  the idea board. The decisions keeper's veto applies: revert to D27's words until the idea board or the owner amends
  D27. If kept, it goes to the owner. The DS-22 fold into F-10 is fine as built: f10-f12-record-strip replaces "held ·
  closed" per D22 and does not apply DSP-4.
- Slot note (not my lens, flagged for the chair): K7, K8, K9, K10 and K11 all edit `app/globals.css`, `app/ui.tsx` and
  `lib/copy.ts`, and the slot rule may count them as one.

#### Round 0: legal and compliance

Member: legal and compliance (veto holder). Base: origin/main 31004e7. Findings, not legal advice (POLICY.md:15-24:
the AI legal committee's findings stand in for counsel; the owner makes the calls they leave open).
Sources read: docs/POLICY.md (all sections), docs/COMPLIANCE.md (§1 checklist, §2-§13), business-2026-11-01.md §1,
§2 (B1-B15, O-1..O-9), §7 and Appendix D fact-check 3; market-2026-11-01-cycle2.md §5.3, §8 and Part C2.
Repo facts checked: db/schema.sql:31,187-212 (18+ attestation already stored on users and signup_attempts);
db/schema.sql:39-64 (share columns on `users`, one "per referrer"); F-6 open questions (idea board 2026-11-01 already
records the market-data gate); F-1 2026-10-22 consent lines 36-61; F-3 renewal-reminder line 69-70.

Verdict key: clear / clear with conditions / reshape / reject / owner-reserved. "Veto conditions" are the conditions
whose removal from the built scope makes me veto it (the candidate then breaks POLICY).

| Candidate | Verdict | Rule | Veto conditions |
|---|---|---|---|
| K1 Disclaimer guard | Clear with conditions (legal priority 1) | F3 (POLICY.md:113-116); COMPLIANCE §2 procedures; D20 | (1) Exact text "Not investment advice. Past performance does not guarantee future results." asserted, not a substring of something weaker. (2) Route list generated from the app tree, so a new route can't skip it; any exemption list names only non-performance routes and is reviewed. (3) Images (og, card, trade, month, stock) covered, not only HTML. (4) Never under a fixed bar at 360 px. The guard must not land before fix #3 is merged in a way that marks failures "expected". |
| K2 Handle and name integrity | Clear with conditions | U2 (POLICY.md:145-147); T1 (64-69); T2 (70-71); F3a (117-119); COMPLIANCE §3 (handle hold keeps no personal data), §6 | (1) Reserved list holds only generic and own-product words (support, official, admin, staff, help, security, verified, the product's own name, route names). No third-party company, broker, platform or person names, in the list, tests or fixtures (scanner MARKS). Impersonation of named firms is handled by report + owner hide, not by a list. (2) Rename hold stores the handle string and release date only; it never blocks profile deletion (P6) and a held handle never resolves to the deleted person's data. (3) Display names refuse "Verified", "Official", check glyphs, bidi controls (F3a: nothing implies identity verification). (4) No personal data in rejection logs. |
| K3 Measurement foundation | Clear with conditions | P3 (48-51), P6 last line "No third-party trackers" (58-59), P5 (60); COMPLIANCE §3, §5 (CIPA, cookie consent, GPC), §1 Q2/Q4; H (Privacy Policy) | (1) First-party only: beacon to own origin, no third-party script, pixel or session replay. (2) Stored rows are aggregates: no IP, no user agent, no viewer id, no cookie, no fingerprint; bot filtering reads the user agent in memory and drops it. (3) `via` values come from a closed registry (source classes); unknown values are dropped, so no per-person or per-link id can be smuggled in. The existing per-referrer measure (schema.sql:50) is not extended. (4) `share_action` rows tied to a user are deleted with the profile (P6 deletion), and carry no thesis text or account id. (5) Additive schema only: the four `users` share columns stay (deprecated) — no drop, no data deletion (H; CI schema rule). (6) E4 device-storage first-visit date and E8 painted door stay out. (7) The weekly readout is counts only, owner-only, never committed to the repo with real data (P5), no handles or returns (F3b scope). (8) Real users stay behind the Privacy Policy text describing this flow (owner, H; business B10). |
| K4 Owner digest and hide switch | Reshape | P3/P6 (no personal data in logs; never log thesis text with user ids, 58-59); H (credentials, vendors, deleting data, 177-187); F3b scope (123-127); COMPLIANCE §10, §12, §13 (breach timelines) | Reshape: build the digest as an owner-only page (counts and links to the queue) now; sending it by email waits for the owner to choose and configure a sender (vendor + credentials = owner). Conditions: (1) no handle, display name, thesis text, symbol or return in any email body or subject; counts and a link to the owner page only. (2) Hide switch is owner-run, hides and never deletes, reversible; audit row = item id, kind, reason from a fixed list, actor, time; no copy of thesis text in the audit row. (3) Runbook contains no secrets or personal data, and names the 30-day FTC notice for 500+ consumers (16 CFR 314.4(j)) plus state breach timelines as items to check, not as settled law. (4) Hide must not be usable to hide a trader's own losses (F4/TR-1: owner-only, report-driven). |
| K5 Profile report, takedown page, anti-impersonation line | Clear with conditions | U2 (145-147), U3 (148-149); COMPLIANCE §6 (DMCA §512, CDA §230); F3a; F3b; T1, T4, T5a; P1; F3 | (1) Takedown page wording is approved by the owner before it is reachable on a deploy that admits real users; until then it is marked draft. It never claims DMCA safe harbor, a designated agent or response times that don't exist (agent not registered: business O-2). Contact is the role mailbox (B1), never a personal address (P1). (2) The fixed line must stay literally true: "never runs chat groups or messages you about trades" holds only while F3b bars record-based messages; it names no platform or company (T1, T4) and does not say or imply the trader's identity is verified (F3a). (3) The line never displaces or shrinks the F3 disclaimer on cards. (4) Product name comes from one constant, plain text, no logo or wordmark (T5a). (5) Report categories are factual ("impersonating this trader elsewhere", "may be under 18", "copyright", "scam or solicitation"), never a judgment of skill; reports never auto-remove or auto-publish (U1 spirit); reporter identity is not shown to the reported person. (6) Reuse F-9's `lib/reports.ts`; reports on F-7 profiles do not settle F-7's T2 question. |
| K6 Open-positions gate for real users | Clear with conditions | POLICY.md:22-24 (vendor written permission before real users), "Before a public launch" market-data limits (228-229); vendor Developer Terms "not store, resell, or redistribute Market Data" (business App. D, row -9); F4/TR-4; F-6 idea-board line 60-62 | Not an override of F-6: POLICY's vendor gate outranks the feature decision, and the idea board already recorded this gate in F-6. Conditions: (1) Fail closed: any non-demo record hides unrealized values until a flag the owner sets after the written answer (or a licensed price source). (2) Every leak path is covered by tests: profile, feed card averages, per-security aggregates, share and og images (image URL changes with the figure), API/JSON, sitemap, cached images. (3) Count-only line stays (TR-4 honest); demo unchanged and Demo-badged. (4) Preferably no computing or storing of derived unrealized percentages for non-demo users either until the answer ("store" is in the clause). (5) The owner records it as a temporary exception in `docs/DECISIONS.md` (legal's preference; the council does not write that line itself). Removing (1) or (2) = veto. |
| K7 One trust language | Clear with conditions | F3a (117-119), F3 links (114-116), P2 (Demo badge), F2; COMPLIANCE §11 (FTC §5) | (1) "Verified" always resolves to "imported read-only from the trader's broker" and nothing more; no identity, audit, completeness or endorsement implication. (2) F-7 "Public source" never shows the word Verified (not broker-sourced). (3) Demo pages never say verified; Demo badge on every demo surface. (4) The false "Cannot be edited" tooltip goes. (5) Completeness-word ban tests are added, never loosened; existing tests updated, not deleted. (6) Footer links to Terms, Privacy and How on every page survive the constant refactor. |
| K8 Plain labels, number format, tone | Clear with conditions | F3c (128-130), F4 (131-132), F3b labels (122-123), A1 (153-155), F1; COMPLIANCE §11 | (1) confidence() and ranking stay untouched; CIs still shown (TR). (2) "The range is for the average, not one trade" is accurate to the computation. (3) Losses keep equal prominence; sign shown in text, not colour alone (A1). (4) Glossary never uses edge, skill, signal, pick, buy/sell/hold advice words. |
| K9 Design tokens and contrast test | Clear with conditions | A1 (153-155); T3 (72-74); COMPLIANCE §3 third-party loads | (1) Test asserts at least 4.5:1 text and 3:1 non-text/focus. (2) No colour chosen to match a named brand's identity. (3) No externally hosted fonts or assets. |
| K10 Layout and reflow | Clear with conditions | A1 (WCAG 1.4.10); F3 | Disclaimer stays in plain view at 320 and 360 px after reflow; Terms/Privacy/How links stay reachable in the new nav. |
| K11 Image palette and trust band | Clear with conditions | F3, F3a, T5a, C3 | (1) No image variant ever drops the disclaimer; ≥35 px is a floor, not a target. (2) Crop rule never cuts the disclaimer or trust word. (3) No logo or wordmark (T5a). (4) Fonts license-verified and bundled (C3). |
| K12 Variant V-1 colour | Clear with conditions | T1, T3 (72-74), A1; CLAUDE.md three-version process | (1) Specs, PR bodies and variant docs name no other product or brand, even as a comparison (T1, T4); trade-dress distance argued in generic terms only. (2) Each version passes K9's contrast test. |
| K13 Variant V-2 type and spacing | Clear with conditions | C2, C3, A1 | (1) No new font or package (dependency = owner). (2) rem scale respects user zoom (A1). (3) No brand names in variant docs. |
| K14 Variant V-3 nav labels | Clear | F1/F2 words; T1 | Labels contain no advice or promissory words, no third-party names. |
| K15 Owner sees the public record | Clear with conditions | P6, P3 | (1) "View as public" renders exactly the signed-out render (parity test) and exposes no owner-only data in any URL. (2) No "view as another user" path. |
| K16 Feed reading mode | Clear with conditions | A1, F6 (137-139) | (1) Like has no celebration, streak or reward on real trades. (2) Reduced motion respected. (3) Keyboard pane reachable with visible focus. |
| K17 Demo-record preview at connect | Clear with conditions (owner's pending ruling on C16 wins if it comes) | F-1 2026-10-22 (no import before consent, lines 34-61); P2 (46-47), P3, P6 (54-59); market §5.3 item 12; F3 | (1) Preview uses only fictional Demo data, labelled Demo/SIMULATION, never the trader's data and no broker call before consent. (2) It shows exactly the public fields, including that the record stays public after disconnect (P6). (3) It changes nothing about consent recording: the consent screen and its record stay as F-1 defines them. (4) `preview_viewed` and the decline reason are aggregate or attached to the signup attempt, fixed-list reasons only, no free text. (5) F3 disclaimer on the preview. |
| K18 Age-law posture | Reshape | P4 (51-53); H "deleting data" (179); COMPLIANCE §7, §13 (COPPA, state minors' laws); market Part C2 rows 25-27; business App. D (SB 976 from 2027-01-01) | Reshape: the attestation event is already stored (`signup_attempts.adult_attested_at`, `users.adult_attested_at`, schema.sql:31,187-212); add only a version string of the attestation text, nothing else. "Delete-on-report" becomes: a "may be under 18" report hides the account at once and puts it at the top of the owner queue; the owner runs the existing whole-profile deletion; a log row keeps date, action and gate version, no personal data. Conditions: (1) no date of birth, ID, face or voice processing, or age estimation (BIPA, H). (2) Signed-out surfaces use the documented non-personalized lower-bound order, pinned by a test (F1a; SB 976). (3) No minors' age-cohort words in copy, tests or docs (P4). (4) Visible-end feed option stays unbuilt pending the legal committee. Automatic deletion by an agent or job = veto (H). |
| K19 Sitemap and SEO | Clear with conditions | P6 (consent lists what becomes public), P3; T2 (F-7); F3b; F1 | (1) Only consenting connected traders past the floor and Demo profiles; no F-7 public-filer profiles until the owner rules on T2. (2) Deleted or frozen-then-deleted profiles leave the sitemap and return 404/410 with noindex. (3) The connect-time list of what becomes public says profiles may appear in search engines (Privacy text: owner). (4) Glossary: no advice words, no skill labels. |
| K20 Home link preview | Clear with conditions | T5a (76-78), F3, F3a, F2; COMPLIANCE §11 | (1) No product name, logo or wordmark in the image before clearance. (2) No figures; if any appear, the disclaimer is in the image. (3) Positioning line makes no completeness claim ("every trade", "any broker", "the only"), no promise, no identity-verification implication, no third-party names. (4) Image generated locally with bundled, licensed fonts. |
| K21 Month index and neutral search | Clear with conditions | F1 (98-100), F3b (120-123), P3 | (1) Results strictly alphabetical; never ordered or labelled by performance, popularity or "trending" for securities. (2) Symbol results never rate or score the security. (3) Queries are not logged with user ids. |
| K22 Billing hygiene, code part | Clear with conditions | H (Terms, payments, 177-187); F3b carve-out (125-127); ROSCA 15 U.S.C. 8403; California ARL (market Part C2 rows 21-22); 16 CFR 233.1 (row 24); FTC §5; COMPLIANCE §4 | (1) Test mode only; LIVE_BILLING stays off; no live key handling changes. (2) No Terms or Privacy text written as final (owner, H). (3) Cancel completes without any intermediate offer or step that delays it ("simple mechanism"). (4) Reminder and renewal emails carry no handle, symbol, return or record field and fire only on billing events (F3b carve-out); annual reminder for monthly plans is described as prudent, not legally required (Part C2 correction 1); annual plans keep the 15-45-day window (F-3's 30-40 days fits). (5) No email is actually sent until the owner sets a sender (credentials). (6) No "was" price from a test arm; no copy implying paid data is more accurate. |

#### Notes

1. **Legal ranking (not a vote).** K1, K6 and K5+K2 close POLICY gaps that already exist on main or block the first real
   user (F3 in plain view; vendor market-data clause; U2/U3 "before launch"). K3 is legally fine as scoped but adds a
   data flow that the Privacy Policy must describe before any real user. K18 is mostly already in place.
2. **Slot interactions with legal weight.** K5 and K2 share the report/handle surface with F-9 and #42; K4's hide switch
   should reuse F-9's queue. K1 must not wait on K7/K11; if they collide, K1 lands first.
3. **Business checklist cross-reference.** K2/K4/K5 together equal B8 (minus F22 card 404s and F18 deleted-user joins,
   which are defects for the fixes list and are deletion-correctness items under P6: they should be fixed before Beta).
   K6 equals B6.
4. **"Not on the ballot" list: placement check.**
   - **Wrongly placed in part: BC-11 (F-7).** Sending F-7 to "F-7's own committee" is right for scope, but its legal
     calls are owner-reserved, not committee calls: T2 (real people), the statutory commercial-use bar on the
     legislator source, and the fact that F-7 profiles bypass the launch gate and P6 (business §1 item 6). The
     real-filer switch must default off. The chair should route those three calls to the owner explicitly.
   - **Fixes list carries a POLICY item.** Fix #3 (disclaimer placement) is an F3 compliance gap on main, not a cosmetic
     defect; it should be at the top of the fixes list. Same for F22/F18 (P6 deletion correctness).
   - **K18 and K4 contained owner-reserved parts on the ballot** (automatic deletion; email sender). Reshaped above
     rather than removed.
   - **K17** sits on a cycle-1 owner flag (C16) that is still open. The council may approve it (owner decision
     2026-11-01, POLICY.md:183-187), but if the owner rules on C16, that ruling wins.
   - Everything else on the list is correctly placed: C18/MRC2-7 (prices, waitlist emails: H), MRC2-3/MRC2-4 (DESIGN and
     IDEAS changes), MRC2-10 (vendor letter), MRC2-11 Terms text (H), BC-1/5/8/9/10/12/14/16/18 (owner: vendor mail,
     protected paths, dependency, Terms/Privacy, budget, deletion of vendor connections, DECISIONS), DSP-2..8 (idea
     board), O-1..O-18.
5. **Section 1 checklist.** Every approved build answers COMPLIANCE §1 under `## Compliance` in its PR body; K3, K4,
   K5, K17, K18 and K22 must answer Q2 (fields, location, visibility, deletion) explicitly; K4 and K22 also Q4.
6. **T1 hygiene for this cycle's texts.** Market Part C2 withheld several URLs for T1; any council text that lands in
   the public repo (FC-LM-10: repo is public) keeps that rule. I name no third party here beyond integrated vendors.

#### Round 0: common sense

Lens: the reasonable first-time trader, first-time viewer and careful owner. Context checked on main 31004e7:
pre-launch, three demo traders, no traffic, no real users. None of cycle 1's 25 fixes is on main yet. Examples:
`app/ui.tsx:11` still says "Cannot be edited" (fix #9), and `app/pane.tsx` has no DISCLAIMER (fix #3). F-9..F-14 and
PRs #40/#42/#46 are running. `app/globals.css` (511 lines) and `lib/copy.ts` (699 lines) are already the most-edited
shared files (coordination-2026-11-01.md, "Known overlaps").

Rule of thumb: do the honesty fixes first, then add new things. Don't run a measurement test with no one to measure.
Don't put a wide restyle on top of six sessions that are editing the same files.

| Candidate | Verdict | Reason | Veto conditions |
|---|---|---|---|
| K1 Disclaimer guard | reshape (no slot) | It's an e2e test that rides with fix #3. Cycle 1 already ruled that (record line 151, fixes preamble). Spending a feature slot on a test is out of proportion. | Veto if it takes a slot while fix #3 is unbuilt, or if it ships before fix #3 (a guard that fails on main by design). It must cover the OG images, and a fixed bar must never cover the line. |
| K2 Handle and name integrity | sensible with conditions | Cheap protection against impersonation, and POLICY U2 needs it before launch. A viewer expects "Verified" in a name to mean something. | Start only after #42 merges. The reserved list has no trademarks or real names (T1). Look-alike checks run only against reserved, demo, connected and F-7 handles, never every string. Every rejection names the rule in plain words. No 301 machinery. Retiring handles stays the owner's (O-9). |
| K3 Measurement foundation | sensible with conditions (split) | The gates can't be read without counts, so this is the one "infrastructure before traffic" item that makes sense. At 3-5 sessions it's the biggest item here. | Split it. This cycle: the view rollup plus the `via` registry and tags. Share-action rows come only if they stay additive. No cookie, no viewer id, no IP or user agent stored, counts only. The share columns are not dropped or overwritten (schema guard, no data deletion). The readout is descriptive, with the strict DESIGN numbers shown beside any redefinition. Privacy Policy text is a blocker before real users. |
| K4 Digest and hide switch | reshape (merge with K5, after F-9) | A hide switch and a runbook are sensible launch homework. An emailed digest needs a vendor and credentials (owner), and with zero reports it would show zeros every day. | No email this cycle: use an owner-only page. Hide never deletes, and every hide writes an audit row with a reason. Reuse F-9's queue and `lib/reports.ts`; don't build a second queue. No personal data in any digest. |
| K5 Profile report, takedown, anti-scam line | reshape (one slot with K4, after F-9 merges) | A report link on profiles and a takedown page are basic and honest. The fixed anti-scam line belongs on the profile. On the share card it's clutter: the card already carries the disclaimer, the Demo badge and the trust line. | The line goes on profiles only. The card image is unchanged unless the owner and F-4 agree. The owner approves the takedown and line wording. It reuses F-9's reports, with no parallel table. The report form must not ask the reporter for more personal data than the report needs. |
| K6 Open-positions gate | reject (send to owner) | It qualifies the owner's F-6 decision and TR-4, and pre-launch there is no real user it would act on. That's the owner's call, not a vote. | The council does not approve it. If the owner adopts it: the count-only line must always show, so hiding is never silent (TR-4), demo stays unchanged, and it is recorded as a temporary exception with an end condition. |
| K7 One trust language | sensible with conditions (one slot with K9) | Three "Verified" wordings and three Demo names confuse a first-time viewer. This is the real honesty item in the design set. | Build fixes #2, #8, #9 and #10 first. Start after F-10..F-13 merge, or as additive edits that don't fight them. "Verified" must link to its definition. Demo must never read as verified. The card Demo hue stays with the owner (O-2): the card palette is not changed here. The ban tests are added and no existing test is weakened. |
| K8 Labels, number format, tone | defer (next quiet cycle), helpers only now | It's right, but it means about 45 assertions in 16 files while F-10..F-12 edit the same files. Fixes #6, #23 and #25 already take the misleading parts. | Not this cycle beyond the helpers F-10..F-12 need. Later: confidence() and ranking stay untouched, pinned tests are updated and never deleted, and the property test lo ≤ avg ≤ hi covers every surface. The line "the range is for the average, not one trade" is fine now if it rides with an existing build. |
| K9 Tokens and contrast test | sensible with conditions (one slot with K7) | A contrast test that stops regressions is cheap and permanent. Fixes #13 and #14 fix today's ratios. | Value-neutral first: no visible base or accent change (that is V-1/K12). Land fixes #13-#15 first, or as part of this build. One PR, merged in a quiet window after the F-10..F-13 globals.css edits. |
| K10 Layout and reflow | reshape (fold into fix #19, rest later) | The 405 px overflow and the clipped cards are fix #19 already. A nav redesign with an "interim" label is churn that F-13 (nav label) and K14 would redo. | Don't approve as a feature. The overflow parts go with fix #19. The warn Notice can ride with K9's --warn token. The nav waits until F-13 merges and is decided once, not changed twice. |
| K11 Image palette and trust band | defer | It's blocked by owner flags O-2 and O-4, and F-12 owns the image files. The 22 px disclaimer is already fix #3. | Not before O-2/O-4 are ruled and F-12 merges. The "+12,34" clipping is a defect and goes to the fixes list now. |
| K12 V-1 neutral base and accent | reject (this cycle) | A three-way variant test with no traffic measures nothing. It restyles the product while six sessions are building. "Trade dress" is a legal argument, not a measured one. | If revived: after K9, with the owner or a human choosing by eye, and no claimed metric until there is traffic. |
| K13 V-2 type, spacing and radius | reject (this cycle) | Size L. It touches globals.css everywhere, three times over (three variants), for no user-visible problem that has been reported. | Same as K12. A quiet cycle only, after K9. |
| K14 V-3 signed-in nav labels | reshape (no variant test) | Picking a nav label that fits doesn't need three branches. Settle it once with F-13's nav label. | No three-version build for a label. Fold it into F-13 or a later K10. The label must fit at 320 px with a 20-character handle. |
| K15 View as public | defer | It's useful for P6 confidence, but with no real traders nobody needs it yet. | Revive when F-7 or real traders exist. The parity test must compare the real public render, not a copy of it. |
| K16 Feed reading mode remainder | defer | Fixes #16-#18 are unbuilt, and F-10/F-13 are editing the feed. Polishing a moving feed means building it twice. | After fixes #16-#18 and F-10/F-13 merge. |
| K17 Demo preview at connect | sensible, but owner | A trader seeing exactly what becomes public before connecting is the most common-sense item on the list. But F-1 is owner-decided and the owner hasn't ruled on C16. | Recommend it to the owner; don't approve. If adopted: it's clearly labelled Demo or simulation, shows exactly the public fields (nothing more), and never imports before consent. `preview_viewed` waits for K3. |
| K18 Age-law posture | sensible with conditions | Pinning the signed-out order and logging the attestation version are cheap and honest. | Hide on report, never delete on report alone: a false report must not wipe an adult's record (and the council can't delete data). Deletion goes through the existing account-deletion path after owner review. The log stores date and version only. |
| K19 Sitemap and SEO | reshape (fix-sized, no slot) | XS, with an effect only after week 8. Fine to ride with fixes. | No slot. Demo profiles in the sitemap stay labelled Demo on the page. The 10-bet floor holds. The glossary page waits for K8's terms, so wording isn't written twice. robots.ts is unchanged. |
| K20 Home link preview | reshape (fix-sized, no slot) | Under an hour. Cycle 1 already routed it to the fixes. | No name or logo before clearance (T5a, O-10), no figures, no "every/any" claims. |
| K21 Month index and search | reject | Nothing has changed since cycle 1 ("premature with three demo traders"). | If revived: alphabetical only, never ordered by performance. |
| K22 Billing hygiene, code | sensible with conditions (small, or ride with a chore) | Pinning "no save step, no fake was-price, no accuracy upsell" before billing ever goes live is cheap and protects trust. `lib/billing.ts:206-211` already opens straight on cancel, so this is mostly tests. | Test mode only. LIVE_BILLING is untouched. No Terms text (owner, POLICY H). It shouldn't take a full slot if it's only tests and one copy check. |

## Notes

**Slot proposal (common sense):** at most 4 of 6 slots this cycle. That leaves room for the 25 fixes and the six
running features to land.
1. K3 (split, first half).
2. K2 (after #42).
3. K4+K5 merged into one trust-and-safety slot after F-9.
4. K7+K9 merged into one "trust language and tokens" slot, sequenced after fixes #2/#8/#9/#10/#13-#15 and the
   F-10..F-13 globals.css edits.
K18 and K22 are small and can ride with K4+K5 and a billing chore. K1, K10 (overflow part), K19 and K20 ride with the
fixes list. Leaving slots empty is a sensible outcome, not a failure. Six concurrent sessions are already on the same
shared files.

**Bundling:** K7-K11 count as one slot by the file rule, but as one build they'd be about M+M+S-M+S-M+M across 15+
files. That's too wide to review or merge safely. Split by readiness instead:
- K7+K9 now (no owner block).
- K8 later (wide diff).
- K10 into fix #19 and F-13.
- K11 after O-2/O-4.

K12-K14 are variant tests. With no traffic they can only be judged by eye, so they wait for a quiet cycle.

**Big precondition:** none of cycle 1's fixes is on main. Several candidates (K1, K7, K9, K10, K11, K16) assume
those fixes have landed. I'd ask the chair to make "fixes #2, #3, #8-#10, #13-#15, #19 merged" an explicit start
condition, not a "possible overlap".

**Chair's "not on the ballot" list:** it makes sense. Sending owner flags, process proposals and idea-board
amendments elsewhere is right, and so is blocking C2 on #42. Two additions:
- K6 and K17 belong on that list too. Both touch owner decisions (F-6 TR-4, F-1 no import before consent). They
  should go to the owner with a recommendation, not through a vote that the decisions-keeper veto would void anyway.
- K1, K19 and K20 are fix-sized and arguably belong with the fixes list rather than on the ballot.

One question: D23 "testing" with no traffic (C4) is held for the same reason I'd hold K12-K14. That's consistent, good.


### Round 1: first-vote ballots

#### Round 1: Business lead
| Candidate | Score | Reason |
|---|---|---|
| K2 | 3 | No gate moves, but U2 lists it as a launch prerequisite and real records are scam bait (MRC2 finding 10, MRC2-6). A cheap guard on the core asset. Start after #42. |
| K3 | 5 | The only candidate that makes the week-8 gates G2-G4 readable at all (MRC2 §1 finding 1, FACT High; DESIGN §3.5). Without it the kill or continue call is made blind. First slice as reshaped, strict DESIGN numbers reported. |
| K45 | 3 | U2/U3 require report and takedown before launch. It protects trust in shared records, which G3 depends on. Zero gate lift itself. Owner-only page, no email, after F-9. |
| K7 | 3 | "Verified" is the whole wedge, and three wordings dilute it. Market row 20 rates it ~0 on the gates, though. The false tooltip is already fix #10. Worth one slot with K9 only after F-10..F-13 merge. |
| K8 | 3 | Strongest viewer-side demand evidence on the list (D24 Strong; numeracy and CI misread, FC-R18/R19; MRC2-5 top five). It moves D7 a little. It's wide across files six builds are editing, so it should go after F-10..F-12, or as helpers plus the "What's this?" line now. |
| K9 | 2 | A permanent regression guard, but no demand or gate effect. The measured contrast defects are already fixes #12-#14 and #26. |
| K11 | 1 | Blocked by owner flags O-2/O-4 and by F-12 owning the images. Clipping and the 22 px disclaimer are already fixes #2 and #9. Nothing left for a slot now. |
| KV | 1 | Three versions with no traffic measure nothing (the same reason C4/D23 is held). The pane-open and sign-in measures need K3 first. It would restyle files that six builds are editing. |
| K15 | 2 | Market chair names "first session shows what visitors see" a supply lever (§2 row 12, S +3-8 HYPOTHESIS). But no real trader exists yet and it needs #42. Cheap to build before the first connect. |
| K16 | 2 | SW-1 Must with plausible D7 effect (row 7), but fixes #16-#18 take most of it and F-10/F-13 are moving the feed. |
| K17 | 2 | The supply logic is good (preview replaces fear, row 11), but a Demo-only preview is weak evidence and the owner's C16 flag is open. Recommend it to the owner rather than spend a slot. |
| K18 | 2 | Cheap and honest, and mostly already stored. No demand effect. Should ride with K45 rather than take a slot. |
| K19 | 1 | Effect lands after week 8 (MRC2-13 says low priority). Fix-sized. |
| K20 | 2 | Under an hour, and founder outreach links point to "/" (MRC2-4), so a clean preview helps the one channel we have. Ride with the fixes, no slot. |
| K21 | 1 | Three demo traders: nothing to index or search. Nothing has changed since cycle 1. |
| K22 | 1 | Charges are off and no revenue flows before launch. Mostly tests on code that already cancels directly (lib/billing.ts). Ride with a chore, no slot. |

#### Round 1: Market research lead
| Candidate | Score | Reason |
|---|---|---|
| K2 | 4 | Real linkable records are better scam bait than screenshots (market §1 finding 10, RK-C2, FC-R28) and U2 makes reserved handles a launch prerequisite (market §2 row 17 "required"). Cheap; protects G3 and the brand. Start after #42. |
| K3 | 5 | The one true prerequisite: G2, G3 and G4 cannot be read without it (market §1 finding 1 FACT High, §2 row 1, §3.1 E1-E3 E5). Ship it with the 200 bot / 50 human validation before week 1 and strict DESIGN §3.5 numbers beside any readout. |
| K45 | 4 | Market §2 row 17 rates report action plus impersonation category "required" (U2/U3). Gate effect is protective, not growth. Digest as a page with zero reports is cheap; profile-only line keeps F-4 intact. After F-9. |
| K7 | 3 | Market §2 row 20 (P-3): plausible, gate effect about 0, mainly removes the identity misread of Verified (F3a). Honest and worth doing, but its comprehension check (T10 add-on) needs K3 and a survey first. Sequence after fixes #2 #8-#10. |
| K8 | 4 | Strongest viewer-side evidence we have: a third of US adults at or below the lowest numeracy level (FC-R19) and CI-of-mean misread (FC-R18); MRC2-5 is in the top five. Moves D7. Score is 4 not 5 only because of the wide diff while F-10..F-12 edit the same files. |
| K9 | 3 | Hygiene for A1 with no gate effect (market §2 row 25). Cheap and permanent regression guard; value-neutral. Ride in one slot with K7. |
| K11 | 2 | The anti-crop part has plausible V lift (market §2 row 14, +10-20% per share) but F-12 already owns that band; the rest waits on owner flags O-2 and O-4. Defer until F-12 merges. |
| KV | 1 | No traffic, so per-render tests need 1,000+ impressions per arm (market §1 finding 4, §3.3) and cannot read anything now. Same reason D23 is held. Restyle cost on shared files with no demand signal. |
| K15 | 2 | Plausible S +3-8 (market §2 row 12, HYPOTHESIS) but only once real traders exist; with three demo traders nobody uses it. Revive with F-7 or real connects. |
| K16 | 2 | SW-1 Must with a readable per-render metric (market §2 row 7), but only after K3 and traffic; F-10/F-13 and fixes #16-#18 are on the same feed files. Next cycle. |
| K17 | 3 | Market §2 row 11 / MRC2-9: preview replaces fear with facts, S +5-10, but T -3 to -10 and live only after P6 and G0. The Demo-only pre-launch version is the right shape; the owner's pending C16 ruling should decide, and preview_viewed needs K3. |
| K18 | 3 | No demand effect; it is legal risk reduction (market §1, MRC2-12, SB 976 from 2027). Small and reshaped safely (version string, hide on report, owner deletes). Could ride with K45. |
| K19 | 2 | Effect lands after week 8 (market §5.2 item 7, MRC2-13); the views gate is a supply and card problem, not search. Fix-sized; no slot. |
| K20 | 2 | Small indirect V effect via / to profile click-through (market §2 row 8, DV-X9). Under an hour; belongs with the fixes, not a slot. |
| K21 | 1 | No evidence of demand with three demo traders; wayfinding is hygiene (market §2 row 25). Nothing changed since cycle 1. |
| K22 | 2 | No demand effect before live charges; pricing evidence says conversion is the risk, not hygiene (market §1 finding 5). Cheap trust insurance; mostly tests since cancel already opens directly. Ride with a chore. |

#### Round 1: Pricing and finance

Basis (docs/direction/business-2026-11-01.md): revenue is $0 until billing goes live after the week-8 gates. Running cost is about $145/month (:101, :793). Agent spend was measured at $25.7 per session, about $290 per hour and $192 per merged feature (:112, :272, :635). So build spend is the cost that matters now. Break-even needs about 23 payers at 50 traders, which is about 9,200 viewers at 0.25% (:585, :794). The model's weakest input is viewers per trader (:1025, :1053). Sizes at $25.7 per session: S is about $25-50, M is about $75-130, L is $150 or more, and a three-version test costs three times that.

| Candidate | Score | Reason |
|---|---|---|
| K2 | 4 | S-M, about $40-80. It is a launch prerequisite (U2) that has to be paid for anyway, and it is cheap insurance against impersonation-scam liability. It waits for #42, so there is no rework cost. |
| K3 | 5 | M, about $80-130. It is the only candidate that buys information. The week-8 kill gates and the break-even model's weakest input (viewers per trader, at 40 against the 56-218 needed) can't be read without it. Every month the gates can't be read costs at least $145 plus agent spend. |
| K45 | 4 | S-M, about $50-80. Report, hide and takedown are required before the first paying user (U2, U3). It reuses F-9's queue, so the cost of building a second queue is avoided. Leaving out email keeps vendor cost at $0. |
| K7 | 3 | M, about $100. It has real honesty value, but fixes #1, #8 and #10 already buy the urgent part for free. Building it while F-10..F-13 edit the same files risks paying twice. Share K9's slot and start after those merge. |
| K8 | 2 | M, about 45 assertions in 16 files. Fixes #7 and #19 take the misleading parts, and a wide diff on files that running builds are editing invites rebase spend. Wait for a quiet cycle. |
| K9 | 3 | S-M, about $40-60. A contrast test pays for itself by stopping repeat fix cycles: cycle 1's contrast fixes are being paid for a second time now. Value-neutral. Same slot as K7. |
| K11 | 1 | M, about $100, and blocked by O-2/O-4 and F-12. The clipping and 22 px parts are already fixes #2 and #9. What is left is a palette refactor with no user or revenue effect now. |
| KV | 1 | Three versions each of V-1, V-2 (L) and V-3: roughly $400-900 of agent spend. With no traffic it yields no evidence, which is the same reason C4/D23 is held. It is the worst cost-to-value item on the ballot. |
| K15 | 2 | S, about $30, but it has no user until real traders or F-7 exist. That is cheap but early. Revisit at launch. |
| K16 | 2 | S-M. Fixes #15-#18 and F-10/F-13 are changing the feed now, so building on top of them means paying twice. Defer. |
| K17 | 3 | S, about $30. It works on the top of the trader funnel (connect rate), where every lost trader costs about 8.5 payers' worth of slope later. The owner's pending C16 ruling could void the spend, so 3, not 4. |
| K18 | 3 | S, about $25-40, and it is mostly a test plus one version string. It cheaply lowers the regulatory-fine exposure that the cost model leaves out. Fine to ride with K45. |
| K19 | 2 | XS, but its effect only starts after week 8, and it waits on F-7 and K8's terms. It should ride with fixes and not take a slot. |
| K20 | 3 | XS, under one session. A better link preview lifts click-through on every shared profile, the cheapest lever on the viewer count that break-even depends on. No slot needed. |
| K21 | 1 | S-M for search across three demo traders. There is no demand to measure, so this is pure spend before launch. |
| K22 | 3 | XS-S, mostly tests in test mode. It protects future revenue from chargebacks and refund disputes (the cost model assumes about 4% refunds, :430). It costs nothing to run now and should ride with a chore. |

Slot view (finance): fund K3, K2 and K45 first, at about $170-290 for three slots, plus K7+K9 together after the shared-file builds merge. K18, K20 and K22 ride along at XS cost. Leaving slots empty saves about $25.7 per session not spent.

#### Round 1: Growth
| Candidate | Score | Reason |
|---|---|---|
| K2 | 3 | A shared profile link is only worth opening if the handle can't be faked; cheap and launch-blocking (U2), no reward for activity; waits on #42. |
| K3 | 5 | The core growth gap: app/share-button.tsx shares a bare path with no via tag, so we can't tell if any record travels; counts-only via classes and additive share_action rows reward nobody (F6 safe). |
| K45 | 2 | Report and hide make shared links safe to land on, but they don't help records travel; keeping the line off share cards (F-4) is right; after F-9. |
| K7 | 3 | One Verified word linked to /how is what makes a forwarded card or profile credible to a stranger; worth it once F-10..F-13 and fixes #2/#8-#10 land. |
| K8 | 2 | Clearer numbers help a card read at a glance, but fixes #6/#23/#25 take the misleading parts and the 16-file diff fights running builds. |
| K9 | 1 | Contrast test is good hygiene with no effect on whether links or cards travel. |
| K11 | 2 | Clipped "+12,34" and a crop that cuts the trust word hurt shared images, but clipping is a defect for the fixes list and the rest waits on O-2/O-4 and F-12. |
| KV | 1 | Three variants on three demo traders measure nothing for sharing; pane-open and sign-in starts need K3 first. |
| K15 | 1 | Could give traders confidence before sharing, but there are no real traders yet. |
| K16 | 1 | Feed comfort for keyboard users; no effect on links or cards; feed files are moving. |
| K17 | 2 | Helps a trader decide to connect (supply side), but F-1 is owner-decided; recommend to the owner rather than build. |
| K18 | 2 | Pinning the non-personalized signed-out order keeps shared-link landings the same for everyone; small and honest, no growth upside. |
| K19 | 2 | Search is a slow second channel; effect after week 8; fix-sized, should ride with fixes after F-7. |
| K20 | 4 | "/" has no og image today (only a layout description), so a shared home link unfurls bare; under an hour, no figures, no name or logo; ride with fixes if no slot. |
| K21 | 1 | Search and month index don't make records travel with three demo traders. |
| K22 | 1 | Good billing hygiene, mostly tests; no effect on sharing. |

#### Round 1: UX lead
| Candidate | Score | Reason |
|---|---|---|
| K2 | 3 | Viewers trust a name more than a badge, so refusing "Verified", check glyphs and bidi tricks in display names protects the first-time viewer. Invisible until real users exist, and it waits for #42. |
| K3 | 3 | Not visible to users, but without first-party counts we can never tell whether first-time viewers open the pane or understand the record. Worth a first slice now since it is additive and stores no viewer id. With zero traffic it only pays later. |
| K45 | 3 | A report link and a takedown page on profiles are trust cues a first-time viewer expects. The anti-impersonation line on profiles only is right. The digest and hide script are owner tools with no user-facing UX. Starts after F-9. |
| K7 | 5 | Most direct trust fix for a first-time viewer. Today the same idea reads "✓ Verified" (app/ui.tsx:11), "✓ Verified from broker" (lib/copy.ts:130) and "Verified from broker" (t/[symbol]/opengraph-image.tsx:41), and Demo is also called "Sample data" on the same image. One label linked to its definition is what makes Verified believable. Build after fixes 1, 6, 8, 10. |
| K8 | 4 | Right on comprehension: readers take a range of the average as the spread of single trades, and jargon like "avg return" loses lay readers. Score held below 5 only because it is about 45 assertions in 16 files while F-10..F-12 edit the same files. Land the helpers now and the sweep after they merge. |
| K9 | 3 | A contrast test keeps low-vision readability from regressing, which is cheap and permanent. The visible colour fixes are already fixes 12, 13 and 26, so a first-time user sees little from this slot. Pair it with K7 on globals.css. |
| K11 | 2 | Image clipping and the 22 px disclaimer matter, but both are already fixes 2 and 9. The rest is blocked on owner flags O-2 and O-4 and F-12's image files. |
| KV | 1 | Three restyles judged on three demo traders tell us nothing about what users understand. Changing the base colours and type while six builds run risks inconsistency for the first-time viewer. Settle the nav label once with F-13 instead. |
| K15 | 2 | "View as public" builds trader confidence, but K17 answers the same question at the moment it matters (before connecting). No real traders yet, and it needs real auth after #42. |
| K16 | 2 | Keyboard and screen-reader feed fixes are worth doing, but fixes 15-17 cover the urgent parts and F-10/F-13 are still changing the feed. Do it once the feed stops moving. |
| K17 | 4 | A first-time trader's biggest fear is "what becomes public if I connect". A Demo record showing exactly the public fields answers it before consent, with no import. Held below 5 only because the owner's pending C16 ruling may change it. |
| K18 | 2 | Mostly in place already: the attestation is stored. Pinning the signed-out order and hiding a reported account are right but invisible to most users. Fine as a rider, not a slot. |
| K19 | 2 | A glossary page would help lay readers, but it should wait for K8's terms so the wording is written once. The sitemap only matters after week 8. Ride with the fixes. |
| K20 | 2 | A plain, honest preview for the home link helps the first click from a shared link. It is under an hour and fits the fixes list, not a slot. |
| K21 | 1 | Search and a month index add nothing with three demo traders. A first-time viewer reaches records through the feed and shared links. |
| K22 | 2 | Pinning "cancel at once, no fake was-price" protects future trust, but billing is test mode and lib/billing.ts already cancels directly. Mostly tests, so it can ride with a chore. |

#### Round 1: Product designer
| Candidate | Score | Reason |
|---|---|---|
| K2 | 3 | Sound integrity rule and every rejection names its rule, which keeps signup and rename flows clear. Mostly invisible on screens. Fine after #42 and reusing F-9's normaliser. |
| K3 | 3 | Not a screen change. The only visible part is a via tag on Share and copy-link, which must not change the share flow or the URL people see beyond one short param. Needed to judge any later design choice. |
| K45 | 3 | Profile report gives one report entry on both thesis and profile, which is coherent with F-9. A hidden profile must show one neutral notice, never a partial record. Line on profiles only keeps cards uncluttered. After F-9. |
| K7 | 5 | The biggest coherence gap on main. Demo state has four names today (Demo, Demo data at lib/copy.ts:136, Sample data at app/t/[symbol]/opengraph-image.tsx:41, Simulated at lib/copy.ts:289) and Verified has several forms. One TRUST_LOOK table fixes every surface at once. After fixes #1, #6, #8, #10 and F-10..F-13; one slot with K9. |
| K8 | 4 | One pct format, one tone with Flat and one glossary make every screen read the same. Right direction, but about 45 assertions in 16 files while F-10..F-12 edit them. Build the helpers now and the sweep after those merge. |
| K9 | 4 | A value-neutral token layer and a contrast test are what keep later screens consistent. No visible base or accent change. Shares globals.css with K7, so one slot and one quiet merge window. |
| K11 | 2 | One image palette matters for card coherence, but O-2 and O-4 are open and F-12 owns the image band. The clipping part is already fix #9. Wait. |
| KV | 1 | Three restyles of the whole product with no traffic to choose between them, on top of six running builds. V-3 is a label fit problem that F-13 and fix #18 can settle once. Same reason C4 is held. |
| K15 | 2 | A clean flow for traders, but no real trader exists yet to need it. Revive with F-7 or real traders, with a parity test on the real render. |
| K16 | 2 | Good flow polish, but fixes #16-#18 and F-10/F-13 are changing the feed now. Building it on a moving feed means building it twice. |
| K17 | 3 | The best flow idea on the list: a trader sees exactly what goes public before connecting. Demo data only, F-1 steps and consent above the fold unchanged. The owner's pending C16 ruling may still reshape it. |
| K18 | 2 | Mostly in place already. Pinning the signed-out order is cheap. The hide-on-report state should reuse K45's neutral notice, not a new screen. Rides with K45. |
| K19 | 2 | Fix-sized and effective only after week 8. Glossary page should wait for K8's terms so wording is written once. No slot. |
| K20 | 2 | Gives the home link the same unfurl quality as profile cards. Under an hour; ride with the fixes. No name, logo or figures. |
| K21 | 1 | A month index and search are wayfinding for a catalogue that has three demo traders. Adds a nav item nobody needs yet. |
| K22 | 2 | Correct and cheap, but it is tests on F-3 flows with no screen change. Ride with a chore, no slot. |

#### Round 1: Data-visualization designer
| Candidate | Score | Reason |
|---|---|---|
| K2 | 3 | No chart or number effect. A display name with a check glyph or "Verified" next to a figure borrows trust it hasn't earned (F3a). Cheap, but it waits for #42. |
| K3 | 3 | Neutral for encoding. Counts-only readout with DESIGN §3.5 strict numbers beside any redefinition is honest. Nothing to read before traffic, and M cost on shared files. |
| K45 | 2 | Trust and safety work, no figures. The hide covers whole profile or thesis only, never one trade (TR-1), so the record's numbers stay complete. Not my lens. |
| K7 | 3 | The badge sits on the stats row with its definition visible, so the headline figures read with their source. Mostly copy. Fixes #1, #10 take the false parts first. |
| K8 | 4 | The core honest-encoding item: one pct() (U+2212, fixed decimals), Flat tone for 0.0%, chart line by its own end value (DS-12), "the range is for the average, not one trade" (TR-9). Fixes #7 and #19 take the worst parts. The rest needs a quiet window because F-10..F-12 edit the same files. Keep confidence(), ranking and the property test lo ≤ avg ≤ hi. |
| K9 | 4 | Light gain/loss ΔE00 2.8 under deutan and Verified 3.77:1 are measured encoding failures (fix #12, #26). A contrast-pair test stops the regression for good. Value-neutral and small. One slot with K7. |
| K11 | 2 | One image palette with a parity test is right (CSS and images show the same up/down). But the clipping and the 22 px disclaimer are already fixes #2 and #9, F-12 owns the band, and O-2/O-4 are open. Defer until after F-12. |
| KV | 1 | Restyles base, type and nav with no traffic to measure. Every variant would also need to re-pass CH-1 (0% on the axis, sign colour per DECISIONS #25). Same reason C4 is held. |
| K15 | 2 | The parity test that the owner sees the same figures as the public is good for P6. There are no real traders yet. |
| K16 | 2 | Keyboard and Back on a feed that F-10/F-13 are still changing. No number effect. Wait for fixes #16-#18. |
| K17 | 3 | Showing the exact public fields (headline, range, chart, open positions) on a Demo record before consent is honest. The figures must carry the Demo badge and the F3 line. The owner's C16 ruling wins. |
| K18 | 3 | A test that pins the signed-out lower-bound order is the TR-9 Ranking Must, so raw lucky averages never top the feed. The attestation version string is trivial. Small. |
| K19 | 2 | XS. A glossary of D24 terms helps people read the evidence line, but it should wait for K8's wording so it isn't written twice. Fix-sized. |
| K20 | 2 | No figures planned, so there's no encoding risk. Under an hour. Ride with the fixes. |
| K21 | 1 | Alphabetical-only is the right guard against a performance sort, but there's no demand with three demo traders. |
| K22 | 2 | No struck "was" price from a test arm is honest price display, and it's mostly tests. Ride with a chore, not a slot. |

#### Round 1: Accessibility specialist

| Candidate | Score | Reason |
|---|---|---|
| K2 | 3 | Bidi controls and look-alike glyphs also mislead screen-reader users, so the normaliser helps. Each rejection must name the rule in text tied to the field (WCAG 3.3.1, 3.3.3). Wait for #42. |
| K3 | 3 | Neutral for access, and the gates need it. Condition: the Share and copy-link buttons keep their accessible names and focus. A copy confirmation must be announced in a live region. The beacon adds no focus or motion. |
| K45 | 3 | Fine if the report action is a real button with a name and the form fields have labels. Errors and the "sent" state must be announced. The takedown page needs a distinct title (fix #21 pattern). The line on profiles should be plain text, not an image. |
| K7 | 4 | Good for A1. Today the badge's meaning sits in a title tooltip (app/ui.tsx:11), which keyboard and touch users can't reach (1.4.13). A linked badge with a visible definition fixes that. Moving the badge off the h1 stops long names pushing Demo off screen (fix #18). One slot with K9, after fixes #10/#18 and F-10..F-13. |
| K8 | 3 | Sign and Flat in text help 1.4.1 and 1.3.1. U+2212 is read as "minus", where a hyphen is often skipped or read as "dash". Plain words help cognition. But fix #19 already takes the harmful part (0.0% read as "Gain"), and a 16-file diff on top of F-10..F-12 risks regressions. Helpers now, the sweep later. |
| K9 | 5 | Core A1. lib/badge-contrast.test.ts guards only the Demo badge. A pair test over every token (4.5:1 text, 3:1 boundaries and focus, both schemes) stops fixes #12, #13 and #26 regressing. It is cheap and value-neutral. Land it with or after those fixes, in one quiet window for globals.css. |
| K11 | 2 | Images are not the accessible path: the alt text and page text carry the meaning. Clipped figures are fix #9 and the 22 px disclaimer is fix #2. The rest is blocked by O-2/O-4 and by F-12. |
| KV | 2 | V-2's rem scale would help 1.4.4 text resize. But three restyles with no traffic, on the most-edited files, risk contrast and focus regressions. Each variant must pass K9's test, so if it runs at all, it runs after K9. V-3's nav fit is already reflow fix #18. |
| K15 | 2 | Small access value. A parity test also catches hidden-content drift, but there are no real traders yet. |
| K16 | 4 | Direct keyboard and screen-reader value, and SW-1 Musts (DESIGN:388-390): Back lands on the same card, the pane works by keyboard, and double tap no longer clashes with assistive gestures (2.5.1, 2.4.3). It is the remainder after fixes #15-#17, so start only after those fixes and F-10/F-13 merge. Overscroll containment must keep F-2's reject swipe and Undo. |
| K17 | 2 | Little access impact. Condition: the preview must not push the consent button below the fold at 320/360 px, or reflow breaks it. Owner's C16 ruling pending. |
| K18 | 2 | Neutral. The attestation version string has no UI. Any report category must keep a labelled, keyboard-usable form. |
| K19 | 2 | A glossary helps plain-language understanding (3.1.3 is AAA only). Fix-sized, rides with fixes. |
| K20 | 2 | Small. The og image needs a meaningful alt and no text-only meaning. Rides with fixes. |
| K21 | 2 | Search and a month index add a second way to reach pages (2.4.5). But with three demo traders the profile links already serve. Low value now. |
| K22 | 2 | Cancelling with no added step is good for cognitive access. Mostly tests. It shouldn't take a slot. |

#### Round 1: Engineer
| Candidate | Score | Reason |
|---|---|---|
| K2 | 4 | S-M, mostly a new lib/handles.ts plus signup/rename checks; no running build touches it; only gate is #42 merging (lib/auth) and F-9's normaliser, so it sequences cleanly. |
| K3 | 3 | Needed before any gate can be read, but M (3-5 sessions) with additive schema, beacon route and share buttons over lib/funnel.ts and app/api/events; fund only the first slice and keep it additive. |
| K45 | 3 | S-M and mostly new files (digest page, hide script, takedown page, runbook) but it hard-depends on F-9's unmerged lib/reports.ts; start only after F-9 merges or it forks the queue. |
| K7 | 2 | Its file list (app/ui.tsx, lib/copy.ts, app/pane.tsx, app/u/[handle]/page.tsx, app/layout.tsx, record-card, month-card) is exactly what F-7, F-10/12 and F-13 branches edit now; half its items are fixes #2/#8/#9/#10; do it after those merge. |
| K8 | 2 | About 45 sign assertions in 16 files, a wide diff right over F-10..F-12's card and strip files; rebase churn and pinned-test edits outweigh value with three demo traders; next cycle. |
| K9 | 3 | Small (globals.css plus one test) but globals.css is in F-7, F-12 and F-13 diffs, and F-13 already adds lib/a11y-contrast.test.ts; approve only as an extension of that test, not a second one. |
| K11 | 2 | M, and F-12 is rewriting the same trade/month/stock opengraph images and lib/month-card.ts right now; three branches touch t/[symbol]/opengraph-image.tsx; wait for F-12. |
| KV | 1 | Three versions each of three tests, V-2 is L and restyles globals.css broadly; no traffic to /choose with, same reason D23 is held; poor use of build capacity now. |
| K15 | 2 | S and low risk, but it edits app/u/[handle]/page.tsx which F-7 and F-13 both change; low value until real traders exist. |
| K16 | 2 | Feed files (feed-gestures, feed-keys, feed-rows) are in F-13's diff and fixes #16-#18 cover part of it; collision for modest gain. |
| K17 | 2 | S, but connect pages are edited by F-13 and #42, and F-1 is owner-decided with C16 still unruled; build after the owner rules. |
| K18 | 4 | S and narrow: one additive version column on signup_attempts/users (schema.sql:31,194 already log the attestation), one test pinning the signed-out order, hide-on-report rides K45/F-9. |
| K19 | 3 | XS; app/sitemap.ts gets a 3-line edit from F-7, easy rebase; glossary page is new; payoff only after week 8. |
| K20 | 4 | XS, one new app/opengraph-image.tsx (none exists at root), no running build touches it, no figures; cheap and safe. |
| K21 | 1 | S-M for no demand at three demo traders; /t pages are under fix-truthful-labels, F-7 and F-12 edits. |
| K22 | 3 | XS-S checks in test mode on merged F-3 billing files that no running branch touches; low risk, low urgency. |

#### Round 1: Reliability engineer
| Candidate | Score | Reason |
|---|---|---|
| K2 | 4 | Identity integrity: a rename today frees the old handle at once, so shared links and cards can land on a different person. A hold capped at one year with no link to a deleted person closes that. Small new lib/handles.ts with unit tests. Start only after #42 merges (lib/auth/attempts.ts). |
| K3 | 3 | Needed before the gates can be read, but it adds a write on every public page view. Use an idempotent daily upsert with no hot row lock, and a beacon that fails silently and never blocks render. share_action rows must be additive (CI drop guard). Old share columns stay readable. Split to the rollup plus via first. |
| K45 | 5 | First operational view of the loop. Today the sync tick result (ok, failed, unclaimed, stoppedAtDeadline) is only returned JSON and a log line (app/api/sync/route.ts:71), and nobody reads it. The digest page plus an audited hide that never deletes is a reversible incident tool. The runbook (restore with deletion replay, breach steps) is missing ops homework. After F-9, reusing its queue. |
| K7 | 3 | One TRUST_LOOK table plus ban tests are good regression guards. But it spans 11 shared files that F-10..F-13 edit now, so expect merge churn and rebase conflicts. Land after fixes #1, #8 and #10, then in a quiet window, sharing a slot with K9. |
| K8 | 2 | The lo ≤ avg ≤ hi property test is a real integrity guard, but fix #7 already moves surfaces to the arithmetic range. About 45 assertions in 16 files during running builds is a high collision risk. Defer, except for helpers. |
| K9 | 3 | A contrast CI test is cheap and stops regressions for good. It must be value-neutral and carry over lib/badge-contrast.test.ts so the test count never drops. Merge after fixes #12-#14 and the F-10..F-13 globals.css edits. |
| K11 | 2 | Blocked by owner flags O-2/O-4 and by F-12 owning the image files. The clipped figure is already fix #9. A palette parity test is nice, but not now. |
| KV | 1 | Three restyles of globals.css with no traffic to measure means three times the merge churn for no readable result. Same hold as C4/D23. |
| K15 | 2 | The parity test (owner preview equals the signed-out render) is a useful guard, but there are no real traders yet and it needs #42's session interface. Defer. |
| K16 | 2 | The feed is moving under F-10/F-13 and fixes #16-#18. Building it now means building it twice. After those merge. |
| K17 | 2 | Low ops risk if it is Demo-only with no broker call before consent. But the owner's C16 ruling is pending, and preview_viewed needs K3. Recommend it to the owner. |
| K18 | 3 | Cheap, and it fits the integrity rules: a version string on the existing attestation row, a hide on report that never auto-deletes, and a test pinning the signed-out order. It should share K45's hide mechanism and audit row, not build a second one. |
| K19 | 2 | XS. Ride with the fixes. The sitemap must drop deleted users (fix #4 covers app/sitemap.ts:12-15) and wait for F-7's sitemap edits. |
| K20 | 2 | XS with no data path and no ops risk. Fix-sized, so no slot. |
| K21 | 1 | Adds a search query path with no demand from three demo traders. Nothing has changed since cycle 1. |
| K22 | 3 | Mostly pinning tests in test mode (lib/billing.ts:206-211 already cancels straight away). Cheap regression protection before billing goes live. Ride with a chore, not a full slot. LIVE_BILLING untouched. |

#### Round 1: Legal and compliance
| Candidate | Score | Reason |
|---|---|---|
| K2 | 5 | Closes a POLICY U2 launch prerequisite and F3a (no "Verified" or check glyph in names). Legal as reshaped: generic and own-product words only (T1), hold at most 1 year with no link to a deleted person (TR-5, P6). Veto if any third-party or real name enters the list or fixtures. |
| K3 | 3 | Legally sound as reshaped (first-party, aggregate, no IP, user agent, cookie or viewer id; closed via registry; additive schema). But it adds a new P3/P6 data flow that the owner's Privacy Policy must describe before real users, and it has no one to measure yet. Veto if any stored row becomes per-viewer. |
| K45 | 5 | Fills POLICY U2 (report on profiles) and U3 (takedown page), both "before launch" and unbuilt. Reshape meets my conditions: no email until the owner sets a sender, hide never deletes, no thesis text in audit rows, takedown wording draft until the owner approves, no safe-harbor claim, line on profiles only and literally true. |
| K7 | 4 | Real F3a and P2 value (one Verified meaning, Demo never called verified, false tooltip gone, completeness-word ban tests). Fixes #1, #8, #10 take the worst parts first, so the remainder is consistency plus tests. Veto if F-7's label ever shows Verified or footer Terms/Privacy links drop. |
| K8 | 3 | Helps F3c and COMPLIANCE §11: ranges that contain their own average and "the range is for the average, not one trade" cut a misleading reading. Fixes #7 and #19 take the misleading parts; the rest is wide and collides with running builds. No advice words in the glossary. |
| K9 | 3 | Supports POLICY A1 with a permanent contrast test (4.5:1 text, 3:1 non-text and focus). Low legal risk. Measured defects already sit in fixes #12, #13, #26. No brand-matched colours, no hosted fonts. |
| K11 | 2 | Image disclaimer floor is F3-relevant, but fix #2 already raises it from 22 px and fix #9 covers clipping. The rest is blocked by owner flags O-2 and O-4 and F-12's files. |
| KV | 1 | No legal or compliance gain. Three variants with no traffic measure nothing. If built: no other product or brand named in specs or PR bodies, even as a comparison (T1, T4), each passes the contrast test, no new font or package. |
| K15 | 2 | Good for P6 confidence, but no real traders exist yet. Must be an exact signed-out render with no "view as another user" path, and must not rely on the dev auth stub. |
| K16 | 2 | A1 value, but fixes #16 and #17 carry the WCAG parts and F-10/F-13 are editing the feed. Like must never celebrate or reward (F6). |
| K17 | 3 | Lawful as reshaped: Demo data only, no broker call before consent, F-1 consent unchanged, shows exactly the public fields including "stays public after disconnect" (P6), F3 disclaimer on it. Still sits on the owner's open C16 flag; the owner's ruling wins. |
| K18 | 4 | Cheap and pins POLICY P4 and F1a posture: version string on the existing attestation (schema already stores adult_attested_at), signed-out non-personalized order pinned by a test. Veto if any automatic deletion, date of birth, ID or age estimation is added (H, BIPA); owner runs deletion. |
| K19 | 1 | Adds legal surface before launch: indexing records needs consent text saying profiles appear in search (owner), deleted profiles must leave with 404/410, and no F-7 public-filer profiles until the owner rules on T2. Little value with demo data; effect only after week 8. |
| K20 | 2 | Small and fine if no product name, logo or wordmark before clearance (T5a), no figures and no completeness claim. Fix-sized; it should not take a slot. |
| K21 | 1 | No legal gain with three demo traders. If revived: strictly alphabetical, never ranks or scores a security (F3b), queries not logged with user ids. |
| K22 | 4 | Pins ROSCA-style simple cancellation, no fake "was" price (16 CFR 233.1) and no "paid data is more accurate" copy (FTC §5) before billing ever goes live. Mostly tests, test mode only, LIVE_BILLING untouched, no Terms text, no app-sent email (F-3). Should ride as a small item, not a full slot. |

#### Round 1: Trust and safety

Lens: harm and misuse, scams, impersonation, who gets hurt. Base origin/main 31004e7. Facts checked: a rename frees the
old handle at once (lib/auth/attempts.ts:107 updates the handle; only account deletion writes handle_reservations,
lib/delete.ts:56). The handle check (lib/auth/attempts.ts:41) has no reserved product or staff words. No display-name
normalising exists outside F-9's thesis work. Reports cover theses only (F-9). Real, linkable records are scam bait
(MRC2-6), so impersonation and report handling come before polish.

| Candidate | Score | Reason |
|---|---|---|
| K2 | 5 | Closes the main impersonation hole: today a rename frees the old handle at once and anyone can take "support" or put "Verified" or a check glyph in a name. Keep the look-alike check narrow so honest traders are not wrongly refused. |
| K3 | 2 | Doesn't reduce harm. It is acceptable as scoped (aggregate counts, closed via registry, so a link tag can't track a person), but it adds a data flow before any safety tooling exists. |
| K45 | 5 | Victims of impersonation need a profile report with an "impersonating this trader elsewhere" category, a hide that never deletes, and an owner view of open reports before the first real user. The profile line warns viewers about fake chat groups. Rate-limit reporters so mass reports can't be used to bury a rival; only the owner hides. |
| K7 | 4 | A scammer can use a screenshot of "Verified" to suggest the person's identity was checked. One bare Verified word linked to its definition, Demo never read as verified, and no false "Cannot be edited" make the badge harder to misuse. Do fixes #1, #6, #10 first. |
| K8 | 2 | Some benefit: lay readers stop reading the average's range as a per-trade promise, which feeds "guaranteed returns" pitches. Too wide to build now beside F-10..F-12. Fixes #7 and #19 cover the misleading parts. |
| K9 | 2 | Accessibility value, not a misuse control. Fine when the fixes have landed. |
| K11 | 2 | A crop rule that keeps the disclaimer and trust word on travelling images limits doctored-looking screenshots. It is blocked by O-2/O-4 and F-12, and fix #9 covers the clipping. |
| KV | 1 | No safety effect, a restyle three times over, and no traffic to judge it. |
| K15 | 2 | Helps traders see exactly what strangers see, so they can spot exposure (doxxing, targeting). There is no real trader to protect yet. |
| K16 | 1 | No harm or misuse dimension. It waits for fixes #15-#17 and the feed builds. |
| K17 | 3 | Informed consent: a trader sees what becomes public before exposing it, which reduces regret and targeting. Demo data only. The owner's pending C16 ruling wins. |
| K18 | 4 | Protects minors with an immediate hide on a "may be under 18" report and a pinned non-personalized signed-out order. Guard against misuse: a false report only hides, the owner reviews before any deletion, and report volume per reporter is limited. |
| K19 | 1 | More indexing makes real traders easier to harvest for scam targeting, with no benefit before week 8. Wait for launch and the consent text that mentions search engines. |
| K20 | 1 | Harmless, fix-sized. No safety value and no slot needed. |
| K21 | 1 | Handle search makes it easier to enumerate targets and find look-alikes, and with three demo traders nobody needs it. If it comes back, alphabetical only, after K2. |
| K22 | 3 | Protects paying users from dark patterns (cancel delays, fake was-prices, an "accurate data" upsell). Cheap tests in test mode. It should ride with a chore, not take a slot. |

#### Round 1: Decisions keeper
| Candidate | Score | Reason |
|---|---|---|
| K2 | 4 | Carries out decided items: trademark timing reserves support/official/look-alike handles (IDEAS.md:116-120), U2 launch prerequisite; reshape keeps the hold within TR-5's one year (DESIGN:328, IDEAS.md:94-98) and reuses F-9's normaliser, so no conflict left. |
| K3 | 4 | No conflict as reshaped: aggregate only, no identifier, so it is not F-2's opt-in activity log (F-2 Decisions :45-51); additive schema; matches GTM 2026-11-01 no-cookie and DESIGN 3.5 strict numbers; idea 13 lists counters as week-0 prerequisite. |
| K45 | 4 | Fills the gap F-9 left on purpose (F-9 Decisions :23-24); reshape removed the conflicts: whole profile or thesis only (TR-1), no card line (F-4 owner layout), no email before the owner picks a sender, takedown wording the owner's. |
| K7 | 3 | Consistent only if D25, D27, F-4 and F-1 owner wording stay verbatim and F-7 label stays with F-7; the f13 branch already rewrote D27 once, so this wide copy sweep is the likeliest place for decided lines to drift. |
| K8 | 3 | Agrees with F-4 2026-10-31 arithmetic range and D24 one word for a bet; but sits next to owner flags O-15/16/17 and D23 testing, and touches 16 files under F-10..F-12; fine if confidence(), ranking and pinned wording are untouched. |
| K9 | 4 | Value-neutral token layer and a contrast test conflict with no decision; base and accent stay put (settled conflict 9, only V-1 changes them); must rebase on the fix branch values, not a second set. |
| K11 | 2 | Two owner flags (O-2 card Demo hue, O-4 Disconnected on cards) carved out, F-12 owns the band (F-12 :16-18) and F-4 owns card layout; what is left is thin and has to wait for F-12. |
| KV | 1 | Not a veto (three-version rule is met in form), but the same no-traffic reason holds C4/D23 off the ballot (cycle 1 Waiting table); approving these while C4 waits is inconsistent with the council's own record. |
| K15 | 2 | No decision conflict, but it must read the session interface after #42, never the stub (CLAUDE.md); no real traders yet to need it. |
| K16 | 3 | Consistent with SW-1 and F-2's reject swipe and Undo (F-2 Decisions :13-28) if those stay intact; should follow fixes #16-#18 and F-10/F-13 rather than race them. |
| K17 | 2 | The Demo version does not break F-1 (no import before consent, F-1:102-141), but cycle 1 sent C16 to the owner and the owner has not ruled; approving now pre-empts a pending owner flag. |
| K18 | 4 | Reshape matches F-1 2026-10-22 (attestation on signup_attempts) and D26 versioned consents; hide on report, deletion only by the owner (POLICY H); pinned signed-out order matches TR-9 and F-2 Off order. |
| K19 | 3 | Must wait for F-7 (sitemap in flight) and must not invite indexing while the launch gate is closed, since launch is the owner's (POLICY H); otherwise no conflict. |
| K20 | 3 | No conflict if it uses the positioning constant, not D27's line under amendment, and no name or logo before clearance (T5a, IDEAS.md:116-120); XS, fix-sized. |
| K21 | 2 | No decision conflict if alphabetical only (F3b, cycle 1 C13 condition); cycle 1 judged it premature with three demo traders and nothing has changed. |
| K22 | 4 | Reshape matches F-3 2026-11-01 (processor sends every billing email, cancel self-serve, paid never richer); in-app tests only, LIVE_BILLING off, monthly-plan notice left to the owner. |

#### Round 1: Common sense
| Candidate | Score | Reason |
|---|---|---|
| K2 | 4 | Cheap impersonation protection POLICY U2 needs before launch; a name saying "Verified" must not fool a viewer. Only after #42, rejections name the rule, no trademarks in the list. |
| K3 | 4 | The one infrastructure-before-traffic item that makes sense: the week-8 gates can't be read without counts. Only as reshaped: first slice, additive rows, no cookie or viewer id, strict DESIGN numbers beside any redefinition. |
| K45 | 4 | A profile report link, an audited hide that never deletes and a runbook are basic launch homework. Fine as reshaped: owner page not email, line on profiles only, owner approves takedown wording, after F-9. |
| K7 | 4 | Three Verified wordings and three Demo names confuse a first-time viewer; this is the real honesty item in the design set. Start after fixes #1, #6, #8, #10 and the F-10..F-13 merges, one slot with K9. |
| K8 | 2 | Right in substance, but about 45 assertions in 16 files while F-10..F-12 edit them; fixes #7 and #19 already take the misleading parts. Next quiet cycle. |
| K9 | 3 | A contrast test that stops regressions is cheap and lasting; value-neutral only. Fixes #12, #13, #26 do the visible part, so ride in K7's slot, merged in a quiet globals.css window. |
| K11 | 1 | Blocked by owner flags O-2 and O-4 and by F-12 owning the image files; the clipping and 22 px disclaimer are already fixes #2 and #9. |
| KV | 1 | Three restyles times three variants with no traffic measures nothing and churns globals.css under six running builds. Same reason D23 is held; a nav label needs no three-way test. |
| K15 | 2 | Useful for privacy confidence, but no real trader exists to need it yet; revive with F-7 or real users. |
| K16 | 2 | Feed is being rebuilt by F-10/F-13 and fixes #16-#17 are unbuilt; polishing a moving feed means doing it twice. |
| K17 | 2 | The most common-sense idea on the list, but F-1 is owner-decided and C16 awaits the owner. Recommend to the owner, don't take a slot over a pending ruling. |
| K18 | 4 | Small and honest as reshaped: version string only, hide on report never delete, pinned signed-out order, no age estimation. Can ride with K45. |
| K19 | 2 | Fix-sized with effect after week 8, and it waits on F-7's sitemap edits and the launch switch. Ride with fixes, no slot. |
| K20 | 3 | Under an hour and harmless as reshaped (no name, logo or figures). Worth doing but should ride with fixes, not use a slot. |
| K21 | 1 | Nothing changed since cycle 1: search and an index over three demo traders is premature. |
| K22 | 3 | Pinning no save step, no fake was-price and no accuracy upsell is cheap trust insurance; mostly tests since cancel already opens straight. Ride with a chore, not a full slot. |

#### Round 1: Red team
| Candidate | Score | Reason |
|---|---|---|
| K2 | 3 | Case against: sign-up is gated closed (lib/launch-gate.ts:61 already blocks allowlisted handles) and lib/delete.ts:13 already holds deleted handles 365 days, so pre-launch nobody can impersonate anyone. It still survives because U2 lists reserved handles as a launch prerequisite and the cost is S. It can stall a slot until #42 merges. Cheapest test: grep for a reserved list and a display-name check (none today), then try the sign-up handle "support" with the gate open locally. |
| K3 | 4 | Case against: there is no traffic, it is the largest item (M, 3-5 sessions) and it adds a P3/P6 data flow that blocks real users until the Privacy Policy describes it. It survives because the gates G1-G4 cannot be read at all without it, and definitions must exist before week 1. Cheapest test: try to compute any one G1-G4 number from db/schema.sql today (you can't; no view table exists). Build the first slice only. Drop it if the beacon needs any identifier. |
| K45 | 3 | Case against: with zero real users the digest shows zeros, nobody can file a report, and the takedown wording waits for the owner, so half of it ships as a draft. It survives because U2/U3 must exist before launch and it reuses F-9. Start only after F-9 merges. Cheapest test: list the U2/U3 launch items that are still missing on main after F-9 (profile report, notice page, hide audit). |
| K7 | 2 | Case against: the dishonest parts (demo called verified, "Cannot be edited", completeness words) are fixes #1, #8, #10, built without a vote. What is left is an 11-file refactor across files F-10..F-13 are editing now. Cheapest test: after the fixes merge, grep for "verified" on demo surfaces and for the banned words. If the count is zero, K7 adds consistency only, and that can wait for a quiet cycle. |
| K8 | 2 | Case against: the parts that mislead are fixes #7 (range excludes its own average), #19 (0.0% read as a gain) and #24. What is left is about 45 assertions in 16 files that F-10..F-12 are touching now, so merge-conflict risk is high. Cheapest test: once #7 and #19 land, run the lo <= avg <= hi property over every surface. If it passes, the remainder is wording polish. |
| K9 | 3 | Case against: a contrast test pins only the token pairs it lists, so literal colours and image palettes still regress. Fixes #12, #13 and #26 already change today's failing values. It survives because it is cheap, value-neutral and permanent. Cheapest test: count colour literals outside :root in app/globals.css and the image routes. If many remain, the test proves little until they become tokens. Keep it in one slot with K7. |
| K11 | 1 | Case against: it is blocked by owner flags O-2 and O-4 and by F-12, which owns these images. The parts that are actually wrong (22 px disclaimer, the clipped "+12,34" figure) are fixes #2 and #9. Approving it now only reserves future conflict. |
| KV | 1 | Case against: three versions on demo data with no traffic measure nothing. That is the exact reason C4/D23 was held (cycle 1 Waiting table), so approving KV is inconsistent. It also restyles globals.css three times while six builds edit it, and K13 is size L. Cheapest test: name one metric from the brief that has more than zero events today (none, since K3 doesn't exist yet). |
| K15 | 1 | Case against: there are no real traders, so nobody needs to check their public view. The parity test also needs real auth (#42). The signed-out profile URL already shows the public render to anyone, including the owner in a private window. |
| K16 | 1 | Case against: fixes #15-#18 already take the inert panes, focus, the like label and the covering bar. F-10/F-13 are editing the feed now, so polishing it means building it twice. Revisit after those land and a keyboard audit still fails. |
| K17 | 2 | Case against: the owner hasn't ruled on C16 (cycle 1 flag 1), and F-1 is owner-decided. No trader connects before launch. A Demo preview risks reading like the trader's own data unless it is labelled loudly. It is cheap and the honest intent is right. It should go to the owner as a recommendation, not take a slot. |
| K18 | 2 | Case against: the attestation is already stored (signup_attempts, users), so the only new part is a version string, a test pin and "hide on report". Hide-at-once on a single "may be under 18" report lets anyone hide any adult's record, which is a harassment tool and in tension with TR-1. Cheapest test: in the build, file one report from a fresh account against a demo profile and see whether it disappears. Require a signed-in, rate-limited reporter and owner review. |
| K19 | 1 | Case against: app/robots.ts allows "/" and app/sitemap.ts already lists every symbol, with no deleted-user filter (fix #4) and demo symbols that pages still call "verified" (fix #1). Adding profiles and a glossary pre-launch invites search engines to index demo data on a site that isn't open, and the effect only starts after week 8. Wait until launch. |
| K20 | 2 | Case against: with no name, no logo and no figures allowed (T5a), and the positioning line contested (DSP-2/DSP-3 at the idea board), the image is a single sentence that may need rewriting. It is cheap and low risk but also low value. It can ride with the fixes and doesn't need a slot. |
| K21 | 1 | Case against: nothing has changed since cycle 1 called it premature. With three demo traders a search box has nothing to find, and a month index duplicates the profile's own months. |
| K22 | 2 | Case against: billing is test mode with LIVE_BILLING off, and lib/billing.ts:206-211 already opens the portal straight on cancel. Most of this is tests for behaviour that already holds. It is a cheap ROSCA guard, so it can ride as a chore without a slot. |


### Round 3: debate arguments

#### Round 3 arguments: Business lead
- **K3 (high, 5):** It is the only candidate that decides whether week 8 is a kill or continue call made on evidence. The market chair's table puts it first: it makes S, V and D7 readable, and it must pass its own check before week 1 (≥95% of 200 scripted preview fetches dropped, ≥95% of 50 human visits counted; market-2026-11-01-cycle2.md §2 row 1, §3.1). It also warns that S as measured may fall 5-15 points once failed shares stop counting, so we need the true number early, not in week 8. Every other candidate's "what to measure" line (K8's T10, KV's pane-open rate, K15's first-share rate) depends on it. The reshaped slice stores no IP, user agent, viewer id or cookie, keeps the old share columns (no drop), and always reports the strict DESIGN §3.5 numbers (DESIGN.md:246).
- **K9 (low, 2):** No demand or gate effect: the market table files tokens and the design system under "Hygiene, ~0" (§2 row 25). Every measured contrast defect is already on the unvoted fixes list (the fixes list #12, #13, #26), so the user-facing harm gets fixed without a slot. What is left is a refactor of app/globals.css, the file most running builds (F-9..F-14) edit, which is pure collision risk now. I'd change my mind if it were cut to the test alone (a new lib/tokens.test.ts contrast-pair test, which doesn't exist yet) riding with fixes #12-#13, taking no slot.
- **K8 (high, 3):** It has the strongest viewer-side evidence on the ballot: D24 plain labels is rated **Strong** (§2 row 4), a third of US adults sit at or below the lowest numeracy level [FC-R19], and readers misread a CI of an average as the spread of single trades [FC-R18]. The "range is for the average, not one trade" line is the precondition for T10 (≥70% comprehension, n≥100), and T10 gates D23, the headline-order decision held this cycle. Its risk is width, not value: approve it as lib/format.ts helpers plus the "What's this?" line now, and the 16-file sweep after F-10..F-12 merge.
- **K22 (low, 1):** Charges are off (LIVE_BILLING) and no revenue flows before launch, so it protects nothing that exists yet. The code already cancels directly: lib/billing.ts:206-211 opens the portal straight on the subscription_cancel flow, with no save step. Three test-only checks are chore-sized. They should ride with a chore and not use one of six slots. I'd change my mind only if the owner turned on live charges before launch.
- **K16 (high, 2):** The best case is that SW-1 is a DESIGN Stage 5 **Must**, so the remainder is owed anyway. The market table rates the swipe hint, place memory and keyboard pane "Plausible (a Must anyway)", with D7 + and readable per render (+5 pts, ≥1,320 per arm; §2 row 7). Keyboard and screen-reader access is also POLICY A1. My score stays low because fixes #16-#18 take most of it and F-10/F-13 are moving the feed files. The honest high case is to approve it narrowly: place memory on Back plus overscroll, after those merge.
- **K15 (high, 2):** The market chair names it one of only three supply levers, and the other two are not features (§2 "Chair's reading": recruiting mix, gate readability, and "whether a trader's first session shows the record visitors see"). Row 12 estimates S +3-8 (HYPOTHESIS), because new traders currently land on an 8,347 px form with 49-60 inputs (design D-44). Its cost is S, and the parity test also proves the P6 promise. My score stays low only on timing: no real trader exists before #42. If the slots aren't full, it is the cheapest supply bet available.
- **K19 (low, 1):** MRC2-13 itself rates it low priority, and search effect lands after week 8, so it moves no gate in the window that matters. With three demo traders, "profiles past the 10-bet floor" yields almost nothing to index. It is XS: it belongs on the fixes or chores list, not in a slot. I'd change my mind after F-7 adds real public-source records past the floor.
- **K11 (low, 1):** Nothing in it can be built cleanly now. The card Demo hue (O-2) and "Disconnected" on cards (O-4) are owner flags, and F-12 owns the trade/month images and lib/month-card.ts. The visible harms (figure clipping, 22 px disclaimer) are already fixes #9 and #2. I'd change my mind after F-12 merges and the owner rules on O-2/O-4. What remains then (palette parity test, crop rule) protects image-first sharing, which is the G3 lever (§2 rows 13-14).
- **K21 (high, 1):** The strongest case for it is that F-7 (public traders, running now) will soon put more than three records on the site. Wayfinding is then the only route to a record that the feed doesn't surface. The search is alphabetical only and never ranks by performance, so it can't reward activity (F6). A month index also keeps shared month links from dead-ending (row 25 target: 404 rate under 1% of external landings). That case only holds after F-7 merges; today it serves three demo traders, hence my 1.
- **KV (high, 1):** The best case is about process: the design system can't change the base, type scale or nav labels any other way, because CLAUDE.md requires three versions for any product change. V-1 also moves the palette away from a generic look (T1 distance). Building the versions now and holding them for /choose costs S each for V-1 and V-3. It is still a 1 for me: with no traffic the variants measure nothing (the reason D23 is held), the pane-open measure needs K3 first, and V-2 is L on globals.css. If approved at all, it should come after K3 and only V-3.

#### Round 3 arguments: Market research lead
- **K2 (high, 4):** Real, linkable records are better scam bait than screenshots (market §2 row 17, RK-X6, FC-L28; §6 row 7 rates scam bait M likelihood, high impact). The research rates handle integrity plus a report action "required" under U2, so it is launch homework either way. Doing it now costs S and avoids a rename-hold or reserved-list scramble in week 1 when the first impostor appears. Red team's point (sign-up gated closed) is about timing, not need: start after #42 as reshaped.
- **K3 (high, 5):** Without it the kill gates G1-G4 (DESIGN §3.5) cannot be read at all: no view table exists in db/schema.sql and share events are mis-recorded (market §1 finding 1, FACT High; §2 row 1). Every other demand claim in the research, including K8, K16, K17 and KV, names a metric that depends on this. The research also gives a cheap acceptance test before week 1: ≥95% of 200 scripted preview fetches dropped and ≥95% of 50 human visits counted (§2 row 1). Cost of waiting is permanent: weeks of launch traffic that can never be counted afterwards.
- **K45 (high, 4):** §2 row 17 rates the profile report action and the impersonation category "required" (U2/U3), and §6 row 7 asks for a live report and impersonation category as the cheapest test of the scam-bait risk. Its gate effect is protective: one impostor story on a real record would cost more views (G3) than any feature here adds. As reshaped it reuses F-9's lib/reports.ts, uses a page not email, and hides without deleting, so the cost is small.
- **K7 (high, 3):** The research's honesty test for the product is whether viewers read "Verified" as "imported from the broker", not as identity or audit (F3a; §2 row 20 sets ≥70% on a T10 add-on, n≥100). Three Verified wordings and three Demo names make that test unreadable, because we would not know which wording people answered. One wording is the precondition for measuring the claim the whole product rests on. It should start after fixes #1, #8, #10 and share a slot with K9.
- **K8 (high, 4):** This is the strongest viewer-side evidence on the ballot. About a third of US adults sit at or below the lowest numeracy level (FC-R19), and lay readers take a confidence interval of an average as the spread of single trades (FC-R18). §2 row 4 ties it to D7 with a measurable signal ("What's this?" opens per profile view, T10 ≥70%). A range that excludes its own headline (fix #7) is the misleading part. The rest is what lets low-numeracy viewers read the record at all. Schedule it after F-10..F-12 merge to avoid the conflict risk.
- **K9 (high, 3):** Value-neutral and permanent: a contrast test stops regressions in every later design change, including the KV variants if they ever run. Market §2 row 25 rates it hygiene with no gate effect, so the case is cost, not demand: S-M, and it rides in K7's slot. Without the test, fixes #12, #13 and #26 can be undone silently by the next globals.css edit.
- **K17 (high, 3):** Supply refusal is the top fatal risk in the research: traders won't publish whole records with losses, and only green traders connect (§6 row 1). The cheapest test the research names before P6 is exactly this: an unconnected walkthrough on a Demo record with a losing open book, labelled SIMULATION. §2 row 11 estimates S +5-10 among publishers once fear is replaced with facts. If the owner rules on C16 first, that wins. Otherwise this is the only pre-launch probe of the fatal risk.
- **K16 (high, 2):** The swipe hint, place memory and keyboard pane are SW-1 Musts, and §2 row 7 gives one of the few per-render metrics we can read with modest traffic (pane-open in the first session, +5 pts, ≥1,320 per arm). The feed is the main viewer surface, so it decides D7. My score stays low only on sequencing: F-10/F-13 and fixes #16-#18 are on the same files now. Approve it after those merge and K3 exists, and it becomes a 4.
- **K15 (high, 2):** §2 row 12 (P-8) estimates S +3-8: new traders land on an 8,347 px form with 49-60 inputs (design D-44), which hides the thing they would share. Seeing exactly what visitors see is the precondition for a confident first share, and the parity test also guards P6. It costs S. What would change my score: F-7 or the first real connects. Then the first-share-within-7-days metric (n≥30) becomes readable.
- **K19 (high, 2):** SEO is the only zero-cost channel that compounds. The research lists it as channel 7 (0-100 visits by week 8, review at week 12; §5.2). Indexing lag means the pages must exist weeks before they pay off, so a late start costs more than an early one. It costs XS. My score is low because the effect falls outside the week-8 gates and demo pages should not be indexed before fix #1 and fix #4. Ride with the fixes after those.
- **K11 (high, 2):** Once an image is cropped it is just a screenshot again. The anti-crop band keeps the date, the trust word and the printed link next to the figure (DT-C5; §2 row 14 estimates V +10-20% per share). Card images are channel 1, about 100% of week-8 views in the research (§5 table row 1), so anything that keeps the link on the image hits G3 directly. It is blocked now by F-12 and owner flags O-2 and O-4. Approve the band part after F-12 merges.
- **K21 (high, 1):** The only argument for it is wayfinding hygiene: a 404 rate on shared paths under 1% of external landings (§2 row 25, D2 row 14). With three demo traders there is no demand evidence for search or a month index, and nothing has changed since cycle 1. What would change my mind: real traders past about 50, or measured 404s or dead ends on shared paths once K3 exists.
- **KV (high, 1):** In favour: a neutral base and ink accent widen trade-dress distance, and V-3 fixes a real nav-fit defect. But per-render tests need ≥1,000-1,320 impressions per arm (market §1 finding 4, §3.3). With no traffic and no K3, none of the three tests can read anything, which is the same reason D23 is held. Reshaping that would change my mind: drop the three-version test, take V-3's nav fit as a fix, and run V-1/V-2 only after K3 and about 1,000 weekly landings.

#### Round 3 arguments: Pricing and finance

Basis: docs/direction/business-2026-11-01.md. Fixed cost $145/month (:101, :793). Agent spend $25.7 per session (:112, :272). Revenue is $0 until the week-8 gates. Break-even is 23 payers at 50 traders, about 9,200 viewers at 0.25% (:585, :794).

- **K2 (high, 4):** It costs S-M, about $40-80, and it is a launch prerequisite (POLICY U2) that must be paid for before real users in any case. Doing it now, right after #42, costs less than reopening lib/auth later. An impersonation scam on a linkable record is an uncapped cost that the $145/month model leaves out. Insurance this cheap is worth a slot.
- **K3 (high, 5):** It is the only candidate that buys information. The weakest input in the break-even model is viewers per trader: 40 in the central case against the 56 needed (:1053, :1025). The week-8 kill gates can't be read without first-party counts. At about $80-130 it costs less than one month of fixed cost plus the sessions spent while the gates stay blind. Every other spend this cycle is a guess until K3 exists.
- **K45 (high, 4):** Report, hide and takedown are required before the first real user (U2, U3), so this is spend we can't avoid, only reorder. Reusing F-9's lib/reports.ts avoids paying for a second queue. Leaving out email keeps vendor cost at $0. At about $50-80 it is one of the cheapest ways to meet a launch gate.
- **K17 (high, 3):** At S, about $30, it works on connect rate, the top of the supply funnel. Each lost trader costs roughly one payer per 8.5 traders of break-even slope (:585). The money risk is that the owner's pending C16 ruling voids it. So the cheapest path is to send it to the owner with this Demo-only shape and build once the owner rules. That would cost one session, with no slot held on a guess.
- **K22 (high, 3):** It costs XS-S and is mostly tests on behaviour that already holds (lib/billing.ts cancel goes straight to the portal). The cost model assumes about 4% refunds and leaves out disputes and chargebacks (:430). A save step or a fake "was" price is how that line grows once billing is live. Pinning it now costs less than a session, so it should ride with a chore and not take a slot.
- **K20 (high, 3):** It takes under one session. Every link the founder sends during outreach points to "/", so a clean preview raises click-through on the only viewer channel there is. Viewers per trader is the break-even input we are short on (:1053). It needs no slot and can ride with the fixes.
- **K16 (high, 2):** The best case for it is that SW-1 is a DESIGN Must, so it will be paid for before launch anyway. But fixes #15-#18 and F-10/F-13 are changing the same feed files now, so building it this cycle means paying twice. It would earn a slot next cycle, once those merge and a keyboard audit still fails.
- **K15 (high, 2):** It costs S, about $30, and a parity test is a one-time spend that protects P6 for good. That is the best case. Its value is near zero until real traders or F-7 exist, so it should come back at launch prep and not take a slot now.
- **K19 (high, 2):** It is XS, and search is the only free viewer channel that compounds after week 8. That is the best case for it. But the effect starts after the gates are read, and the legal and trust-and-safety costs of indexing demo data pre-launch are real. It should ride with the fixes once launch is near, with no slot.
- **K11 (low, 1):** It costs M, about $100, for a palette refactor with no user or revenue effect now. The parts that are actually wrong (clipping, the 22 px disclaimer) are already fixes #2 and #9 at no slot cost. The rest is blocked by owner flags O-2/O-4 and by F-12's files, so building now risks paying for a rework. I would move to 3 only after F-12 merges and the owner rules on O-2/O-4.
- **K21 (high, 1):** Even its best case is weak in money terms. S-M spend, about $50-90, on search across three demo traders buys no measurable demand. My score is 1. I would only reconsider after K3 shows real traffic and a catalogue large enough that viewers fail to find records through the feed and shared links.
- **KV (high, 1):** The only financial case for it is that a choice made before launch is cheaper than restyling after real users arrive. That doesn't hold here. Three versions each of V-1, V-2 (size L) and V-3 cost roughly $400-900 and, with zero traffic, buy no evidence. That is the same reason C4/D23 is held. My score is 1. Rerun it only once K3 counts show at least 1,000 impressions per arm.

#### Round 3 arguments: Growth

- **K3 (high, 5):** We cannot tell today whether any record travels. app/share-button.tsx:52 shares the bare path built by lib/share.ts:13 `absoluteUrl` with no `via` tag, and the profile only reads `via` on the join CTA (app/u/[handle]/page.tsx:44, :295), so a share, a card unfurl and a typed URL all look the same. A closed `via` registry of source classes plus additive `share_action` rows measures the share loop without a per-person id, and counts nothing a trader could chase (no score, streak or reward, POLICY F6 at docs/POLICY.md:137). Without it the week-8 gates G2-G4 (DESIGN §3.5) are read blind.

- **K45 (low, 2):** Report, hide and takedown make a shared link safe to land on, and U2/U3 need them before launch. But nothing in it helps a record travel, and the slot rule caps us at six. Its own reshape already keeps the anti-impersonation line off share cards (F-4 layout), which is right. I would move up if it is scoped as the launch-blocking minimum (profile report plus hide plus runbook, reusing F-9's lib/reports.ts) and the digest page rides as a chore.

- **K9 (low, 1):** A contrast test is good, permanent hygiene, but it changes nothing about whether links or cards are shared or opened. The visible failures it guards (Verified 3.77:1, gain/loss under deutan) are already fixes #12, #13, #26, built without a vote. It should ride with K7 on globals.css or as an extension of F-13's lib/a11y-contrast.test.ts (EN's point), not take its own slot.

- **K18 (low, 2):** Pinning the non-personalized signed-out order is good for growth in one way: everyone who lands from a shared link sees the same feed. But the attestation is already stored (db/schema.sql, signup_attempts and users), so the new work is a version string and a test. RT's point stands too: hide-at-once on one "may be under 18" report is a tool to bury a rival's shared record. Ride with K45's hide mechanism, rate-limited, not a slot.

- **K22 (low, 1):** Billing is in test mode with LIVE_BILLING off, and lib/billing.ts:206-211 already cancels straight away. It has no effect on sharing or viewers before launch. Cheap tests worth having, but as a chore, not a slot.

- **K20 (high, 4):** "/" has no opengraph image at all (no app/opengraph-image.tsx; only a text description at app/layout.tsx:11), so every founder-outreach link to the home page (MRC2-4) unfurls bare while profile links unfurl as cards. It is XS, a new file no running build touches (EN), with no figures, name or logo (T5a) and no activity reward. If slots are tight it should ride with the fixes, but it must not be dropped.

- **K16 (low, 1):** Place memory on Back and keyboard pane help people already in the feed, not records leaving it. The feed files are moving under F-10 and F-13, and fixes #16-#18 cover the visible defects. Wait for those builds to merge.

- **K15 (low, 1):** "View as public" could give a trader the confidence to share their link, which is a real growth lever later. With no real traders yet it changes nothing, and F-3's parity work is fresh. Bring it back when the first real trader connects.

- **K19 (high, 2):** Search is the one channel that brings viewers to records without anyone sharing and without rewarding trading. A sitemap entry for /how and a glossary are XS and index no demo trader by name. But profiles in the sitemap must wait for launch and consent text (LG, TS), and fix #4 must drop deleted users first; I support only the /how plus glossary part, riding with fixes.

- **K11 (high, 2):** The image is the record that travels: a card that clips "+12,346%" to "+12,34" or crops out the trust word and disclaimer misleads whoever sees it forwarded. One palette with a parity test keeps forwarded images matching the page. I support it only after F-12 merges and with O-2/O-4 left to the owner; the clipping part should land now as fix #9.

- **KV (high, 1):** Honestly, I cannot make a strong case. The only growth argument is V-3: a signed-in nav that fits might raise taps on one's own record and so shares. But with no traffic and no K3 counters, no arm can be read, the same reason C4/D23 is held. Run it only after K3 has produced counts, and V-3 alone.

#### Round 3 arguments: UX lead

- **K7 (high, 5):** A first-time viewer meets one idea under three names today: "✓ Verified" with a tooltip that says "Cannot be edited" (app/ui.tsx:11), "✓ Verified from broker" (lib/copy.ts:130) and "Verified from broker" beside "Sample data" on the same stock image (app/t/[symbol]/opengraph-image.tsx:41), while Demo is also "Demo data" (lib/copy.ts:136). A stranger cannot tell whether these are three levels of trust, and the definition sits in a tooltip that touch users never see. The fixes take the false words out, but only one TRUST_LOOK table plus ban tests stops the next build from adding a fourth wording. As reshaped (D25/D27/F-4 lines verbatim, F-7 label left to F-7), it can start after F-10..F-13 merge and share K9's slot.
- **K8 (high, 4):** The headline numbers are the product, and lay readers misread them: a range of the average read as the spread of single trades (FC-R18), a third of adults at the lowest numeracy level (FC-R19), "Avg return" as a bare label (app/me/record/page.tsx:106, app/t/[symbol]/opengraph-image.tsx:61). Fixes #7 and #19 remove the wrong numbers, but not the unclear ones. I'd reshape it to remove the collision worry: the pct()/tone() helpers, the lo ≤ avg ≤ hi property test and the "the range is for the average, not one trade" line now; the 16-file sweep after F-10..F-12 merge.
- **K17 (high, 4):** The first-time trader's main question is "what becomes public if I connect", and today the connect flow can only answer it in words. A Demo record showing exactly the public fields answers it with pictures before consent, with no import, so F-1 2026-10-22 ("first sync depth is zero") is respected; C16 went to the owner only because it needed the trader's own data (docs/ideas/approval-2026-11-01.md:636). It costs S and stays loudly labelled Demo. If the council won't pre-empt the open owner ruling, send it to the owner as a strong recommendation with this exact Demo shape.
- **K15 (high, 2):** The one case for it: "View as public" plus a parity test is the trader's proof that nothing private leaks, which builds trust right before the first share. But K17 answers the same fear earlier, and no real trader exists yet. I'd only back it bundled with F-7 or the first real connects.
- **K11 (high, 2):** The case for it: a shared image is often a viewer's first contact, and a crop that cuts the trust word or a clipped "+12,34" figure undoes trust at once. But clipping and the 22 px disclaimer are fixes #2 and #9, and O-2/O-4 plus F-12's ownership block the rest. Revisit after F-12 merges, as a palette parity test only.
- **K2 (low, 3):** Not against it, but it gives first-time users nothing they can see before launch: sign-up is gated (lib/launch-gate.ts:61) and deleted handles are already held 365 days (lib/delete.ts:13). It can't start until #42 merges, so it holds a slot it can't use. What would raise my score: rejections that name the rule next to the field, and the look-alike check limited to reserved, demo and connected handles so honest traders aren't refused.
- **K18 (low, 2):** It is right but invisible to users: the attestation is already stored, so the new parts are a version string and a test. The visible part, hiding at once on one "may be under 18" report, can let anyone hide an honest adult's record, and that hurts trust (RT's case, TR-1). It should ride with K45 (signed-in, rate-limited reporter, K45's neutral hidden notice, owner review) rather than take its own slot.

#### Round 3 arguments: Product designer
- **K2 (low, 3):** Sound rule, but it has almost no screen today: sign-up is gated closed (lib/launch-gate.ts) and lib/delete.ts already holds deleted handles. Its only visible output is a rejection message, and it can't start until #42 merges, so a slot would sit idle. What would raise me: one shared rejection pattern ("This name can't be used: <rule>") tied to the field, used by sign-up and rename alike, and reuse of F-9's normaliser so names and theses are judged the same way.
- **K7 (high, 5):** It is the biggest coherence gap on main: one idea has three spellings ("✓ Verified" at app/ui.tsx:11, "✓ Verified from broker" at lib/copy.ts:130, "Verified from broker" at app/t/[symbol]/opengraph-image.tsx:41), and Demo is "Demo data" (lib/copy.ts:136) on cards but "Sample data" on stock images. The fixes remove the false parts (#1, #8, #10). Only a single TRUST_LOOK table keeps the next F-10..F-13 surface from inventing a fourth wording. Build it after those merge, in K9's slot, with D25/D27/F-4 lines verbatim. (Correction to my round 1: lib/copy.ts:289 "Simulated" is about paper accounts, not Demo.)
- **K9 (high, 4):** Tokens are how a design stays one design: every running build edits app/globals.css, and with no token layer and no pair test, each one picks its own literals and contrast regresses (fixes #12, #13, #26 are cycle 1's contrast fixes being redone). It is value-neutral, so nobody sees a restyle, and it is the base K7 and any later variant (KV) must sit on. Extend lib/badge-contrast.test.ts or F-13's contrast test rather than add a second one.
- **K18 (low, 2):** The attestation is already logged (db/schema.sql stores it), so the only real flow change is "hide on a may-be-under-18 report", and that is a hidden-profile screen K45 already has to design. Built separately, it adds a second hidden state and a report path anyone could use to hide an adult's record (RT's point). It should ride with K45 using its one neutral notice and audit row. The test pinning the signed-out order is fine as a fixes-list rider.
- **K8 (high, 4):** Every screen shows a percent, and today signs, decimals and tone differ by surface, so 0.0% reads as a gain and a range can exclude its own headline. That is the product contradicting itself, not polish. One pct()/tone() with Flat, plus "the range is for the average, not one trade" in What's this, makes the feed, profile, card and pane read as one product. To limit collisions: helpers and the property test lo <= avg <= hi now, the 16-file sweep after F-10..F-12 merge.
- **K17 (high, 3):** It is the only candidate that fixes a flow at the moment of decision: the trader sees exactly the public fields (headline, range, chart, open positions, "stays public after disconnect") before consent, not after. It is S, Demo data only, no broker call, and F-1's step order, wording, 24-hour timer and above-the-fold consent are unchanged. It is a 3 because the owner's C16 ruling is open. If the council will not take a slot, send it to the owner as the recommended shape for C16.
- **K15 (high, 2):** As a flow, "View as public" closes a real gap: a trader can't see what strangers see without signing out. A parity test (own view equals the signed-out render) also guards against drift between the two pages. It's a 2 because no real trader exists and it needs #42's session. Revive it with F-7 or the first real connects, or fold it into K17's preview so one "what the public sees" view serves both.
- **K11 (high, 2):** Shared images are the first screen a stranger sees, and today each image route hard-codes its own colours, so CSS and images can disagree on up and down. One palette with a parity test fixes that for good. It's only a 2 because fixes #2 and #9 take the clipping and the 22 px disclaimer, O-2/O-4 are open, and F-12 owns the band. Bring it back right after F-12 merges.

#### Round 3 arguments: Data-visualization designer
- **K9 (high, 4):** Two encoding failures are measured, not guessed: light gain and loss are ΔE00 2.8 apart under deutan (ds.md:505-506, fix #26) and light Verified is 3.77:1 (app/globals.css:110, fix #12). The fixes change the values once; today only lib/badge-contrast.test.ts guards anything, and only the Demo badge. The pair test in ds.md:573 (text ≥ 4.5, control and focus ≥ 3, both schemes) makes these failures impossible to reintroduce. Ask one addition: an up-vs-down CVD floor in the same test, so the gain/loss split is pinned too. It is S-M, value-neutral, extends the kept test (count never drops) and shares K7's globals.css slot.
- **K8 (high, 4):** This is the honest-number candidate. A printed range that excludes its own headline (+25.2% vs −12.5% to +20.6%) and a 0.0% painted red and read as "Gain" are both false encodings, and readers take a range of the average as the spread of single trades (FC-R18, TR-9). Fixes #7 and #19 repair today's instances, but only one pct()/tone() plus the lo ≤ avg ≤ hi property test on every surface stops F-10..F-12's new surfaces from repeating them. Reshape to win the collision vote: helpers, property test and the "What's this?" line now; the 16-file sign sweep after F-10..F-12 merge.
- **K17 (high, 3):** A trader should see the exact public encoding before consenting: headline, range, the CH-1 curve with 0% on the axis, and open positions (TR-4) as they will appear. A Demo record does that with no broker call (F-1's no-import-before-consent holds) and costs S. Conditions: Demo badge and F3 line on the preview figures, consent above the fold. The owner's C16 ruling wins if it comes.
- **K11 (high, 2):** Share images are where figures travel without page context, and their colours are literals in four files (app/t/[symbol]/opengraph-image.tsx, app/u/[handle]/month/[ym]/opengraph-image.tsx, app/u/[handle]/trade/[sellId]/opengraph-image.tsx, app/u/[handle]/record-card-image.tsx); the card's #22c55e/#f43f5e is not the page's up/down (ds.md:513). A lib/palette.ts parity test makes the card and the page say gain and loss the same way. What would raise my score: reshape to palette plus parity test only (S), start after F-12 merges, O-2/O-4 left out; clipping and 22 px stay fixes #9 and #2.
- **K2 (low, 3):** It changes no figure or chart. The one encoding-relevant part, refusing check glyphs and "Verified" in display names next to a record's numbers, is narrow, and it cannot start until #42 merges, so a slot this cycle may sit idle. I would move up if the display-name rule rides with K7's trust language, where the same "Verified" meaning is defined.
- **K45 (low, 2):** No figures, and no real users can reach the product before the vendor gate. One encoding risk: hiding a whole profile silently drops it from the feed's lower-bound ranking, so other records' ranks shift with no visible cause. What would change my mind: a hidden profile shows "Hidden pending review" at its URL, and the hide is excluded from rankings in a tested, logged way.
- **K7 (low, 3):** The false parts (tooltip "Cannot be edited", demo pages saying verified) are already fixes #1 and #10. What is left for my lens is moving the badge onto the stats row with its definition visible, a small change across pane, profile and card files that F-10..F-13 edit now. It would rise if that placement went to F-10/F-11 as interface notes and K7 shrank to the TRUST_LOOK table and tests.
- **K22 (low, 2):** No chart, and with LIVE_BILLING off there is no price display to mislead anyone yet. The three checks are tests on F-3 files (merged). They belong as a small chore or a fixes-list row, not one of six slots.

#### Round 3 arguments: Accessibility specialist

- **K2 (low, 3):** Bidi controls and look-alike glyphs do mislead screen-reader users too, so the normaliser has real access value. But it is a safety item first, it can't start until #42 merges, and its access half is small. My score rises only if every rejection names its rule in text tied to the field (aria-describedby, WCAG 3.3.1 and 3.3.3), not just a red border.
- **K3 (low, 3):** Neutral for access. The risk is that Share and copy-link change: a "copied" state shown only visually fails 4.1.3. I'd score it higher if the brief binds three things: the buttons keep their accessible names and focus, the copy confirmation is announced in a polite live region, and the beacon adds no focus change or motion.
- **K45 (low, 3):** Fine for access if the report action is a real button with a name, the fields have visible labels, and errors and the "sent" state are announced (3.3.1, 4.1.3). The takedown page needs its own distinct title (2.4.2). The anti-impersonation line must be plain text, not an image. Those are conditions I can live with, but nothing here moves A1 forward on its own.
- **K7 (high, 4):** Today the badge's meaning lives only in a title tooltip (app/ui.tsx:11). Keyboard and touch users can't reach a title, and screen readers read it inconsistently. A linked bare "Verified" with the definition visible on the stats row puts the meaning in text everyone gets (1.3.1, 1.4.13 intent, 2.4.4 link purpose). Moving the badge off the h1 also stops long names pushing Demo off screen at 320 px (1.4.10). One slot with K9, after fixes #1/#8/#10 and F-10..F-13 merge.
- **K9 (high, 5):** POLICY A1 (docs/POLICY.md:153) is a standing rule, and the only automated guard on main is lib/badge-contrast.test.ts, which checks the Demo badge and nothing else. Focus rings use var(--accent) or var(--text) or var(--line) in at least ten places (app/globals.css:144-490), and none of them is tested for 3:1. Fixes #13/#14 put a wider test on origin/claude/f13-a11y-fixes (lib/a11y-contrast.test.ts). K9 should extend that file to every token pair, both schemes, text 4.5:1 and boundaries and focus 3:1, and not add a second test. It is value-neutral and cheap, and it stops cycle 1's contrast fixes from being paid for a third time.
- **K18 (low, 2):** Mostly neutral for access: the attestation version string has no UI. The one access risk is the "may be under 18" report category: it must sit in a labelled, keyboard-usable form with an announced result. Add that condition and it is fine. It still doesn't earn a slot from my lens.
- **K22 (low, 2):** Cancelling with no added step is good for cognitive access (fewer steps, no confusing retention screen). But it is mostly tests on merged F-3 files and changes nothing a disabled user meets today. It should ride as a fix, not take a slot.
- **K20 (low, 2):** The og image needs a meaningful alt and must carry no meaning in image-only text. That is small and fix-sized. It doesn't need a council slot.
- **K16 (high, 4):** This is the remaining part of DESIGN SW-1's Musts (DESIGN.md:388-390): returning lands on the same card, and with keyboard focus on a card, right opens and left closes the pane. Today app/feed-keys.tsx:12 handles the arrows, but nothing restores the place on Back (2.4.3 focus order). Double tap clashes with assistive-technology gestures (2.5.1). Fixes #15-#17 on the f13 branch (app/feed-inert.ts, e2e/a11y-feed.spec.ts) do the inert panes and labels, not place memory or overscroll containment. Approve it to start after those fixes and F-10/F-13 merge, with F-2's reject swipe and Undo kept.
- **K21 (high, 2):** I'm only "high" by ranking. Search and a month index give a second way to reach pages (2.4.5 Multiple ways). With three demo traders, profile links already meet that, so I wouldn't approve it now. If it comes back: alphabetical only, a labelled search field, and the result count announced.
- **KV (high, 2):** V-2's rem scale is the one real access gain on this list: text in rem resizes to 200% (1.4.4), while 428 px literals don't reflow cleanly. But three restyles with no traffic measure nothing, and they hit the most-edited files. I'd keep it off this cycle. If it ever runs, it runs after K9, and every variant has to pass K9's contrast-and-focus test before /choose.

#### Round 3 arguments: Engineer
- **K2 (high, 4):** It is almost all new code: lib/handles.ts does not exist on main, and no running feature branch touches it. The only shared file is lib/auth/attempts.ts, which #42 (security-hardening), F-7 and privacy-launch-gate all edit, so the round-0 rule "start after #42 merges" puts it in a clean queue rather than a collision. A reserved list and rename hold are cheap to add now and costly to retrofit once real handles exist.
- **K3 (low, 3):** It should only be approved as the round-0 first slice, sized at about 3 sessions, and sequenced last among the share-file work. Its share_action rows and ?via= on Share land on app/u/[handle]/share-prompt.tsx and lib/display-log.ts, which F-4 rework, F-13 and privacy-launch-gate all have in their diffs right now. The old share columns at db/schema.sql:39-64 stay, and the change must be additive. If it is split so the beacon route and rollup table go first and the share-button half waits for F-4 and F-13 to merge, I move to 4.
- **K45 (low, 3):** The profile report action hard-depends on F-9's lib/reports.ts, which is not on main. Starting before F-9 merges would fork the report queue. The digest page, hide script, takedown page and runbook are new files and low risk. If the slice is cut so the report action starts only after F-9 merges, with the rest going first, I go to 4.
- **K7 (low, 2):** Its file list is the hot zone. app/ui.tsx, lib/copy.ts, lib/record-card.ts, lib/month-card.ts, app/pane.tsx, app/layout.tsx and app/u/[handle]/page.tsx are in the diffs of F-10/12 (record-strip), F-13 (a11y-fixes) and F-7 at the same time. Fixes #2, #8, #9 and #10 already cover the false wording. Approving it now means three-way rebases on every trust string. Next cycle, after those branches merge, it is a clean M.
- **K18 (high, 4):** It is the smallest real risk reduction on the ballot. db/schema.sql:31 and :194 already store adult_attested_at on users and signup_attempts, so this adds one additive version column plus a test pinning the signed-out order in app/page.tsx. Hide-on-report reuses K45/F-9's report path, so no new screen is needed. To meet the harassment concern raised by others, the build should require a signed-in, rate-limited reporter and leave any deletion to the owner (POLICY H).
- **K8 (low, 2):** About 45 sign assertions across 16 files, and F-10/12 and F-13 are editing the same card, strip and month pages (lib/record-card.ts, lib/month-card.ts, trade and month page.tsx) now. pct()/tone() alone in lib/format.ts is a safe first step. The sweep is a rebase hazard that can break pinned snapshot tests mid-build (lib/record-card.snapshot.test.ts on the strip branch). Reshape it to lib/format.ts plus the lo ≤ avg ≤ hi property test now, with the call-site sweep after F-10..F-13 merge, and I go to 4.
- **K17 (low, 2):** The connect pages (app/connect/page.tsx and consent/page.tsx) are in the diffs of F-13, privacy-launch-gate and #42 at once, and F-1's flow is owner-decided with C16 unruled. Its preview_viewed counter needs K3 first. Building it now risks a fourth branch on the consent page for a ruling that may go the other way. Wait for the owner's C16 ruling and the connect branches to merge.
- **K22 (high, 3):** These are test-only checks on merged F-3 billing files (lib/billing.ts) that no running branch touches, in test mode with LIVE_BILLING untouched. It costs under a session and adds zero collision risk. It pins cancel-at-once and no fake "was" price before billing can ever go live. It should ride as a chore without a slot.
- **K20 (high, 4):** app/opengraph-image.tsx does not exist at the root today, so this is one new file with no figures, no name and no logo, and no running branch can collide with it. It costs under an hour. Today a shared home link unfurls bare while profiles get a card. If slots are tight it rides with the fixes, but it should be done.
- **K19 (high, 3):** The engineering cost is XS. The glossary is a new page, and the sitemap edit is a few lines next to F-7's sitemap change, which is an easy rebase. I accept the legal and trust-and-safety point that indexing profiles waits for consent text and launch. Reshape it to the glossary and /how in the sitemap now, with profiles kept out of the sitemap until launch, and it stays a safe 3.

#### Round 3 arguments: Reliability engineer
- **K3 (low, 3):** The gates need counts, but this slice adds a write on every public page view, and the brief is M (3-5 sessions) across lib/display-log.ts, lib/funnel.ts, app/api/events/** and the share buttons. A naive daily rollup is one hot row per page per day, so concurrent beacons queue on a row lock during any traffic spike. What changes my mind: split to rollup plus `via` first; upsert with `on conflict ... do update` per (day, page, via) key; a fire-and-forget beacon that never blocks render or errors to the viewer; `share_action` strictly additive (users.share_prompt_action at db/schema.sql:41 stays readable, CI drop guard holds).
- **K45 (high, 5):** Today the sync tick outcome (ok, skipped, failed, unclaimed, stoppedAtDeadline) is only returned JSON from the cron call plus a log line (app/api/sync/route.ts:70-71). Nobody reads either, so a stalled or partial sync is silent. The digest page is the first operational view of the loop, and a hide that never deletes and writes an audit row is a reversible incident tool. The runbook (restore with deletion replay, breach-notice steps) is ops homework we have to do before real users anyway.
- **K7 (low, 3):** The single TRUST_LOOK table and ban tests are good regression guards. But the scope touches 11 files that F-10..F-13 are editing now (ui.tsx, pane.tsx, profile page, record-card, month-card, globals.css), so we buy rebase conflicts and re-runs on six live builds. Four items are already defects on the fixes list (#2, #8, #9, #10). Land it after those fixes merge, in a quiet window, sharing one slot with K9.
- **K8 (low, 2):** The lo ≤ avg ≤ hi property test is a real integrity guard. But fix #7 already moves surfaces to the arithmetic range, and about 45 sign assertions in 16 files during running builds is the highest collision risk on the ballot. What changes my mind: a helpers-only slice now (lib/format.ts pct()/tone() plus the property test), with the file-by-file sweep after F-10..F-12 merge.
- **K17 (low, 2):** Ops risk is low if it stays Demo-only with no broker call before consent. But the owner has not ruled on C16, and its `preview_viewed` measure needs K3's counters that don't exist yet. Building it now risks rework on an owner ruling and ships an unmeasurable step. Recommend it to the owner instead.
- **K22 (high, 3):** It pins behaviour that is correct today before billing goes live: portalUrl opens straight on subscription_cancel (lib/billing.ts:206-212), with no save step. A test that fails if anyone adds a delaying step or a "was" price is cheap insurance on a path that will touch real money. It stays in test mode with LIVE_BILLING untouched, so the cost is XS. Ride with a chore rather than a full slot.
- **K20 (low, 2):** I have no reliability objection: XS, no data path, no ops risk. My low is about slots only. Under one hour of work should go on the fixes list or ride with a chore, not take one of six approval slots.
- **K21 (low, 1):** It adds a new public query path (search by handle or symbol) that needs an index, input limits and rate limiting, for three demo traders and no measured demand. Nothing has changed since cycle 1. Bring it back once F-7 public traders exist and K3 shows people looking for records they can't find.

#### Round 3 arguments: Legal and compliance

- **K2 (high, 5):** POLICY U2 (docs/POLICY.md:145-146) names a reserved-handle list as a launch prerequisite, and F3a (POLICY:117) says "Verified" means broker-sourced only, yet today a display name can carry "Verified", a check glyph or a bidi override. Both are unmet on main and K2 is the only ballot item that closes them, at S-M cost. The existing 365-day hold in lib/delete.ts:13 covers deletion, not rename, so a rename still frees a handle at once. The reshape keeps the list to generic and own-product words (T1, POLICY:64), and I veto if any third-party or real name enters the list or its fixtures.
- **K3 (low, 3):** It is lawful as reshaped, but it opens a new P3/P6 data flow (POLICY:48, :54) that the owner's Privacy Policy must describe before any real user, and today there is nobody to count. Building collection before the Privacy Policy text exists is the wrong order for a privacy-first product. I would move to 4 if the slice ships with its SCHEMA_MAP, cookie-table and log-scanner entries in the same PR and a test that fails if any stored row holds an IP, user agent, cookie or viewer id.
- **K45 (high, 5):** U2 requires a report action on every profile and U3 requires a takedown/notice process "before launch" (POLICY:146, :148), and POLICY:58 requires a working contact for takedown requests. None of these exists after F-9, which covers theses only. The reshape removes the legal risks: hide never deletes and never hides a single trade (TR-1), no thesis text in audit rows (P3), no email until the owner sets a sender, takedown wording stays a draft until the owner approves it, and there is no safe-harbor claim. Reporter rate limits answer the mass-report concern raised by RT and TS.
- **K7 (high, 4):** F3a (POLICY:117) allows one meaning of "Verified", and POLICY bans completeness claims, yet main ships three Verified wordings, a false "Cannot be edited" tooltip, demo pages calling trades verified, and "full record"/"every stock" copy. The fixes take the worst instances, but only K7's ban tests stop them coming back, and that matters more than any one-off fix. Low-side voters are right about file collisions with F-10..F-13, so it should start after those merge and share a slot with K9.
- **K18 (high, 4):** P4 (POLICY:51) and the F1a amendment (POLICY:101) make signed-out ranking non-personalized, and no test pins that order today. A version string on the existing attestation shows which text each adult agreed to, at almost no cost. RT's harassment point is fair, so I'd tighten the hide-on-report rule: only signed-in, rate-limited reporters can trigger it, it only hides, and the owner reviews before any deletion (POLICY H). No date of birth, ID or age estimation, or I veto.
- **K22 (high, 4):** These three checks pin simple cancellation, no fictitious "was" price (16 CFR 233.1) and no "paid data is more accurate" claim (FTC Act §5) before LIVE_BILLING is ever switched on. If someone weakens one later, CI catches it, not a regulator. lib/billing.ts:206-211 already behaves correctly, which is exactly why a test should pin it. It is test-only and touches no Terms text or email, so it should ride as a chore without taking a slot.
- **K20 (low, 2):** T5a (POLICY:76) bars the product name, logo or wordmark before a clearance search, so the image can carry only a generic line with no figures. That leaves almost nothing to show. It is under an hour of work and belongs on the fixes or chore list, not in one of six slots.
- **K16 (low, 2):** The A1 (POLICY:153) WCAG parts are already on the fixes list (#16, #17), and F-10/F-13 are editing the same feed files now. What remains is convenience, not compliance. I would raise it after F-10/F-13 merge if the remainder is limited to keyboard and screen-reader operability, and likes never celebrate or reward (F6).
- **K19 (low, 1):** It adds legal surface before launch for no gain on demo data. Putting profiles in search engines needs consent text telling traders their records will be indexed (an owner text under P6). Deleted profiles must leave the index with 404/410. F-7 public-filer profiles cannot be listed until the owner rules on T2. I would reconsider after the owner adds the indexing line to the consent text, with F-7 profiles excluded.
- **K21 (low, 1):** There are three demo traders, so there is nothing to search. Any search over securities risks reading as a ranking or signal (F3b), and a query log can become personal data (P3). Revisit after launch, with strictly alphabetical results, no performance ordering and no query logging tied to user ids.
- **KV (low, 1):** It has no compliance gain, and three variants with no traffic measure nothing, the same reason C4/D23 is held. If it is built, specs and PR bodies must name no other product or brand, even as a comparison (T1, T4), and each variant must pass K9's contrast test (A1). An owner call to test with real traffic later would change my mind.

#### Round 3 arguments: Trust and safety

- **K2 (high, 5):** The impersonation hole is in today's code, not a hypothetical. changeHandle (lib/auth/attempts.ts:103-110) frees the old handle the moment a trader renames, so a shared link or card can land on a stranger. createUserForAttempt only trims and cuts the display name to 40 chars (attempts.ts:~58), so "Verified ✓" or bidi tricks pass. RT says the launch gate blocks impersonation now, but U2 (POLICY.md:145) makes this a launch prerequisite, and it costs S once #42 merges.
- **K3 (low, 2):** It does nothing for the people who could get hurt. It adds a new P3/P6 data flow (a beacon on every public view) before the product has any way to report, hide or take down an abusive profile. Order matters: K45 and K2 first, then measurement. I move to 3-4 if K3 is sequenced after K45 and a test pins that no stored row can carry a per-viewer or per-person key, including `via` values.
- **K45 (high, 5):** POLICY U2 and U3 (POLICY.md:145-148) require a profile report and a takedown process before launch. Today reports exist only for theses (F-9), so a victim whose identity is copied has nowhere to go, and nobody sees the sync tick (app/api/sync/route.ts:71). The reshape is safe: hide never deletes, whole profile or thesis only (TR-1), no email, owner approves the wording. Add a per-reporter rate limit so mass reports can't bury a rival.
- **K7 (high, 4):** "Verified" is the word a scammer screenshots to suggest the person was checked. Three wordings, Demo pages that call trades verified, and a false "Cannot be edited" tooltip (briefs K7) give that pitch material. One bare "Verified" linked to /how#verified and a Demo look that can never read as verified make the badge hard to misuse. Fixes #1, #6, #10 go first so K7 is what remains.
- **K9 (low, 2):** Real accessibility value, but no harm or misuse control. The measured contrast defects are already on the fixes list, so what's left is a token layer and a CI test. It competes for globals.css with K7, which does carry a misuse effect. I'd score it 3 if it rides in K7's slot.
- **K18 (high, 4):** It is the only candidate that protects a person who should not be on the product at all: a "may be under 18" report hides the account at once, and the owner runs any deletion (POLICY H). RT's point is right that a single report can be abused, so it must share K45's per-reporter rate limit and audited hide, and a false report only hides. The rest is a version string and one test pinning the non-personalized signed-out order, size S.
- **K8 (low, 2):** The one harm is lay readers taking an average's range as a per-trade promise, which feeds "guaranteed returns" pitches [FC-R18]. The "range is for the average, not one trade" line and the lo ≤ avg ≤ hi test fix that and belong on the fixes list (#6, #23, #25). The other 45 sign assertions in 16 files collide with F-10..F-12 for no safety gain.
- **K20 (low, 1):** Harmless and under an hour, but it has no safety effect and carries no figures, name or logo. It should ride with the fixes and not use one of six slots.
- **K16 (low, 1):** Place memory, double tap and overscroll have no harm or misuse dimension. It overlaps fixes #16-#18 and the F-10/F-13 feed files that are being edited now. Ride with fixes after the feed builds merge.
- **K15 (low, 2):** "View as public" helps a trader spot what strangers can see (doxxing, targeting), which is a real safety benefit later. With three demo traders and the launch gate closed (lib/launch-gate.ts:61) there is nobody to protect yet. I'd back it once real traders are near.
- **K19 (low, 1):** Indexing profiles makes real traders easier to harvest for scam targeting (MRC2-6 says real records are scam bait), and the effect only starts after week 8. Sitemapping profiles needs consent text that mentions search engines first. /how and a glossary page alone would be harmless.
- **K21 (low, 1):** Handle search lets anyone list every trader and find look-alike handles to copy, which is an impersonation tool before K2's look-alike check exists. With three demo traders nobody needs it. If it returns: after K2, alphabetical, no partial-match lists of similar handles.
- **KV (low, 1):** No safety effect, three restyles, and no traffic to measure them (the same reason C4/D23 is held, per DK). A neutral base change also risks drifting the Verified and Demo looks just after K7 fixes them.

#### Round 3 arguments: Decisions keeper
- **K3 (high, 4):** Reshaped, K3 conflicts with no owner or board decision, and it is what several decisions already wait for. F-13 2026-11-01 says no before/after claim until counters exist (F-13 Decisions :14-15), idea 13 lists counters as a week-0 prerequisite, and GTM 2026-11-01 asks for no cookie, attribution-only referral and unchanged DESIGN §3.5 thresholds (IDEAS.md:99-104). K3 meets all three. It stores no identifier, so it is not F-2's opt-in activity log (F-2 Decisions :45-51), and the schema change is additive, so the CI `drop` guard holds.
- **K7 (low, 3):** The content is right, but this is the widest sweep of decided wording on the ballot: D25 (IDEAS.md:141-143), D27 (F-13 :2-5), the F-4 owner trust lines (F-4:67-81, :113-114) and the F-1 trust notice (F-1:152-155) all sit in its files. The f13-a11y-fixes branch already rewrote D27's line once without the idea board (commit 107d3f4). Fixes #1, #8 and #10 remove the false parts with no vote. I would raise my score if K7 ships a test that pins those decided lines verbatim, starts after F-10..F-13 merge, and leaves F-7's label to F-7's committee.
- **K9 (high, 4):** It is the one design-system item with no decision conflict. Settled conflict 9 (ds.md) keeps base and accent fixed until V-1, and K9 is value-neutral by scope. It also protects decisions: POLICY A1 and the cycle-1 contrast fixes (#13-#15) regress today because only `lib/badge-contrast.test.ts` guards a single pair. Condition: extend F-13's contrast test and carry over the badge assertions, so the test count never drops.
- **K18 (high, 4):** As reshaped, every part carries out a decision that exists. The attestation already lives on `signup_attempts` (F-1 2026-10-22 (c), F-1:156-163). D26 asks for versioned consents (IDEAS.md:144-147). The pinned signed-out order is the TR-9 Ranking Must and F-2's "Personalize my feed: Off" order. Deletion stays with the owner (POLICY H). RT's harassment point is fair. The fix is to reuse K45's signed-in, rate-limited report and audited hide, not to drop K18.
- **K17 (low, 2):** Cycle 1 sent C16 to the owner as flag 1 (approval-2026-11-01 Flags 1; IDEAS.md:164). The owner has not ruled. If the council approves even the Demo version, it decides a question the owner holds, on an owner-decided flow (F-1:102-141). Nobody can connect before launch, so waiting costs nothing. The council should send the Demo version to the owner as its recommendation and not spend a slot on it.
- **K22 (high, 4):** As reshaped, K22 only pins in tests what the F-3 2026-11-01 decisions already say: cancel is self-serve with no added step (F-3:61-62), paid is never richer or fresher than free (F-3:44-45), and the processor sends every billing email (F-3:52-53). It is the cheapest guard against a later build drifting from an owner decision before LIVE_BILLING ever turns on. Size XS: it rides as a chore, not a full slot.
- **K20 (high, 3):** It conflicts with no decision as long as it uses the positioning constant, not D27's line (DSP-2 is at the idea board), and has no name, logo or figure (T5a; IDEAS.md:116-120). There is no root og image today, so a shared "/" unfurls bare. Size XS: put it on the fixes list with those three conditions.
- **K16 (high, 3):** It is the remainder of the SW-1 Musts (DESIGN:388-392), which CLAUDE.md treats as requirements, so it carries out a spec rather than adding direction. I agree it must not race F-10/F-13 or fixes #16-#18. Approve it to start after they merge, with F-2's reject swipe, guards and 5-second Undo kept (F-2 Decisions :13-28).
- **K15 (low, 2):** CLAUDE.md says not to build features that assume the dev auth stub. A "view as public" toggle for the signed-in owner needs #42's real session interface first. With no real trader, nobody needs it, and a private window already shows the public render. Revisit with F-7 or real connects.
- **K19 (high, 3):** The glossary carries out D24 (one word for a bet, IDEAS.md:137-140) and needs no new wording. The real line is POLICY H: launch is the owner's. If the sitemap stays closed to indexing in production until the launch gate opens, and F-7 profiles are listed only under F-7's switch, it conflicts with nothing. Without that condition I would score it 1, as LG and TS do.
- **K11 (low, 2):** Most of what is left belongs to someone else. O-2 (card Demo hue) and O-4 ("Disconnected" on cards) are owner flags. F-12 2026-11-01 owns the anti-crop band (F-12 :16-18), and F-4 owns card layout (F-4:82-84). Fixes #2 and #9 take the defects. Approving now only reserves a future conflict. It should come back after F-12 merges and the owner rules on O-2/O-4.
- **K21 (high, 2):** I am on the high side only because it has no decision conflict if it is alphabetical only (F3b; cycle-1 C13 condition) and the month index shows losing months (TR-1). I won't argue for a slot: cycle 1 called it premature with three demo traders, and nothing has changed.
- **KV (low, 1):** This is the inconsistency I flagged in round 0, and the council's own record decides it. Cycle 1 held C4/D23 because "three versions picked on demo data give no evidence" (approval-2026-11-01 Waiting, C4 row), and the chair excluded C4 again this cycle for no traffic. KV's measures (pane-open rate, sign-in starts) need K3 counters that don't exist yet. Approving KV while C4 waits applies two rules to one situation. Hold it with C4 until traffic exists.

#### Round 3 arguments: Common sense

- **K18 (high, 4):** It's the smallest item on the ballot, and each part is honest and in proportion. The attestation is already stored (`db/schema.sql:31,194` `adult_attested_at`), so this adds only a version string. A test pins the signed-out order, so a shared link lands on the same documented order for everyone (TR-9). A "may be under 18" report hides the account at once, and only the owner runs a deletion (POLICY H), so a false report can't wipe an adult's record. No date of birth, ID or age guessing. It needs no slot of its own: it rides with K45.
- **K20 (high, 3):** There is no `app/opengraph-image*` today. A shared home link, the one link founder outreach will actually send (MRC2-4), unfurls with only the layout description (`app/layout.tsx:11`). It's one new file that no running build touches (EN), under an hour, with no figures, no name or logo and no completeness words. That's all upside. It should ride with the fixes and not use a slot.
- **K9 (low, 3):** The test itself is worth having. But the visible problems are already fixes #12, #13 and #26, and `lib/badge-contrast.test.ts` exists (F-13 adds a contrast test too, per EN). A separate slot that rewrites `app/globals.css` while F-7, F-12 and F-13 edit it means building it twice. I'd go to 4 if it is one test that extends the existing one, lands in K7's slot after those fixes, and changes no values.
- **K8 (low, 2):** The misleading parts are already on the fixes list: #7 (ranges that exclude their own average) and #19 (0.0% shown as a red "Gain"). What's left is about 45 sign assertions in 16 files that F-10..F-12 are editing right now. A first-time viewer gains little from the rest this cycle, and the merge pain is certain. I'd score it higher if it shrank to the `pct()`/`tone()` helpers plus the one "range is for the average, not one trade" line, riding with F-10.
- **K17 (low, 2):** Showing a trader exactly what goes public before they connect is the most sensible idea here. But F-1 is owner-decided, and the owner has C16 open with our cycle-1 recommendation in hand. If we vote it into a slot, we pre-empt a pending owner ruling, and DK's view means the vote may be void anyway. Send it to the owner again as a one-line ask. If the owner says yes, it's an easy approve.
- **K16 (low, 2):** Fixes #15, #16 and #17 (sign-in bar, `inert` off-screen panes, the Like name) already carry the keyboard and screen-reader core. F-10 and F-13 are rewriting the feed files (`feed-gestures`, `feed-keys`, `feed-rows`) now. Polishing a feed that's still moving means doing it twice. Revive it after those land, with F-2's reject swipe and Undo kept.
- **K15 (low, 2):** "View as public" helps a real trader trust what they share, but no real trader exists yet. Done properly it also needs the session interface from #42, not the dev stub (CLAUDE.md). Revive it with F-7 or the first real connect, as one small item.
- **K19 (low, 2):** The effect lands after week 8 (MRC2-13 says low priority). LG points out that indexing records needs consent wording about search (owner) and 404/410 on deletion. The glossary would be written before K8 settles the terms. It's fix-sized at best, after F-7 and the owner's wording.
- **K11 (low, 1):** Every concrete harm in it is already a fix: #9 (clipped "+12,34") and #2 (22 px disclaimer). The rest waits on owner flags O-2/O-4 and on F-12, which owns these image files now. Nothing is left to build this cycle that wouldn't be redone.
- **K21 (low, 1):** Nothing has changed since cycle 1. Search and a month index over three demo traders serve no one, and the profile links already reach every page. If revived: alphabetical only, never by performance.
- **KV (low, 1):** Three restyles, each built three times, can't be measured with zero traffic. That's the same reason D23/C4 is held (DK), so approving these would be inconsistent with our own record. They would churn `globals.css` under six running builds. A nav label that fits at 320 px needs one decision, not a three-way test. I'd change my mind only for a quiet cycle after K9, judged by eye by the owner, with no metric claimed.

#### Round 3 arguments: Red team
- **K2 (low, 3):** Nobody can impersonate anyone before launch: sign-up is gated (lib/launch-gate.ts:61 `handleReserved` already blocks renames onto allowlisted handles while closed) and deleted handles are already held 365 days (lib/delete.ts:13 `HANDLE_RESERVED_DAYS`). The slot also sits idle until #42 merges, and the confusables part must wait for F-9's normaliser. I move to 4 if it is scheduled after #42 and F-9 and kept to the reserved list plus display-name rules, with a test that signs up "support" and a bidi name and sees both refused.
- **K45 (low, 3):** With zero real users the digest shows zeros and no one can file a profile report, and the takedown page cannot ship until the owner writes its wording, so a large part lands as a draft. The hide script is the only part with a near-term use, and F-9's hold already covers theses. I move to 4 if it is cut to profile report + audited hide script (whole profile or thesis, never a trade, TR-1) after F-9 merges, with digest and takedown page as a follow-on.
- **K7 (low, 2):** The parts that are untrue are already fixes without a vote: #1 demo called "verified", #8 completeness words, #10 the false "Cannot be edited" tooltip (the fixes list rows 1, 8, 10). What remains is an 11-file refactor through app/pane.tsx, app/u/[handle]/page.tsx, lib/record-card.ts and lib/month-card.ts, which F-10..F-13 are editing right now. Cheapest test: after the fix branches merge, grep demo surfaces for "verified" and the banned words; if zero, K7 is consistency only and belongs in a quiet cycle.
- **K8 (low, 2):** The misleading parts are fixes #7 (range excludes its own average), #19 (0.0% painted as loss and read as "Gain") and #23/#24. The rest is about 45 sign assertions in 16 files that F-10..F-12 are touching, so merge conflicts are near certain this cycle. Cheapest test: once #7 and #19 land, run the lo <= avg <= hi property over every surface; if it passes, the remainder is wording polish and can wait.
- **K9 (low, 3):** A contrast test only pins the token pairs it lists, so colour literals outside :root and the hard-coded image palettes still regress unseen. Fixes #12, #13 and #26 already change the failing values. It is cheap and permanent, so I go to 4 if it shares K7's globals.css slot and the test also fails on any new hex literal outside :root.
- **K11 (low, 1):** It is blocked twice: F-12 owns the trade and month images and the anti-crop band (in flight), and O-2 and O-4 are owner flags. The wrong parts (22 px disclaimer, the clipped "+12,34" figure) are fixes #2 and #9. Approving it now only reserves a future conflict.
- **KV (low, 1):** Three versions on three demo traders measure nothing, which is the exact reason C4/D23 was held (cycle 1 Waiting table; DK round 0 note on K12-K14). No metric named in the brief has a single event today, since K3's counters don't exist. It also restyles globals.css three times while six builds edit it, and V-2 is size L. Revisit after K3 has two weeks of counts.
- **K15 (low, 1):** There are no real traders to reassure, and the signed-out profile URL in a private window already shows the owner exactly the public render. The parity test needs real auth (#42) under CLAUDE.md's no-stub rule. Revisit at launch.
- **K16 (low, 1):** Fixes #15-#18 already take inert panes, focus moves, the like label and the covering bar, and F-10/F-13 are editing the feed files now. Building the remainder now means building it twice. I would back it if a keyboard and screen-reader audit still fails after those land.
- **K17 (low, 2):** The owner has a pending ruling on C16 (cycle 1 flag 1) and F-1's flow is owner-decided, so a council slot pre-empts the owner. No trader connects before launch, so nobody sees it yet. Send it to the owner as a recommendation; I go to 3 only if the owner rules for the Demo version.
- **K18 (low, 2):** The attestation is already stored (signup_attempts, users), so the new parts are a version string, a test pin and hide-on-report. Hide-at-once on one "may be under 18" report lets anyone hide any adult's record, a harassment tool in tension with TR-1. I move to 3 if a hide needs a signed-in, rate-limited reporter and F-9's N-reporter rule or owner review, with a test that one fresh account cannot hide a demo profile.
- **K19 (low, 1):** app/sitemap.ts already lists every symbol from closed_trades with no deleted-user filter (fix #4) while stock pages still call demo data "verified" (fix #1). Adding profiles and a glossary invites indexing of demo data on a site that is not open, and the brief itself says the effect starts after week 8. Wait until launch and F-7.
- **K20 (low, 2):** T5a forbids name, logo and figures, and the positioning line is contested at the idea board (DSP-2/DSP-3), so the image is one sentence that may need rewriting soon. It is XS and harmless. It can ride as a chore after the idea board rules; it does not need a slot.
- **K21 (low, 1):** Nothing changed since cycle 1 called it premature. With three demo traders a search box has nothing to find, and a month index duplicates the profile's own months.
- **K22 (low, 2):** Billing is test mode with LIVE_BILLING off, and lib/billing.ts:206-211 already opens the hosted portal straight on cancel (`subscription_cancel` flow). Most of the reshaped scope is tests for behaviour that already holds. Good ROSCA guard, but it should ride as a chore with no slot.


### Round 3: score changes

#### Round 3: Business lead, scores after the debate
| Candidate | Score | Change and reason |
|---|---|---|
| K2 | 3 | unchanged. TS's point that changeHandle frees a renamed handle at once (lib/auth/attempts.ts:103-110) is real, but sign-up is gated closed (lib/launch-gate.ts:61), so no gate or launch-week effect before #42. |
| K3 | 5 | unchanged. The chair's reshape (beacon + rollup + via first, share_action after F-4/F-13) keeps the gate-reading core and removes EN's and RE's collision and hot-row concerns. |
| K45 | 3 | unchanged. Narrower reshape (after F-9, rate-limited, audited hide) is right, but it still moves no gate. Protective launch homework only. |
| K7 | 3 | unchanged. MR's point that one wording is needed to read the F3a comprehension test is fair, but the false parts are fixes #1, #8, #10 and the rest waits for F-10..F-13. |
| K8 | 4 | 3→4: the chair adopted the reshape I asked for in round 1 (lib/format.ts helpers, lo ≤ avg ≤ hi test, the range-is-for-the-average line now; sweep after F-10..F-12). That removes the collision risk EN and RE named and keeps the T10 precondition for D23. |
| K9 | 3 | 2→3: the reshape meets my round-3 condition. It extends F-13's contrast test, changes no values beyond the fixes list and rides in K7's slot, so it costs no slot of its own. Still no demand effect. |
| K11 | 1 | unchanged. Blocked by F-12 and owner flags O-2/O-4; the visible harms are fixes #2 and #9. |
| KV | 1 | unchanged. No traffic and no K3 counters, the same reason C4/D23 is held (DK, CS, RT). |
| K15 | 2 | unchanged. Cheapest supply bet, but no real trader exists before #42. |
| K16 | 2 | unchanged. SW-1 Must remainder; fixes #16-#18 and F-10/F-13 move the same files now. |
| K17 | 2 | unchanged. Send the Demo-only shape to the owner as the council's recommendation for C16; a slot would pre-empt the owner (DK, CS, RT). |
| K18 | 2 | unchanged. The reshape riding on K45's rate-limited hide answers RT's abuse point, but it has no demand effect and needs no slot. |
| K19 | 1 | unchanged. Narrowed to /how plus glossary, it is still fix-sized and its effect lands after week 8. |
| K20 | 2 | unchanged. Worth doing for founder outreach links to "/" (GR, CS), but as a fixes rider, not a slot. |
| K21 | 1 | unchanged. Three demo traders, nothing to find; nothing changed since cycle 1. |
| K22 | 1 | unchanged. LIVE_BILLING is off and lib/billing.ts:206-211 already cancels directly; LG's and PF's insurance case fits a chore, not a slot. |

#### Round 3: Market research lead, scores after the debate
| Candidate | Score | Change and reason |
|---|---|---|
| K2 | 4 | unchanged |
| K3 | 5 | unchanged. The reshaped first slice (beacon, rollup, via registry, no stored identifier) still carries the 200 bot / 50 human validation before week 1. |
| K45 | 4 | unchanged |
| K7 | 3 | unchanged |
| K8 | 5 | 4→5: my round-1 reason for 4 not 5 was only the wide diff during F-10..F-12. The chair's reshape (lib/format.ts helpers, lo ≤ avg ≤ hi property test and the "range is for the average" line now, sweep after merge) removes that (EN, RE, UX, DV). The evidence (FC-R18, FC-R19, §2 row 4, T10 precondition) stands. |
| K9 | 3 | unchanged |
| K11 | 2 | unchanged |
| KV | 1 | unchanged |
| K15 | 2 | unchanged |
| K16 | 2 | unchanged |
| K17 | 3 | unchanged. I agree with DK and CS that it should go to the owner as the recommended C16 shape rather than take a slot. |
| K18 | 3 | unchanged |
| K19 | 2 | unchanged |
| K20 | 3 | 2→3: GR and EN showed there is no root share image on main (origin/main has none under app/ root, only a text description at app/layout.tsx:11). Founder outreach (MRC2-4) is the main early viewer channel and it sends "/", so this hits viewers per trader, the input PF names as short (:1053). Still fix-sized, no slot needed. |
| K21 | 1 | unchanged |
| K22 | 2 | unchanged |

#### Round 3: Pricing and finance, scores after the debate
| Candidate | Score | Change and reason |
|---|---|---|
| K2 | 4 | unchanged. RT's facts (launch gate, 365-day delete hold) lower urgency, but TS shows a rename still frees a handle at once (lib/auth/attempts.ts:103-110), so the U2 spend is still owed and cheapest right after #42. |
| K3 | 5 | unchanged. The chair's reshape (beacon, rollup and via first, share_action after F-4/F-13) makes the first slice cheaper and removes rebase spend, so it stays the best buy. |
| K45 | 4 | unchanged. Waiting for F-9's lib/reports.ts is the saving I asked for. It is still a launch cost we must pay anyway. |
| K7 | 4 | 3→4: my only objection was paying twice during F-10..F-13, and the reshape starts it after those merge and the fixes. MR's point that one wording is needed before T10 can be read means it also buys usable information. |
| K8 | 3 | 2→3: my 2 was rebase spend on a 16-file diff. The reshape (lib/format.ts helpers, lo ≤ avg ≤ hi property test, one What's-this line now; sweep after F-10..F-12) cuts the first slice to S with little collision cost. Not higher because fixes #7 and #19 already take the misleading parts. |
| K9 | 4 | 3→4: it now extends F-13's existing contrast test instead of a second one and rides in K7's slot, so its cost falls and it takes no slot of its own. It stops paying a third time for contrast fixes (A11Y, PD). |
| K11 | 1 | unchanged. Still blocked by F-12 and O-2/O-4. |
| KV | 1 | unchanged. No traffic means no evidence (DK, MR, CS). Even V-3 alone should wait for K3 counts. |
| K15 | 2 | unchanged. No real trader yet. |
| K16 | 2 | unchanged. Feed files still moving under F-10/F-13 and fixes #15-#18. |
| K17 | 3 | unchanged. Send to the owner as the recommended C16 shape. Build once the owner rules, with no slot held on a guess. |
| K18 | 3 | unchanged. Riding with K45's rate-limited report and audited hide keeps it XS-S. |
| K19 | 2 | unchanged. The reshape (only /how and glossary in the sitemap) is cheaper but its effect still lands after the week-8 gates. Fixes-list rider at most. |
| K20 | 3 | unchanged. Under one session, rides with the fixes. |
| K21 | 1 | unchanged. No demand to measure. |
| K22 | 3 | unchanged. Test-only chore. BL's fact (lib/billing.ts:206-211 already cancels directly) was already in my score. |

#### Round 3: Growth, scores after the debate
| Candidate | Score | Change and reason |
|---|---|---|
| K2 | 4 | 3→4: TS showed changeHandle (lib/auth/attempts.ts:103-110) frees the old handle on rename at once, and LG confirmed the 365-day hold in lib/delete.ts:13 covers deletion only. So a shared profile link or card can later land on a stranger. Durable links are a growth requirement, not just safety. |
| K3 | 5 | unchanged. The reshaped first slice (beacon, daily rollup, closed via registry, ?via= on Share) is still the part that tells us whether records travel. share_action after F-4/F-13 is fine. |
| K45 | 3 | 2→3: the reshape meets my round-3 condition (reuses F-9's lib/reports.ts, per-reporter rate limit, hide never deletes). MR's point holds for my lens: one impostor story on a real record costs more views (G3) than most features add. |
| K7 | 3 | unchanged. MR's point that one Verified wording is needed to measure what viewers think a forwarded badge means is right, but the work waits for F-10..F-13 anyway. |
| K8 | 3 | 2→3: my objection was the 16-file diff fighting running builds. The reshape (lib/format.ts helpers, lo ≤ avg ≤ hi property test, the range line) defers the sweep until F-10..F-12 merge, and the same numbers appear on forwarded cards. |
| K9 | 1 | unchanged. Riding in K7's slot answers my slot concern, but it still has no effect on links or cards travelling. |
| K11 | 2 | unchanged. Images are the record that travels (MR: card images are channel 1), but it is blocked by F-12 and O-2/O-4, and clipping is fix #9. |
| KV | 1 | unchanged. No traffic and no K3 counts, so no arm can be read; same reason C4/D23 is held (DK, RT). |
| K15 | 1 | unchanged. No real traders yet. |
| K16 | 1 | unchanged. Helps people already in the feed, not records leaving it; feed files are still moving. |
| K17 | 2 | unchanged. Agree with DK, CS and RT: send the Demo shape to the owner for C16 rather than take a slot. |
| K18 | 2 | unchanged. The reshape adopts my condition (K45's rate-limited, audited hide). Pinning the signed-out order keeps shared-link landings the same for everyone, but there is no growth upside beyond that. |
| K19 | 2 | unchanged. The reshape (/how and glossary only, profiles out until launch) is the part I supported. Its effect still lands after week 8, so it should ride with the fixes. |
| K20 | 4 | unchanged. "/" still unfurls bare (no app/opengraph-image.tsx; app/layout.tsx:11). XS, no figures, name or logo. Should ride with the fixes if no slot. |
| K21 | 1 | unchanged. Three demo traders; nothing to find. |
| K22 | 1 | unchanged. Billing is in test mode and lib/billing.ts:206-211 already cancels directly. Good as a chore, no effect on sharing. |

#### Round 3: UX lead, scores after the debate
| Candidate | Score | Change and reason |
|---|---|---|
| K2 | 3 | unchanged. My condition (each rejection names its rule next to the field, as A11Y and PD also asked) is not in the version under vote, and it still waits for #42. |
| K3 | 4 | 3→4: the reshape splits off the share-button half until F-4/F-13 finish, the beacon never blocks the page, and the copy confirmation is announced (A11Y). MR and BL showed that the comprehension measures behind K8 and K17 (What's-this opens, T10) can't be read without these counts. |
| K45 | 4 | 3→4: the reshape adds what a first-time viewer needs. A hidden profile says "Hidden pending review" instead of vanishing (DV), the report form is labelled with announced errors and "sent", and the takedown page has its own title (A11Y). LG, MR and TS also show U2/U3 make it launch homework either way. |
| K7 | 5 | unchanged. The reshape (decided D25/D27/F-4/F-1 lines pinned verbatim, after F-10..F-13 and the fixes) keeps the core fix: one Verified wording linked to its definition. |
| K8 | 5 | 4→5: I held it below 5 only for the 16-file collision with F-10..F-12. The reshape (helpers, lo ≤ avg ≤ hi property test and the "range is for the average, not one trade" line now, sweep after merge) removes that. BL, MR and DV add the FC-R18/FC-R19 evidence. |
| K9 | 4 | 3→4: DV's gain-vs-loss colour-blind floor pins the one encoding every first-time viewer relies on (light gain and loss are ΔE00 2.8 apart under deutan). It now extends F-13's test, changes no values and shares K7's slot, so it costs no extra slot. |
| K11 | 2 | unchanged. Clipping and the 22 px disclaimer are fixes #2 and #9; the rest waits on F-12 and O-2/O-4. |
| KV | 1 | unchanged. No traffic to read any arm, the same reason C4/D23 is held (DK, CS, RT). |
| K15 | 2 | unchanged. No real trader yet, and it needs #42's session. |
| K16 | 2 | unchanged. Fixes #15-#17 and F-10/F-13 are still moving the feed files. I'd back the remainder after they merge. |
| K17 | 4 | unchanged. It still answers the first-time trader's main fear before consent. I accept DK, CS and RT's point: if the council won't pre-empt C16, send this exact Demo shape to the owner as the recommended answer. |
| K18 | 3 | 2→3: the reshape uses K45's signed-in, rate-limited report and its one hidden state, so viewers don't meet a second, different hidden screen (PD) and one report can't bury an adult's record (RT). Still mostly invisible, so not higher. |
| K19 | 2 | unchanged. The reshape fixes the indexing risk, but the glossary should still be written once, after K8 settles the terms. |
| K20 | 2 | unchanged. A plain preview for the home link helps the first click, but it is fix-sized, not a slot. |
| K21 | 1 | unchanged. Nothing to find with three demo traders. |
| K22 | 2 | unchanged. Correct behaviour already holds (lib/billing.ts:206-211). Ride as a chore. |

#### Round 3: Product designer, scores after the debate
| Candidate | Score | Change and reason |
|---|---|---|
| K2 | 3 | unchanged. The reshape does not add one shared rejection pattern tied to the field for sign-up and rename, and sign-up is still gated closed (lib/launch-gate.ts:61), so it stays invisible on screens. |
| K3 | 4 | 3→4: the chair's reshape moves the share-button half after F-4/F-13 and announces the copy confirmation (A11Y), so the Share flow stays as it is apart from one short `?via=`. MR, BL and PF showed the measures for K7 (T10 add-on) and K8 (What's-this opens) read nothing without it. |
| K45 | 4 | 3→4: the reshape adopts my round-1 condition. A hidden profile shows one neutral "Hidden pending review" notice, never a partial record, and the report reuses F-9's lib/reports.ts, so there is one report entry pattern across thesis and profile. |
| K7 | 5 | unchanged. The reshape (decided D25, D27, F-4, F-1 lines pinned verbatim, start after F-10..F-13 and fixes #1, #2, #8, #9, #10) matches what I argued. Correction kept from round 3: lib/copy.ts:289 "Simulated" is about paper accounts, not Demo. |
| K8 | 4 | unchanged. The reshape is the one I proposed (helpers, property test and the average-not-one-trade line now, sweep after F-10..F-12). |
| K9 | 4 | unchanged. The reshape (extend F-13's contrast test, keep lib/badge-contrast.test.ts, fail on new colour literals, K7's slot) fits my condition. RT's literal check is a good addition but does not change the size of the gain. |
| K11 | 2 | unchanged. Still blocked by F-12 owning the image band and owner flags O-2/O-4. Bring it back as a palette parity test after F-12 merges. |
| KV | 1 | unchanged. No traffic and no K3 counters, the same reason C4 is held (DK, CS, RT). V-3's nav fit is a fix-sized label question. |
| K15 | 2 | unchanged. No real trader, needs #42's session. Better folded into K17's preview later. |
| K16 | 2 | unchanged. The feed files are still moving under F-10/F-13 and fixes #15-#18. Revive after they merge. |
| K17 | 3 | unchanged. Still the best flow idea, but it pre-empts the owner's open C16 ruling. Send the Demo-only shape to the owner as the council's recommendation. |
| K18 | 3 | 2→3: the reshape does what I asked. It uses K45's signed-in, rate-limited report and its one audited hidden state, with owner review before anything stays hidden, so no second hidden screen and no harassment path (RT). It still needs no slot of its own. |
| K19 | 2 | unchanged. Profiles staying out of the sitemap removes the main risk, but the glossary should still wait for K8's terms so the wording is written once. Fix-sized, no slot. |
| K20 | 2 | unchanged. Good unfurl parity for "/" and under an hour, but no figures, name or logo leave a one-line card. Ride with the fixes. |
| K21 | 1 | unchanged. Wayfinding for three demo traders; adds a nav item nobody needs yet. |
| K22 | 2 | unchanged. Test-only on merged F-3 files; lib/billing.ts:206-211 already cancels directly. Ride as a chore. |

#### Round 3: Data-visualization designer, scores after the debate
| Candidate | Score | Change and reason |
|---|---|---|
| K2 | 3 | unchanged |
| K3 | 4 | 3→4: the reshape (chair notes) splits the share-button half off until F-4/F-13 finish, which removes the shared-file cost I named. MR and BL show K8's "What's this?" measure and K16's pane-open rate both need these counts. A test failing on any stored identifier keeps it counts-only. |
| K45 | 3 | 2→3: my stated condition was adopted (a hidden profile shows "Hidden pending review" and its removal from rankings is tested and logged), so other records' ranks never shift with no visible cause. LG and TS show U2/U3 require it before launch. |
| K7 | 4 | 3→4: MR's point that one Verified wording is the precondition for reading the Verified comprehension test (T10 add-on) is an encoding argument I had missed. The reshape starts it after F-10..F-13 and fixes #1, #8, #10, and pins D25/D27/F-4/F-1 lines verbatim (DK), so it no longer collides. |
| K8 | 5 | 4→5: the reshape is exactly my round-1 reservation answered. Helpers, the lo ≤ avg ≤ hi property test on every printed range and the "range is for the average, not one trade" line come now. The 16-file sweep waits for F-10..F-12 (EN, RE). This is the one guard that stops new surfaces repeating fixes #7 and #19. |
| K9 | 5 | 4→5: the reshape adds my ask (a gain-vs-loss colour-blind floor) and RT's (fail on new colour literals), and extends F-13's lib/a11y-contrast.test.ts instead of adding a second test (A11Y, DK). That pins the deutan gain/loss split (fix #26) and Verified 3.77:1 (fix #12) for good, value-neutral, in K7's slot. |
| K11 | 2 | unchanged |
| KV | 1 | unchanged |
| K15 | 2 | unchanged |
| K16 | 2 | unchanged |
| K17 | 2 | 3→2: DK and CS show a slot vote decides C16, which the owner holds, on an owner-decided flow (F-1). Nobody connects before launch, so waiting costs nothing. I support sending the Demo-only shape (Demo badge and F3 line on the preview figures, CH-1 curve with 0% on the axis) to the owner as the council's recommendation. |
| K18 | 3 | unchanged |
| K19 | 2 | unchanged |
| K20 | 2 | unchanged |
| K21 | 1 | unchanged |
| K22 | 2 | unchanged |

#### Round 3: Accessibility specialist, scores after the debate
| Candidate | Score | Change and reason |
|---|---|---|
| K2 | 3 | unchanged. PD and UX asked for rejections that name the rule next to the field (my 3.3.1/3.3.3 condition), but the chair's notes did not adopt it, so there is no reason to move. |
| K3 | 4 | 3→4: the chair's reshape binds my condition that the copy confirmation is announced to screen readers (4.1.3). The first slice is now a beacon that never blocks the page (RE), and the Share-button half waits for F-4/F-13 (EN), so the slice changes no focus, motion or button names. The access risk I scored against is gone. |
| K45 | 3 | unchanged. The reshape adopts all my conditions: labelled report form, announced errors and "sent", and a takedown page with its own title (2.4.2). That removes my risk, but the candidate still adds no access gain. The U2/U3 launch case (LG, TS) sits outside my lens. |
| K7 | 4 | unchanged. The reshape (DK: pin the decided lines verbatim, start after F-10..F-13 and fixes #1, #2, #8, #9, #10) matches my round-1 sequencing. The tooltip-only meaning at app/ui.tsx:11 (1.4.13, 1.3.1) still needs this fix. |
| K8 | 3 | unchanged. The reshape (helpers plus the property test plus the What's-this line now, the sweep later) is the split I asked for. But the screen-reader gain (U+2212 read as "minus", Flat in text) only reaches users when the 16-file sweep runs, so this cycle's slice adds little access value. |
| K9 | 5 | unchanged. The reshape is what I argued for: extend F-13's lib/a11y-contrast.test.ts, keep lib/badge-contrast.test.ts so the test count never drops, and change no values. DV's gain-vs-loss colour-blind floor (fix #26) and RT's rule that fails on new colour literals both strengthen it. |
| K11 | 2 | unchanged |
| KV | 2 | unchanged. DK, CS and RT are right that it clashes with holding C4. V-2's rem scale is the only access gain, and it can come later, after K9. |
| K15 | 2 | unchanged |
| K16 | 4 | unchanged. Others agree it should start after fixes #15-#18 and F-10/F-13 merge, which was already my condition. Place memory on Back (2.4.3) and the double-tap clash with assistive gestures (2.5.1) are still not covered by those fixes (app/feed-keys.tsx:12 handles only the arrows). |
| K17 | 2 | unchanged. I agree with sending it to the owner as the council's recommended shape for C16. If it is built, consent stays above the fold at 320 px (1.4.10). |
| K18 | 2 | unchanged. Reusing K45's labelled, rate-limited report form meets my condition, but there is still no access gain. |
| K19 | 2 | unchanged. The reshape to /how plus the glossary only is fine for access. It is still fix-sized. |
| K20 | 2 | unchanged |
| K21 | 2 | unchanged |
| K22 | 2 | unchanged |

#### Round 3: Engineer, scores after the debate
| Candidate | Score | Change and reason |
|---|---|---|
| K2 | 4 | unchanged |
| K3 | 4 | 3→4: the chair's reshape is the split I named. Beacon, rollup and via registry go first with an idempotent per-key upsert (RE). The share-prompt.tsx and display-log.ts half waits for F-4 and F-13, so no live branch collides. |
| K45 | 4 | 3→4: the profile report now waits for F-9's lib/reports.ts and reuses it, which removes the forked-queue risk. The rest is new files. |
| K7 | 3 | 2→3: it now starts after F-10..F-13 and fixes #1, #2, #8, #9, #10 merge, which was my only objection. The verbatim pin test on D25, D27, F-4 and F-1 (DK) cuts rework risk. It is still an M across 11 files, so not higher. |
| K8 | 4 | 2→4: reshaped to lib/format.ts helpers plus the lo ≤ avg ≤ hi property test now, with the 16-file sweep after F-10..F-12 merge. That is the slice I asked for, and it leaves the snapshot tests on the strip branch alone. |
| K9 | 4 | 3→4: it now extends F-13's lib/a11y-contrast.test.ts and keeps lib/badge-contrast.test.ts, so there is no second test and the count never drops. It changes no values beyond the fixes and rides in K7's slot. The new-literal check (RT) is cheap. |
| K11 | 2 | unchanged |
| KV | 1 | unchanged |
| K15 | 2 | unchanged |
| K16 | 2 | unchanged |
| K17 | 2 | unchanged |
| K18 | 4 | unchanged |
| K19 | 3 | unchanged |
| K20 | 4 | unchanged |
| K21 | 1 | unchanged |
| K22 | 3 | unchanged |

#### Round 3: Reliability engineer, scores after the debate
| Candidate | Score | Change and reason |
|---|---|---|
| K2 | 4 | unchanged. RT is right that lib/delete.ts:13 already holds deleted handles, but TS shows changeHandle (lib/auth/attempts.ts:103-110) still frees a renamed handle at once. Start after #42 merges. |
| K3 | 4 | 3→4: the chair's reshape meets every condition I set. Rollup plus `via` first, idempotent per-key upsert (no hot row lock), fire-and-forget beacon that never blocks the page, a test that fails on any stored identifier, old share columns kept (additive), and the share_action half waits for F-4/F-13. |
| K45 | 5 | unchanged. Reshape matches my round-1 condition (after F-9, reusing lib/reports.ts). DV's tested and logged removal from rankings adds an integrity check I support. |
| K7 | 4 | 3→4: my objection was collision with six live builds. The reshape starts after F-10..F-13 merge and after fixes #1, #2, #8, #9, #10, and DK's verbatim pin test guards decided lines. That is the quiet window I asked for. |
| K8 | 3 | 2→3: reshaped to lib/format.ts helpers plus the lo ≤ avg ≤ hi property test now, with the 16-file sweep after F-10..F-12 merge. That was my stated condition. Not higher because fixes #7 and #19 already repair today's instances (RT). |
| K9 | 4 | 3→4: reshape extends F-13's lib/a11y-contrast.test.ts, keeps lib/badge-contrast.test.ts (test count never drops), changes no values, rides in K7's slot. RT's fail-on-new-colour-literal check closes the gap where literals outside :root regress unseen. |
| K11 | 2 | unchanged |
| KV | 1 | unchanged. DK, CS and RT: holding it while C4 waits is the consistent rule, and no K3 counts exist yet. |
| K15 | 2 | unchanged |
| K16 | 2 | unchanged |
| K17 | 2 | unchanged. Agree with DK and CS: send the Demo shape to the owner as the recommendation for C16. |
| K18 | 4 | 3→4: the reshape uses K45's signed-in, rate-limited report and its one audited hide, which was my round-1 condition (no second hide mechanism). Owner review before anything stays hidden makes a false report reversible. Attestation date already stored (db/schema.sql:31,194), so the rest is one additive column and a test. |
| K19 | 2 | unchanged. The reshape (only /how and the glossary, profiles out) removes the indexing risk, but it is fix-sized and should ride with fixes after fix #4 and F-7's sitemap edit, not take a slot. |
| K20 | 2 | unchanged |
| K21 | 1 | unchanged |
| K22 | 3 | unchanged |

#### Round 3: Legal and compliance, scores after the debate
| Candidate | Score | Change and reason |
|---|---|---|
| K2 | 5 | unchanged |
| K3 | 3 | unchanged. The reshape adds the test that fails on any stored identifier, which is half my condition. The other half (SCHEMA_MAP, cookie-table and log-scanner entries in the same PR, and the owner's Privacy Policy text covering it before real users) is still not in the shape. Veto stands if any stored row becomes per-viewer, including via values (TS point). |
| K45 | 5 | unchanged. Reshape (reuse F-9 lib/reports.ts, per-reporter rate limit, "Hidden pending review", logged removal) keeps all my conditions: hide never deletes, no thesis text in audit rows, takedown wording draft until owner approves, no safe-harbor claim. |
| K7 | 4 | unchanged |
| K8 | 4 | 3→4: the chair's reshape cuts it to lib/format.ts helpers, the lo ≤ avg ≤ hi property test and the "range is for the average, not one trade" line, with the 16-file sweep after F-10..F-12 (UX, EN, RE). That keeps the part that stops a misleading reading (POLICY F3c, COMPLIANCE §11) and drops the collision risk that held me at 3. No advice words in the What's-this line. |
| K9 | 3 | unchanged. Reshape (extend F-13's test, no value changes, colour-blind floor, no new literals) is good A1 hygiene but adds no new compliance coverage beyond fixes #12, #13, #26. |
| K11 | 2 | unchanged |
| KV | 1 | unchanged |
| K15 | 2 | unchanged |
| K16 | 2 | unchanged |
| K17 | 2 | 3→2: DK and CS show that a council slot would pre-empt the owner's pending C16 ruling on an owner-decided flow (F-1). The council can't decide what the owner holds. Send the Demo-only shape to the owner as a recommendation; it is lawful in that shape if the owner says yes. |
| K18 | 4 | unchanged. The reshape adopts my tightening (signed-in, rate-limited report via K45, hide only, owner reviews and runs any deletion). Veto stays on date of birth, ID or age estimation. |
| K19 | 2 | 1→2: the reshape (EN, DK) keeps profiles out of the sitemap until the owner opens launch, which removes my main objection (indexing consent text under P6, F-7 public filers under T2). /how and a glossary carry no new legal surface if the glossary has no advice or completeness words. Still little value now, and fix #4 (deleted users in sitemap) must land first. |
| K20 | 2 | unchanged |
| K21 | 1 | unchanged |
| K22 | 4 | unchanged. RE, BL and RT confirm lib/billing.ts:206-211 already behaves correctly, so the test only pins it; still a chore, not a slot. |

#### Round 3: Trust and safety, scores after the debate
| Candidate | Score | Change and reason |
|---|---|---|
| K2 | 5 | unchanged. RT and UX are right that sign-up is gated (lib/launch-gate.ts:61) and deletion holds handles 365 days (lib/delete.ts:13), but that is timing, not need: rename still frees a handle at once (lib/auth/attempts.ts:103-110) and U2 (POLICY.md:145) makes it a launch prerequisite. Start after #42 as reshaped. |
| K3 | 3 | 2→3: the chair's reshape adopts half my condition. A test now fails on any stored identifier and `via` is a closed registry, so no row can track a person. Not higher because it is still not sequenced after K45, and LG's point stands that the Privacy Policy text should describe the flow first. |
| K45 | 5 | unchanged. The reshape adds my per-reporter rate limit, reuses F-9's lib/reports.ts, and logs and tests the hide (DV). Hide never deletes. |
| K7 | 4 | unchanged. RT is right that fixes #1, #8, #10 take the false words out, but one bare Verified linked to its definition and a Demo look that can never read as verified still removes scam material. Reshaped start after F-10..F-13 and the fixes is fine. |
| K8 | 3 | 2→3: the reshape (UX, RE, PD) drops the 16-file sweep from this slice and keeps the harm-relevant part: the "range is for the average, not one trade" line and the lo ≤ avg ≤ hi test, which blunt "guaranteed returns" readings [FC-R18]. |
| K9 | 3 | 2→3: my stated condition is met. The chair's reshape rides it in K7's slot, and RT's new-colour-literal check closes the regression gap. Still no misuse effect of its own. |
| K11 | 2 | unchanged |
| KV | 1 | unchanged |
| K15 | 2 | unchanged |
| K16 | 1 | unchanged |
| K17 | 3 | unchanged. I agree with RT, LG and DK that it goes to the owner as the recommended Demo-only shape for C16, not a council slot. |
| K18 | 4 | unchanged. The reshape adopts what RT and I asked for: K45's signed-in, rate-limited report and audited hide, owner review before anything stays hidden, owner runs any deletion. |
| K19 | 2 | 1→2: the reshape keeps profiles out of the sitemap until launch, which removes my harvesting objection. /how and the glossary alone are harmless but carry no safety value, and fix #4 (sitemap with no deleted-user filter) should land first. |
| K20 | 1 | unchanged |
| K21 | 1 | unchanged |
| K22 | 3 | unchanged |

#### Round 3: Decisions keeper, scores after the debate
| Candidate | Score | Change and reason |
|---|---|---|
| K2 | 4 | unchanged |
| K3 | 4 | unchanged. The chair's split (beacon, rollup and via first; share_action after F-4/F-13) keeps it clear of F-4 and F-13 decided files. |
| K45 | 4 | unchanged. Waiting for F-9's lib/reports.ts respects F-9's own scope (F-9 Decisions :23-24). |
| K7 | 4 | 3→4: the chair adopted my round-3 condition (a test pins the D25, D27, F-4 and F-1 decided lines verbatim, start after F-10..F-13 merge and after fixes #1, #2, #8, #9, #10). F-7's label must still stay with F-7's committee and O-2 with the owner. |
| K8 | 4 | 3→4: the reshape (EN, RE, PD, DV, UX) defers the 16-file sweep until F-10..F-12 merge, so no decided wording is raced. The brief keeps confidence(), ranking, RANK_MIN_BETS, D23 order and "bet" (D24) untouched and O-15/16/17 with the owner (the briefs:219-220). |
| K9 | 4 | unchanged. The reshape matches my condition: extend F-13's test, keep lib/badge-contrast.test.ts, no values beyond the fixes list (settled conflict 9). |
| K11 | 2 | unchanged |
| KV | 1 | unchanged. Every member who argued it agreed it fails the same no-traffic test that holds C4/D23. |
| K15 | 2 | unchanged |
| K16 | 3 | unchanged |
| K17 | 2 | unchanged. Several members (CS, PF, RE, RT, PD, UX) agree it pre-empts the owner's pending C16 ruling. Send the Demo shape to the owner as the council's recommendation. |
| K18 | 4 | unchanged. The reshape onto K45's signed-in, rate-limited report and audited hide answers RT and keeps deletion with the owner (POLICY H). |
| K19 | 3 | unchanged. The reshape meets my condition (profiles stay out of the sitemap until the owner opens launch), so there is no conflict left. Its value is still small, which keeps it at 3. |
| K20 | 3 | unchanged |
| K21 | 2 | unchanged |
| K22 | 4 | unchanged |

#### Round 3: Common sense, scores after the debate
| Candidate | Score | Change and reason |
|---|---|---|
| K2 | 4 | unchanged |
| K3 | 4 | unchanged (the chair's split, beacon and via first and the share button after F-4/F-13, is the shape I asked for in round 1) |
| K45 | 4 | unchanged |
| K7 | 4 | unchanged (DK's verbatim pin test for D25, D27, F-4 and F-1 lines answers the decided-wording risk) |
| K8 | 3 | 2→3: the chair's reshape is what I named in my round-3 argument. It is now lib/format.ts helpers, the lo ≤ avg ≤ hi property test and the one range line, with the 16-file sweep after F-10..F-12 merge (EN, RE, DV, UX). Not 4, because fixes #7 and #19 already remove the misleading numbers a viewer sees today |
| K9 | 4 | 3→4: my stated condition is met. It extends F-13's lib/a11y-contrast.test.ts, keeps lib/badge-contrast.test.ts, changes no values beyond the fixes list and rides in K7's slot (A11Y, DK, DV). RT's no-new-literal check also closes the gap I saw |
| K11 | 1 | unchanged |
| KV | 1 | unchanged (DK, RT, MR and BL agree: no traffic, same reason C4/D23 is held) |
| K15 | 2 | unchanged |
| K16 | 2 | unchanged |
| K17 | 2 | unchanged (send it to the owner as the council's recommended Demo shape for C16) |
| K18 | 4 | unchanged (the signed-in, rate-limited reporter and owner review answer RT's harassment point) |
| K19 | 2 | unchanged (the /how and glossary narrowing helps, but it is still fix-sized with effect after week 8) |
| K20 | 3 | unchanged (ride with the fixes, no slot) |
| K21 | 1 | unchanged |
| K22 | 3 | unchanged (ride as a chore; lib/billing.ts:206-211 already cancels directly) |

#### Round 3: Red team, scores after the debate
| Candidate | Score | Change and reason |
|---|---|---|
| K2 | 4 | 3→4: TS and LG showed my round-1 rebuttal was incomplete. changeHandle (lib/auth/attempts.ts:103-110 on main) frees the old handle at once on rename, and the 365-day hold in lib/delete.ts:13 covers deletion only. Display names are only trimmed to 40 chars (attempts.ts:59). That is a real U2 gap. Holds only if it starts after #42 (round-0 rule, EN, MR) and ships a test that refuses "support" and a bidi name. |
| K3 | 4 | unchanged. The chair's reshape is the first slice I asked for, and the test that fails on any stored identifier is my drop condition. Remaining case against: it counts nothing until there is traffic, and LG's Privacy Policy order still applies before real users. |
| K45 | 4 | 3→4: RE showed the digest is not zeros. The sync tick outcome is only a JSON reply and a log line today (app/api/sync/route.ts:70-71), so the digest is the first view of a stalled sync, useful on demo data now. The reshape also waits for F-9's lib/reports.ts and adds the per-reporter rate limit. The takedown wording still lands as a draft until the owner writes it. |
| K7 | 3 | 2→3: MR's point moved me. One Verified wording is the precondition for reading the T10 add-on on what "Verified" means (market §2 row 20), so it is more than polish. The reshape starts after F-10..F-13 and fixes #1, #8, #9, #10 merge and pins D25, D27, F-4 and F-1 lines verbatim, which removes my collision objection. Still: if the post-fix grep finds zero false words, the rest can slip to a quiet cycle. |
| K8 | 3 | 2→3: the reshape is my own cheapest test plus the helpers. Now = lib/format.ts pct()/tone() with Flat, the lo ≤ avg ≤ hi property test on every printed range and one What's-this line; the 16-file sweep waits for F-10..F-12. That removes the collision risk. Not higher: fixes #7 and #19 already take the false numbers. |
| K9 | 4 | 3→4: my stated condition is met. The reshape rides in K7's slot, extends F-13's contrast test instead of adding one, and fails on new colour literals, which closes the "only pins listed pairs" hole. |
| K11 | 1 | unchanged. Still blocked by F-12 and owner flags O-2/O-4; nobody argued otherwise. |
| KV | 1 | unchanged. Every member, including those scoring high by rank, agreed no arm can be read without K3 counts, the same reason C4/D23 is held. |
| K15 | 1 | unchanged. No real trader exists and it needs #42's session (DK, CS). |
| K16 | 1 | unchanged. Most members agree it must wait for fixes #15-#18 and F-10/F-13 to merge; revisit if a keyboard audit still fails then. |
| K17 | 2 | unchanged. The chair notes it pre-empts the owner's pending C16 ruling. It should go to the owner as the recommended Demo-only shape, not take a slot. |
| K18 | 3 | 2→3: my stated condition is met. The reshape uses K45's signed-in, rate-limited report and audited hide, and the owner reviews before anything stays hidden. The build should still test that one fresh account cannot hide a demo profile. |
| K19 | 2 | 1→2: the reshape keeps profiles out of the sitemap until the owner opens launch, which removes my main objection (indexing demo records on a closed site). It stays low: the effect lands after week 8, and fix #4 (sitemap has no deleted-user filter) must land first. |
| K20 | 2 | unchanged. XS and harmless; it rides with the fixes and needs no slot. |
| K21 | 1 | unchanged. Nothing has changed since cycle 1, and TS adds that handle search helps impostors before K2 exists. |
| K22 | 2 | unchanged. lib/billing.ts:206-211 already cancels directly; it rides as a chore with no slot. |


### Round 4: second-vote ballots

#### Round 4: Business lead
| Candidate | Score | Reason |
|---|---|---|
| K3 | 5 | The only candidate that makes gates G1-G4 readable (DESIGN §3.5, MRC2 finding 1). Without it the week-8 kill or continue call is blind. The reshaped first slice (beacon, rollup, via) keeps that core and moves share_action after F-4/F-13. |
| K45 | 3 | U2/U3 list profile report and takedown as launch prerequisites, and it protects trust in shared records (G3). It moves no gate itself. Right shape after F-9, and K18 can ride in its slot. |
| K2 | 3 | Cheap guard on the core asset, since real linkable records are scam bait (MRC2-6). Sign-up is gated closed (lib/launch-gate.ts:61), so no effect before #42 and launch. |
| K7 | 3 | "Verified" is the wedge and one wording is needed to read F3a. Market row 20 rates it about 0 on the gates. The false parts are fixes #1, #8, #10, and the rest waits for F-10..F-13. |
| K8 | 4 | Strongest viewer-side evidence (D24 Strong, FC-R18/R19) and the T10 precondition for D23. Reshaped to helpers, the lo ≤ avg ≤ hi test and the What's-this line now, with the sweep after F-10..F-12, so the collision risk is gone. |
| K9 | 3 | No demand or gate effect, but the reshape costs no slot of its own (rides with K7) and changes no values beyond the fixes list. A cheap permanent regression guard. |
| K18 | 2 | Honest and mostly stored already (db/schema.sql:31,194). No demand effect. It should ride inside K45's slot as conditions, not be approved on its own. |
| K20 | 2 | Helps founder outreach links to "/" (MRC2-4), but it takes under an hour. It belongs on the fixes list as a rider, not in one of six slots. |
| K22 | 1 | LIVE_BILLING is off and no revenue flows before launch. lib/billing.ts:206-211 already cancels directly. Three test-only checks fit a chore, not a slot. |

#### Round 4: Market research lead
| Candidate | Score | Reason |
|---|---|---|
| K3 | 5 | Still the only item without which G2-G4 (DESIGN §3.5) cannot be read at all (market finding 1, FACT High). The reshaped first slice (beacon, rollup, via registry, no stored identifier) is exactly what the gates need; keep the 200 bot / 50 human validation before week 1 and strict numbers beside any readout. |
| K45 | 4 | Market §2 row 17 rates profile report plus impersonation category as required (U2/U3); real linkable records are scam bait (FC-R28). Protective, not growth. Reusing F-9's lib/reports.ts keeps it cheap; wait for F-9. |
| K2 | 4 | Same scam-bait evidence and U2 launch prerequisite. Small, own file (lib/handles.ts), starts after #42. Worth its own slot. |
| K7 | 3 | Removes the identity misread of Verified (F3a) but gate effect is about 0 (market §2 row 20) and its comprehension check needs K3 traffic first. Honest work; starts late (after F-10..F-13 and fixes #1 #2 #8-#10). |
| K8 | 5 | Strongest viewer-side evidence we hold: a third of US adults at the lowest numeracy level (FC-R19) and the CI-of-mean misread (FC-R18). The reshape (helpers, lo ≤ avg ≤ hi test, "range is for the average" line now; sweep after merge) removes the file-collision worry. |
| K9 | 3 | A1 hygiene with no gate effect (market §2 row 25), but a permanent regression guard. Fine only because it rides in K7's slot and costs no extra approval. |
| K18 | 3 | No demand effect; legal risk reduction for the 2027 age laws (MRC2-12). Now reuses K45's report and hide, so it is small enough to ride with K45 rather than take a slot of its own. |
| K20 | 2 | Real but small viewer effect: founder outreach sends "/" and main has no root share image (app/layout.tsx:11 text only). Under an hour; better built with the fixes list than spent on an approval. |
| K22 | 2 | No demand effect before live charges (pricing risk is conversion, market finding 5); cancel already opens the portal directly (lib/billing.ts:206-211). Three tests; ride with a chore, not a slot. |

#### Round 4: Pricing and finance

Basis: docs/direction/business-2026-11-01.md. Fixed cost about $145/month (:101, :793). Agent spend about $25.7 per session and $192 per merged feature (:112, :272, :635). Revenue is $0 until the week-8 gates. Break-even is about 23 payers at 50 traders, or about 9,200 viewers (:585, :794). Viewers per trader is the weakest input (:1025, :1053). Slot view: K3, K45, K2, K7+K9 (one slot) and K8 use five of six slots at roughly $400-600 in all. K18, K20 and K22 are XS and cost less as riders than as slots.

| Candidate | Score | Reason |
|---|---|---|
| K3 | 5 | The only spend that buys information. The week-8 gates and the viewers-per-trader input can't be read without it. The reshaped first slice is M at about $80-130 with no rebase cost against F-4/F-13. |
| K45 | 4 | A launch cost (U2, U3) we must pay anyway, only reordered. Reusing F-9's lib/reports.ts avoids paying for a second queue, and no email keeps vendor cost at $0. About $50-80. |
| K2 | 4 | S-M, about $40-80, owed before real users (U2). Cheapest right after #42 while lib/auth is fresh. Cheap insurance against impersonation-scam cost the $145/month model leaves out. |
| K7 | 4 | Starting after F-10..F-13 and the fixes removes the pay-twice risk. One wording is needed before T10 can be read, so it also buys usable information. Shares one slot with K9. |
| K8 | 3 | The reshaped first slice is S with little collision cost. But fixes #7 and #19 already take the misleading parts, so the marginal value per dollar is lower than the top four. |
| K9 | 4 | Extends F-13's existing contrast test and rides in K7's slot, so near-zero slot cost. It stops a third round of paid contrast fixes. |
| K18 | 3 | XS-S, mostly one version string and a test on top of K45's report and hide. Worth doing, but it should be built inside K45's slot, not approved as its own item. |
| K20 | 3 | Under one session and helps click-through on the only viewer channel there is. Too small for a slot. Ride with the fixes. |
| K22 | 3 | Test-only and protects future refund and chargeback cost (:430). Behaviour already holds (lib/billing.ts:206-211). Ride with a chore, no slot. |

#### Round 4: Growth
| Candidate | Score | Reason |
|---|---|---|
| K3 | 5 | Still the only way to know if records travel: app/share-button.tsx shares a bare path with no via tag today. The reshaped slice (beacon, daily rollup, closed via registry, ?via= on Share) counts only and rewards nobody (F6). |
| K45 | 3 | Report and audited hide make a shared link safe to land on, and one impostor story costs more views than most features add. It does not itself make records travel; reusing F-9's lib/reports.ts keeps it cheap. |
| K2 | 4 | changeHandle frees the old handle at once (lib/auth/attempts.ts:103-110) and the 365-day hold covers deletion only (lib/delete.ts:13), so a forwarded link or card can land on a stranger. Durable links are a growth need. |
| K7 | 3 | One Verified word linked to /how makes a forwarded card credible to a stranger. It waits on F-10..F-13 and fixes, so the effect is late. |
| K8 | 3 | The helpers, lo ≤ avg ≤ hi test and range line make numbers on cards read right at a glance. The deferred sweep removes my build-conflict worry; modest effect on sharing. |
| K9 | 1 | Good hygiene and it rides in K7's slot, but it has no effect on links or cards travelling. |
| K18 | 2 | Using K45's rate-limited, audited hide meets my condition. Pinning the signed-out order keeps shared-link landings the same for all; no growth upside, and small enough to ride with K45. |
| K20 | 4 | "/" still unfurls bare (no app/opengraph-image.tsx; app/layout.tsx:11). Under an hour, no figures, name or logo. Better ridden with the fixes than given a slot. |
| K22 | 1 | Billing is test mode only and lib/billing.ts:206-211 already cancels directly. Fine as a chore; no effect on sharing. |

#### Round 4: UX lead
| Candidate | Score | Reason |
|---|---|---|
| K3 | 4 | The reshaped first slice (beacon, rollup, via registry) never blocks the page and stores no identifier. It is the only way to read whether first-time viewers open What's-this or understand the record. Share-button half rightly waits for F-4/F-13. |
| K45 | 4 | A labelled report form and a "Hidden pending review" state instead of a vanished profile are trust cues a first-time viewer expects. Reusing F-9's lib/reports.ts keeps one report pattern. |
| K2 | 3 | Refusing "Verified", check glyphs and bidi tricks in display names protects viewers, but each rejection still does not name its rule next to the field, and it waits for #42. |
| K7 | 5 | Most direct trust fix. Verified reads three ways today (app/ui.tsx:11, lib/copy.ts:130, t/[symbol]/opengraph-image.tsx:41). One wording linked to its definition, pinned by test after F-10..F-13 and the fixes. |
| K8 | 5 | Lay readers take a range of the average as the spread of single trades. Helpers, the lo <= avg <= hi test and the "range is for the average, not one trade" line land now; the 16-file sweep waits for F-10..F-12, so no collision. |
| K9 | 4 | Pins gain-vs-loss legibility for colour-blind viewers and stops contrast regressing. Changes no values and shares K7's slot, so it costs no extra slot. |
| K18 | 3 | Right to reuse K45's report and its single hidden state, so viewers meet one hidden screen. Mostly invisible and the attestation is already stored, so it may be better as a K45 rider than its own approval. |
| K20 | 2 | A plain, honest home-link preview helps the first click from a shared link, but it is under an hour and fits the fixes list, not a slot. |
| K22 | 2 | Cancel already opens the hosted portal directly (lib/billing.ts:206-211) and billing is test mode. Mostly tests, so it should ride as a chore. |

#### Round 4: Product designer
| Candidate | Score | Reason |
|---|---|---|
| K3 | 4 | Not a screen change, and the reshaped Share flow only adds a short `?via=` plus an announced copy confirmation. Every later design choice (K7 wording, K8 What's-this line) is unreadable without these counts. |
| K45 | 4 | One report entry pattern across thesis and profile by reusing F-9's lib/reports.ts, and one neutral "Hidden pending review" state, never a partial record. Waits for F-9, so it sits after the running builds. |
| K2 | 3 | Sound rule, but almost no screen: sign-up is gated closed (lib/launch-gate.ts:61) and it waits for #42. Still lacks one shared rejection pattern tied to the field for sign-up and rename. |
| K7 | 5 | Biggest coherence gap on main: three Verified spellings (app/ui.tsx:11, lib/copy.ts:130, app/t/[symbol]/opengraph-image.tsx:41) and two Demo names. One TRUST_LOOK table stops F-10..F-13 inventing a fourth; decided lines pinned verbatim. |
| K8 | 4 | One pct()/tone() with Flat and lo ≤ avg ≤ hi make every surface read as one product; 0.0% stops reading as a gain. Helpers and property test now, the 16-file sweep after F-10..F-12. |
| K9 | 4 | Value-neutral tokens and one extended contrast test are what keep later screens one design; no visible restyle. Rides in K7's slot (shared app/globals.css), so it costs no extra slot. |
| K18 | 3 | Right shape now that it uses K45's report and audited hide, but that means it has no flow of its own. Better written into K45's scope (plus the order-pinning test as a rider) than spent as a separate approval. |
| K20 | 2 | Gives "/" the same unfurl as profiles, but with no name, logo or figures it is a one-line card under an hour. Ride with the fixes list, no slot. |
| K22 | 2 | Test-only checks on merged F-3 files; cancel already opens the portal directly (lib/billing.ts:206-211). Ride as a chore, no slot. |

#### Round 4: Data-visualization designer
| Candidate | Score | Reason |
|---|---|---|
| K3 | 4 | Counts-only beacon and daily rollup are the only way to read whether K8's "What's this?" line and the range are understood. The reshape defers the share-button half past F-4/F-13, and a test fails on any stored identifier. No figure risk. |
| K45 | 3 | No figures, but my condition holds in the reshape: a hidden profile says "Hidden pending review" and its exit from the lower-bound ranking is tested and logged, so other ranks never shift with no visible cause. Whole profile only, never one trade (TR-1). |
| K2 | 3 | No chart effect. Refusing check glyphs and "Verified" in display names keeps unearned trust away from a record's numbers. Waits for #42, so a slot may sit idle this cycle. |
| K7 | 4 | One Verified wording on the stats row is the precondition for reading the headline figures with their source. Starts after F-10..F-13 and fixes #1, #8, #10, and pins D25/D27/F-4/F-1 lines verbatim. |
| K8 | 5 | The honest-number guard: one pct()/tone() with Flat for 0.0%, the lo ≤ avg ≤ hi property test on every printed range, and "the range is for the average, not one trade" (TR-9). Stops new F-10..F-12 surfaces repeating fixes #7 and #19. Sweep waits for those merges. |
| K9 | 5 | Pins the measured failures for good: deutan gain/loss ΔE00 2.8 (fix #26) and Verified 3.77:1 (fix #12), plus a gain-vs-loss colour-blind floor and a fail on new colour literals. Extends F-13's contrast test, value-neutral, rides in K7's slot so it costs no extra cap. |
| K18 | 3 | Pinning the signed-out lower-bound order with a test is the TR-9 Ranking Must. The minor report reuses K45's audited hide with owner review. Small enough that it could ride with K45 instead of its own slot. |
| K20 | 2 | No figures planned, so no encoding risk and little to gain. Under an hour: ride with the fixes list, not a slot. |
| K22 | 2 | No price display is live with LIVE_BILLING off. A "never a struck was-price" test is honest but belongs in a chore on merged F-3 files. |

#### Round 4: Accessibility specialist
| Candidate | Score | Reason |
|---|---|---|
| K3 | 4 | Reshaped slice changes no button names, focus or motion, and the copy confirmation must be announced in a polite live region (4.1.3). Neutral for access, high value for the gates. |
| K45 | 3 | All my conditions are bound (labelled form, announced errors and "sent", own page title per 2.4.2, plain-text line). Safe for access but adds no A1 gain. Launch case sits outside my lens. |
| K2 | 3 | Normaliser stops bidi and look-alike tricks that also fool screen-reader users. Still no binding that each rejection names its rule next to the field (3.3.1, 3.3.3). Waits for #42. |
| K7 | 4 | Badge meaning lives only in a title tooltip today (app/ui.tsx:11), out of reach for keyboard and touch (1.3.1, 1.4.13 intent). Linked badge with visible definition fixes that. Shares one slot with K9, after F-10..F-13 and the named fixes. |
| K8 | 3 | Helpers and the property test are sound, but the screen-reader gain (U+2212 read as minus, Flat in text) only arrives with the later 16-file sweep. Could almost ride as a chore. |
| K9 | 5 | POLICY A1 (docs/POLICY.md:152-155) has only lib/badge-contrast.test.ts as a guard on main. Extending F-13's contrast test to every token pair, both schemes, focus 3:1, plus a colour-blind gain-vs-loss floor stops regressions. Cheap, value-neutral, rides in K7's slot. |
| K18 | 2 | No access gain. The report path reuses K45's labelled form, which meets my condition. Small enough to fold into K45 rather than take its own approval. |
| K20 | 2 | Fix-sized. The og image needs a meaningful alt and no image-only meaning. Better ridden with the fixes list than given a slot. |
| K22 | 2 | Cancel with no added step helps cognitive access, but it is tests on merged F-3 files. Should ride as a chore, not take a slot. |

#### Round 4: Engineer
| Candidate | Score | Reason |
|---|---|---|
| K3 | 4 | The reshaped first slice is additive (beacon route, daily rollup, via registry, idempotent upsert) and stays clear of share-prompt.tsx and display-log.ts until F-4/F-13 finish. M is the biggest build here, so not 5. |
| K45 | 4 | Mostly new files (digest page, hide script, takedown page, runbook). Starting after F-9 merges and reusing lib/reports.ts removes the forked-queue risk. It is S-M with one sequencing gate. |
| K2 | 4 | New lib/handles.ts plus signup and rename checks. No running feature branch touches it. Gated only on #42 (lib/auth/attempts.ts) and F-9's normaliser, so it sequences cleanly. |
| K7 | 3 | Feasible only after F-10..F-13 and fixes #1, #2, #8, #9, #10 merge. It is still an M across about 11 shared files (app/ui.tsx, lib/copy.ts, app/pane.tsx, globals.css), so it carries real rebase risk. The verbatim pin test helps. |
| K8 | 4 | The reshaped slice is lib/format.ts helpers plus the lo ≤ avg ≤ hi property test, which touches nothing a live branch edits. The 16-file sweep waits for F-10..F-12. Clear tests, low risk. |
| K9 | 4 | It extends F-13's lib/a11y-contrast.test.ts, keeps lib/badge-contrast.test.ts and changes no values. It is small and shares K7's slot, so it costs no extra slot. |
| K18 | 3 | It is S and safe, because the attestation is already logged (db/schema.sql:31,194). What remains is a version string, an order-pin test and a report category on K45. It is small enough to ride inside K45's slot rather than take its own. |
| K20 | 2 | XS: one new app/opengraph-image.tsx (none exists at root) with no figures. It is too small to spend a slot on. It should ride as a chore or with the fixes list. |
| K22 | 1 | The cancel flow already opens the processor's cancel flow directly (lib/billing.ts:205-213), so the main check already holds. The two copy checks are a test-only chore and not worth a slot. |

#### Round 4: Reliability engineer
| Candidate | Score | Reason |
|---|---|---|
| K3 | 4 | Reshaped slice is safe to run: additive rollup, idempotent per-key upsert, fire-and-forget beacon that never blocks the page, a test that fails on any stored identifier. share_action waits for F-4/F-13. Not 5 because it adds a write on every public view and needs a size and retention bound on the rollup. |
| K45 | 5 | Reuses F-9's lib/reports.ts after it merges, so there is one report path and one audited hide. Rate limit per reporter and a tested, logged removal from rankings protect ranking integrity. |
| K2 | 4 | Closes a real integrity gap: changeHandle (lib/auth/attempts.ts:103-110) frees a renamed handle at once while lib/delete.ts:13 holds deleted ones 365 days. Start after #42 merges, since #42 owns that file. |
| K7 | 4 | Safe only in the quiet window it now has: after F-10..F-13 merge and after fixes #1, #2, #8, #9, #10. The verbatim pin test on D25, D27, F-4 and F-1 guards decided lines against drift. |
| K8 | 3 | lib/format.ts helpers and the lo <= avg <= hi property test are worth having, but fixes #7 and #19 already repair today's wrong figures. The sweep waits for F-10..F-12. Overlaps K7 files, so it competes for the same slot. |
| K9 | 4 | Extends F-13's contrast test, keeps lib/badge-contrast.test.ts (test count never drops), changes no values, fails on new colour literals. Rides in K7's slot, so it costs no extra slot. |
| K18 | 4 | Uses K45's report and its one audited hide, no second hide mechanism. Owner review before anything stays hidden keeps a false report reversible. Attestation date is already stored (db/schema.sql:31,194). Depends on K45 landing first. |
| K20 | 2 | No reliability risk, no data path. Under one hour of work, so it belongs on the fixes list or a chore, not in one of six slots. |
| K22 | 2 | Pins behaviour that is correct today (lib/billing.ts:206-211 opens the hosted cancel portal directly) before money is real. Useful as a test, but XS and test-mode only, so it should ride with a chore rather than take a slot. 3 to 2 for that reason. |

#### Round 4: Legal and compliance
| Candidate | Score | Reason |
|---|---|---|
| K3 | 3 | Reshape adds a test that fails on any stored identifier, but the SCHEMA_MAP, cookie-table and log-scanner entries are still not required in the same PR, and the owner's Privacy Policy text must cover it before real users. Veto if any stored row (including via values) becomes per-viewer. |
| K45 | 5 | Fills a real gap (report and takedown path, POLICY U2 and COMPLIANCE notice-and-action). Hide never deletes, no thesis text in audit rows, takedown wording stays draft until the owner approves, no safe-harbor claim. |
| K2 | 5 | Reserved handles and display-name rules are POLICY U2 launch prerequisites and stop impersonation and fake "Verified" names. Reserved list must hold no third-party or real people's names. |
| K7 | 4 | Removes false and completeness wording ("Cannot be edited", "full record", demo called verified) under POLICY F3a. Pinning decided lines verbatim protects owner decisions. Waits for F-10..F-13 and the listed fixes. |
| K8 | 4 | The lo <= avg <= hi test and the "range is for the average, not one trade" line stop a misleading reading (POLICY F3c, COMPLIANCE 11). No advice words in the What's-this line. Sweep waits for F-10..F-12. |
| K9 | 3 | Good A1 hygiene and it rides in K7's slot, but it adds little compliance coverage beyond fixes #12, #13, #26. |
| K18 | 4 | Reshape takes my conditions: signed-in, rate-limited report via K45, hide only, owner reviews and runs any deletion. Attestation date is already stored (db/schema.sql:31,194). Shares K45's files, so it should share its slot. Veto on date of birth, ID or age estimation. |
| K20 | 2 | POLICY T5a bars the product name, logo or wordmark before a clearance search, so the image can carry only a generic line with no figures. Under an hour of work: fixes or chore list, not a slot. |
| K22 | 3 | The checks pin simple cancellation, no fictitious "was" price and no "paid data is more accurate" claim before LIVE_BILLING. lib/billing.ts:206-211 already behaves correctly, so it is test-only: worth doing, but as a chore without a slot, so lowered from 4. |

#### Round 4: Trust and safety
| Candidate | Score | Reason |
|---|---|---|
| K3 | 3 | Reshaped slice is safe (closed via registry, a test fails on any stored identifier) but it reduces no harm and is not sequenced after K45. The Privacy Policy text should describe the beacon first. |
| K45 | 5 | Launch prerequisite under POLICY U2 and U3. Today only theses can be reported (F-9), so an impersonated trader has nowhere to go. Reshape adds the per-reporter rate limit, reuses lib/reports.ts and logs the hide. |
| K2 | 5 | Rename frees the old handle at once (lib/auth/attempts.ts:103-110) and display names accept "Verified" or check glyphs. Closes the main impersonation hole, size S after #42. |
| K7 | 4 | One bare Verified linked to its definition and a Demo look that never reads as verified removes scam screenshot material. Starts after F-10..F-13 and the listed fixes. |
| K8 | 3 | The average-not-one-trade line and the lo le avg le hi test blunt guaranteed-returns readings. Small enough that it could ride with the fixes list instead of a slot. |
| K9 | 3 | Real accessibility value with no misuse effect. Acceptable only riding in K7's slot as reshaped. |
| K18 | 4 | Only candidate protecting a person who should not be here. Shares K45's rate-limited report and audited hide, owner reviews and runs any deletion. Should share K45's slot since it touches the same report files. |
| K20 | 1 | Harmless and under an hour with no safety effect. Ride with the fixes, not a slot. |
| K22 | 2 | Dark-pattern tests protect paying users, but charges are off and the cancel flow already opens the hosted portal (lib/billing.ts:206-211). Ride with a chore, not a slot. |

#### Round 4: Decisions keeper
| Candidate | Score | Reason |
|---|---|---|
| K3 | 4 | No owner or board decision conflicts with the reshaped first slice. F-13 (no before/after claim until counters exist), idea 13 (counters as a week-0 prerequisite) and GTM 2026-11-01 (no cookie, attribution only, DESIGN 3.5 numbers unchanged) all wait for it. The share_action half must wait for F-4/F-13 as the chair set. |
| K45 | 4 | It carries out POLICY U2/U3 and BC-2. Waiting for F-9's lib/reports.ts respects F-9's scope. Hiding whole profiles or theses only keeps TR-1. Takedown wording stays the owner's. |
| K2 | 4 | It carries out POLICY U2 and idea 13/17 launch prerequisites. It waits for #42. The reserved list holds generic and own-product words only (T1). The hold is 1 year or less (TR-5). Retiring handles forever (O-9) stays with the owner. |
| K7 | 4 | Clear only on the chair's terms. A test pins D25, D27, F-4 and F-1 decided lines verbatim. It starts after F-10..F-13 and fixes #1, #2, #8, #9, #10. F-7's label stays with F-7's committee and O-2 with the owner. It shares a slot with K9. |
| K8 | 4 | The deferred sweep races no decided wording. "bet" (D24), D23 order, confidence(), ranking and RANK_MIN_BETS stay untouched. O-15/16/17 stay with the owner. Pinned tests are updated, never deleted. |
| K9 | 4 | No decision conflict. It is value-neutral (settled conflict 9 keeps base and accent fixed until V-1). It extends F-13's test and keeps lib/badge-contrast.test.ts, so the test count holds. It rides in K7's slot. |
| K18 | 3 | Every part carries out an existing decision (F-1 attestation, D26 versioned consents, TR-9 signed-out order, POLICY H deletion by the owner). It is small and depends on K45, so it fits better as a rider on K45 than as its own approval. |
| K20 | 2 | No conflict if it uses the positioning constant (not D27's line, DSP-2 is at the idea board) with no name, logo or figure (T5a). It is under an hour: put it on the fixes list, not in a slot. |
| K22 | 3 | It only pins F-3 2026-11-01 decisions in tests (self-serve cancel with no added step, paid never richer than free, processor sends every billing email). No conflict. It is XS and rides better as a chore than as an approval. |

#### Round 4: Common sense
| Candidate | Score | Reason |
|---|---|---|
| K3 | 4 | Still the one thing the week-8 gates can't do without. The adopted split (beacon, rollup and via first; share_action after F-4/F-13) is in proportion, and the test that fails on any stored identifier keeps it honest. Not 5 because it adds a data flow the owner's Privacy Policy must cover before real users |
| K45 | 4 | Report link, audited hide that never deletes, "Hidden pending review" shown instead of silent removal, owner-approved takedown wording. Basic launch homework a careful owner expects. Waits for F-9's lib/reports.ts, which is the right order |
| K2 | 4 | A display name saying "Verified" or a look-alike handle would fool a first-time viewer. Cheap, generic list only (T1), rename hold within TR-5. Starts after #42 |
| K7 | 4 | Three Verified wordings and three Demo names confuse viewers; the verbatim pin test for D25, D27, F-4 and F-1 removes the decided-wording risk. Starts after F-10..F-13 and fixes #1, #2, #8, #9, #10 |
| K8 | 3 | The reshape is right-sized (helpers, lo ≤ avg ≤ hi property test, one range line). Still 3: fixes #7 and #19 already remove the misleading numbers a viewer sees, so what's left is mostly tidiness this cycle |
| K9 | 4 | One test that extends F-13's contrast test, changes no values beyond the fixes list and rides in K7's slot. Cheap and lasting; costs no slot |
| K18 | 4 | Version string only, hide on report through K45's rate-limited path, owner runs any deletion, no age guessing. Rides in K45's slot |
| K20 | 2 | Worth doing (no app/opengraph-image today, layout.tsx:11 only), but it is one file under an hour. Better left unapproved and done with the fixes than shown as one of six approvals |
| K22 | 2 | Cancel already opens the portal directly (lib/billing.ts:206-211) and billing is test-mode only. Three pinning tests are a chore, not an approval |

#### Round 4: Red team
| Candidate | Score | Reason |
|---|---|---|
| K3 | 4 | The first slice holds up: G1-G4 can't be computed from db/schema.sql today, and a test fails on any stored identifier. Case against: it counts nothing until there is traffic, and the Privacy Policy must describe it before real users. |
| K45 | 4 | The reshape waits for F-9's lib/reports.ts and adds a per-reporter rate limit. The digest is the first view of a stalled sync (app/api/sync/route.ts:70-71 only logs today). Case against: the takedown wording stays a draft until the owner writes it. |
| K2 | 4 | A real U2 gap: changeHandle frees the old handle at once (lib/auth/attempts.ts:103-110) and display names are only trimmed (attempts.ts:59). Valid only if it starts after #42 and a test refuses "support" and a bidi name. |
| K7 | 3 | The false lines are fixes #1, #8 and #10, so what is left is consistency plus a verbatim pin of D25, D27, F-4 and F-1. Starting after F-10..F-13 removes the collision. Cheapest test: if the post-fix grep finds no false words, it could wait. |
| K8 | 3 | Fixes #7 and #19 already take the false numbers. The format.ts helpers and the lo <= avg <= hi property test are cheap and lasting. The 16-file sweep is deferred, so the conflict risk is gone. It could nearly ride as a chore. |
| K9 | 4 | It rides in K7's slot, extends F-13's contrast test and fails on new colour literals, which closes the hole where only listed pairs are pinned. Value-neutral, cheap and permanent. |
| K18 | 3 | With K45's signed-in, rate-limited report and owner review, it no longer works as a harassment tool. It is small and shares K45's files, so it fits in K45's slot. The build must test that one fresh account cannot hide a demo profile. |
| K20 | 2 | XS and harmless. The positioning line is contested at the idea board (DSP-2/DSP-3) and T5a allows no name, logo or figures. Ride it as a chore after the idea board rules, not in a slot. |
| K22 | 2 | lib/billing.ts:206-211 already opens the portal straight on cancel, and billing runs in test mode. It is mostly tests for behaviour that already holds. Good ROSCA guard, so ride it as a chore. |


### Round 5: red team's case

#### Round 5: red team's case against each shortlisted candidate

Member RT (red team). Base: origin/main 31004e7, where every line below was opened. Note: origin/main has since
moved to d7dd37e (#40 corporate actions merged; it touches `app/u/[handle]/page.tsx`, `lib/copy.ts`, `lib/trades.ts`,
`lib/sync.ts`, `db/schema.sql`), so `page.tsx` and `lib/trades.ts` line numbers may shift by a few lines.
Each case is the strongest reason not to approve now. Each condition is one the voters can attach.

### K3 measurement foundation, first slice (4.13)

**Case.**
1. It cannot read the gates it is sold on. DESIGN §3.5 (`docs/DESIGN.md:246-252`) has four gates. G1 (connected
   traders) is already readable from `connections`. G4 is "Viewer D7 return ≥ 15%", which needs a returning-viewer
   identifier. The slice bans any viewer id, session id or cookie, so G4 stays unreadable by design. G3 counts "Profile
   views from external referrers". Without dedup, one person reloading, or a scripted browser with a normal user agent,
   counts as many views. A 5,000/week gate can then be met or missed by noise, and the week-8 continue/kill call rests
   on that number.
2. Rows can outlive the account. If the rollup is keyed by path (`/u/<handle>`), it holds view counts about a named
   trader but has no `user_id`. The retention test only demands cascade for tables with a `user_id/viewer_id/trader_id
   references users` column (`lib/privacy-retention.test.ts:28-35`), so it would not catch this.
   - Today a rename frees the old handle at once (`lib/auth/attempts.ts:102-110`).
   - A deleted handle is reissued after 365 days (`lib/delete.ts:13`).
   - Either way, the old person's view history attaches to the new holder of the handle, and a deleted user's
     counts stay (POLICY P6).
3. Small counts can identify a viewer. Suppose a row reads "via=invite, /u/x, 1 view, 2026-11-03". A trader who sent
   one invite then knows that the recipient opened it. "No identifier stored" does not make a count of 1 anonymous.
4. It collides with work already listed. Fix #28 edits the same `REFERRED_SURFACES` list (`lib/referral.ts:12`) that
   the via registry replaces. A beacon mounted site-wide lands in `app/layout.tsx`, which F-13 (nav label) and K7
   (footer) both edit.

**Cheapest test.**
- A db test: insert rollup rows for a profile, call `deleteProfile`, assert no row still names that handle or user.
- Then rename A→B, create a new user as A, and assert A's old counts are not shown under the new user.
- A unit test that the readout prints no cell under k (e.g. 5) for any path × via × day.

**Neutralising condition.**
- Key per-profile rows by `user_id references users on delete cascade`, never by handle text.
- Suppress any readout cell below k = 5, or roll small via classes into "other".
- The readout states that G4 is not measurable under this slice, and prints the strict DESIGN numbers beside it.
- The 200-bot / 50-human validation runs before week 1.
- Fix #28 lands first.
- The beacon mounts from its own component, after F-13 merges.

### K45 trust-and-safety slice (3.93)

**Case.**
1. A hide that leaks. A new "hidden" state has to be honoured by every public read. Fix #4 shows that the existing
   `deleted_at` state is already missed in eight places: `app/t/[symbol]/opengraph-image.tsx:34`, `app/t/page.tsx:27`,
   `:64-67`, `app/t/compare/page.tsx:21-23`, `app/t/[symbol]/page.tsx:95-98`, `:117-119`, and `app/sitemap.ts:12-15`
   (that query has no user filter at all). A profile hidden for impersonation would still be counted, charted and
   listed on stock pages, the stock share image and the sitemap. The "tested and logged removal from rankings" covers
   only the feed's `elig` query (`lib/feed.ts:129`).
2. The digest page sits on missing auth. No admin identity exists on main (grep: no owner/admin check in `lib/`,
   `app/`). F-9 itself keeps its review-queue page behind a flag that stays off "until real admin identity exists; it
   never uses the dev-stub session" (`docs/features/F-9-thesis-safety.md:29-32`). An "owner-only digest page" either
   does the same (no value this cycle) or builds on the stub, which CLAUDE.md forbids.
3. Reusing F-9's reports carries F-9's auto-hold. F-9's reports are keyed by `sell_id`, and N distinct reporters
   auto-hold a thesis (F-9 doc:25-27). A profile report needs a new target key in F-9's table. If it inherits the
   N-reporter auto-hold, N fresh accounts can take down a real trader's whole record. That contradicts the
   "owner-run hide" in the brief.
4. "Hidden pending review" is shown on the public URL. It tells every visitor that the trader was reported. When the
   report is false, that harms an innocent trader.

**Cheapest test.**
- An e2e: hide a demo profile with the script, then fetch `/t/<SYM>`, `/t`, `/t/compare?…`, `/sitemap.xml` and
  `/t/<SYM>/opengraph-image`.
- Assert that the hidden trader's trades are not counted anywhere.
- On main today, the same e2e with `deleted_at` already fails (fix #4).

**Neutralising condition.**
- Fix #4 is built first, as one shared visible-user SQL predicate. K45 extends that predicate. A test fails on any
  `from closed_trades` read under `app/` or `lib/` that lacks it.
- Profile reports never auto-hide; only the owner script hides.
- The digest is a script, or a page behind F-9's off-by-default flag.
- The hidden-state wording is neutral and does not say "reported".

### K2 handle and name integrity (3.80)

**Case.**
1. A rename hold with no cap or rate limit hands out free squatting. `setHandle` (`app/auth/actions.ts:120-134`) has
   no rate limit. With a hold, every rename locks one more handle for up to a year. One account can loop
   rename A→B→C… and hold hundreds of handles, including look-alikes of real traders. That is the attack K2 is meant
   to stop.
2. Shared links break. No 301 is in scope, so the old `/u/<handle>` links and cards 404 for the length of the hold.
   K2 only swaps "lands on a stranger" for "lands on nothing".
3. Look-alike checks only partly apply. Handles are already limited to `[a-z0-9_]{3,20}` (`lib/referral.ts:2-6`),
   so the look-alike risk there is only 0/o, 1/l and underscores. The Unicode risk is all in display names, which
   are only trimmed (`lib/auth/attempts.ts:59`).
4. It has no near start date. Sign-up is gated closed (`lib/launch-gate.ts:40-41`), and the work waits for #42.

**Cheapest test.**
- A db test that renames one user 50 times in a loop and counts `handle_reservations` rows tied to that user. On
  the K2 design as written, the count is 49.

**Neutralising condition.**
- Rename rate limit: at most one rename per 30 days.
- At most one held handle per account (a new rename releases the older hold), and the holder can rename back.
- The old path shows a neutral "This handle is no longer in use" page, with no link to the new handle and no 200
  profile.
- Display-name rules use word boundaries, so names that merely contain "official" are not refused.
- The lapse rule applies if #42 has not merged.

### K7 one trust language (3.80)

**Case.**
1. The verbatim pin locks in a line that a fix on this cycle's list calls an F3a defect. D25's decided Stocks line
   is "Browse stocks that have verified closed trades." (`docs/IDEAS.md:141-142`). Fix #1 says the index lists demo
   symbols, so "verified" there over-reads on demo data (POLICY F3a, P2; `app/t/page.tsx:16-17`, `:77`).
2. D27's first-visit line, "Verified trades, straight from the broker." (`docs/IDEAS.md:148`), is challenged on the
   same ground (`docs/direction/creative-2026-11-01.md:1091`), and DSP-2 is pending at the idea board.
3. So the pin test fails as soon as fix #1 or an idea-board revision lands. The alternatives are worse: freeze an F3a
   problem, or open a "weaken a test" PR, which the loop's rule forbids.
4. What is left after fixes #1, #8 and #10 is mostly consistency. It waits for F-10..F-13 plus five fixes, so the
   approval may sit idle all cycle.

**Cheapest test.**
- Write the pin test and apply fix #1's wording to `app/t/page.tsx` in the same branch. The pin fails.
- Or grep: `rg -n "verified closed trades" app/t/page.tsx docs/IDEAS.md` shows the decided line and the fix target
  are the same string.

**Neutralising condition.**
- Pin only decided lines that no fix or pending idea-board item contests.
- For D25's Stocks line, the test asserts the wording is chosen by `demoOnly`/`mixed` (D25 for real-only data, "Demo"
  wording otherwise).
- The idea board rules on D25/D27 against F3a before the pin lands.
- The approval lapses to next cycle if F-10..F-13 have not merged by the next council.

### K8 plain labels, number format, tone (3.73)

**Case.**
1. It duplicates helpers that already exist. `pct()` lives in `lib/trades.ts:162`, `tone()` with Flat in
   `lib/open-split.ts:10`, `toneClass` in `app/open-rows.tsx:9`, and `lib/format.ts` already exists for counts.
   Adding new pct/tone helpers there before the sweep leaves two homes for the same rule. That is the drift K8
   exists to remove.
2. The property test proves nothing once fix #7 lands. Every printed range is then arithmetic and centred on the
   average (`lib/record-card.ts:207-216`), so lo ≤ avg ≤ hi holds by construction. The test only bites on surfaces
   that print their own range, and those are fix #7's list.
3. The DS-10 U+2212 sign has side effects:
   - It changes stored text in the append-only display log (`lib/display-log.ts:1-4`; `record-card.ts:201`, "the
     display log records exactly this text"), so history shows a false change on the switch day.
   - It breaks 32 hyphen-signed literals in 10 test/e2e files.
   - It may render as a missing glyph in share images, which use the default `sans-serif` font. The same font already
     lacks the check mark (`app/t/[symbol]/opengraph-image.tsx:41`). If the minus does not render, a loss reads as a
     gain.
4. Its What's-this line and glossary labels ("avg return / trade" at `app/pane.tsx:55`, `app/u/[handle]/page.tsx:245`)
   sit on the same stats-row lines K7 rewrites.

**Cheapest test.**
- Render one share image with `pct(-0.125)` using U+2212 and check that the glyph is present (pixel diff against a
  hyphen render).
- `rg -c "'[+-][0-9]+\.[0-9]%" --glob '*.test.ts' --glob 'e2e/*.ts'` counts the pins that would change.

**Neutralising condition.**
- Move `pct`/`tone` into `lib/format.ts` and re-export them from the old homes. No second implementation.
- The property test walks every surface's printing function, not `cardEvidence` alone.
- Either keep the ASCII hyphen in images and in the display log, or show the U+2212 glyph in a test first. The
  display log gets a dated note at the switch.
- The sweep and the What's-this line are sequenced after K7.

### K9 token foundation and contrast CI test (3.67)

**Case.**
1. The test it extends is not on main. `lib/a11y-contrast.test.ts` exists only on `origin/claude/f13-a11y-fixes`
   (366997d, not merged; 61 files). That branch also changes token values ("design system council values"). So
   "value-neutral" holds only after that branch, or this cycle's fixes #12, #13 and #26, merge.
2. If K9 lands before fix #26, its colour-blind gain-vs-loss floor fails at once. Light gain/loss is ΔE00 2.8 today
   (fixes row 26). The other way out is setting the floor below 2.8, which pins the defect.
3. "Fail on new colour literals" cannot cover share images. They use inline hex because next/og cannot read CSS
   variables (22 literals across four image files, e.g. `#22c55e` on `#0b0b0f` at
   `app/t/[symbol]/opengraph-image.tsx:48`). Either images are exempt and the most-shared surface gets no
   colour-blind check, or the build breaks.
4. GR scored it 1: no effect on links travelling.

**Cheapest test.**
- On main, run the colour-blind floor at the brief's threshold against today's light `--up`/`--down`. It fails
  (ΔE00 2.8).
- `git grep -c -E "#[0-9a-fA-F]{6}" -- 'app/**/opengraph-image.tsx'` shows the literals the ban must exempt or move.

**Neutralising condition.**
- K9 starts only after fixes #12, #13 and #26 and the contrast-test branch have merged.
- Image colours move into one exported constant table that the contrast and colour-blind tests read, instead of
  being exempt from the literal ban.
- K9 lands before K7 in the shared slot, so K7's Demo restyle has to pass it.

### Slots and sequencing

- **K7 + K9 (globals.css): one slot, sequenced K9 → K7.**
  - K9 first pins the tokens. K7's `--demo`/Verified restyle then has to pass them.
  - In the other order, K9 re-pins whatever K7 chose, with no check.
  - Both wait: K9 for fixes #12/#13/#26 and the contrast-test branch; K7 for F-10..F-13 and fixes #1, #2, #8, #9, #10.
- **K8 collides with K7.**
  - K8's sweep and glossary labels edit the same stats-row lines (`app/u/[handle]/page.tsx:245`,
    `app/pane.tsx:55`, `app/ui.tsx:41`, `:55`), plus `lib/copy.ts`, where K7 moves the badge and rewrites the
    trust wording.
  - Under the slot rule ("features touching the same files count as one slot"), the K8 sweep belongs in the K7/K9
    lane, sequenced K9 → K7 → K8 sweep.
  - K8's first slice (`lib/format.ts` consolidation and the property test, `lib/` only) can start now as its own
    slot.
  - If voters keep K8 as a separate slot, attach "sweep and What's-this line after K7 merges".
- **K45 collides with F-9, fix #4 and fix #27. It does not collide with K2.**
  - K45 strictly follows F-9: it shares the reports table, keyed by `sell_id`, and `app/actions.ts`, which fix #27
    and #42 also edit.
  - It must follow fix #4, which builds the shared visible-user predicate.
  - It shares no file with K2 except `app/u/[handle]/page.tsx` (K45: report link and impersonation line; K2:
    rejection text by the handle form at `:225`), and both edits are small. Keep separate slots.
  - Do not merge K45 and K2: they wait on different things (F-9 and #42). K18 rides inside K45.
- **K3 collides with fix #28 and F-13.**
  - Fix #28 must land first: same `lib/referral.ts:12` list.
  - The beacon mount must avoid `app/layout.tsx` until F-13 merges.
  - The share_action half stays after F-4/F-13 as the chair set.
- **Arithmetic.**
  - K3, K45 (+K18), K2, K7+K9+K8-sweep, and the K8 first slice make 5 slots, with 1 left.
  - Keeping the K8 sweep as its own slot also makes 5.
- **Idle-slot risk.**
  - Only K3 and the K8 first slice can start today.
  - K2 waits for #42. K45 waits for F-9. K7 waits for four features and five fixes. K9 waits for an unmerged branch
    and three fixes.
  - Attach to each waiting approval: "lapses to the next council if its prerequisite has not merged by then".


### Round 5: final-vote ballots

#### Round 5: Business lead
| Candidate | Vote | Conditions / reason |
|---|---|---|
| K3 | AC | The only candidate that reads the week-8 gates (docs/DESIGN.md §3.5). Conditions: (1) per-profile rollup rows key on user_id references users on delete cascade, never handle text; a db test deletes a profile and renames A to B then reissues A, and asserts no old count shows under either. (2) The readout prints no path x via x day cell below k = 5; small via classes roll into "other"; a unit test checks it. (3) The readout prints the four DESIGN §3.5 thresholds verbatim and marks G4 (viewer D7 return) "not measurable under this slice"; G2 shows "after share_action slice". (4) A bot-filter validation (200 scripted bot loads, 50 human loads) runs before week 1 and its result is in the PR. (5) Fix #28 merges first (same list at lib/referral.ts:12). (6) The beacon mounts from its own component and does not edit app/layout.tsx until F-13 merges. |
| K45 | AC | Launch homework that protects trust in shared records; moves no gate. Conditions: (1) Starts after F-9 and fix #4; it extends fix #4's shared visible-user predicate, and a test fails on any closed_trades read under app/ or lib/ without it. (2) An e2e hides a demo profile and asserts its trades are absent from the feed, /t, /t/<SYM>, /t/compare, the stock share image and /sitemap.xml. (3) Profile reports never auto-hide; only the owner script hides, and each hide is logged. (4) The digest is a script, or a page behind F-9's off-by-default flag; nothing reads the dev-stub session. (5) Public wording is neutral and never says "reported". (6) K18 rides inside as conditions. (7) Lapses to next council if F-9 has not merged. |
| K2 | AC | Cheap guard on the core asset (linkable records are scam bait). No effect before #42. Conditions: (1) At most one rename per 30 days; a db test renames 50 times and sees the second refused. (2) At most one held handle per account; a new rename releases the older hold; the holder can rename back. (3) The old path returns a neutral "This handle is no longer in use" page, not a 200 profile and no link to the new handle. (4) Display-name rules match on word boundaries. (5) Lapses to next council if #42 has not merged. |
| K7 | R | About zero effect on the gates. The false parts are already fixes #1, #8 and #10. The verbatim pin would freeze D25's "verified closed trades" line that fix #1 calls an F3a defect (app/t/page.tsx). It waits on F-10..F-13 and five fixes, so the slot would sit idle all cycle. Bring back next cycle after the idea board rules on D25/D27. |
| K8 | AC | Strongest viewer-side evidence and the T10 precondition for D23. Conditions: (1) pct and tone move into lib/format.ts and the old homes (lib/trades.ts, lib/open-split.ts, app/open-rows.tsx) re-export them; a test asserts one implementation. (2) The lo <= avg <= hi property test walks every surface's printing function, not only cardEvidence. (3) Images and the display log keep the ASCII hyphen unless a test first shows U+2212 renders in the share image font; any switch gets a dated display-log note. (4) The 16-file sweep and the What's-this line run only after F-10..F-12 and K7-area fixes merge. |
| K9 | AC | No demand effect, so it must cost no slot of its own. Conditions: (1) Starts only after fixes #12, #13, #26 and the F-13 contrast-test branch merge; lapses to next council otherwise. (2) The gain-vs-loss colour-blind floor is set at the brief's threshold, not lowered to pass today's light tokens. (3) Share-image colours move into one exported constant table that the contrast and colour-blind tests read; no exemption. (4) Shares a slot with the fixes lane on app/globals.css, not one of the six. |

#### Round 5: Market research lead
| Candidate | Vote | Conditions / reason |
|---|---|---|
| K3 | AC | The only item that makes G2 and G3 readable (DESIGN §3.5 at docs/DESIGN.md:246-252; market cycle 2 §8 row 1, Prerequisite). RT point 1 is half right: G4's primary cohort is signed-in viewers (market §3 line 248), read from server rows, so no viewer cookie is needed; the signed-out cohort stays excluded. Conditions: (1) per-profile rollup rows keyed by user_id references users on delete cascade, never by handle text; a db test deletes a profile and renames A to B then reissues A, and asserts no old count shows under the new holder. (2) The readout suppresses any path x via x day cell below 5 or rolls it into "other"; a unit test asserts no printed cell is below 5. (3) Validation before week 1: at least 95% of 200 scripted preview fetches dropped and at least 95% of 50 human visits counted; result recorded before any gate is read. (4) The readout prints the strict DESIGN §3.5 numbers, states that signed-out D7 is not measured in this slice, and labels G3 a count of views not people. (5) Fix #28 lands first; the beacon mounts from its own component and does not edit app/layout.tsx until F-13 merges. (6) A test fails if any rollup or beacon table stores IP, user agent, viewer id, session id or a cookie value. |
| K45 | AC | Market §2 row 17 rates a profile report with an impersonation category as required (POLICY U2/U3); real linkable records are scam bait (FC-R28). Conditions: (1) Fix #4 merges first as one shared visible-user predicate; K45 extends it with the hidden state; a test fails on any closed_trades read under app/ or lib/ without it, and an e2e hides a demo profile and checks /t, /t/<SYM>, /t/compare, its share image and /sitemap.xml. (2) Profile reports never auto-hide; only the owner script hides, writing an audit row. (3) The digest is a script or a page behind F-9's off-by-default flag; it never uses the dev-stub session. (4) A hidden profile shows neutral wording that does not say "reported". (5) Starts after F-9 merges; lapses to the next council if F-9 has not merged by then. K18 rides inside it. |
| K2 | AC | U2 launch prerequisite and the same scam-bait evidence (FC-R28); small and in its own file. RT's squatting case is real and cheap to close. Conditions: (1) At most one rename per 30 days per account. (2) At most one held handle per account; a new rename releases the older hold; the holder can rename back. A db test renames one user 50 times and asserts at most one hold row. (3) The old path returns a neutral "This handle is no longer in use" page with no link to the new handle. (4) Display-name word rules match whole words only; a test accepts a name that merely contains "official" inside a longer word. (5) Starts after #42 merges; lapses to the next council if it has not. |
| K7 | AC | Removes the identity misread of Verified (POLICY F3a); gate effect near 0 (market §2 row 20), but it is the honest reading the T10 test assumes. Conditions: (1) The pin test covers only decided lines that no fix row or pending idea-board item contests; D25's Stocks line is asserted as chosen by demoOnly/mixed (D25 wording for real-only data, Demo wording otherwise). (2) Sequenced in the shared globals.css slot after K9. (3) Starts after F-10..F-13 and fixes #1, #2, #8, #9, #10 merge; lapses to the next council if they have not. |
| K8 | AC | Strongest viewer-side evidence we hold: about a third of US adults at the lowest numeracy level (FC-R19) and the interval-of-the-average misread (FC-R18); the "range is for the average" line is the precondition for T10 and for D23 (market §8 rows 4 and 9). Conditions: (1) pct and tone move into lib/format.ts and are re-exported from lib/trades.ts and lib/open-split.ts; a test asserts one implementation (the old names are the same function). (2) The lo ≤ avg ≤ hi property test walks every surface's printing function, not cardEvidence alone. (3) Share images and the display log keep the ASCII hyphen unless a test first shows the U+2212 glyph renders in the image font; any switch adds a dated note to the display log. (4) The first slice (lib/ helpers, property test, What's-this line) may start now; the call-site sweep runs after F-10..F-12 and after K7 merge. |
| K9 | AC | A1 hygiene with no gate effect (market §2 row 25) but a lasting regression guard; acceptable because it shares K7's slot. Conditions: (1) Starts only after fixes #12, #13, #26 and the contrast-test branch merge, so the colour-blind gain-vs-loss floor is set at the brief's threshold, never lowered to today's ΔE00 2.8. (2) Share-image colours move into one exported constant table that the contrast and colour-blind tests read; images are not exempt. (3) Lands before K7 in the shared slot. (4) Lapses to the next council if its prerequisites have not merged. |

#### Round 5: Pricing and finance

Lens: spend per feature against what it buys. Basis: docs/direction/business-2026-11-01.md (fixed cost about $145/month; about $192 agent spend per merged feature; revenue $0 until the week-8 gates). I hold no veto. Main cost risk this cycle is an approved slot that sits idle or is built twice, so every waiting item gets a lapse rule and an order.

| Candidate | Vote | Conditions / reason |
|---|---|---|
| K3 | AC | Best buy: the week-8 gates and the viewers-per-trader input cannot be read without it. Conditions: (1) per-profile rollup rows key on user_id references users on delete cascade, never handle text; a db test deletes a profile and renames A to B then reissues A, and finds no old counts. (2) Readout suppresses any path x via x day cell under 5 (unit test). (3) Readout states G4 is not measurable under this slice and prints the strict DESIGN 3.5 numbers beside every figure. (4) Bot filter checked against 200 scripted and 50 human visits before week 1, result recorded. (5) Fix #28 merges first; beacon mounts from its own component, not app/layout.tsx, until F-13 merges. (6) One upsert per beacon at most, no new paid service (test counts writes). |
| K45 | AC | A launch cost owed anyway (U2, U3), cheapest when it reuses F-9. Conditions: (1) Fix #4 lands first as one shared visible-user predicate; K45 extends it; a test fails on any closed_trades read under app/ or lib/ without it; the RT e2e (/t, /t/SYM, /t/compare, sitemap, stock image) passes for a hidden profile. (2) Profile reports never auto-hide; only the owner script hides. (3) Digest is a script or a page behind F-9's off-by-default flag; no email and no new vendor. (4) Hidden-state text is neutral and never says reported. (5) Lapses to the next council if F-9 has not merged by then. |
| K2 | AC | S-M, owed before real users, cheapest right after #42. Conditions: (1) At most one rename per 30 days. (2) At most one held handle per account; a new rename releases the older hold; the holder can rename back; a 50-rename loop test leaves at most one hold. (3) Old path shows a neutral no-longer-in-use page with no link to the new handle and no 200 profile. (4) Display-name word rules use word boundaries (test that a name merely containing official passes). (5) Lapses to the next council if #42 has not merged by then. |
| K7 | AC | One wording is needed before T10 can be read, and starting after F-10..F-13 avoids paying twice. Conditions: (1) The pin test covers only decided lines no fix or pending idea-board item contests; the Stocks index line is chosen by demoOnly or mixed (test for both). (2) Starts after F-10..F-13 and fixes #1, #2, #8, #9, #10 merge, and after K9 in the shared globals.css slot. (3) Lapses to the next council if those prerequisites have not merged by then. |
| K8 | AC | Only the lib/ first slice is good value now; the sweep is rework risk until K7 lands. Conditions: (1) pct and tone move into lib/format.ts and the old homes re-export them; a test fails if a second implementation exists. (2) The lo <= avg <= hi property test walks every surface's printing function, not cardEvidence alone. (3) Share images and the display log keep the ASCII hyphen unless a render test shows the U+2212 glyph; the display log gets a dated note on any switch. (4) The 16-file sweep and the What's-this line run in the K9 then K7 lane, after K7 merges. |
| K9 | AC | Near-zero slot cost and stops a third paid round of contrast fixes. Conditions: (1) Starts only after fixes #12, #13, #26 and the F-13 contrast-test branch merge; the colour-blind gain-vs-loss floor is not set below today's failing 2.8. (2) Share-image colours move into one exported constant table that the contrast and colour-blind tests read, instead of being exempt. (3) Lands before K7 in the shared slot. (4) Lapses to the next council if its prerequisites have not merged by then. |

Slots: K3, K45, K2, K9 then K7 then K8 sweep (one globals.css/stats-row lane), K8 first slice. Five slots, roughly $500-700 agent spend in all. The money risk is idle or doubled work, which the lapse and order conditions cover.

#### Round 5: Growth
| Candidate | Vote | Conditions / reason |
|---|---|---|
| K3 | AC | Still the only way to see whether records travel (app/share-button.tsx shares a bare path today). Conditions: (1) per-profile rows keyed by user_id references users on delete cascade, never by handle text; a db test deletes a profile and renames A to B then reissues A, and asserts no old counts remain or attach to the new holder. (2) The readout is owner-only; no view count is shown to traders or used in feed ranking, and no score, streak or badge is built on it (F6); a test asserts no app/ page or lib/feed.ts reads the rollup. (3) Any readout cell under k=5 is suppressed or rolled into other; unit test. (4) The readout states G4 is not measurable under this slice. (5) Fix #28 lands first; the beacon mounts from its own component and does not edit app/layout.tsx until F-13 merges. (6) The bot filter is validated before week 1. |
| K45 | AC | A shared link must be safe to land on. Conditions: (1) builds after F-9 and fix #4; hiding extends fix #4's shared visible-user predicate, and an e2e shows a hidden demo profile absent from feed, /t, /t/compare, /t/SYM, its share image and sitemap.xml. (2) Profile reports never auto-hide; only the owner script hides, and each hide is logged. (3) Per-reporter rate limit, tested. (4) The public hidden page uses neutral wording that does not say reported, and the hidden profile and its card do not unfurl figures. (5) The digest is a script or sits behind F-9's off-by-default flag; it never uses the dev-stub session. (6) Lapses to the next council if F-9 has not merged. |
| K2 | AC | Durable links matter: a rename frees the old handle at once (lib/auth/attempts.ts:102-110), so a forwarded card can land on a stranger. Conditions: (1) at most one rename per 30 days; (2) at most one held handle per account, a new rename releases the older hold, and the holder can rename back; a db test renaming 50 times finds at most one hold. (3) The old path returns a neutral no-longer-in-use page, no 200 profile and no link to the new handle. (4) Display-name rules match on word boundaries. (5) Lapses to the next council if #42 has not merged. |
| K7 | AC | One Verified word linked to /how helps a forwarded card read as credible, but no wording may over-read on demo data. Conditions: (1) pin only decided lines that no fix or pending idea-board item contests; D25's Stocks line is chosen by demoOnly or mixed and the test asserts that switch. (2) Starts after F-10..F-13 and fixes #1, #2, #8, #9, #10; shares the globals.css slot after K9. (3) Lapses to the next council if those have not merged. |
| K8 | AC | Numbers on cards that read right at a glance help a forwarded record. Conditions: (1) pct and tone move into lib/format.ts and are re-exported from the old homes; no second implementation. (2) The property test walks every surface's printing function, not one. (3) Share images and the display log keep the ASCII hyphen unless a test first shows the U+2212 glyph renders in the image font; any switch gets a dated display-log note. (4) The sweep and What's-this line run after K7 merges. |
| K9 | AC | No effect on links travelling, but cheap hygiene and it shares K7's slot, so it costs no slot. Conditions: (1) starts only after fixes #12, #13, #26 and the contrast-test branch merge; (2) share-image colours move into one exported constant table that the contrast and colour-blind tests read, so the most-shared surface is checked, not exempted; (3) lands before K7 in the shared slot. |

#### Round 5: UX lead
| Candidate | Vote | Conditions / reason |
|---|---|---|
| K3 | AC | It is the only way to learn whether first-time viewers open What's-this or follow a shared link. RT's case is right that counts must not leak who viewed. Conditions: (1) per-profile rollup rows key on user_id references users on delete cascade, never handle text; a db test deletes a profile and finds no row naming it, and a rename A to B plus a new user A shows none of the old counts under the new A. (2) The readout prints no cell under k = 5 for any path x via x day; smaller cells roll into "other"; a unit test checks it. (3) The readout states G4 (viewer D7 return) is not measurable under this slice and prints the strict DESIGN 3.5 numbers beside its own. (4) The beacon never blocks render; an e2e with the beacon endpoint failing still shows the page. (5) The copy-link confirmation is announced to screen readers (aria-live), tested. (6) Fix #28 lands first; the beacon mounts from its own component after F-13 merges, not by editing app/layout.tsx before then. (7) The share_action half waits for F-4/F-13. |
| K45 | AC | A labelled report form is a trust cue a first-time viewer expects. RT changed my mind on one point: a public "Hidden pending review" tells every visitor the trader was reported, which harms an innocent trader on a false report. Conditions: (1) Fix #4 builds one shared visible-user predicate first; the hide extends it; a test fails on any closed_trades read under app/ or lib/ without it; an e2e hides a demo profile and finds its trades on none of the feed, /t, /t/<SYM>, /t/compare, /sitemap.xml or the stock share image. (2) The hidden page uses neutral wording that does not say "reported" or "review" (for example "This record is not available right now"), returns noindex, and has its own page title. (3) Profile reports never auto-hide; only the owner script hides, and it writes an audit row; a test with N distinct reporters shows the profile still public. (4) The report form has a visible label per field, errors and "sent" are announced, and one reporter is rate limited (test). (5) The digest is a script or sits behind F-9's off-by-default flag, never the dev-stub session. (6) Starts after F-9 merges; lapses to the next council if F-9 has not merged by then. K18 rides inside it. |
| K2 | AC | Refusing "Verified", check glyphs and bidi tricks in display names stops a name from faking the badge. It still needs my standing condition and RT's anti-squatting fix. Conditions: (1) Each rejection names its rule in plain words next to the field, linked by aria-describedby and announced (test per rule). (2) At most one rename per 30 days and at most one held handle per account; a db test renaming 50 times finds at most one hold; the holder can rename back. (3) The old path shows a neutral "This handle is no longer in use" page with no link to the new handle and no profile content. (4) Display-name rules match whole words, so a name merely containing "official" passes (test). (5) Starts after #42; lapses to the next council if #42 has not merged. |
| K7 | AC | Still the most direct trust fix: Verified must read one way, linked to its definition, on every surface. RT showed the verbatim pin would freeze a contested line. Conditions: (1) The pin test covers only decided lines that no fix row or pending idea-board item contests. (2) D25's Stocks line is chosen by demoOnly or mixed: the decided line for real-only data, Demo wording otherwise; a test checks both branches. (3) Every Verified label on page, pane and share card uses one string from lib/copy.ts and links to the same definition (test greps for other spellings). (4) It runs after K9 in the shared slot and its Demo restyle passes K9's tests. (5) Starts after F-10..F-13 and fixes #1, #2, #8, #9, #10; lapses to the next council if they have not merged. |
| K8 | AC | Lay readers take a range of the average as the spread of single trades, so the "range is for the average, not one trade" line stays the core. RT's minus-sign case is a real trust bug: if the glyph does not render, a loss reads as a gain. Conditions: (1) pct and tone move into lib/format.ts and the old homes (lib/trades.ts, lib/open-split.ts, app/open-rows.tsx) re-export them; a test fails on a second implementation. (2) The property test walks every surface's printing function, not cardEvidence alone. (3) Share images and the display log keep the ASCII hyphen unless a render test shows the U+2212 glyph is drawn; if the switch happens, the display log gets a dated note. (4) Gain and loss are never shown by colour alone: every signed number keeps its sign character (test). (5) Pinned tests are updated, never deleted; the test count does not drop. (6) The sweep and the What's-this line run after K7 merges; the lib/-only first slice can start now. |
| K9 | AC | Pins gain-vs-loss legibility for colour-blind viewers, the one encoding every first-time viewer relies on. Conditions: (1) Starts only after fixes #12, #13 and #26 and the F-13 contrast-test branch have merged, so the floor does not pin today's ΔE00 2.8 defect. (2) Share-image colours move into one exported constant table that the contrast and colour-blind tests read; images are not exempt. (3) It lands before K7 in the shared slot. (4) Changes no token values beyond the fixes list; a test fails on new colour literals outside the token file and the image table. (5) Lapses to the next council if its prerequisites have not merged. |

#### Round 5: Product designer
| Candidate | Vote | Conditions / reason |
|---|---|---|
| K3 | AC | (1) Per-profile rollup rows key on user_id references users on delete cascade, never on handle text; a db test deletes a profile and renames A to B then reissues A, and finds no old counts under either. (2) Readout suppresses any path x via x day cell below 5 (or folds it into "other"). (3) Readout says G4 is not measurable in this slice and prints the DESIGN 3.5 numbers beside each gate. (4) Share stays one tap: ?via= is appended silently and the copy confirmation is announced to screen readers. (5) Fix #28 lands first; beacon mounts from its own component, not app/layout.tsx, until F-13 merges. Lapses to next council if not started. |
| K45 | AC | (1) Starts after fix #4; hidden state extends the one shared visible-user predicate, and a test fails on any closed_trades read under app/ or lib/ without it (covers /t, /t/compare, /t/[symbol] and its image, sitemap). (2) Profile reports never auto-hide; only the owner script hides, logged. (3) Public wording is neutral ("This profile is not available right now"), never names a report; one state, never a partial record. (4) Digest is a script or sits behind F-9's off-by-default flag; no stub-session admin page. (5) Same report entry pattern and labels as F-9's thesis report, with labelled form and announced errors and "sent". K18 rides inside. Lapses if F-9 has not merged by next council. |
| K2 | AC | (1) At most one rename per 30 days and at most one held handle per account; a new rename releases the older hold and the holder can rename back; db test of 50 renames finds at most 1 hold. (2) Old path shows a neutral "This handle is no longer in use" page with its own title, no 200 profile and no link to the new handle. (3) One rejection message pattern tied to the field (aria-describedby), the same on sign-up and rename. (4) Display-name rules match whole words only. (5) Lapses to next council if #42 has not merged. |
| K7 | AC | (1) One TRUST_LOOK table is the only source of Verified and Demo label, icon and colour; a test fails on any other Verified or Demo spelling in app/ or lib/. (2) Pin only decided lines that no fix or pending idea-board item contests; the Stocks index line is chosen by demoOnly/mixed (D25 wording only for real-only data, Demo wording otherwise), and D27 waits for the idea board's F3a ruling. (3) Sequenced after K9 in the globals.css slot, so the Demo/Verified restyle passes K9's tests. (4) Starts after F-10..F-13 and fixes #1, #2, #8, #9, #10; lapses to next council if they have not merged. |
| K8 | AC | (1) Move pct/tone (with Flat) into lib/format.ts and re-export from lib/trades.ts, lib/open-split.ts and app/open-rows.tsx; a test fails on a second implementation. (2) Property test walks every surface's printing function, not cardEvidence alone. (3) Keep the ASCII hyphen in share images and the display log unless a test first shows the U+2212 glyph renders in next/og; if switched, the display log gets a dated note. (4) The What's-this line and the 16-file sweep run in the K7 lane, after K7 merges; the lib/ first slice may start now. |
| K9 | AC | (1) Starts only after fixes #12, #13, #26 and the contrast-test branch merge; colour-blind gain-vs-loss floor is not lowered to pass today's 2.8. (2) Share-image colours move into one exported constant table that the contrast and colour-blind tests read, not exempt from the literal ban. (3) Lands before K7 in the shared globals.css slot. (4) No visible value change beyond the fixes list. Lapses to next council if prerequisites have not merged. |

#### Round 5: Data-visualization designer
| Candidate | Vote | Conditions / reason |
|---|---|---|
| K3 | AC | Counts are the only way to read whether the range and "What's this?" line are understood. RT's case holds on my lens too: a count of 1 is not anonymous, and an undeduped count can move a gate. Conditions: (1) per-profile rollup rows key on user_id references users on delete cascade, never handle text; a db test deletes a profile, then renames A to B and reissues A, and asserts no old count shows under the new holder. (2) The readout suppresses any path x via x day cell under k = 5 (or folds it into "other"); a unit test asserts no printed cell is below 5. (3) The readout prints the strict DESIGN §3.5 number beside each gate and states G4 (viewer D7 return) is not measurable under this slice. (4) The bot-filter validation runs before week 1 and its false-count rate is printed with G3. (5) Fix #28 merges first; the beacon mounts from its own component, not app/layout.tsx, until F-13 merges. |
| K45 | AC | No figures, but a hide changes the lower-bound ranking, so it must be visible and complete. Conditions: (1) fix #4 lands first as one shared visible-user SQL predicate, and K45 extends it; a test fails on any from closed_trades read under app/ or lib/ without it. (2) An e2e hides a demo profile and asserts its trades are not counted on /, /t, /t/<SYM>, /t/compare, /t/<SYM>/opengraph-image and /sitemap.xml. (3) Profile reports never auto-hide; only the owner script hides, and it writes an audit row. (4) The hidden URL wording is neutral (no "reported"), e.g. "This profile is not shown right now." (5) The digest is a script or sits behind F-9's off-by-default flag, never the dev-stub session. (6) Whole profile or thesis only, never one trade (TR-1). |
| K2 | AC | No chart effect; keeping check glyphs and "Verified" out of display names keeps unearned trust off a record's numbers. Conditions: (1) at most one rename per 30 days, tested. (2) At most one held handle per account; a db test of 50 renames finds at most 1 hold for that user, and the holder can rename back. (3) The old path returns a neutral "This handle is no longer in use" page, no 200 profile, no link to the new handle. (4) "Verified"/"Official" refusal uses word boundaries; a test accepts a name that only contains those letters inside another word. (5) Lapses to the next council if #42 has not merged by then. |
| K7 | AC | One Verified meaning on the stats row is what lets a viewer read the headline figures with their source. RT is right that pinning a contested line freezes an F3a problem. Conditions: (1) pin only decided lines no fix or pending idea-board item contests. (2) The Stocks index line is chosen by demoOnly/mixed, with D25's line only for real-only data, and a test covers all three states. (3) D27's first-visit line is not pinned until the idea board rules on DSP-2. (4) Starts after K9 in the shared globals.css slot, so the Demo/Verified restyle must pass K9's contrast and colour-blind tests. (5) Lapses to the next council if F-10..F-13 have not merged by then. |
| K8 | AC | The honest-number guard: one sign, one Flat for 0.0%, and no printed range that excludes its own average (TR-9). RT's points are real and fixable. Conditions: (1) pct() and tone() move into lib/format.ts and lib/trades.ts, lib/open-split.ts and app/open-rows.tsx re-export them; a test fails if a second implementation exists. (2) The lo <= avg <= hi property test walks every surface's printing function (profile, pane, card, trade, month, stock, image), not cardEvidence alone. (3) U+2212 appears in an image only after a test renders pct(-0.125) in each share image and shows the glyph is drawn (pixel diff against an empty-box render); until then images keep the ASCII hyphen so a loss never reads as a gain. (4) The display log keeps its stored text format or gets a dated note at the switch, so history shows no false change. (5) Pinned tests are updated, never deleted, and the test count does not drop. (6) The sweep and the "What's this?" line land after K7 merges; the lib/format.ts slice can start now. |
| K9 | AC | Pins the measured encoding failures for good: light gain/loss ΔE00 2.8 under deutan (fix #26) and Verified 3.77:1 (fix #12). Conditions: (1) starts after fixes #12, #13 and #26 and the F-13 contrast-test branch merge, so the floor is set at the brief's threshold and passes on main, never lowered to 2.8. (2) Share-image colours move into one exported constant table that the contrast and colour-blind tests read; images are not exempt from the floor and not from the literal ban. (3) Lands before K7 in the shared slot. (4) Value-neutral beyond the fixes list; lib/badge-contrast.test.ts stays. (5) Lapses to the next council if its prerequisites have not merged by then. |

#### Round 5: Accessibility specialist
| Candidate | Vote | Conditions / reason |
|---|---|---|
| K3 | AC | (1) The "Link copied" confirmation stays in a polite live region (app/share-button.tsx:62 today), and an e2e asserts it after the `?via=` change. (2) The beacon adds no focusable element, no visible UI and no layout shift, and never delays first paint (test: page renders and is usable with the beacon endpoint failing). (3) RT's conditions: rollup rows keyed by user_id with on delete cascade, never handle text; readout suppresses cells under k = 5; fix #28 lands first; beacon mounts from its own component after F-13 merges. |
| K45 | AC | (1) Report form: every control has a visible label, errors use role=alert and name the field, "sent" is announced in a role=status region, and focus moves to the error or the status (axe e2e plus a keyboard-only e2e). (2) The hidden-profile page and the digest page each have their own title (2.4.2) and one h1. (3) Hidden-state wording is neutral plain text and does not say "reported". (4) RT's conditions: fix #4's shared visible-user predicate first, with a test that fails on any closed_trades read without it; profile reports never auto-hide; digest is a script or behind F-9's off-by-default flag. |
| K2 | AC | (1) Each rejection names its rule in text next to the field, tied with aria-describedby and aria-invalid, and is announced on submit (3.3.1, 3.3.3); an e2e checks one reserved-handle and one bidi rejection. (2) The old-handle page is a neutral "This handle is no longer in use" page with its own title and no link to the new handle. (3) RT's conditions: at most one rename per 30 days; at most one held handle per account; word-boundary rules for display names. (4) Lapses to next council if #42 has not merged. |
| K7 | AC | (1) The Verified and Demo meaning is reachable without hover: a link or visible text, not only the title tooltip at app/ui.tsx:9-10 (1.3.1, 1.4.13); keyboard e2e reaches it. (2) Badges keep a text label, never colour or the check glyph alone (1.4.1). (3) Pin only decided lines no fix or pending idea-board item contests; D25's Stocks line is chosen by demoOnly/mixed (RT). (4) Same slot as K9, sequenced K9 first, so the restyled badge passes the contrast test. Lapses if F-10..F-13 have not merged by next council. |
| K8 | AC | (1) pct and tone move into lib/format.ts and are re-exported from old homes; no second copy. (2) Signs are never conveyed by colour alone: Flat and gain/loss carry text. (3) U+2212 is used in HTML only after a test shows the glyph renders in share images; otherwise images and the display log keep the ASCII hyphen, and the display log gets a dated note at any switch. (4) Sweep and the What's-this line run after K7 merges. Access gain is small this cycle, but no harm. |
| K9 | AC | (1) Extends lib/a11y-contrast.test.ts and keeps lib/badge-contrast.test.ts; test count never drops. (2) Covers every text and UI token pair in both schemes at 4.5:1 text, 3:1 large text, UI parts and focus ring (1.4.3, 1.4.11). (3) Starts only after the contrast-test branch and fixes #12, #13 and #26 merge, so the colour-blind gain-vs-loss floor is not set below today's defect. (4) Share-image colours move into one exported constant table that the contrast and colour-blind tests read, not an exemption. (5) Lands before K7 in the shared slot. |

#### Round 5: Engineer
Base note: origin/main is now eb83430 (#40 corporate actions and #48 design system docs merged). `pct` moved to lib/trades.ts:306. lib/reports.ts and lib/a11y-contrast.test.ts are still not on main.

| Candidate | Vote | Conditions / reason |
|---|---|---|
| K3 | AC | (1) Per-profile rollup rows key on user_id references users on delete cascade, never handle text. A db test calls deleteProfile and asserts zero rows remain for that user. A rename test asserts old counts never show under a new holder of the handle. (2) The readout suppresses any path x via x day cell below k=5. A unit test checks this. (3) A test fails if any rollup or beacon column stores an IP, user agent, cookie, session or viewer id. (4) Upsert is idempotent per key and the beacon is fire-and-forget. A test shows the page renders when the beacon route returns 500. (5) Fix #28 merges first (same list at lib/referral.ts:12). (6) The beacon mounts from its own component and does not edit app/layout.tsx until F-13 merges. (7) The readout says G4 is not measurable in this slice. (8) share_action half waits for F-4 and F-13. |
| K45 | AC | (1) Starts after F-9 (lib/reports.ts) and fix #4 merge. (2) Fix #4 builds one shared visible-user SQL predicate. K45 adds hidden to it. A test fails on any closed_trades read under app/ or lib/ that skips the predicate. The e2e hides a demo profile and checks /t, /t/SYM, /t/compare, /sitemap.xml and the stock share image. (3) Profile reports never auto-hide. Only the owner script hides. A test files N reports and asserts the profile stays visible. (4) Per-reporter rate limit, tested. (5) The digest is a script, or a page behind F-9's off-by-default flag. It never uses the dev-stub session. (6) Public hidden wording is neutral and never says reported. (7) Lapses to the next council if F-9 has not merged by then. |
| K2 | AC | (1) At most one rename per 30 days, enforced in setHandle (app/auth/actions.ts) and tested. (2) At most one held handle per account. A db test renames one user 50 times and asserts at most one hold row for that user. The holder can rename back. (3) The old path shows a neutral no-longer-in-use page with no link to the new handle. (4) Display-name checks use word boundaries. A test shows a name that only contains a reserved word as a substring is accepted. (5) Lapses if #42 has not merged by the next council. |
| K7 | AC | (1) Pin only decided lines no fix or pending idea-board item contests. The D25 Stocks line is chosen by demoOnly/mixed, and the test asserts both branches. (2) D25/D27 wording is settled by the idea board against F3a before the pin lands. (3) Starts after F-10..F-13 and fixes #1, #2, #8, #9, #10 merge. (4) Shares one slot with K9, sequenced K9 then K7. (5) Lapses to the next council if F-10..F-13 have not merged by then. It is M across about 11 shared files, so rebase risk stays real. |
| K8 | AC | (1) pct, winPct and tone move into lib/format.ts. The old homes (lib/trades.ts:306, lib/open-split.ts, app/open-rows.tsx) re-export them. A grep test fails on a second implementation. (2) The property test walks every surface's printing function, not cardEvidence alone. (3) Keep the ASCII hyphen in share images and the display log unless a test first shows the U+2212 glyph renders in next/og. If switched, the display log gets a dated note. No existing test pin is deleted; changed pins are updated in the same PR. (4) The first slice is lib/ only and takes its own slot now. The sweep and What's-this line run after K7 merges, in the K7/K9 lane. |
| K9 | AC | (1) Starts only after the contrast-test branch (claude/f13-a11y-fixes) and fixes #12, #13, #26 merge. (2) The gain-vs-loss colour-blind floor is set at the brief's threshold, not below today's 2.8. (3) Share-image colours move into one exported constant table that the contrast and colour-blind tests read. No image file keeps inline hex. (4) Lands before K7 in the shared globals.css slot. (5) Test count never drops; lib/badge-contrast.test.ts stays. (6) Lapses to the next council if the contrast-test branch has not merged by then. |

Slots (EN view): K3; K45 (+K18); K2; K9 then K7 then K8 sweep (globals.css lane); K8 first slice (lib/ only). Five slots. Only K3 and the K8 first slice can start today.

#### Round 5: Reliability engineer
| Candidate | Vote | Conditions / reason |
|---|---|---|
| K3 | AC | Safe to run as reshaped, but RT's retention gap is real: lib/privacy-retention.test.ts:28-35 only checks tables with a user_id/viewer_id/trader_id column, so a rollup keyed by handle text escapes it. Conditions: (1) per-profile rollup rows carry user_id references users on delete cascade, never handle text; a db test calls deleteProfile and finds no row for that user, and a test renames A to B, creates a new user A, and finds none of the old counts under the new A. (2) Upsert on conflict per (day, path or user_id, via) key; a test fires 50 concurrent beacons for one key and gets one row with count 50. (3) The beacon is fire-and-forget: a test with the DB write failing still returns the page 200 with no error to the viewer. (4) Rollup has a stated retention bound (rows older than N days purged by an existing cron path, tested) so it cannot grow without limit. (5) The readout suppresses any cell under k=5 (unit test) and states G4 is not measurable in this slice, with DESIGN 3.5 strict numbers beside it. (6) Fix #28 merges first (same lib/referral.ts:12 list); the beacon mounts from its own component, not app/layout.tsx, until F-13 merges. |
| K45 | AC | Strongest ops value on the ballot: the digest is the first view of sync tick outcomes, which today are only cron JSON and a log line (app/api/sync/route.ts:70-71). Conditions: (1) Fix #4 merges first as one shared visible-user predicate; K45 extends it, and a test fails on any from closed_trades read under app/ or lib/ that lacks it (covers app/t/**, app/sitemap.ts, the stock share image). (2) An e2e hides a demo profile and asserts it is absent from /, /t, /t/SYM, /t/compare, /sitemap.xml and the stock share image. (3) Profile reports never auto-hide; only the owner script hides, it never deletes, and every hide and unhide writes an audit row (tested). (4) The digest is a script, or a page behind F-9's off-by-default flag; it never uses the dev-stub session. (5) Public wording for a hidden profile is neutral and does not say reported. (6) Starts after F-9 merges; lapses to the next council if F-9 has not merged by then. |
| K2 | AC | Closes a verified integrity gap: changeHandle (lib/auth/attempts.ts:102-110) frees a renamed handle at once, while deleted handles are held 365 days (lib/delete.ts:13). But setHandle (app/auth/actions.ts:120-134) has no rate limit, so an unbounded hold is a squatting tool. Conditions: (1) at most one rename per 30 days, tested; (2) at most one held handle per account, a new rename releases the older hold, and the holder can rename back; a db test renaming one user 50 times finds at most one hold row for that user; (3) holds are released by the same path on account deletion (no orphan rows after deleteProfile, tested); (4) the old path shows a neutral "no longer in use" page, no link to the new handle and no 200 profile; (5) starts after #42 merges and lapses to the next council if it has not. |
| K7 | AC | Good drift guard only if the pin cannot freeze a defect or force a test to be weakened later. Conditions: (1) pin only decided lines that no fix or pending idea-board item contests; D25's Stocks line is asserted as chosen by demoOnly/mixed (real-only wording vs Demo wording), not pinned verbatim, until the idea board rules on D25/D27 against F3a; (2) starts after F-10..F-13 and fixes #1, #2, #8, #9, #10 merge; (3) shares the globals.css slot with K9, sequenced K9 then K7, and K7's Demo/Verified restyle must pass K9's tests; (4) lapses to the next council if its prerequisites have not merged. |
| K8 | AC | Only the lib-only first slice now; the risky parts are the sweep collisions and the U+2212 side effects. Conditions: (1) pct and tone move into lib/format.ts and are re-exported from lib/trades.ts:162 and lib/open-split.ts:10; no second implementation (a test asserts the old names are the same function objects); (2) the property test walks every surface's printing function, not cardEvidence alone; (3) the display log and share images keep the ASCII hyphen unless a render test shows the U+2212 glyph present first; if the log text changes, a dated note is written at the switch so history does not show a false change; (4) existing sign-pinned tests are updated, never deleted, and test count does not drop; (5) the call-site sweep and What's-this line run after K7 merges, in the K7/K9 lane. |
| K9 | AC | Value-neutral and cheap, but only once its base exists. Conditions: (1) starts only after the F-13 contrast-test branch and fixes #12, #13 and #26 merge, so the colour-blind gain-vs-loss floor passes on day one at the brief's threshold, never lowered to the current 2.8; (2) share-image colours move into one exported constant table that the contrast and colour-blind tests read, instead of being exempt from the literal ban; (3) lib/badge-contrast.test.ts is kept and test count does not drop; (4) lands before K7 in the shared slot; lapses to the next council if its prerequisites have not merged. |

#### Round 5: Legal and compliance

Findings, not legal advice (POLICY.md top: the AI legal committee stands in for counsel; the owner makes the calls it leaves open). No veto applied: every remaining POLICY problem the red team found is closed by a condition below. Removing a condition marked (binding) makes the built scope break POLICY, and LG would then veto at review.

| Candidate | Vote | Conditions / reason |
|---|---|---|
| K3 | AC | (1, binding, P6) Per-profile rollup rows are keyed by user_id references users on delete cascade, never by handle text. A db test deletes a profile and asserts no row names that user or handle, and a rename A to B then a new user A shows none of the old counts. The existing retention test (lib/privacy-retention.test.ts:28-35) only catches user_id columns, so this test is required. (2, binding, P3) No stored IP, user agent, viewer id, session id, cookie or fingerprint. A test fails on any such column. via values come from a closed registry and unknown values are dropped. (3, P3) The readout suppresses any cell below 5 or folds it into "other", so a count of 1 on an invite link can't identify the person who opened it. (4) New tables get SCHEMA_MAP entries (already enforced by the parser test) and the PR answers COMPLIANCE §1 Q2. (5) The readout says G4 is not measurable in this slice and prints the strict DESIGN §3.5 numbers. (6) Fix #28 lands first. The beacon mounts from its own component, not app/layout.tsx, until F-13 merges. (7) Real users stay behind the owner's Privacy Policy text covering this flow (P6, H). (8) Additive schema only, no drop. |
| K45 | AC | (1, binding, F4 and U2) Fix #4 lands first as one shared visible-user predicate. K45 extends it to hidden. A test fails on any closed_trades read under app/ or lib/ without it. An e2e hides a demo profile and checks /t, /t/SYM, /t/compare, the stock share image and /sitemap.xml. (2, binding) Profile reports never auto-hide. F-9's N-reporter auto-hold does not apply to profile targets. Only the owner script hides. Otherwise fresh accounts could take down a real record. (3, binding, CLAUDE.md auth stub) The digest is a script or a page behind F-9's off-by-default flag. It never relies on the dev-stub session. (4) The public hidden-state wording is neutral ("This profile is not available right now") and never says "reported" or "under review". A false report must not publicly mark an innocent trader. (5) Kept from round 0: hide never deletes and is reversible. Audit rows hold no thesis text. Takedown wording stays draft until the owner approves it, with no safe-harbor claim and a role mailbox. The anti-impersonation line names no platform and implies no identity check. No email until the owner sets a sender. (6) Hide covers a whole profile or a thesis, never a single trade (TR-1). It is owner-run and report-driven only. (7) After F-9 merges. K18 rides here. |
| K2 | AC | (1, binding, T1) The reserved list holds only generic and own-product words. No third-party, broker, platform or person names in the list, tests or fixtures. (2) At most one rename per 30 days and at most one held handle per account. A new rename releases the older hold. A db test renames 50 times and finds at most 1 hold. Without this the hold becomes a squatting tool, the U2 harm it exists to stop. (3, binding, P6) A hold stores only the handle string and a release date. It never blocks deletion and never resolves to a deleted person's data. Hold at most 1 year (lib/delete.ts:13 already uses 365). (4) The old path shows a neutral "This handle is no longer in use" page with a 404 status, no link to the new handle and no profile content. (5) Display-name rules: NFKC, strip bidi controls, refuse check glyphs and the whole words Verified/Official (word boundaries) (F3a). The rejection names the rule. No personal data in rejection logs. (6) Starts after #42 and lapses to the next council if #42 has not merged by then. |
| K7 | AC | (1, binding, F3a) Pin only decided lines that no fix or pending idea-board item contests. D25's Stocks line is asserted per data mix: the decided wording for real-only data, Demo wording when demoOnly or mixed (fix #1, app/t/page.tsx:16-17). D27's first-visit line is not pinned until the idea board rules on it against F3a. A pin that freezes "verified" over demo data would break F3a and P2. (2) "Verified" always links to /how#verified, whose text is "imported read-only from the trader's broker" and nothing more. F-7 "Public source" never shows the word Verified. Demo pages never say verified. (3) The false "Cannot be edited" tooltip is removed. Completeness-word and "sample data" bans are added as tests, never loosened. (4) Footer Terms, Privacy and How links survive the constant refactor on every page, checked by a test. (5) Shares the slot with K9, sequenced K9 then K7. It starts after F-10..F-13 and fixes #1, #2, #8, #9, #10. It lapses to the next council if those have not merged. |
| K8 | AC | (1, binding, F4 and F3c) A loss never reads as a gain. Share images and the display log keep the ASCII hyphen unless a render test first shows the U+2212 glyph is present in the image font. If the sign changes, the display log gets a dated note and no history row is rewritten. (2) pct and tone move into lib/format.ts and are re-exported from their old homes (lib/trades.ts:162, lib/open-split.ts:10). There is no second implementation. (3) The lo <= avg <= hi property test walks every surface's printing function, not cardEvidence alone. (4) The What's-this line "the range is for the average, not one trade" matches the computation. It and the glossary use no advice, signal, skill or pick words. "bet" stays. (5) confidence(), ranking, RANK_MIN_BETS and D23 order stay untouched. Pinned tests are updated, never deleted. (6) The sweep and the What's-this line come after K7 merges (same stats-row lines). The lib/format.ts slice can start now. |
| K9 | AC | (1, A1) The test asserts at least 4.5:1 for text and 3:1 for non-text and focus, plus a gain-vs-loss colour-blind floor. The floor is not set below today's defect (ΔE00 2.8) to make it pass. (2) It starts after fixes #12, #13, #26 and the F-13 contrast-test branch merge, so "value-neutral" is true. It lapses to the next council if they have not. (3) Share-image colours move into one exported constant table that the contrast tests read. Images are not exempt, because they carry the F3 disclaimer and gain/loss tone. (4) No colour chosen to match a named brand (T3). No externally hosted fonts or assets. (5) Lands before K7 in the shared slot. |

Notes. K3 is the one with new personal-data flow. Its condition (1) closes a real P6 gap the red team found, because the retention test would not catch handle-keyed rows. Every approved build answers COMPLIANCE §1 under a Compliance heading in its PR. K3, K45 and K2 answer Q2 (fields, location, visibility, deletion) explicitly.

#### Round 5: Trust and safety
| Candidate | Vote | Conditions / reason |
|---|---|---|
| K3 | AC | (1) Per-profile rollup rows key on user_id references users on delete cascade, never on handle text. A db test deletes a profile and finds no row naming it, and a test renames A to B, creates a new A and shows none of the old counts under the new A. (2) The readout suppresses any cell below k = 5 or rolls it into "other", tested by a unit test, so a 1-view invite row can't reveal that a known person opened it. (3) A test fails on any stored IP, user agent, viewer, session or cookie value, and on any via value outside the closed registry. (4) The readout says G4 is not measurable under this slice and prints the strict DESIGN §3.5 numbers beside it. (5) Fix #28 lands first; the beacon mounts from its own component, not app/layout.tsx, until F-13 merges. (6) Lapses to the next council if not started. |
| K45 | AC | (1) Fix #4 lands first as one shared visible-user SQL predicate; hidden extends it; a test fails on any closed_trades read under app/ or lib/ without it; an e2e hides a demo profile and finds it absent from /t, /t/compare, /t/SYM, its share image, the feed and sitemap.xml. (2) Profile reports never auto-hide; only the owner script hides, so N fresh accounts can't take down a record (F-9's N-reporter auto-hold stays theses-only). (3) Per-reporter rate limit and one report per reporter per profile, tested. (4) Public wording for a hidden profile is neutral and never says reported or under review by a report. (5) Digest is a script or a page behind F-9's off-by-default flag; never the dev-stub session. (6) Hide never deletes, never hides a single trade (TR-1), writes an audit row without thesis text. (7) Takedown page and anti-impersonation line need owner-approved wording before real users; line is literally true, names no platform, never implies identity checks. (8) Starts after F-9 merges; K18's under-18 report rides here and only hides. |
| K2 | AC | (1) At most one rename per 30 days per account, tested. (2) At most one held handle per account: a new rename releases the older hold, the holder can rename back; a test renaming 50 times finds at most one hold row for that user. (3) The old path shows a neutral "This handle is no longer in use" page with no link to the new handle and no 200 profile, so the old link never lands on a stranger. (4) Display-name rules: NFKC, strip bidi controls, refuse check glyphs, refuse Verified and Official as whole words only (word boundaries), rejection names the rule. (5) Reserved list holds generic and own-product words only (POLICY T1). (6) Held handle keeps no link to a deleted person; hold at most one year. (7) Starts after #42; lapses to the next council if #42 has not merged. |
| K7 | AC | (1) The pin test covers only decided lines no fix or pending idea-board item contests; D25's Stocks line is chosen by demoOnly or mixed (Demo wording when any demo data is shown), so no surface calls demo trades verified (F3a). (2) One bare Verified linked to /how#verified everywhere; Demo look never reads as verified; no "Cannot be edited" or completeness words, with tests. (3) Shares the globals.css slot with K9, sequenced K9 then K7. (4) Starts after F-10..F-13 and fixes #1, #2, #8, #9, #10; lapses to the next council if they have not merged. |
| K8 | AC | (1) pct and tone move into lib/format.ts and the old homes re-export them; a test fails on a second implementation. (2) The property test lo le avg le hi walks every surface's printing function, not cardEvidence alone. (3) Images and the display log keep the ASCII hyphen unless a test first shows the U+2212 glyph renders in share images, so a loss never reads as a gain; the display log gets a dated note at any switch. (4) The "range is for the average, not one trade" line ships in this slice. (5) The call-site sweep and labels run after K7 merges; pinned tests updated, never deleted. |
| K9 | AC | (1) Starts after fixes #12, #13, #26 and the F-13 contrast-test branch merge, so the colour-blind gain-vs-loss floor is not set below today's defect. (2) Share-image colours move into one exported constant table that the contrast and colour-blind tests read, not exempted. (3) Lands before K7 in the shared slot. (4) Lapses to the next council if its prerequisites have not merged. |

#### Round 5: Decisions keeper
| Candidate | Vote | Conditions / reason |
|---|---|---|
| K3 | AC | No owner or board decision conflicts. Conditions: (1) per-profile rollup rows are keyed by user_id references users on delete cascade, never by handle text; a db test deletes a profile and renames A to B, then asserts no old count shows under the new holder of A (POLICY P6; TR-5 handle hold, DESIGN.md:328). (2) The readout prints the strict DESIGN 3.5 numbers G1-G4 beside any derived figure and states that G4 is not measurable in this slice; it never redefines a gate (MRC2-3 is the owner's). (3) No readout cell under k=5; small via classes roll into "other"; a unit test checks it. (4) No cookie, device storage, viewer or session id (GTM 2026-11-01; E4 stays with the legal committee); the existing test fails on any stored identifier. (5) Fix #28 merges first; the beacon mounts from its own component and does not edit app/layout.tsx until F-13 merges; share_action waits for F-4/F-13. |
| K45 | AC | Clear only where it respects F-9's decisions (docs/features/F-9-thesis-safety.md:23-32). Conditions: (1) the digest is a script under scripts/, or a page behind F-9's off-by-default flag; it never uses the dev-stub session (F-9 2026-11-01; CLAUDE.md auth stub rule). (2) Profile reports never auto-hide; only the owner script hides, writes an audit row and never deletes; a test shows N reports change nothing. A K18 under-18 report may hide at once only as a temporary hide the owner reviews; the owner runs any deletion (POLICY H). (3) Starts after F-9 and fix #4 merge; the hidden state extends fix #4's shared visible-user predicate, and an e2e shows a hidden demo profile absent from /t, /t/<SYM>, /t/compare, the stock image and /sitemap.xml. (4) Public wording for a hidden profile is neutral and never says "reported". (5) Hide covers a whole profile or a thesis only, never one trade (TR-1). Takedown wording stays the owner's. |
| K2 | AC | Matches TR-5 (handle not reused for 1 year, DESIGN.md:328) and POLICY U2. Conditions: (1) starts after #42 merges, else lapses to the next council. (2) At most one rename per 30 days and at most one held handle per account; a new rename releases the older hold; the holder can rename back; a db test renaming 50 times finds at most 1 hold. (3) The old path shows a neutral "no longer in use" page with no link to the new handle and no profile. (4) Reserved list holds generic and own-product words only (T1); word-boundary match so names merely containing a word are not refused. (5) Retiring handles forever (O-9) stays with the owner. |
| K7 | AC | Clear only if no decided line is reworded. D25's Stocks line (docs/IDEAS.md:141-142) and D27's first-visit line (:147-149) are idea-board decisions; the council may not reword them and fix #1 must not either. Conditions: (1) the pin test asserts D25, D27, F-4 and F-1 decided lines verbatim for real-data states; where data is demo-only, the wording comes from demoOnly/mixed per fix #1 and POLICY F3a, and the test checks that switch instead of freezing "verified" on demo data. (2) Any change to the decided lines themselves (DSP-2, DSP-3) waits for the idea board. (3) Starts after F-10..F-13 and fixes #1, #2, #8, #9, #10 merge; lapses to the next council if they have not. (4) F-7's label stays with F-7's committee; card Demo hue O-2 stays with the owner. (5) Shares the globals.css slot with K9, sequenced K9 then K7. |
| K8 | AC | No decision conflict on the reshaped scope. Conditions: (1) pct and tone move into lib/format.ts and the old homes re-export them; one implementation, a test fails on a second. (2) "bet" (D24), D23 order, win rate, confidence(), ranking and RANK_MIN_BETS untouched; O-15/16/17 stay with the owner. (3) The append-only display log (D14, lib/display-log.ts:1-4) is never rewritten; if the sign glyph changes, a dated note records the switch day, and the glyph is shown in a share image test before any image uses it. (4) Pinned tests are updated, never deleted; test count does not drop. (5) The sweep and the What's-this line run after K7 merges, in its lane. |
| K9 | AC | No decision conflict: value-neutral, base and accent fixed until V-1 (settled conflict 9). Conditions: (1) starts after fixes #12, #13, #26 and the F-13 contrast-test branch merge, else lapses to the next council; the colour-blind floor is never set below a passing value to pin a defect. (2) Keeps lib/badge-contrast.test.ts; test count does not drop. (3) Share-image colours are read from one exported constant table with today's values; no image colour value changes (card Demo hue O-2 is the owner's; K11 is not approved). (4) Lands before K7 in the shared slot. |

#### Round 5: Common sense
| Candidate | Vote | Conditions / reason |
|---|---|---|
| K3 | AC | Still the one thing the week-8 call needs. RT's handle point is real: a rename frees the old handle at once (lib/auth/attempts.ts:102-110) and a deleted handle comes back after 365 days (lib/delete.ts:13), so counts keyed by handle text would follow a stranger. Conditions: (1) per-profile rollup rows key on user_id references users on delete cascade, never handle text; a db test deletes a profile and finds no row naming it, and a rename A to B then new user A shows none of the old counts. (2) The readout prints no path x via x day cell under 5; smaller counts roll into "other"; a unit test checks it. (3) The readout says in plain words that G4 (viewer D7 return) cannot be measured under this slice, and prints the strict DESIGN 3.5 numbers beside any count. (4) Fix #28 merges first. (5) The beacon mounts from its own component, and touches app/layout.tsx only after F-13 merges. No veto |
| K45 | AC | Right homework, but three parts as written would hurt an innocent trader or rest on the dev stub. Conditions: (1) Fix #4 merges first as one shared visible-user SQL predicate; K45 extends it; a test fails on any from closed_trades read under app/ or lib/ without it; an e2e hides a demo profile and finds its trades on none of /t, /t/SYM, /t/compare, /sitemap.xml or the stock image. (2) Profile reports never hide anything on their own, whatever the reporter count; only the owner script hides (F-9's thesis auto-hold is not inherited). (3) The digest is a script, or a page behind F-9's off-by-default flag; it never uses the dev-stub session. (4) The public hidden state uses neutral words such as "This profile is not available right now" and never says reported or under review. (5) Lapses to the next council if F-9 has not merged by then. No veto |
| K2 | AC | Without a cap the hold becomes the squatting tool it is meant to stop. Conditions: (1) At most one rename per 30 days; a db test renames 50 times and sees the second refused. (2) At most one held handle per account; a new rename releases the older hold; the holder can rename back. (3) The old path shows a neutral "This handle is no longer in use" page, returns no profile, and has no link to the new handle. (4) Display-name word rules match whole words only, so a name that merely contains "official" inside another word is accepted; a test covers it. (5) Lapses to the next council if #42 has not merged by then. No veto |
| K7 | AC | Pinning D25's Stocks line word for word on a page that today lists only demo symbols would freeze a claim a first-time viewer reads as false (app/t/page.tsx:16-17, :77; fix #1; POLICY F3a). That is the one part I would veto. Conditions that remove it: (1) The pin test covers only decided lines that no fix and no pending idea-board item contests. (2) For D25's Stocks line, the test asserts the wording is chosen by demoOnly or mixed: D25's line for real-only data, Demo wording otherwise; same rule for D27's line if the idea board has not ruled on DSP-2. (3) Sequenced in one slot with K9 first. (4) Lapses to the next council if F-10..F-13 and fixes #1, #2, #8, #9, #10 have not merged by then. With these, no veto |
| K8 | AC | Small value this cycle, but approvable if it removes drift instead of adding it. The U+2212 risk is the honest one: if the glyph is missing in a share image, a loss can read as a gain. Conditions: (1) pct and tone move into lib/format.ts and the old homes (lib/trades.ts:162, lib/open-split.ts:10, app/open-rows.tsx:9) re-export them; a test fails on a second implementation. (2) The property test walks every surface's printing function, not cardEvidence alone. (3) Share images and the display log keep the ASCII hyphen unless a test first shows the U+2212 glyph renders in each image font; any switch gets a dated note in the display log. (4) Pinned test literals are updated, never deleted, and the test count does not drop. (5) The sweep and the What's-this line come after K7 merges, in K7's lane. No veto |
| K9 | AC | Cheap and lasting, but only once its base exists. Conditions: (1) Starts after fixes #12, #13, #26 and the F-13 contrast-test branch merge. (2) The colour-blind gain-vs-loss floor is set at the brief's threshold and is never lowered to fit today's 2.8. (3) Share-image colours move into one exported constant table that the contrast and colour-blind tests read; images are not exempt. (4) Lands before K7 in the shared globals.css slot. (5) Lapses to the next council if its prerequisites have not merged by then. No veto |

#### Round 5: Red team
| Candidate | Vote | Conditions / reason |
|---|---|---|
| K3 | AC | (1) Per-profile rollup rows are keyed by user_id references users on delete cascade, never by handle text. A db test inserts rows, calls deleteProfile and finds none left; a second test renames A to B, creates a new user A and finds none of the old counts under the new user. (2) The readout suppresses any path x via x day cell below k=5 or folds it into "other"; a unit test checks no printed cell is under 5. (3) The readout says G4 (viewer D7 return) is not measurable under this slice and prints the strict DESIGN 3.5 numbers beside it. (4) The 200-bot / 50-human filter check runs before week 1. (5) Fix #28 merges first (same lib/referral.ts:12 list). (6) The beacon mounts from its own component and does not edit app/layout.tsx until F-13 merges. |
| K45 | AC | (1) Fix #4 is built first as one shared visible-user SQL predicate; K45 extends it with the hidden state. A test fails on any from closed_trades read under app/ or lib/ that lacks it. An e2e hides a demo profile and checks /t/SYM, /t, /t/compare, /sitemap.xml and the stock share image do not count it. (2) Profile reports never auto-hide; no N-reporter rule applies to the profile target; only the owner script hides. A test shows many fresh accounts reporting one demo profile leave it visible. (3) The digest is a script, or a page behind F-9's off-by-default flag; it never uses the dev-stub session. (4) The public hidden-state text is neutral and does not say "reported". (5) Starts after F-9 merges; lapses to next council if F-9 has not merged by then. |
| K2 | AC | (1) Rename rate limit: at most one rename per 30 days; a db test renaming one user 50 times in a loop ends with at most one handle_reservations row for that user. (2) At most one held handle per account; a new rename releases the older hold; the holder can rename back. (3) The old path returns a neutral "This handle is no longer in use" page with no link to the new handle and no 200 profile. (4) Display-name reserved words match on word boundaries, so a name merely containing a reserved word is not refused; a test covers this and a bidi name. (5) Lapses to next council if #42 has not merged. |
| K7 | AC | (1) The pin test pins only decided lines that no fix or pending idea-board item contests. (2) For D25's Stocks line the test asserts the wording is chosen by demoOnly/mixed: D25 wording for real-only data, Demo wording otherwise (fix #1, POLICY F3a). (3) D27's first-visit line is not pinned until the idea board rules on it against F3a. (4) Sequenced after K9 in the globals.css slot, so the Demo/Verified restyle must pass K9's tests. (5) Lapses to next council if F-10..F-13 and fixes #1, #2, #8, #9, #10 have not merged. |
| K8 | AC | (1) pct and tone move into lib/format.ts and are re-exported from lib/trades.ts and lib/open-split.ts; a grep test finds one implementation only. (2) The lo <= avg <= hi property test walks every surface's printing function, not cardEvidence alone. (3) Share images and the display log keep the ASCII hyphen unless a test first shows the U+2212 glyph renders in the image font; if the log text changes, the display log gets a dated note at the switch. Pinned test literals are updated, never deleted. (4) The first slice (lib/ only) may start now; the call-site sweep and What's-this line run after K7 merges, in the K7/K9 lane. |
| K9 | AC | (1) Starts only after fixes #12, #13, #26 and the F-13 contrast-test branch have merged; the colour-blind floor is not set below the value fix #26 reaches. (2) Share-image colours move into one exported constant table that the contrast and colour-blind tests read, instead of being exempt from the literal ban. (3) Lands before K7 in the shared globals.css slot. (4) Lapses to next council if its prerequisites have not merged. |

