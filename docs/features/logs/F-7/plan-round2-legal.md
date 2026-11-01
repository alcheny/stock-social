# F-7 plan, round 2: legal and compliance review of the round-1 plans

Date: 2026-11-01. Author: the legal-and-compliance member of the F-7 committee. Reviewed: `plan-round1-ux-lead.md`,
`plan-round1-engineer.md`, against `legal-findings.md` (findings 1-15, conditions L1-L12), `docs/POLICY.md` and
`docs/COMPLIANCE.md` Section 1. AI legal analysis accepted by the owner in place of counsel (POLICY, owner decision
2026-11-01); the calls it leaves open are the owner's. All names in examples are fictional.

## Verdict: REVISE

Both plans are buildable and agree on the essentials: insider reports only, percent only, FIFO with unknown-cost lots
excluded and counted, a "Public filing" label that is never Verified, filing links, a not-joined line, a launch switch
that is off in production, and fictional fixtures. Six points must change before I sign. (1) The proposed attestation
fill records an attestation nobody made. (2) The importer rate is above the 5 requests per second in L9. (3) Raw
storage must drop personal fields the matcher doesn't need. (4) Fixture filers must carry the Demo badge (P2, L3).
(5) Follow and likes stay off public-record profiles. (6) Recency-driven labels and slots don't apply to these
profiles. I sign once conditions C1-C24 are in the plan the build follows.

## Rulings on the five questions

**(a) The users row and the attestation columns.** A `users` row per filer is acceptable as structural reuse: follows,
likes, the feed and the share card key on it, and a parallel path would duplicate them. Filling `adult_attested_at`
with the importer's run time and pointing `signup_attempt_id` at a `'dev'` attempt with `completed_at` set is **not
acceptable as proposed**. Attestation rows are consent records we keep to answer regulators (COMPLIANCE §12, §7). A
row that reads like an attestation at a plausible time, for a person who never visited, is a false record, and any
count or export built later would include it. The demo seed's precedent doesn't carry over: demo traders are
fictional and labeled Demo, while filers are real people. The honest way, within the additive-schema rule:
- The marker lives on the row itself: `users.public_filer_id` (references `public_filers`, set when the row is
  created, never cleared while the row exists), plus an additive check that a marked row has no broker link
  (`public_filer_id is null or snaptrade_user_id is null`). A subquery on `public_filers` alone is too easy to
  forget in a new query, and its `on delete set null` loses the fact.
- The NOT NULL columns get a **sentinel, not a plausible time**: `adult_attested_at` = the epoch
  (`1970-01-01T00:00:00Z`), on the filer row and on one shared placeholder `signup_attempts` row per source with
  `completed_at` null and `user_id` null. No real attestation can carry that value. A schema comment says these
  values on marked rows are placeholders and are not an attestation.
- Every reader of attestations, attempts or accounts excludes marked rows, each with a test: the funnel
  (`lib/funnel.ts`), any user or account count, the attestation record or export, retention and purge reports, and the
  referral counts.
- No sign-in path can reach a marked row: the dev login, email, provider and brokerage sign-in, and the device link.
  No `identities` row and no session can attach to it (a test per path, and a database-level guard where one is
  additive).
- Deletion-by-user flows don't apply: a filer can't sign in. Removal goes only through the operator path (C13).
- Owner item: the owner may later allow a constraint change, so that marked rows hold null attestation fields, and
  backfill them. Until then the sentinel stands.

**(b) Follow, likes, share card and feed for people who never joined.** These are allowed only as far as the pages stay
impersonal, looked-up records (findings 11, 12 and 14, F3b, F1a):
- **Follow: not offered** on public-record profiles, panes or cards in this release (agreeing with the UX lead). A
  follow on a company insider reads as "follow their trades" (finding 12). Any follow-weighted ordering would also
  surface a filer's newest closes first, which is a feed item timed to a filing in effect.
- **Likes: not offered** on public-record trades in this release. A visible count of reactions to a real insider's
  sale is social proof on a signal-like event, and the person can't answer it. The viewer-only "Not interested" or
  hide controls stay: they only remove things.
- **Share card and unfurl: allowed.** The image carries the "Public filing" label, the line "This person has not
  joined Stock Social", the disclaimer, percent-only figures and the evidence label. It never carries Verified, an
  amount, a share count, a price or open positions. The unfurl description carries the label and the not-joined line.
  There is no share prompt, and the system share sheet and Copy link work as on any page.
