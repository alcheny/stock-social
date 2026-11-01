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

The whole path from idea to merged feature, with states and exit criteria: [`docs/process/lifecycle.md`](process/lifecycle.md).

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
| 13 | Go-to-market for the first 100 connected traders and 1,000 viewers, incl. gate counters | owner (delegated) | adopted with conditions | [2026-11-01](ideas/2026-11-01-board-review.md#idea-13-go-to-market-for-the-first-100-traders-and-1000-viewers-d) | C17 counters waiting, first next cycle; C9 handles waiting ([approval 2026-11-01](ideas/approval-2026-11-01.md)) |
| 14 | Projection assumptions (break-even share, data cost) and the cheapest early test | owner (delegated) | testing | [2026-11-01](ideas/2026-11-01-board-review.md#idea-14-projection-assumptions-d) | C18 notify-me waiting, not before LIVE_BILLING ([approval 2026-11-01](ideas/approval-2026-11-01.md)) |
| 15 | Does the business lead's demand debate apply to owner-decided features (IMPLEMENTATION) | found in repo | adopted | [2026-11-01](ideas/2026-11-01-board-review.md#idea-15-scope-of-the-demand-debate-on-decided-features-d) | — |
| 16 | Later per-trade depth on the record card vs per-trade cards only (F-4) | found in repo | adopted with conditions | [2026-11-01](ideas/2026-11-01-board-review.md#idea-16-per-trade-depth-on-the-record-card-d) | — |
| 17 | Timing of the product-name trademark clearance search (POLICY T5a) | found in repo | adopted | [2026-11-01](ideas/2026-11-01-board-review.md#idea-17-timing-of-the-trademark-clearance-search-d) | — |
| 18 | Creator payout trigger conditions (F-3) | found in repo | adopted with conditions | [2026-11-01](ideas/2026-11-01-board-review.md#idea-18-creator-payout-trigger-conditions-d) | — |
| 19 | Repository license and whether or when to publish the repo (POLICY C4, H) | found in repo (owner-reserved, POLICY H) | flagged for owner | [2026-11-01](ideas/2026-11-01-board-review.md#idea-19-repository-license-and-publishing-flag) | — |
| D20 | Disclaimer in plain view on the feed and under the profile headline | idea board | adopted | [2026-11-01](ideas/2026-11-01-board-review.md#d20-disclaimer-out-of-plain-view) | C1 passed, over the cap; remainder folded into fix #3 ([approval 2026-11-01](ideas/approval-2026-11-01.md)) |
| D21 | Neutral "Sign in" with two paths (follow and save / publish my record) | idea board | adopted with conditions | [2026-11-01](ideas/2026-11-01-board-review.md#d21-sign-in-framed-only-as-publishing) | C2 waiting: F-1 rework after security hardening ([approval 2026-11-01](ideas/approval-2026-11-01.md)) |
| D22 | One record line on every feed card; smaller ticker tested | idea board | adopted with conditions | [2026-11-01](ideas/2026-11-01-board-review.md#d22-feed-card-without-record-context) | **approved: F-10** ([approval 2026-11-01](ideas/approval-2026-11-01.md)) |
| D23 | Profile headline leads with average and range, win rate second (three versions) | idea board | testing | [2026-11-01](ideas/2026-11-01-board-review.md#d23-profile-leads-with-win-rate) | C4 waiting until there is traffic ([approval 2026-11-01](ideas/approval-2026-11-01.md)) |
| D24 | Plain labels for every stat; trades vs bets reconciled; units named | idea board | adopted | [2026-11-01](ideas/2026-11-01-board-review.md#d24-jargon-and-counts-that-disagree) | C5 waiting: helpers after this cycle ([approval 2026-11-01](ideas/approval-2026-11-01.md)) |
| D25 | Remove developer text and the "every stock" claim from public pages | idea board | adopted | [2026-11-01](ideas/2026-11-01-board-review.md#d25-developer-text-and-a-completeness-slip) | fixes list #8, #12 ([approval 2026-11-01](ideas/approval-2026-11-01.md)) |
| D26 | Production switch: no sign-in or connect until Terms and Privacy Policy are live | idea board | adopted | [2026-11-01](ideas/2026-11-01-board-review.md#d26-consent-to-placeholder-terms) | excluded: built in #31 ([approval 2026-11-01](ideas/approval-2026-11-01.md)) |
| D27 | One-line explanation for signed-out first visits; "Trades by stock" nav label | idea board | adopted with conditions | [2026-11-01](ideas/2026-11-01-board-review.md#d27-no-first-visit-explanation) | **approved: F-13** ([approval 2026-11-01](ideas/approval-2026-11-01.md)) |
| D28 | DESIGN §1.2 signal-seller persona and §3.4 "skill" and "badges" lines | idea board | flagged for owner | [2026-11-01](ideas/2026-11-01-board-review.md#d28-design-persona-and-skill-and-badge-lines) | — |
| D29 | "Last close · updated" and "Account 1 of 2" on the profile; idle marker | idea board | adopted with conditions | [2026-11-01](ideas/2026-11-01-board-review.md#d29-stale-or-opaque-records) | **approved: F-11** ([approval 2026-11-01](ideas/approval-2026-11-01.md)) |
| 30 | Thesis safety v2: normalised moderation, report action, owner-run release path (C8) | design council P-1, creative council CR-34..36 | **approved: F-9** | [approval 2026-11-01](ideas/approval-2026-11-01.md) | approved |
| 31 | Record status line remainder of D29 plus TR-5 "Account removed" (C7) | design council P-4, creative CR-7 | **approved: F-11** | [approval 2026-11-01](ideas/approval-2026-11-01.md) | approved |
| 32 | Record strip on trade and month pages and images, per idea 16 (C15) | design council P-4, creative CR-9/12/13 | **approved: F-12** | [approval 2026-11-01](ideas/approval-2026-11-01.md) | approved |
| 33 | Sync cadence within the vendor's guidance (C19) | market council #2 | **approved: F-14** | [approval 2026-11-01](ideas/approval-2026-11-01.md) | approved |
| 34 | Handle and name integrity, trimmed (C9) | design council P-2, creative CR-33 | **approved: F-17** (cycle 2, K2) | [approval 2026-11-01](ideas/approval-2026-11-01.md), [approval cycle 2](ideas/approval-2026-11-01-cycle2.md) | approved |
| 35 | Privacy-safe gate counters (C17) | market council #3, idea 13 | **approved: F-15** (cycle 2, K3 with MRC2-1 and BC-7) | [approval 2026-11-01](ideas/approval-2026-11-01.md), [approval cycle 2](ideas/approval-2026-11-01-cycle2.md) | approved |
| 36 | One trust language (C10) | design council P-3, creative CR-5/8/14/15 | **approved: F-18** (cycle 2, K7) | [approval 2026-11-01](ideas/approval-2026-11-01.md), [approval cycle 2](ideas/approval-2026-11-01-cycle2.md) | approved |
| 37 | Owner sees the public record (C12) | design council P-8, creative CR-32 | waiting (cycle 2, K15 1.87: no real traders yet; needs real sign-in) | [approval 2026-11-01](ideas/approval-2026-11-01.md), [approval cycle 2](ideas/approval-2026-11-01-cycle2.md) | waiting |
| 38 | Feed reading mode, non-visual remainder (C11) | design council P-6, creative CR-26 | waiting (cycle 2, K16 2.00: after fixes #14-#17 and F-10/F-13) | [approval 2026-11-01](ideas/approval-2026-11-01.md), [approval cycle 2](ideas/approval-2026-11-01-cycle2.md) | waiting |
| 39 | Design-system foundation and CI gate (C14) | design council P-10, creative CR-16..24 | **approved: F-20** (cycle 2, K9) | [approval 2026-11-01](ideas/approval-2026-11-01.md), [approval cycle 2](ideas/approval-2026-11-01-cycle2.md) | approved |
| 40 | Wayfinding remainder: month index, search (C13) | design council P-9 | waiting (cycle 2, K21 1.13: no demand; after F-17) | [approval 2026-11-01](ideas/approval-2026-11-01.md), [approval cycle 2](ideas/approval-2026-11-01-cycle2.md) | waiting |
| 41 | Home link preview (C21) | creative council CR-1/31, market #12 | waiting (cycle 2, K20 2.13: chore-sized; the orchestrator may build it) | [approval 2026-11-01](ideas/approval-2026-11-01.md), [approval cycle 2](ideas/approval-2026-11-01-cycle2.md) | waiting |
| 42 | Simulated-account exclusion and coverage copy (C20) | market council #14 | rejected as a feature: already built (`is_paper` filter); copy goes with fix #8 | [approval 2026-11-01](ideas/approval-2026-11-01.md) | rejected |
| 43 | Whole-record preview at connect (C16) | market council #11 | flagged for owner: contradicts F-1 2026-10-22 (no import before consent); recommend a Demo-record preview (cycle 2 repeats it as K17's shape) | [approval 2026-11-01](ideas/approval-2026-11-01.md), [approval cycle 2](ideas/approval-2026-11-01-cycle2.md) | owner |
| 44 | Trial arm, free limited Record tools, delete connection on disconnect, other price arms (MR-6/7/8/13) | market council | flagged for owner: contradict F-3 2026-11-01 / TR-5; not recommended now | [approval 2026-11-01](ideas/approval-2026-11-01.md) | owner |
| 45 | Number format, tone and ranges, lib slice first (C5, D24, DS-10..13, DS-25, MRC2-5) | design system council, market council cycle 2 | **approved: F-19** | [approval cycle 2](ideas/approval-2026-11-01-cycle2.md) | approved |
| 46 | Trust-and-safety slice: profile report, owner digest, audited hide, takedown page, anti-impersonation line (BC-2, BC-17, MRC2-6) | business council, market council cycle 2 | **approved: F-16** | [approval cycle 2](ideas/approval-2026-11-01-cycle2.md) | approved |
| 47 | Open-positions gate for real users with a count-only line (BC-3) | business council | flagged for owner: narrows F-6 2026-11-01 and TR-4; recommend a dated temporary exception in F-6 | [approval cycle 2](ideas/approval-2026-11-01-cycle2.md) | owner |
| 48 | Age-law posture: attestation version, hide on an under-18 report, pinned signed-out order (MRC2-12) | market council cycle 2 | under-18 report category **approved as an addition to F-16** (cycle 3, re-approval L-16 4.07; blocked on F-9, PR #65); the attestation version and the pinned signed-out order are not approved and keep waiting | [approval cycle 2](ideas/approval-2026-11-01-cycle2.md), [approval cycle 3](ideas/approval-2026-11-01-cycle3.md) | approved |
| 49 | Sitemap and SEO pages (MRC2-13) | market council cycle 2 | waiting (K19 2.07: after fixes #1 and #4; no profiles before launch) | [approval cycle 2](ideas/approval-2026-11-01-cycle2.md) | waiting |
| 50 | Billing hygiene checks in test mode (MRC2-11) | market council cycle 2 | waiting (K22 2.00: a test-only chore; Terms text is the owner's) | [approval cycle 2](ideas/approval-2026-11-01-cycle2.md) | waiting |
| 51 | One image palette and image trust band (DS-6, DS-19) | design system council | waiting (K11 1.73: after F-12 and owner flags O-2/O-4) | [approval cycle 2](ideas/approval-2026-11-01-cycle2.md) | waiting |
| 52 | Design-system variant tests V-1 neutral base, V-2 type and spacing collapse, V-3 nav labels (DSP-5..7) | design system council | waiting (KV 1.07: no traffic, held with C4/D23) | [approval cycle 2](ideas/approval-2026-11-01-cycle2.md) | waiting |
| 53 | Amendments to idea-board decisions D27, D25, D22 and a one-maturity-signal rule (DSP-2, DSP-3, DSP-4, DSP-8) | design system council | proposed: goes to the idea board (the council may not reword a decided line) | [approval cycle 2](ideas/approval-2026-11-01-cycle2.md) | idea board |
| 54 | Gate definitions, go-to-market v2, pricing research, vendor questions (MRC2-3, 4, 7, 10, 11) | market council cycle 2 | flagged for owner | [approval cycle 2](ideas/approval-2026-11-01-cycle2.md) | owner |
| 55 | Council cycle 3 whole-app audit of main: 18 ranked proposal briefs for approval cycle 3 (top: C3-2 transfers as share moves, C3-3 oversells publish the recorded part, C3-17 exclusion counts beside the headline, C3-15 in-app disconnect, C3-9 broker corrections), a 27-item fixes list (F3-1..F3-27, no vote) and 10 owner questions | council cycle 3 (nine lenses, two cross-reviews, synthesis, verification, red team) | reviewed: approval cycle 3 approved C3-17 (F-21), C3-2 (F-22, owner's yes first), C3-36 (F-23), C3-9a (F-24); rows 56-61 | [cycle 3](direction/cycle3-2026-11-01.md), [approval cycle 3](ideas/approval-2026-11-01-cycle3.md) | approval cycle 3 |
| 56 | Exclusion counts beside the headline: one muted line on the pane and record strip, one shared sum (C3-17, reshaped) | council cycle 3 | **approved: F-21** (cycle 3, 4.13, 15/15; blocked on F3-2 and F-22) | [approval cycle 3](ideas/approval-2026-11-01-cycle3.md) | approved |
| 57 | Transfers as share moves, not repricings; transferred-out count (C3-2) | council cycle 3 | **approved: F-22, conditional on the owner's yes** (cycle 3, 4.07, 15/15; amends `lib/trades.ts:52` and the corporate-actions committee rule) | [approval cycle 3](ideas/approval-2026-11-01-cycle3.md) | approved; owner |
| 58 | Public payloads no more precise than the screens show (C3-36) | council cycle 3 | **approved: F-23** (cycle 3, 3.67, 15/15; blocked on F3-2) | [approval cycle 3](ideas/approval-2026-11-01-cycle3.md) | approved |
| 59 | Late-posted trades reach the record by insert-only reconciliation (C3-9a); vendor corrections in a revisions table (C3-9b) | council cycle 3 | **approved: F-24** for C3-9a (cycle 3, 3.60, 15/15; blocked on F-14); C3-9b flagged for owner (Q3) | [approval cycle 3](ideas/approval-2026-11-01-cycle3.md) | approved; owner |
| 60 | Lapsed cycle-2 approvals re-voted: F-16 (+K18), F-17, F-20 re-approved; F-18 and F-19's sweep not re-approved | approval council cycle 3 (lapse rule) | F-16 4.07, F-17 3.93, F-20 3.67 **re-approved** (blocked); F-18 3.13 → draft; F-19 sweep 2.80 lapsed | [approval cycle 3](ideas/approval-2026-11-01-cycle3.md) | approved / waiting |
| 61 | Cycle-3 briefs not approved: C3-37 day-7 marker, C3-34 health endpoint, C3-39/40 settings and locked Record tools, C3-15 disconnect, C3-16 connection health, C3-38 drop-off counts, C3-42 full export, C3-43 public since, C3-35 cached images, C3-3 oversells; C3-41/C3-45 to a design session; C3-44 chore | council cycle 3 | waiting (C3-37 3.47 flagged for owner; C3-34 and C3-39 chores; C3-3 rejected in substance, 1.47) | [approval cycle 3](ideas/approval-2026-11-01-cycle3.md) | waiting |
| 62 | One link rule for trade rows: every closed-trade row links once to its trade page; trade URLs move to the hashed `trade_key` (308 from old ids); feed card footer "This trade →" (C3-41) | council cycle 3 → design session | **decided: F-25** (design council cycle 3, all four signed; blocked on F-9 PR #65, F-11 and F-26) | [committee](features/logs/design-cycle3/committee-2026-11-01.md) | decided |
| 63 | No empty-note line: "No thesis posted." removed; a held note shows only to its author, and viewers get the same output for held and none (C3-45, CS-6) | council cycle 3 → design session | **decided: F-26** (design council cycle 3, all four signed; blocked on F-9 PR #65) | [committee](features/logs/design-cycle3/committee-2026-11-01.md) | decided |
| 64 | PR #71 colour follow-ups: chart bar baseline on `--control`, failed import as a warn notice (icon, box, words), dark share-image gain/loss hues (DS-6) | PR #71 hand-off | **decided: F-27** (blocked on F-20 and F-11); image hues an owner question, recommended yes | [committee](features/logs/design-cycle3/committee-2026-11-01.md) | decided (hues: owner) |

## Decisions

- 2026-11-01: The design council for cycle 3's routed items decided F-25 (one link rule for trade rows, C3-41), F-26
  (no empty-note line; a held note shown to its author only, C3-45) and F-27 (PR #71's colour follow-ups). All three are
  blocked on in-flight work. F-27's share-image hue change and F-20's image-floor conflict go to the owner. Why: decided
  by the committee under the owner's instruction of 2026-11-01
  ([committee](features/logs/design-cycle3/committee-2026-11-01.md)).
- 2026-11-01: The approval council's third cycle approved four new features: F-21 exclusion counts beside the
  headline, F-22 transfers as share moves (conditional on the owner's yes, because it amends a decided matcher rule),
  F-23 public payload precision, F-24 late-posted trades by insert-only reconciliation. It re-approved three lapsed
  cycle-2 approvals: F-16 (with K18's under-18 report), F-17 and F-20. F-18 and F-19's sweep lapsed and were not
  re-approved. Four build slots; nothing can start today (each waits on in-flight work, with a lapse clause to cycle 4).
  Why: approval council under the owner's delegation of 2026-11-01 ([approval cycle 3](ideas/approval-2026-11-01-cycle3.md)).

- 2026-11-01: The approval council's second cycle approved six features: F-15 measurement foundation (first slice),
  F-16 trust-and-safety slice, F-17 handle and name integrity, F-18 one trust language, F-19 number format and ranges
  (lib slice first), F-20 design tokens and the contrast test. They take five build slots (F-20 and F-18 share
  `app/globals.css`). An approval whose prerequisite has not merged by the next council lapses to it. BC-3 (open
  positions gate) and the Demo-record preview went to the owner. Why: approval council under the owner's delegation of
  2026-11-01 ([record](ideas/approval-2026-11-01-cycle2.md)).

- 2026-11-01: The approval council approved six features: F-9 thesis safety, F-10 feed record line and the shared RecordStrip, F-11 record status line, F-12 trade and month record strip, F-13 first-visit line and swipe hint, F-14 sync cadence. C1 and C9 passed but were over the cap of six; C1's remainder rides with fix #3. Why: approval council under the owner's delegation of 2026-11-01 ([record](ideas/approval-2026-11-01.md)).

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

- Approval council cycle 3 2026-11-01: F-22 amends `lib/trades.ts:52` and the corporate-actions committee's rule
  (recommend yes, with the basis rule); F-9 on `claude/fix-user-text-safety` holds F-16, F-17 and K18 (recommend
  merging it next); the cap reading (re-approvals not counted as new; slots counted); C3-9b revisions table (Q3,
  recommend yes); C3-37 day-7 marker missed by 0.03 (recommend folding into F-15 if the privacy committee agrees);
  K18's age-assurance method; contrast floors in a protected file. Record: [approval cycle 3](ideas/approval-2026-11-01-cycle3.md).

- Council cycle 3 2026-11-01: ten owner questions, one list, each with a recommended answer (TR-5 freeze rule,
  OD-9 positions of a disconnected account, append-only revisions for broker corrections, exclusion count on the share
  card, F3b account-event email scope, viewer sign-up gate, data-export scope, consent for "public since", trader reach
  counts, one owner queue). Record: [cycle 3](direction/cycle3-2026-11-01.md#7-owner-questions).

- Approval council cycle 2 2026-11-01: BC-3 open-positions gate (recommend a dated temporary exception in F-6 with the
  count-only line); the Demo-record preview as C16's shape; commit 107d3f4 on `claude/f13-a11y-fixes` rewords D27's
  decided line (revert, or amend D27 at the idea board first); DSP-2/3/4/8 go to the idea board; MRC2-3/4/7/10/11 and
  BC-1, 5, 8, 9, 10, 12-16, 18 are the owner's; BC-11's legal calls (T2, the legislator source, the launch-gate bypass)
  are the owner's. Record: [approval cycle 2](ideas/approval-2026-11-01-cycle2.md#flags-for-the-owner-the-councils-recommendation-not-approved).

- Approval council 2026-11-01: C16 whole-record preview needs an F-1 change (recommend a Demo-record preview); MR-6/7/8/13 contradict F-3 and TR-5 (not recommended); treat the privacy-safe gate counters (C17) and handle integrity (C9) as the first items of the next cycle; CLAUDE.md and DESIGN §2.7 "hourly sync" wording after F-14; DECISIONS #11 logged twice; D22's "Too early to tell" vs F-4's under-5-bets line; F-13's line needs new wording if F-7 public profiles enter the feed. Record: [approval 2026-11-01](ideas/approval-2026-11-01.md#flags-for-the-owner-the-councils-recommendation-not-approved).

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
