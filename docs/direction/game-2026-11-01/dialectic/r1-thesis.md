# F-8 dialectic, round 1: thesis (advocate's case for each of the 20)

Shared shell (so each section below can stay short, and every design inherits it):
- **Where it lives.** A separate "Practice" area reached from the menu. It never appears in the swipe feed, never
  on a public profile, never next to a Verified badge. Every game screen carries a fixed strip: "Practice game.
  Synthetic or masked historical charts. Not a live market. Not investment advice." Scores are labelled
  "practice score", never "return", "P&L" or "record".
- **Data.** *Synthetic* = generated paths labelled "Generated". *Masked historical* = a real past window with
  no name, no ticker, no dates, a random time offset, rescaled to a percent axis with 0% shown, and nothing from
  the last 24 months (so it can never be a call on a live security). Preferred order: synthetic, then masked.
- **Inputs, accessibly.** Probability slider: arrow keys move 1 pt, PageUp/PageDown 10 pts, number field
  alternative, value read aloud as "70 percent up". Range handles: Tab between the two handles, arrows move each,
  plus three presets (narrow/medium/wide). Every swipe has two buttons and a key (Left/Right). Reveals honour
  reduced motion and get a text summary ("Ended +4.1%, inside your range").
- **Calm loop.** No streak counters, no push notifications, no reward for number of sessions, no "play again"
  autostart: a run ends on a summary with a plain Done button. No prizes of any kind.
- **Luck vs skill.** One run is shown as practice, never ranked. Any rating or comparison uses a pooled sample
  (floor 60 forecasts) and shows its confidence band, the same lower-bound rule the product uses for traders.
- **Notation.** p = stated probability of "up", o = 1 if up else 0. Brier B = (p - o)^2; Brier skill
  BS = 1 - mean(B)/0.25 (0 = coin flip, 1 = perfect). Interval score for a central (1 - a) range [l, u] and
  outcome y: IS = (u - l) + (2/a)(l - y)[y < l] + (2/a)(y - u)[y > u], lower is better; both are proper, so
  honest beliefs are the best strategy.

---

### WC-061 · Seeded Gauntlet
**Design.** A 3-minute roguelike run of 10 masked or generated charts, built from a seed. Anyone can send the
seed as a link; both people play identical rounds on their own time and then see a side-by-side calibration
comparison, round by round. Ladder: clearing a gauntlet tier (pooled BS above a threshold over 3 runs) unlocks
harder chart families (choppier paths, shorter look-back). Absorbs Tape Reader Duel (no scheduling, no contact
import) and Calibration Showdown (a shared reliability curve as the reveal).
**Session.** 0-10 s: seed card ("Gauntlet 4F2K, 10 rounds"). Each round ~16 s: chart draws to a cutoff (3 s),
thumb sets the slider (8 s), tap Lock (1 s), future wipes in with the Brier penalty shown as a bar (4 s).
170 s: summary with BS, a 5-bin reliability dot plot and "Send this gauntlet" (opt-in, one link, no
prompt to pick contacts).
**Score.** Run score = 100 x BS, floored at -100. Comparison shows per-round B for both players and the gap;
"better calibrated on this seed" needs a gap larger than the run's bootstrap band, else "too close to call".
**Why tomorrow.** Three fresh gauntlets a day (fixed, no carry-over); friends' seeds arrive as links people chose
to send. The pull is "can I beat my friend on the same cards", a fairness only seeding gives.
**Unique.** The same cards remove card luck, which is the judges' main complaint about short sessions. Social
without a public board: invites rate-limited (5 links/day), no leaderboard, nothing on profiles.

### CA-006 · Brier Dojo
**Design.** A training drill on generated paths whose true up-probability p* is known (the generator's drift and
volatility fix it). Belts white to black: each belt is a family of paths (trend, mean-reverting, pure noise,
regime switch). Absorbs M-6948: belts ask for finer discrimination (p* spread narrows from 20-80% to 45-55%).
**Session.** 120 s, 12 cards at ~10 s: glance at path, set slider, Lock; reveal shows the true p* as a tick on the
slider next to yours, then the realised outcome.
**Score.** Expected-Brier excess E = (p - p*)^2, averaged; shown as "you were 8 points off the true odds".
Because E uses p*, not the outcome, it has *zero outcome luck*: a single session is a fair measurement. Belt
passes when mean E over the last 36 cards < belt threshold (e.g. 0.010 white, 0.002 black).
**Why tomorrow.** A crisp, honest mastery curve: you can see your error shrink in points. Unlimited, but each
belt test is a finite exam, so sessions end naturally.
**Unique.** The only design where "good prediction" is measurable without noise, so it is the onboarding and
calibration-training mode for every other design. It also teaches the core lesson the product cares about:
most short-horizon paths are close to 50/50.

