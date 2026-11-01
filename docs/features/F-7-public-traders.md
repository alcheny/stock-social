# F-7 · Public traders: profiles built from publicly available trading records

Status: ready

## Why
Some of the most-watched traders never connect a broker, but their trades are public: large investors, legislators,
company insiders and anyone else whose trades appear in public filings. The owner wants them on Stock Social with
the same profiles as traders who import from the broker, so viewers can compare them on equal terms.

## Decisions
- 2026-11-01: Stock Social tracks traders whose trades are publicly available (large investors, legislators,
  company insiders, any trader with public information) and gives each a profile. Why: the owner's direction.
- 2026-11-01: These profiles are identical to the profiles of traders who import from the broker, except that
  the information comes from public sources instead of a broker connection. Why: the owner's direction
  ("identical to traders who import from SnapTrade, except this time the information is publicly available").
- 2026-11-01: The feature is built now with the fast autonomous cycle used on 2026-11-01 (committee plan debate,
  tests first, tester, user tests, independent review, CI), and every open question below is decided by the
  committee's recommended option, not by the owner. Why: the owner's instruction ("go with committee decision
  rather than human input").
- 2026-11-01: Sources first: company insiders' transaction reports on the securities regulator's public filing system only; legislators' periodic transaction reports and large investors' quarterly holdings reports are not fetched, parsed or stored. Why: decided by the committee under the owner's instruction of 2026-11-01; they carry prices, so an open-market purchase matched first in, first out to a later open-market sale gives an honest percent return, while the others lack prices or trade dates and legislators' reports carry a commercial-use limit (committee record, decision 1).
- 2026-11-01: No market-data vendor: returns come only from prices in the reports; grants, exercises, gifts, earlier holdings, unreconciled holdings and indirect holdings are excluded and counted by reason; open positions show symbols only. Why: decided by the committee under the owner's instruction of 2026-11-01; never guessed, and a vendor is the owner's (POLICY H); the partial open-positions view is flagged to the owner.
- 2026-11-01: Each filer with at least one priced closed round trip gets a users row marked by users.public_filer_id and the same /u/[handle] profile, pane and share card. Why: decided by the committee under the owner's instruction of 2026-11-01; the owner's "identical"; a parallel route would drift.
- 2026-11-01: Public records carry a "Public filing" badge (Demo too on fictional fixtures), never Verified, a filing link per trade, and on every profile, pane, trade and month page the line "Built from public filings. This person has not joined Stock Social, has not connected a broker, has not reviewed this record and does not endorse it." with a correction-or-removal link to /public-records; the share image and unfurl carry the label and that line. Why: decided by the committee under the owner's instruction of 2026-11-01; Verified means broker-imported (POLICY F3a), and the legal member's findings on defamation, false light and implied endorsement.
- 2026-11-01: Filer rows hold an epoch sentinel attestation and a placeholder sign-up attempt that never completed, are excluded from every attestation, funnel, account and referral count, can't be signed into, and only directors and officers get a profile. Why: decided by the committee under the owner's instruction of 2026-11-01; a plausible attestation for someone who never visited would be a false record (legal ruling).
- 2026-11-01: No Follow, Like, thesis, share prompt or join CTA on public records. Why: decided by the committee under the owner's instruction of 2026-11-01; a follow on a company insider reads as "follow their trades" (POLICY F2/F3b).
- 2026-11-01: Public records join the feed in the same ranking and eligibility with the label and the card line "Company insider · from a public filing", but nothing reaches the feed, similar or suggest until 30 days after the latest filing behind the trade; no New-record badge or slot; kept off stock pages. Why: decided by the committee under the owner's instruction of 2026-11-01; equal terms with connected traders without broadcasting trades as they are filed (POLICY F3b) or grouping insiders by security.
- 2026-11-01: Launch switch PUBLIC_TRADERS: 0 off, 1 on (in production only with both contact settings), unset on outside production and in the e2e sandbox with the importer reaching loopback only, off in production; fixtures use fictional filers and symbols; the demo seed adds none. Why: decided by the committee under the owner's instruction of 2026-11-01; real people are shown only after the owner's calls (legal finding 13, business council recommendation).
- 2026-11-01: Corrections and removal: a /public-records page with the contact from a deploy setting, an operator script to hide, unhide and remove (removal blocks re-import), a corrections log with no requester details; public profiles are noindex and out of the sitemap. Why: decided by the committee under the owner's instruction of 2026-11-01; the legal member's conditions on corrections, removal and indexing.
- 2026-11-01: Importer: one file for the source, fetch only, User-Agent from a deploy setting (refuses without it), one worker at no more than 4 requests a second with backoff, counts-only logs, a bounded stage of the hourly sync, a counts-only dry run, and a local fake for tests. Why: decided by the committee under the owner's instruction of 2026-11-01; the filing system's fair-access rules and vendor isolation.

Standing rules that apply unchanged (not owner choices for this feature; listed so the build can't lose them):
- "Verified" keeps its meaning: every activity came from the broker connection (POLICY, DESIGN TR rules). Public
  profiles carry their own source label and a link to each public filing; they never show the Verified badge.
- Percent only on public surfaces (POLICY P3): no amounts, quantities or prices, even where a filing has them.
- Never guessed: a trade whose return can't be computed from the source is excluded and counted, not estimated.
- Losses shown like gains; the disclaimer on every performance surface; no advice, signals, "copy" or "follow
  their trades" language (POLICY F2/F3).
- POLICY T1/T2: no real people's names or third-party trademarks in the repository, issues, PRs or logs. Test
  fixtures use fictional filers; real names exist only in production data imported at runtime.

## Acceptance criteria
Written by the committee in the build's plan debate (docs/features/logs/F-7/), each one testable.

## Out of scope
- Any path for a trader to self-report trades (still forbidden).
- Placing trades, alerts that tell a viewer to trade, or "copy this trader".

## Open questions (decided by the committee)
- Which public sources come first. Company-insider filings carry dates, share counts and prices; legislators'
  periodic reports carry dates and amount ranges but no prices; large investors' quarterly holdings reports carry
  holdings, not trade dates. Which of these can give an honest per-trade percent return, and what each profile
  can show when a source can't.
- Whether returns that need market prices are possible without a new market-data vendor (a new vendor or
  dependency stays the owner's, POLICY H) or must wait.
- Legal limits on each source (commercial-use limits on legislative financial disclosure reports, the filing
  system's fair-access rules, identity and labeling of real people, corrections and removal requests); the AI
  legal committee's findings stand in for counsel (POLICY, owner decision 2026-11-01).
- Whether public profiles appear in the feed ranking beside connected traders, and with what label.
- A launch switch for showing real filers in production, and what the e2e and demo data use.

## Rework notes
