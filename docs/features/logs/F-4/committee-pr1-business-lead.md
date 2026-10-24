# F-4 PR-1 · Committee · Business lead

Date: 2026-10-24. Build: worktree branch `worktree-agent-af2a9d77f0b6999cf`, commits `2b62322..2da6953` on `0666990`
(rename, failing tests, code, log). Read: `build-pr1-engineer.md`, the product diff, `plan.md` PR-1, my sign-off
C1–C7, the F-2 PR-1b committee (§7 demand 2), `lib/feed.reach.test.ts`, `lib/discovery/section.ts`, POLICY,
COMPLIANCE §1, IMPLEMENTATION steps 4–5 and "Parallel development". User test on the preview at
http://localhost:3600, database `stock_social_f4`, fixture users `blf4p1_*` (18 created, all deleted, 0 left), the
feed advisory lock held exclusively for the run. Nothing here is legal advice.

**Verdict: compliance PASS; usability DEMANDS (one blocking, three small, all fix-round size).** The TR-9 change is
right, small (89 product lines against a 70–110 plan) and honest everywhere I looked: a 5-bet record now shows its
range, a 4-bet record says "4 of 5 bets", and a wide record keeps its range and says why it is too early.

## 1. Ruling: `lib/feed.reach.test.ts` "PR-1b acceptance" ("seed 3 page 4: no newcomer row")

**My C3 premise was wrong, and the engineer proved it by measuring.** I ruled that a newcomer with a small positive
weight would be skipped by the slot and "too weak to win a row on weight". In this fixture the opposite happens: the
6-close newcomer has the highest weight in the whole fixture (0.028) and takes **row 1 of page 1's section on
weight**. It is promoted, not hidden.

**I reproduced it** (a scratchpad copy of the test, fixture handles prefixed `blf4p1_`, deleted afterwards; the repo
file untouched), printing every section's rows:

| | Page 1 | Page 2 | Page 3 | Page 4 |
|---|---|---|---|---|
| Seeds 3, 4, 6 | N101 (row 1, by weight), O59, N100 (slot) | H, O42, N102 | H, O69, N104 (or N103) | H, H, **O40**: no newcomer |
| Seeds 0, 2, 5 | same | same | same | H, O, N103 |

In seeds 3, 4 and 6, **all five newcomers have already had a section row by page 3**. The page-4 slot then follows its
documented order ("not yet in an earlier section" first) and gives the row to O40, an ordinary record that was never in
a section. The original assertion still fires because its "unseen" test (`!before.has(id) && !near.has(id)`) looks only
at cards, not at earlier section rows: it was written when a newcomer could reach a section only through the slot.

**Ruling: option (a), restated, plus two added assertions. This is a faithful restatement, not a weakening.**
- **Why faithful.** My PR-1b demand 2 reads "sections 2 to 4 each carry a weight-0 newcomer **while an unseen one
  exists**". The test's own `seen` set (and its "newcomers 5/5" line) already counts a section row as seen. A newcomer
  shown in an earlier section is seen by both definitions. The current condition calls it "unseen", which contradicts
  the demand's words and the test's own bookkeeping. Restating the condition to "neither a card earlier, nor one of the
  10 cards around the section, **nor a row in an earlier section**" makes the assertion say what the demand said.
- **Why it isn't a weakening, measured.** With the restated condition, on all 7 seeds: the assertion is live in 25 of
  28 sections (vs 27 before) and passes in all of them. The 2 fewer are exactly the page-4 sections where no unseen
  newcomer is left. Newcomers seen per seed: 5/5 on every seed. Rows with no earlier card: 12/12. Union: 104 of 105
  (99%). Repeated runs: 0. Hot cards: 36–37 of 60. All equal to the engineer's numbers.
- **What makes it strictly stronger than today.** The current test checks newcomer reach only as a union over 7 seeds
  (`seenAll`), which hid weak seeds in F-2 (my PR-1b demand 4). In the same commit, add:
  1. per seed: every newcomer is seen (a card or a section row) within the first 4 pages (measured 5/5 on all 7 seeds);
  2. per seed: at least 3 sections carry a newcomer (measured 3 or 4), so the restated condition can never go vacuous.
  The test count stays the same; the test gains assertions; no fixture value changes.
