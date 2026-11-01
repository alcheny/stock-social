# F-7 · Public traders: profiles built from publicly available trading records

Status: built

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
- 2026-11-01: AC20's footer string is amended by F-25 (`docs/features/F-25-one-link-rule-for-trade-rows.md`): the
  footer's profile link reads "Record, wins and losses →" on connected and public-record cards alike, from one copy
  constant. AC20 below is left as written. Why: decided by the committee under the owner's instruction of 2026-11-01
  (design council cycle 3); both footer links fit on one line at 360 px only with the shorter text.

## Acceptance criteria
Written by the committee in the build's plan debate (`docs/features/logs/F-7/plan.md`, rounds 3-5, on
`plan-round2-engineer.md` §4.3), each with its test (`lib/f7-*.test.ts`, `e2e/f7-*.spec.ts`).
1. Insider FIFO math: an open-market purchase at 10 sold at 12 is +20.0%; two equal purchases at 10 and 14 sold at
   13 are +8.33%; losses stay negative.
2. Never guessed: a sale of granted shares, of shares held before the first report, or partly of unknown-cost shares
   is excluded whole and counted (`no_price`); gifts and other dispositions are counted; derivative rows (`derivative`)
   and indirectly held rows (`indirect`) are never matched; a holdings figure that doesn't reconcile excludes every
   later sale in that security (`unreconciled`).
3. Amendments replace the rows of the filing they amend (latest filed wins) and the rebuilt percent changes.
4. Derived rows hold percent only: no quantity, price or amount; `closed_trades` gains only `filing_url`, `feed_after`.
5. Identity is the filer id, never the name: two filers with one name get two profiles; re-import is idempotent.
6. Adults by rule: only filers reporting a director or officer role get a profile; large holders only and "other"
   only are skipped and counted.
7. A filer is never an account: no sign-in path (dev login and every other) creates a session for one; nobody signs
   up or renames into `pf_`; `rebuildTrades` refuses a filer; a filer is never a referrer.
8. Switch: `PUBLIC_TRADERS=0` off; `1` on (production needs both contacts); unset on outside production and in the
   sandbox, off in production; unset reaches loopback only; the importer doesn't run when off.
9. Switch off, hidden or removed: every profile route 404s and no feed, similar or suggest query returns the filer.
10. Sources: only company insiders' reports can be enabled; anything else listed is ignored.
11. Fair access: no request without `PUBLIC_FILINGS_CONTACT`; every request carries the product and contact in its
    User-Agent; one worker, ≥ 250 ms apart; backoff and stop on repeated refusals; logs hold no filer or issuer name.
12. Parser: fixtures parse to the expected rows; truncated, oversized or unknown documents are skipped and counted.
13. Never Verified: every trust function returns the public kind for a filer; "Public filing" in image and unfurl
    text; the copy test bans "insider buying", "insider trading", "smart money", "signal", "copy", "follow their
    trades", "trade like" and completeness claims.
14. Labels on every surface (profile, feed card, pane, trade, month, share card): "Public filing" and, on fixtures,
    "Demo"; never a Verified badge.
15. Top block on the profile, in order: badges and "Company insider"; "Built from public filings. This person has
    not joined Stock Social, has not connected a broker, has not reviewed this record and does not endorse it.";
    "Record since … · last checked … · Request a correction or removal →" to `/public-records`; "Filings can be late,
    amended or missing." The pane, trade and month pages show the badges, the not-joined sentence and the correction
    link (plan Round 5 item 4). No horizontal scroll at 360 px; the pane chart stays above the fold.
16. Each closed trade links its filing ("Filing ↗", 44 px target, named as opening another site); the trade page
    links the sale's filing.
17. No amounts: profile, trade and pane HTML, image alt and unfurl meta contain none of the fixture's share counts
    or prices.
18. Exclusions are shown by reason with counts; a filer with no priced round trip has no page (404) and is counted.
19. Open positions: symbols only with the no-price sentence; no percent and no unrealized grid.
20. Feed: an eligible filer (5+ closes) appears with the label and card line "Company insider · from a public
    filing" and footer "See their record, wins and losses →"; same score and TR-9 bound as connected traders; losses
    rank like gains; a lone purchase never appears.
21. Feed floor: nothing from a filing reaches the feed, similar, suggest or sections until 30 days after the latest
    filing behind the trade (opening purchases and sale, after amendments); an embargoed close leaves feed list, order
    and weights unchanged; a filer whose 5th close is embargoed is not eligible; the profile shows closes at once.
22. Off stock pages: no public close on `/t`, `/t/[symbol]`, `/t/compare`, the ticker image or the sitemap.
23. Hide and remove: hide 404s every route and drops the filer from the feed, unhide restores both; remove deletes the
    profile, raw and derived rows, keeps only the filer id, source and removal time, and re-import never recreates
    it; each action is logged with a reason code and no requester details.
24. Privacy maps cover the four new tables and the two new columns.
25. Signed out and signed in see the same public record, free.
26. Footer disclaimer on every F-7 page; `/how` has the "Public filing records" section; links ≥ 44 px; color never
    alone.
27. Size: the PR's product lines stay within the Gate's cap, or the build stops and flags.
28. No Follow, Like, double-tap like, thesis form, share prompt or join CTA on public records; the follow and like
    actions refuse a filer.
29. A filer row has `public_filer_id`, the epoch placeholder attestation and no broker link (database check), and
    the funnel, attestation and referral counts exclude it; the placeholder attempt survives the purge or is recreated.
30. Public profiles are `noindex` and absent from the sitemap.
31. A public record never shows the "New record" badge or fills the new-record slot.
32. Stored raw rows have no address, signature, remarks, footnote or indirect-holding label.
33. Dry run: against the fake, writes zero rows and prints counts only (no fixture name).
34. Share card data, image alt and unfurl description carry "Public filing" and "has not joined Stock Social"; the
    line is at least 24 px at 1200x630; no Verified and no amount.
35. "Last checked" is the source's last successful import; the "may be out of date" line shows only when the source
    has had no successful run for 7 days.

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

## Build log
- 2026-11-01: Merged to main in #56 (d98f32d) and #67 (3d66114) by the orchestrator session; Status set to built (the pipeline sets it in its own PRs; interactive builds did not), so the feature pipeline does not pick it up as ready again. Waiting for the owner to try it.