- **Feed: allowed** in the same ranking and eligibility as connected traders (losses rank like gains), with the label
  and the card line on every card. They never appear inside any surface or section labeled Verified (L11).
- **No notifications, ever:** nothing in any channel whose content or timing comes from a filing or a filer (F3b scope,
  owner amendment 2026-11-01).

**(c) Removal and contact: in this PR vs. the owner's.** In the PR: the `/public-records` page (what these profiles are,
the source, what is excluded, that the person did not join and does not endorse the product, and how to ask for a
correction or removal); a link to it from every public profile, public trade page, pane and `/how`; the contact,
rendered from a deploy setting and never committed; whole-profile removal; hide pending review; suppression of
re-import; a corrections log; and tests for all of these (C12-C15). With the contact unset, the page says requests
open before launch, and the switch can't turn on in production (C19). **Owner only:** the contact address and its
mailbox, the removal policy (my recommended default: remove on request for filers who are not elected officials), any
promised response time, the Terms and Privacy Policy text, and turning the switch on.

**(d) Open positions as symbols with no percent.** This is compliant with the percent-only rule: it shows no price,
quantity or value. It is a partial TR-4, which is the owner's product call (O2), not a legal blocker. Conditions: the
list shows symbols only, with no share count, cost, dates or "added" marker; it is not ordered by recency; it is not
on the share card or feed card; and it carries the sentence that only shares bought in open-market purchases shown in
the filings are listed, that this is not the person's full holdings, and that current value isn't available.

**(e) Launch switch semantics.** Acceptable, with three additions: (1) in production an explicit `PUBLIC_TRADERS=1` is
the only way on; unset or `0` is off, including preview deploys; (2) when the switch is on only because of the sandbox,
the importer may reach a loopback base URL only, so no real filer can enter a sandbox or CI database; (3) with an
explicit on in production, the importer and the routes stay off unless the user-agent contact and the corrections
contact are both set. The off state is tested end to end: 404 on routes, nothing in the feed, similar, suggest, sitemap
or share card, and no import.

## Binding conditions

**Identity and accounts**
1. **C1.** `users.public_filer_id` marker plus the no-broker-link check. Attestation fields on marked rows hold the epoch
   sentinel, via one placeholder attempt per source (`completed_at` null). A schema comment says they are not an
   attestation. Ruling (a).
2. **C2.** Every attestation, attempt, account, funnel and referral reader excludes marked rows, with tests. No sign-in
   path, identity or session can attach to a marked row, with a test per path.
3. **C3.** Profiles are keyed to the filing system's filer identifier. The display name is copied as filed (cut only
   for length). Never matched or merged by name. Either route (`/u/<handle>` or `/p/<slug>`) is acceptable. Wherever
   the handle shows, the label and the not-joined line show with it. A removed filer's handle stays reserved like any
   deleted handle.

