# F-37 · Estimated public portfolios: profiles for officials and institutions from public disclosures

Status: draft
Blocked: the owner's decisions after the legal review of 2026-11-02 (`docs/direction/public-portfolios-legal-review-2026-11-02.md` §7, OD-1 to OD-10). Step 2 (officials, facts only) additionally waits for the staged attorney review's answer on 5 U.S.C. § 13107(c) (review §6, A1 and A2; owner item 2.54) or the owner's written risk acceptance. Step 3 (estimated ranges) additionally waits for the owner's rule amendments and an approved market-data source with a contract review (OD-7, A5) and a passed back-test.

## Why
The owner wants a profile type based on the standard profile for public people and portfolios, such as politicians
and institutions, with returns estimated and given statistical confidence, reviewed legally before anything is built.
The review found that a firm-level holdings profile is possible now. Officials' profiles wait on one legal question.
Estimated returns are possible only as labeled ranges, and only after the owner changes rules that block them today.

## Decisions
- 2026-11-02: The owner asked for "a type of profile based on the regular standard profile for these public people
  and portfolios like politicians, where the returns are estimated, with statistical confidences", and for a legal
  review of that and of other public filings, including institutions' and "private holdings", before implementing.
  Why: the owner's direction in chat.
- 2026-11-02 (proposed by the legal committee and design council, not yet decided by the owner): the verdicts per
  source, the three-step sequence, the method and the labels in the review document §1 and §4. Why: the committee's
  consensus items C1-C12 and the council's P1-P10, signed with no dissent.

## Proposed shape (from the review; the owner confirms)
- **Placement.** A separate "Public disclosures" area (`/disclosures/...`). It reuses the standard profile's layout
  components and has its own tables, with no `users` rows.
- **Types.**
  - Holdings report: a 13F firm, entity filers only.
  - Legislator disclosure.
  - Executive official disclosure: posted officials only.
- **Labels.**
  - The badge reads "Public disclosure", never Verified.
  - A not-joined, not-reviewed, no-endorsement line comes before any figure.
  - The disclaimer is on every screen.
- **Step 1, holdings reports.** A "Hypothetical holdings return (not the firm's return)" computed from the firm's own
  reported quarter-end values. It is unranked, with a business gate after four weeks.
- **Step 2, officials, facts only.** Dates, asset, direction, reporting lag and a filing link. No percent and no
  amount band until P3 is amended.
- **Step 3, estimated ranges.**
  - Each trade gets a fixed range from the trade days' highs and lows.
  - A profile range appears only behind gates.
  - There is never a point value and never a ranking.

## Acceptance criteria
Copied from the review §5. Each one is testable. The pipeline writes a test for every line once the status is ready.

All steps:
- [ ] AC1. With `PUBLIC_DISCLOSURES` unset or 0 in production, no `/disclosures` route, card, preview or importer is
  reachable or runs. It is on in dev, test and CI, using fictional fixtures only.
- [ ] AC2. Disclosure records create no `users` row and never appear in `closed_trades`, the feed, similar, suggest,
  rankings, follow, like, thesis, share prompts, join prompts, recaps, record tools, exports, an API or any paid
  feature. A test walks every public route and asserts this.
- [ ] AC3. Every disclosure page shows the "Public disclosure" badge and never "Verified". It shows the source line
  with a link, the type's not-joined line before any figure, and the disclaimer "Not investment advice. Past
  performance does not guarantee future results." It links to Terms, Privacy and /how.
- [ ] AC4. No disclosure page renders an upsell, sign-up or join prompt, display ad, donate or fundraising content, or
  third-party tracker.
- [ ] AC5. A copy test fails on the review's banned words on disclosure surfaces (review §5 AC5), plus the POLICY F2
  list.
- [ ] AC6. Each source's importer refuses to run without its flag and contact settings. It keeps to at most 4 requests
  a second with backoff, and its logs hold counts and run ids only.
- [ ] AC7. Amended filings supersede the original, and the derived record is rebuilt from raw, never patched.
- [ ] AC8. Every disclosure page has a correction link. A filer's documented dispute withdraws the whole estimate,
  never single trades, within the stated review time. The corrections log holds no requester details. A transcription
  fix against the filing is a correction, not a dispute.
- [ ] AC9. Filers resident in the EU or UK are excluded at import, and the exclusion is counted.

Step 1, holdings reports (13F):
- [ ] AC10. Only entity filers get a profile. Natural-person filers are excluded and counted.
- [ ] AC11. The quarter return follows the review §4.2 formula. Hand-computed fixtures cover: start-value weights; an
  exited position excluded with its share shown; an undocumented split excluded; an outlier price excluded; an options
  line excluded; a quarter over the 20% cap showing no figure and the reason; a confidential-treatment caveat; an
  amendment rebuild.