### RG-036 · Narrow Path Bridge
**Design.** A roguelike crossing of 10 rooms on generated paths. In each room you drag an 80% range for where the
path ends; the bridge plank you lay is that range. Each room the chasm widens the penalty for width, so sharper
ranges are needed, but a miss cracks the bridge (one of three cracks ends the run). Absorbs M-6940: the run log
counts coverage, and at the end the bridge "settles" by how close coverage was to 80%.
**Session.** 140 s: 14 s per room. Path draws (3 s), thumb drags or picks a preset (7 s), Lock, the future walks
across the plank (4 s): inside = plank holds, outside = crack with a soft sound and text.
**Score.** Room score = 100 - IS (a = 0.2, in percent units, scaled per path volatility). Run score = sum of room
scores; plus a coverage check across the run: |coverage - 80%| shown, not scored, so players learn that missing
20% of the time is correct.
**Why tomorrow.** Readable escalation and a visible craft: you get better at laying exactly the plank you trust.
**Unique.** Turns the sharpness-versus-coverage trade-off into a picture anyone gets in one room. Zero data
licence cost, no ranking needed.

### RG-012 · Boss Gap Night
**Design.** A roguelike of 15 rooms on masked historical paths; every fifth room is a boss: an overnight gap
(open versus prior close). You set the probability of an up gap. A health bar makes log loss legible. Codex
entries unlock by encountering situations (earnings-style gaps, quiet gaps), described generically. Absorbs
M-7578's calm ending: run ends on a summary, no instant retry button.
**Session.** 200 s: 12 normal rooms at ~12 s, 3 bosses at ~20 s with a slower reveal. Health 10 HP shown as a bar
with a number.
**Score.** Each room costs -log2(p_outcome) HP and heals 1 HP, so a coin-flip player (p = 50%) breaks even; p clamped to [2%, 98%] so a confident miss costs up to 5.6 HP, which is the lesson. Run
ends at 0 HP or after room 15; score = bits saved versus coin flip = sum(1 + log2(p_outcome)).
**Why tomorrow.** Genuine roguelike tension: boss rooms are memorable peaks, and the codex is a finite,
completable collection of patterns.
**Unique.** Teaches tail risk through the single most visceral gesture: watching one overconfident call take
half your health. The scoring rule is the drama, not a decoration on it.

