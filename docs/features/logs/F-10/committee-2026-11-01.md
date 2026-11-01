# F-10 committee record, 2026-11-01

Process: UX lead drafts the plan (fresh-context subagent); business lead and engineer review (fresh-context subagents);
up to 5 rounds until both sign. Plan: [plan.md](plan.md) (covers F-10 and F-12; F-12's log links here).

## Round 1
- UX lead draft (232 lines): one helper `lib/record-strip.ts`, one component module `app/record-strip.tsx`, feed data from
  `records()` (no new query), anti-crop band x 309–891, record lines 35 px, "full record" removed (orchestrator correction).
- Business lead: NOT YET. Demands: too early follows the profile's tier (K < 5 or range half-width > 10 pts); Too early
  with the average's weight; "· 95% range" label on pages/images/alt; stock image without a pooled average or range (F3b);
  one PR; variants deferred; a 360 px glance test; decisions recorded and the completeness ban widened.
- Engineer: NOT YET. Demands: single-PR order; query-count test in a default-running DB test; keep existing outputs and
  tests; keep e2e hooks; narrowed guards; alt through generateMetadata (file-based alt overrides it in this Next);
  pixel test via a node:zlib PNG decoder; K equality from records() vs the profile's query.
- Orchestrator rulings: merge origin/main only (never rebase, never merge PR branches); `recordStrip()` takes evidence +
  average, `stripEvidence()` the only source; stock image keeps a static alt claiming no facts, hand-off to the /t owner;
  smaller-ticker variants → follow-up issue (F-10 AC7 → process note in #44).
- Mid-round: #35 (F-4) and #44 (approval council) merged into main and this branch; `stripEvidence` calls
  `cardEvidence`/`evidenceRangeText` directly; link text "@‹handle›'s record".

## Round 2
- UX lead revision (263 lines) meeting every round-1 demand.
- Business lead: SIGN, with 4 build notes (alt in words; image range line ≥ 30 px, one line; one count in the month
  section; Known limits in the PR body).
- Engineer: NOT YET, 3 demands: strip evidence computed and cached in `loadFeedPage` (measured: 4,700-close traders cost
  27–67 ms per 20 at render, outside the LOAD=1 budget); month figures without a count; completeness guard scoped.

## Round 3
- Orchestrator adopted all round-2 demands and notes into the plan ("Round 3 amendments").
- Open question decided by the committee's recommended option: remove the trade page's duplicate footer record link;
  keep it on the month page (UX lead recommendation; business lead and engineer agree).
- Engineer: SIGN (round 3). Build note adopted: the image range line uses the profile's `(… to …) · 95% range` when it fits
  at ≥ 30 px, else drops the "· " (worst cases `(-100.0% to +123.4%)`, `+1234.5%` tested). Business lead: SIGN (round 2).
- Plan signed by both. Build starts: tests first.

## Design system council (PR #48, not yet merged) — orchestrator rulings, 2026-11-01
- Adopted now: display ranges via `cardEvidence` (already the strip's source); the feed's trust badge leads the record
  line inside `.hero` (DS-22), the header keeps name, handle and menu.
- Kept to F-12's approved AC: the image band is the centred square-safe band (x 309–891), not the full-width band of
  §4.3 / DS-19; record lines stay 35 px (40 px would not fit "-123.4% average per trade" in 582 px). DS-19 can rebudget
  the images when it is built; the strip's lines come from one function (`stripImageLines`), so that is one place.
- Kept to D22: the record line replaces "held · closed" on the feed card. DSP-4 (keep "Held · closed" beside it) is an
  open owner question in #48; if the owner adopts it, TradeCard puts the old line back under the strip.
- Wording: the strip keeps the profile's "(lo to hi)" range form (F-10 AC3: equal to the profile's). The council's
  "likely between" wording for the record line lands with #48 in RECORD_STRIP / recordStrip, one place.
