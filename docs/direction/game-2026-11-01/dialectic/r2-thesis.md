# F-8 dialectic, round 2: thesis (defence of the 12 S1 designs)

## Shared maths this round (cited by id below, not repeated)

**Reference seed R** (used in every worked example): 10 cards whose favoured side has generator probability
p* = 0.50 (4 cards), 0.70 (4 cards), 0.85 (2 cards). Three players: **Honest** says q = p*; **Bold** says
0.65 / 0.90 / 0.98; **Fifty** always says 0.50. Range players: Honest states the true 80% range; Bold states a
50% range labelled 80%; **Wide** states a 95% range.

| Score on seed R | Honest | Bold | Fifty / Wide |
|---|---|---|---|
| Brier skill BS (vs always-50) | 0.162 | 0.049 | 0 |
| Dojo DS (vs always-50, known p*) | 1.00 | 0.30 | 0 |
| Log bits (sum of 1 + log2 q_outcome), expected | +1.26 | -0.43 | 0 |
| Paper capital from 100 (2^bits, typical) | 239 | 74 | 100 |
| Paper capital, arithmetic mean | 402 | **849** | 100 |
| Range room 100 - 15 x NIS (s = end-value SD; NIS 3.51 / 4.33 / 4.17) | 47.4 | 35.0 | 37.4 |

