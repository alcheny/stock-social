# Spec: My record: rules by reason (#68)

Variant: **single** · Spec agreed by designer and business analyst

## Agreed spec

# Spec: "Rules by reason" in /me/record (issue #68, line C)

## User story
As a trader who has set a rule and tagged why I took trades, I want to see whether I keep my rule differently depending on my reason (e.g. planned setups vs impulse), so I can see whether my discipline depends on my mindset. Private. Descriptive only.

## Scope
Pure function in `lib/rules.ts` (it already owns `applies`/`followsRule`; reasons come from `lib/reflections.ts`, which imports `insights.ts` only, so no import cycle). A new block inside each rule card in the existing "Your rules" section of `app/me/record/page.tsx`. No schema change, no new table, no public-page change. ~300-400 changed lines including tests.

## Pure function
```ts
export type ReasonCell = { reason: Reason; applicable: number; followed: number; share: number | null; enough: boolean };
export type RuleByReason = {
  kind: RuleKind; days: number;
  applicable: number;   // all trades the rule applies to
  tagged: number;       // of those, trades with a known reason
  cells: ReasonCell[];  // enum order (REASONS), only reasons with applicable > 0
  enough: boolean;      // >= 2 cells with enough
  takeaway: string | null;
};
export function rulesByReason(trades: (T & { sellId: string })[], rules: Rule[], reasons: Map<string, Reason> | Record<string, Reason>): RuleByReason[]
```
- Output only for rules present, in RULE_KINDS order; `[]` if no rules.
- For each rule: `app = trades.filter(applies(kind, t))`. A trade's reason = lookup by `sellId` (support Map and Record, using `Object.hasOwn` as in `reflectionInsights`; reuse its approach, don't invent a new lookup). Untagged trades count in `applicable` and not in `tagged`. Tags whose sellId matches no trade never appear (iteration is over trades), and are never deleted.
- Per reason: `applicable`, `followed = count(followsRule(kind, days, t))`. Reuse `followsRule`/`applies`; do NOT re-implement the "exactly N days follows" boundary.
- `enough = applicable >= MIN_TRADES` (import from insights.ts; =5). If not enough: `share = null`.
- Takeaway only if >= 2 cells have enough. Choose the two enough cells with the highest `applicable` (ties: earlier enum order wins). Order them in enum order within the sentence. Text, exactly:
  - cut_losers: `You kept the cut-losers rule on {f1} of {n1} trades tagged {Label1} and {f2} of {n2} trades tagged {Label2}.`
  - hold_winners: `You kept the hold-winners rule on ...` (same shape).
  Labels are `REASON_LABEL` (e.g. "Planned setup", "Impulse"). Counts only; no "should", no judgement words, no scoring. When both shares are equal the same sentence is used (it is descriptive; no "more/less" claim).
- Never lists a cell's percentage when not enough.

## UI (per rule card, below "Recent versus earlier"; only rendered when the rule is set, so the block appears only when the owner has at least one rule)
`<div role="group" aria-label="Rules by reason"><h4>Rules by reason</h4>…`
States:
1. `tagged === 0`: `<p className="small">Tag a trade above and a comparison appears here.</p>` plus coverage line.
2. Coverage line always when applicable > 0: `Reasons known for {tagged} of {applicable} trades this rule applies to` (muted small). If applicable = 0: `No trades this rule applies to yet.` and nothing else.
3. Cells (a `<dl>` or compact list, one row per reason with cells): reason label, then if enough `{followed} of {applicable} ({round(share*100)}%)`; else `too few trades to say` (the same `FEW` constant the page already uses) with `{applicable} tagged so far` and no percentage.
4. Takeaway `<p className="small">` only when `takeaway` non-null.
5. Footnote (muted small): "This compares different trades. It does not show that your reason caused the difference." (matches existing outcomes block wording.)
No colour-only encoding; red/green not used for follow/not follow (equal plain weight for kept and broken). Text-only, wraps on a 360px phone; no new CSS beyond existing `rec-card`/`small`/`muted` classes. No confetti, badges, streaks, or advice. Data in page: reuse the already-built `reasonOf` map and `trades`; add `const byReason = rulesByReason(trades, rules, reasonOf)` next to `trends`; trades already carry `sellId`.

