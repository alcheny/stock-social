# Ideas: review process and register

Every non-technical idea (product direction, pricing, legal and policy positions, privacy choices, growth,
vendors, claims in copy, how the team works) goes to the **idea board** before it becomes a decision. The board's
members, lenses and rounds are in [`team/idea-board.md`](../team/idea-board.md). Code changes go through the
committee cycle (`docs/IMPLEMENTATION.md`); an idea that becomes a feature then goes to a design session.

Market research, creative direction and design direction have their own large councils
([`team/direction-councils.md`](../team/direction-councils.md)); their records go in `docs/direction/` and their
proposals come back here for the board, which enforces existing decisions and common sense before anything is
adopted.

Adopted ideas that add functions or requirements go to the approval council ([`team/approval-council.md`](../team/approval-council.md)),
whose most-elected ideas are approved automatically and built (owner's delegation of 2026-11-01).

## How an idea gets reviewed

1. Anyone (the owner, a design session, a committee, an agent) adds it to the register below with status
   `proposed`, one line on what it is and who raised it.
2. Claude runs the board (a multi-agent workflow: independent reviews, debate, fact-check, chair's
   recommendation) and files the result in `docs/ideas/<date>-<topic>.md`.
3. The owner decides, or, where the owner has delegated, the board's recommended option is recorded as the
   decision. Status becomes `adopted`, `adopted with conditions`, `testing` or `rejected`.

## Register

| # | Idea | Raised by | Status | Review | Council |
|---|---|---|---|---|---|
| 1 | Viewer subscription $9.99/month, $99.99/year, no free trial at launch (F-3) | owner | flagged for owner | [2026-11-01](ideas/2026-11-01-board-review.md#idea-1-viewer-subscription-price-no-free-trial-o) | — |
| 2 | No creator payouts for now; traders neither charged nor paid (F-3) | owner | adopted with conditions | [2026-11-01](ideas/2026-11-01-board-review.md#idea-2-no-creator-payouts-for-now-o) | — |
| 3 | Record tools (compare, saved views, private notes; pull-only) as the first paid feature (F-3) | owner | adopted with conditions | [2026-11-01](ideas/2026-11-01-board-review.md#idea-3-record-tools-as-the-first-paid-feature-o) | — |
| 4 | A hosted-checkout payment processor as billing vendor (F-3) | owner | adopted with conditions | [2026-11-01](ideas/2026-11-01-board-review.md#idea-4-hosted-checkout-payment-processor-o) | — |
| 5 | AI legal committee's findings in place of a licensed attorney's opinion (POLICY) | owner | flagged for owner | [2026-11-01](ideas/2026-11-01-board-review.md#idea-5-ai-legal-findings-in-place-of-counsel-o) | — |
| 6 | Position size as exact share of connected accounts, opt-in, account-weighted headline (F-5) | owner | flagged for owner | [2026-11-01](ideas/2026-11-01-board-review.md#idea-6-position-size-as-a-share-of-connected-accounts-o) | — |
| 7 | Preference data stored indefinitely; 90-day fading effect on ordering (F-2) | owner | flagged for owner | [2026-11-01](ideas/2026-11-01-board-review.md#idea-7-preference-data-stored-indefinitely-o) | — |
| 8 | Implicit activity logging off by default (F-2) | owner | adopted with conditions | [2026-11-01](ideas/2026-11-01-board-review.md#idea-8-implicit-activity-logging-off-by-default-o) | — |
| 9 | Open positions in every number, realized and unrealized apart (F-6) | owner | flagged for owner | [2026-11-01](ideas/2026-11-01-board-review.md#idea-9-open-positions-in-every-number-o) | — |
| 10 | Share card: running-sum chart, no win rate in preview text, length to last close (F-4) | owner | flagged for owner | [2026-11-01](ideas/2026-11-01-board-review.md#idea-10-share-card-chart-preview-text-and-record-length-o) | — |
| 11 | Autonomous build: AI committees decide open questions, merge without human review | owner | flagged for owner | [2026-11-01](ideas/2026-11-01-board-review.md#idea-11-autonomous-build-without-human-review-before-merge-o) | — |
| 12 | Open choices in the private Terms and Privacy Policy drafts (12a-12g) | owner (delegated) | adopted with conditions | [2026-11-01](ideas/2026-11-01-board-review.md#idea-12-terms-and-privacy-policy-draft-choices-d) | — |
| 13 | Go-to-market for the first 100 connected traders and 1,000 viewers, incl. gate counters | owner (delegated) | adopted with conditions | [2026-11-01](ideas/2026-11-01-board-review.md#idea-13-go-to-market-for-the-first-100-traders-and-1000-viewers-d) | candidate |
| 14 | Projection assumptions (break-even share, data cost) and the cheapest early test | owner (delegated) | testing | [2026-11-01](ideas/2026-11-01-board-review.md#idea-14-projection-assumptions-d) | candidate |
| 15 | Does the business lead's demand debate apply to owner-decided features (IMPLEMENTATION) | found in repo | adopted | [2026-11-01](ideas/2026-11-01-board-review.md#idea-15-scope-of-the-demand-debate-on-decided-features-d) | — |
| 16 | Later per-trade depth on the record card vs per-trade cards only (F-4) | found in repo | adopted with conditions | [2026-11-01](ideas/2026-11-01-board-review.md#idea-16-per-trade-depth-on-the-record-card-d) | — |
| 17 | Timing of the product-name trademark clearance search (POLICY T5a) | found in repo | adopted | [2026-11-01](ideas/2026-11-01-board-review.md#idea-17-timing-of-the-trademark-clearance-search-d) | — |
| 18 | Creator payout trigger conditions (F-3) | found in repo | adopted with conditions | [2026-11-01](ideas/2026-11-01-board-review.md#idea-18-creator-payout-trigger-conditions-d) | — |
| 19 | Repository license and whether or when to publish the repo (POLICY C4, H) | found in repo (owner-reserved, POLICY H) | flagged for owner | [2026-11-01](ideas/2026-11-01-board-review.md#idea-19-repository-license-and-publishing-flag) | — |
| D20 | Disclaimer in plain view on the feed and under the profile headline | idea board | adopted | [2026-11-01](ideas/2026-11-01-board-review.md#d20-disclaimer-out-of-plain-view) | candidate |
| D21 | Neutral "Sign in" with two paths (follow and save / publish my record) | idea board | adopted with conditions | [2026-11-01](ideas/2026-11-01-board-review.md#d21-sign-in-framed-only-as-publishing) | candidate |
| D22 | One record line on every feed card; smaller ticker tested | idea board | adopted with conditions | [2026-11-01](ideas/2026-11-01-board-review.md#d22-feed-card-without-record-context) | candidate |
| D23 | Profile headline leads with average and range, win rate second (three versions) | idea board | testing | [2026-11-01](ideas/2026-11-01-board-review.md#d23-profile-leads-with-win-rate) | candidate |
| D24 | Plain labels for every stat; trades vs bets reconciled; units named | idea board | adopted | [2026-11-01](ideas/2026-11-01-board-review.md#d24-jargon-and-counts-that-disagree) | candidate |
| D25 | Remove developer text and the "every stock" claim from public pages | idea board | adopted | [2026-11-01](ideas/2026-11-01-board-review.md#d25-developer-text-and-a-completeness-slip) | candidate |
| D26 | Production switch: no sign-in or connect until Terms and Privacy Policy are live | idea board | adopted | [2026-11-01](ideas/2026-11-01-board-review.md#d26-consent-to-placeholder-terms) | candidate |
| D27 | One-line explanation for signed-out first visits; "Trades by stock" nav label | idea board | adopted with conditions | [2026-11-01](ideas/2026-11-01-board-review.md#d27-no-first-visit-explanation) | candidate |
| D28 | DESIGN §1.2 signal-seller persona and §3.4 "skill" and "badges" lines | idea board | flagged for owner | [2026-11-01](ideas/2026-11-01-board-review.md#d28-design-persona-and-skill-and-badge-lines) | — |
| D29 | "Last close · updated" and "Account 1 of 2" on the profile; idle marker | idea board | adopted with conditions | [2026-11-01](ideas/2026-11-01-board-review.md#d29-stale-or-opaque-records) | candidate |

## Decisions

- 2026-11-01: Terms draft, disputes: individual arbitration with a 30-day opt-out by plain email, shown in the
  plain-language summary; assent by an unchecked box beside a visible link; small claims open to both sides; the
  company pays every fee beyond a consumer filing fee, on time; no waiver of public injunctive relief; a mass-filing
  protocol with bellwether cases in which claimants' counsel takes part; informal resolution of 60 days or less;
  court as the fallback for any claim the waiver can't cover; re-review at 10,000 payers or on a provider fee
  change. The owner approves the final text (POLICY H). Why: decided by the idea board under the owner's
  instruction of 2026-11-01.
- 2026-11-01: Terms draft, liability cap: the greater of what the user paid in the prior 12 months or $100, to the
  fullest extent the law permits, with carve-outs for fraud, willful misconduct, gross negligence, personal injury
  and non-waivable statutory rights, naming the exclusions rather than "some states"; it never excuses the
  company's own computed statistics (F3c). The owner approves the final text (POLICY H). Why: decided by the idea
  board under the owner's instruction of 2026-11-01.
- 2026-11-01: Privacy Policy draft: "We do not use your personal information to train large language models or
  other generative AI models, and we do not let our service providers do so", published only after every provider
  that touches personal data is confirmed to match; the recommendation ordering is described separately. The owner
  approves the final text (POLICY H). Why: decided by the idea board under the owner's instruction of 2026-11-01.
- 2026-11-01: Privacy Policy draft, account deletion: sign-up records and all personal data are deleted, keeping
  only a keyed hash of each confirmed broker account ID (TR-6, pseudonymous, life of the service), the bare handle
  reservation for one year (TR-5), billing and tax records the billing vendor holds by law, and aggregate counts
  with no identifier. The deletion screen lists exactly these. The owner approves the final text (POLICY H). Why:
  decided by the idea board under the owner's instruction of 2026-11-01.
- 2026-11-01: Go-to-market: week 0 is the first non-demo connection, after live Terms and Privacy Policy, consent,
  deletion, contact, real auth, the vendor's written permission, full name clearance, the report action and
  reserved handles, D20/D21/D27/D29 and first-party gate counters. Founder-led one-to-one invitations; 10-20
  anchors who don't sell paid signals; referral is attribution only; no rewards of any kind; company content uses
  Demo records or explains the method; share prompts are time-based only; no cookie; first 100 profiles checked by
  a human within 48 hours; DESIGN §3.5 thresholds unchanged. Why: decided by the idea board under the owner's
  instruction of 2026-11-01.
- 2026-11-01: Projections are restated on measured inputs: net $8.70 per payer a month, $1 (daily) or $2
  (real-time) per trader plus $100 a month, conversion 0.3-1% of non-trader viewers, loop costs included. Tests: a
  written vendor quote (public display, open-position prices, frozen records), first-party counters of traders per
  100 viewers, and an in-app priced notify-me control that charges nothing. Record tools stays the paid hook only
  if joins per non-trader viewer × 0.2 exceed the break-even share. Why: decided by the idea board under the
  owner's instruction of 2026-11-01.
- 2026-11-01: The business lead's demand debate applies only to how an owner-decided feature is built. One dated,
  non-blocking demand note per feature may go to its Open questions; compliance and harm findings can be raised on
  any feature at any time, and the feature then waits. Why: decided by the idea board under the owner's
  instruction of 2026-11-01.
- 2026-11-01: Trademark timing: a knockout search now; the full clearance finishes before the first real trader is
  invited, the first public card, any domain, logo, ad or listing, the billing descriptor and LIVE_BILLING, with two
  or three fallback names cleared in parallel; private tests run under a working name; lookalike, "support" and
  "official" handles are reserved. The name and clearance stay the owner's. Why: decided by the idea board under
  the owner's instruction of 2026-11-01.
- 2026-11-01: D20: the disclaimer appears on the feed's first screen at 360 px, in each appended feed page and
  under the profile's headline stats, also in the feed's swipe pane, on `/t/[symbol]` and on the trade page, with an e2e test on every route that shows
  performance (round 5); the footer copy stays. Why: decided by the idea board
  under the owner's instruction of 2026-11-01.
- 2026-11-01: D21: sign-in is a neutral "Sign in" with two paths, "Follow and save records" and "Publish my record"
  (first); the broker step only on the second; the 18+ attestation on both; done as an F-1 rework design session.
  Why: decided by the idea board under the owner's instruction of 2026-11-01.
- 2026-11-01: D22: every feed card carries one record line (closed-trade count, average per trade with its range)
  in place of the "held · closed" line, in D24's wording, and "Too early to tell" under 5 bets, never a bare average
  (round 5); the smaller ticker is built as three versions and tested on open-pane rate;
  ranking is unchanged. Why: decided by the idea board under the owner's instruction of 2026-11-01.
- 2026-11-01: D23 (testing): the profile headline order (average per trade with its range first and larger, win
  rate second in the same row) is a product change, so it is built as three versions (CLAUDE.md) and chosen by
  /choose or the Judge; the link-preview text and share card follow the same order; removing win rate stays the
  owner's (round 5). Why: decided by the idea board under the
  owner's instruction of 2026-11-01.
- 2026-11-01: D24: every stat has a plain label and a one-line "What's this?"; where both counts appear, one
  sentence says "N trades, counted as M separate bets because some overlapped"; every count names its unit; one word for a
  bet everywhere, checked by a test; profit factor (already in the secondary row) gets a plain label and
  explanation (round 5). Why: decided by the idea board under the owner's instruction of 2026-11-01.
- 2026-11-01: D25: the empty feed says "No public records yet."; the Stocks page says "Browse stocks that have
  verified closed trades."; the chart caption waits for idea 10 and CH-1. Why: decided by the idea board under the
  owner's instruction of 2026-11-01.
- 2026-11-01: D26: in production, sign-in and connect stay off in code until the Terms and Privacy Policy are live;
  previews label the checkbox "18 or older (preview: Terms not yet published)"; once live, the 18+ attestation and
  Terms acceptance are separate, versioned consents. Why: decided by the idea board under the owner's instruction
  of 2026-11-01.
- 2026-11-01: D27: signed-out first visits get one dismissible line, "Verified trades, straight from the broker.
  Losses included.", linking to "How records are calculated", never a modal; the "Stocks" nav item becomes "Trades
  by stock"; bounce and pane-open rate are measured before and after. Why: decided by the idea board under the
  owner's instruction of 2026-11-01.
- 2026-11-01: D29: the profile shows "Last close ‹date› · updated ‹relative time›" under "Record since", labels
  accounts "Account 1 of 2", and says when a connection has not synced for 30 days ("idle" means no sync, not no closes; facts only, round 5);
  idle connections are counted internally. Why: decided by the idea board under the owner's instruction of 2026-11-01.
- 2026-11-01: Idea 16 (F-4 open question; per-trade cards are outside F-4's scope): per-trade detail stays on per-trade cards; the record card stays record-level. Every per-trade card
  carries a record strip (closed-trade count, the record's average with its range, handle and full-record link,
  "losses included") and the disclaimer, and shows closed trades only. Depth is revisited at the week-8 review once
  at least 200 links have been shared, using share rate and click-through per card type and the winning vs losing
  share; per-trade cards above 50% of shares go on that agenda. Why: decided by the idea board under the owner's
  instruction of 2026-11-01.

## Flags for the owner

- Idea board 2026-11-01 (idea 5): before LIVE_BILLING and the first real user, one limited attorney review, staged:
  publisher's exclusion for Record tools and F1a ordering, checkout, auto-renewal, refund and arbitration terms;
  then the Privacy Policy; position size before the F-5 build; trademark before spend. State whether the
  replacement covers DESIGN and the feature files; fix the POLICY intro and the "owner and counsel" heading; copy
  each private condition into acceptance criteria; never claim "legal review" in copy.
- Idea board 2026-11-01 (idea 11): only a fitting version: sessions open PRs, the Gate merges unprotected paths
  after CI and Review, protected paths wait for the owner. Add billing, consent, deletion, auth, `lib/trades.ts`,
  `lib/moderation.ts`, the disclaimer, claims copy, the share card and /how to CODEOWNERS; close the Doctor's
  protected-path exception; a monthly spend cap pinned by a test (DAILY_PR_CAP defaults to none); a monthly
  seeded-defect audit; a privacy-diff check.
- Idea board 2026-11-01 (idea 12): POLICY H reserves Terms and Privacy Policy to the owner, against the delegation;
  the board's options are draft options and the owner approves the text and fills entity and contact details.
- Idea board 2026-11-01 (idea 18): payout basis: days followed (follows track performance) or a flat payment for a
  live connection with dummy-account guards; and a material-connection disclosure on paid traders' cards.
- Idea board 2026-11-01 (idea 19): keep private until launch is decided; publish only as a fresh single-commit
  repository with moderation lists in private config and risk-acceptance language removed; fix POLICY's
  "(public repository)" heading.
- Idea board 2026-11-01 (D23): whether win rate leaves the profile headline (CLAUDE.md headline rule).
- Idea board 2026-11-01 (D24): whether profit factor stays in DESIGN §2.5's stat list.
- Idea board 2026-11-01 (D28): amend DESIGN §1.2 to lead supply with hobbyists and educators, signal sellers later
  under a Terms clause; strike §3.4's "skill" and "badges" lines; point §3.5's re-interview at the amended persona.
- Idea board 2026-11-01 (cross-cutting): the data vendor's developer terms bar redistributing market data and
  re-packaging end-user data without written consent of the user and the vendor; ask whether the public record
  itself is covered, not only F-5 and F-6.
- Idea board 2026-11-01 (cross-cutting): COMPLIANCE cites WCAG 2.1 (§9, §13); POLICY A1 says 2.2. DESIGN §3 and
  §3.3 still say counsel. FEATURES ("agents can't change docs/features/") vs the board recording decisions there.
  DECISIONS #11 logged twice. TR-7's 10 trades vs the 10-bet floor.
