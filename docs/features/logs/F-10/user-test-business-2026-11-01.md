# F-10 / F-12 business lead user test, 2026-11-01 (360 px, signed out and in; screenshots in ./screenshots)

Recorded by the orchestrator from the business lead's reply (the business lead has no write tool).

## Verdict (business lead, verbatim)
F-10/F-12 now do their job: every feed card, trade and month page, and every image puts the trader's whole record (count,
average, labelled 95% range, Demo badge, disclaimer) right under the single result, with the same numbers and words
everywhere. One blocker: the month page shows the trade count as its hero and the month's result at body size, so a
losing month's loss is the smallest thing on a page built to be shared; make the result the hero. Non-blocking: neutral
tone when the range crosses 0 (on every surface at once), keep "· 95% range" from wrapping alone, cut the triple
"@handle's record" link, fix the image word spacing and the stock image's empty gap. Dropping the stock image's pooled
average and range is accepted.

(Note: the verdict's "whole record" is the reviewer's own wording, not product copy; the product never says it.)

## Demands and what was done
1. BLOCKING: month result as the hero. Done: "This month" leads with the month's figures strip at 1.75 rem (the average in
   its tone, or "Too early to tell" at the same weight), the count line under it in small muted text. e2e: the figures'
   font size is larger than the count's (`e2e/record-strip.spec.ts`, month test).
2. Non-blocking, follow-up for the design system: neutral tone when the 95% range crosses 0. Not changed here: the tone
   follows the profile's (printed sign), and the profile and every surface must change together (design system council,
   #48). Recorded as a known limit.
3. Non-blocking: done. "· 95% range", "· losses included" and the open count never wrap away from their separator
   (`white-space: nowrap` per part); a no-break space before the card link's "→".
4. Non-blocking: partly done. The month page's second "See their record, wins and losses →" link is removed (as on the
   trade page); the trade page's return carries its up/down tone. The strip's own "@handle's record" link stays (F-12 AC1
   requires it in the strip); the back link and heading stay (navigation and section name).
5. Non-blocking: not done here. Image word spacing (the renderer's built-in font, F-4 2026-11-01: no font file) and the
   stock image's vertical gap (the disclaimer sits at the band's foot by design so a crop keeps it) are recorded as
   follow-ups. "Includes sample data" on the stock image stays: a pooled stock mixes demo and real records, which
   "Demo data" would misstate.
