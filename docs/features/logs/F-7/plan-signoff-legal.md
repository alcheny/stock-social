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

## Independent sign-off (fresh context)

Date: 2026-11-01. Written by the legal-and-compliance member in a fresh context, from `docs/POLICY.md`,
`docs/COMPLIANCE.md` Section 1, the feature file, `legal-findings.md`, `plan-round2-legal.md` (C1-C24) and
`plan.md` with its Round 4 changes, checked against the current `lib/feed.ts`. The draft above was written in role;
this section is the member's own ruling and replaces its Round 2 verdict where they differ. AI legal analysis the
owner accepts in place of counsel (POLICY, owner decision 2026-11-01); not a licensed attorney's opinion.

### Verdict: REVISE (2 blocking demands)

C1-C16 and C18-C24 are met by `plan.md` §1-§4 with Round 4 items 1-3 and 5-11. Two gaps remain, one under C17 and
one under the adults rule; both are small and testable.

### Ruling on §1 row 6 (30-day floor from the closing sell's filed time, eligibility only): CONFIRMED in principle, NOT MET as specified
A floor that only delays eligibility removes "just filed" value instead of creating it, and the score's recency term
keys on the transaction date, so the floor is not a ranking input from filed time (C17) **provided an embargoed close
is invisible to every feed-side read**. The plan specifies one clause in the candidate set. In the current feed code
that is not enough:
- the eligibility step has a second branch that counts a trader's closes straight from `closed_trades`, so a filer
  whose 5th close was filed today would enter the feed today;
- the TR-9 weight (and its cache fingerprint) and the section pool read the trader's whole record up to `asOf`, so a
  filing landing today changes where an already-listed filer ranks today.
Both are feed timing that comes from a filing (C17, finding 14, F3b). Also, the floor keys on the closing sale only:
an amendment to an opening purchase changes a trade's return without moving its floor.

### Ruling on §1 row 8 (director or officer only as the adults rule): CONFIRMED, with one gap
Role from the filing's reporting-relationship fields, large-holder-only and "other"-only filers skipped and counted
(Round 4 item 5): this is a rule by role, not by name or age cohort, and meets P4 for the filer. The gap: the plan
matches indirect holdings as separate queues on the filer's profile. Indirect holdings are often held for family
members, including minors, and their free-text holding labels describe those relationships. Showing those trades as
the filer's record attributes other people's trades to the filer (finding 7) and can bring a minor's holdings onto a
public page, which the adults rule is meant to keep out.

### Blocking demands
1. **The floor applies to every feed-side read, keyed to the latest filing behind the trade.** `feed_after` = the
   latest effective filed time (after amendments) among the filings that make up the closed trade (opening lots and
   closing sale), plus 30 days. Every read that brings a filer to a viewer who did not open that filer excludes
   embargoed closes: the candidate set, both eligibility branches, the TR-9 weight and its fingerprint, exploration
   extras, the section pool, similar trades and suggest. Tests (AC 21): adding an embargoed close to an in-feed filer
   leaves the feed list, order and weights unchanged; a filer whose 5th close is embargoed is not eligible; an
   amended opening purchase moves the floor.
2. **Indirect holdings are excluded and counted in this release.** Rows reported as indirectly held are excluded
   with their own reason (`indirect`), never priced or shown, and their holding label is not stored (an opaque queue
   key at most), rendered or logged (C4, C8). Tests: a fixture indirect row adds 1 to the `indirect` count, produces no
   closed trade, and no label text appears in raw rows, HTML or logs. A later release may include them only after a
   committee review.

### Business council's two points: the plan matches both
- **No fetching of legislators' reports until the owner rules on the commercial-use restriction:** `plan.md` §2 item 1
  and C20 (not fetched, parsed or stored; the schema's source check allows insider reports only, and widening it is the
  owner's), L2 per-source gate, §5 item 5 (owner's written acceptance plus a price source first). Confirmed.
- **Real-filer switch off by default in production:** §2 item 5, C19 and Round 4 item 6: unset or `0` is off in
  production including previews; on needs an explicit `PUBLIC_TRADERS=1` plus both contacts; unset outside production
  reaches loopback only, so no real filer enters a dev, test or CI database. Confirmed. The dry run (Round 4 item 8)
  writes nothing and prints counts only, which is consistent with both.

### Non-blocking notes
- Route `remove` through the existing profile deletion so the handle stays reserved (C3).
- A filer's first import can bring several old closes at once; that is acceptable because every one is already past
  the floor, but no "joined" or "new" treatment may attach to it (C17).
- Some director filers are entities; "This filer" may replace "This person" in a later copy pass.

I sign once Round 5 adopts demands 1 and 2 with their tests; no further review round is needed if it does so verbatim.
