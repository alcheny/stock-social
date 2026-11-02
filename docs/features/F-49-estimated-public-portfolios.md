# F-49 · Estimated public portfolios: profiles for officials and institutions from public disclosures

Status: draft
Blocked: the owner's decisions after the legal review of 2026-11-02 (`docs/direction/public-portfolios-legal-review-2026-11-02.md` §7, OD-1 to OD-15; step 1 needs OD-4 first). Step 2 (officials, facts only) additionally waits for the staged attorney review's answer on 5 U.S.C. § 13107(c) (review §6, A1 and A2; owner item 2.54) or the owner's written risk acceptance. Step 3 (estimated ranges) additionally waits for the owner's rule amendments and an approved market-data source with a contract review (OD-7, A5) and a passed back-test.

## Why
The owner wants a profile type based on the standard profile for public people and portfolios, such as politicians
and institutions, with returns estimated and given statistical confidence, reviewed legally before anything is built.
The review found that a firm-level holdings profile is possible once the owner makes the OD-4 calls. Officials'
profiles wait on two attorney answers (A1, A2), media liability insurance and owner calls.
Estimated returns are possible only as labeled ranges, and only after the owner changes rules that block them today.

## Decisions
- 2026-11-02: The owner asked for "a type of profile based on the regular standard profile for these public people
  and portfolios like politicians, where the returns are estimated, with statistical confidences", and for a legal
  review of that and of other public filings, including institutions' and "private holdings", before implementing.
  Why: the owner's direction in chat.

## Proposed shape (not decided; the owner confirms)
These are the legal committee's consensus items C1-C12 and the design council's P1-P10, signed with no dissent and
still open until the owner decides.
- **Placement.** A separate "Public disclosures" area (`/disclosures/...`). It reuses the standard profile's layout
  components and has its own tables, with no `users` rows.
- **Types.**
  - Holdings report: a 13F firm, registered firms only.
  - Legislator disclosure.
  - Executive official disclosure: posted officials only.
- **Labels.**
  - The badge reads "Public disclosure", never Verified.
  - A not-joined, not-reviewed, no-endorsement line comes before any figure.
  - The disclaimer is on every screen.
- **Step 1, holdings reports.** A "Hypothetical holdings return (not the firm's return)" computed from the firm's own
  reported quarter-end values. It is for registered firms only and is unranked. It shows no list of securities and
  has a business gate after four weeks. The owner's OD-4 calls come first.
- **Step 2, officials, facts only.** Dates, asset, direction, reporting lag and a filing link. No percent and no
  amount band until P3 is amended.
- **Step 3, estimated ranges.**
  - Each trade gets a fixed range from the trade days' highs and lows.
  - A profile range appears only behind gates.
  - There is never a point value and never a ranking.

## Acceptance criteria
Copied from the review §5 (identical text). Each one is testable. The pipeline writes a test for every line once the
status is ready.

All steps.
- [ ] AC1. With `PUBLIC_DISCLOSURES` unset or 0 in production, no `/disclosures` route, card, preview or importer is
  reachable or runs. It is on in dev, test and CI, using fictional fixtures only.
- [ ] AC2. Disclosure records create no `users` row and never appear in `closed_trades`, the feed, similar, suggest,
  rankings, follow, like, thesis, share prompts, join prompts, recaps, record tools, exports, an API, or any paid
  feature. A test walks every public route and asserts this.
- [ ] AC3. Every disclosure page shows the "Public disclosure" badge and never "Verified". It shows the source line
  with a link, the type's not-joined line before any figure, and the disclaimer. It links to Terms, Privacy and /how.
- [ ] AC4. No disclosure page renders an upsell, sign-up or join prompt, display ad, donate or fundraising content, or
  third-party tracker.
- [ ] AC5. A copy test fails on any of these patterns on disclosure surfaces (case-insensitive):
  - `\binsider\b`;
  - `\blate\b`;
  - suspicious, suspiciously, timed, well-timed, ahead of, beat, outperform, cashed in, dumped, profited, windfall,
    conflict, violation, illegal, top, best, worst, ranking, leaderboard, copy, mirror, trade like, follow their
    trades, Verified;
  - `/(made|earned|gained|lost)\s+[-+]?\d/`;
  - confidence, likely, probably, until AC33's back-test passes and the owner amends this list;
  - the POLICY F2 list.