**Data minimum (P3, findings 5 and 15)**
4. **C4.** Raw rows keep only what the matcher and the filing link need. `raw` must not store the reporting person's
   address, signature, remarks or footnote text: store the parsed fields and the filing URL, not the whole document.
   Prices, share counts and holdings stay in raw tables only and are never rendered, exported, logged or put in derived
   tables, share cards or unfurls (a test scans rendered HTML, image alt and meta for the fixture's prices and counts).
5. **C5.** Privacy retention and field maps cover every new table and column, with retention set to "until removal
   request". The suppression row keeps the filer identifier, source and removed time only.

**Importer (L9, finding 15)**
6. **C6.** At most 5 requests per second, one worker, shared by the module (not 10). Backoff on refusals and server
   errors. Bulk and structured feeds only, never crawled pages.
7. **C7.** The User-Agent comes from env and names the product and an administrative role contact. There is no default,
   and nothing is fetched without it. The placeholder in `.env.example` uses a reserved example domain.
8. **C8.** Logs and error messages hold counts, ids of runs and durations only: no filer or issuer names, and no payload
   text, including in parse errors.

**Record honesty (findings 6-8, F3a, F3c)**
9. **C9.** Never Verified: `verified` is false on every public row, and every Verified count, claim or surface excludes
   them. The "Public filing" label and its title say it is not Verified and does not verify identity or completeness.
   An e2e walk asserts no Verified badge on any public surface.
10. **C10.** The profile shows the exclusion counts by reason (unknown-cost shares, didn't reconcile, derivative)
    whenever they are above 0. It also shows "Filings can be late, amended or missing" next to "last checked", and the
    stale line after 7 days. Amendments supersede; derived rows are rebuilt, never patched. The broker rebuild refuses
    to run for a filer.
11. **C11.** Fixture filers carry the Demo badge beside "Public filing" (P2, L3), through a `demo` marker on
    `public_filers` that the production importer never sets. e2e asserts Demo + Public filing and no Verified. A unit
    test asserts a non-demo public filer shows no Demo badge. If `db:seed` gets fixture filers, they are fictional and
    marked the same way.

**Corrections and removal (findings 13, L7, P6)**
12. **C12.** `/public-records` as in ruling (c). The copy promises review and a reply only, never an outcome or a time.
    It is linked from every public profile, trade page, pane and `/how`, and it is reachable with the switch off
    (with no names).
13. **C13.** An operator path to remove a filer (deletes the profile, raw rows and derived rows, sets `removed_at`, 404s
    on every surface, and re-import never recreates it) and to hide one pending review (reversible, with the same 404
    and surface exclusion). Both are tested.
14. **C14.** A corrections log row for each hide, unhide, rebuild or removal: filer id, action, reason code and time.
    No requester contact details are stored in the database.
15. **C15.** The not-joined and non-endorsement line on every profile, pane and trade page: "Built from public filings.
    This person has not joined Stock Social, has not reviewed this record and does not endorse it."

**Signals and engagement (findings 12 and 14, F1a, F2, F3b)**
16. **C16.** No Follow and no Like on public-record surfaces. No thesis forms, share prompt or join CTA. Only the
    viewer-only hide controls remain.
17. **C17.** No notification, email, push or feed item whose content or timing comes from a filing. No ranking input,
    slot, badge or label from filing date, filed time or import time. The "New record" badge and the feed's
    new-record slot don't apply to public-record profiles, because a filer's record start is the filing history, not
    a join. The evidence label still shows.
18. **C18.** No page, section, filter, sort, count or aggregate that groups insiders or scores a security by their
    activity. Public trades stay off `/t` in this release (the engineer's plan); adding them later needs a committee
    review. The copy test bans "insider buying", "insider trading" (it implies illegality: a defamation risk),
    "smart money", "signal", "copy", "follow their trades", "trade like" and completeness claims.

**Switch and launch (L1, L2, L10)**
19. **C19.** Switch semantics as in ruling (e). An explicit on in production also requires the user-agent contact and
    the corrections contact to be set, or the switch reads as off. The env table is unit-tested.
20. **C20.** Insider reports are the only source. The schema check (`source in ('insider_reports')`) is the per-source
    gate, and widening it is the owner's (it needs a constraint swap). Legislator and holdings reports are not
    fetched, parsed or stored.
21. **C21.** Free and readable signed out. Never behind a paid feature, ad targeting or export.
22. **C22.** Public-record profiles are `noindex` and stay out of the sitemap until the owner decides otherwise. Shared
    links still work. This limits the spread of an error while corrections are new.

**Repository and disclosures (finding 9, L12, F3)**
23. **C23.** Fixtures, tests, e2e data, screenshots, PR bodies and prompts use only fictional filers, issuers and
    symbols. No list of chosen real filers or issuers exists in code, and selection is by rule only.
    `scripts/compliance.ts` passes.
24. **C24.** `/how` gains the "Public filing records" section as the UX lead drafted, and adds that filings can be late,
    amended or missing. The disclaimer is on every public surface, including the share image. The PR's `## Compliance`
    section answers COMPLIANCE Section 1. Items 2 (personal data: names and trades of real people), 6 (accounts:
    marker rows, not accounts) and 7 (a new data source) are answered "yes", citing these conditions.

## Owner items (unchanged from the findings, plus one)

Before the switch goes on in production, the owner must do all of these:
- confirm the P3 reading (finding 10);
- set the user-agent contact and the corrections contact;
- decide the removal policy and any response time;
- make sure Terms and the Privacy Policy cover public-record profiles;
- make the launch decision;
- decide whether to allow the constraint change that replaces the attestation sentinel with nulls (new, ruling (a));
- decide whether public profiles may be indexed (C22).

TR-4 partial (O2) and the route and departure items (O5) are product calls, not legal blockers.
