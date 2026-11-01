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

## User test: UX lead

Method: Playwright on the production server (:3210) at 360×740 (spot checks at 320×740 and dark), signed out
(feed, pane, `/u/momentum_maya`, its trade and `2026-10` month, `/t/NVDA`, `/t/compare?a=NVDA&b=AMD`, and the
`qa2_frozen`, `qa2_idle`, `qa2_failed`, `qa2_two`, `qa2_removed1` fixtures), and signed in as momentum_maya.
Screenshots read, plus DOM checks (scroll width, F3 line position, tap sizes, Tab order, `0.0%` colour).

**Verdict: PASS.** No horizontal scroll at 360 or 320 in light or dark. The F3 line is in the first viewport on
every signed-out route, it is muted and small (#6b6b78 light, #8b8b98 dark), and it never sits under the nav. The
frozen card says "Disconnected Nov 1, 2026 · record frozen" without "Connected". A live profile reads "Last close
Oct 29 · updated 2 hours ago (Nov 1)" in `<time>`. The failed note is amber with a warning sign, not red. `0.0%`
is in the body colour. The month page has no verdict and reads "One of 3 months on record". Tab order goes skip
link, nav, back link, record, Share, Feed.

What confused or stopped me (all non-blocking):
1. **Trade and month "whole record" box:** all four facts run on one line ("Record since … · Connected … · Last
   close … · not updated since …"). The profile splits them into two lines, so do the same here.
2. **Pane:** the F3 line sits right on top of "Since first closed trade…", so it reads as a caption to that
   sentence. Add a top and bottom margin, or put it after the stat tiles.
3. **Demo repetition:** "Not from a real broker" appears twice in the first screen of `/t/NVDA` (explainer and page
   note), and twice per column on compare. The trade page shows the Demo badge twice within 50 px. Say it once per
   section.
4. **Baseline wording:** "average per trade, 95% range (-3.4% to +3.3%)" promises an average and then shows only a
   range. Use "95% range of the average per trade (…)".
5. **Years:** one line mixes forms ("Record since Oct 30, 2026 · … Last close Nov 1"). Use one form per line.
   Profile rows still show `10/29/2026`.
6. **Single account removed (`qa2_removed1`):** the record says "updated 3 hours ago" with nothing connected. Say
   that no account is connected, or treat the record as frozen.
7. "Account 2 of 2 · Account removed Oct 28, 2026" repeats "Account". The plan's form was "Account 2 of 2 removed …".
8. **Owner's own profile:** the action buttons push the figures and the F3 line below the fold (F3 at y=879). It is
   fine because nothing is shown above it, but check it once F-4 settles.
9. **Tap targets under 44 px (already there before this fix):** nav links (21 px tall), "← @handle's record" and
   "← Feed" on trade and month (20 px), and the chart dot links (12×12). Main's `tap44` is not applied to these.
10. **Fixture data:** `qa2_idle` shows a close after its last sync, which reads as a contradiction. Real data can't
    produce it, so fix the fixture.

## Follow-ups recorded in the final fix round (not in this branch)
- Feed card close date: main's record strip replaces the "closed ‹date›" line, so a card shows a return with no date
  (business lead 2). Owner: the strip's feature (F-10/F-12).
- "Too early to tell" on cards and "Past results: unclear" on the profile read as verdicts (business lead 6): F-12/F-19.
- Tap targets under 44 px that predate this branch: nav links, "← @handle's record" and "← Feed" on trade and month,
  the chart's dot links (UX lead 9); apply main's `tap44`.
- 200% zoom (180×370) horizontal overflow (QA round 1 #14, round 2 #14): wrap the nav and tabs, clamp() the headings.
- The nav link "Publish your trades" is cut at 320 px (QA round 2 note 7).
- The `qa2_idle` QA fixture shows a close after its last sync, which real data cannot produce (UX lead 10): fix the
  fixture script, not the product.
- The mixed-stock note ("Includes Demo trades, marked Demo…") still repeats per section on `/t/[symbol]`; the Demo
  sentence is said once (N9), the mixed one could follow the same rule.
- The owner's own profile pushes the figures and the F3 line below the fold with its action buttons (UX lead 8):
  recheck once F-4 settles.

## 2026-11-01: PR #85 review B1 (a flapping vendor list froze a live record)
**Finding.** QA round 2's N7 called a record "record frozen" when every live account had `broker_accounts.removed_at`,
while `connections.disconnected_at` was null. `removed_at` came from one short vendor list (no F3-3 two-list
confirmation) and was never cleared when the account was listed again, so a list that flapped (both → a1 → a2 → both,
or a real plus a simulated account with one list showing only the simulated one) left a healthy, syncing connection
reading "No account connected since ‹date› · record frozen" with no "updated".

**Decision: option (b), with (a).** "Record frozen" comes only from F3-3's confirmed disconnect (`disconnected_at`), so a
flapping list can never freeze a live record; a connection with `disconnected_at` null always shows the live line.
- (a) After every successful, non-empty vendor list, `syncUser` clears `removed_at` for each account the list names;
  the existing guarded stamping stays. A short list now labels only that account's row ("Account N of M removed
  ‹date›"), never the record, until the account is listed again.
- (b) Every live account removed reads "No account connected since ‹date›" on line 1 (no "frozen"), with line 2's
  "updated" (or the idle fact) as on any live record; the feed card and the trade and month images show nothing for
  it (they show a frozen record, or on the card an idle one). The idle count counts such a record when it is idle.
- (c) The pin "no disconnected_at → never frozen, for every input" (lib/record-status-review.test.ts, item 11) is back
  in its stronger form, with every-account-removed cases; the flap repros are lib/sync-removed-flap.test.ts.

Same push (review nits): a partly disconnected record marks the disconnected connection's account rows "Account N of M
disconnected ‹date›"; the owner's share prompt and share card follow the headline figures and their F3 line; the stock
page's summary tiles tighten at 320 px; the C1 route walk runs at 320×740 and covers the owner's own profile.
