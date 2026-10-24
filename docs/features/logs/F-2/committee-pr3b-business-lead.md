# F-2 PR-3b "Similar trades" on profiles: business lead verdict

2026-10-24. Commit 266376e, judged against owner decision O2 (F-2 Decisions), plan PR-3b, POLICY and COMPLIANCE Section 1.
I verified it as a user on `next start` port 3119 with my own database, the in-repo vendor fake on 4199 and five
throwaway verified traders whose closes were all losses (median hold 3 days). After the check I stopped the server and
the fake, deleted the users and dropped the database. Port 3000 was not touched and no sync tick ran.

**Decision: ship once demands D1 and D2 are met.** It does what the owner asked, it is honest, and it stays quiet on a
shared link. Two things are not done: the tap opens the trader, not the trade, and the cost sits on the line of the
plan's budget, while the log quotes a budget twice as large.

Demo sentence: "Under a trader's record, three verified trades by other people who hold about as long, losses
included. Tap one to see that person's whole record."

## What I checked

| Question | Finding |
|---|---|
| Stays secondary on a shared link at 375 | **Yes.** It renders after the whole "Closed trades" list and its paging, behind a rule, with a 1rem heading (screenshots `signed-out-375-*`). A visitor reaches it only after the trader's full record. That is the right place. |
| "Similar trades" honest when similarity is only the holding bucket | **Yes, but only thanks to the line under the heading.** "Closed trades by other traders, held about as long as @h's typical trade. Records with more evidence come first. Losses count the same as gains." This says exactly what the rule is. The heading alone suggests more than it delivers (no strategy or symbol match). It is the owner's title, so I keep it. Each row's "Held 1 to 7 days" restates the basis. |
| "SYMBOL · closed <date>" and "Held <bucket>" vs no-numbers and no-advice | **Pass.** There is no return, sign, colour or size, and the trade is in the past ("closed"), with no action verb and no "buy", "top" or "best". A symbol on a dated closed record reads as history, not as a pick. The risk is that a reader might think the trade was chosen because it won. That risk is neutralized because ordering never reads a return (`lib/discovery/similar.ts`, sign-invariance test) and the explain line says losses count the same. Live: the section filled with all-loss records. The sheet carries the F3 disclaimer (`similar-section.tsx`, `sheet-note`). The profile already carries the full disclaimer. |
| 5-close / 3-row gating | **Correct.** Live: a trader cut to 4 closes showed no section. With one candidate deleted and another emptied, only 2 rows qualified and the section was absent, not padded. That is the right empty state: nothing. |
| 10-second caches as a product risk | **Low.** Row membership is read live: `lib/similar.ts` filters `deleted_at is null` and the latest close in each query. Live, a deleted trader left the rows on the very next request, and a trader whose trades were removed dropped out at once. The hourly pool only decides who is a candidate. The 10 s pane cache can show a trader's sheet up to 10 s stale after a rebuild. That is acceptable, and far inside any deletion promise. |
| Profile cost | **On the line, budget misquoted.** Plan PR-3b and the budget table set profile p95 at +≤ 20 ms. The log says "the budget is +50 ms". The 50-close trader measured about +20 ms (worst pairing +26), before the `lazy` change, which only trims client nodes. The HTML grew 64 to 90 KB (+40%) because three full panes are server-rendered for a section most visitors never open. |
| O2: "tapping a row opens that trade on its trader's profile" | **Partially delivered.** With JavaScript, the tap opens the trader's pane (record, chart, last 5). The row's trade is not focused or highlighted, and it may not be among the last 5. Without JavaScript, the row links to `/u/<h>/trade/<sell_id>`, which is correct. The two paths disagree. |

## Scorecard

| Dimension | Score | Evidence |
|---|---|---|
| Market demand | 4 | It is the owner's decision (O2). Related-content rows below a primary item are an observed pattern across content platforms (analogy tier). There is no in-product data yet. Measure the exit share per the plan. |
| Ease of adoption | 4 | No new steps. One tap opens the sheet. It falls to a 3 if the tap keeps landing somewhere other than the trade the row named (D1). |
| Phase fit | 4 | It adds reach between records without competing with the shared trader. |
| Revenue impact | 3 | It is indirect: more records seen per shared link. Unproven until the exit share is measured. |
| Aesthetics & clarity | 4 | The section is quiet and well ordered. The explain line has three sentences, where one would do (D3). |
| Trust & compliance | 5 | No numbers on rows, sign-blind ordering, losses fill it, Demo after Verified, F3 line in the sheet, same for every viewer, signed-out reads no viewer table. |
| Simplicity | 3 | +199 product lines is fine. Shipping three full server-rendered panes on every profile is not near the minimum (D2). |
| Craft & taste | 4 | The empty state is "absent", which is right. The tap target mismatch is the one weak link. |

## Demands

Builder, in priority order:
1. **D1 (O2 fidelity).** A tap must land on the row's trade: the sheet opens with that trade visible and marked (or the
   "See full profile" step goes to `/u/<h>#trade-<id>` with RowFocus). Verify with e2e: tap a row whose trade is older
   than the trader's last 5, and the trade is in view and focused.
2. **D2 (cost).** Restate the budget as +≤ 20 ms in the log. Stop server-rendering the three panes and load each one
   when its sheet first opens (the pane-chart route pattern already exists). Re-measure p95 after `lazy` on the
   50-close and 5,000-close fixtures. Verify: +≤ 20 ms on 3 runs, and profile HTML within 5 KB of the pre-PR size.
3. **D3 (copy).** Cut the explain line to one sentence, e.g. "Closed trades by other traders, held about as long as
   @h's typical trade, losses included." "Records with more evidence come first" is ranking detail the /how page owns.
   Verify: the copy scan passes and the line is at most 2 lines at 375.

Reviewer: add a check that every quoted budget matches the plan's budget table. This log's +50 ms went unchallenged.

## What would change my mind

If the measured exit share through the section is under 1% of shared-link profile visits after two weeks of real
traffic, cut the section (fewer parts). If it is high, and visitors then leave the original trader without returning,
move it further from the record, not closer.

COMPLIANCE: PASS · USABILITY: DEMANDS (D1 tap opens the row's trade, not just the trader; D2 budget is +20 ms not +50, stop server-rendering 3 panes per profile and re-measure; D3 one-sentence explain line)
