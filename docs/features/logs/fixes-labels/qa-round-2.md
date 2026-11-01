# Fixes-labels: QA round 2 (tester)

Branch `claude/fix-truthful-labels` at `3178bc0` (after merging main: F-7 public filing profiles, sharded sync, trust
fixes). Tested 2026-11-01 against the production build already running at `127.0.0.1:3210` on `stock_social_e2e`
(`ALLOW_DEV_AUTH=1`). I used Chromium at 360×740 and 320×740 (one 180×370 zoom check), light and dark, signed out and
signed in (`/login/dev`), with JS on and off, and the e2e font config (`e2e/fonts.conf`).
Fixtures: the round-1 set re-created as `qa2_frozen`, `qa2_two`, `qa2_removed1`, `qa2_idle`, `qa2_failed`,
`qa2_twenty_char_han` (40-char spaced name, 280-char thesis), `qa2_longhandle_twent` (40-char unbroken name, 280-char
thesis), plus two F-7 filers made with `e2e/f7-fixture.ts#insertFiler`: `qa2_pub_demo` (fictional, Demo) and
`qa2_pub_real` (not demo). Each filer has 6 closes, one of them flat at 0.0%. I deleted all of them at the end. Afterwards
there were 0 `qa2_%` users, 0 `qa2-%` broker accounts and 0 `f7-qa2%` filers.
The scripts and dumps are in the session scratchpad `qa2/` (the round-1 scripts on port 3210, plus `pub.ts`,
`panes.cjs`, `flat.cjs`, `sum.cjs`).

