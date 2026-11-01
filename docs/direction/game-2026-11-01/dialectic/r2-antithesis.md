# F-8 dialectic, round 2: antithesis (red-team bench on the r2 thesis)

## Maths audit (seed R recomputed; simulation = 200,000 runs)

| Claim | Thesis | Recomputed | Status |
|---|---|---|---|
| BS Honest / Bold | 0.162 / 0.049 | 0.162 / 0.0485 | OK |
| DS Bold | 0.30 | 0.299 | OK |
| Expected bits Honest / Bold | +1.26 / -0.43 | +1.255 / -0.427 | OK |
| Arithmetic mean W Honest / Bold | 402 / 849 | 402 / 849 (and 1,026 for "always 98") | OK, and worse than stated: the mean-maximiser goes to the clamp |
| **"Typical" W Honest / Bold** | 239 / 74 | **median 204 / 108** | **Wrong.** 2^E[bits] is the geometric pace, not the middle result. Bold's median run *gains* capital, because its losses sit in rare tails (a 0.9 miss costs 2.32 bits, a hit earns 0.85) |
| Spread, Honest | not stated | P10 = 36, P90 = 1,110; 28% of honest runs end below 100 | Same play, 30x spread between deciles |
| P(Bold beats Honest on one seed, same outcomes) | not stated | **26%** | Single-seed duels are luck-heavy |
| Capped BS Honest / Bold (tier 2) | 0.154 / 0.114 | 0.154 / 0.114 | OK |
| Duel n to separate Honest from Bold | ~110 cards | 116 cards (per-card SD 0.156) | OK; two real humans differ far less, so expect several hundred |
| Capital belt KL(0.7‖0.9) / KL(0.7‖0.5) | 0.22 / 0.12 bits | 0.222 / 0.119 | OK |
| Priced room, Fifty at π = 60, p* = 0.5 | +0.03 bits | +0.029 | OK, and that's an exploit (see S1-05) |
| Week chips Honest / Bold | 0.160 / 0.074 | 0.160 / 0.074 | OK |
| NIS Honest / Bold | 3.51 / 4.33 | 3.510 / 4.332 | OK |
| **NIS Wide (95% range)** | 4.17, room 37.4 | **4.109, room 38.4** | **Wrong.** The error carries into every Wide figure: 10 rooms 384 not 374, 5 questions 192 not 187, and the S1-09 sandbag cost is ~9 points, not 10. The orderings still hold |

So the ghost fan, which the thesis offers as *the* fix for the mean trap, shows Bold "typical 108" on its own seed: a gain over the start. That is the opposite of the lesson.

## F6 ruling: is confidence-sized paper capital "wagering"?

**Legal seat.** It is not wagering in law. There is no consideration (nothing of value is staked) and no prize
(nothing carries over, nothing converts), so the chance + consideration + prize test (COMPLIANCE §4) fails on
two of its three legs. But F6 says "no wagering" as its own item, separate from "no prizes", so it bans the form
as well as the legal act. As written, S1-05 is shaped like a wager: "the house prices Up", a balance that
compounds, payouts read as "100 becomes 150", a bot that "splits against" your price, and room-by-room up/down
stakes on a fixed horizon at a fixed payout. That last one is the structure of a binary-option product, a
category known for consumer harm, rehearsed on charts that look like stock charts. **Ruling: it breaches the
spirit of F6 as written, and is fixable.**

**Responsible design (veto).** It is gambling-like as written: a bankroll, house odds, multiplier payouts, bosses
that cause big swings, a 36-to-1,110 outcome spread for identical play (variable-ratio feel), and free unseeded
practice that allows back-to-back runs. **The veto holds until all of the following are true:**
1. **Input is a forecast, not a stake.** b = q exactly, so the split adds no decision. It only adds betting
   meaning. Use the shell slider: "62 percent up". There is no "on Up / on Down".
