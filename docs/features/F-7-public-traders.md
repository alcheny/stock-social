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