**Paper capital is the log score.** Each room the player splits paper capital W between Up and Down: fraction b
on Up, 1 - b on Down. Each side pays at a stated price π (default 50: the winning side doubles). So
W_next = W x b_outcome / π_outcome, and log2(W_end / W_0) = Σ log2(b / π), which is the log score relative to a
forecaster who always says π. E[log W] is maximised at b = p for any price (Gibbs' inequality), so "grow your
capital" and "state your true odds" are the same instruction. The honest player's expected growth per room is
KL(p || π) bits.

**Does a fixed-length run with visible capital avoid the death-rule distortion? Yes, under four conditions.**
(1) The run always lasts N rooms, and the stake clamp of 2 to 98 keeps W > 0 (the worst room multiplies by
0.04), so there is no absorbing state. (2) No in-run rule, shop, door or modifier reads W. (3) There is no
threshold goal on one run's W ("finish above 100"), because maximising P(W > c) is improper. (4) Anything that
is compared or progressed uses log W: the mean bits pooled with a band, or the rank on the same seed (rank by W
equals rank by log W). **The honest weakness:** a player who maximises *arithmetic* W prefers Bold (849 vs 402),
because overbetting raises the mean through rare lucky runs. The fix is the **ghost fan**: the summary replays
your exact calls 1,000 times on the generator and shows the middle result ("typical: 74") beside the actual
result. Fixed length removes the death distortion; the ghost fan and log-only comparisons remove the mean trap.

**Roguelike shape without breaking properness.** Doors and modifiers may change the *information*
(look-back, fog, an extra readout), the *horizon*, the *generator family* or the *price* π. They may never
change the score weight after the cards are seen, never depend on W, and never be bought. Modifiers are seeded,
so every player of a seed faces the same menu.

**Language (LG item).** F6 bans wagering. No money, nothing carries over between runs, no prizes. Copy is
"split your paper capital", never "bet", "odds", "jackpot", "chips" or "cash out". There are no coin sounds and
no house edge (prices are fair: π_up + π_down = 1).

---

### S1-01 · Brier Dojo
**Case.** It is the only design with no outcome luck in its main score, so it is the correct onboarding. Every
other design needs players who already know what "70 percent" feels like.
**Flow.** Belt card (~8 s). 12 cards at ~12 s: read the path, set the slider, Lock. The reveal reads "True odds
70 percent. You said 90." with a bar of the error in points, then the outcome. The summary shows DS, raw counts,
the "luck this run" line, and Done.
**Maths.** DS = 1 - mean((q - p*)^2) / mean((0.5 - p*)^2). On seed R: Honest 1.00, Bold 0.30, Fifty 0. Bold's
0.90-on-0.70 cards alone score 1 - 0.04/0.04 = 0: no better than having no view. A belt passes when the lower
95% band of DS is >= 0.5 over >= 60 cards.
**Delight.** The first card where "you said 70, true odds 70" lands exactly, with the line "this is what
calibrated feels like".
**Bold mutation: Capital belt.** The slider becomes the capital split (b = q) for the last belt. The reveal
shows two capital lines: yours, and a "knows-the-odds" line that stakes p*. Regret is KL(p* || q). Claiming 90
on a true 70 costs 0.22 bits, against 0.12 for saying 50, so being confident and wrong is literally worse than
having no view. This belt is the bridge into S1-05.

### S1-02 · Confidence Ladder
**Case.** The cheapest build. The cap is the one mechanic that prevents overconfidence *before* the evidence
exists instead of punishing it after.
**Flow.** Tier card (~6 s). 10 rounds at ~15 s, each dot landing on the reliability diagram. Summary (~24 s).
**Maths.** Under tier 2 (25-75), Bold is forced to 0.65 / 0.75 / 0.75. BS on seed R is Honest(capped) 0.154,
Bold(capped) 0.114, Fifty 0. Uncapped Bold scores 0.049, so the cap more than doubles a novice's score and
keeps the lesson positive. Tier lift requires >= 60 forecasts, a lower BS band > 0, and edge calibration
inside its band.
**Delight.** "You may now say 90 percent": boldness earned with evidence, announced in text.
**Bold mutation: Ladder run.** A 10-room run with one door after rooms 3 and 6. Each door offers "stay at this
cap" or "try the next cap for the rest of this run". It is unranked; the run summary shows what the wider cap
cost or saved compared with the capped answers. The player tests their own readiness, and nothing is unlocked
by it.

### S1-03 · Shared Seed Duel
**Case.** The only social design that compares craft on identical cards, which is the fairest comparison
social play can offer.
**Flow.** Seed card (~8 s). 10 cards. A stacked reveal per card, in text. Then the pooled gap with a band, or
"too close to call".
**Maths.** Paired d = B_you - B_friend. If Honest meets Bold on seed R, the expected mean d is
0.2095 - 0.2379 = -0.028 per card. With a per-card SD of about 0.15, a 95% band excludes 0 after about 110
shared cards, roughly 11 sets. So the honest verdict appears slowly, and "too close to call" is the
common, true answer.
**Delight.** The stacked reveal on a card where you were both 80% sure in opposite directions.
**Bold mutation: Capital Duel.** Both players play the same S1-05 seed, with the same door menu and
independent door choices. The gap is the difference in log2 capital (bits). That is proper, and the same rank
as capital. "You both started at 100. You: 239. Friend: 74. Typical results for your calls: 230 and 80." Route
choice adds a craft topic ("why did you take the fog door?") without per-card points.

### S1-04 · Narrow Path Bridge (roguelike run, range mode)
**Case.** The chair's first roguelike: a seeded, fixed 10-room run, a door between rooms, a run summary, and a
score that stays proper.
**Flow.** Intro (~6 s). Rooms 1-10 at ~15 s: set the plank (an 80% range), Lock, the path walks across. After
rooms 3 and 6, pick 1 of 3 seeded **span rules** that last for the rest of the run: *Long sight* (2x look-back,
horizon x1.5), *Fog* (every second point hidden), *Steady wind* (lower volatility, longer horizon),
*Two-step* (the S1-08 midpoint checkpoint). Room 10 is the **keystone**: a regime-switch family, announced.
Summary (~24 s): total, coverage "8 of 10 inside, target about 8", the route taken, and Done.
**Maths.** Room = 100 - 15 x NIS, with a = 0.2 fixed and s = the end-value SD. An honest player's expected NIS
is 3.51 under every rule, so rules change how hard σ is to *infer*, not what honesty earns. The weight never
changes. On seed R: Honest 474, Bold 350, Wide 374. Bold's narrow planks lose to Wide's lazy ones.
**Delight.** The keystone: a plank laid exactly wide enough across a regime switch, with the path landing inside
by a hair.
**Bold mutation: Spoils.** After each door the player keeps one **lens**: a text readout of the generator
(recent volatility, step count, family name) for the rest of the run. The lens adds information, never score,
so build variety comes from what you choose to know, and each seed can be replayed with a different route
(unranked after first play).

### S1-05 · Jump Night: Paper Capital Run (roguelike, "make trades, maximise returns")
**Case.** This is the owner's request done literally and properly. Over a 3-minute seeded run you split paper
capital each room, the capital is the score, and the log-wealth identity makes growth equal calibration.
**Flow.** Start: 100 paper capital (~6 s). 10 rooms at ~13 s: path, a split slider ("62 on Up, 38 on Down",
2-98), Lock, reveal "Up. 100 becomes 124". After rooms 3 and 6, a 1-of-3 seeded door: *Priced room*
(the house prices Up at π ≠ 50, so edge = KL(p || π)), *Fog*, *Long horizon*, *Jump family*. Rooms 4, 8 and
10 are jump bosses. Summary: the capital line, the ghost fan ("typical result for your calls: 230"), luck this
run = actual bits minus expected bits under p*, and Done. There is no instant retry.
**Maths.** Bits = Σ log2(b / π). On seed R: Honest +1.26 (typical 239), Bold -0.43 (typical 74), Fifty 0
(exactly 100). In a priced room at π = 60 with p* = 0.5, Fifty earns +0.03 bits by staking 50 (KL(0.5 || 0.6)
= 0.029), and copying the house price earns exactly 0. Disagreeing *correctly* with the price is the only
thing that pays. Progression to harder jump families needs the lower band of pooled mean bits per room > 0
over >= 60 rooms.
**Delight.** A boss where you split 75/25, the jump goes your way, and the line reads "100 became 150, typical
for this call at true odds 70: 108". You learn luck and skill in the same sentence.
**Bold mutation: Price-setter boss.** In room 10 *you* set the price, and a seeded generator-aware bot splits
against it. Your room score is minus the bot's bits. Your expected score is maximised (at 0, against a bot that knows
p*) by pricing at your true belief, which makes it a log score on π. That is still proper, and you are setting
the price rather than taking it, which is the craft peak of the run.