2. **No house, no price, no payout.** Drop priced rooms and the price-setter boss. There are no multipliers, no
   "becomes", no "win", "lose", "bankroll", "pot", "all-in" or "odds" (the thesis's own S1-01 reveal says "true
   odds 70 percent").
3. **The score is a growth pace, not a balance.** The headline is the luck-free expected pace for your calls
   ("at these calls, a practice index grows about 1.4x per 10 rooms"), with the actual index secondary and shown
   only at run end, never animated per room. Call it a "practice index", not "capital", with no currency look.
   Never show it as a percent ("+139%"): a percent reads as a return beside verified records (shell label rule,
   F3a).
4. **No cross-run W.** No best, no total, no history of index values, never shareable, never in a duel display.
5. **Cadence.** Seeded index runs are weekly. Unseeded free practice uses the plain log-score mode with no index.
   Done returns to the Practice menu, never into a new run.

**Copy that makes it clearly not a wager:** "Practice index. Not money, not a return, nothing carries over."
"Your forecasts, scored by how fast they would grow a practice index if every forecast were exactly as sure as
you said." "This run: 108. Pace for your calls: 0.74x per 10 rooms. Luck explains the gap." Subtitle: "a
forecasting run", never "make trades, maximise returns" (the thesis's own heading uses the banned labels).

---

### S1-01 · Brier Dojo
**Red team.** Low risk: p* is shown only after each card. Through the ghost fan, shared weekly seeds would leak
p* to later players (see Cross-cutting).
**Responsible design.** Calm. The "Capital belt" brings outcome-driven capital lines into the one luck-free
design: "regret is KL" is right, but a capital line beside a "knows-the-odds" line is a race display.
**Legal.** The reveal "True odds 70 percent" uses "odds", a word the thesis itself bans. Say "Generator chance:
70 percent".
**T&S.** None.
**Accessibility.** The error bar needs text (it has it). Fine.
**Engineer.** Cheap. Regret needs only p* and q.
**Verdict: keep** (fix the mutation). 1) The Capital belt shows regret in bits as text only, with no capital
lines. 2) Replace "odds" everywhere. 3) Score the belt on DS, never on realised bits.

### S1-02 · Confidence Ladder
**Red team. The lift rule promotes the overconfident player.** Capped at tier 2, Bold scores BS 0.114 > 0 and
its at-cap forecasts (0.75 on cards with p* 0.7 and 0.85) come true about 75% of the time, which is inside the
edge band. Bold lifts. At tier 3 Bold scores BS 0.060 > 0, and lifts again to 2-98. The cap "more than doubles a
novice's score" by *hiding* the overconfidence it exists to teach.
**Responsible design.** Fine. In the Ladder run, "what the wider cap cost or saved" must be in expectation, not
from outcomes, or it becomes a luck lottery.
**Legal / T&S.** None.
**Accessibility.** Announce the cap, as specified. The door is a two-option radio group.
**Engineer.** Cheap. The lift rule needs p*-based tests.
**Verdict: fix.** 1) The lift rule uses known p*: the lower DS band >= 0.5 and an overconfidence index
mean(|q - 0.5| - |p* - 0.5|) whose band contains 0, both over >= 60 forecasts. 2) Ladder-run deltas are
computed from p*, never from outcomes.

### S1-03 · Shared Seed Duel
**Red team.** In the Capital Duel, "independent door choices" breaks pairing: after a door the two players
face different rooms, so the gap measures route plus luck, not craft. Bold beats Honest on 26% of single
seeds even with identical rooms.
**Responsible design.** "You: 239. Friend: 74" is a win/loss scoreline per seed. It undoes the R1 rule that
there are no per-seed verdicts, and invites rematch-to-recover.
**Legal.** Two people's balances on one seed is the form of a head-to-head wager. Kill that display.
**T&S.** Showing a friend's 74 against your 239 is humiliation fuel. It also screenshots like returns.
**Accessibility.** The stacked text reveal is good.
**Engineer.** Branching futures for each door path double server generation. Avoidable.
**Verdict: fix.** 1) There is no Capital Duel: duels compare the pooled mean log-score gap with a band (bits),
on a forced, shared route. 2) Never show the other player's per-seed number. Show only "too close to call" or
the banded pooled gap.

