# Business lead review, round 1: F-25, F-26, F-27, draft-notes (2026-11-01)

Checked against: CLAUDE.md, POLICY, DESIGN Stage 5 (TR-1, SW-1), F-2, F-9, F-10, F-11, F-20, and the code on main 06edbdf.
Citations verified: app/ui.tsx:57 (thesisLine), :75-99 (card links), :83 (`down record-failed`); app/t/[symbol]/page.tsx:178-183
(rows link to /u/h); Spread.tsx:35 and Timeline.tsx:54 (`--line` baseline); lib/discovery/gestures.ts:10 (`NOT_TAP` includes `a`);
lib/privacy-fields.ts:31 (`sell_id` "never shown"); db/schema.sql:404 (`trade_key` = generated sha256 of sell_id, indexed);
lib/trade-share-load.ts:16 (trade page already nulls held thesis in SQL); lib/feed.ts:138,174,396 (feed selects raw `thesis`).

## Verdicts
- F-25 one link rule: SIGN WITH CHANGES. Right rule, right placement (footer, not the figure: keeps F-2's double tap). Two gaps:
  it widens a documented privacy rule breach to the highest-reach surface, and its first-screen budget depends on F-26 without
  saying so.
- F-26 no empty-note line: SIGN WITH CHANGES. Removal is correct: the line is false for held notes and costs 18 px on every card.
  Payload enforcement is the strongest part. Drop the process question; extend the leak test to the paging response.
- F-27 colour follow-ups: SIGN WITH CHANGES. Baseline and warn notice are right; the image hue question is correctly the
  owner's. Make the warn notice one component and guard against a double notice on one card.
- draft-notes: SIGN (working notes, not a feature file). Answers to the BL questions below.

## Demo sentences
- F-25: "Tap 'See this trade' on any card and you land on that trade's own page, with the note and a Share button."
- F-26: "Cards with nothing to say say nothing; a trader whose note is held for review is the only one who sees why."
- F-27: "A failed import looks like a warning, never like one more loss, even to a colour-blind reader."

## Scorecard (1-5)
| Dimension | F-25 | F-26 | F-27 |
|---|---|---|---|
| Market demand | 4: the trade page is the share unit; today no feed path reaches it (C3-41, observed in our own build) | 4: CS-6, C3-45 | 4: PR #71 committee follow-ups |
| Ease of adoption | 4: one footer tap; no gesture change (`NOT_TAP`) | 5: removes, adds nothing for viewers | 5: no new step |
| Phase fit | 4: reach of shared trade pages | 4: first-screen budget (F-10) | 4: trust of the record line |
| Revenue impact | 4: more trade-page views lead to more Share taps | 3: indirect (space for F-25) | 3: indirect (trust) |
| Aesthetics & clarity | 4: two stacked muted footer links; acceptable | 5 | 4 |
| Trust & compliance | 4 as drafted (sell_id exposure), 5 with change 1 | 5 | 5 |
| Simplicity | 4 | 5 | 4: four copies of a notice unless made one component |
| Craft & taste | 4 | 5 | 4 |

F-26 and F-27 score 3 on revenue. That is acceptable for hygiene work that clears the bar on trust, but it is why neither should
grow in scope.

## Answers to the UX lead's BL questions
- The stock-page row loses its direct profile link: acceptable. The trade page is the share unit and has the "<- handle's record"
  link, so the cost is one tap for a consistent rule. A reader who wants the trader can swipe on the feed (SW-1).
- The author's held line on their own feed card: show the full `heldLine(rule)`. It appears only on the author's own cards, and
  a short line plus a link adds a step to a message that already fits.

## What I deleted or said no to
- No "Add a note" prompt in the empty slot for the author (it would drive note supply, but it is new scope with no evidence; file
  separately if F-15 shows low note rates).
- No renaming of the holding period ("held 3d"): agreed out of scope.
- No feed-card-wide or figure link (agreed with the UX lead).
- F-25's "others get the same name pattern" clause stays only if its surfaces are listed in the ACs (change 3).

## Required changes
1. F-25: replace the Open question with a decision: "`tradePageHref` builds `/u/<handle>/trade/<trade_key>`; the route resolves
   a `trade_key` first and otherwise a `sell_id`, which it answers with a 308 to the `trade_key` URL. Why: shared links are
   permanent and F-25 puts this URL on the signed-out feed and the pane, and `lib/privacy-fields.ts` lists `sell_id` as never
   shown." Add ACs: "no rendered href or payload on any surface contains a `sell_id`" and "an old `sell_id` URL redirects (308)
   to the `trade_key` URL, and its share image still renders."
   If the engineer sizes this above ~60 lines, split it into F-28 and block F-25 on F-28, but do not ship F-25 on `sell_id`.
2. F-25: the Blocked line must also name F-26, because the footer link is "paid for by F-26" and the pipeline builds in number
   order. Use: "Blocked: waits for F-9 (PR #65, `claude/fix-user-text-safety`), F-11 with F3-8 (branch
   `claude/fix-truthful-labels`, no open PR) and F-26 (removes the empty-note line that pays for the footer link)".
