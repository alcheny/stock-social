# F-7 committee review: business lead (2026-11-01)

**This pass was run by the QA orchestrator itself in the business-lead role (`team/business-lead.md`), not by a
separate subagent: the session had no Agent tool.** The app was the existing build on :3100, with fictional filers
only (`pf_qa_*`, `ZQ*` symbols) at 360x640. It was walked signed out (arriving from a shared profile link, and from
the feed) and signed in as a demo trader through `/login/dev`. Screenshots: `screenshots/ux-*.png` and
`screenshots/tester-*.png`.

## Verdict: DEMANDS (not yet a pass)

The business case works. A filer sits in the same feed and ranking as connected traders, and the card says plainly
where the record comes from. Their losses show like gains, and the profile reads like any other record. That is the
owner's "identical, except the source". What remains is trust: if one number disagrees between two screens, or one
unfurl says "Verified", it undoes the whole premise of a record you can believe.

## What confused or stopped me, in plain words
- **Arriving from a shared link:** the first screen is clear. It shows the name, then "Demo · Public filing ·
  Company insider", then the not-joined sentence, then the stats. The "did this person sign up?" question is answered
  in the first few seconds. The actual trades, though, sit three scroll-lengths down, below six separate exclusion
  sentences and the open-positions block (`ux-shared-link-scroll2-360x640.png`). A curious viewer reads a page of
  caveats before seeing a single trade.
- **Arriving from the feed:** the card is clean ("Company insider · from a public filing", "See their record, wins
  and losses →"). After swiping to the pane, the name is cut to "Fictio…" (`ux-feed-filer-pane-360x640.png`), so I
  couldn't tell whose record I was looking at.
- **The numbers disagree:** the profile says "+9.7% avg return", while the pane, the trade page, the month page and
  the share image say "+9.8%" for the same record.
- **Signed in:** identical to signed out, with no Follow or Like. That is right. Nothing stopped me.
- **The corrections page:** clear and calm. Shared on its own, though, it unfurls as "Verified trades, straight
  from the broker", which is the opposite of what the page says.

## Demands (each testable)
1. **One average everywhere.** The same record shows the same rounded average on the profile, pane, cards, meta and
   images. Test it with a fixture whose mean is exactly x.x5%.
2. **Trade and month share images carry the label in their alt text and twitter alt:** "Public filing" and "has not
   joined Stock Social" (AC 14/34; tester finding 2).
3. **`/public-records` gets its own description,** with no "Verified" and no "broker".
4. **The pane shows the full display name at 360 px,** wrapping onto its own line rather than truncating.
5. **Resolve AC 15 on the trade, month and pane pages** (tester finding 1): build the "Company insider / Record since
   · last checked / Filings can be late" rows there, or have the committee amend AC 15. Pick one in this PR.
6. *(Strong recommendation, not blocking.)* Collapse the exclusions on the profile into one line, e.g. "8
   transactions excluded · why", that expands to the per-reason list. The trades should come first. AC 18 still holds
   because the counts by reason stay one tap away.

## Compliance: FAIL until items 2 and 3 are fixed (both small); everything else passes

Against POLICY:
- F1/F2 pass: no advice, signal or "copy" language. The banned list is clean in `main`.
- F3 pass: the disclaimer is on every surface and every image.
- F3a FAIL: the `/public-records` unfurl claims "Verified … from the broker". Also a note: "All trades this month" on
  a filer's month page reads as completeness.
- F4 pass: losses show and rank like gains, exclusions are counted, and open symbols are shown.
- P2 pass: Demo plus Public filing on fixtures.
- P3 pass: no amounts anywhere.
- T1/T2 pass: fictional names only.
- A1 pass for the new F-7 controls, which are all 44 px with names. The 20 px row links and 35 px range buttons are
  pre-existing.

Against `plan-round2-legal.md`:

| Condition | Result |
|---|---|
| C1-C3 identity | pass (unit tests; dev login with a filer handle creates no session) |
| C4, C5 data minimum | pass |
| C6-C8 importer | pass (unit tests) |
| C9 never Verified | **partial**: no badge anywhere, but the trade and month image alt text lack "Public filing", and the `/public-records` unfurl says "Verified" |
| C10 exclusions, caveat | pass on the profile |
| C11 Demo | pass |
| C12 `/public-records` | pass: linked from the profile, pane, trade, month and `/how`, and reachable with the switch off |
| C13, C14 hide/remove/log | pass |
| C15 not-joined line | pass on every surface |
| C16 no Follow/Like/thesis/CTA | pass |
| C17 no New badge, floor | pass in the feed list; the pane shows an embargoed close, which is likely fine because the viewer opened the filer (committee to confirm) |
| C18 off `/t`, banned words | pass |
| C19, C20 switch, source | pass (verified live on :3101 with `PUBLIC_TRADERS=0`) |
| C21 free, signed out | pass |
| C22 noindex | pass |
| C23 fictional | pass |
| C24 `/how` | pass |
