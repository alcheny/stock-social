# Compliance reference: laws, rules and procedures for building Stock Social

**Who reads this:** the engineer and the business lead, before and while making any change; the
reviewer, when judging one. **What it is:** the reference behind `docs/POLICY.md`. POLICY holds the
binding rules and is owner-only; this file explains which laws and regulators sit behind them, what to
look out for, and the procedure for every change. When this file and POLICY disagree, POLICY wins.

**This is not legal advice.** It is a working map written by AI for a small team, to be reviewed by
counsel before launch (POLICY → Before a public launch) and after every material change in law. Laws
differ by state and change often; an item here is a prompt to check, not a conclusion.

Scope: a United States consumer web app that publishes verified brokerage trade records, with a public
feed, user text (theses), sharing, and later viewer subscriptions and trader payouts.

---

## 1. The procedure for every change

Run this before planning and again before merging. Record the answers in the PR body under a
`## Compliance` heading (the reviewer checks it; `scripts/compliance.ts` checks the deterministic parts).

1. **Does the change show, rank, label or describe performance?** → Section 2 (securities and
   advice). Disclaimer present, no advice words, losses treated like gains, evidence label where
   DESIGN §5.2 requires it.
2. **Does it collect, store, show or send personal data?** → Section 3 (privacy). Name the fields,
   where they live, who can see them, how they are deleted.
3. **Does it touch money: prices, payments, payouts, rewards, points?** → Section 4. Stop: these are
   owner-and-counsel decisions (POLICY H, F5, F6).
4. **Does it send email, push or SMS, or add tracking?** → Section 5 (communications and tracking).
5. **Does it accept or show user-written text or images?** → Section 6 (user content).
6. **Does it change sign-up, age, identity or accounts?** → Section 7 (age and identity).
7. **Does it add a vendor, a dependency, a font, an image or copy from elsewhere?** → Section 8
   (IP, licenses, vendors). A font, script or image served from another company's servers is also a
   privacy transfer → Section 3: self-host it.
8. **Can it be used by someone with a screen reader or without a mouse?** → Section 9.
9. **Does it change security posture (auth, secrets, webhooks, public endpoints)?** → Section 10.
10. **Does any marketing or product copy make a claim?** → Section 11 (advertising claims).
11. **Does it add a checkout, a trial or a renewal?** → Section 4: price, interval, next charge date and
    cancellation method on the checkout page itself, plus the post-purchase acknowledgment.

If any answer is "yes" and the matching section says "owner/counsel", the agent stops and writes what
the owner should decide. Never work around.

---

## 2. Securities and investment-advice law (federal and state)

**Why it matters most:** the line between *publishing a record* and *giving advice* decides whether the
company must register as an investment adviser or broker-dealer. Crossing it by accident is the single
largest legal risk of this product.

| Rule / regulator | What it governs | What to look out for in this app |
|---|---|---|
| Investment Advisers Act of 1940 (SEC), "publisher's exclusion" | Who counts as an adviser. Publishers of general, impersonal, regularly published information are excluded; personalized advice is not. | No "you should", no personalized picks, no "top traders to follow for returns", no paid signals. Rankings are by a documented method, equal for gains and losses. Personalized discovery (F-2) may suggest *records to read*, never *trades to make*. Counsel decides where the line sits for F-2 and F-3. |
| Securities Exchange Act of 1934, broker-dealer definition | Effecting transactions, soliciting trades, transaction-based compensation. | Never place trades, route orders, hold funds, or earn money per trade (POLICY F5). Read-only broker connections only. |
| SEC Marketing Rule (for advisers) and anti-fraud rules (Rule 10b-5) | Performance presentation, cherry-picking, misleading statements. | Even as a non-adviser, follow the spirit: full history, losses shown, no hypothetical or back-tested figures presented as real, "Verified" means broker-sourced only (F3a). |
| State securities ("blue sky") laws and state adviser registration | Each state has its own adviser definition and exemptions; some are stricter than federal. | A feature legal federally can still require state registration. Counsel reviews F-2/F-3 per state. |
| FINRA rules | Apply to member broker-dealers; not to this app unless it becomes one. | A reminder of why F5 exists: becoming a broker-dealer brings FINRA. |
| Anti-touting and promotion rules (Securities Act §17(b); SEC/FTC actions on "finfluencers") | Paid promotion of securities without disclosure. | No one can pay for visibility; no sponsored records; theses that promote a security for compensation are user-content violations (Section 6). |
| CFTC / NFA | Futures, options on futures, forex. | Options and futures are out of scope; `fetchActivities` skips them. If added, re-review. |

