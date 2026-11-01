# F-7 committee: legal and compliance findings (public-record traders)

Date: 2026-11-01. Author: the legal-and-compliance member of the F-7 committee. This is AI legal analysis that the
owner accepts in place of counsel (POLICY, owner decision 2026-11-01). Its conditions apply as rules; the calls it
leaves open are the owner's. It is not a licensed attorney's opinion.

Wording rule for this file (POLICY T1/T2): no real people, companies, agencies, statutes' popular names or form
numbers are named. Sources are described generically; the full primary-source citations (addresses and verbatim
quotes) were handed to the committee lead in the session and are kept out of the repository on purpose.

Sources in scope:
- **Insider report**: the company insider's transaction report on the securities regulator's public filing system
  (dates, transaction codes, share counts, prices, holdings after the transaction).
- **Legislator report**: the legislators' periodic transaction report, published by each chamber's disclosure office
  (dates, asset, buy/sell, amount ranges, no prices).
- **Holdings report**: the large investor's quarterly holdings report on the same filing system (quarter-end
  holdings and values, no trade dates, no prices per trade).

## Fact-checks against primary sources

**FC-1. Commercial-use limit on legislators' reports.** Primary source: the federal ethics statute's
public-availability section (official code text), the ethics office's matching regulation, and the upper chamber's
disclosure search page, which makes every searcher accept the statutory prohibitions before searching (URLs kept out
of the repo per T1). The operative rule: it is unlawful to obtain or use a report "for any commercial purpose, other
than by news and communications media for dissemination to the general public", or for credit rating, or "in the
solicitation of money for any political, charitable, or other purpose". Enforcement is a civil action by the federal
government with a court-assessed penalty of up to a fixed statutory amount (five figures) per action, on top of other
remedies. A paper request must state the requester's name, occupation, address, the organization it is for, and that
the requester knows the prohibitions; that application is itself public. Neither the statute nor the regulation
defines "commercial purpose" or "news and communications media". The same provision also covers executive-branch
officials' reports.

