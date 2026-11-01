# F-4 · Committee 2026-11-01 · the rework plan and its decisions

Build: the F-4 share card rebuilt to the owner's decisions of 2026-10-31 and 2026-11-01, plus F-6's share-card part
(`docs/features/F-6-open-positions.md`). Under the owner's instruction of 2026-11-01, every open question is decided
by the committee's recommended option after debate. Members: UX lead (drafted the plan), business lead and engineer
(reviewed it). The plan drafts are not in the repo; this file records what was decided and why.

## Planning debate

- **Round 1.** The UX lead drafted plan v1. The business lead and the engineer both returned it **not signed**.
  - Business lead's demands: fix the scheme-less printed link, which v1 left out; build the trust-line sign from the
    card's interval as the owner's table words it; remove the import cycle; word the open-positions row so it can't be
    read as the "likely between" range; measure the link preview by render, not by estimate; feed the PNG, the alt
    text and the preview text from one model; prove losses are drawn as prominently as gains.
  - Engineer's demands: no runtime import cycle (a leaf `lib/bets.ts`); `tierFor` with the thresholds named once and
    a drift test against `confidence()`; record length rounded exactly as the profile's evidence line; the unfurl
    budget, which v1 miscounted by about 60 px, with cuts named in order; an open-positions row that fits the worst
    case; the `cardLink` fallback; the open-positions loader and its visibility rule in the pure model; the range
    tested on printed strings.
- **Round 2.** Plan v2 accepted every demand. Both members **signed**.
  - Q-S was the one split: the UX lead and the engineer had recommended keeping the pace-verdict check (option a),
    and the business lead argued for the card's interval alone (option b).
  - After weighing the business lead's case, the engineer moved to (b). The chart is now a running sum and the range
    is arithmetic, so a compounded check only makes the card contradict itself.
  - (b) is the committee's decision. The UX lead's v1 recommendation of (a) is recorded as the dissent.

## Decisions (each also appended to the feature file)

1. **Q-S, the trust line's sign.** It is the sign of the interval the card prints, alone: "clear pattern of gains"
   and "consistent gains" only when the whole range is above 0, and the losses wording only when it is wholly below
   0. Why: the owner's table says "interval entirely above / below 0", and every number on the card is arithmetic
   and per trade. With the pace check, the volatile case printed "+12.8%, likely between +3% and +22%" beside "no
   clear pattern yet" over a rising line. The profile's log-based verdict can still differ until the profile moves to
   the same range (hand-off below). That is a known, temporary difference, pinned by a test.
2. **Q-U, open positions on the card.** The card shows the count, how many are up and down, and the lowest and the
   highest unrealized percent. The words are "Still open: 3 positions · 2 up, 1 down · lowest -8.0%, highest +12.1%",
   shortened on the link preview to "3 still open · …". There is no average and no combined figure. Why: an
   unweighted average across positions is "a number no account has" (lib/positions.ts). With no combined figure, no
   "includes open positions" label is needed, and the lowest printed first means a held loser is never hidden.
   - No symbols: naming held stocks on a shared picture reads as a pick (POLICY F1).
   - With open positions, the headline label reads "average per closed trade"; without them the card is unchanged.
   - Square and story add the note "unrealized, not sold yet".
   - Positions show only where the profile lists them (a broker record) and never while an import runs.
3. **Q-M.** The text under the link preview keeps "Evidence: tier". Why: TR-9 makes the label a Must; without it
   the text is a bare number.
4. **Q-C.** The chart caption is the owner's words verbatim, even when open positions are shown. Why: changing
   owner copy needs the owner; "closed trades" and "Still open" sit beside it.
5. **The card's statistics.** The range is `lib/bets.ts#arithmeticRange`: the mean of simple returns over every
   trade, a cluster-robust standard error over the same bets as `confidence()`, and t with K − 1 df. The tier is
   `tierFor(K, span)`, using `confidence()`'s thresholds now named once in `lib/confidence.ts`. A range wider than
   ±10 points makes the card "too early". Why: the 2026-10-22 rule ties "too wide" to the range the card shows.
6. **Record length.** Days are `Math.round` of first trade → last close, exactly the profile's evidence line.
   Months are whole UTC calendar months over the same instants. A span under one day still reads "1 day" (the
   profile reads "0 days" there, a documented divergence: "over 0 days" is not English).
7. **The link-preview budget.** Every element is kept at 10 CSS px or more at 343 px wide. The chart caption takes
   its own full-width row; the headline label sits beside the number on two lines; single-line rows use line
   height 1; the "New record" pill takes the trust badge's size on the preview only (the square and story keep it at
   the count line's size). The chart takes the rest:

   | State | Chart share of the preview |
   |---|---|
   | Base | 27% |
   | With the open row or the failed-import note | 24% |
   | Both (the worst case, rendered as `open_tight`) | 21% |

   The square and story keep 30% in every state.
8. **The printed link.** A configured origin with no scheme gets `https://`, and one that is no URL prints no link.
   The origin never comes from the Host header.

## Hand-offs (not this session's files)

- `lib/trades.ts` (Stock splits, F-6):
  - `confidence()` can call `betClusters` and `tierFor` instead of its inline copies.
  - The profile's range (`rangeText`) and its "Past results" verdict can move to `arithmeticRange`, so profile and
    card print one range.
  - The profile chart still compounds (`equityCurve`).
- `lib/ticker.ts#siteUrl`: sign-in links and the sitemap share the scheme-less origin bug the card now tolerates.
- F-6 owns `lib/open-split.ts`. The card's split (`cardOpen` in `lib/record-card.ts`) is a minimal pure helper to be
  unified with it.

## User tests, QA and review

Recorded in `build-2026-11-01.md` (this folder).