- [ ] AC6. Each source's importer refuses to run without its flag and its contact settings. It keeps to at most 4
  requests a second with backoff, and its logs hold counts and run ids only (no names). The limit of 4 is
  deliberately below F-7's 5 and the regulator's 10.
- [ ] AC7. Amended filings supersede the original, and the derived record is rebuilt from raw. A test shows no derived
  row is patched in place.
- [ ] AC8. Every disclosure page has a correction link. A filer's documented dispute withdraws the whole estimate
  (never single trades) within the stated review time, and the corrections log stores no requester details.
  Correcting a transcription error against the filing is a correction, not a dispute.
- [ ] AC9. Natural-person filers whose stated business or residence country is in the EU or UK are excluded at
  import, and the exclusion is counted.

Step 1: holdings reports (13F).
- [ ] AC10. Only filers that carry an adviser file number or CRD number on the filing get a profile.
  - Filers whose name matches a personal-name rule, or that state family-office status, are excluded and counted.
  - Signature, contact and "other included managers" person fields are never stored.
- [ ] AC11. The quarter return follows §4.2 exactly. Hand-computed fixtures cover:
  - weights by start value;
  - rows with the same identifier summed;
  - a PRN row excluded;
  - a quarter before 3 Jan. 2023 not computed;
  - an exited position priced from five or more other filers' median (with OD-11), and excluded with its own "sold
    during the quarter" line (without OD-11, or with fewer than five holders);
  - a 2-for-1 split detected and excluded;
  - a 2% price mismatch excluded, and an unchecked position counted;
  - an options line on its own line;
  - a quarter over the 20% cap (excluded plus options) showing no figure and the reason;
  - a confidential-treatment caveat;
  - an amendment rebuild.
- [ ] AC12. The label "Hypothetical holdings return (not the firm's return)" and the §4.2 sub-line sit above the
  number at 375 px width, signed out.
- [ ] AC13. Holdings-report pages have no ranking, no "top" list and no sort by return.
- [ ] AC14. Percent only: no share counts, values, prices or security identifiers on any surface, card or payload
  (POLICY P3).
- [ ] AC15. Index metadata (title, description, preview) carries no figures.
- [ ] AC16. The business-gate counters (views from outside referrers, opens of a trader record) are recorded with no
  personal data (F-15 rules), and exclude internal and bot traffic.
- [ ] AC34. The holdings-report source refuses to run in production unless the owner's OD-4 setting is present and
  the F-7 switch-on checklist items 3 to 5 hold.
- [ ] AC35. A holdings-report page shows the filer name as filed, the type line, each quarter's figure with its
  exclusion lines, and links to each filing. It shows no list of securities and no weights. It shows no "added",
  "new", "increased", "sold" or "exited" labels, and does not sort any security by a change. This stands unless the
  owner decides otherwise in OD-15.
- [ ] AC36. Pages exist for filers selected by a rule in production settings. No list of filers is hard-coded.
- [ ] AC37. No multi-quarter figure is shown. If one is added later, it spans only consecutive quarters that have a
  figure. The interval follows OD-12.
