# F-7 tester pass (2026-11-01)

**This pass was run by the QA orchestrator itself, not by a separate subagent: the session had no Agent tool. The
role followed `team/tester.md`.** Build: branch `claude/f7-public-traders`, the existing `.next` build (no rebuild),
`next start -p 3100` with the e2e sandbox env (switch unset, so on). A second server on `-p 3101` had
`PUBLIC_TRADERS=0`. The DB was `stock_social_e2e`. All data was fictional (`pf_qa_*` filers, `ZQ*` symbols), inserted
with `e2e/f7-fixture.ts#insertFiler` and deleted at the end along with the corrections-log rows, the handle
reservation, the orphan placeholder attempts and the dev sessions it created.

Fixtures: `pf_qa_main` has 8 priced closes. 4 are losses, 7 are 31-49 days old, and 1 is +80% filed 3 days ago and
still inside the feed floor. It has exclusions of 6 kinds and 2 open symbols. `pf_qa_hid` is hidden. `pf_qa_rm` was
removed with `scripts/public-filer.ts remove`. `pf_qa_empty` has no priced close. `pf_qa_long` has a 40-character
name and 5 closes, all losses. `pf_qa_plain` is not demo and has 1 close.

## Verdict: FAIL (2 spec findings block; 1 more should be fixed in this PR)

## Checks run
- `node --test lib/f7-*.test.ts`: 53/53 pass. This run included the working-tree edits another engineer was making
  in `lib/` at the time. It covers AC 1-3, 5-8, 10-12, 23, 24, 29, 32, 33 and 35, including amendments (AC 3: an
  amendment replaces the amended filing's rows, the percent changes, and a double amendment resolves by filed time).
- `e2e/f7-*.spec.ts` against :3100: 14/14 pass.
- Manual walk at 360 px in Playwright chromium, signed out, signed in, with JS and without.

## Findings
1. **spec (blocking): AC 15 is not met on the trade, month and pane surfaces.** AC 15 says the top block on the
   profile, pane, trade and month pages has, in order: the badges and "Company insider"; the not-joined line;
   "Record since … · last checked … · Request a correction or removal →"; and "Filings can be late, amended or
   missing." Only the profile has all four rows. The trade page (`tester-trade-360.png`), the month page
   (`tester-month-360.png`) and the pane (`ux-feed-filer-pane-360x640.png`) have the badges and the not-joined line
   with the link. They have no "Company insider", no "Record since / last checked" and no "Filings can be late"
   line. Plan Round 5 item 4 narrowed this to "the not-joined sentence and the link", and the e2e only checks that.
   Either build the missing rows or have the committee amend AC 15's wording. As it stands, the feature file and the
   build disagree.
2. **spec (blocking): the trade and month share images' alt text and twitter:image:alt carry neither "Public filing"
   nor "has not joined Stock Social".** They read "One closed trade on Stock Social, with the full record" and "A month
   of trades on Stock Social, with the whole record". This breaks AC 14 (labels on every surface, including the share
   card) and Round 5 item 4 ("the share image alt … carry the line"). The images themselves are correct: they show
   "Demo · Public filing" and the not-joined line at 26 px. The profile card alt is correct.
3. **spec (fix in this PR): `/public-records` unfurls as "Verified trades, straight from the broker. Losses
   included."** That is the site default description, used on the one page that explains these records are *not*
   from a broker (C9, POLICY F3a). Give the page its own description.
4. **bug (low, dev stub only): dev login with a filer handle (`pf_qa_main`) shows the generic error page.** The page
   reads "This page couldn't load … A server error occurred" and the server logs `Error: That handle is reserved`. No
   session is created, so AC 7 holds. The refusal should be a form error, not a 500
   (`tester-dev-login-filer-handle-refused-360.png`).
5. **bug (low, probably pre-existing): the average differs between surfaces when the mean is exactly x.x5.** For
   `pf_qa_main` the true mean is 9.75%. The profile stat shows +9.7%, while the pane, the feed and trade pages, the
   meta description and the share image show +9.8%. Use one rounding function everywhere.
