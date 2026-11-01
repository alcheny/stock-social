# Options plan, round 1 reviews (2026-11-01)

Three fresh-context reviewers read `brief.md` and `plan.md` (round 1). All three returned CHANGES. Summaries of each
member's demands, condensed by the orchestrating session; the round 2 plan answers them point by point.

## Business lead: CHANGES
Keeps the core calls: long options as percent on premium paid (−100% expiries shown), short options counted not
shown, options out of headline/CH-1/TR-9/ranking, strike private. Market demand 4, adoption 4, trust 5 if 1–2 are met.
1. The exercise exclusion drops in-the-money longs while worthless ones show at −100%: a negative bias. Price a
   cash-settled exercise from the vendor's cash `amount` when it passes the scale check, count the rest, and say on
   /how that exercised or assigned contracts are left out of the options average.
2. Short options named on their own line, in the stats block, not lumped into "can't price exactly":
   "Short options not shown: N closed, M open. Their risk has no fixed amount to measure a percent against."
   A separate line for the technical exclusions.
3. When a record has options, the headline says it covers share trades, parallel to the options line.
4. Options line fits ≤ 2 lines at 360 px at the headline's type size; "on premium paid" moves to /how.
5. One expiry format everywhere ("exp Dec 19, 2026"), from one formatter.
6. One PR: replace the three-PR rollout with a Known-limits list, each item a `ponytail:` comment.
7. Drop the `/t/[symbol]` "N option trades … not in these numbers" line.
8. Open option positions (TR-4) stay in this PR, long only with the chip; shorts as a count.
9. Worst-case chip layout at 360 px (5-char underlying, "Put option", −100.0%): no truncation, 44 px targets,
   existing color tokens only.
10. Measure: per-cause counts of option closing rows (shown vs counted), returned by the matcher.
Market evidence cited (third-party sources, names omitted under POLICY T1): retail is a large and growing share of
listed options volume, concentrated in short-dated contracts and net call buying; no reliable figure for how common
premium selling is, hence demand 10.

## Legal and compliance member: CHANGES
1. **Consent (P3, P6, POLICY H).** Call/put and expiry are not clearly inside "symbols" and "dates" (expiry is a
   contract term, call/put a direction; /how told traders options were excluded). The consent scope line is owner
   copy: the owner must amend it (suggested "symbols (for options: call or put and the expiry date)") before any
   option trade, contract term or open option position is public.
2. Never show a wrong return (F3c): share lots delivered or removed by an exercise or assignment (same account,
   underlying, day) are excluded and counted; an expiry with a non-zero cash amount, or on a cash-settled underlying,
   is counted, never shown as −100%.
3. Scope is an allowlist of underlying types (equity, ETF); missing or unknown types counted (CFTC row). Option rows
   use the same `source in ('snaptrade','demo')` check: no manual path.
4. Short options counted on their own, shown beside the options line (F4, TR-1), reason stated as the pricing one.
5. Say what the headline and ranking cover; document the ranking treatment and the options range method on /how; no
   forecast wording.
6. Open option positions are looked up, never broadcast (F1, F3b): not in the feed, sections, recap, notifications,
   similar-trader reasons or any per-underlying aggregate; absolute expiry date only, no countdown or "expiring
   soon", no direction words.
7. Verified computed from every source row's source; Demo badge; disclaimer on every option surface.
8. Privacy maps, retention, deletion test and log hygiene for the new tables.
9. The display log covers what the options line showed (TR-5, COMPLIANCE §12).
10. COMPLIANCE §2 CFTC row re-review note; §3 inventory line; §12 /how changed.
Owner-only: the consent line; the vendor's written permission for option-derived public figures (open option
quotes); POLICY F3's /how list ("options" → "short, exercised and assigned options"); CLAUDE.md known limits; Privacy
Policy and Terms drafts; the residual risk that a strike can be approximated from percent, dates and contract terms.

## Engineer: CHANGES
1. **Q7 uses a deprecated endpoint and wrong units, and there is a live P3 leak.** `getAllAccountPositions` already
   returns option positions (`instrument.kind === 'option'`, `OptionInstrument`: OCC `symbol`, `option_type`,
   `strike_price` (string), `expiration_date`, `multiplier` (string), `underlying`). `AccountPosition.cost_basis`:
   "For options, this is per-share", `price` per share, so unrealized % = (price − cost_basis)/cost_basis, no
   multiplier. `fetchPositions` has no kind filter today, so OCC strings (which contain the strike) already reach
   `open_positions.symbol`, shown publicly. Fix in this PR: only equity-like kinds into `open_positions`; options to
   options handling; `future_option`/`future`/`cfd` counted, never shown; purge stored OCC rows of frozen traders.
2. Activity facts: `AccountUniversalActivity` does not promise `option_symbol` on expiry/assignment/exercise rows
   (count those without it); option BUY/SELL already arrive under `BUY,SELL`; add the three event types through one
   exported list; underlying type codes have no futures or index code, so allowlist (cs, et, ad, ps, cef, ut);
   strike normalised to integer thousandths; expiry `[0..10]` validated; `abs(units)`; currency from the activity.
3. **Storage: a separate derived table `option_trades`**, not columns on `closed_trades` (43 query sites in ~25 files
   would silently mix option closes into share math). Shares-only becomes the default with no edits.
4. Raw table `option_activities` with nullable parsed columns so malformed rows are stored and counted; keyset index;
   the option rebuild applies the paper-account and future-date exclusions.
5. Shared files minimal: `rebuildRecord` wraps `rebuildTrades` (whose body PR #40 rewrites) and adds
   `rebuildOptionTrades`; backfill window from both raw tables; `broker.ts` signatures unchanged (optional sink);
   profile page loads options through a separate loader in its own JSX block.
6. One PR scope: profile (options line, option list, excluded lines, open block), headline label, /how, COMPLIANCE,
   demo, the leak fix. Deferred with `ponytail:` comments: feed cards, SW-1 pane, share cards, an option trade page,
   theses and likes on option trades, similar/compare/recap/me-record, the import banner's count.
7. Matching: opens before closes at equal instants then by id; cash cross-check by scale (factor 3 vs 10×multiplier);
   OCC root check with punctuation stripped, mismatches counted; dangling contracts use an injected `asOf`; /how must
   not promise a −100% floor (fees can take a long below it).
8. `optionSummary()` pure and separate (simple returns; clustered interval; no range under 5 bets; no verdict).
9. Property tests with an inline seeded PRNG against an independent reference model, ≥ 1,000 ledgers per property;
   AC corrections (scale units and fees together; ties; no cross-matcher property but a "trades.ts unchanged" check).
10. Privacy maps and tests for the three tables. 11. COMPLIANCE "listed equity and ETF options" (no index claim);
/how wording; broker.ts ponytail replaced by the precise remaining limits. 12. Vendor fake: option rows, events and
option positions in the vendor's shape; a fixture with every case.
Size: about 1,500–1,700 changed lines, ~40% tests: one coherent PR.