**Procedures:** every performance surface carries the disclaimer (F3). Copy review against the banned
words list (F2, scanner). Any new ranking, label, badge, alert or suggestion goes to counsel before
build if it could be read as a recommendation. Keep a written "how records are calculated" page current.

## 3. Privacy and data protection

| Rule | What it governs | Look out for |
|---|---|---|
| Gramm-Leach-Bliley Act (GLBA) and the FTC Safeguards Rule | Financial institutions' handling of nonpublic personal information; written security program. | Brokerage data is financial data. Keep the information-security program document current; encrypt vendor secrets (done: AES-256-GCM); least access; vendor contracts with security terms. |
| FTC Act §5 (unfair or deceptive practices) | Doing what the privacy policy says; reasonable security. | Privacy policy must match actual data flows. Any new field or vendor is a policy update. |
| State comprehensive privacy laws (California CCPA/CPRA, Virginia, Colorado, Connecticut, Texas, Oregon and others; thresholds vary) | Notice, access, deletion, correction, opt-out of sale/sharing and targeted ads, data minimization, sensitive-data consent. | Build deletion and export as real features before launch. Financial data is "sensitive" in several states: get consent at connect time (the F-1 consent screen) and document it. Record freezes (TR-5) must coexist with deletion rights: deleting the profile deletes personal data; the "handle can't be reused for a year" rule keeps no personal data. |
| State data-breach notification laws (all 50 states) | Notice to users and sometimes regulators after a breach of personal data. | Incident runbook (POLICY → If something leaks); know which fields count as personal data in each state. |
| GDPR / UK GDPR | If EU/UK users are allowed. | Default: not allowed at launch (POLICY). If allowed later: lawful basis, DPA with vendors, data-subject rights, transfers. |
| Children's privacy (COPPA) | Under-13 data. | 18+ only; no collection from minors; see Section 7. |
| Data minimization in the schema | | `closed_trades` stores no quantities or prices by design; keep it that way. Don't add fields "just in case". |
| Third-party resource loads (fonts, scripts, images, embeds served from another company's servers) | Each load sends the visitor's IP address and page URL to that company; under GDPR and some state laws that is a data transfer without consent (a German court awarded damages per visitor for fonts loaded from a third party's servers). | **Self-host everything:** fonts, scripts, icons and images are served from the app's own origin; no third-party font, analytics, chat, map or video embeds on any page. The only outbound calls are server-side to integrated vendors. A scanner rule for the well-known third-party font hosts, third-party `<script src>` and `<link href>` to other hosts is to be added to `scripts/compliance.ts` (not there yet). (Status today: none found in `app/` or `lib/`; keep it that way.) |

**Procedures:** data inventory (what, where, why, retention) updated with every schema change; a
privacy-policy diff for every new field or vendor; deletion tested end to end, including the vendor
(delete the broker-vendor user on profile deletion); access logs for admin reads.

## 4. Money: payments, payouts, rewards (owner and counsel only)

| Rule | What it governs | Look out for |
|---|---|---|
| State money-transmitter laws and FinCEN (Bank Secrecy Act) | Holding or moving others' money. | Never hold funds. Payouts (F-3) only through a payments vendor's connected-accounts product where the vendor is the regulated party. |
| Payment-card industry standard (PCI DSS) | Card data handling. | Hosted checkout only; no card fields in the codebase (scanner). Annual self-assessment. |
| Automatic-renewal laws (federal ROSCA; California and other state auto-renewal laws) | Subscriptions: clear terms, affirmative consent, easy cancellation, renewal reminders. | Cancel online in as many clicks as sign-up; show renewal date and price before purchase; reminder emails for annual plans and before a trial converts. **California specifically:** the renewal terms must be shown in visual proximity to the consent, in a clear and conspicuous way, before the charge, with a post-purchase acknowledgment the consumer can keep; goods or services delivered without that are deemed an **unconditional gift** (no charge can be kept, refunds owed). The checkout page itself, not only the Terms, must show price, renewal interval, cancellation method and the date of the next charge. |
| Tax (sales tax on digital goods varies by state; 1099 reporting for payouts) | | Billing vendor handles tax; payout vendor handles tax forms. |
| Gambling, sweepstakes and prize laws (state) | Anything with chance, consideration and a prize. | No prizes, wagering, loot boxes or points convertible to money (POLICY F6). "Call it" predictions (Phase 2) must stay paper-only and prize-free, and be reviewed before build. |
| Unfair or deceptive practices in pricing (FTC, state UDAP) | Hidden fees, dark patterns. | Total price up front; no pre-checked boxes; no confirm-shaming. |

## 5. Communications, marketing and tracking

| Rule | What it governs | Look out for |
|---|---|---|
| CAN-SPAM Act | Commercial email. | Unsubscribe link that works within 10 days, physical address, honest subject lines. Transactional email (receipts, security) is exempt but keep it transactional. |
| TCPA | SMS and automated calls. | No SMS without prior express written consent; keep opt-out words working. Default: no SMS. |
| FTC Endorsement Guides | Testimonials, influencer posts, "results" claims. | A trader sharing their own card is fine. If the company pays or rewards anyone to promote, disclosure is required and F5 forbids paying for performance anyway. Never present a record as typical results. |
| State wiretap and session-replay laws (e.g. California CIPA) and cookie consent | Tracking, analytics, chat widgets. | Prefer first-party, cookie-free analytics; no session replay; cookie banner only if third-party cookies are used; honor Global Privacy Control where state law requires. |
| App-store and platform policies (if a native app or in-app purchase is ever added) | Payment rules, content rules, financial-app review. | Owner decision; review the platform's financial-services policy before building. |

## 6. User content (theses, names, images)

| Rule | What it governs | Look out for |
|---|---|---|
| Communications Decency Act §230 | Immunity for third-party content, with exceptions. | Moderation is allowed and keeps immunity; the company's *own* statements (computed stats, labels) are not covered, so computed numbers must be correct (F3c). |
| DMCA §512 safe harbor | Copyright claims on user content. | Register a DMCA agent with the Copyright Office (online, a small fee, renewed every three years) **before** any user content goes live, including text theses; publish the agent's contact and a takedown process on the site; repeat-infringer policy; act on notices. Without the registration there is no safe harbor, and statutory damages run per work. |
| Defamation, harassment, impersonation | | Moderation rules hold suspect theses; impersonation of real people or firms is removed; display names and handles can't use third-party marks (POLICY T). |
| Securities-specific content rules | Pump language, solicitation, off-platform payment links, guaranteed returns. | Rules-based moderation now, model classifier in Phase 2, fail closed (held, never auto-published). |
| Terms of Service | | Must grant the license needed to display records and theses publicly, set the 18+ rule, the record-freeze rule, the one-account-one-profile rule and the deletion rule, in plain words. Owner/counsel only. |

## 7. Age, identity and accounts

| Rule | What it governs | Look out for |
|---|---|---|
| COPPA (under 13) and state minors' online-safety laws (several states regulate accounts, feeds and features for under-18s, with varying age-assurance duties) | Minors' data and design. | 18+ only, attested at sign-up, repeated on every first sign-in method (every sign-in path in F-1, including "sign in with brokerage", must collect the attestation before an account exists; a test asserts no `users` row without `adult_attested_at`). If age assurance becomes required for adult-only services in a state, counsel decides the method. No features or copy aimed at minors; no age cohorts that include minors in docs. **"Adults only" is a mitigation, not an exemption:** a service with accounts, a feed and sharing can still fall inside a state's minors' law if minors can sign up by lying, so treat an under-18 report like a COPPA notice (delete, log, review the gate) and watch the states that mandate age assurance for services like this. See Section 13 for exposure. |
| Know-your-customer rules | Apply to financial institutions holding funds. | Not applicable while no funds are held; the broker and the payments vendor perform KYC. Becomes relevant to payouts (vendor-handled). |
| Identity and authentication duties (FTC reasonable security; state laws) | | Replace the dev auth stub before launch; MFA available; secure session cookies; rate limits on sign-in. "Verified" never implies identity verification (F3a). |
| Account-claim rule (TR-6) vs. consumer rights | A broker account belongs to one profile forever. | Must be explained at connect time and in Terms; needs a support path for mistaken claims (human review), since deletion rights and the claim rule interact. |

## 8. Intellectual property, licenses and vendors

| Rule | What it governs | Look out for |
|---|---|---|
| Copyright (code, images, fonts, text) | | Original work only; dependencies with allowed licenses (POLICY C); fonts and icons with explicit licenses; no copied UI from other products (trade dress). |
| Trademarks | Product name, broker and vendor names, logos. | Clear the product name before launch. Only integrated vendors are named, and only as permitted by their brand terms; broker names appear only as the vendor's data returns them, with no logos unless licensed. |
| Vendor terms (broker-data vendor, hosting, email, billing) | What you may display and store. | Written permission to display users' broker-derived data publicly; market-data display rights for current prices (open positions); rate limits; data-retention terms; sub-processor lists for the privacy policy. |
| Open-source obligations | Attribution, copyleft. | License check on every new dependency (owner decision to add). |

## 9. Accessibility

| Rule | Look out for |
|---|---|
| Americans with Disabilities Act (web accessibility suits target consumer sites), Section 508 (if government customers), state laws (e.g. California Unruh Act) | Meet WCAG 2.1 AA: keyboard reachable, visible focus, labels on every control, contrast, no color-only meaning (charts carry sign in text too), alt text on share cards, reduced-motion respected. Accessibility is a POLICY rule (A) and a design requirement. |

## 10. Security duties

| Rule | Look out for |
|---|---|
| FTC Safeguards Rule (written program, risk assessment, encryption, access controls, MFA, vendor oversight, incident response, annual review) | Keep the program document current; encrypt secrets at rest; rotate keys with a documented process (changing `APP_SECRET_KEY` orphans secrets, so rotation needs a re-encrypt step); webhooks signature-verified; cron endpoints bearer-protected; dependency updates; least-privilege for agents and CI. |
| State breach-notification laws | Incident runbook with timelines (some states require notice within 30 days). |
| Public-repository hygiene (POLICY R) | No secrets, no personal data, no real user data in code, tests, fixtures, logs, issues or prompts. |

## 11. Advertising and product claims

| Rule | Look out for |
|---|---|
| FTC Act §5, state UDAP, Lanham Act (comparative claims) | Every claim about the product must be true and substantiated: "verified" is defined narrowly (F3a); no "every trade", "any broker", "the only"; no comparisons naming competitors; no "beat the market". Marketing copy follows the same scanner list as product copy. |
| Performance advertising | Never advertise with a trader's returns as a promise or typical result; cards shared by users are their speech, but the company's own ads must not cherry-pick records. |

## 12. Records to keep (so counsel and regulators can be answered)

- Data inventory and retention schedule; privacy-policy version history.
- Information-security program and annual review; incident log.
- Consent records: 18+ attestation, connect-time consent to full-history import, marketing consents.
- Moderation log: held theses, decisions, takedown notices and responses.
- Vendor contracts and permissions (data display rights, sub-processors).
- "How records are calculated" page history (every change to the trade math is a product statement).
- Counsel opinions: adviser status, each Phase 2/3 feature, state coverage.

## 13. Penalty exposure: laws that fine per user, per message or per violation

Why this section exists: most internet and consumer laws count **each affected user, message or day**
as a separate violation, so a defect that touches every account multiplies into a company-ending sum.
Figures are approximate statutory maximums at the time of writing, inflation-adjusted yearly by the
agencies; confirm current numbers with counsel. "Per" is the unit that multiplies.

| Area | Law | Unit | Approximate exposure | What triggers it in this app |
|---|---|---|---|---|
| Child safety and minors | COPPA (FTC) | per violation (in practice per child, per day) | ~$50,000+ per violation; recent settlements in the tens of millions | Collecting data from an under-13 user with knowledge; a feature or marketing that makes the service "directed to children"; failing to delete on notice. Mitigation: 18+ only, no child-directed design or copy, delete on any report, no age cohorts under 18 in analytics or docs. |
| Child safety and minors | State minors' online-safety and age-verification laws (a growing set; design codes, social-media account laws, age-assurance mandates) | per violation, often per minor user, sometimes per day | commonly $2,500 to $10,000 per violation; some allow private suits with statutory damages per user | A feed, accounts and posts can bring a service inside these laws even when adults-only, if a state requires age assurance rather than attestation. Mitigation: counsel reviews each state; attestation at sign-up now, age assurance added when and where required; no features aimed at minors. |
| Child safety | Federal TAKE IT DOWN Act and state laws on intimate images; CSAM reporting duties (18 U.S.C. §2258A) | per image / per failure to report | criminal and civil; reporting failures carry six-figure fines | User-uploaded images (none today; theses are text). If images are ever allowed: notice-and-removal within 48 hours, hash-matching, reporting pipeline. Mitigation: keep user content text-only until this is built. |
| Privacy | California CCPA/CPRA (and similar state laws) | per violation, i.e. per consumer | ~$2,500 per violation, ~$7,500 if intentional or involving minors; private right of action for breaches (~$100 to $750 per consumer per incident) | Missing notice, ignored deletion or opt-out requests, selling or "sharing" data for ads without opt-out, a breach of unencrypted personal data. Mitigation: deletion and export working end to end, no third-party ad tracking, encryption at rest, GPC honored. |
| Privacy | Biometric laws (Illinois BIPA and others) | per person, per scan | $1,000 to $5,000 per violation, private suits | Any face or voice processing. Mitigation: none in the product; never add without counsel. |
| Privacy | GLBA / FTC Safeguards | per violation, per day | civil penalties per violation plus consent orders | Not having or not following a written security program after a breach. Mitigation: keep the program document current and followed. |
| Privacy | GDPR / UK GDPR (if EU/UK users are allowed) | per infringement; also per-visitor damages in private suits | up to 4% of global turnover or €20M; courts have awarded damages per visitor for third-party font loads | Any processing without a lawful basis, missing DPAs, transfers, third-party resource loads. Mitigation: EU/UK not allowed at launch; self-host all assets anyway, since EU visitors reach shared links regardless of policy. |
| Communications | TCPA | per text or call | $500 per message, $1,500 if willful; class actions | Any SMS without prior express written consent. Mitigation: no SMS. |
| Communications | CAN-SPAM | per email | ~$50,000+ per separate email | Missing unsubscribe, false headers, no physical address. Mitigation: billing-vendor and transactional email only, unsubscribe on every marketing message. |
| Communications | State wiretap / session-replay suits (e.g. California CIPA) | per user, statutory damages | $2,500 to $5,000 per violation, class actions | Session-replay scripts, chat widgets or pixels that record interactions without consent. Mitigation: no session replay, first-party analytics only. |
| Subscriptions | ROSCA, state auto-renewal laws | per transaction / per consumer | FTC civil penalties per violation (~$50,000+); state suits with restitution | Unclear renewal terms, hard cancellation, no reminders. Mitigation: F-3 acceptance criteria (cancel online, renewal date shown, reminders). |
| Securities | Advisers Act / Exchange Act / state blue-sky enforcement | per violation; disgorgement; injunctions; registration costs | six to seven figures in practice, plus being forced to register or shut the feature | Giving personalized advice, soliciting trades, paid signals. Mitigation: POLICY F1 to F6, counsel before any F-2/F-3 feature. |
| Consumer protection | FTC Act §5 and state UDAP | per violation (order violations per day) | FTC penalties after an order (~$50,000+ per violation per day); state AGs per consumer | Deceptive "verified" claims, dark patterns, privacy-policy mismatch. Mitigation: F3a wording, Section 11. |
| Accessibility | ADA / state civil-rights laws | per suit, per plaintiff | statutory damages per offense in some states (~$4,000 in California) plus fees | An inaccessible flow. Mitigation: WCAG 2.1 AA (POLICY A). |
| Copyright | DMCA / Copyright Act | per work infringed | $750 to $150,000 statutory damages per work | Losing safe harbor by having no registered agent or ignoring notices. Mitigation: register the agent, follow the takedown process. |

**Design rule drawn from this table:** any defect in consent, deletion, unsubscribe, age gating or data
exposure is a per-user liability, so those paths get the same test rigor as the trade math: unit
tests, an end-to-end test, and a heavy-use test (every user processed, none skipped). A missing
unsubscribe link in one template is not one bug; it is one violation per recipient.

## 14. Review calendar

- **Every PR:** Section 1 checklist in the PR body.
- **Every new vendor, field, feature phase or market:** counsel review; privacy policy and Terms diff.
- **Quarterly:** dependency and license audit; privacy-law threshold check (user counts and revenue
  cross state thresholds); accessibility pass.
- **Annually:** security program review (Safeguards), PCI self-assessment once billing exists, DMCA
  agent registration renewal (every three years), Terms and Privacy review.
- **On any change in law** flagged by counsel: re-run the matching section.
