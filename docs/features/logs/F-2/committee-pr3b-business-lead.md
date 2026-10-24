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

## Round 2 (2026-10-24, fix round 1 at bbd48f2)

Checked as a user on a fresh `next start` build on port 3121, with my own Postgres 16 database, the in-repo vendor fake on
4201 and 12 throwaway verified traders. Their closes in the 1-to-7-day bucket were all losses, and each of 11 traders had
5 later closes held 40 days, so the row's trade sat **older than that trader's last 5**. Afterwards I stopped the server
and the fake, deleted the users and dropped the database. Port 3000 was not touched, no sync tick ran, and no product code
changed.

| Demand | Verdict | Evidence (375 px, signed out) |
|---|---|---|
| D1: a tap opens the trade | **Delivered.** | Tapping the row "QB0 · closed Oct 22, 2026" opens a sheet. Its focused heading is that trade, then "-3.0% · Held 1 to 7 days · Trade page →", where the link is the same `/u/<h>/trade/<sell_id>` as the no-JS row and returns 200. Below it come the trader (name, Verified, chart, record, last 5), then "See full profile →". That is O2's order: the trade, then its trader, then the profile. Correctly, nothing is marked in "Last 5" because this trade is not among them. The pane loaded in about 0.2 s. Esc returned focus to the row. No request other than GET was sent. |
| D2: no server-rendered panes, +≤20 ms | **Delivered, with HTML slightly over my bar.** | The profile HTML has no "See full profile". p95 over 100 requests: 35 ms with the section and 47 ms with the same trader moved out of the bucket, so the difference is noise and inside +20 ms. The engineer's three-run table agrees, at +5 to +12 ms. HTML grew by 6.4 KB here (24.2 to 30.6 KB) and by 7.9 KB on the engineer's 50-close trader (63.3 to 71.2). My bar was 5 KB. The visible section is only 2 KB, so the rest is the client payload repeating the rows. That is down from +27 KB and does not block. It is a follow-up (F1). |
| D3: one-sentence line | **Not delivered.** | It is now "one sentence" only because a semicolon joins the two halves. It still carries the ranking detail I asked to cut ("records with more evidence come first"). At 375 it wraps to **3 lines** (59 px), and the bar was at most 2. |
| UX blocker and lighter rows | **Delivered.** | The rows are open, with a rule between them and no card box. They are quiet in light and dark, and they now read as a footnote to the record. Taste: the row text is inset about 12 px from the heading and explain line. It should share their left edge (F2). |

Demands (builder):
1. **D3 (blocking, copy only):** set `SIMILAR.explain` to "Other traders’ closed trades, held about as long as @x’s
   typical trade, losses included." The ranking rule belongs to /how. Verify: the copy scan passes, it fits in 2 lines or
   fewer at 375 with a long handle, and the e2e text matches.
2. F1 (follow-up): pass the rows to the client once (or render them on the server only), so profile HTML is within
   5 KB of the pre-PR size.
3. F2 (follow-up): align the row content to the section's left edge at 375 and 1280. A programmatic focus on the sheet
   heading draws a heavy box. Show it only for `:focus-visible`, or use a subtler ring.

Ready to merge: the heart of O2 now works exactly as the owner asked. A tap on a row opens that closed trade, then its
trader, then the path to the full profile. The order never reads a return, losses fill the section, and the F3 line and
disclaimers hold. The profile no longer pays for panes nobody opened, and its server time is inside the plan's +20 ms. The
only thing standing between this and merge is the explain line. It is three lines at 375 and still states ranking detail,
so it is a one-string copy change. Once it is one short sentence, this PR is ready to merge. F1 and F2 can follow in the
next PR.

COMPLIANCE: PASS · USABILITY: DEMANDS (D3 explain line: one short sentence, at most 2 lines at 375, ranking detail removed; follow-ups F1 HTML +6–8 KB over the 5 KB bar, F2 row inset and heavy focus box on the sheet heading)