- **(b) rejected.** Re-showing an already-shown newcomer ahead of a never-shown record undoes PR-1b's spreading; the
  page-4 row went to another record that had never been in a section, which is the reach we want.
- **(c) stays rejected.**
- **C3 stays.** It still protects the case this fixture doesn't hit (a thin newcomer with a small weight that is
  outranked on weight), and `section.test.ts` pins it.

## 2. User test at 375 px, signed out, as a first-time viewer

Fixtures: profiles with 5, 6 (gains), 6 (losses), 4, 7 wide (±25–45%) bets and 12 trades in 3 overlapping positions;
tickers ZQN (6 narrow bets), ZQF (4), ZQW (7 wide), ZQC (leader 6, rest 5 trades in 2 positions), ZQK (leader 7, rest 6
narrow); compare ZQN|ZQW and ZQF|ZQN; the feed; the 5-bet profile's unfurl image. Every page: 200, 0.6–1.3 s,
`scrollWidth` 375 (no horizontal scroll), no "of 10 bets", "10 independent" or "edge".

| Page | What a first-time viewer reads | Verdict |
|---|---|---|
| Profile, 5 bets | "+1.3% avg return / trade (+0.9% to +1.7%) · 95% range"; "Past results: above zero · Evidence: thin (5 bets, 39 days)" | Delivered: the range from 5 bets |
| Profile, 6 bets, losses | "(-1.7% to -1.0%) · 95% range"; "below zero · Evidence: thin (6 bets, 48 days)" | Mirrors the gains fixture exactly |
| Profile, 4 bets | "Too early to tell (4 of 5 bets)", once, no range | Delivered |
| Profile, 7 wide bets | "(-27.1% to +40.2%) · 95% range"; "Too early to tell: the range is still too wide (7 bets, 57 days)", once | Delivered. The sentence names the reason the range beside it shows |
| Profile, 12 trades in 3 positions | "Too early to tell: 12 trades in 3 overlapping positions (5 independent bets needed)" | Delivered |
| Ticker ZQN / ZQK | Range in the headline; baseline verdict drawn from it | Delivered |
| Ticker ZQF (4 bets) | "Too early to tell (4 of 5 bets)" **three times** (headline, baseline, under the spread) | Pre-existing triple (it was "of 10" three times); follow-up, not this PR |
| Ticker ZQW (wide) | Range in the headline; baseline: "Too early to tell: the range is still too wide (7 bets, 30 days). **Not enough independent bets** for a comparison yet." | **New text with two different reasons**: 7 bets is a count the page just said is not the problem. Demand 2 |
| Concentration ZQC | "Without them: 100% win rate, avg +1.1%, Too early to tell: 5 trades in 2 overlapping positions (5 independent bets needed) **over 5 trades**." | **New regression in reading**: "5 trades … over 5 trades", and a capital "Too" mid-sentence. Demand 3 |
| Concentration ZQK | "Without them: … (+1.0% to +1.7%) · 95% range over 6 trades." | Fine |
| Compare | ZQN: range + "Evidence: thin (6 bets, 30 days)"; ZQW: range + "**too early.** Too early to tell: the range is still too wide …" | The doubled "too early" is pre-existing (it read "too early. Too early to tell (4 of 10 bets)"); follow-up |
| Feed | Loads, fixture records appear as cards, no horizontal scroll | The section change is covered by the reach run (§1) |
| Unfurl image, 5 bets | "Evidence: thin (5 bets, 39 days)", disclaimer present; no range on the card | Correct for today: the card model is PR 2/3. The log's line "share … surfaces show the range from 5 bets" is true of the alt text and metadata path only; demand 4 corrects it |

Disclaimer and the Terms / Privacy / "How records are calculated" links are in the footer of every page checked.

## 3. Design choices vs the build