## Edge cases / states
- No rules: no block (functions returns []).
- Rule set, no tags: state 1.
- Fewer than 5 in every reason: all cells "too few trades to say", no takeaway.
- Only one reason has >= 5: that cell shows its percentage, no takeaway.
- Tag for a nonexistent trade: ignored, not counted in coverage.
- Loading/error: server-rendered page, no new async state.

## Acceptance criteria (tests, in `lib/rules.test.ts`, existing tests untouched)
1. No rules -> [].
2. One rule, all tagged, two reasons with >= 5 -> correct counts, shares, and takeaway text exactly.
3. No tags -> tagged 0, cells [], takeaway null.
4. Tags for sellIds with no trade -> ignored (tagged unchanged).
5. Boundary: cut_losers days=3, loser held exactly 3 days counts as followed; hold_winners days=7 winner held exactly 7 followed; 6.99 not.
6. 4 vs 5 applicable in a reason: 4 -> enough false, share null; 5 -> enough true.
7. Coverage: 8 applicable, 6 tagged -> `applicable 8, tagged 6`.
8. Tie in takeaway: three enough reasons with equal applicable -> the two earliest in enum order picked; also a tie in followed share does not change wording.
9. Only one enough cell -> takeaway null.
10. Winning trades don't count toward cut_losers (applies), zero-return trades never applicable.
11. Playwright: signed-out visit to `/me/record` redirects to login (add to e2e/app.spec.ts if not already covering exactly that; existing line 173 area may already — add only if missing). Optional e2e for signed-in owner showing "Rules by reason" heading with a rule set.
12. `npx tsc --noEmit` clean; `npm test` passes; test count does not drop.

## Measure
DB read: among users with >= 1 row in `trade_rules`, the share with >= 5 rows in `trade_reflections`. This only says whether the block has anything to show; return visits are not measured.

## Designer ⇄ business discussion

### Round 1

**Designer:** Adds a private "Rules by reason" block inside each set rule on /me/record, showing how often the trader kept the rule per reason tag, with a 5-trade minimum per cell and a coverage line.

**Business analyst (approved):**
- Ease of use: Good. It is text-only and sits inside each existing rule card. It shows nothing when no rule is set, so there's no clutter. The empty state ("Tag a trade above...") tells the trader what to do next. The coverage line stops a partial tag set being read as the whole record. Red/green isn't used, and kept and broken rules get equal weight. The 'too few trades to say' label uses the existing FEW constant, so it's consistent with the rest of the page.
- Retention: This is the strongest personal insight the data supports. It gives traders a reason to tag trades, because tagging unlocks a comparison. It also gives them a reason to return as tags build up toward 5 per cell. The 5-trade minimum and the takeaway being descriptive only stop it nudging trading frequency or rewarding streaks. The measure (share of rule-setters with at least 5 tagged trades) is collectable from the DB. It only shows whether the block has anything to display. It says nothing about return visits, and the spec states that.
- Virality: Low, and that's correct. This is private to the owner and changes nothing the public sees. That fits line C's retention bet, and growth does not override trust.
- Feedback: Approve. Five small points for the build:
1. The takeaway picks the two cells with the highest applicable counts. The sentence only shows those two. If three or more reasons are enough, the owner won't see the other shares in the sentence, but they're still in the cell list. Keep that cell list visible and complete.
2. The "different trades, not causation" footnote should always render when at least one cell is shown.
3. Tests must cover the 4 vs 5 edge, the exact-N-days boundary through the existing followsRule, and the tie case.
4. The signed-out redirect e2e check should be added only if it's missing.
5. Don't add any advice wording such as "should" or "try".

## QA log

| Round | By | Result | Findings |
|---|---|---|---|
| 1 | tester | ✅ pass | [note] checks: Bash was denied in this session, so I could not run `npx tsc --noEmit`, `npm test` or e2e. I reviewed the code by reading it. The imports resolve (REASONS, REASON_LABEL, Reason, MIN_TRADES). Types look consistent. The page passes the existing `reasonOf` Map. CI should confirm the type check and tests. · [note] lib/rules.ts:158-190: The logic matches the spec. Output is in RULE_KINDS order and empty with no rules. It reuses `applies` and `followsRule`. `Object.hasOwn` is used for Record input. Tags for missing trades are ignored, because iteration is over trades. Cells are in enu |

## Cost

4 role calls, $0.67 total: designer#1 $0.13, business#1 $0.08, engineer#1 $0.35, tester#1 $0.12
