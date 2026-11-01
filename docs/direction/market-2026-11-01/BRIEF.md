# Market research council, 2026-11-01: shared brief (read fully before working)

You are one member of a market research council for **Stock Social** (repo at the repository, read-only for you
except for your own output file in this council folder). Product: public, verified trading records pulled read-only from
supported brokers (via the data vendor SnapTrade). Traders connect a broker; closed trades (percent returns only, no dollar
amounts or quantities) appear on a public profile and in a full-screen vertical swipe feed; the profile link unfurls as a
share card. Losses rank like gains; whole record shown (no per-trade hiding, open positions, confidence intervals on
performance, rankings by interval lower bound). Traders never pay and are not paid. Viewers pay: "Record tools" (compare
traders side by side, saved views, private notes; pull-only, nothing pushed) at $9.99/month or $99.99/year, no free trial.
Adults only (18+). No advice, signals, alerts on trades, or rewards for trading activity.

## Read in the repo (as relevant to your role)
- docs/POLICY.md (BINDING; especially T1, T2, T4, F1-F6, P4)
- docs/DESIGN.md (Stage 1 market thesis and ICPs; §3.5 week-8 kill gates; Stage 5 trust rules)
- docs/features/F-1..F-6 (F-3 = viewer subscriptions and pricing decisions), docs/FEATURES.md, docs/IDEAS.md, team/idea-board.md,
  team/direction-councils.md, docs/COMPLIANCE.md, docs/DECISIONS.md
- Projection dashboard inputs (owner's Oct 25 projection): council/projection-assumptions.json and
  council/projection-benchmarks.json in this folder. Owner's stated summary: break-even at roughly 1.7-2.8% of monthly viewers
  paying; broker data about $1 per connected trader per month.

Week-8 kill gates (DESIGN §3.5): ≥50 traders with a connected broker; ≥60% of them share their card at least once;
≥5,000 profile views from external referrers per week; viewer D7 return ≥15%. Miss two or more → stop and re-interview.

## Rules (binding, POLICY)
- **T1/T2/T4: never write a third-party company, product, app or platform name, or a real person's name**, in your output file —
  not even in prose about competitors. Describe generically: "a large social copy-trading broker", "a short-video platform",
  "a commission-free app broker", "an investor microblog". Only integrated vendors may be named: SnapTrade, Next.js, React,
  Vercel, Postgres, Playwright, GitHub, Claude/Anthropic. For source citations, URLs are allowed only if the domain/path does
  not contain a third-party brand: prefer government, regulator, court, academic, statistics-agency and standards URLs
  (sec.gov, finra.org, federalreserve.gov, consumerfinance.gov, ftc.gov, census.gov, bls.gov, esma.europa.eu, fca.org.uk,
  doi.org, arxiv.org, ssrn.com, nber.org, pewresearch.org...). When the best source is a company page/press release, cite it as
  "[S<n>] company investor release, <generic description>, <date>, accessed 2026-11-01" without the URL or name, and say so.
  No disparaging or comparative claims about named companies (you name none anyway).
- **No invented data.** No fabricated quotes, survey results, interviews or numbers. Every number has a source you actually
  opened (WebFetch) or is labelled "estimate" with the arithmetic shown, or "assumption". Persona walkthroughs are labelled
  "SIMULATION — not research data". Public forum/review themes are summarized (no verbatim quotes of individuals, no usernames).
  Note: DESIGN.md mentions "interviews of ICP-S1"; there is no record of them in the repo — treat them as unverified.
- **No advice**: nothing that recommends securities or trades; this is market research about the product.
- **No minors or cohorts including minors**: talk about adults, "18-29 year-old adults" etc.
- Don't use the words "guaranteed", "risk-free", "beat the market", "copy their trades" except when quoting a rule.
- Confidence labels on each claim: High / Medium / Low.

## Output format (your file in this folder)
Markdown, with: a header (member, pass), numbered claims C1..Cn each with evidence, source ids, confidence; a sources
list [S1]... (title-ish generic description, publisher type, date, URL if allowed by T1, "opened: yes"); open questions.
Keep it dense: 800-2000 words. Write ONLY your own file. Do not edit the repo. Do not commit.