### S1-04 · Narrow Path Bridge
**Red team. The doors have a dominant pick.** "An honest player's expected NIS is 3.51 under every rule" holds
only if σ is known. Fog hides information, so an honest player's predictive range is wider than the true
s and its expected NIS rises. Long sight lowers it. Normalised by the true s, the most-information door
always wins in expectation, so the "choice" is solved. The Lens spoils make the same choice a second time.
**Responsible design.** Calm. Unranked replays are fine.
**Legal / T&S.** None.
**Accessibility.** Lens readouts in text are good. Door menus need keyboard radio groups.
**Engineer.** Moderate: per-door generator parameters, seeded menus.
**Verdict: fix.** 1) Normalise each room by an information-matched s: the spread of an ideal forecaster with the
same look-back. Then every door has equal expected value for an honest player. 2) Or make each door a
trade-off (more look-back paired with a longer horizon). 3) Correct the Wide figures (384, not 374).

### S1-05 · Jump Night: Paper Capital Run
**Red team.** (a) **Priced-room exploit:** staking 50 against any π ≠ 50 earns KL(0.5‖π) > 0, so a player with no
view passes the "lower band of pooled bits > 0" progression gate by taking priced doors. (b) The "Priced room"
door is dominant whenever p* ≈ 0.5. (c) The price-setter boss is a log score on π plus a constant the bot sets
(-log2 p*_outcome): no new decision, extra noise, and "minus the bot's bits" is always <= 0 in expectation,
so it's a room you can only lose in expectation. (d) The ghost fan "typical" is wrong: median 108 for Bold.
**Responsible design.** Veto as written (see the F6 ruling). The 36 to 1,110 decile spread for honest play is
the variable-ratio pattern. Free practice allows runs back to back.
**Legal.** "The house prices Up", "bot splits against it", "make trades, maximise returns": these are wager
and return framing (F6 and the shell's banned labels).
**T&S.** An index screenshot ("100 became 1,110") reads as a return. Never shareable.
**Accessibility.** Announce the split slider as a single percent. The ghost fan needs a text quantile summary and
a reduced-motion version.
**Engineer.** Cheap: the fan is 1,000 × 10 draws.
**Verdict: fix** (the veto lifts only with the F6 conditions). 1) Forecast slider plus a practice index with an
expected-pace headline. Drop priced rooms and the price-setter boss. 2) Progression and comparisons use
1 + log2 q_outcome, never bits against a price. 3) The fan reports pace (2^E[bits]) and P10/P50/P90 in text,
labelled "same calls, different luck".

### S1-06 · Number Line Shelf
**Red team.** In the Bucket split, a bucket at 0 means log2(0): an infinite loss. Bucket edges anchor answers.
**Responsible design.** It imports staking into the calmest design, the one the thesis calls "nothing is owed".
**Legal.** "Split 100 paper capital over 6 buckets that pay at their price" is the form of a spread-betting
board.
**T&S.** None.
**Accessibility.** Six coupled sliders that sum to 100 are a WCAG problem: the focus order, the constraint
announcements and the 360px width all fail by default.
**Engineer.** The constrained input is costly to build and to test.
**Verdict: keep base, kill mutation.** 1) If a distribution input is wanted, use "shape presets" (5 skews) scored
by the log score with a 1% floor per bucket, framed as "how likely is each zone", with no capital.

### S1-07 · Run-End Report Card
**Red team.** Low risk.
**Responsible design.** The best stop cue. Keep it a document.
**Legal.** "Following it always raises the expected score" overclaims: it holds only for a step toward the
honest width, and overshooting loses. That is also a completeness-style claim. Write "moving toward an 80% fit
raises the expected score".
**T&S / Accessibility.** The counterfactual column needs a table view.
**Engineer.** Store σ per card. Cheap.
**Verdict: keep.** 1) Fix the "always" copy. 2) Counterfactuals come from the generator only (already
specified), labelled "expected".

