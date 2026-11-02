# F-33 · Ranking weight needs evidence, not just a narrow range

Status: blocked
Blocked: builds after F-16/F-17 (#100) and F-25 (#102) merge, since both edit `lib/feed.ts` (merge order; the owner answered cycle-5 Q3, OD 2.32, OD 2.33 and OD 2.34 on 2026-11-02)
Start conditions: the owner answers cycle-5 Q3 (`docs/direction/cycle5-2026-11-01.md` §8) together with OD 2.32, OD
2.33 and OD 2.34 in one sitting, and #100 and #102 merge. It is its own build slot (the ranking slot).

## Why
The error term shrinks to zero when returns are identical (`lib/bets.ts:47`, the interval at `:48-49`), and the feed
weighs the lower bound (`lib/feed.ts:391`, `:413`). In the cycle-5 audit's fictional probe, ten trades of exactly +1%
got weight 0.299, a range of "+1.0% to +1.0%" and "Past results: above zero". A 200-bet record over 200 days got 0.167.
Ten exact −1% trades got 0.302, so losses are inflated the same way. The council's red team showed that a tiny jitter
still prints a zero-width range at weight 0.296. That defeats TR-9's aim that small lucky samples cannot top the feed
(council cycle 5, C5-4, brief rank 2). Approved by the approval council (`docs/ideas/approval-2026-11-01-cycle5.md`:
second-vote mean 4.00, final vote 15/15, all approving, 14 of them with conditions).

## Decisions
- 2026-11-01: Approved as "waits on cycle-5 Q3". Ranking weight comes only from the moderate evidence tier up
  (`lib/confidence.ts:24`, `:26`: 30 bets over 90 days). That replaces the owner's 2026-11-01 ranking floor of 10 bets
  (`lib/confidence.ts:15-18`), so the owner decides. The edit to TR-9's text in DESIGN goes in the owner's PR, never in
  the build PR. Why: approved by the approval council (cycle 5); brief C5-4; DK check (an owner decision is replaced)
  (veto condition: DK check, chair).
- 2026-11-01: The spread in the error term never falls below 1 percentage point per trade. The floor applies inside
  the error term, not only at exactly zero (the jitter probe). Why: approved by the approval council (cycle 5); RT.
- 2026-11-01: Below the tier, a record keeps today's score order (weight 0 falls back to size × recency decay,
  `lib/feed.ts:26`, `lib/trades.ts:575-579`). It stays visible, is never hidden, and has a deterministic, stable
  tie-break. No new recency-only order is introduced, and no order ever uses trade count or frequency. Why: approved by
  the approval council (cycle 5); RT round 4 (pure recency rewards whoever closes most often, close to POLICY's
  frequency rule); TE.
- 2026-11-01: Symmetric for losses. Losses still rank equal to gains of the same size. Why: approved by the approval
  council (cycle 5); POLICY; CLAUDE.md product rules.