### M-5616 · Interval Archer / Archive Shelf
**Design.** A drill: drag a range for where a masked asset sits in 10 trading days. Plus a finite archive shelf of
past daily sets, playable any time unranked, each completed set filling a codex page about the pattern it taught.
Absorbs CA-004 (archery framing: target rings tighten) and M-3653/M-6934 (keyboard handles, plain word "likely
range" instead of "interval").
**Session.** 150 s, 10 shots at ~15 s: chart (3 s), drag two handles or presets (8 s), loose (1 s), the arrow
lands on the true value (3 s).
**Score.** Per shot 100 - IS for a 80% range, normalised by the path's volatility so calm and wild charts
weigh the same. Session also shows coverage (hits/10) against the 80% target.
**Why tomorrow.** The shelf gives catch-up without guilt: missing days loses nothing, and a finite catalogue
gives completion instead of a treadmill. Archive scores are unranked because answers could be looked up.
**Unique.** The calmest cadence in the set: it explicitly designs out daily-habit pressure while keeping a
completion goal. The codex turns practice into learning content the product can reuse.

### M-1966 · Confidence Ladder
**Design (fixed).** The bred field said log scoring while the loop said Brier; use Brier (easier to explain),
show the calibration dot per round. See a masked 30-day chart, set the probability the next 5 days close higher,
10 rounds per run. Harder chart families unlock as calibration improves. Absorbs M-5945: the "paper only, not
trading skill" label sits on the summary.
**Session.** 150 s, 10 rounds of 15 s: chart, slider, Lock, reveal with the dot landing on a running 5-bin
reliability diagram.
**Score.** BS per run; ladder rung n requires pooled BS > threshold_n over the last 40 forecasts (not one run),
so the climb measures skill, not a hot session.
**Why tomorrow.** Watching your reliability diagram straighten is the reward; each rung is earned evidence.
**Unique.** The simplest honest core loop in the shortlist: one chart, one slider, one dot. Cheapest to build,
easiest to test with screen readers, and the natural base layer that seeded, boss or duel variants extend.

### M-8485 · Run-End Report Card
**Design (fixed).** The bred field pairs a slider with interval scoring; make the input a range (two handles) so
interval coverage is coherent. A 3-minute run of 12 masked charts ends with a report card: coverage versus
target, overconfidence count (outcomes outside the range by more than its width), best and worst chart family,
and one descriptive habit ("Your ranges were too narrow on choppy charts 4 of 5 times").
**Session.** 180 s: 12 cards at 13 s, then a 20 s report card read at leisure.
**Score.** Run score = mean(100 - IS); card grades are descriptive bands (well calibrated / too narrow / too
wide) computed only when at least 12 forecasts exist, with counts shown.
**Why tomorrow.** Weekly cadence: one fresh set per week plus unlimited practice; the card compares this week to
last week, which gives closure instead of "one more run".
**Unique.** Every run ends with a reason to stop: a finished document about yourself. Habit hints stay about the
player's forecasting, never about markets, so no advice.

### M-2847 · Overconfidence Boss / Anchor Bias Bath
**Design (fixed).** Range input with interval score (log with a range input is incoherent). From past runs the
device computes your worst bias: too-narrow ranges, up-tilt, or anchoring on an earlier peak. The run's boss is
built from it: e.g. for anchoring, charts with a flagged decoy peak; you beat the boss by keeping coverage honest
on exactly those charts. Data stays on the device (P3).
**Session.** 150 s: 6 warm-up rooms (12 s), a 4-chart boss (15 s each), reveal "the decoy was the 3rd chart's
peak; your ranges leaned toward it by 2.3%".
**Score.** Room score 100 - IS; boss beaten if boss coverage is within 10 pts of target and mean IS beats your own
history on that bias. Ascension: each beaten bias unlocks a harder version (subtler decoy).
**Why tomorrow.** Adaptive difficulty that targets what you personally need; three runs a day max.
**Unique.** Each run learns from you, and the reveal explains the manipulation afterwards, so it teaches a bias
instead of exploiting one.

### M-2703 · Ladder of Doubt / Prediction Pairs
**Design (fixed).** Swap the swipe for a slider. You begin capped at 40-60%; proving calibration lifts the cap to
25-75%, then 10-90%, then 2-98%. Optional pairs mode from PR-071: two masked generated charts side by side,
probability the left one ends higher (relative judgement is easier), kept synthetic so it never reads as picking.
**Session.** 150 s, 12 rounds: chart, slider bounded by the cap (the locked part is visibly greyed with text "earn
this range"), Lock, reveal.
**Score.** Brier. The cap lifts when, over the last 50 forecasts, the forecasts near the cap edge came true at a
rate within the edge's 90% binomial band (you said 60% and it happened about 60%).
**Why tomorrow.** Earned boldness: "you may now say 90%" is a meaningful, honest unlock tied to evidence.
**Unique.** The best mastery gate in the set: progression is literally a widening of what you are allowed to
claim, the inverse of hype.

### M-4345 · Skill Over Luck Rating / Boss Rush Daily
**Design.** A rating is your pooled Brier skill with a 95% band. You enter the global table only when the
band's lower edge clears zero (chance) and you have at least 100 forecasts; the table sorts by the lower bound,
the product's own TR-8 rule. The daily shared seed (five boss charts) gives a common topic.
**Session.** 210 s: five boss charts at ~35 s each with slower, richer reveals (what happened next, in percent).
**Score.** BS pooled over a rolling 300 forecasts; band by bootstrap; rank by lower bound. No prizes, no titles
beyond the number.
**Why tomorrow.** Social comparison done honestly: a hot day cannot put you on the board.
**Unique.** The only design with a public table that cannot be won by luck, and it mirrors how the product
treats trader rankings. Table lives inside Practice only, opt-in handle, no link to verified records.

### M-5593 · Cone Catcher + Anchor Bias Bath meta
**Design.** Drag a shaded cone around where the price will sit at the end of the hidden window; the reveal sweeps
the true path through it. 12 cards. Two of the 12 carry a flagged decoy peak; the summary reveals whether your
cones leaned toward it. Absorbs PR-022 ("likely range" wording, coverage checked across cards), M-5301/M-0129
(presets for one thumb, keyboard handles).
**Session.** 200 s: 12 cards at 15 s, 20 s summary.
**Score.** 100 - IS on the cone's end slice (80%); decoy lean = mean signed distance of cone centre toward the
decoy versus non-decoy controls.
**Why tomorrow.** Tight-but-right feels like sniping; the sweep reveal is the best payoff moment in the set.
**Unique.** Tactile craft plus a named bias revealed honestly afterwards.

### M-6027 · Boss Rush Daily / Cone Of Silence
**Design (fixed).** Multiple choice and coverage reconcile neatly: each boss offers three preset ranges (narrow,
medium, wide), you choose one, scored by interval score; the choice is the skill. Once a day everyone gets the
same five-chart seed. The share is a spoiler-free pip grid showing only inside/outside, never values.
**Session.** 210 s: five bosses at ~40 s with slower reveals.
**Score.** Sum over bosses of (100 - IS); pip grid = inside or outside per boss.
**Why tomorrow.** A shared ritual to talk about, not a streak: no counter, missed days vanish quietly.
**Unique.** The simplest input for accessibility (three buttons) and the most shareable artifact.

### M-2369 · Week Season Descent + Seed Hunter meta
**Design (fixed).** Tap up/down alone cannot feed Brier, so tap a direction then a confidence chip (55/70/85/95%),
two taps per card. Seven daily seeded synthetic runs form a week season. Week score = median of your best five
days: one bad day is forgiven and two missed days cost nothing. Seed Hunter meta (and M-8397): any seed is
shareable; a friend plays the same generated charts and you compare reliability curves. Synthetic only, so seeds
cannot be farmed for real answers.
**Session.** 180 s: 12 cards at ~14 s (chart 4 s, two taps 4 s, reveal 4 s), 12 s day summary showing where today
sits among this week's days.
**Score.** Day = 100 x BS. Week = median of best five days, shown only once five days exist (else "partial week:
3 of 5"), so the number never pressures a sixth or seventh visit.
**Why tomorrow.** A week is a short, closed season with a fresh start every Monday; tilt is defused because a bad
run cannot sink the week. Missing a day is genuinely free.
**Unique.** The only season structure that forgives absence by design: it answers "daily cadence builds habit
pressure" with arithmetic, not a promise.

### M-7771 · Blind Drift + Cross-Season Heirloom meta
**Design.** Generated random walks with a hidden drift (some zero, some small, some larger); set the probability
the next 20 steps end above the start. Reveal shows the outcome and the true drift. Absorbs CA-015/M-7342: most
paths are zero-drift, which is the lesson. Heirloom meta: finishing a season in a high band lets you pick one
neutral-or-harder modifier for the next (shorter look-back, no axis gridlines, one skip), never extra score.
**Session.** 100 s: 10 cards at 10 s. The shortest full session in the set: fits a queue or a coffee.
**Score.** Two numbers: outcome Brier (what happened) and drift error E = (p - p*)^2 (what you could have known),
where p* follows from the generator. The gap between them is shown as "luck this run", teaching luck vs skill
explicitly.
**Why tomorrow.** Modifiers vary play across seasons without power creep; the humbling reveals ("this trend
was pure noise") are the kind of surprise people want to retest.
**Unique.** Teaches the single most important lesson for a product of public records: noise looks like trend,
and a short run of wins is weak evidence. It makes every trader profile on the platform easier to read honestly.

### HH-014 · Twin Timeline
**Design.** Async duel on a seeded generated path set: both players drag an 80% range for where each path ends.
Width and coverage are scored jointly (interval score), so the always-wide strategy loses. Absorbs PR-098
(stacked reveal of both ranges), M-8188/M-5261 (rate-limited links, no contact import) and a skill rating that
needs 20 duels before it shows.
**Session.** 120 s: 8 paths at 14 s, then a stacked reveal where both ranges and the true end sit on one axis.
**Score.** Per path, lower IS wins the point; match result by total IS, with "too close to call" when the gap is
inside the bootstrap band. Rating: Bradley-Terry style on duel outcomes, shown with its band after 20 duels.
**Why tomorrow.** A rival's tighter, still-right range on the same path is a concrete craft challenge, and
rematches are the friend's choice, not a prompt.
**Unique.** The purest head-to-head skill contest in the set; synthetic data means no reading it as a call on a
real security, and no data licence.

### M-5977 · Seasonal Mastery Trials + Head To Head Cone meta
**Design.** A season (e.g. 8 weeks) of three weekly trials: calibration (slider, Brier), range honesty (cone,
interval score) and bias (decoy charts). Pass all three in a week to hold a mastery level for the season.
Failing means try again next week; retries within a week are unlimited but each trial uses a fresh seed. Optional
friend cone duel (DP-044): both draw a cone on the same masked path, narrower-that-holds wins, shown after both
finish. Absorbs M-2912: levels are private by default.
**Session.** One trial = 180 s: 12 cards at 13 s, 24 s pass/fail panel naming which criterion failed.
**Score.** Pass if: calibration BS above threshold; range coverage within 10 pts of 80% and mean IS under
threshold; decoy lean under threshold. Each criterion needs 12+ forecasts.
**Why tomorrow.** Clear, finite goals; no ranking and no loss-chasing, since a fail just waits for next week.
**Unique.** Progression with zero leaderboard anxiety, and it bundles the three skills the other designs teach
separately into one coherent certificate-free curriculum.

### M-4802 · Number Line Guess
**Design (fixed).** Swipe cannot set a range; use two handles on a number line (keyboard: Tab plus arrows;
presets). Estimate a hidden statistic of a masked path, such as total return or worst dip from peak, as an 80%
range. Result grid: one pip per question, hit or miss. Absorbs DP-030/M-5444/M-2895: plain words ("worst dip",
"how far it ended up"), no jargon.
**Session.** 75 s daily: 5 questions at 15 s (chart 4 s, set range 8 s, reveal 3 s).
**Score.** 100 - IS per question (normalised by path volatility); coverage across your pooled last 30 questions
versus the 80% target; rating shown only past 30.
**Why tomorrow.** The smallest daily puzzle that still scores calibration honestly; easy to fit in.
**Unique.** It trains reading exactly the statistics shown on trader profiles (return, drawdown), so it makes
the core product more legible rather than distracting from it.

### M-6575 · Echo Chamber Escape + Reason Tags meta
**Design.** Before each forecast, two or three fictional, clearly labelled generated opinions appear ("Generated
voice, not a real person"), each confident about direction. Their accuracy is fixed by design near chance. You
set the slider; the reveal shows how far the opinions moved you. Reason Tags meta: tag each forecast (trend,
reversal, gut, base rate); the summary shows calibration by tag with counts. Data: synthetic paths (resolve the
"mixed" field to synthetic so no voice ever discusses a real security).
**Session.** 120 s: 10 cards at 12 s: read opinions (4 s), slider (4 s), tag (2 s), reveal (2 s).
**Score.** Brier; influence = mean |p_after - p_prior| where p_prior is a quick pre-opinion tap on half the cards,
shown alongside how often the opinions were right. Tag stats appear only at 10+ forecasts per tag.
**Why tomorrow.** The surprise of measuring how much fake confidence moved you is strong and personal.
**Unique.** An anti-signal game: it trains independence from confident feeds, exactly the habit a social trading
product should build.

### M-4052 · Echo Chamber Break / Brier Dojo
**Design.** Synthetic cards drawn so up and down are equally likely overall, each with a known p* (Dojo). A
neutral balance meter after each round shows any lean toward "up" ("leaning up by 6 points"), never a judgement
word.
**Session.** 120 s: 12 cards at 10 s.
**Score.** Expected-Brier excess E = (p - p*)^2 (no outcome luck) plus tilt T = mean(p - p*) with a band.
**Why tomorrow.** Your own bias, measured precisely and fairly, is quietly fascinating, and it can be driven to zero.
**Unique.** Cheap, educational, no real securities, and it isolates the one bias (optimism) that matters most to
people who watch winning trades in a feed.

### M-5558 · Fog Of Candles
**Design (fixed).** Binary swipe cannot express confidence, so swipe distance sets it: a short swipe = 55%, a full
swipe = 95%, with a live label ("Up, 80%") under the thumb; buttons and keys (Left/Right plus 1-5 for
confidence) are the accessible path. Capped at three rounds of 15 cards a day. Absorbs PR-001/M-2051/M-4875:
reveal wipes in with reduced-motion fallback; no frequency rewards.
**Session.** 180 s: 15 cards at 12 s: chart to cutoff (4 s), swipe (2 s), future wipes in (4 s), penalty bar (2 s).
**Score.** Brier; round = 100 x BS; daily cap means at most 45 forecasts.
**Why tomorrow.** It uses the product's native thumb grammar, so it feels at home with zero tutorial.
**Unique.** The fastest, most familiar gesture in the set; distance-as-confidence turns a reflex into a calibrated
statement, and the cap prevents slot-like looping.
