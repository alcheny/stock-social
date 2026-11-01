# F-7 committee review: UX lead (2026-11-01)

**This pass was run by the QA orchestrator itself in the UX-lead role (`team/ux-lead.md`), not by a separate
subagent: the session had no Agent tool.** The app was the existing build on :3100 at 360x640 in Playwright chromium,
with touch on for the mobile walks and fictional filers only. The walks were: a first-time viewer arriving from a
shared profile link, a first-time viewer arriving from the feed (with JS and without), and a signed-in demo trader
(`/login/dev` as `momentum_maya`). Screenshots: `screenshots/ux-*.png`.

## Verdict: DEMANDS

## What confused or stopped me, in plain words
1. **Pane header:** the name is truncated to "Fictio…" next to the Back button and the handle
   (`ux-feed-filer-pane-360x640.png`). From the feed, I didn't know whose record I'd swiped into until I read the
   handle.
2. **Pane top block:** the not-joined line sits below the chart and range buttons. That is by design (Round 5: chart
   above the fold), and the chart is at 463/640 px. But the pane has no "Company insider" and no "Record since · last
   checked" row, both of which the profile has. Switching between pane and profile, the source context comes and goes.
3. **Profile from a shared link:** the first screen is excellent: badges, "Company insider", the not-joined sentence,
   the correction link at 44 px, and the caveat (`ux-shared-link-first-screen-360x640.png`). Then come six exclusion
   sentences and open positions before "Closed trades" (`ux-shared-link-scroll2-360x640.png`). I had to scroll a long
   way to see a single trade.
4. **The average:** +9.7% on the profile, +9.8% on the pane, cards and images. Same record, different numbers.
5. **Dev login with a filer handle:** I got the generic "This page couldn't load … A server error occurred" page
   instead of a message on the form (`tester-dev-login-filer-handle-refused-360.png`). It is dev-only, but an error
   page is the wrong way to say no.
6. **`/public-records`:** it says "write to the address below" and then "Requests open before launch." That is the
   correct sandbox state, but the final link, "Public filing records", has the same text as the page title, so it
   looks like a link to the page I'm already on.
7. **Double tap on a filer card:** nothing happens, correctly. There is no like and the URL doesn't change. No
   confusion.
8. **Signed in:** identical to signed out, with no Follow, Like or CTA. Fine.

## Demands (concrete, testable)
1. The pane header shows the full display name at 360 px. Test it with the 40-character fixture name: the name is
   visible in full (wrapped), and the page doesn't scroll sideways.
2. The trade and month image alt text and twitter:image:alt contain "Public filing" and "has not joined Stock Social"
   (AC 14/34).
3. `/public-records` has its own meta description, with no "Verified".
4. The same rounded average appears on every surface. Add a test for a mean exactly at x.x5%.
5. AC 15: either the pane, trade and month pages render "Company insider" and "Record since … · last checked … ·
   Request a correction or removal →" plus the caveat line, or the committee amends AC 15 to match Round 5 item 4.
   The e2e should assert whichever is chosen.
6. A filer handle on `/login/dev` shows an inline form error, not a 500.
7. *(Recommended, not blocking.)* On the profile, put "Closed trades" before the exclusions, or collapse the exclusions
   into one summary line with a disclosure. Rename the last link on `/public-records` to "How public filing records
   are calculated".

## Usability checks
- Readability: no horizontal scroll on any F-7 surface at 360 px, including the 40-character name, which wraps on
  the profile. The badge contrast test passes, at 4.5:1 or better.
- Tap targets: every new F-7 link is 44 px (correction links, "Filing ↗", "Bought/Sold: filing ↗", "See their record
  →"). Pre-existing undersized controls remain: trade-row links at 20 px, range buttons at 35 px and header links at
  21 px. These aren't F-7's, but they should be logged.
- Keyboard: tab order is logical, and the correction link is reached before the stats. Focus is visible.
- Screen reader: filing links have full names ("Public filing for the ZQMA sale closed Oct 1, 2026, opens another
  site"). The profile image alt reads as a complete sentence. Gains and losses carry their sign and the words
  "Gain"/"Loss", so color is never the only cue.
- States: hidden, removed and empty filers 404. All losses (`pf_qa_long`) shows 0% win rate and losses in red with
  minus signs, and no celebration. With one close (`pf_qa_plain`) it reads "Too early to tell (1 of 5 bets)". With
  the switch off, filer URLs give a plain 404.

## Compliance: FAIL until demands 2 and 3 are fixed; otherwise pass
- POLICY: F3a fails on the `/public-records` unfurl ("Verified trades, straight from the broker") and on the
  trade/month alt text, which lacks the source label. F1, F2, F3, F4, P2, P3, T1, T2 and A1 (for the new controls)
  pass.
- `plan-round2-legal.md` C1-C24: C9 is partial for the same two reasons. The pane showing a close still inside the
  floor needs the committee to confirm it falls outside C17, since the viewer opened the filer. All other conditions
  pass (see `committee-business-lead.md` for the table, which I agree with).
