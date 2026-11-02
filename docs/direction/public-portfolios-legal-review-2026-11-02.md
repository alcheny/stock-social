# Public portfolios: legal review and design council (2026-11-02)

**This is general research by an AI legal committee and design council. It is not legal advice and not a licensed
attorney's opinion.** Under the owner decision of 2026-11-01 (top of `docs/POLICY.md`), the committee's findings stand
in for counsel where POLICY or `docs/COMPLIANCE.md` asks for counsel. The owner makes every call they leave open. The
committee marks the questions where it recommends a licensed attorney's written opinion before launch (§6, for the
staged attorney review of owner item 2.54). Laws and court decisions change. Every source below was read or searched
on 2026-11-02 unless marked otherwise.

**The owner's direction (2026-11-02, in chat).** The owner asked for a profile type based on the standard profile for
public people and portfolios such as politicians, with returns estimated and given statistical confidence, and for a
legal review first, including other public filings by institutions and "private holdings".

**Scope.** Review only: no code was written. F-7 (`docs/features/F-7-public-traders.md`) is built and switched off
(`PUBLIC_TRADERS=0`). It uses only company insiders' transaction reports, and returns come only from the prices in
those reports.

**Wording rules (POLICY T1/T2).** This document names no real people or private companies. Court decisions are cited by
reporter citation, court and year only, never by party name. Government bodies, statutes, regulations, release
numbers, form numbers and government web addresses are named, as the owner's brief allows.

**How it was made (§A).**
- Five research agents with fresh context, one per source category plus one on cross-cutting risks, each citing
  primary sources.
- A legal committee of three independent reviewers (litigation, regulatory, and a media-law skeptic). They debated
  three rounds and signed consensus items C1-C12 with no dissent.
- A design council of five (UX lead, business lead, engineer, legal member, record-trust red team). It met over three
  rounds and signed P1-P10 with no dissent.
- A final red team on the combined result.

Confidence labels:
- **High**: the primary text was read in this session.
- **Medium**: the primary text was read in part, or an established authority is cited without being re-read.
- **Low**: secondary sources or inference only.

---

## 1. Executive summary

### 1.1 Verdict per source category

"Actual" means a return computed from prices in the filing itself. "Estimated" means a range computed from disclosed
dates and bands plus outside market prices.

| # | Source | Actual return | Estimated return | Facts only (no return) | Confidence |
|---|---|---|---|---|---|
| 1a | Federal legislators' periodic transaction reports | **Not possible** (no prices filed) | **Go-with-limits, launch-gated**: attorney opinion on 5 U.S.C. § 13107(c), owner rule changes, a licensed price source, a passed back-test | **Go-with-limits, launch-gated**: the same attorney opinion | Medium on the statute's text; low on how a court would class this product |
| 1b | Executive-branch reports posted online (top officials) | Not possible | Same as 1a | Same as 1a | Medium |
| 1c | Executive-branch reports available only by written application | Not possible | **No-go** | **No-go** | High |
| 1d | State officials' disclosures | Not possible | **No-go by default** (no dated trades); state-by-state statute check first | **No-go by default** | Medium-high |
| 1e | Federal judges' reports | Not possible | **Not at launch** | **Not at launch** | Medium |
| 2 | Institutional managers' quarterly holdings reports (Form 13F) | **No-go** as "the firm's return" | **Go-with-limits**: a firm-level "hypothetical holdings return" from the firm's own reported values. Entity filers only, unranked at launch, no vendor needed | Go | Medium-high |
| 3a | Company insiders' reports (Forms 3, 4 and 5) | **Go-with-limits**, as built in F-7 (re-confirmed) | **No-go** | Go (F-7) | High |
| 3b | Beneficial-ownership reports, Schedule 13D | **Narrow go-with-limits**: only chains where both legs carry Item 5(c) prices | **No-go** | Go-with-limits (holdings as filed) | High |
| 3c | Beneficial-ownership reports, Schedule 13G | **No-go** (no transactions, dates or prices) | **No-go** | Holdings as filed only | High |
| 4 | "Private holdings": exempt-offering notices (Form D, Form C), private fund data (Form PF, Form ADV Schedule D), the broker-registration lookup, property, court and probate records | **No-go** for any holdings or returns profile of a natural person or private fund | **No-go** | Entity-level facts only, in their filed business role; not a profile | High |

### 1.2 What this means

- The owner's profile type can exist in a limited form now. The first step is a firm-level **holdings report** profile
  built from Form 13F. Its number is a clearly labeled hypothetical return computed from the firm's own reported
  values. It needs no market-data vendor, no change to the "never guessed" rule and no attorney.
- **Politicians' profiles wait for one legal question.** Federal law makes it unlawful to "obtain or use" these reports
  "for any commercial purpose, other than by news and communications media for dissemination to the general public"
  (5 U.S.C. § 13107(c)(1)(B)). The exception is undefined, no court has read it, and the federal government enforces
  it. The committee unanimously recommends a licensed attorney's written opinion before any production use, including
  a facts-only mode. The owner may instead accept the risk in writing, against that recommendation (C1).
- **Estimated returns are possible only as ranges.** The reports give the trade date but no price, so the honest output
  is a fixed range per trade: worst case buy at the day's high and sell at the day's low, best case the reverse. A
  profile-level range appears only after gates on coverage and selection bias pass (§4). It is never a point figure,
  never "Verified", never ranked, and never carries "confidence" wording until a published back-test supports it.
- **Repository rules block estimates today.** The product rules in CLAUDE.md say "never guessed", F-7's condition L5
  says "never estimated", and POLICY P3 bars dollar amounts, which the filed amount bands are. Only the owner can
  change these (§7).

### 1.3 Top five risks

1. **The commercial-use bar on officials' reports** (5 U.S.C. § 13107(c)). It covers obtaining as well as using, and
   derived figures almost certainly count as "use". The statutory civil penalty is up to $10,000. For
   executive-branch reports it is adjusted to $25,132 (5 CFR 2634.703). It is enforced by the Attorney General.
   Medium.
2. **Defamation and false light from a wrong estimate or a transcription error** about a named person. Two points
   shape this:
   - The fair-report privilege protects the record, not the platform's derived figure.
   - The opinion defense holds only if the inputs, method and range are disclosed and correct (497 U.S. 1 (U.S.
     1990)). Spouses, other family members and lower-level filers may be private figures, who need show only
     negligence (418 U.S. 323 (U.S. 1974)).

   Medium-high.
3. **Misleading estimates through selection.** Keeping only "clean" matches can drop losing trades (the committee's own
   first rule did this; §A.3). Dropping open positions and sold-out 13F positions hides losers. A guessed number next
   to "Verified" also teaches viewers that the product's numbers can be guesses. High for record trust.
4. **Right of publicity and implied endorsement from paid-tier adjacency.** A 2026 federal appeals decision affirmed
   class certification on the theory that names searchable inside an "advertising flow" may be "so directly connected"
   to paid advertising (9th Cir. No. 24-3894 (2026); Cal. Civ. Code § 3344(e)). Names in the product's own ads would be
   worse (15 U.S.C. § 1125(a)). Medium.
5. **Securities-law drift and market-data licensing.** The publisher's exclusion (15 U.S.C. § 80b-2(a)(11)(D);
   472 U.S. 181 (U.S. 1985)) holds only while pages stay impersonal records. Alerts, follow, copy, timed items or
   rankings of officials push toward a "signal". Separately, estimates need licensed historical prices, and licences
   often restrict derived data. Medium.