3. F-25: in AC1, replace "the feed, the pane, the profile, the month page and the stock page" with "the feed, the pane, the
   profile, the month page, the stock page (trades and notes lists), similar trades, likes, hidden trades and the new-trades
   prompt". If any of these can't be tested, delete it from the "same name pattern" decision.
4. F-25: replace "Signed out, every link above works" with "Signed out, each trade link returns 200 and the page shows the
   row's symbol and signed % exactly as printed on the row (e2e)".
5. F-25: in the pane decision, change "carry the closing sell's id for the pane's last 5 rows" to "carry the trade's `trade_key`
   for the pane's last 5 rows", and in the AC, change "`sellId` for at most 5 rows" to "a trade key for at most 5 rows".
6. F-26: delete the Open question on the three-version rule and write "None." Q1 already sits on the owner's single list
   (`docs/process/decisions-and-authority.md`). Repeating it in a lane B feature file invites the pipeline to treat F-26 as
   waiting, and F-25, the larger change, does not raise it.
7. F-26: in the viewer-payload AC, add "the feed's next-page response (the paging server action)" to the list, since
   `lib/feed.ts:138,174,396` select raw `thesis` for every card today.
8. F-26: add the AC "the trade page's `generateMetadata` and its share-image route read no session; only the page body reads it
   for the author check (source test, as `lib/feed.signed-out.test.ts`)".
9. F-27: the failed-import notice is one component (`WarnNotice` in `app/`) with one class `.warn-notice`, used at all four
   sites. Replace the source-test AC with "`var(--warn)` appears in `app/globals.css` only inside `.warn-notice` rules", so
   DS-17's later sites reuse the class instead of breaking the test.
10. F-27: add the AC "a failed record's feed card, pane and trade page each render exactly one warn notice (the card line at
    `app/ui.tsx:83` and the strip note at `app/record-strip.tsx:31` never both)", because a box doubles the cost of a duplicate.
11. F-27: replace the "test of the test fixture" AC with "a render test asserts every element styled with `--warn` is a
    `.warn-notice` holding `[data-warn-icon]` and visible words; F-20's colour-blind test exempts only the named warn/loss
    pair".
12. F-27 Out of scope: add "the share image's own `warn` tone (`lib/record-strip.ts` note lines)", so the image palette stays
    wholly inside the owner question.

## Revenue chain (F-25 only; ranges, not forecasts)
Signed-out feed card views × tap-through to the trade page (assume 1-5%) × Share taps per trade-page view (assume 2-8%) =
new shared trade links. Low / base / high = 0.02% / 0.1% / 0.4% of card views becoming a share. Phase 1 value is reach, not
cash. The figure is most sensitive to footer tap-through. Cheapest test: F-15 measurement counts trade-page views by referring
surface for two weeks after merge. If tap-through is below 1%, the footer link is in the wrong place, and the figure-as-link
debate (option 1) reopens with data.

## What would change my mind
- F-25 change 1: if the engineer shows `trade_key` lookups break existing likes or shares, or cost more than a split feature.
  Then do F-28 first; still do not ship on `sell_id`.
- F-26: if F-15 shows viewers read the empty line as a trust signal (no measurement exists; I don't know). Absent evidence,
  removal stands.