### S1-08 · Cone Catcher
**Red team.** The Moving checkpoint's "uncertainty grows like √t" is true only for diffusion families. It is
false for mean-reverting and jump families, and teaching it as a fact edges toward a market claim.
**Responsible design / Legal / T&S.** Calm. Keep "in this generator" scoping.
**Accessibility.** Two checkpoints is a high input load. End-only mode is kept, and the moving checkpoint must be
announced ("midpoint at step 14 of 20").
**Engineer.** Cheap.
**Verdict: keep.** 1) Scope the √t copy to diffusion families, and say so on the reveal. 2) Correct the Wide
figure (38.4 per card).

### S1-09 · Bias Boss
**Red team.** The sandbag cost is ~9 points per warm-up (Wide 38.4), not 10, and it is only a deterrent if boss
types are equally hard. If the decoy boss costs a biased player more than ~54 points over 6 cards, sandbagging
another bias to steer the door pays.
**Responsible design.** "The one number the player cares about most" (the Capital boss) puts a money-like number
at the centre: the opposite of the craft goal.
**Legal.** The Capital boss inherits S1-05's F6 issues.
**T&S / Accessibility.** The decoy explainer is up front; fine.
**Engineer.** Moderate: per-type normalisation.
**Verdict: fix.** 1) Normalise each boss type so that an honest player's expected score is equal across types.
2) Kill the Capital boss; measure anchoring as lean in text.

### S1-10 · Weekly Five
**Red team.** A shared weekly seed with any p* or fan reveal leaks the answers within the week. The Weekly route
door has a dominant pick (as in S1-04).
**Responsible design.** Weekly cadence, no streak: good.
**Legal / T&S.** The pip grid with route icons is fine and stays off the record share card.
**Accessibility.** Best in the set.
**Engineer.** Cheap.
**Verdict: keep.** 1) Show generator details only after the week closes. 2) The door is information-matched or
cosmetic. 3) Correct to 192.

### S1-11 · Week Season
**Red team.** A pooled score "shown at any count" invites stopping when ahead: stop after a lucky streak and the
displayed week is biased upward.
**Responsible design. Kill the Season capital mutation.** A week-long balance that is "down" is the classic
loss-chasing trigger: "play more to win it back".
**Legal.** A season bankroll is wager-shaped (F6).
**T&S / Accessibility.** Chips are fine.
**Engineer.** Cheap.
**Verdict: fix.** 1) No Season capital. 2) The week score is final only at the week's end, with "not enough yet"
below n = 60, and no mid-week number after each session.

### S1-12 · Mastery Trials
**Red team.** The fourth criterion inherits the priced-room exploit: Fifty passes "grows faster than no view".
**Responsible design.** "Your splits grow paper capital" brings in the wager frame. A four-week window is better
(fewer sessions per week).
**Legal.** Never on a profile (kept).
**Accessibility / T&S.** Inherited.
**Engineer.** Highest cost, last to build.
**Verdict: keep, mutation fixed.** 1) The fourth criterion is the log score (1 + log2 q) with lower band > 0, with
no price and no capital wording. 2) Adopt the four-week window.

### Cross-cutting
1. **"Typical" means median: the ghost fan is mis-specified.** Report the expected pace plus P10/P50/P90 in text.
2. **Doors that change information always have a dominant pick** under true-s normalisation (S1-04, S1-05,
   S1-10, the S1-03 route). Fix with information-matched baselines or trade-off doors.
3. **Wager framing spreads through the mutations** (S1-01, S1-03, S1-05, S1-06, S1-09, S1-11, S1-12): house,
   price, split, "becomes". One capital surface at most (S1-05, under the F6 conditions). Everywhere else, a
   forecast slider.
4. **Banned words in the thesis itself:** "odds", "make trades, maximise returns", "the house". Run the copy
   scanner on F-8 strings.
5. **Shared seeds leak p* and fans:** reveal generator truth only after a shared seed closes.
6. **The Wide NIS error (4.11, not 4.17)** recurs in five designs.
7. **No per-seed head-to-head numbers, no cross-run bests, no percent displays** for any game score.