| Claimed | Status | Evidence |
|---|---|---|
| `MIN_BETS = 5`, `TOO_WIDE = 0.10`, `tooWide` (exactly 10 points is not too wide) | Delivered | `lib/trades.ts:218-220`, boundary test |
| Too early by width keeps both intervals, no direction, weight 0 | Delivered | `lib/trades.ts:279-280`, `evidenceWeight`; profile wide fixture |
| One "too early" sentence on every page that printed "of 10" | Delivered | 5 call sites; scan test; my page sweep |
| Never too early by a count alone | Delivered | 2,000 trades in 3 bets / K = 5 with n = 5,000 tests |
| Rename `Edge` → `Direction`, identifiers only, own commit | Delivered | `2b62322` |
| C3 slot: weight 0 or tier thin | Delivered as ruled | `section.ts:108`; premise corrected in §1 |
| Ticker baseline draws no verdict when too early | Delivered; good catch | `lib/ticker.ts:21`; copy follows (demand 2) |
| `isNewRecord` 10 trades left as TR-7 | Correct | comment `lib/trades.ts` |

## 4. Process (IMPLEMENTATION "Parallel development")

- **Independence with F-2 PR-4 does not hold.** F-2 PR-4 (`06b90b2`, unmerged, committee done) edits the same line of
  `newRecordSlot` (`section.ts`, a `pref` tie-break) and `lib/feed.ts`, and both change the section order a pinned
  test asserts (independence lines 2 and 4). By the rules, F-2 PR-4 merges first; F-4 PR-1 then takes it in with a merge
  commit, combines both edits on that line, re-runs every check and e2e, and the reach test (restated) must pass on the
  combined code. Because the combination changes product files, the committee re-checks that diff only (the slot line
  and `weights()`), not the whole PR. Not the engineer's fault; the orchestrator must sequence it.
- **Branch name.** The rule is `autopilot/feature-4-tr9` (plan PR-1); the build is on `worktree-agent-…`. Push under
  the plan's name, and the log names the branch (the rule "every build log names its worktree branch, database and
  ports": database and ports are there, the branch is not).
- Shared-preview rules followed by me: own prefix, only my rows deleted, no heavy fixture on the shared database (the
  reach copy creates 105 users for seconds under the test's own ids filter; I ran it with the feed lock free of other
  runs and verified 0 `blf4p1_` users afterwards).

## 5. Scorecard (PR 1)

| Dimension | Score | Evidence |
|---|---|---|
| Market demand | 4 | Unchanged from the plan: shareable records with losses; a range at 5 bets gives new traders something honest to share sooner (inferred) |
| Ease of adoption | 5 | Zero new steps; a 5-bet record shows its range on first visit at 375 |
| Phase fit | 4 | New traders reach a real range in half the bets, which feeds the week-8 share gate; PR 3 is where the gate moves |
| Revenue impact | 3 | Indirect (supply and reach), unchanged |
| Aesthetics and clarity | 4 | One sentence replaces five copies; the profile says "too early" once. Loses a point to the ticker's triple and compare's doubled "too early" (pre-existing) |
| Trust and compliance | 5 | Wide records keep their range (nothing hidden), "too early" never decided by a trade count, losses mirror gains, no "edge" anywhere, no verdict drawn from a too-early interval |
| Simplicity | 5 | 89 product lines, no dependency, no schema, a helper deletes 5 hand-written strings |
| Craft and taste | 4 | Two new sentences read badly (demands 2, 3); everything else is precise |

Bar: Market demand 4, Ease 5, Trust 5, nothing below 3: **clears once the blocking demand is met.**

## 6. Compliance review (POLICY, COMPLIANCE §1)

1. **Performance (§2): yes.** F3 disclaimer present on every page checked, unchanged. F3b: labels describe evidence
   ("thin", "too early", "the range is still too wide"), never skill; "edge" removed from identifiers and absent from
   every string (scan test plus my sweep). F4: the range is shown from 5 bets and kept when wide; losses fixture mirrors
   gains; ranking stays on the lower bound and symmetric (`evidenceWeight` unchanged except too-early → 0). F1: no
   advice; the ticker baseline stops drawing a verdict from a too-early interval, which removes a possible
   over-statement. PASS.
2. **Personal data: no.** No new field, read or log. P3 percent-only holds.
3. **Money: no.** 4. **Communications or tracking: no.** 5. **User text: no.** 6. **Sign-up, age, identity: no.**
7. **Vendor, dependency, font, image: none.** `npm ci` from the lockfile; no package file changed.
8. **Screen reader and keyboard:** text-only changes, no new control; signs in text on every number. PASS.
9. **Security posture: no change.**
10. **Claims (§11):** none added; "Verified" untouched.
11. **Checkout: no.**

