# Stock Social — Decision Log (master doc)

Every product change is built as **three competing versions** (A/B/C), each with its own direction,
design and business bet (see `docs/AUTOPILOT.md` → Variants). In human mode you pick one with
`/choose <why>` or discard all with `/reject <why>`; in auto mode the AI judge picks. Each decision is
recorded here automatically, **including the options that lost**, so future work knows what was tried
and why it wasn't chosen. Every entry says who decided.

**Precedent order:** Standing direction (below) > decisions by a human > decisions by the AI judge.

**How agents use this file**
- **Planner:** proposes variant directions that build on chosen ones and avoids re-proposing rejected
  directions unless something has changed (new data, a new phase). Cites entries by issue number.
- **Builders:** interpret their variant brief in the light of these precedents.
- **Judge (auto mode):** picks the version that best fits this file and DESIGN.md, weighting human
  entries above its own.
- **Reviewer:** not used: reviews judge correctness and rules, not direction.

Only the Choose and Judge workflows and humans edit this file (it is a protected path).

## Standing direction

Human-curated. Distill patterns from the log here as they emerge. Agents treat this section as the
strongest signal after `docs/DESIGN.md`'s rules.

1. **Supply before demand.** Features that help traders prove themselves and share beat features that
   entertain viewers, until the week-8 supply gate passes (DESIGN §3.5).
2. **Trust is the brand.** When a version trades credibility for engagement, it loses: losses stay
   visible, Verified means broker-sourced, numbers are never inflated.
3. **Fewest moving parts.** No new vendors or infrastructure without a measured need (DESIGN §2.1).
4. **Mobile, signed-out, one glance.** Everything a shared link lands on must work on a phone, without
   an account, readable in one look.

## Log

### 2026-10-15 · #11 Confidence interval on performance (TR-9): confidence() and honest headline dis… → chose A (Inline honesty (profile headline))

**Decided by:** human (@alcheny) · **Why:** font and color design are better. needs to standardize the profile from clicking and the profile from swiping from a trade in the feed

| | Option | Direction | Business bet | Trade-offs | PR |
|---|---|---|---|---|---|
| ✅ | A · Inline honesty (profile headline) | Inline honesty: the range sits beside the average return and one evidence line follows it. Record-since, connected broker and the New record badge are quiet labels under the name. Honesty is folded into numbers viewers … | A visitor reads the evidence qualifier in the same glance as the return. That is the strongest trust signal at zero attention cost, and it works on shared links. Lucky small samples can't top the feed, because ranking u… | - The range is dense text on a 360px screen, and the evidence line is easy to skim past. - There is no big visual meter. Skeptics have no single scannable proo… | #49 |
| ✖ | B · Trust panel (dedicated section) | Trust lives in one scannable dedicated panel, not in the headline numbers or the feed. | Skeptics get all the proof in one place, and the panel shows traders what longer, full-history connection unlocks (more independent bets, a higher tier). The meter counts bets, not trades, so frequency earns nothing. Th… | The range is one scroll away from the headline average, so a skimmer can still read the bare number first. The panel adds vertical height on mobile. The feed g… | #51 |
| ✖ | C · Trust in the feed (ranking-first) | Credibility at first contact: trust lives in the feed ranking and in compact evidence chips on feed cards and the share card. The profile stays minimal. | Shared links and the feed are where strangers first judge a trader. Showing evidence and ranking by a lower bound there protects the brand promise, discourages lucky small samples and frequency gaming, and costs no extr… | The profile is less explanatory than in variants A and B: the pace interval and the method are only in a tooltip. Ranking by the lower bound pushes thin-record… | #50 |

### 2026-10-15 · #39 Swipe left on a feed card to open the trader's profile pane (SW-1) → chose C (Trust)

**Decided by:** human (@alcheny) · **Why:** Easy, navigable

| | Option | Direction | Business bet | Trade-offs | PR |
|---|---|---|---|---|---|
| ✅ | C · Trust | C · Pane sells the record, with a trust lens. The pane leads with the chart, then a plain summary line: "Record since ‹date› · N closed trades · worst trade −X% (SYM)". Every pane shows the worst trade, and a good recor… | The pane is the step before a viewer shares or a trader connects. C bets that a viewer who sees the full record, including the worst trade, converts to a profile visit better than one who sees only a summary. Showing th… | - Persuasion-first panes are heavier than A's summary-only pane, and the chart is a client component rendered per item (up to 50 items). - Showing the worst tr… | #44 |
| ✖ | B · Growth | Discoverability over a hidden gesture. Every card shows the edge of its pane with a real button, so desktop and first-time viewers need no hint, and swipe is a bonus. | A visible affordance should raise the share of sessions that open a pane. It also works with no touch (desktop link clicks) and for first-time viewers on shared links. More pane opens should lead to more full-profile vi… | The 28px strip takes some card width and adds visual noise to every card. The chart's `touch-action: pan-y` means a horizontal drag on the chart scrubs it inst… | #43 |

