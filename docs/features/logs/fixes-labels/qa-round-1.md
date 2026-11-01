# Fixes-labels: QA round 1 (tester)

Branch `claude/fix-truthful-labels` at `68363fc` · 2026-11-01 · production build (`npm run build`, `next start -p 3200`)
against `stock_social_e2e` (seeded). Chromium at 360×740 (also 320×740, 320×568, 180×370 = 200% page zoom, and 360×740 with
root/body font-size 200%), light and dark, signed out and signed in (`/login/dev`), JS on and off.
I made my own fixtures (handles `qa_frozen`, `qa_two`, `qa_removed1`, `qa_idle`, `qa_failed`, `qa_twenty_char_handl`,
`qa_longhandle_twenty`, built the way `e2e/fixes-labels-status.spec.ts` builds them, plus a 2025 close, a flat 0.0% close
and a 280-character thesis). I deleted them afterwards (0 `qa_%` users and 0 `qa-%` broker accounts left).
Scripts, JSON dumps and screenshots are in the session scratchpad `qa/` directory (`walk.cjs`, `feed.cjs`, `colors.cjs`,
`overflow.cjs`, `ys.cjs`, `fixtures.mjs`).

## Checks run
- `npm test`: 1108 tests, 1091 pass, 0 fail, 16 skipped, 1 todo (the owner's H4).
- `npx playwright test -c playwright.local.config.ts e2e/fixes-labels.spec.ts e2e/fixes-labels-status.spec.ts`: 10 passed.

## What passes (evidence)
- **1 Demo is never "verified".** Main text, `<title>`, meta description and `og:image:alt` all pass on `/u/momentum_maya`,
  its trade page (`demo-momentum_maya-0-s`), its month page (`2026-10`) and `/t/NVDA` ("NVDA Demo trades · Stock Social";
  "6 Demo closed trades in NVDA, not from a real broker…"). `/t` index: "Trades by stock · Stock Social" and a Demo
  description. Feed cards of the demo traders show the Demo badge, and their panes contain no "verified". Images (read
  by eye): the stock image says "Demo data" above NVDA, and the trade and month images say "Demo data". There is no
  "verified" in any of them. The exceptions are findings 1 and 2.
- **2 Dates.** Every non-2026 date carries its year: "closed Mar 14, 2025" on the trade page and image, "Mar 14, 2025" in
  the month list and as the chart's first close in the pane, and "Record since Dec 28, 2025". Image dates always carry
  the year ("closed Sep 3, 2026", "Disconnected Nov 1, 2026"). Profile chart: "+47.2% · All time · last close Nov 1",
  `.chart-ends` "First close Sep 3, last close Nov 1". Pane JSON `status` has absolute dates with the year and no
  "ago", "updated …" relative or "yesterday".
- **3 `/t/NVDA` baseline.** No above/below/difference/sits/geometric/"all other" words. Both lines carry a range
  (but see finding 3 on the label).
- **4 Month page.** No "Past results:" on the month page or its image. "1 of 3 months on record" appears on the page and
  the image, "The only month on record" for a single month, and the range is "+0.6% average per trade (-1.5% to +2.8%)
  · 95% range".
- **5 Disclaimer.** The exact text appears at 360×740, inside the viewport with no scrolling, and `elementFromPoint`
  returns the line itself. Top–bottom y: `/` card 602–643, open pane 473–512 (Demo 504–544), profile 453–493, trade
  550–589, month 647–687, `/t/NVDA` 539–578, `/t/compare` 292–331. Contrast is 5.03:1 light on bg, 5.25:1 light on
  surface, 5.84:1 dark on bg and 5.35:1 dark on surface. The e2e covers the raised sign-in and Undo bars, and that test
  passes. Exceptions: findings 4 and 5.
- **6 Disconnected record.** These all show "Disconnected Nov 1, 2026 · record frozen" and no "Connected": the profile,
  the pane (JSON and SSR: "… · Last close Nov 1, 2026"), the feed card (between hero and thesis), the trade and month
  pages ("Record since Mar 12, 2025 · Disconnected Nov 1, 2026 · record frozen · Last close Nov 1"), and the trade and
  month images (muted line). Frozen wins over idle: the record was synced 40 days ago and shows no idle fact. A
  single-account removal shows "Account removed Oct 25, 2026". Two accounts show "Account 1 of 2 · Fake Brokerage" and
  "Account 2 of 2 · Account removed Oct 28, 2026". Idle at 35 days: the card shows "Not updated since Sep 27, 2026" and
  the profile line 2 shows "Last close Nov 1 · not updated since Sep 27, 2026". A live, fresh card shows no status
  line. Profile `<time dateTime="2026-11-01T09:58…" title="Nov 1">2 hours ago</time>`.
- **7 Demo profile line (#6).** Now "Record since Sep 2, 2026 · Demo data", with no "Only trades from connected accounts".
- **8 320 px.** Demo pages and fixtures at a normal name length have no horizontal scroll (scrollWidth 320). A 20-char
  handle with a 40-char spaced name fits at 360 and 320 on the profile, card and pane.

## Findings

1. **major · spec: the feed's meta description says "Verified" over a feed of Demo cards.** `/` has the `<title>`
   "Stock Social" and the description "Verified trades, straight from the broker. Losses included." Plan AC3 lists `/`
   in the Demo scan (title and description). The e2e AC3 test dropped `/` and only checks the pane text. Suspect:
   `app/layout.tsx:11` (the root metadata, which `app/page.tsx` inherits). It also shows on every page that does not set
   its own description.
2. **minor · spec: AC3's compare fixture changed, and `/t/compare?a=NVDA&b=AMD` is "mixed".** One real AMD trade from
   `share_card_owner` (left in the shared DB by another spec) makes the page "closed trades, includes Demo". Its overlap
   line reads "No trader has closed verified trades in both yet." That is literally true, but a Demo trader closed both,
   and the page tells the reader nothing about that. The e2e switched to NVDA/AVGO
   (`e2e/fixes-labels.spec.ts:303-304`), so the plan's NVDA/AMD case is untested. The plan has no `mixed` overlap
   string: suspect the `compareOverlap` use in `app/t/compare/page.tsx` and `lib/copy.ts` (FIXES_LABELS `compareOverlap`).
3. **major · bug: the baseline's "per-trade range" is not a per-trade range.** On `/t/NVDA` the baseline reads "6 closed
   trades in NVDA by 1 trader: per-trade range (-3.4% to +3.3%)". That range is the 95% range of the average, identical
   to the headline "-0.1% avg return / trade (-3.4% to +3.3%) · 95% range". The dot plot on the same page says "range
   -2% to +6%", the real spread of the trades. Two different numbers are both called a trade range, and "per-trade range"
   mislabels the confidence range, which is the kind of label this PR exists to fix. Suspect: the `baselineThis` and
   `baselineOthers` copy in `lib/copy.ts:331-332` (plan §2). Suggest "95% range of the average".
4. **major · spec: the trade page's F3 line drops below the fold when the trade has a thesis.** For
   `/u/qa_twenty_char_handl/trade/qa_twenty_char_handl-0` (a 280-char thesis) at 360×740, the trade figure "+41.0%" sits
   at y 222. The thesis blockquote runs y 327–535, and the disclaimer sits at **y 798–837, out of view**. At 320×740 it
   is at 821–880, and on the Demo month page at 320 width at 729–788. After the F-12 merge, the line lives under the
   record strip (`app/record-strip.tsx:36`), not as the last line of "This trade" (plan §3 D-09, AC8). The e2e now
   scrolls the strip to centre before it asserts (`e2e/fixes-labels.spec.ts:75-77`, `recordInView`), so "in plain view
   without scrolling" is no longer tested. Suspect: the "This trade" box in `app/u/[handle]/trade/[sellId]/page.tsx`
   (thesis before the record section). Screenshot: `ys_u_qa_twenty_char_handl_trade_qa_twenty_char_handl-0.png`.
5. **major · bug (pre-existing cause, cycle-2 #18): an unbroken 40-char display name pushes the card's F3 line off
   screen.** Display name "Www…w" (40 chars, allowed by `users.display_name`): the feed card widens (row scrollWidth
   947–999 instead of 720). The card disclaimer becomes one line that runs past the right edge (inView false, the
   bottom-right point hits nothing), and the pane starts at x 380. The profile scrollWidth is 1110 at 360. Suspect:
   `app/globals.css:100` `.card .who` and the profile `h1` have no `overflow-wrap: anywhere` / `min-width: 0`.
   Screenshot: `feedcard-qa_longhandle_twenty-light-360-nojs.png`.
6. **major · bug: Connected count includes a removed account.** `qa_two` shows "Connected: Fake Brokerage (2
   accounts)" directly above "Account 2 of 2 · Account removed Oct 28, 2026". `qa_removed1` shows "Connected: Fake
   Brokerage (1 account)" above "Account removed Oct 25, 2026", with zero live accounts. The same text appears in the
   pane JSON, on the trade and month pages, and in the pane. The e2e pins the "(2 accounts)" text
   (`e2e/fixes-labels-status.spec.ts:162`). Suspect: `lib/record-status.ts:106`, which passes `f.accounts` (all
   confirmed accounts) to `connectedLine` instead of the live, non-removed ones, as the partial branch at `:104` does.
7. **major · spec (#25): a failed import is still painted in loss red.** `.record-failed` has class `down`, computed
   rgb(190,18,60) light and rgb(244,63,94) dark, on the feed card, the pane, the profile, and the trade and month pages
   (the strip's note). Only the strip label "Import did not finish" is muted, and the image uses amber. Suspects:
   `app/ui.tsx:65`, `app/pane.tsx:57`, `app/u/[handle]/page.tsx:209`, `app/record-strip.tsx:31`.
8. **major · spec (#19): flat 0.0% is still loss- or gain-coloured and announced as "Gain".** On the trade page
   `/u/qa_frozen/trade/qa_frozen-5` (return exactly 0), the figure is uncoloured but its sr-only text is "Gain"
   (`app/u/[handle]/trade/[sellId]/page.tsx:71`). The month list and best/worst show "Gain 0.0%"
   (`app/u/[handle]/month/[ym]/page.tsx:63`, `:105`; Demo AMD +0.0005 on Oct 19). In the pane's last-5 list, 0.0% is
   `down` (red) (`app/pane.tsx:92`; also `:53`). In the profile list it is `down` for exactly 0 and `up` (green) for
   0.0005 (`app/u/[handle]/page.tsx:334`). On the feed card hero it is `up`/`down` by sign (`app/ui.tsx:68`). Use
   `tone()` and `toneClass` (lib/format.ts), and make the sr-only word "Flat" or omit it when the figure is 0.0%.
9. **minor · spec: the absolute date beside the relative time is only in `title`.** The profile shows "updated 2 hours
   ago" with the date only in `title="Nov 1"`. F-11 AC7 and plan §1 (`{rel} ({abs})`) want the absolute date shown with
   the relative time. A `title` tooltip is not available on touch and is often not read. Suspect: `app/status-line.tsx:11`.
   The e2e asserts the title form (`e2e/fixes-labels-status.spec.ts:168-170`), so either the plan or the test needs
   the UX lead's call.
10. **minor · spec: the month "This month" shows "Too early to tell" instead of "No range yet: k of the 10 separate bets
    needed".** Item 4 and plan AC15 ask for numbers and a range only. "Too early to tell" is an evidence verdict phrase
    (it shows for every fixture month with under 10 bets). This comes from F-12's strip after the merge, and the e2e regex
    now allows it (`e2e/fixes-labels.spec.ts:291`). `monthNoRange` is unused on the page.
11. **minor · usability: the month page says "Demo data" twice in a row.** "Record since Sep 2, 2026 · Demo data" is
    followed directly by the strip label "Demo data" (`/u/momentum_maya/month/2026-10`; the trade page is the same for
    broker records: "… · Connected …" then "Verified from broker").
12. **minor · spec (#6 sibling): Demo surfaces still say "connected accounts".** On a Demo pane: "Closed trades from
    connected accounts are published, losses included." (`app/pane.tsx:97`). On a Demo month page: "Recaps list the
    month's closed trades from connected accounts, and none can be hidden." (`app/u/[handle]/month/[ym]/page.tsx:113`).
13. **minor · note: "Past results: …" verdicts remain outside the month page.** The profile has "Past results: unclear ·
    Evidence: thin (30 bets, 60 days)" (`app/u/[handle]/page.tsx:278`, `lib/trades.ts:455`). `/t/compare` has "Past
    results: unclear" and "Past results: above zero". These are outside D-24's scope but are the same verdict the month
    page dropped.
14. **minor · usability (pre-existing): 200% zoom and text size overflow horizontally.** At 180×370 (200% page zoom), the
    profile scrollWidth is 255, trade 220, month 220 and `/t/NVDA` 247. The offenders are the nav "Publish your trades"
    link, the chart range tabs (1Y/ALL), the trade box h1 and figure, and the by-month table caption. At root/body
    font-size 200% the profile is 613 and `/t/NVDA` 879. WCAG 1.4.4/1.4.10 (cycle-2 #18). Not caused by this PR, but
    the F3 line then sits far below the fold (y 646–1041).
15. **minor · note: the idle wording differs from the plan.** The idle text is "Not updated since ‹date›" (card) and
    "not updated since ‹date›" (profile line 2), where the plan §2 has `idle: 'No sync since'`. Two capitalisations of
    one fact. If the design council settled this wording, the plan should be updated to match.
16. **minor · note: the pane's status line sits low.** For an idle record at 360×740 the pane status line is at y
    692–751, partly below the fold. It is not a compliance line, so this is only a note.
17. **note: the images fit, but the disclaimer wraps to three lines, not the two the plan states.** On the month, trade
    and stock images it wraps at about 750 px ("Not investment advice. / Past performance does not / guarantee future
    results."). The last line is at about y 585 of 630, and nothing is clipped. It fits only because the text column
    is narrower than the planned 1072 px.

Severity count: 0 blocker, 7 major (1, 3, 4, 5, 6, 7, 8), 10 minor or note.

## Resolution (engineer, 2026-11-01)

1. **Fixed.** `app/layout.tsx` root description: "Trading records imported read-only from brokers. Demo records are marked
   Demo. Losses included." (no test asserted the old text). The AC3 e2e scan now includes `/` (title, description,
   og:description); `lib/qa-round-1.test.ts` pins the description.
2. **Fixed.** `FIXES_LABELS.compareOverlap.mixed`: it counts verified traders and adds "Demo trades are not counted here."
   `compareOverlapText` uses the page's kind as is. Mixed cases (0 and 2 traders) added in `lib/fixes-labels-copy.test.ts`.
3. **Fixed.** The baseline lines read "‹n› closed trades in ‹SYM› by ‹t› traders: average per trade, 95% range (a to b)."
   (both sides, the profile's wording). Our unit and e2e tests now assert this wording and that "per-trade range" is gone.
4. **Fixed.** On the trade page the thesis is now its own box after the figures ("Why they made this trade"), in full.
   On phones (≤ 400 px) `.trade-page` and `.month-page` tighten (h1, margins, card padding, the month hero at 1.25rem).
   The month's "month so far" moves into the muted line under the h1. AC8 now asserts the line on the first screen
   with no scrolling, with 15% headroom, at 360×740 and 320×740, on the Demo trade and month pages and on the fixture's
   trade with a 280-character thesis and its month. The C1 walk no longer scrolls on these routes. Main's
   record-strip specs pass.
5. **Fixed.** `.card { min-width: 0 }`, `.card .who` and `.page h1` get `overflow-wrap: anywhere`. A new e2e test uses a
   40-character unbroken name and checks the profile scrollWidth, the card width and its disclaimer at 360 and 320.
6. **Fixed.** `lib/record-status.ts`: when an account is removed, "Connected:" counts only the live accounts, as the
   partial branch does. With none left, the line shows no Connected part. The e2e pin is now "(1 account)".
   Unit tests are in `lib/record-status-review.test.ts`.
7. **Fixed.** `warn record-failed` replaces `down record-failed` in all four places. `--warn` is #fbbf24 dark
   (11.8:1 / 10.8:1) and #92400e light (6.8:1 / 7.1:1). A ⚠ sign with empty alt text is drawn via `::before`, so main's
   exact `toHaveText` checks still pass. No main test asserted `down` there.
8. **Fixed.** `lib/tone-view.ts#toneView` takes the tone from the printed value (tone()). The trade page, month page
   (picks and list), pane (worst, average, last 5), profile (average, open rows, list) and feed hero all use it or
   `toneClass`. The sr-only word is Gain, Loss or Flat. A pure test covers it (`lib/qa-round-1.test.ts`).
9. **Fixed.** A relative time shows its date inside the `<time>`: "updated 2 hours ago (Nov 1)" (`timeText`). The title
   is kept. The e2e asserts the visible form.
10. **Left as is** (F-12's "Too early to tell" stays per the committee). Noted.
11. **Fixed.** On the trade and month pages, `recordSegments` drops "Demo data" from the status line because the strip
    label right under it says it. The profile line keeps it.
12. **Fixed.** `FIXES_LABELS.paneFoot` / `monthFoot`: Demo records read "Demo trades, not from a real broker…".
13. **Fixed.** `/t/compare` prints `compareEvidenceText` (the tier, bets and span; no "Past results: …" verdict). The
    profile is unchanged.
14. **Not fixed (pre-existing).** A `ponytail:` in the FIXES-LABELS CSS block names the overflowing elements and the fix.
15–17. Notes, no change.