### 1.4 Owner decisions needed (detail in §7)

- **OD-1.** Adopt these verdicts and the three-step sequence.
- **OD-2.** Put the § 13107 question into the staged attorney review (item 2.54).
- **OD-3.** Keep officials' and institutions' data permanently out of paid features, ads and upsells.
- **OD-4.** Confirm that F-7's "names in production data" reading covers 13F firm names and adopt the tightened T2
  text.
- **OD-5.** Choose the indexing and removal policy.
- **OD-6.** Exclude filers resident in the EU or UK.
- **OD-7** (later). The "never guessed" carve-out, the new F3d rule, the P3 band exception and a price source, only
  before step 3.
- **OD-8.** Two follow-ups found during the review: a label on F-7 and a TR-9 gap in `confidence()`.

### 1.5 Questions for the attorney (detail in §6)

- **A1** (must, before any officials' page in production): does the news-media exception in § 13107(c) cover this
  product?
- **A2** (must, before real officials' names): the defamation review of the method and the copy.
- **A3-A4** (should): publicity and paid-tier separation; the publisher's exclusion, and how the advisers' marketing
  rule applies to advisers who reuse the cards.
- **A5** (contract review, when a vendor is chosen): the market-data licence.
- **A6-A7** (optional, mitigated): GDPR reach to filers in the EU; CCPA "inferences".

---

## 2. Findings per source category, with citations

### 2.1 Federal legislators' and executive officials' reports (category 1)

**The restriction (high).** 5 U.S.C. § 13107(c)(1) makes it unlawful for any person to obtain or use a report:
- "(A) for any unlawful purpose;"
- "(B) for any commercial purpose, other than by news and communications media for dissemination to the general
  public;"
- "(C) for determining or establishing the credit rating of any individual; or"
- "(D) for use, directly or indirectly, in the solicitation of money for any political, charitable, or other purpose."

**Enforcement and penalty.**
- The remedy is in § 13107(c)(2): "The Attorney General may bring a civil action against any person who obtains or
  uses a report for any purpose prohibited in paragraph (1)". The court "may assess against such person a penalty in
  any amount not to exceed $10,000", in addition to other remedies. There is no private right of action (high).
- For executive-branch reports, OGE's adjusted figure is $25,132 for violations after 2 Nov. 2015 (5 CFR 2634.703(a);
  90 FR 3612, 15 Jan. 2025) (high). No adjustment was found for legislative-branch reports. The Department of
  Justice's penalty table, 28 CFR 85.5, has no row for this provision (medium).
- The statute does not say whether each report, each use or each day counts as a separate violation (attorney, A1).

**Access rules, retention and the application regime.**
- **Written applications.** Paper access requires a written application giving the requester's name, occupation and
  address, the person or organization the request is for, and a statement that the requester knows the prohibitions.
  The applications are themselves public (§ 13107(b)(2)).
- **Retention.** Reports stay public for six years. For a Member of Congress the six years run from leaving office.
  After that the reports are destroyed (§ 13107(d)) (high).
- **The upper chamber's search site** requires each user to accept "I understand the prohibitions on obtaining and use
  of financial disclosure reports" before searching (https://efdsearch.senate.gov/search/home/) (high).
- **The lower chamber's site** states that "It is unlawful to use the information contained in these Financial
  Disclosure Statements" for the four purposes, and it offers bulk files
  (https://disclosures-clerk.house.gov/FinancialDisclosure/ViewSearch) (high). Its wording, "information contained
  in", is broader than the statute's "a report".

**What a transaction report contains (high).** Under 5 U.S.C. § 13104(a)(5): "a brief description, the date, and the
category of value" of each purchase, sale or exchange over $1,000. There is no price and no share count.
- **Value categories, § 13104(d)(1).** Ten bands, from "not more than $15,000" to "greater than $50,000,000".
- **Spouses' items.** Spouse items over $1,000,000 that are not held jointly are reported only as "greater than
  $1,000,000" (§ 13104(e)(1)(F)).
- **Timing.** Members, senior executive officials and others must report within 30 days of notification, and no later
  than 45 days after the transaction (5 U.S.C. § 13105(l), added by STOCK Act § 6, Pub. L. 112-105, 4 Apr. 2012).
- **Correction to the owner's premise.** The report gives the transaction date, not a date window. The uncertainty is
  in the price, the band, which earlier purchase a sale closes, and whose trade it is (C5).

**Later laws left the bar alone (high).**
- Pub. L. 113-7 (15 Apr. 2013) limited mandatory online posting to the President, the Vice President, Members of
  Congress, candidates and Senate-confirmed officials at Executive Schedule levels I and II. It also removed the
  requirement that the databases be searchable, sortable and downloadable.
- Neither that law nor the STOCK Act amended the commercial-use bar.
- The 2022 recodification (Pub. L. 117-286) moved the text to § 13107.
- **Bills from 2023 to 2026 (medium).** None of them would loosen the bar. A House bill restricting members' trading
  passed on 22 July 2026 (232-198). In the Senate, a cloture vote on proceeding failed on 30 Sept. 2026, so it is not
  law. Sources: https://www.congress.gov/bill/119th-congress/house-bill/7008; the press tallies were not confirmed
  against the official journal.

**Interpretation of "commercial purpose" and "news and communications media" (low; a negative finding).**
- No court decision interpreting either phrase in § 13107(c) or its predecessor (5 U.S.C. app. § 105(c)) was found.
  No enforcement action was found either. The search used limited tools, so a docket search is attorney item A1.
- The closest analog is the ban on sale or use of contributor data from campaign-finance reports (52 U.S.C.
  § 30111(a)(4); 11 CFR 104.15). One appeals court read "commercial purposes" by the statute's purpose and allowed
  research-oriented compilations: 943 F.2d 190 (2d Cir. 1991). The en banc D.C. Circuit upheld the ban against a
  First Amendment challenge where the data became a mailing list: 969 F.2d 1110 (D.C. Cir. 1992) (en banc). The
  election agency cleared news websites that showed the data free (MURs 6053 and 6065, 2009,
  https://www.fec.gov/files/legal/murs/6053/10044264486.pdf) (medium).
- **The committee's caution (L2, L3).** The ethics statute's exception turns on who the user is (news and
  communications media), not only on the purpose. The analog is therefore weaker than it looks.
- **Where the definition might come from.** A court looking for a definition might borrow the freedom-of-information
  definition of a representative of the news media (5 U.S.C. § 552(a)(4)(A)(ii)): one that "gathers information of
  potential interest to a segment of the public, uses its editorial skills to turn the raw materials into a distinct
  work, and distributes that work to an audience" (high for the text). Analysis such as methods, ranges and context
  fits that test better than a bare data feed or an API.
- **First Amendment backdrop (medium).** 564 U.S. 552 (U.S. 2011) (data as speech); 443 U.S. 97 (U.S. 1979)
  (publishing lawfully obtained truthful information); 528 U.S. 32 (U.S. 1999) (conditions on access upheld). An
  as-applied challenge is plausible, untested and costly: a fallback, not a plan.

**Derived or estimated figures are "use" (medium).** Computing an estimate from a report's dates and bands uses the
report, and the lower chamber's own wording ("information contained in") points the same way. The question is
whether the purpose is commercial and whether the user is news media.

**The committee's reading of paid tiers (C3; L2's point, adopted by all).** A paid tier elsewhere in the product does
not by itself take the product outside the exception, since paid newspapers are the standard example of media. It
does weaken the claim to be media. Any paid feature that uses officials' data, or any upsell, join prompt or
advertising on their pages, very likely falls outside it. F-7's legal finding 2 said that any paid tier takes the
product outside. The committee now reads that as too broad, but the practical rule is the same.

**Executive-branch officials (high).**
- **The same bar applies** (5 CFR 2634.603(f)).
- **Posted reports.** Reports are posted online only for the top officials (Pub. L. 113-7). The government's site for
  them uses a click-through acknowledgment.
- **Every other report** needs a named written application (5 CFR 2634.603(c); application form OGE 201). The
  application is public (§ 2634.603(d)) and carries a false-statement warning under 18 U.S.C. § 1001. Applying at
  scale for a commercial product would leave a public trail and invite a false "news media" statement. That is why
  verdict 1c is no-go.

**Data access (C7).**
- Use the lower chamber's bulk files first.
- Retrieve posted executive reports within the posting site's terms.
- Make no automated use of a site that requires an acknowledgment before each search until counsel reviews its terms.
- A licensed data intermediary does not shift § 13107 risk to itself.
- **G41.** Until the § 13107 gate clears, no environment fetches or parses real officials' reports, because obtaining
  them for a commercial purpose is itself barred. Fixtures are fictional.

**State officials (medium-high).** Four large states were checked. None has a commercial-use bar like the federal one.
- **California.** Gov. Code § 81008: "No conditions whatsoever shall be imposed upon persons desiring to inspect or
  reproduce reports".
- **New York.** Public Officers Law § 73-a; Executive Law § 94; 19 NYCRR Part 937.
- **Texas.** Gov't Code § 572.032. Each request is logged with the requester's name for one year.
- **Florida.** § 112.31445.

Their annual statements generally lack dated trades, so per-trade estimates are usually impossible. Several states
redact officials' home addresses and dependents' names before posting, and the product stores neither. Check each
state's statute before any use. Federal judges' reports carry the same bar and judicial redactions, so they are not at
launch (L1, L3).

**Family lines (C6, high consensus).**
- Dependent-child lines are dropped before storage. They can concern minors (POLICY P4), and children are the
  weakest public-figure case.
- Spouse and joint lines are never named, never estimated and never shown row by row. They appear only as one count:
  "Family-member and joint transactions not shown: N".
- Real-property lines and any address or family fields are never stored.

### 2.2 Institutional managers' quarterly holdings reports, Form 13F (category 2)

**Who files and what is reported (high).** Managers with investment discretion over at least $100,000,000 in
§ 13(f) securities file within 45 days after each calendar quarter (15 U.S.C. § 78m(f)(1); 17 CFR 240.13f-1(a)(1)).
- **What the filing lists.** Quarter-end long positions in listed securities: issuer, class, identifier, share count,
  value and voting authority.
- **What it leaves out.** Trade dates, trade prices, short positions ("You should not include short positions", staff
  FAQ 41), cash, and most non-US-listed securities. Options are reported as the underlying.
- **The threshold.** A 2020 proposal to raise it (Release 34-89290) was never adopted.
- Source: https://www.sec.gov/rules-regulations/staff-guidance/division-investment-management-frequently-asked-questions/frequently-asked-questions-about-form-13f.

**Public availability and reuse (high).**
- The regulator's website policy: "Information presented on sec.gov is considered public information and may be
  copied or further distributed by users of the web site without the SEC's permission", with attribution requested
  (https://www.sec.gov/about/privacy-information). No commercial-use restriction was found.
- **Fair access.** At most 10 requests a second, with a declared User-Agent naming the company and a contact
  (https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data).
- **Data quality.** The regulator's structured 13F data sets carry the warning "we cannot guarantee the accuracy"
  (https://www.sec.gov/data-research/sec-markets-data/form-13f-data-sets). Its Inspector General found in 2010 that no
  division or office "monitors the Form 13F filings for accuracy and completeness" (Report No. 480, 27 Sept. 2010,
  https://www.sec.gov/files/480.pdf).

**Confidential treatment and amendments (high).** Since Release 34-95148 (87 FR 38943, 30 June 2022), confidentiality
requests are a separate, non-public filing. Withheld positions appear later in amendments: staff FAQ 58 says within
six business days after a denial or expiry. Amendments can restate the original. A derived record must therefore be
versioned and rebuilt, never patched, and the page must say that positions can be withheld.

**Short positions.** Rule 13f-2 and Form SHO (Release 34-98738) will publish short data only in aggregate across
managers, never per manager. Compliance has been postponed to 2 Jan. 2028 (medium, from secondary summaries of the
2025 order).

**Related public holdings sources (medium).**
- **Form N-PORT.** Registered funds' monthly holdings. Only the third month of each quarter is public, 60 days after
  quarter end. Monthly publication is delayed to 17 Nov. 2027 and 18 May 2028 (https://www.sec.gov/rules-regulations/2025/04/s7-26-22).
- **Form N-CSR** is public. **Form N-Q** was rescinded in 2019.

**Conclusion (C8, medium-high).** Any return built from 13F is hypothetical: what the reported quarter-end holdings
would have returned. It is not what the firm earned. It is allowed only:
- at firm (entity) level, never for natural-person filers;
- labeled "Hypothetical holdings return (not the firm's return)";
- with the exclusions and the 20% cap in §4.2;
- unranked at launch.

The figure is computed from the filing's own values, so it needs no market-data vendor. The business lead and the
legal member read it as "computed, not guessed". The owner confirms that reading (OD-4).

### 2.3 Beneficial-ownership reports and company insiders' reports (category 3)

**Company insiders, re-confirmed (high).** These are Exchange Act § 16(a) reports (15 U.S.C. § 78p(a); Rules 16a-1 to
16a-13).
- **Timing.** Form 4 is due within two business days (§ 78p(a)(2)(C)).
- **Prices.** The form requires prices "in U.S. dollars on a per share basis", one line per transaction, with
  transaction codes (https://www.sec.gov/files/form4.pdf).
- **2022 amendments** (Release 33-11138, effective 27 Feb. 2023). A box marks a trade made under a trading plan, and
  gifts are reported on Form 4.
- **New in 2026.** A 2025 statute (Pub. L. 119-60, § 8103, 18 Dec. 2025) and Release 34-104903 bring directors and
  officers of foreign private issuers under § 16(a) from 18 Mar. 2026. Their 10% holders stay exempt, and an exemptive
  order (34-104931) covers some jurisdictions (medium).
- **Effect on F-7.** Nothing in the analysis changes, except that no copy may imply complete coverage of insiders.
  F-7's verdict stands: go-with-limits, with actual returns from report prices only.
- **Estimates for insiders: no-go.** The real prices exist, so an estimate would be a worse number than the filing.

**Schedule 13D (high).** Item 5(c) requires transactions in the past 60 days with "the price per share or unit"
(17 CFR 240.13d-101). Staff interpretation 110.08 allows a weighted average within a $1 range if the range is
footnoted.
- **The 2023 amendments** (Release 33-11253, 88 FR 76896, 7 Nov. 2023) shortened the deadlines and required
  structured data from 18 Dec. 2024. Item 5(c) is still free text.
- **What the regulator's own data shows.** In that release, only about 20% of initial 13Ds from 2011 to 2021 had
  tabular trade histories, and many filers are private individuals.
- **Consequence.** The opening stake usually has no price. The verdict is a narrow go, only where both legs carry
  Item 5(c) prices. Guessing a basis is a no-go.

**Schedule 13G (high).** It reports holdings with no transactions, dates or prices (17 CFR 240.13d-102). No return of
any kind is possible.

**Reuse and redaction (high).** The same public-information statement applies. Staff will not redact a filing only
because it contains a home address (17 CFR 232.15; Release 33-10901), and cannot recall data that others have already
copied. The product never stores or shows addresses.

### 2.4 "Private holdings" (category 4)

**Off-limits sources.**
- **Form PF is confidential by statute (high).** Advisers Act § 204(b)(8): "the Commission may not be compelled to
  disclose any report". § 204(b)(10) exempts these reports from the freedom-of-information law (15 U.S.C. § 80b-4(b)).
  Only aggregate statistics are public.
- **Also closed:** non-public N-PORT months, anything under confidential treatment (17 CFR 200.83), other people's
  account statements, leaked data, and data bought from data brokers about people who are not customers.

**Public sources that name people (high).** These sources name issuers' people but not their investors:
- **Form D** (17 CFR 230.503). Item 3 asks for the "full name and address" of executive officers, directors and
  promoters. Item 14 asks only for investor counts.
- **Form C** (17 CFR 227.201(b)-(c)). It names directors, officers and owners of 20% or more of the voting equity.
- **Form ADV** Part 1A Schedule D. It gives private-fund gross asset values and owner counts by fund.

None of these reveals what a named person owns or a return.

**The broker-registration lookup (medium-high).** It shows registrations, not holdings. FINRA Rule 8312 and the
lookup's terms limit reuse to investor-protection, academic, compliance or regulatory purposes, and commercial
compilations need a licence (https://www.finra.org/rules-guidance/rulebooks/finra-rules/8312).

**Privacy and data-broker law (medium).**
- **California's privacy law.** It excludes information "lawfully made available from federal, state, or local
  government records" (Cal. Civ. Code § 1798.140(v)(2)). It defines "sale" as passing data to a third party for
  consideration, so free display on the product's own site is likely not a sale.
- **The federal financial-privacy rules** treat government-record information as publicly available (16 CFR
  313.3(p)). Reading public filings does not make the product a financial institution.
- **Data-broker registration laws.** California's (Civ. Code § 1798.99.80 et seq.) has the deletion platform
  operating from 1 Aug. 2026. Vermont (9 V.S.A. § 2430), Oregon (ORS 646A.593) and Texas also have such laws, and
  Texas broadened its law in 2025. These laws reach businesses that sell or license data about people they have no
  relationship with. Licensing the data, an API or sharing with advertising networks would raise the risk.
- **Credit reporting.** The federal credit-reporting law (15 U.S.C. § 1681a(d)) could apply if profiles were used for
  hiring, lending, tenancy or similar decisions, so the Terms bar that use (C3).

**Conclusion (C11, high).** There is no holdings or returns profile of any natural person or private fund. Entity-level
facts may appear only in their filed business role, with a link to the official source, and are out of scope for this
feature.

---

## 3. Cross-cutting risks

| Risk | Law | Committee finding | Control | Confidence |
|---|---|---|---|---|
| Defamation and false light | 376 U.S. 254 (U.S. 1964), actual malice for public officials; 418 U.S. 323 (U.S. 1974), at least negligence for private figures; 497 U.S. 1 (U.S. 1990), no blanket opinion privilege, statements implying provable facts are actionable; Restatement (Second) of Torts § 611 (fair report) and § 652E (false light; several states reject the tort) | The fair-report privilege covers the record, not the platform's derived figure. Treat an estimate as the platform's own statement, defended as a computation on disclosed true inputs. A transcription error is a false fact with no opinion defense. Motive words imply undisclosed misconduct. Spouses and lower-level filers may be private figures | Inputs (filing link, band, date) beside every estimate; method on /how; range only, never a point value; no motive, comparison or legal-conclusion words (list in §5); transcription QA; a dispute withdraws the whole estimate within a set review time (P9); media liability insurance before real names | Medium-high |
| Platform's own content | 47 U.S.C. § 230(c)(1), (f)(3) | Section 230 does not cover figures the platform computes | No reliance on § 230 for these pages | High |
| Right of publicity | Restatement (Second) of Torts § 652C; Restatement (Third) of Unfair Competition §§ 46-47; Cal. Civ. Code § 3344(d) (news and public affairs) and (e) (paid-advertising connection is a question of fact); N.Y. Civ. Rights Law §§ 50-51; 9th Cir. No. 24-3894 (2026) (class certification affirmed where names sat in an "advertising flow"; liability not decided; https://cdn.ca9.uscourts.gov/datastore/opinions/2026/09/24/24-3894.pdf) | The record page itself is a public-affairs use. Risk comes from upsells, sign-up prompts or ads on or after these pages, and from names in marketing | No paid features, upsell, join prompt or display advertising on these pages; names never in the product's own ads, emails or marketing | Medium |
| Implied endorsement | 15 U.S.C. § 1125(a)(1)(A); 16 CFR part 255 | Showing data is not an endorsement; ads would be | A not-joined, not-reviewed, no-endorsement line before any figure; no names in ads | Medium-high |
| Investment advice and signals | 15 U.S.C. § 80b-2(a)(11) and (D); 472 U.S. 181 (U.S. 1985) (publications that are impersonal, bona fide, and of general and regular circulation); state analogs | Impersonal records fit the exclusion. Alerts timed to filings, follow, copy, or rankings of officials look like the timed bulletins the 1985 decision excluded | No alerts, emails or feed items from filings (POLICY F3b); never rank officials; no 13F ranking at launch; disclaimer everywhere; no payment from rated firms | Medium-high |
| Advisers reusing cards | 17 CFR 275.206(4)-1 (third-party ratings; hypothetical performance) | The rule binds advisers, not the platform. A firm that reuses a 13F card takes on its disclosure conditions | Card and page carry the date, period, method and "hypothetical"; the platform takes no payment from firms | Medium-high |
| Scalping and manipulation | 375 U.S. 180 (U.S. 1963); Rule 10b-5 | Applies only if staff trade around publication | An employee trading policy before any ranking or schedule change | High |
| Market-data licensing | Exchange and vendor contracts; Release 34-90610 (2020) does not create redistribution rights | Estimates need historical daily high and low prices. Licences often restrict non-display and derived data. Percent-only output is the best position; showing prices is display. Whether SnapTrade's terms supply or permit such prices for non-users is unknown | No estimate until the owner approves a source and a contract review (A5); percent only | Medium |
| Privacy for private individuals | Cal. Civ. Code § 1798.140(v)(2); 420 U.S. 469 (U.S. 1975); 491 U.S. 524 (U.S. 1989) | Truthful public-record facts are protected; a derived estimate is not itself a public record. Whether an estimate is a privacy-law "inference" is open | No estimates for private persons; family lines aggregated; no addresses | Medium |
| EU and UK | GDPR Art. 3(2)(a) and (b), Art. 14; C-184/20 (CJEU, Grand Chamber, 1 Aug. 2022) (online publication of officials' declarations, especially spouses' data, held disproportionate); joined C-37/20 and C-601/20 (CJEU 2022) | Blocking EU and UK users answers (a), offering services, but not (b), monitoring the behaviour of people in the Union, for filers resident in the EU or UK | Exclude filers resident in the EU or UK (OD-6) | Low-medium |
| Solicitation and credit use | 5 U.S.C. § 13107(c)(1)(C)-(D) | These bars apply whether or not the use is commercial | No donate, fundraising or solicitation content near officials' data; Terms bar credit, lending, tenancy and hiring use | High |

---

## 4. Proposed profile type and estimation method

The design council's signed proposal (P1-P10), within C1-C12.

### 4.1 One profile family, three types (P1, P2)

**Where it lives.** A separate "Public disclosures" area (`/disclosures/...`) reuses the standard profile's layout
components, so it looks like a profile. It has its own raw and derived tables and creates no `users` rows. That keeps
these records out of `closed_trades`, the trader feed, similar, suggest, rankings, follow, like, thesis, share
prompts, join prompts, recaps, paid tools and ads by construction.

**Switches.**
- `PUBLIC_DISCLOSURES` is off in production.
- Each source has its own flag.
- `PUBLIC_ESTIMATES` is off and refuses to turn on without an approved price source and the owner's rule-amendment
  setting.

**Types.**
- **Holdings report**: a firm filing 13F (entity filers only).
- **Legislator disclosure.**
- **Executive official disclosure**: posted officials only.

**Labels.** The badge reads "Public disclosure", never Verified. The header runs: badge, name as filed, type line,
then a source line with a link. Before any figure comes this line (13F says "This firm" and omits the last sentence):

> This record is built from public disclosures. This person has not joined Stock Social, has not connected a broker,
> has not reviewed this record and does not endorse it. Nothing here suggests why any transaction was made.

The disclaimer "Not investment advice. Past performance does not guarantee future results." is on every screen.

**Where the law forbids an estimate: facts-only mode** (P5). There are no percentages and no chart. Each row shows:
- the date and the asset as filed;
- purchase or sale;
- "Reported N days after the transaction date", never "late";
- a link to the filing.

Other rules:
- **No amount band** until the owner amends P3. After that, the band appears exactly as filed.
- **Unsold purchases** read "N reported purchases with no reported full sale", never "still held".
- **The page says** "Returns aren't estimated for this record."
- **Family lines** appear as the single count from §2.1.
- **Expiry.** Entries leave when the report's public period ends.
- **Indexing.** Officials' pages are noindex at launch.
- **Removal.**
  - Elected and posted officials: not removed on request. They are hidden only for an error, a dispute or expiry.
  - Other filers: removed on request.

Where even facts-only is barred (verdicts 1c and 4), nothing is shown.

### 4.2 Holdings report method (13F, step 1; P4)

For each quarter, use the positions held at both quarter ends. The price per share at each end is the filer's own
value divided by its share count. Weight each position by its value at the start of the quarter:

```
r_i = (V_end,i / S_end,i) / (V_start,i / S_start,i) - 1
R_q = Σ w_i r_i,   w_i = V_start,i / Σ V_start (included positions)
```

- **Label:** "Hypothetical holdings return (not the firm's return)".
- **Sub-line:** "Computed from the firm's own reported quarter-end values, which the regulator does not review. Trades
  inside the quarter, short positions, cash and fees are not reported, and options lines and dividends are left out,
  so none are included."
- **Excluded positions** are counted, and their share of start value is shown:
  - positions exited during the quarter;
  - positions affected by a split or other corporate action without documented split data;
  - outlier implied prices, judged against other filers' values for the same security and quarter;
  - options lines.
- **Excluded share** = start value of excluded positions ÷ start value of all non-option positions. **No figure for a
  quarter when it exceeds 20%.**
- **Other omissions.** Opened positions are counted, not valued. Quarters with confidential-treatment omissions carry
  a caveat and stay outside the ratio, because their value is unknown.
- **Positions exited during the quarter** are where sold losers hide. They can be included only with an approved
  price source and the owner's "never guessed" amendment, under a stated "held to quarter end" assumption.
- **Amendments** supersede the original and trigger a rebuild.
- **No ranking at launch.**
- **Indexing.** Firm pages may be indexed with metadata that carries no figures.
- **Business gate** (P3): after four weeks, at least 1,000 views a week from referrers outside the product, and at
  least 10% of those visitors opening a trader record by normal navigation. If either fails, stop and ask the owner
  whether to remove the pages (deletion is the owner's call, POLICY H).

### 4.3 Estimated range for officials (step 3 only; P6, C5 as corrected)

**Eligibility (rules U1-U8).** Only the filer's own lines are used: no spouse, joint or child lines. A sale is
estimated only when all of the following hold. Otherwise it is excluded and counted by reason.
- **U1.** Exactly one self purchase of that security is open.
- **U2.** No earlier holding of it appears in the annual report.
- **U3.** The sale is not proven larger than the lot:
  `Σ over the lot's sales of (sale_band_lower / sale_day_high) ≤ purchase_band_upper / purchase_day_low`.
- **U4.** No family lines exist in that security.
- **U5.** It is not a same-day round trip.
- **U6.** The asset maps to one listed share.
- **U7.** No merger or similar event falls between the legs.
- **U8.** Prices exist for both days.

The committee's first test compared each band's upper bound with that day's low price. It was withdrawn because it
drops losing trades and keeps winning ones (§A.3).

**Per-trade range.** Price return only, as a fixed interval:

```
worst_i = sell_day_low  / buy_day_high - 1
best_i  = sell_day_high / buy_day_low  - 1
```

Each range shows its inputs: the date, the band once P3 allows it, and the filing link. Beside it: "Estimate from
public disclosures".

**Open positions.** Each open self purchase is priced and included as an unrealized trade. Its range runs from the
buy-day range to the latest close. If any open self purchase cannot be priced, no profile range is shown.

**Profile range (shown only after the gates below).** Use the analytic envelope

```
[ mean(x_lo) - t·SE⁺ ,  mean(x_hi) + t·SE⁺ ]
```

where:
- `x = ln(1 + r)` for each trade's worst and best case;
- `SE⁺` is the largest cluster-robust standard error over prices inside the day ranges;
- clusters merge transitively: trades in the same symbol with overlapping holds, and trades on the same date;
- `t` is Student's t with K−1 degrees of freedom, as in TR-9.

This envelope contains the exact range of the equal-weight average and the TR-9 interval of every in-range price path.
It is one pure function with property tests, like `confidence()`.

**Gates per filer.** All four must hold. Otherwise the page shows per-trade ranges and the reason.
- K ≥ 5 clusters.
- At least 50% of reported sales are estimated. Family and joint lines count in the denominator.
- Every open self purchase is priced.
- The envelope's half-width is at most 10 points.

**What is never shown.**
- A point value.
- An Edge verdict, tier words such as "thin" or "strong", or a trust line. Plain sample facts only: "Based on N round
  trips over D days."
- Colour on a range that crosses 0%: it is never coloured as a gain or a loss.
- "Confidence", "likely" or "90%", until the back-test in §4.4 passes and is published.
- A ranking.

### 4.4 Back-test that unlocks estimates (P8)

All four parts are pre-registered before running:
- **(a) Pipeline coverage.** Use held-out company-insider round trips with their prices hidden. The Wilson lower bound
  must be at least 98%, over at least 1,000 trips from at least 100 filers over 3 years. Day-range coverage is near
  100% by construction, so this tests the pipeline: dates, symbols, matching.
- **(b) Date shifts.** A stress run with the date moved ±1 and ±2 days.
- **(c) Selection bias.** Take insider filers with K ≥ 5 and apply U1-U8 to their trades. The full record's
  equal-weight average must fall inside the selected subset's range for filers at a Wilson 95% lower bound of at
  least 90%. A sign test at the 5% level must also show no skew of misses toward a higher subset average. This merges
  the engineer's and the business lead's amendments, keeping the stricter of each.
- **(d) Hand-checked audit of officials' reports.** At most 1% error per field, and zero mapping errors in at least
  200 checked trades. This runs only after the § 13107 gate (G41).

Results are published on /how only.

### 4.5 Share cards and charts (P7)

- **People's cards.** At launch there is no chart and no figure on any person's card or link preview. The card is
  generic: the type label, "Public disclosure record", the not-joined line and the disclaimer. It carries no name and
  no number.
- **Estimates on cards.** "Estimate from public disclosures" appears only where estimates are shown.
- **13F cards.** Whether a card shows the firm's name and figure is the owner's call.
- **Charts.** A range chart (a shaded band between the low and high paths, 0% on the axis, no midpoint line) is parked
  until after launch.

### 4.6 Sequence (P3)

1. **Step 1.** 13F holdings reports. They need no vendor, no rule change and no attorney (the committee's findings
   stand in, owner decision 2026-11-01). Business gate after four weeks.
2. **Step 2.** Legislators' and posted executive officials' facts-only pages. Only after the § 13107 attorney opinion
   (A1), or the owner's written risk acceptance against the committee's recommendation. Also needed: the source flag
   (F-7 L2), the owner's acceptance of F-7 finding 3 (a profile with no computed return), A2 and media liability
   insurance.
3. **Step 3.** Estimated ranges. Only after the owner's rule amendments (OD-7), an approved price source with a
   contract review (A5), and the back-test (§4.4).

---

## 5. Acceptance criteria for a future feature

These are copied into `docs/features/F-37-estimated-public-portfolios.md`, which is the authority once the owner
decides. Each line is testable.

**All steps.**
- **AC1.** With `PUBLIC_DISCLOSURES` unset or 0 in production, no `/disclosures` route, card, preview or importer is
  reachable or runs. It is on in dev, test and CI, using fictional fixtures only.
- **AC2.** Disclosure records create no `users` row and never appear in `closed_trades`, the feed, similar, suggest,
  rankings, follow, like, thesis, share prompts, join prompts, recaps, record tools, exports, an API, or any paid
  feature. A test walks every public route and asserts this.
- **AC3.** Every disclosure page shows the "Public disclosure" badge and never "Verified". It shows the source line
  with a link, the type's not-joined line before any figure, and the disclaimer. It links to Terms, Privacy and /how.
- **AC4.** No disclosure page renders an upsell, sign-up or join prompt, display ad, donate or fundraising content, or
  third-party tracker.
- **AC5.** A copy test fails on any banned word on disclosure surfaces: insider (as conduct), suspicious, timed,
  well-timed, ahead of, beat, outperform, cashed in, dumped, profited, windfall, conflict, violation, illegal, late
  (as a label), top, best, worst, ranking, leaderboard, confidence, likely, probably, copy, mirror, trade like, follow
  their trades, made or earned with a percent, Verified, plus the POLICY F2 list.
- **AC6.** Each source's importer refuses to run without its flag and its contact settings. It keeps to at most 4
  requests a second with backoff, and its logs hold counts and run ids only (no names).
- **AC7.** Amended filings supersede the original, and the derived record is rebuilt from raw. A test shows no derived
  row is patched in place.
- **AC8.** Every disclosure page has a correction link. A filer's documented dispute withdraws the whole estimate
  (never single trades) within the stated review time, and the corrections log stores no requester details.
  Correcting a transcription error against the filing is a correction, not a dispute.
- **AC9.** Filers resident in the EU or UK are excluded at import, and the exclusion is counted.

**Step 1: holdings reports (13F).**
- **AC10.** Only entity filers get a profile. A natural-person filer is excluded and counted.
- **AC11.** The quarter return follows §4.2 exactly. Hand-computed fixtures cover: weights by start value; an exited
  position excluded with its share shown; a split without documented data excluded; an outlier implied price excluded;
  an options line excluded; a quarter over the 20% cap showing no figure and the reason; a confidential-treatment
  caveat; an amendment rebuild.
- **AC12.** The label "Hypothetical holdings return (not the firm's return)" and the §4.2 sub-line sit above the
  number at 375 px width, signed out.
- **AC13.** Holdings-report pages have no ranking, no "top" list and no sort by return.
- **AC14.** Percent only: no share counts, values or prices on any surface, card or payload (POLICY P3).
- **AC15.** Index metadata (title, description, preview) carries no figures.
- **AC16.** The business-gate counters (views from outside referrers, opens of a trader record) are recorded with no
  personal data (F-15 rules).

**Step 2: facts-only officials (after the § 13107 gate).**
- **AC17.** No environment fetches or parses a real official's report while the § 13107 gate setting is unset. A
  test asserts the importer refuses to run.
- **AC18.** Rows show the date, the asset as filed, purchase or sale, "Reported N days after the transaction date" and
  the filing link. They show no "%", no chart and no amount band (until P3 is amended).
- **AC19.** Dependent-child lines are never stored. Spouse and joint lines are never named, never shown row by row and
  never estimated. Exactly one "Family-member and joint transactions not shown: N" count appears, hidden at 0.
  Real-property lines, addresses and family fields are never stored.
- **AC20.** Unsold purchases read "N reported purchases with no reported full sale", never "still held".
- **AC21.** An entry drops out when its report's public period ends (6 years; for a member, 6 years after leaving
  office).
- **AC22.** Officials' pages are noindex. They are never ranked or sorted by any figure. The list is in name order as
  filed.
- **AC23.** People's share cards and previews show no name, figure or chart.
- **AC24.** Only posted officials' reports are imported; application-only reports are not.

**Step 3: estimated ranges (after OD-7, A5 and the back-test).**
- **AC25.** `PUBLIC_ESTIMATES` refuses to turn on without the approved price-source setting and the owner's
  amendment setting.
- **AC26.** Eligibility U1-U8 are implemented as in §4.3. Fixtures show the unbiased U3 keeping a losing trade bought
  and sold in the same band, and an excluded trade counted by its reason.
- **AC27.** The per-trade range matches the §4.3 formulas on hand-computed fixtures, beside its inputs and "Estimate
  from public disclosures". No point value appears anywhere.
- **AC28.** Open self purchases enter as unrealized trades. If any open self purchase is unpriced, no profile range is
  shown.
- **AC29.** The profile envelope contains the exact range and the TR-9 interval of every in-range path (a property
  test). Same-date and overlap clusters merge transitively. There is no division by zero.
- **AC30.** The four gates (K ≥ 5; ≥ 50% of sales estimated with family and joint lines in the denominator; open
  purchases priced; half-width ≤ 10) each have a failing fixture that shows per-trade ranges and the reason.
- **AC31.** A range that crosses 0% has no gain or loss colour. Screen readers hear "from minus X percent to plus Y
  percent". No information is carried by colour alone (WCAG 2.2 AA).
- **AC32.** There is no Edge verdict, tier word or trust line, only "Based on N round trips over D days".
- **AC33.** The back-test (§4.4 a-d) is pre-registered, its results are on /how, and no probability wording ships
  before it passes.

---

## 6. Questions for the attorney (staged review, owner item 2.54)

The committee recommends adding these to the single, limited, staged review the owner already plans, rather than
buying a separate engagement. They are in priority order.

| # | Question | Needed before | Priority |
|---|---|---|---|
| A1 | Does Stock Social, a free, signed-out public-disclosures section inside a for-profit social product that has a paid viewer tier elsewhere, qualify as "news and communications media for dissemination to the general public" under 5 U.S.C. § 13107(c)(1)(B)? Does a facts-only mode differ from estimates? Is obtaining reports through the lower chamber's bulk files lawful for this use? May a bot accept the upper chamber's per-search acknowledgment? What is the penalty exposure per report or per use? Should data be dropped after the six-year window? Is there any enforcement history (docket search)? | Any officials' page in production (step 2) | Must |
| A2 | Is a range on disclosed inputs, with its method shown, non-actionable opinion under 497 U.S. 1 in the likely forums? Does the fair-report privilege reach derived computations? Which people named in filings are private figures? Is the dispute process and its review time adequate? Review the §5 copy list and the not-joined line | Real officials' names (step 2) | Must |
| A3 | After 9th Cir. No. 24-3894 (2026) and Cal. Civ. Code § 3344(e), is keeping these pages free of upsells, prompts and ads enough separation while the product sells a viewer tier elsewhere? | Step 2 | Should |
| A4 | Does the publisher's exclusion (472 U.S. 181) and its state analogs hold for unranked 13F hypothetical returns and officials' facts-only pages? What does the advisers' marketing rule (17 CFR 275.206(4)-1) require on cards that advisers might reuse? | Step 1 production, optional; step 2 | Should |
| A5 | Market-data licence: do non-display and derived-data rights allow publishing percent ranges computed from licensed daily highs and lows, for people who are not users? Does SnapTrade's contract cover this? | Step 3 | Contract review |
| A6 | Does compiling records of filers resident in the EU count as "monitoring" under GDPR Art. 3(2)(b)? | Only if OD-6 is not adopted | Optional |
| A7 | Is an estimated range a privacy-law "inference" about a private filer, outside the public-records exclusion? | Only if private persons are ever in scope | Optional |

Committee position on A1 (C1): the AI committee's findings should **not** stand in for counsel on this question. The
exception is undefined, there is no case law, and the government enforces it. The owner keeps the power to accept the
risk in writing; the committee recommends against it.

---

## 7. Owner decisions needed

Each item shows the committee and council recommendation. None of these changes protected files: suggested text is
for the owner to apply.

1. **OD-1. Verdicts and sequence.** Adopt §1.1 and the three steps in §4.6. **Rec: yes.**
2. **OD-2. The § 13107 opinion.** Add A1 to A3 to the staged attorney review (item 2.54). **Rec: yes.** The
   alternative, a written risk acceptance naming § 13107 instead of waiting, is **not recommended**.
3. **OD-3. Paid features.** Officials' and institutions' data stay out of every paid feature, export and API forever.
   Their pages carry no upsell, join prompt, display ad or solicitation. **Rec: yes.** Suggested POLICY F5 addition:
   "Officials' and institutions' data never enter a paid feature, export or API." Suggested F1 addition: "Officials'
   and institutions' records are never ranked."
4. **OD-4. Names and computed numbers.** (a) Confirm that F-7 legal finding 9 (names in production data from public
   filings do not breach T1/T2) covers 13F firm names, and adopt the tightened T2 text from item 2.49/3.16. (b) Confirm
   that a 13F hypothetical return at the filer's own values is "computed, not guessed". **Rec: yes to both.**
   Suggested T2 addition: "Real people's names may appear in production data imported from public filings, shown only
   on public-record pages and their share cards. They never appear in the repository, product copy, marketing, ads,
   emails, logs or agent prompts."
5. **OD-5. Indexing and removal.** (a) Firm-level 13F pages may be indexed with figure-free metadata. (b) Officials'
   pages are noindex at launch. (c) Elected and posted officials are not removed on request (hidden only for error,
   dispute or expiry); other filers are removed on request. **Rec: yes to all three.**
6. **OD-6. EU and UK filers.** Exclude filers resident in the EU or UK from every disclosure profile. **Rec: yes.**
7. **OD-7. Only before step 3.** **Rec: not now.**
   - (a) A "never guessed" carve-out in the CLAUDE.md product rules. Suggested: "The only estimates in the product are
     POLICY F3d's labeled ranges for officials' public disclosures; connected traders' and insiders' records are never
     estimated." Also F-7 L5: "F3d estimates never apply to insider profiles."
   - (b) A new **F3d**. Suggested: "A number computed from a public disclosure that lacks trade prices is an estimate.
     It is shown only as a range, never a point value, next to its inputs; labeled 'Estimate from public disclosures'
     on every surface, including share cards, link previews and alt text; never Verified, ranked, put in the feed,
     pushed, sold, or mixed with actual returns on one record; computed only by the method published on /how; and
     corrected or withdrawn within the stated review time when disputed. No coverage or confidence wording until a
     published back-test supports it."
   - (c) A P3 exception for disclosed amount bands, needed before bands appear even in facts-only mode. Suggested: "an
     official's public disclosure may show the amount band exactly as filed, never a computed dollar figure, quantity
     or price."
   - (d) Approval of a market-data source (POLICY H).
   - (e) The F3 /how list extended to describe each public source and the estimate method.
8. **OD-8. Follow-ups outside this feature** (P10).
   - (a) F-7's live label "Company insider" uses a word the committee treats as a motive word. Rename it to "Company
     officer or director". **Rec: yes, as a separate small change.**
   - (b) `confidence()` in `lib/trades.ts` takes no open positions today (`void today; // reserved for open
     positions`), and `app/u/[handle]/page.tsx:84` passes closed trades only. DESIGN TR-9 says open positions are
     included. That is a gap for connected traders too. **Rec: one shared fix, filed separately.**
9. **OD-9. Before step 2.** Media liability insurance and per-output audit trails, added to POLICY "Before a public
   launch" with the § 13107 item. **Rec: yes.**
10. **OD-10. Executive officials.** Posted top officials only, and only with step 2. Application-only reports never.
    **Rec: yes.**

---

## Appendix A. Method, committee and council records

### A.1 Research (five agents, fresh context)

| Agent | Scope | Verdict returned |
|---|---|---|
| R1 | Legislators, executive and state disclosures | Go-with-limits; the news-media question needs an attorney |
| R2 | Form 13F, N-PORT | Go-with-limits as a hypothetical holdings estimate |
| R3 | 13D/13G; insiders re-confirmed | Insiders go-with-limits as built; 13D narrow; 13G no-go |
| R4 | Private holdings | Go-with-limits at entity level; no profiles of private individuals |
| R5 | Cross-cutting | Top risks: § 13107, defamation, publicity, market data, adviser status |

**Corrections found in review.**
- The confidentiality provision for Form PF is 15 U.S.C. § 80b-4(b)(8) and (b)(10), not § 80b-10(d).
- The research's claimed 2016 raise of the § 13107 penalty to $11,000 is likely wrong (L2). The $11,000 figure dates
  from 1999, and $25,132 is the post-2015 executive-branch figure.
- The Form SHO compliance date of 2 Jan. 2028 rests on secondary sources.
- The value-band list in § 13104(d)(1) was checked against the published code by the engineer.

### A.2 Legal committee (L1 litigation, L2 regulatory, L3 media-law skeptic): three rounds

**Round 1, where the members agreed.**
- Actual returns are impossible for officials.
- Insiders stay go-with-limits as built.
- 13G and private holdings are no-go.
- The repository's rules block estimates today.

**Round 1, where they split.**
- **Estimated officials' profiles:** L1 go-with-limits with the owner's written risk acceptance; L2 go-with-limits
  with an attorney opinion required; L3 no-go until a written opinion.
- **Paid tiers:** whether any paid tier defeats the exception.
- **Ranking.**
- **Family lines.**
- **The owner's "date window" premise:** L1 showed that the reports give the trade date.

**Round 2.**
- L1 conceded that an attorney opinion comes first, including for facts-only.
- L2 joined L3 on the opinion and conceded the date point.
- L3 withdrew "no-go" in favour of "go-with-limits, launch-gated".
- Everyone agreed that officials are never ranked and 13F is unranked at launch.
- Family lines converged.

**Round 3.** All three signed C1-C12 with no dissent. Amendments adopted:
- **C3:** solicitation and credit-use bars.
- **C4:** six-year retention; F-7 finding 3.
- **C5:** a single-open-lot rule, later corrected (§A.3).
- **C6:** joint lines also excluded from estimates.
- **C8:** the regulator's values are unreviewed; exclusions for splits, intra-quarter changes, options and outliers;
  dividends excluded.
- **C12:** inputs shown with every estimate; a dispute review time; no point figures on cards; transcription QA,
  audit trail and insurance before real names.

**Disagreements recorded.**
- L1 and L3 differ from L2 on how much a paid tier elsewhere weakens media status. The rule is the same either way:
  officials' data stays out of every paid feature.
- L2 rates the false-statement risk at the upper chamber's acknowledgment box as low; L3 rates it higher. C7 avoids
  automating that site either way.

### A.3 Design council (UX lead, business lead, engineer, legal member, record-trust red team): three rounds

**Round 1.**
- **Business lead:** build 13F first; legislators' facts-only repeats what free trackers already show, and the job
  users hire those trackers for, trading alongside officials, is banned.
- **UX lead:** three types, exact copy, a band chart.
- **Engineer:** fixed per-trade ranges, rules U1-U8, an analytic envelope, a 13F method.
- **Legal member:** guardrails G1-G40, safe and unsafe copy, rule texts for the owner.
- **Red team:** 31 attacks.

**Round 2, the main finding.** The committee's adopted band test, which compares each band's upper bound with that
day's low price, **drops losing trades and keeps winners**. A falling price raises the sale's ratio, so a loss bought
and sold in the same band is excluded while a gain passes. The committee position was amended to the engineer's
unbiased test, which excludes a sale only when it is proven larger than the lot (legal member's round 3: "Yes, amend
C5").

**Round 2, other items closed.**
- Open positions must enter any average.
- Gates on coverage and selection.
- Same-date clustering.
- No Edge verdict.
- A separate route with no `users` rows.
- A generic share card.
- 13F weighted by start value.
- G41: no fetching of real officials' reports before the gate.

**Round 3.** All five signed P1-P10.
- **Amendments adopted:** the exact not-joined line; the 13F sub-line; the excluded-share definition; the envelope
  formula; cumulative U3; open lots as unrealized trades; the card wording; the stop-and-ask-the-owner business gate;
  the back-test thresholds (stricter of two).
- **The UX lead's deletion of the trust line** ("entirely above 0%" reads like the Edge verdict renamed) was adopted.

**Disagreements recorded.** The business lead would skip legislators entirely unless step 1 clears its gate. The
other members keep step 2 conditional on A1. The sequence makes step 2 wait for both.

### A.4 Final red team on the combined result

See §B below for its findings and how each was handled.

## Appendix B. Final red team

The final red team findings and their disposition are recorded in the PR body for this change and folded into the
sections above.

## Appendix C. Primary sources (accessed 2026-11-02)

- 5 U.S.C. §§ 13104, 13105, 13107: https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title5-section13107&num=0&edition=prelim
  (and sections 13104, 13105)
- STOCK Act, Pub. L. 112-105: https://www.govinfo.gov/content/pkg/PLAW-112publ105/html/PLAW-112publ105.htm
- Pub. L. 113-7: https://www.govinfo.gov/content/pkg/PLAW-113publ7/html/PLAW-113publ7.htm
- 5 CFR part 2634 (§§ 2634.603, 2634.703): https://www.ecfr.gov/current/title-5/chapter-XVI/subchapter-B/part-2634
- The upper chamber's disclosure search: https://efdsearch.senate.gov/search/home/; Select Committee on Ethics:
  https://www.ethics.senate.gov/public/index.cfm/financialdisclosure
- The lower chamber's disclosure search: https://disclosures-clerk.house.gov/FinancialDisclosure/ViewSearch; House
  Ethics Manual: https://ethics.house.gov/manual/retention-of-and-public-access-to-reports
- Federal election agency enforcement matters 6053/6065: https://www.fec.gov/files/legal/murs/6053/10044264486.pdf
- 5 U.S.C. § 552(a)(4)(A)(ii): https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title5-section552&num=0&edition=prelim
- 15 U.S.C. § 78m(f) and 17 CFR 240.13f-1; Form 13F staff FAQ:
  https://www.sec.gov/rules-regulations/staff-guidance/division-investment-management-frequently-asked-questions/frequently-asked-questions-about-form-13f
- Release 34-95148 (87 FR 38943): https://www.govinfo.gov/content/pkg/FR-2022-06-30/html/2022-13936.htm
- Release 34-98738: https://www.govinfo.gov/content/pkg/FR-2023-11-01/html/2023-23050.htm
- Inspector General Report No. 480: https://www.sec.gov/files/480.pdf
- The regulator's website policy: https://www.sec.gov/about/privacy-information; fair access:
  https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data
- 17 CFR 240.13d-101 and 13d-102; Release 33-11253: https://www.sec.gov/rule-release/33-11253
- Form 4: https://www.sec.gov/files/form4.pdf; Release 34-104903:
  https://www.sec.gov/files/rules/final/2026/34-104903.pdf
- 17 CFR 230.503, 227.201, 200.83, 232.15; 15 U.S.C. § 80b-4(b): https://www.ecfr.gov and https://uscode.house.gov
- N-PORT: https://www.sec.gov/rules-regulations/2025/04/s7-26-22
- FINRA Rule 8312: https://www.finra.org/rules-guidance/rulebooks/finra-rules/8312
- California privacy law and data-broker page: https://cppa.ca.gov/regulations/pdf/ccpa_statute.pdf;
  https://cppa.ca.gov/data_brokers/
- Vermont 9 V.S.A. § 2430: https://legislature.vermont.gov/statutes/section/09/062/02430
- 15 U.S.C. § 80b-2; 17 CFR 275.206(4)-1; 47 U.S.C. § 230; 15 U.S.C. § 1125(a): https://uscode.house.gov and
  https://www.ecfr.gov
- 9th Cir. No. 24-3894 (2026): https://cdn.ca9.uscourts.gov/datastore/opinions/2026/09/24/24-3894.pdf
- Release 34-90610: https://www.sec.gov/files/rules/final/2020/34-90610.pdf
- C-184/20 (CJEU 2022): https://curia.europa.eu/juris/document/document.jsf?docid=263721&doclang=EN (the full text
  did not load in this session; the holding was confirmed from summaries and its details are unconfirmed)

Court decisions cited by reporter only (holdings stated by the committee; those marked medium were not re-read):
376 U.S. 254; 418 U.S. 323; 497 U.S. 1; 472 U.S. 181; 564 U.S. 552; 443 U.S. 97; 528 U.S. 32; 420 U.S. 469;
491 U.S. 524; 375 U.S. 180; 943 F.2d 190 (2d Cir. 1991); 969 F.2d 1110 (D.C. Cir. 1992) (en banc).