## Checks run
- `npm test`: 1282 tests, 1254 pass, 7 fail, 20 skipped, 1 todo (the owner's H4). All 7 failures are in
  `lib/auth/send-limits.test.ts` and come from my shell: `SESSION_SECRET is not set`. With it set, that file passes
  9/9, so there are no product failures.
- Playwright against `:3210` (a scratch config plus a port 3000 forwarder for the spec's hard-coded `BASE`):
  `fixes-labels.spec.ts`, `fixes-labels-status.spec.ts`, `fixes-cycle2-trust.spec.ts`, `f7-public-profile.spec.ts`
  and `f7-public-feed.spec.ts` all passed: 29 passed, 0 failed.

## Round-1 findings re-verified
| # | Round 1 | Now | Evidence |
|---|---|---|---|
| 1 | `/` meta "Verified" | **fixed** | `/` description: "Trading records imported read-only from brokers. Demo records are marked Demo. Losses included." No og/twitter description. |
| 2 | compare "mixed" overlap | **fixed** | `/t/compare?a=NVDA&b=AMD`: "No trader has closed verified trades in both NVDA and AMD yet. Demo trades are not counted here." |
| 3 | baseline "per-trade range" | **fixed** | `/t/NVDA`: "6 closed trades in NVDA by 1 trader: average per trade, 95% range (-3.4% to +3.3%)." and "84 closed trades in other stocks recorded here: average per trade, 95% range (-0.5% to +2.3%)." "per-trade range" is gone. |
| 4 | trade page F3 below the fold with a thesis | **fixed** | 280-char thesis trade: 523–562 at 360, 542–602 at 320. Its month: 512–552 / 552–611. Demo trade 483–523 / 530–589. Demo month 503–543 / 550–609. |
| 5 | 40-char unbroken name widens the card | **fixed** | The `qa2_longhandle_twent` row has scrollWidth 720 at 360 and 640 at 320, and the doc is 360/320. The card F3 line is at 602–643, with `elementFromPoint` returning self at 3 points. Profile scrollWidth 360/320. But see new finding 2 (vertical). |
| 6 | Connected counts a removed account | **fixed** | `qa2_two`: "Connected: Fake Brokerage (1 account)" + "Account 2 of 2 · Account removed Oct 28, 2026". `qa2_removed1` has no Connected part: "Account removed Oct 25, 2026". The pane JSON is the same. |
| 7 | failed import in loss red | **fixed** | `.warn.record-failed` is rgb(146,64,14), 6.79:1, in light, and rgb(251,191,36) in dark. This holds on the card, pane, profile, trade and month pages. The strip label stays muted. |
| 8 | flat 0.0% toned and announced "Gain" | **fixed** | Trade figure `<p class="big "><span class="sr-only">Flat </span>0.0%`. That holds for the broker, Demo (0.00046) and public-filing records. Month list "Flat 0.0%". Profile list and pane last-5 0.0% are in text colour (17,17,24 / 244,244,246). |
| 9 | absolute date only in `title` | **fixed** | `<time … title="Nov 1">2 hours ago (Nov 1)</time>`. |
| 10 | month "Too early to tell" | left as is (committee) | Unchanged. Accepted. |
| 11 | "Demo data" twice | **fixed** | Demo month and trade pages: "Record since Sep 2, 2026" then the strip label "Demo data" (once). |
| 12 | Demo says "connected accounts" | **fixed** | Pane: "… Demo trades, not from a real broker." Month: "Recaps list the month's Demo trades, not from a real broker, and none can be hidden." Public month: "… built from public filings …". |
| 13 | "Past results:" outside month | **fixed on /t/compare** | Compare prints "Evidence: thin (6 bets, 58 days)". The profile still has "Past results: unclear · Evidence: thin", as the resolution says. |
| 14 | 200% zoom overflow | **still open (pre-existing, ponytail)** | 180×370: profile 255, public profile 255, trade 212, `/t/NVDA` 247. |
| 15 | idle wording | unchanged (note) | "Not updated since Sep 27, 2026" (card) and "not updated since …" (line 2). |
| 16 | pane status line low | unchanged (note) | Long-name pane status at 835–875 (360) and 930–989 (320). |
| 17 | image disclaimer wraps to 3 lines | unchanged (note) | Fits, nothing clipped (public trade image read by eye). |

## Requested checks
- **F-7 profile has no broker status line: pass.** On `/u/qa2_pub_demo` and `/u/qa2_pub_real`, and on their trade and
  month pages, the main text contains no "Connected", "Disconnected", "updated" or "sync". The line reads "Record
  since Sep 4, 2026 · last checked Nov 1, 2026 · Request a correction or removal →", and the pane JSON has
  `"status":null`. The only match for "connected" is the F-7 sentence "…has not connected a broker…".
- **Pane matches the profile on the 95% range and "New record": pass.** I compared profile and pane text for every
  fixture. The range strings are identical, for example `+7.6% | avg return / trade | (-25.3% to +40.4%) · 95% range`
  (frozen), `(-63.1% to +45.5%)` (idle), `(+0.4% to +1.3%)` (Demo) and `(-21.3% to +20.9%)` (public). "New record" shows
  on both or on neither: both for the broker fixtures, neither for Demo and public. The e2e TR-9/TR-7 test also passes.
- **Disclaimer on the first screen at 360 and 320: pass except new findings 1 and 2.**
  - Feed card: 602–643 at 360 and 582–643 at 320. That holds for every card, signed in and out, JS on and off.
  - Demo, broker and long-name panes: in view at 360 and 320.
  - Demo profile: 453–493 (360) and 496–535 (320).
  - Trade and month pages, including the long-thesis trade and its month and the public trade and month: in view at
    both widths.
  - `/t/NVDA`: 539–578 / 605–644. `/t/compare`: 292–331 / 315–354.
  - Contrast 5.03:1 on bg and 5.25:1 on surface.
- **No horizontal scroll at 360 with a 40-char name: pass.** This holds on the profile, the card row (720 = 2 panes),
  the trade page and the pane, for both the spaced and the unbroken name. It also holds at 320.
- **Failed import uses the warn style: pass** (row 7 above).
- **Flat 0.0% tone: pass** (row 8 above). No 0.0% is coloured loss or gain anywhere I looked: profile, pane, trade,
  month, and the public filer's list.
- **Demo is never "verified": pass.** I checked the `/` meta, and the main text, title, description and og:image:alt
  of the Demo profile, pane, trade, month and `/t/NVDA`. Demo image alts say "Demo data" or "Demo · Public filing".
  The only "Verified" on the Demo profile is in "Similar trades" cards of real broker fixtures, which is correct.

## Findings

1. **major · spec: on a public-filing (F-7) record, the swipe pane's F3 line drops below the fold.** The pane puts
   the F-7 block between the chart and the disclaimer. That block is the not-joined sentence plus "Request a correction
   or removal →", 160 px at 320. Measured positions:
   - `qa2_pub_demo` and `qa2_pub_real` at **320×740 signed out**: the disclaimer is at **731–790** (inView false). The
     public line is at 567–727.
   - At **360×740 signed in**: **704–743**, past the 740 bottom. The "…Not interested" actions row adds 44 px.
   - At 360 signed out: 652–691. That is in view, but with under 7% headroom.

   Broker and Demo panes are fine (473–617). The C1 e2e does not cover a public pane. Suspect: the public-line
   placement in `app/pane.tsx`. Put the disclaimer before the public line, or shorten the line in the pane and keep
   the full sentence below it. Screenshot: `qa2/pane-qa2_pub_demo-320.png`.
2. **major · spec: the profile's F3 line drops below the fold at 320×740 for public-filing profiles and for long
   display names.** Measured positions:

   | Profile | 320×740 | 360×740 |
   |---|---|---|
   | `/u/qa2_pub_demo` | **796–835** | 687–727 (in view, under 2% headroom) |
   | `/u/qa2_pub_real` | **773–812** | |
   | `/u/qa2_twenty_char_han` (40-char spaced name) | **719–759** | 657–697 |
   | `/u/qa2_longhandle_twent` (40-char unbroken name) | **766–805** | |

   Layout at 320:
   - The public profile's h1 "Fictional Filer QA Two" takes two lines (93–186). The F-7 `.public-top` block takes
     276–503, ahead of the stats.
   - The long names take 3–4 lines of h1 (93–279 and 93–325).

   Round-1 fix 4 tightened the h1 at ≤ 400 px only for `.trade-page` and `.month-page`, not for the profile. The
   C1/AC7 walk only covers profiles at 360. Suspect: `app/globals.css` (no ≤ 400 px rule for the profile h1) and the
   order in `app/u/[handle]/page.tsx`, where `.public-top` sits before the stats and the disclaimer.
3. **minor · spec: the root description now overclaims the source.** The `/` text reads "Trading records imported
   read-only from brokers. Demo records are marked Demo." Since the F-7 merge, the feed also carries records built from
   public filings (badge "Public filing", card line "Company insider · from a public filing"). Those are not imported
   from brokers. With `PUBLIC_TRADERS` on, the meta misdescribes some cards. Suspect: `app/layout.tsx` root metadata.
   For example: "…from brokers or public filings, each labelled…".
4. **minor · usability: the public trade page's F3 line has little headroom.** On
   `/u/qa2_pub_demo/trade/pub%3Aqa2_pub_demo%3A0` the line is at 633–673 at 360 and 656–715 at 320. It is in view, but
   it fails the 15% headroom that AC8 asks of the Demo and fixture trade pages. The F-7 block and "Bought: filing ↗ /
   Sold: filing ↗" sit above "This trade". AC8's e2e does not include a public trade.
5. **note: a failed import still reads "Connected".** `qa2_failed` (connection `state='failed'`) shows "The import did
   not finish, so this record may be incomplete." and then "Record since Oct 30, 2026 · Connected: Fake Brokerage (1
   account). Only trades from connected accounts are shown." This is the F-11 design and was not raised in round 1.
   The UX lead should confirm it.
6. **note: the public pane shows no open positions.** The profile does show them. The pane JSON has `"open":[]` for
   `qa2_pub_demo`, while the profile lists ZQXQ with the no-price sentence. This is probably intended (F-7 AC19 names
   the profile), so it is listed here only to confirm.
7. **note (pre-existing): the nav link "Publish your trades" is clipped at 320.** It shows as "Publish your trad"
   (screenshot `qa2/pane-qa2_pub_demo-320.png`). There is no scroll, but the link text is cut off. It is the same
   element as round-1 #14.

Severity count: 0 blocker, 2 major (1, 2), 2 minor (3, 4), 3 notes.
**Not clean:** the round-1 majors are all fixed. The two new majors come from the F-7 merge (public pane, public
profile) and from the profile h1 at 320.

## Resolutions (engineer, final fix round, 2026-11-01)
Tests first: new `lib/qa-round-2.test.ts` (models and source contracts), `lib/sync-removed-again.test.ts` (N2, DB),
`lib/idle-count.test.ts` (N5, DB); our e2e extended (`e2e/fixes-labels.spec.ts`: "QA round 2 (B1, B2, Q4)" and
"QA round 2 (N4)"; `e2e/fixes-labels-status.spec.ts`: "QA round 2 (N7, N8)" with its own `fls_gone` fixture). Main's
tests and expectations are untouched; the F-7 order checks (pane: chart, then the not-joined line; profile: top block
above the stats) still hold.

| # | Finding | Resolution |
|---|---|---|
| B1 (1) | public pane F3 below the fold | `app/pane.tsx`: F-7's line and link (`publicLine`) now follow the F3 line, which sits right after the chart (both orders). A public pane's actions row holds "…" alone, so it shares the badges' line (`.pane-actions.inline`); at ≤ 400 px the feed pane starts 8 px closer under the nav and the chart's margins tighten. Measured (`fl_pub_demo`-shaped filer): signed in 531–570 (360) / 564–623 (320); signed out 510–550 / 543–602. Limit 629 (15% headroom). |
| B2 (2) | profile F3 below the fold at 320 (public, 40-char names) | `app/u/[handle]/page.tsx`: the F3 line right after the headline figures (after the unrealized grid and combined line when open positions exist), before the evidence line; `main.profile-page` tightens at ≤ 400 px (h1 1.25rem, stats margins and tile padding, big value 28 px, F-7 top block spacing). Public profile: 492–531 (360) / 577–617 (320). The e2e walks the public Demo and non-Demo profiles, panes (signed in and out) and trade pages, and the spaced and unbroken 40-char names, at 360 and 320, scrollY 0, 15% headroom. |
| 3 | root description | `app/layout.tsx`: "Trading records imported read-only from brokers and built from public filings. Demo records are marked Demo. Losses included." |
| 4 (Q4) | public trade F3 headroom | `app/u/[handle]/trade/[sellId]/page.tsx`: as B1, the not-joined line and the filing links follow the record's figures and their F3 line (the header's "Public filing" badge stays on top). 440–480 (360) / 440–500 (320). |
| N2 | second removal not re-stamped | `lib/sync.ts`: `removed_at` is written again when it is null or a trade on the account executed after it (a relisting); same guards (non-empty vendor list, never on error, connection still lists an account). |
| N3 | unguarded `statusFor` | `lib/record-status-load.ts#statusForOrNull` (null on error, counts-only log) in the pane route, trade-share and recap loads, and the profile. |
| N4 | `:has()` only | `html.bar-hide` / `html.bar-signin` set by `app/feed-hides.tsx` / `app/feed-gestures.tsx` while their bar is up; the same 96 px rule keys on them. e2e at 360×600 and 360×690: padding 96 px, the card's F3 line inside the card and the row, nothing overflows. |
| N5 | idle count scope | `idleCount(ids, idRange)`, passed `scope.idRange` by `coverage()`; counts only records that would show the idle line (a close, broker, not importing/failed, not Demo or filing, not frozen by removal). |
| N6 | baseline kind on a mixed stock | `baselineKind(summary, others, self)` decides from `self ?? summary`. |
| N7 | all accounts removed reads live | `lib/record-status.ts#recordFrozen`: every live account removed → frozen at the latest removal: "No account connected since ‹date› · record frozen" on the profile, pane, card, trade/month rows and images; no "Connected", no "updated", not idle. |
| N8 | status wording | One date form per line (the year on every date of a line when any needs it); "Account 2 of 2 removed ‹date›"; each date and the word before it joined by no-break spaces (`glued`); trade and month status in two rows (`recordRows`). |
| N9 | Demo repetition | `/t/[symbol]`: the sentence only in the page note (sections keep their badge; "How the trades turned out" gains one); the explainer no longer repeats it; compare: one note per Demo column only when the explainer does not already say it, none in the column's spread; trade page: the Demo badge only in "This trade". |
| N10 | baseline label | "95% range of the average per trade (a to b)". |
| N11 | pane F3 reads as a caption | `.pane [data-disclaimer] { margin: 8px 0 12px; }`. |
| N12 | profile rows numeric dates | `dateText(t.closed_at, now)`; the scrubbed chart head keeps M/D/YYYY (app.spec). |
| 5–7 | notes | Unchanged (F-11 design, F-7 AC19, pre-existing nav clip); follow-ups in the committee file. |
