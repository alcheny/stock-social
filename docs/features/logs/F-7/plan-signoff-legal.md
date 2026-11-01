# F-7 plan sign-off: legal and compliance

Date: 2026-11-01. Reviewed: `plan.md` (round 3) against `legal-findings.md` (L1-L12) and `plan-round2-legal.md`
(C1-C24), `docs/POLICY.md` and `docs/COMPLIANCE.md` Section 1. AI legal analysis accepted by the owner in place of
counsel (POLICY, owner decision 2026-11-01); it is not a licensed attorney's opinion. Process note: this session had
no subagent tool, so the build session wrote this review in the legal member's role, from the documents only. No
real people, companies, agencies or form names are named.

## Round 1 verdict: REVISE

### Row 6 (30-day feed floor on the closing sell's filed time, eligibility only): CONFIRMED, with conditions
C17 bars ranking inputs, slots, badges and labels from filing time, and any feed item whose content or timing comes
from a filing. A floor that only delays eligibility by 30 days removes the "just filed" value instead of creating it,
and ordering stays the documented score whose recency term keys on the transaction date. Conditions: (a) the floor
applies on every surface that brings a filer's close to a viewer who did not open that filer: the feed, similar
trades and suggest (the profile, trade page and pane are looked up and show at once); (b) it uses the filed time of
the filing in effect after amendments (the latest amending filing of the closing sell); (c) crossing the floor is
never shown, announced or logged as an event. See demand 1.

### Row 8 (director/officer-only rule for adults): CONFIRMED, with conditions
Directors and officers of reporting companies are adults in practice, and the rule is by role, not by name or by an
age cohort. Conditions: the role comes from the filing's reporting-relationship fields; a filer whose only roles
are large-holder or "other" is skipped and counted, never profiled; the rule is checked on every filing that would
create the profile. AC 6 already tests the skip; it adds the large-holder-only and "other"-only cases.

### Blocking demands
1. **Floor everywhere it pushes** (row 6 (a)-(b)): `feed_after` filters similar trades and suggest as well as the
   feed, and is recomputed from the effective filing on rebuild. AC 21 gains both cases.
2. **No real filer in a dev database (L3).** Plan §2 item 5 makes the switch on when unset outside production, and
   ruling (e)(2) limited the importer to loopback only for the sandbox. Extend it: whenever the switch is on by
   default (unset), the importer reaches loopback only; the official base URL needs an explicit `PUBLIC_TRADERS=1`
   and `PUBLIC_FILINGS_CONTACT`. AC 8 gains the case.
3. **Removal keeps only the suppression fields (C5).** `remove` deletes the `users` row, raw and derived rows, and
   leaves the `public_filers` row with filer id, source and `removed_at` only (`excluded`, `open_symbols`,
   `checked_at` cleared). AC 23 asserts it.
4. **No Like or Follow on public feed cards (C16).** The card's Like button, the double-tap like and the card menu's
   Follow are absent on public cards; AC 28 covers the feed card.
5. **The dry run (business lead) stays inside the fair-access rules.** Explicit `PUBLIC_TRADERS=1` and the contact,
   the same worker and rate, no database writes, counts only in the output (no filer or issuer names, C8).

### Non-blocking notes
- Some director filers are entities, not people. The not-joined line still reads correctly enough ("This person")
  for v1; a later copy change may say "This filer".
- The "no page without a priced record" rule (business lead) is the safer reading of finding 3; I support it.
- The PR's `## Compliance` section answers Section 1 items 2, 6 and 7 "yes", citing C1-C24 and these conditions.

## Round 2 verdict: SIGN

Round 4 items 4 and 5 record rows 6 and 8 as confirmed with my conditions, and items 3, 6, 7 and 8 meet demands
1-5. I sign plan.md with C1-C24 and these conditions as build rules. Non-blocking: `remove` should go through the
existing profile deletion (`lib/delete.ts`), so the handle is reserved as C3 asks. The `pf_` refusal on signup and
rename (AC 7) already stops reuse, so this is defense in depth. The owner items in §5 are unchanged.
