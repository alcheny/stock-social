# Fixes-labels committee 2026-11-01

## User test: business lead

Method: live text of the production server on :3210 (`/`, pane, `/u/momentum_maya`, its trade and `2026-10` month,
`/t/NVDA`, `/t/compare?a=NVDA&b=AMD`), the tester's 360 px screenshots (frozen, idle, two-account fixtures; taken
before the round-1 fixes, so checked against the current code) and `lib/copy.ts` FIXES-LABELS and STATUS_LINE.
Caveat: I could not drive a browser or sign in, so the owner's view was judged from code and the QA logs only.

**Verdict: PASS.** Demo is never called verified, on any page I read or in its title or meta. The root description
is now honest. Dates outside this year carry the year. A frozen record says "Disconnected ‹date› · record frozen" with
no "Connected". Month and stock pages carry numbers and a range, with no verdict. The baseline label is now correct
("average per trade, 95% range"). The F3 line sits right after the first figures, once per screen. I found no advice
and no completeness claims.

What confused or stopped me (all non-blocking, by priority):
1. Nagging on `/t/NVDA`: "Demo trades, not from a real broker." prints 8 times, plus a Demo badge on every section.
   Keep the page note and the badges, and drop the repeated sentences. Verify: the sentence appears at most twice.
2. A feed card shows "JNJ -1.4%" with no date, because main's record strip replaces the "closed ‹date›" line. A shared
   link shows a return with no "when". Put the close date back on the card (follow-up; main owns the strip).
3. Mixed date formats in one status line: "Last close Nov 1 · not updated since Sep 27, 2026". Use one form per line,
   with the year on both or on neither.
4. "Account 2 of 2 · Account removed Oct 28, 2026" says "Account" twice. The plan's form was "Account 2 of 2 removed
   Oct 28, 2026".
5. "Disconnected / Nov 1, 2026" breaks across a line at 360 px. Keep each date on one line with a non-breaking space.
6. The cards' "Too early to tell" and the profile's "Past results: unclear" read as verdicts on a record. They are out
   of scope here and belong in the F-12/F-19 follow-up.
7. Reviewer check to add: a rerun of the 360 px screenshots after the fixes. The QA set predates commit c2ce17f.

Demo sentence: "Every label tells you exactly what you're looking at. Demo says Demo, old trades show their year,
and a disconnected record says it's frozen."