- [ ] AC12. "Hypothetical holdings return (not the firm's return)" and the §4.2 sub-line sit above the number at
  375 px, signed out.
- [ ] AC13. There is no ranking, "top" list or sort by return.
- [ ] AC14. Percent only: no share counts, values or prices on any surface, card or payload.
- [ ] AC15. Index metadata carries no figures.
- [ ] AC16. Business-gate counters (views from outside referrers; opens of a trader record) are recorded with no
  personal data.

Step 2, officials, facts only (after the § 13107 gate):
- [ ] AC17. No environment fetches or parses a real official's report while the § 13107 gate setting is unset.
- [ ] AC18. Rows show the date, the asset as filed, purchase or sale, "Reported N days after the transaction date" and
  the filing link. They show no "%", no chart and no amount band (until P3 is amended).
- [ ] AC19. Dependent-child lines are never stored. Spouse and joint lines are never named, never shown row by row and
  never estimated. One "Family-member and joint transactions not shown: N" count appears, hidden at 0. Real-property
  lines, addresses and family fields are never stored.
- [ ] AC20. Unsold purchases read "N reported purchases with no reported full sale", never "still held".
- [ ] AC21. Entries drop when the report's public period ends (6 years; for a member, 6 years after leaving office).
- [ ] AC22. Officials' pages are noindex, never ranked and never sorted by a figure. The list is in name order as
  filed.
- [ ] AC23. People's share cards and previews show no name, figure or chart.
- [ ] AC24. Only posted officials' reports are imported; application-only reports are not.

Step 3, estimated ranges (after OD-7, A5 and the back-test):
- [ ] AC25. `PUBLIC_ESTIMATES` refuses to turn on without the approved price-source setting and the owner's amendment
  setting.
- [ ] AC26. Eligibility rules U1-U8 (review §4.3). A fixture shows the unbiased U3 keeping a losing trade bought and
  sold in the same band. Each excluded trade is counted by its reason.
- [ ] AC27. Per-trade ranges match the §4.3 formulas on hand-computed fixtures, beside their inputs and "Estimate
  from public disclosures". No point value appears anywhere.
- [ ] AC28. Open self purchases enter as unrealized trades. If any is unpriced, no profile range is shown.
- [ ] AC29. The profile envelope contains the exact range and every in-range path's TR-9 interval (a property test).
  Clusters merge transitively by symbol overlap and by date. There is no division by zero.
- [ ] AC30. Each of the four gates (K ≥ 5; ≥ 50% of sales estimated, with family and joint lines in the denominator;
  open purchases priced; half-width ≤ 10 points) has a failing fixture that shows per-trade ranges and the reason.
- [ ] AC31. A range crossing 0% has no gain or loss colour. Screen readers hear "from minus X percent to plus Y
  percent". Colour is never the only signal.
- [ ] AC32. There is no Edge verdict, tier word or trust line, only "Based on N round trips over D days".
- [ ] AC33. The back-test (review §4.4 a-d) is pre-registered, its results are published on /how, and no probability
  wording ships before it passes.

## Out of scope
- Holdings or returns profiles of private individuals or private funds; Form PF; the broker-registration lookup;
  property, court and probate records (review §2.4).
- Schedule 13G returns. Schedule 13D, beyond chains where both legs carry prices in the filing.
- Executive-branch reports available only by written application. State officials' and federal judges' reports.
- Any ranking of officials, and any ranking of holdings reports at launch.
- Alerts, emails, push or feed items timed to filings; follow, copy or "trade like" features (POLICY F3b, F2).
- Estimates for company insiders (their filings carry real prices; F-7).

## Open questions
- The owner decisions OD-1 to OD-10 (review §7).
- The attorney questions A1 to A7 (review §6).
- Whether a holdings-report share card shows the firm's name and figure (review §4.5).
- Whether to proceed to step 2 at all if step 1 misses its business gate (the business lead's dissent, review §A.3).

## POLICY notes
- **Estimates are blocked today.** CLAUDE.md says "never guessed", F-7 L5 says "never estimated", and POLICY F3c sets
  the related standard. Step 3 needs the owner's carve-out and the new F3d (OD-7).
- **Amount bands are dollar figures**, which POLICY P3 bars. No band is shown until the owner amends P3 (OD-7c).
- **Real names in production data** need the owner's T2 amendment from item 2.49 and the OD-4 confirmation.
- **Officials' and institutions' data** never enter a paid feature (F5) and are never ranked (F1) (OD-3).

## Rework notes

## Build log
