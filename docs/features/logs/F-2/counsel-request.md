# Request for a legal opinion: per-viewer ordering of verified trade records

Prepared 2026-10-25 by the product team for the owner to send to counsel (hard stop H2 of feature F-2). The owner
decided to send these questions to counsel; building the personal ranking (F-2 PR-5) waits for the answers. The team's
own reading of each question is in `hardstops-resolution-business-lead.md` §2; it is not legal advice and is not
attached as a position counsel should adopt. Nothing in this request names a third-party company.

## 1. What the product is

- A website where traders connect a brokerage account **read-only** (no orders, no funds held). Their **closed
  trades** are published on a public profile as **percent returns only**: no quantities, prices or account values.
  Losses are published and ranked exactly like gains. Only broker-sourced records are shown as "Verified"; there is no
  manual or self-reported trade path.
- Viewers read those records in a scrolling feed and on profiles. Every screen with performance carries "Not
  investment advice. Past performance does not guarantee future results."
- Adults only: every account attests to being 18 or older at sign-up (attestation, not age verification).
- No paid placement, no promotion of any trader, no notifications or pushes, no counts of followers or likes, no
  rewards. The product never suggests a trade, a security to buy or sell, or any action to take.

## 2. What is personal today, and what is planned

**Built (signed-in viewers only; signed out, everyone gets the same documented order):**
- **Follow** a trader (private; the trader is never told; no count anywhere). It does not change the order yet.
- **Like** a trade (private; no count). It does not change the order yet.
- **"Not interested"** in a trader: removes that trader from this viewer's feed and suggestions for 90 days.
- **"Hide this trade"**: removes one trade from this viewer's feed for 90 days and lowers its trader's position for
  that viewer (×0.8) for 90 days.
- **Unfollow**: lowers that trader's position for that viewer (×0.8) for 90 days.
- These effects only ever **lower** a trader for that viewer; nothing raises one. None reads whether a trade won or
  lost, or by how much. A hide never removes anything from the trader's public profile.

**Planned (F-2 PR-5, waiting for this opinion):**
- Order each signed-in viewer's feed and a "More like what you read" section by that viewer's own actions: follows,
  likes, hides, watchlist (symbols the viewer chose to watch), and what they read (impressions, time on a card,
  skips, opens), kept for 90 days.
- Each suggestion shows one plain reason from a fixed list, for example "Similar holding period to @trader",
  "Trades symbols on your watchlist", "Trades symbols you read". No performance figure on a suggestion row; the
  record it opens carries the disclaimer.
- The ordering never uses another viewer's data and never the sign or size of a return.

**Data:** viewer id, surface, type, target (trader, trade or symbol) and time only; first-party; never sold, never
used for advertising, no third-party trackers. Deleted with the account the same day.

## 3. Questions

Priority questions are marked ★.

1. ★ **Publisher's exclusion.** Does ordering a feed of published, broker-sourced closed-trade records per viewer, by
   what that viewer read, followed and liked, keep the publisher's exclusion from investment-adviser status? The
   ordering never names a security to trade, and every reason is a fact about the record or the viewer's own actions.
   In particular: (a) the reason "Trades symbols on your watchlist", which ties a security the viewer chose to traders
   who trade it; (b) the demotions that are live today (×0.8 after an unfollow or a trade hide).
2. **Follows as a preference.** Is placing traders the viewer chose to follow higher in that viewer's feed a
   "suggestion", or a display preference the viewer set?
3. **Follow itself.** Is a "Follow" control acceptable if it never notifies or pushes, never shows a count, and the
   trader is never told?
4. ★ **State law.** Do any states (a) treat behavior-based ordering of financial content as needing adviser
   registration, or (b) treat it as profiling that carries an opt-out duty? (c) Do the new state rules on
   personalized ("addictive") feeds for minors, one effective in January 2027 and one requiring age assurance from
   January 2027, apply to this feed, including the demotions live today? Is 18+ attestation plus a switch that turns
   personal ordering off (see 4 below) enough, or must age assurance come before any personal ordering? Please also
   confirm the size thresholds in those rules.
5. **Consent for 90 days of reading events.** Does keeping 90 days of first-party reading events (section 2, Data)
   need consent beyond the Privacy Policy, given the financial context? Does any financial-privacy law reach a viewer
   who connects no brokerage account?
6. **Viewer-chosen removals and demotions.** Does a removal or demotion that the viewer sets ("Not interested", "Hide
   this trade", unfollow) keep the exclusion, given that each only lowers and ends after 90 days?
7. **Same-for-everyone section.** Is a section of traders that is the same for every viewer, ordered by the published
   lower-bound method, with factual reasons and no performance figures, the same class as the existing feed?

## 4. Safeguards we can add if counsel advises them

- **Opt-out switch:** "Order my feed by my activity", on by default; when off, the viewer gets the signed-out order
  minus their own hides, and nothing about their reading is recorded.
- **"Reset my feed":** one button that deletes the viewer's hides, unfollow notes and reading events.
- **Reading signals off** (impressions, time on card, skips, opens) for real viewers until counsel advises; follows,
  likes and hides stay.
- Any copy change counsel wants on reasons, the disclaimer or the Privacy Policy.

## 5. What we need back

For each question: yes / no / yes with conditions, the conditions, and whether the answer changes with size
(monthly users) or by state. If a safeguard in section 4 is required, which one and before what event (any real
viewer, a given size, a given date).

## 6. Available on request

The written policy, the feature's design record with dated decisions, the data inventory verified against the code,
and screenshots of every screen named above.