Deterministic checks reported by the engineer: `tsc` clean, `compliance: ok`, `guard: ok`, build ok, e2e 115/0,
LOAD runs pass (the interim `lib/trades.ts` rule is met). Only the reach test fails, resolved by §1.
**The PR body must carry these answers under `## Compliance`** (the build log has none yet; demand 5).

**COMPLIANCE: PASS.**

## 7. Demands (priority order)

1. **Engineer, blocking: restate the reach assertion as ruled in §1 and add the two per-seed assertions.**
   - Condition: a newcomer counts as unseen only with no card earlier, not among the 10 cards around the section, and
     **no row in an earlier section** of the same seed (track section rows per seed). Update the comment to cite this
     ruling.
   - Add per seed: every newcomer seen in the first 4 pages; at least 3 sections carry a newcomer.
   - Fixture and every other assertion byte-identical; test count unchanged.
   - Verify: `npm test` green with the database; the `# reach:` lines show newcomers 5/5 and 3–4 sections with a
     newcomer on all 7 seeds; the diff of `lib/feed.reach.test.ts` touches only the condition, its comment and the
     two added assertions.
2. **Engineer: the baseline's second sentence must not give a count as the reason when the record is too early by
   width.** In `app/t/[symbol]/Baseline.tsx`, for `c.k >= MIN_BETS` the line reads "Too early to tell: the range is
   still too wide (‹K› bets, ‹D› days). No comparison yet."; the K < 5 text stays as it is. Verify: a
   `ticker-baseline` (or e2e) assertion of both exact strings, and `/t/<wide symbol>` at 375 shows the new line.
3. **Engineer: the concentration sentence reads as a sentence.** "Without them: ‹win›% win rate, avg ‹x› over ‹n›
   trades. ‹range · 95% range | tooEarlyText›." (count once, before the full stop; the too-early sentence starts its
   own sentence). Verify: the ZQC-shaped fixture (leader plus 5 rest trades in 2 positions) renders "over 5 trades"
   exactly once and no lowercase-after-comma "Too"; ZQK-shaped still shows its range.
4. **Engineer, log hygiene:** name the branch (and push it as `autopilot/feature-4-tr9`); correct the line that says
   the share surfaces show the range from 5 bets (today's unfurl image prints the evidence line, not the range; the
   card range arrives with PR 2/3).
5. **Engineer, PR body:** `## Compliance` with the 11 answers (plan §7 items 1–11, restated for PR 1 as in §6 here).
6. **Orchestrator:** sequence F-2 PR-4 before F-4 PR-1 per §4; after the merge-in, the committee re-checks only the
   combined `newRecordSlot` line and `weights()`, with the restated reach test green on the combined code.
7. **Follow-up, not this PR (UX lead's to word):** one "too early" per surface on the ticker page (it prints it three
   times) and compare (the bold "too early." before "Too early to tell"). Both are older than F-4.

## 8. Demo sentence

"Five independent bets and you get an honest range, losses included; fewer, or too spread out, and the page says so in
one sentence."

## 9. What would change my mind

- After the F-2 PR-4 merge-in, the restated reach test fails on any seed: then the slot's order has to be revisited
  with both edits in view, and it comes back to me with the per-section rows printed as in §1.
- Real data shows thin 5–9-bet records routinely topping the section on weight (as N101 does here): that is the
  owner's lower-bound ranking working as decided, but if it crowds out moderate records it goes to the owner as a
  question, never as a quiet weight change.

COMPLIANCE: PASS · USABILITY: DEMANDS (1 restate the reach assertion with no section row counted as unseen, plus per-seed newcomer-seen and ≥3-sections assertions [blocking]; 2 baseline too-wide line drops the "independent bets" reason; 3 concentration sentence count once, too-early as its own sentence; 4 log: branch name, share-range claim; 5 PR body ## Compliance; 6 merge F-2 PR-4 first, re-check the combined slot line; 7 follow-up: one "too early" per ticker/compare surface)
