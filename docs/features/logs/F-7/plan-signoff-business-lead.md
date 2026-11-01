# F-7 plan sign-off: business lead

Date: 2026-11-01. Reviewed: `plan.md` (round 3) against my `plan-round2-business-lead.md` and the other round
documents. Process note: this session had no subagent tool, so the build session wrote this review in the business
lead's role (team/business-lead.md), from the documents only. All names are fictional.

## Round 1 verdict: REVISE

I accept the two points I lost: Follow and likes go (legal C16 wins on compliance, as I said it should), and the
import runs as a bounded stage of the minute sync (records must stay current to be "identical"). Two of my demands
are missing from the merge, and one owner item cannot be met as written.

### Blocking demands
1. **A dry run the owner can use before the switch.** §5 item 3 makes switch-on wait for "≥ 100 filers with 5+
   priced closes", but nothing in the plan produces that number without turning the switch on in production. Add
   `--dry-run` to the operator script: fetch and match in memory, write nothing, print counts only (filers seen,
   filers with a priced close, filers with 5+, exclusions by reason, skipped non-officer/director). Test: a node
   test against the fake asserts zero rows written and no fixture name in the output.
2. **No page without a priced record** (my round-2 demand 1). A `users` row is created only once the filer has at
   least one priced closed round trip; others stay in `public_filers` with no page. Test: such a filer's handle
   404s and the run counts it.
3. **The provenance block is three rows at 360 px** (my demand 9), with the exact copy fixed in the plan (the UX
   lead's demand 1 is the same point; the row-2 sentence may wrap, the rows may not grow past three plus the
   filing caveat).

### Non-blocking notes
- Market demand stays at 3. The dry run is the cheapest test of the whole bet; run it on 3 months of filings first.
- Keep the card line short: "Company insider · from a public filing" is right; don't add the date.

## Round 2 verdict: SIGN

Round 4 items 8 (dry run, AC 33), 2 (no page without a priced record) and 1 (three-row block, exact copy) meet
demands 1-3. Non-blocking: the dry run reads `PUBLIC_TRADERS=1` from its own process env only, never from deploy
settings, so running it can't turn on the deployed routes. Switch-on still waits for the dry-run number (§5 item 3).

## Independent sign-off (fresh context)

Verdict: REVISE with two blocking demands (text edits to plan.md, applied in plan.md "Round 5 changes"):
1. Keep `unhide` (Round 4 cut 11.3 broke legal C13 "hide pending review (reversible)" and AC 23). Cut 11.3 deleted; if
   the diff is over 800, the builder stops and flags.
2. The not-joined line on the share card with a test: new AC 34 (card data, image alt and unfurl description carry
   "Public filing" and "has not joined Stock Social"; the line is at least 24 px at 1200x630; no Demo/Verified mix-up,
   no amount).

Non-blocking: market demand still 3 (below the bar); signed on the owner's recorded direction; switch-on waits for
the dry run (at least 100 filers with 5+ priced closes). The dry run reads `PUBLIC_TRADERS=1` from its own process
only. Card line exactly "Company insider · from a public filing", no date. Signs once both edits are in plan.md; no
new debate round needed.