### S1-06 · Number Line Shelf
**Case.** The smallest weekly puzzle, and the calmest. A shelf with no percentage means nothing is owed.
**Flow.** 5 questions at ~15 s, a pip row, and an optional second set.
**Maths.** Per question 100 - 15 x NIS, with s = the simulated SD of the statistic. Five questions: Honest 237,
Bold 175, Wide 187.
**Delight.** "Deepest dip in this path": the reveal draws the dip and your range on the same number line.
**Bold mutation: Bucket split.** Instead of a range, split 100 paper capital over 6 seeded buckets of the
number line. The bucket that contains the answer pays at its price (equal prices, 1/6 each). log2(6 x
b_hit) is the log score over the whole distribution, which is strictly proper, so skewed beliefs ("probably a
shallow dip, small chance of a deep one") can be stated, which a range cannot do. A uniform split scores 0.

### S1-07 · Run-End Report Card
**Case.** The best stop cue in the set: the session ends with a document, not a hook.
**Flow.** 12 cards with optional reason tags, then the report card. Pooled lines appear only at n >= 60.
**Maths.** Mean of 100 - 15 x NIS: Honest 47.4, Bold 35.0, Wide 37.4. The card's advice ("widen on choppy
paths") is the gradient of a proper score, so following it always raises the expected score.
**Delight.** The first pooled line that names a habit you didn't know you had, with a band.
**Bold mutation: Counterfactual column.** Next to each pooled line, the card shows what the same forecasts
would have scored at honest width ("at 80% coverage these 64 ranges would have scored +6 each"). It is
computed from the generator, never from outcomes, so it is outcome-luck-free advice about the player's own
habit.

### S1-08 · Cone Catcher
**Case.** The sweep reveal is the best single payoff moment, and now everything drawn is scored.
**Flow.** 12 cards at ~13 s, with two checkpoints per card (or end only for low input load).
**Maths.** 100 - 7.5 x (NIS_mid + NIS_end): Honest 47.4, Bold 35.0, Wide 37.4 per card (the same NIS at each
checkpoint by scale).
**Delight.** The path threading both openings of a narrow cone.
**Bold mutation: Moving checkpoint.** Each seed places the midpoint at a different, announced step (25-75% of
the window). Players learn that uncertainty grows like √t, not linearly, and every seed asks a fresh question.

### S1-09 · Bias Boss (third roguelike shape)
**Case.** The warm-up-then-boss structure is a roguelike act: rooms that teach, then a boss built from what the
rooms revealed.
**Flow.** 6 warm-ups, a door choosing which of the two least-met biases the boss targets, 6 boss cards, and an
explained reveal.
**Maths.** Card = 100 - 15 x NIS. Warm-ups are mandatory and scored the same way, so sandbagging a bias costs
about 10 points per warm-up (Wide vs Honest is 37.4 vs 47.4, Bold is 35.0).
**Delight.** "The decoy peak was on cards 2 and 5". The trick is explained, and the player sees it.
**Bold mutation: Capital boss.** The anchoring boss is played in S1-05 split mode. A decoy-anchored split loses
capital measurably (KL bits), so the bias shows up in the one number the player cares about most.

### S1-10 · Weekly Five
**Case.** The most accessible design (five keys) and a shared weekly topic with no streak.
**Maths.** The sum of 100 - 15 x NIS. With five free ranges: Honest 237, Bold 175, Wide 187. Presets cost a
shown amount.
**Delight.** Comparing pip grids with a friend who got the same five.
**Bold mutation: Weekly route.** Between bosses, everyone faces the same 1-of-2 modifier door. The pip grid
shows the route icons, not values, so "which doors did you take?" is spoiler-free conversation.

### S1-11 · Week Season
**Case.** Pooling all forecasts makes frequency worthless in expectation, which is the right season rule.
**Maths.** Chips 50 / 60 / 70 / 80 / 90 / 95. Honest-nearest (50 / 70 / 80) BS = 0.160; Bold (60 / 90 / 95)
0.074; Fifty 0.
**Delight.** The week's twist card on the first session.
**Bold mutation: Season capital.** The chips become splits, and the week score is pooled bits per forecast
(geometric growth rate), shown with a band. The per-forecast rate does not rise with volume.

### S1-12 · Mastery Trials
**Case.** Finite goals with pooled evidence: a pass can't be fished for.
**Maths.** As in the shortlist. On seed R, Bold fails the DS criterion (0.30 < 0.5), and Fifty fails at 0.
**Delight.** "Decided" replacing "not yet decided".
**Bold mutation.** A fourth, optional criterion: the lower band of S1-05 pooled bits per room > 0 over >= 60
rooms, shown as "your splits grow paper capital faster than no view". Use a four-week window.
