# F-34 · One open-positions line on every surface

Status: building
Start conditions: OD 2.25 is answered (`docs/direction/owner-decisions-2026-11-01.md` §2), and #100, #102 and #97
merge. It is the pane/strip build slot; F-29 and F-21 (re-approved this cycle) ride in the same slot with one builder
owning the line order.

## Why
A shared trade or month link shows open positions as a bare count, "‹n› open, unrealized", beside a large realized
average in the gain colour (`lib/record-strip.ts:119`, `lib/copy.ts:174`). It says "average per trade" where F-4's card
says "per closed trade" (`lib/copy.ts:172`). The profile card and the pane show the unrealized figures. TR-4 asks for
open positions "as prominent as the headline … in the down color when negative" (`docs/DESIGN.md:327`). F-12's same-day
decision chose the count for strips (`docs/features/F-12-trade-month-record-strip.md:17-19`), so making every surface
say the same thing amends that decision. What the line says follows OD 2.25 (council cycle 5, C5-5, brief rank 3).
Approved by the approval council (`docs/ideas/approval-2026-11-01-cycle5.md`: second-vote mean 3.87, final vote 15/15,
all with conditions).

## Decisions
- 2026-11-01: One helper produces the open line for every surface: card, pane, profile, both strips, all images and
  their alt texts. It lives in `lib/record-strip.ts` or `lib/copy.ts`, the image routes import it, and it is never
  duplicated inside a route. Amends F-12's 2026-11-01 strip decision. Why: approved by the approval council (cycle 5);
  brief C5-5; EN, DS.
- 2026-11-01: If the owner answers OD 2.25 yes (unrealized values hidden for real users), every surface shows 2.25's
  line ("Open positions exist and aren't shown yet"). If no, every surface shows F-4's card line, lowest value first.
  A negative value carries a minus sign and a word, and takes the down colour from F-20's colour table (`--loss`,
  the same value on images), never a literal hex and never colour alone. Why: approved by the approval council (cycle
  5); brief C5-5; A11Y, DS.
- 2026-11-01: No unrealized value appears on any surface that has none today until OD 2.25 is answered. The vendor's
  market-data permission remains a launch gate. Why: approved by the approval council (cycle 5); LC, CO (veto
  condition: LC).
- 2026-11-01: The open line uses exactly the record's account set. Positions from paper accounts and `notShared`
  accounts never feed a public open line that the closed figures leave out (`lib/sync.ts:604-606`). Why: approved by
  the approval council (cycle 5); RT round 4.
- 2026-11-01: Images and their alt texts carry the positions' as-of date beside any unrealized value: the time the
  positions were read, not the time the page was drawn, with the year (DSP-12 / F-11). The line and its date come from
  stored positions, never from a vendor call while rendering, with no extra per-request query in the images. That date
  is labelled "freshness, internal" in `lib/privacy-fields.ts:41`, yet the profile already prints it
  (`app/u/[handle]/page.tsx:103`). Until the owner moves it into OD 2.7's record-state fields, images show only what
  the profile already shows, and the build flags the label to the owner. Why: approved by the approval council (cycle
  5); RT round 4, RT, DS, RE, PR.
- 2026-11-01: TR-4 prominence: under either OD 2.25 answer, the open line sits in the headline figures' block on every
  surface, never in a caption or foot. In the pane the order is fixed: the exclusions line (F-21), then the open line,
  then the options qualifier (F-29), one line each, with no repeats. With all three present on a fictional record, the
  headline and the disclaimer stay in view at 360 px and the layout reflows at 320 px. Why: approved by the approval
  council (cycle 5); UX, CO, UX round 2 (the shared pane AC).
- 2026-11-01: "average per trade" becomes "per closed trade" on the strips under either OD 2.25 answer. That wording
  part is routed to the cycle-5 fixes lane now and is not this feature's work. Why: approved by the approval council
  (cycle 5); CO, EN (routed in round 3).

- 2026-11-02: OD 2.25 answered by the owner, overriding the council's recommendation: real users' unrealized values
  keep showing publicly (F-6 as it is today). There is no "aren't shown yet" line. F-34 builds the single open line in
  the shown-values variant (F-4's card line, lowest value first) on every surface; the council's C5-5 wording ("per
  closed trade") still applies where this file says so. The guard test "no unrealized value on the strips" is replaced
  by the render-equality test (first AC). Build starts before #100 and #102 merge; main is merged in as each lands.
  Why: the owner's decision of 2026-11-02 (OD 2.25).

## Acceptance criteria
- [ ] Until OD 2.25 is answered, a guard test pins "no unrealized value on the strips or their images". After 2.25, a
      render-equality test replaces it: a fictional record with a −15% open loser gives byte-identical open-line text
      on the profile card, pane, trade page, month page, the three images' text and alt texts, and the trade and month
      link-preview descriptions.
- [ ] Image snapshot tests for every link preview. The expected values change only on the open line.
- [ ] A fixture with a paper account and a `notShared` account: neither feeds the open line.
- [ ] Every unrealized value on an image has the positions' as-of date beside it, with the year (render test).
- [ ] The images make no vendor call and no extra per-request query (test with the vendor fake asserting no calls).
- [ ] The down colour on images comes from the F-20 image colour table (literal scanner).
- [ ] In the pane, with the exclusions, open and options lines all present, the headline and the disclaimer stay in
      view at 360 px and reflow at 320 px (e2e).
- [ ] A source scan finds one producer of the open line, paired with the render-equality test above.

## Out of scope
- Whether unrealized values show at all (OD 2.25).
- Including open positions in the TR-9 range (OD 2.34).
- The "per closed trade" wording (fixes lane).

## Open questions
- Resolved 2026-11-02 (OD 2.25): no, unrealized values keep showing (Decisions).
- Owner (OD 2.7): move the positions' as-of date from "freshness, internal" into the named record-state fields?

## POLICY notes
- F3a/TR-4: the open line is as prominent as the headline and never in the gain colour when negative.
- A1: never colour alone; a minus sign and a word, and contrast from F-20's tokens.
- P3: images show only what the profile already shows until the owner names the as-of date in the consent scope.

## Hand-offs to in-flight work
- F-16/F-17 (#100) edit all four image routes, F-25 (#102) the trade image, F-23 (#97) the pane. Build after all three.
- F-29 and F-21 (re-approved this cycle) share the pane slot. One builder owns the line order above.

## Rework notes

## Build log
