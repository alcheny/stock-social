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

## Fix round 1 (after the independent review, tester and user tests)
Sources: `review.md` (no blocking findings; six verified non-blocking items fixed), `test-tester.md`,
`committee-business-lead.md`, `committee-ux-lead.md`. The QA and user-test pass was run by one session playing the
three roles (it had no subagent tool); each report says so.

11. **AC 15's wording is aligned with plan Round 5 item 4**, which the committee signed: the full four-row top block is
    on the profile; the pane, trade and month pages carry the badges, the not-joined sentence and the correction link.
    Why: the feature file's AC 15 had been written wider than the signed plan; the narrower set keeps the pane's chart
    above the fold at 360 px while every surface still says who did not join and how to ask for a correction.
12. **The feed pane may show a filer's closes inside the 30-day floor**, as the profile does. Why: the legal condition
    (Round 5 item 7) covers reads that bring a filer to a viewer who did not open that filer; the pane opens only when
    the viewer swipes to that filer from a card built from closes past the floor, so nothing inside the floor is pushed.
13. **Trade and month share-image alt text carry the label and the not-joined line; `/public-records` has its own
    description; a filer's month page says "Closed trades this month".** Why: legal C9/C15 and the no-completeness rule
    (POLICY F3a), from the business lead's and UX lead's demands.
14. **Not changed in F-7:** the profile's average rounding at an exact half (+9.7% vs +9.8% elsewhere) predates F-7 and
    affects every record; the 20 px trade-row links and 35 px chart buttons predate F-7. Recorded for a later fix.

## Fix round 3 (orchestrator review)
15. **Holdings not given as a share count are unknown.** A row whose holdings after the transaction are missing (the
    format allows a value instead of a share count) makes that security unreconciled from there on: its later sales
    are excluded and counted as `unreconciled`, never priced. Why: with no count, earlier holdings of unknown cost can't
    be ruled out ("never guessed"); a first-seen purchase with no count used to publish a return.
16. **Real filers show in production only while the launch gate is open** (`gateState() === 'open'`, plus
    `PUBLIC_TRADERS=1` and both contacts). The sandbox path (fictional loopback filers in the e2e build) is unchanged.
    Why: the launch gate is the owner's; built closed, opening it is the owner's call.
17. **Hiding a filer's trade from one's own feed stays allowed and is labelled correctly.** `/me/hidden` shows
    "Public filing" (and Demo only for a fictional filer), never a bare Demo. Why: a viewer-only hide does not alter the
    record anyone else sees (legal C16), but a real filer's trade must never be called Demo.
18. **A filer's trade and month pages are noindex**, like the profile. Why: legal C22 covers every page of the record.
19. **One import run at a time:** a session advisory lock (47, state) is tried before any request; a run that finds it
    held skips the tick. Why: the 4 requests a second pace is per process; overlapping crons or instances must not
    fetch concurrently.
20. **The day cursor re-lists the whole day and skips filings already read that day** (ids in the cursor), instead of
    an offset. Why: an entry listed late in the middle of a day's index was skipped for good.
21. **A filer's pane, chart and story picture are sent `Cache-Control: no-store`.** Why: a hidden or removed filer must
    not be served from a shared cache for minutes.