**FC-2. The filing system's fair-access rules and reuse.** Primary source: the regulator's page on accessing its
filing data, and its website privacy/linking policy (URLs kept out of the repo per T1). Operative rules: the current
maximum is 10 requests per second, which the regulator may lower; automated clients must declare a User-Agent with a
company name and an administrative contact email; unidentified bots and automated crawling of the website are not
allowed; the regulator may limit request rates. On reuse: information on the site "is considered public information
and may be copied or further distributed by users of the web site without the [regulator's] permission", with a
request to cite the regulator as the source; the regulator does not endorse linked sites.

**FC-3. Real people's names: publicity, defamation, endorsement.** Primary sources: a large state's
right-of-publicity statute (liability for knowingly using another's name or likeness on products or for advertising,
selling or soliciting without consent; an express carve-out that use "in connection with any news, public affairs"
account "shall not constitute a use for which consent is required"), and the general tort definition of appropriation
(commercial use of a name without permission, with a newsworthiness defense). Defamation and false light turn on
falsity: truth is a defense, and the platform's own computed numbers and labels are its own statements, not
third-party content (COMPLIANCE §6). Company insiders are often not public figures, so a lower fault standard
(negligence) can apply to errors about them; legislators are public officials (a higher standard), but a wrong number
attributed to them is still the platform's statement.

## Findings

1. **Insider reports may be shown, with conditions.** They are public information the regulator says may be copied and
   further distributed without permission. No statute limits their commercial use. They carry prices for open-market
   purchases and sales, so a per-trade percent return can be computed honestly by FIFO from the filings alone, with no
   market-data vendor. They are the right first source.
2. **Legislator reports carry a statutory commercial-use bar.** A product run as a business is a commercial use unless
   it falls inside the news-and-communications-media exception for dissemination to the general public. The exception
   is undefined. A free, public, signed-out record page that links each entry to its filing is the strongest
   position; a paywall, a paid tier, ads targeted on the data, data export or resale, or any use in raising money would
   take it outside. Risk remains even when the conditions hold, and accepting it is the owner's call.
3. **Legislator reports cannot give an honest per-trade return today.** They report amount ranges, not prices, so a
   return needs market prices, which means a new vendor (owner, POLICY H). Until then every legislator entry is
   excluded and counted. A profile made only of excluded entries adds legal risk (finding 2) without showing a record.
   Committee recommendation: legislators are not in the first release.
4. **Holdings reports cannot give a per-trade return.** They have no trade dates and no trade prices. Quarter-to-quarter
   changes are not trades. Anything shown from them would be a guess, so they stay out until a design shows an honest,
   labeled number (exclude and count, POLICY F3c).
5. **Percent only applies even though filings carry amounts.** Share counts, prices, dollar values and holdings totals
   are never shown, stored in derived tables or put on share cards (POLICY P3, the `closed_trades` rule). Raw imported
   filings may hold them only where the matcher needs them, like broker activities.
6. **Never "Verified".** Public-record profiles carry their own source label and never the Verified badge or any
   wording that implies broker sourcing, identity checks, auditing or completeness (POLICY F3a). A filing can be late,
   amended or missing; the page says so.
7. **Identity is the source's identifier, never a name match.** Two filers can share a name. Attribution by name alone
   is the largest defamation risk in this feature. Each profile is keyed to the filing system's unique filer
   identifier; the display name is copied from the filing as filed.
8. **Amendments and corrections.** An amended filing replaces the original in the derived record; the profile is
   rebuilt from raw filings (the same raw-in, derived-out rule as broker data). Never patch derived rows.
9. **Names at runtime from imported public data do not breach T1/T2.** Those rules govern what goes into the
   repository, copy, personas, docs, demo data, tests, issues, PRs, logs and prompts. A production database row
   imported from a public filing is none of those. The rule bites everywhere around it: fixtures, e2e data, screenshots
   committed to `docs/`, PR bodies, agent prompts and application logs use fictional filers only; no hard-coded list
   of chosen real filers or issuers exists in code (selection is by rule, such as filing type and date window, or by
   an owner-set production setting); issuer names and symbols from filings follow the same rule.
10. **P3 consent concerns connected traders, but its wording is the owner's to settle.** P3 requires the trader's
    consent at connect time; public-record filers never connect, and their data is already public by law. The
    committee reads P3 as covering connected records, with its percent-only rule applying to every record. Because
    POLICY is owner-only, the owner confirms that reading (or amends P3) before the switch goes on in production.
11. **Right of publicity is met by keeping the use news-like.** Names appear only on the record pages and their share
    cards, in the public-affairs frame. They never appear in the product's own ads, marketing, emails, launch posts,
    paid placements or "as seen on" claims.
12. **Implied endorsement must be ruled out on the page.** Each public profile says the person has not joined, has not
    connected a broker, has not reviewed the record and does not endorse the product. No follow-to-get-their-trades
    framing.
13. **Corrections and removal.** Every public profile has a report/correction action and links to a working contact
    (POLICY P6, U2, U3). Accuracy reports are reviewed and the record rebuilt or the profile hidden while under review.
    Removal of a whole profile on request is allowed (it is not per-trade hiding, TR rules), and is the committee's
    recommended default for filers who are not elected officials; the owner sets the removal policy. Keep a
    corrections log (COMPLIANCE §12).
14. **Securities law: publisher's exclusion holds only if the pages stay impersonal records.** Insider and legislator
    trades are widely treated as signals, so the risk of reading as advice is higher than for connected traders. No
    alerts, emails, push or feed items timed to a new filing (F3b); no "just filed", "new buy" or recency badges; no
    page or ranking that scores securities by insider or legislator buying; no "copy", "mirror" or "trade like" wording
    (F2); no paid access to these profiles (F5, and finding 2). The disclaimer is on every surface (F3).
15. **Fair access is a hard engineering rule.** The importer sends a User-Agent with the product name and an
    administrative contact email read from an environment variable, refuses to run without it, stays well below the
    published rate (at most 5 requests per second, one worker), backs off on refusals, and uses the regulator's bulk
    and structured data feeds rather than crawling web pages. The contact address is a role address on the product's
    domain, never a personal email (P1), and never committed.

## Conditions (rules for the build)

- **L1.** One launch switch, default **off** in production and **on** in dev, test, CI and demo. With it off, no
  public-record profile, feed card, share card or route is reachable in production, and the importer does not run.
- **L2.** Each source has its own enable flag under the switch. Only insider reports may be enabled in the first
  release. Legislator and holdings sources stay off until the owner turns them on (findings 2-4).
- **L3.** Dev, test, CI and demo use only fictional filers with fictional identifiers and issuers, marked Demo.
- **L4.** No "Verified" anywhere on public-record surfaces; a source label on every profile, feed card and share card;
  a link from each entry to its filing; the non-endorsement line (finding 12); the disclaimer.
- **L5.** Percent only; excluded entries counted by reason (no price, gift, grant, option or derivative, amount range,
  holdings only), never estimated.
- **L6.** Profiles keyed to the source's filer identifier; amendments supersede; derived data rebuilt, never patched.
- **L7.** Report/correction action and contact link on every public profile; whole-profile removal supported.
- **L8.** No notifications, emails or recency-driven feed items from public filings; no security-level scoring.
- **L9.** Importer: User-Agent from env with contact, refuses to run without it, at most 5 requests per second,
  backoff, no logs containing filer names (counts and run ids only).
- **L10.** Public-record profiles are free and signed-out readable; never behind a paywall or paid feature.
- **L11.** The feed may show public-record traders beside connected traders only with the source label on the card,
  and they never enter any surface labeled Verified.
- **L12.** `/how` (How records are calculated) describes each public source, what it can and can't compute, and what
  is excluded.

## Turning the switch on in production (owner only, POLICY H)

Before the owner turns L1 on in production, all of these are true:
1. The owner sets the importer's contact email (a role address) and the switch in the deploy settings (credentials
   and deploy settings are the owner's).
2. The owner confirms the P3 reading in finding 10, or amends P3.
3. The owner decides the removal policy (finding 13) and a working contact for corrections and takedowns is live.
4. Terms and the Privacy Policy describe public-record profiles, their sources and the correction path.
5. The owner's launch-to-real-users decision has been made (showing real filers to the public is part of a launch).
6. CI enforces L1-L12 with tests (switch default, no Verified, filing links, exclusion counts, rate limit, User-Agent
   required, fictional fixtures).
7. For legislator reports, additionally: the owner accepts the commercial-use risk in writing (finding 2) and a market
   price source exists with the owner's approval (finding 3).