6. **note (for the committee): the feed pane shows the close that is still inside the floor.** This is one swipe from
   the feed card. The +80% close filed 3 days ago appears in the pane chart and in "Last 5 trades". The feed list
   correctly leaves it out. Under Round 4 item 7 ("a viewer who did not open that filer") a swipe probably counts as
   opening the filer, so this is likely compliant. Confirm.
7. **note: the month page heading "All trades this month" reads as a completeness claim for a filer** (POLICY F3a;
   filings can be missing). Suggest "Closed trades this month" on public records. The line below it is already
   qualified.
8. **usability (pre-existing, not F-7): these controls are under 44 px:** closed-trade row links (20 px), the chart
   range buttons (35 px) and the header links (21 px). Every new F-7 link measures 44 px.
9. **note: AC 23 retention.** A removed `public_filers` row still keeps `filer_key`, `demo`, `created_at` and empty
   `excluded`/`open_symbols`. AC 23 says "only the filer id, source and removal time". `filer_key` is needed to block
   re-import, but `created_at` and `demo` are extra.
10. **note: on `/public-records` the last link, "Public filing records", has the same text as the page title.** It
    goes to `/how#public-filings`. Suggest "How public filing records are calculated".

## Passed (observed on the running app)
- AC 9: switch off. With `PUBLIC_TRADERS=0` on :3101, every filer route (profile, pane, story, share image) 404s.
  The feed (3 server pages walked) has no `pf_` handle. `/public-records` and `/how` still work.
- AC 9 and 23: hidden, removed and no-priced-close filers 404. Hide removes the filer from the feed and unhide
  restores it (operator CLI). Remove deletes the users row and the raw rows, logs `remove/request`, and reserves the
  handle.
- AC 14 and 13: "Public filing" plus "Demo" on the profile, feed card, pane, trade, month and all three images. The
  non-demo filer shows no Demo badge. There is no `.badge.verified` and no "Verified" text in `main` on any filer
  surface. The pane JSON has no `verified: true`.
- AC 16: 8 filing links, each 44 px, `target=_blank`, with the accessible name "Public filing for the ZQMx sale closed
  …, opens another site". The trade page links both the buy and the sale filings.
- AC 17: none of the raw amounts (4321, 4,321, 98.76) appear in the profile, trade, month, pane or `/public-records`
  HTML, the meta tags, the alt text or the pane JSON.
- AC 18 and 19: the 6 exclusion reasons are listed with counts. Open positions show "ZQMO, ZQMP" with the
  no-price sentence and no percent.
- AC 20 and 21: with JS off, the filer is on feed page 1 with the card line "Company insider · from a public filing"
  and "See their record, wins and losses →". The embargoed ZQMZ is not on any card. With JS on, the card is the 4th
  row. The pane chart's bottom is at 463 px of 640, above the fold. A double tap does nothing and shows no like mark.
- AC 22: `/t`, `/t/ZQMA`, `/t/compare` and the ticker image don't mention the filer. The sitemap has no `pf_` handle.
- AC 25 and 28: the signed-in demo trader (`momentum_maya`) sees exactly the same `main` text as a signed-out
  visitor. There is no Follow, Like, thesis, share prompt or join CTA.
- AC 26: the footer disclaimer is on every page, the `/how` section exists, and there is no horizontal scroll at
  360 px on any surface, including the 40-character name.
- AC 30: `noindex, nofollow`.
- AC 31: no "New record" badge.
- AC 34: on the profile, the description, og:description and og:image:alt carry "Public filing" and "has not joined
  Stock Social". None of them says Verified or shows an amount.
- AC 35: "last checked Nov 1, 2026" with no stale line, because the import state is fresh.
- Keyboard: Tab goes skip link → nav → "Request a correction or removal" → "What's this?" → chart → range buttons →
  trade rows. Focus is visible.

## Not exercised live
- AC 27 (size cap) and the live importer (AC 11, 33) are covered by unit tests only.

Screenshots: `docs/features/logs/F-7/screenshots/tester-*.png`.
