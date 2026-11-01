# F-7 committee decisions, 2026-11-01

Decided by the committee (UX lead, business lead, engineer, legal-and-compliance member) under the owner's instruction
of 2026-11-01 ("go with committee decision rather than human input"). Every open question in the feature file took the
committee's recommended option. Debate record in this folder:
- Round 1: `plan-round1-ux-lead.md` (draft), `plan-round1-engineer.md` (survey), `legal-findings.md` (three
  primary-source fact-checks, findings 1-15, conditions L1-L12; citations kept out of the repo per POLICY T1).
- Round 2: `plan-round2-business-lead.md` (REVISE), `plan-round2-engineer.md` (REVISE, merged build plan §4),
  `plan-round2-legal.md` (REVISE, binding conditions C1-C24).
- Round 3: `plan.md` (merged; disagreements settled in its §1).
- Round 4: a sign-off pass written in role by one session (marked as such in each `plan-signoff-*.md`); changes kept.
- Round 5: independent fresh-context sign-offs (the "Independent sign-off (fresh context)" sections of
  `plan-signoff-*.md`): engineer SIGN; business lead, UX lead and legal REVISE with text demands, all adopted in
  `plan.md` "Round 5 changes" (legal's verbatim), on which each said it signs. Final: all four signed.

## Decisions
1. **Sources first: company insiders' transaction reports only**, from the securities regulator's public filing system.
   Why: they carry dates, transaction codes, share counts and prices, so an open-market purchase matched first in,
   first out to a later open-market sale gives an honest percent return; the regulator states its data may be copied
   and redistributed. Legislators' periodic transaction reports (amount ranges, no prices, and a statutory
   commercial-use limit whose news-media exception is undefined) and large investors' quarterly holdings reports (no
   trade dates) are not fetched, parsed or stored.
2. **No market-data vendor.** Returns come only from prices in the reports. Every other acquisition (grants,
   exercises, gifts, holdings before the first report) is an unknown-cost lot; a sale touching one is excluded and
   counted by reason; a holdings figure that doesn't reconcile excludes later sales in that security; indirect
   holdings are excluded and counted (`indirect`). Open positions show symbols only, with no percent. Why: never
   guessed (standing rule); a vendor is the owner's (POLICY H).
3. **Same profile, same page.** Each filer with at least one priced closed round trip gets a `users` row (marked by
   `users.public_filer_id`) and the same `/u/[handle]` profile, chart, stats, range, evidence line, lists, pane and
   share card. Why: the owner's "identical"; a parallel route would drift.
4. **Never Verified; its own label.** A "Public filing" badge (plus Demo on fictional fixtures), a "Filing ↗" link per
   trade, and on every profile, pane, trade and month page: "Built from public filings. This person has not joined
   Stock Social, has not connected a broker, has not reviewed this record and does not endorse it." with "Request a
   correction or removal →" to `/public-records`; the share image and unfurl carry the label and the not-joined line.
   Why: "Verified" means broker-imported (POLICY F3a); defamation, false-light and endorsement risk (legal findings).
5. **No consent fiction.** Filer rows hold an epoch sentinel in the required attestation column and point at one
   placeholder sign-up attempt per source that never completed; every attestation, funnel, account and referral
   count excludes them; no sign-in path can reach them; only directors and officers get a profile (adults by rule).
   Why: a plausible attestation for a person who never visited would be a false record (legal ruling (a)).
6. **No Follow and no Like on public records; no thesis, share prompt or join CTA.** Why: a follow on a company insider
   reads as "follow their trades" (F-7 standing rule, POLICY F2/F3b).
7. **Feed: same ranking, same eligibility, with the label**, losses ranked like gains; card line "Company insider ·
   from a public filing"; nothing reaches the feed, similar or suggest until 30 days after the latest filing behind the
   trade; no New-record badge or slot; kept off stock pages. Why: equal terms with connected traders (owner) without
   broadcasting trades as they are filed (POLICY F3b, C17) or grouping insiders by security (C18).
8. **Launch switch `PUBLIC_TRADERS`**: `0` off; `1` on (in production only with both contacts set); unset = on outside
   production and in the e2e sandbox with the importer reaching loopback only, off in production. Fixtures are
   fictional filers and symbols with the Demo badge; `db:seed` adds none. Why: real people are shown only after the
   owner's calls (legal finding 13, business council BC-11).
9. **Corrections and removal:** a `/public-records` page (contact from a deploy setting), an operator script to hide,
   unhide and remove (removal deletes the profile, raw and derived rows and blocks re-import), and a corrections log
   with no requester details; public profiles are `noindex` and out of the sitemap. Why: legal C12-C14, C22.
10. **Importer:** one file per source, fetch only, User-Agent from env (refuses to run without it), one worker at most
    4 requests a second with backoff, logs counts only, a bounded stage of the hourly sync, a counts-only dry run, and
    a local fake for tests. Why: the filing system's fair-access rules (legal fact-check 2), vendor isolation.

## Owner items (built up to the switch, flagged)
POLICY P3's reading for people who never connect; partial TR-4 (no unrealized percent); the two contact addresses,
the removal policy, Terms and Privacy covering these profiles, the production switch and the business lead's dry-run
threshold (at least 100 filers with 5+ priced closes); optionally null attestation columns via a constraint change;
legislators' and holdings sources (a price vendor plus written acceptance of the commercial-use risk).

## Note: label versus the design system council's trust language (2026-11-01)
The design system council (PR #48, not yet merged at build time) lists "Public source" as F-7's trust label. F-7 keeps
**"Public filing"**. Why: the legal member's conditions (C11, C15, AC 13/14/34) name that label verbatim; it says what
the evidence is (a filing a viewer can open from every trade), where "source" would also fit a broker connection; and
the record is built from one kind of source only. The label lives in one copy constant (lib/copy.ts F-7 block), so a
later design-system pass can rename it with the legal member's sign-off. Numbers and dates use the existing pct() and
date helpers.