### 2026-10-15 · #25 Single-line scrubbable profile chart: scrub, range tabs, color by sign (CH-1 redesign) → chose A (Familiar single-line chart)

**Decided by:** human (@alcheny) · **Why:** (merged directly on GitHub)

| | Option | Direction | Business bet | Trade-offs | PR |
|---|---|---|---|---|---|
| ✅ | A · Familiar single-line chart | Use the single-line chart interaction common in mobile investing apps: a full-bleed single line, a scrub-to-read header and range tabs, and nothing else. There are no trade dots, no tooltips and no share button. The bet is that users already know this pat… | Shared profile links land on the chart, so it has to read in one glance on a phone with no explanation. Using the pattern users already know from trading apps makes the record immediately legible. Losses get the same … | - **Dropped features:** This removes the trade-linked points, tooltips and Enter-to-open sheet from the earlier chart (#14 and #21). A viewer can no longer jum… | #29 |
| ✖ | B · Single-line chart + trade markers | Single-line scrubbable chart plus trade markers. One line colored by the sign of the selected range, with a dashed baseline at the range start. A header shows "+x% · Past month". Range tabs run 1W/1M/3M/1Y/ALL. A small green o… | Tying the curve to individual verified trades is the trust signal. A skeptic sees every win and loss as a dot on the line and can name each one while scrubbing. Equal-weight losses stay as visible as gains because the w… | Dots clutter the line on profiles with hundreds of trades and the markers get dense. The open-on-release detail sheet from #21, with thesis and hold time, and … | #30 |
| ✖ | C · Single-line chart + share | Same as A (familiar single-line chart), plus a "Share this range" button. Sharing opens a link whose unfurl card shows the selected range's line and return number, so the chart itself becomes what traders post. | Supply comes before demand (DECISIONS standing direction 1). A range-specific card, such as "+12.4% · Past month", is a more postable artifact than the generic stats card. It should raise shares of profile links, and ea… | - **Hype risk:** letting a trader pick the best range to share invites cherry-picking, such as a green 1W next to a red ALL. The card prints the range label an… | #31 |

### 2026-10-15 · #21 Open each trade by swiping from its point on the profile chart → chose A (Scrub to open)

**Decided by:** human (@alcheny) · **Why:** This scrubbing is exactly what needs to be reflected in the design and documented.

| | Option | Direction | Business bet | Trade-offs | PR |
|---|---|---|---|---|---|
| ✅ | A · Scrub to open | Scrub to open. Dragging horizontally across the CH-1 chart snaps to the nearest trade point, like a stock-app crosshair. Releasing opens that trade's detail sheet. | Scrubbing is the fastest way to scan a whole record. It reuses the crosshair gesture young adults already know from trading apps. A viewer can check dozens of trades in one drag, which should raise trust and time on profile. | - **Hidden gesture:** nothing on the chart says it can be dragged, apart from a one-line hint under it. - **Dense charts:** with 300+ trades at 360px, points s… | #26 |
| ✖ | B · Tap, then swipe through a sheet | One entry gesture (tap a point), then a bottom sheet with room for the thesis. Swiping inside the sheet steps through trades in close order and the chart highlights the active point with a ring. Keyboard: the chart is o… | The thesis is the content we most want read, and a sheet gives it space and attention that a tooltip or a card strip under the chart does not. A single gesture to enter, then swipe, matches the SW-1 swipe habit. It shou… | Two steps are needed (tap, then swipe), so it is slower to scan than scrubbing (variant A). Swiping happens on the sheet, not on the chart itself, so the accep… | #28 |
| ✖ | C · Synced card carousel | Synced card carousel. A horizontal scroll-snap row of trade cards sits under the CH-1 chart. Swiping the cards moves the highlighted point. Tapping a point scrolls its card into view. It uses native scroll-snap with no … | This reuses the feed's card format and the SW-1 swipe habit. It is the most robust option on mobile because the browser handles the scrolling. It supports the standing direction of "mobile, signed-out, one glance", and … | The carousel adds a second view of the same trades under the chart, so the profile gets longer. Dragging across the chart to scrub (variant A) isn't supported.… | #27 |

### 2026-10-15 · #11 Confidence interval on performance (TR-9): confidence() and honest headline dis… → rejected all

**Decided by:** human (@alcheny) · **Why:** Rejected by owner. Not shipping any TR-9 version now; the profile chart redesign (single-line scrubbable chart) comes first.

| | Option | Direction | Business bet | Trade-offs | PR |
|---|---|---|---|---|---|
| ✖ | A · Inline range and evidence line | Minimal and honest: the range sits beside the average return, one bold evidence line sits below the headline stats, and a native details element ("How this is calculated") holds the method and the pace interval. No new … | Plain, unflattering-by-default honesty is the cleanest trust signal. Viewers see both the number and how little or how much stands behind it, and negative edges get the same prominence. Lower-bound ranking keeps small l… | There is no progress cue, so traders can't see what unlocks the next tier (that is variant B). Feed cards show no interval (variant C). Ranking is per trader, … | #24 |
| ✖ | B · Evidence meter for traders | Evidence meter for traders: a progress bar of independent bets toward the next tier (10 / 30 / 100), shown on the trader's own profile, so they see what unlocks the next evidence tier and are pulled to connect more hist… | A visible goal ("7 of 10 bets") pulls traders toward connecting full history without rewarding frequency, because only independent bets count. That should raise supply depth, which is the Phase 1 gate. | The meter is owner-only, so visitors only see the plain evidence line. The meter tracks bets but not the 90 / 365-day span a tier also needs, so reaching 30 be… | #23 |
| ✖ | C · Ranking-centric | Ranking first. The feed sorts traders by the lower bound of their pace interval (return per 30 days invested). A "Most evidence" toggle (`/?sort=evidence`) sorts by independent bets instead. Every feed card carries the … | New viewers land on the feed, so a feed that visibly can't be topped by a lucky 5-trade streak is the trust signal. A "Most evidence" sort rewards connecting full history, not trade frequency, because it counts independ… | Today every demo trader is "too early", so the lower-bound ordering has nothing to separate them and falls back to most bets, then the trade score. The headlin… | #22 |

### 2026-10-14 · #10 Profile performance chart (CH-1) with compounded equal-weight curve → chose C (Interactive, trade-linked)

**Decided by:** human (@alcheny) · **Why:** Interactive chart is much more engaging and increases transparency. Add potential new feature for each trade to be opened by swiping from the points.

| | Option | Direction | Business bet | Trade-offs | PR |
|---|---|---|---|---|---|
| ✅ | C · Interactive, trade-linked | Interactive, trade-linked. Every point on the curve is a keyboard-focusable link to that trade's row in the "Every trade" list. Hover or focus shows a tooltip with the symbol and percent return. | A skeptic can go from the curve to each individual trade and check it against the list. That should raise trust and time on profile. It also fits the "trust is the brand" direction in DECISIONS.md, because losses and dr… | Every trade is a tab stop, so a profile with 300+ trades has 300+ links to tab through. There is no skip link or roving focus. At 360px the on-screen hit targe… | #14 |
| ✖ | A · Faithful trust-first curve | Exactly the spec look, built for credibility and one-glance reading. It has a neutral step line, area above 0% tinted up and below tinted down, a dot per closed trade, and a labeled final value. The max-drawdown trough … | An honest, unflattering-by-design chart (drawdown marked, losses tinted, 0% always shown) is the differentiator against cherry-picked screenshots, and it supports "trust is the brand" on a shared link. | There is no share-card version of the chart (that is variant B) and no interaction or drill-down to individual trades (variant C). The x-axis is time-scaled, s… | #15 |
| ✖ | B · Share-first hero | Share-first hero: the chart is the screenshot-able artifact. A 56px final-return callout sits above the curve, the caption carries trade count and date range, and the same curve is drawn on the 1200x630 share card with … | Shared profile links and screenshots are the supply growth loop (Standing direction 1). Putting the curve and total return on the unfurled card should make shared links more compelling. | A giant total-return number leans toward flattering and is closer to hype than the spec look. Mitigations: the label, 0% axis, tinted losses and the "losses in… | #13 |

### 2026-10-12 · Moderation approach for theses → chose A (Rules + review queue)

**Decided by:** human (design rounds, CEO) · **Why:** Keep the critical path free of a second vendor until supply is proven; at 50 traders rules plus a manual queue are enough. Revisit at 500 traders. (Engineer dissent recorded in DESIGN Stage 3.)

| | Option | Direction | Business bet | Trade-offs | PR |
|---|---|---|---|---|---|
| ✅ | A · Rules + review queue | Regex rules hold risky claims for human review; never auto-publish a flagged thesis | Zero added cost or vendor risk while volume is tiny | Misses novel phrasing; manual queue doesn't scale | DESIGN §2.8 |
| ✖ | B · LLM classifier | Small model classifies every thesis with structured output; fail closed | Fewer misses, fractions of a cent per thesis | Second vendor on the critical path before supply is proven | DESIGN §2.8 |

### 2026-10-12 · Phase 1 scope → chose B (Prove supply)

**Decided by:** human (design rounds, CEO) · **Why:** An engagement story with no supply is a pitch deck, not a company. Prove 50 traders will connect and share before building retention features.

| | Option | Direction | Business bet | Trade-offs | PR |
|---|---|---|---|---|---|
| ✅ | B · Prove supply | Verified profiles, share card, public feed, theses; 18+ only | Traders who can prove their record will bring their audiences via shared links | Thin feed early; no young-adult engagement hooks yet | DESIGN Stage 3 |
| ✖ | A · Full engagement MVP | Add predictions, leagues, subscriptions, live rooms at launch | Young-adult (18+) retention story wins users and investors faster | 4 extra vendors/legal surfaces before knowing if supply exists | DESIGN Stage 1 |