- 2026-11-01: A zero-width range prints "Too early to tell" (OD 2.32's wording). The words come from one producer, the
  `early` constant (`lib/copy.ts:225`), and the literals at `app/t/[symbol]/page.tsx:128` and `:159` move onto it. The text is
  visible, and the accessible text matches it: never a blank range, an icon or colour alone. This feature owns the
  printed range and supersedes the fixes-lane step that already prints "Too early to tell" and drops "Past results:
  above zero" until the owner answers. Why: approved by the approval council (cycle 5); DS, A11Y, UX, RT (routing fix).
- 2026-11-01: The file says plainly that the floor raises the cost of a lucky streak but does not close the
  hold-losers-open path. A record that closes winners at a fixed +1% and holds losers open still reaches the tier
  (about 0.18 point standard error at 30 bets). Only open positions in the range (OD 2.34) or an open-loss check at rank
  time closes it, so OD 2.34 goes to the owner with Q3. No copy may claim small samples "can't" top the feed. Why:
  approved by the approval council (cycle 5); RT round 4, CO, BL.
- 2026-11-01: The change is read-side only, so it needs no rebuild and no MATCHER_VERSION bump. The per-process weight
  cache (`lib/feed.ts:395-396`) never serves weights from the old formula after a deploy. Why: approved by the approval
  council (cycle 5); RE.
- 2026-11-01: The F-15 readout shows a counts-only figure (suppressed under 5) of visible records with rank weight
  above 0. /how states the floor in plain words once Q3 and OD 2.32 are answered, and says why a record below the tier
  carries no ranking weight yet, so new traders do not read it as a penalty. No "proven", "top" or "skill" words. Why:
  approved by the approval council (cycle 5); BL, TR, LC (F1/F3b).
- 2026-11-02: The owner answered cycle-5 Q3 yes: ranking weight starts at the moderate evidence tier (30 independent
  trades over 90 days), with a 1-point floor on the spread, replacing the owner's 2026-11-01 floor of 10. Why: the
  owner's decision of 2026-11-02 (ranking).
- 2026-11-02: The owner answered OD 2.33 with (c): rank by the near-edge distance from 0 of the range (the edge nearer
  to 0, so a record whose range crosses 0 has weight 0, and gains and losses of the same size weigh the same),
  documented on /how. /how and all copy describe it without "edge" as a label (POLICY F3b), for example "the end of
  the likely range nearer to 0". The property-test AC above uses this method. The TR-9 and CLAUDE.md:92 text edits
  (brief 3.6, 3.20) go to the protected-files session, never in the build PR. Why: the owner's decision of 2026-11-02
  (ranking; OD 2.33).
- 2026-11-02: The owner accepted OD 2.32: one range rule everywhere, the arithmetic mean of simple returns; "Too early
  to tell" for a zero-width range; the wording "average per trade so far, likely between X and Y". This feature owns
  the printed range and its one producer, so it carries 2.32's wording. OD 2.34 (open positions in the range) is
  accepted and is F-46, built after this one in the ranking slot
  (`docs/direction/owner-decisions-2026-11-02-worklist.md`); the hold-losers AC stays a `todo` naming it until then.
  Why: the owner's decisions of 2026-11-02 (OD 2.32, 2.34, accepted en bloc).

## Acceptance criteria
- [ ] The probe's ten +1% record and the jitter record each weigh less than the 200-bet record. The ten −1% twin does
      the same (symmetric test).
- [ ] No printed range has zero width. A zero-width range prints "Too early to tell" from the one constant.
- [ ] Boundary tests at 29/30 bets and 89/90 days.
- [ ] A property test over random fictional records: records at the moderate tier and above keep the order of the
      method OD 2.33 picks (not today's method by name).
- [ ] Below the tier, the order equals today's score order with a stable tie-break. A record with many small trades
      never outranks one with fewer trades on count alone.
- [ ] Losses still rank equal to gains of the same size.
- [ ] The hold-losers AC: a fictional record of 30 winners at +1% with 10 losers held open at −20% never outranks a
      200-bet record with the same closed figures. If that cannot pass without OD 2.34, it stays in the file as a
      `todo` test naming OD 2.34, never deleted.
- [ ] At or above the 1-point floor, the printed range is unchanged.
- [ ] After a deploy, no weight from the old formula is served (cache test).
- [ ] The readout's counts-only figure is suppressed under 5.

## Out of scope
- Including open positions in the range (OD 2.34).
- Choosing the ranking method (OD 2.33).
- The fixes-lane step that prints "Too early to tell" now.

## Open questions
- Resolved 2026-11-02: cycle-5 Q3 yes; OD 2.32 yes; OD 2.33 (c) near-edge distance from 0; OD 2.34 yes, built as its own
  feature after this one (Decisions).

## POLICY notes
- F4 (losses never hidden, ranked like gains): the change is symmetric and tested on both signs.
- POLICY's frequency rule: no order uses trade count or frequency.
- F1/F3b: no "top", "best", "proven" or "skill" wording. TR-9 stays a documented method on /how.

## Hand-offs to in-flight work
- F-16/F-17 (#100) and F-25 (#102) edit `lib/feed.ts`. Build after both merge.
- The fixes lane (claude/fixes-cycle5 or its successor) prints "Too early to tell" for a zero-width range now. This
  feature takes that over and keeps one producer.

## Rework notes

## Build log
