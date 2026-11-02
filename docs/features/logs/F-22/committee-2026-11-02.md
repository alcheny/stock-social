# F-22 committee record, 2026-11-02

Feature: `docs/features/F-22-transfers-as-share-moves.md` (Status `ready` on the owner-decisions branch, #106; the owner
said yes to OD 2.28 on 2026-11-02, relayed by the orchestrator). Built on top of F-32 Part A (#108) on
`claude/f22-transfers-share-moves`. Members: UX lead (plan author), business lead, engineer, tester, independent
reviewer, each a fresh-context subagent; the orchestrating build session wrote the brief (`brief.md`), built the change
(tests first) and recorded the rounds. Plan: `plan.md` (the UX lead's draft plus "Round 2 changes" and owner items 5-6).

## Round 1
- UX lead's plan: accepted the brief's division with F-32 Part B (F-22 = what a transfer does to lots, plus the count;
  Part B = the backward window and same-day rule, still waiting on MRC2-10); added the loader direction rule, a stricter
  "alike" test (opening date and `verified`), `COUNTED_KEYS`; found that a reverse split sent as a transfer out would
  publish a false gain and recommended holding the merge on MRC2-10 or the owner's written acceptance.
- The build session added question 5: buy 100, transfer 1 in, sell all 101 → the whole sell (and its loss) was excluded,
  chosen after the loss was seen.
- Business lead: CHANGES REQUIRED (8). Engineer: CHANGES REQUIRED (8). Both chose option (a) for Q5; the engineer added
  that moved-in units must be drawn after every recorded lot. Resolutions: `plan.md` → "Round 2 changes".

## Round 2
- Business lead: SIGN, on two conditions, both met: the pre-deploy clean-ratio diagnostic as a deploy stop (plan §8 item
  5) and the remaining mixed-lots move named as a known limit (plan §8 item 6, PR body).
- Engineer: CHANGES REQUIRED (4), all taken: a transfer-out property (3,000 seeded cases; a sell drawing only lots older
  than the transfer keeps its return; no sell is shown only because of a transfer out; holding days change only when
  alike lots differ in date), with a `lastDrawn` test hook; the opening-date choice kept as an owner item (the committee
  took the business lead's side: dropping it stops a one-share move from turning a loss into a count; the holding period
  then follows this record's FIFO); the Q5 gain case (already pinned at +60%); DB tests run against Postgres (they pass:
  PR body); the in-then-out move named (since fixed, below).

## Independent review (no blocking defects; two findings, both fixed)
- One share moved in and one out turned a recorded loss into a count, and a same-instant in and out depended on vendor-id
  order: "alike" is now judged over recorded lots only (moved-in lots stay last and have no basis).
- A transfer out in an account marked as another profile's was counted on this profile: the sync skips marked accounts.

## QA and user test
- UX lead and business lead user test (360 and 320 px, light and dark, signed out): business lead PASS; UX lead copy
  changes (the partly-transferred line gets a verb; the /how transfers item leads with transfers in, states the "recorded
  shares only" rule in one short sentence, and links to the transfers-out item). All taken, with e2e tests.
- Tester: FAIL on one verified defect, fixed: a partial transfer out of alike lots with different dates, then a rename
  merging them with recorded lots of the new symbol, let the unknown dates choose which lot a later sell drew (+50% shown
  where −10% was as likely). Lots left that way are marked `datesUnknown`; such a merge taints the merged holding. Also
  fixed: at one instant a transfer out now applies after transfers in (no vendor-id order dependence). The tester's own
  scripts re-run clean (reference model 0 of 20,000 mismatches; uniform-price 0 of 30,000; ties 0 differences).

## Decisions taken here (committee's recommended options)
- F-22 owns what a transfer does to lots and the transfers-out count; Part B keeps the window and same-day rule.
- Moved-in units are drawn after every recorded lot; a sell drawing recorded and moved-in units is shown, priced on its
  recorded units (exit fee prorated), and counted in `sellsPartlyTransferred` (in no sum: it is shown).
- A transfer out removes oldest units; the lots left stay priced when the whole holding moved or every recorded lot is
  alike (price, fee, `verified`, taint); otherwise they are tainted. Opening dates are not part of "alike"; lots left
  with unknown dates are tainted when a rename merges them with recorded lots.
- The loader reads direction from the vendor type; a sign that contradicts the type drops the units (unit-less: taint).
- `countedSum` returns two units (`{ sells, transfersOut }`), never one number; F-21 must name both.
- The acceptance criterion "inserting a TRANSFER never improves a shown average or win rate" is replaced by properties
  that hold (plan §7 and the tests): it cannot hold while the backward window stays (Part B), and a transfer in can make
  an oversold close exact on its recorded units. Owner item.
- Merge hold: the vendor's written MRC2-10 answer (preferred) or the owner's written acceptance, in both directions.
