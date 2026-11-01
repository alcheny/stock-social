# Options support: committee record, 2026-11-01

Task: remove the known limit "equities/ETFs/crypto only; options need contract-level matching" (`lib/broker.ts`) and
CLAUDE.md "Options are skipped in fetchActivities; long-only FIFO", under the owner's instruction to resolve every
`ponytail:` known limit, with the committee deciding open questions (owner's standing instruction: the committee's
recommended option decides).
Committee (fresh-context subagents): UX lead (plan), business lead, engineer, legal-and-compliance member (reviews),
then tester, user tests and an independent code reviewer. Orchestrated by the owner's session.
Files: `brief.md` (facts), `plan-round1-reviews.md` (round 1), `plan.md` (the signed plan, v4, with every round's
answers in its last table).

## Rounds
| Round | Plan | Business lead | Engineer | Legal | Main change |
|---|---|---|---|---|---|
| 1 | v1 | CHANGES (10) | CHANGES (12) | CHANGES (10) | Three-PR plan with option columns on `closed_trades`; reviewers found a live P3 leak, a deprecated endpoint, the consent gap |
| 2 | v2 | CHANGES (1) | CHANGES (1) | CHANGES (3) | One PR, separate tables, consent gate, profile-only scope |
| 3 | v3 | SIGN | CHANGES (3) | SIGN with a condition | Per-trader consent gate, no edit to `rebuildTrades`, "Share trades" label on every headline surface |
| 4 | v4 | (signed) | SIGN | CHANGES (1) | Gate scoped to connections holding option rows, loader-only reads, static-markup surface tests |
| 5 | v4 + text edit | (signed) | (signed) | SIGN | Gate written from the option rows' side: an option account with no covering connection stays gated |

## Decisions (each with the reason; details and acceptance criteria in plan.md)
| # | Decision | Why |
|---|---|---|
| 1 | One PR. Options are imported, matched per contract and counted now. | Orchestrator constraint; options today are dropped without a count, so counting is strictly better. |
| 2 | Raw `option_activities` (nullable parsed columns, malformed rows stored and counted); derived `option_trades`; `open_option_positions`. `closed_trades` untouched. | 43 query sites read `closed_trades`; separate tables make "share trades only" the default for headline, CH-1, TR-9, ranking, feed and `/t` with no edits, and merge trivially with PR #40. |
| 3 | Contract key: account, underlying, expiry, call/put, strike (integer thousandths), multiplier (10 mini, else 100), from the typed vendor fields; the OCC root is a cross-check, a mismatch is counted. | Never guess a contract; adjusted contracts are counted (F3c). |
| 4 | Long options: percent on what the contracts cost, fees included. A worthless expiry is −100%; fees can take it slightly lower, and /how promises no floor. | The premium is the capital at risk; honest and comparable. |
| 5 | Short options: counted, never shown with a percent; a separate count and line. | No basis is both honest and comparable (premium caps gains at +100% with unbounded losses; collateral is a broker rule we can't read; strike notional makes losses look tiny). Same reason as short stock sales (F3c). Counted on its own line because it is a trader's choice, not a data gap (F4, TR-1). |
| 6 | Excluded and counted: exercises, assignments, expiries with cash, event rows without a contract, contradicting or flipping rows, closes with no open, dangling contracts (5 days past expiry, injected `asOf`), adjusted roots, multiplier or currency mismatches, underlyings outside the allowlist (common stock, ETF, ADR, preferred, closed-end fund, unit), malformed rows, cash scale failures. | F3c: what can't be priced honestly is excluded and counted, never guessed. Allowlist, not denylist: options on futures stay out (COMPLIANCE §2, CFTC). |
| 7 | Share closes whose hold spans an exercise or assignment day in that account and stock are removed after the share rebuild and counted (thesis kept). | A delivered or removed share lot would show a return that leaves out the premium (legal). Done in `rebuildRecord` so `rebuildTrades` and `lib/trades.ts` stay untouched for PR #40 (engineer). Conservative; known limit K8. |
| 8 | Consent gate, per trader. Option returns and contract terms (call/put, expiry) are public only when the owner's consent scope line names them (derived from `PUBLIC_FIELDS`, no env var) AND every connection holding an account with option rows consented under such a line (`connections.consent_scope_hash`, `lib/consent-versions.ts`). Unknown accounts and older consents stay gated; demo traders skip the per-trader part. | Legal: call/put and expiry are not clearly inside today's words "symbols" and "dates"; the consent line is owner copy. Re-consent is required (committee finding); the owner words the prompt. |
| 9 | While gated, profile, SW-1 pane and record card show one count line ("N option trades and M open options imported, not shown: this record's public consent doesn't cover options yet.") and the headline label "Share trades". Every option result, gain or loss, short or counted, is withheld alike. | Counts are within today's words (precedent: excluded-position counts); nothing is hidden selectively (F4). The label keeps share-only numbers from reading as the whole record (business lead, legal). |
| 10 | When open: the options line under the headline (count, win rate, average, range from 5 independent bets), the short line, the technical line, an "Option trades" list with a text chip ("Call option"/"Put option") and "exp Dec 19, 2026", long open options in the open block. Profile only. | Whole record (F4), at the headline's prominence; the strike, premium and contract counts stay private (P3). |
| 11 | Headline, CH-1, max drawdown, TR-9 and trader ranking stay share trades only. | A −100% close pins an equal-weight compounded curve at −100% for good, and `confidence()` would take its log as ≈ −20.7; the options line carries its own range. |
| 12 | Open positions: `fetchPositions` keeps only equity-like kinds in `open_positions`; options go to the options path (percent per share, no multiplier, as the SDK documents); futures-type kinds are counted; stored option symbols are purged. Not gated. | Engineer found a live P3 leak: option contract symbols (which contain the strike) reached public open positions. |
| 13 | Open option positions are looked up on the profile only: never in the feed, sections, recap, similar reasons or any per-security aggregate; absolute expiry dates only, no countdown or direction words. | F1, F3b: records are looked up, not broadcast. |
| 14 | /how: an options paragraph (shown once consent covers them; the cost basis; share-only headline) and the excluded list reworded (short sales and short options; exercised or assigned options and the share trades held over that day; adjusted, non-stock and dangling contracts), including that the options average leaves out contracts that ended in the money. | Business lead: the exercise exclusion biases the options average; disclose it. |
| 15 | COMPLIANCE §2 CFTC row re-reviewed (listed equity and ETF options only; index options not claimed); §3 inventory; §12 /how note. | Legal, engineer. |

## Known limits (each a `ponytail:` comment in code; listed in the PR body)
K1 feed cards and the pane's trade list are share-only (cap option size at 100% when they come); K2 no per-trade
option share card; K3 no option trade page, theses or likes; K4 similar, compare, recap, `/me/record` and the import
banner count ignore options; K5 corporate actions on the underlying caught only by an OCC root change; K6 cash-settled
exercise not priced, index underlyings out; K7 per-cause counts returned, not stored; K8 the exercise-day share rule is
conservative; K9/K10 traders stay gated until they consent again (no re-consent prompt yet).

## Owner items
Amend `CONSENT_SCOPE_LINE` and its field entry (opens the gate); word the re-consent prompt; protect the consent line,
its test, `PUBLIC_FIELDS` and `lib/consent-versions.ts` in CODEOWNERS; the vendor's written permission for public
option-derived figures and open option quotes; POLICY F3's /how list; CLAUDE.md known limits; Privacy Policy and Terms
drafts; accept the residual risk that a strike can be roughly inferred once figures are public.

## Build, QA, user tests and review
(appended below as they happen)