- [ ] AC38. If a holdings-report card shows a figure (owner's call), the card and its alt text carry the full
  "Hypothetical holdings return (not the firm's return)" label.

Step 2: facts-only officials (after the § 13107 gate).
- [ ] AC17. No environment fetches or parses a real official's report while the § 13107 gate setting is unset. A
  test asserts the importer refuses to run.
- [ ] AC18. Rows show the date, the asset as filed, purchase or sale, "Reported N days after the transaction date" and
  the filing link. They show no "%", no chart and no amount band (until P3 is amended).
- [ ] AC19. Dependent-child lines are never stored. Spouse and joint lines are never named, never shown row by row and
  never estimated. Exactly one "Family-member and joint transactions not shown: N" count appears, hidden at 0.
  Real-property lines, addresses and family fields are never stored.
- [ ] AC20. Unsold purchases read "N reported purchases with no reported full sale", never "still held".
- [ ] AC21. An entry drops out when its report's public period ends: 6 years; for a member, 6 years after leaving
  office; 1 year for the nominee and candidate reports covered by § 13107(d)(3).
- [ ] AC39. Step 2 pages carry "Filings can be late, amended or missing."
- [ ] AC22. Officials' pages are noindex. They are never ranked or sorted by any figure. The list is in name order as
  filed.
- [ ] AC23. People's share cards and previews show no name, figure or chart.
- [ ] AC24. Only posted officials' reports are imported; application-only reports are not.

Step 3: estimated ranges (after OD-7, A5 and the back-test).
- [ ] AC25. `PUBLIC_ESTIMATES` refuses to turn on without the approved price-source setting and the owner's
  amendment setting.
- [ ] AC26. Eligibility U1-U8 are implemented as in §4.3. Fixtures show the unbiased U3 keeping a losing trade bought
  and sold in the same band, and an excluded trade counted by its reason.
- [ ] AC27. The per-trade range matches the §4.3 formulas on hand-computed fixtures, beside its inputs and "Estimate
  from public disclosures". No point value appears anywhere.
- [ ] AC28. Open self purchases enter as unrealized trades, valued at the date of the latest annual report that lists
  the holding, beside "Assumes the purchase was still held on ‹date›". If any open self purchase is unpriced or
  unlisted, no profile range is shown.
- [ ] AC29. The profile envelope uses the §4.3 `SE⁺` bound and contains the mean range and the TR-9 interval of every
  in-range path (a property test). Same-date, same-report and overlap clusters merge transitively. There is no
  division by zero.
- [ ] AC30. Each of the four gates has a failing fixture that shows per-trade ranges and the reason:
  - K ≥ 5;
  - at least 50% of sales estimated, with family and joint lines in the denominator;
  - open purchases priced;
  - `tooWide` false on the simple-return envelope.
- [ ] AC31. A range that crosses 0% has no gain or loss colour. Screen readers hear "from minus X percent to plus Y
  percent". No information is carried by colour alone (WCAG 2.2 AA).
- [ ] AC32. There is no Edge verdict, tier word or trust line, only "Based on N round trips over D days".
- [ ] AC33. The back-test (§4.4 a-d) is pre-registered, and its results are on /how.
  - No estimate ships before (a), (b) and (d) pass.
  - No profile range ships before (c) also passes.
  - Probability or coverage wording ships only with (a)'s published lower bound.
- [ ] AC40. Step 3 pages carry the three §4.3 context lines (market moves, filings late or missing, account manager).

---

## Out of scope
- Holdings or returns profiles of private individuals or private funds; Form PF; the broker-registration lookup;
  property, court and probate records (review §2.4).
- Schedule 13G returns. Schedule 13D (OD-14 recommends out of scope for now).
- Sources the review did not cover: proposed-sale notices, public pension funds' holdings, nonprofits' information
  returns, foreign short-position disclosures.
- Executive-branch reports available only by written application. State officials' and federal judges' reports.
- Any ranking of officials, and any ranking of holdings reports at launch.
- Alerts, emails, push or feed items timed to filings; follow, copy or "trade like" features (POLICY F3b, F2).
- Estimates for company insiders (their filings carry real prices; F-7).

## Open questions
- The owner decisions OD-1 to OD-15 (review §7).
- Every item under "Proposed shape" until the owner confirms it.
- The attorney questions A1 to A7 (review §6).
- Whether a holdings-report share card shows the firm's name and figure (review §4.5).
- Whether to proceed to step 2 at all if step 1 misses its business gate (the business lead's dissent, review §A.3).

## POLICY notes
- **Estimates are blocked today.** CLAUDE.md says "never guessed", F-7 L5 says "never estimated", and POLICY F3c sets
  the related standard. Step 3 needs the owner's carve-out and the new F3d (OD-7).
- **Amount bands are dollar figures**, which POLICY P3 bars. No band is shown until the owner amends P3 (OD-7c).
- **Real names in production data** (T1 for firm names, T2 for people) and the **P3 consent reading** need the
  owner's OD-4 confirmation before step 1, plus the F-7 switch-on checklist.
- **Officials' and institutions' data** never enter a paid feature (F5) and are never ranked (F1) (OD-3).

## Rework notes

## Build log
