# F-8 dialectic, round 1: antithesis (red-team bench on the thesis's 20)

Seats: RT red team, RD responsible design (veto), LG legal, TS trust and safety, AX accessibility, EN engineer.
Faults the shared shell causes for every design are argued once under "Cross-cutting" (timers, masked-data
re-identification and licensing, client-side seeds, daily cadence). Below, only design-specific faults.

---

### WC-061 · Seeded Gauntlet
- **RT.** A seed is an answer key. Play it on a second account, then play "for real" or send it. "Better
  calibrated on this seed" between two people is beaten by whoever played it first. The thesis says seeding
  "removes card luck" but forgets that it adds answer-key leakage.
- **RT/scoring.** "Run score = 100 x BS, floored at -100." BS goes down to -3 (confident and wrong every time).
  A floor makes the payoff convex when you are behind: once you are near -100, going all in at 0%/100% costs
  nothing. That truncation is not proper.
- **RT.** The ladder is "pooled BS over 3 runs", which is 30 forecasts. The shell's own floor is 60.
- **EN.** A bootstrap band on 10 Brier terms is about +/-0.3 BS wide, so nearly every comparison will say "too
  close to call". The social payoff will rarely fire.
- **RD.** "Three fresh gauntlets a day (fixed, no carry-over)" is a daily appointment that expires
  (use-it-or-lose-it).
- **TS.** A link that says "beat me" is a taunt vector. It needs a block/mute and a sender-hidden option.

Verdict: **fix**. (1) Seed links are valid only for players who haven't seen the seed, and the server records
first play. One play per seed per account. (2) Drop the floor and clamp p to [2%, 98%] instead. (3) Ladder on
>= 60 pooled forecasts. Replace "3 a day" with a weekly set plus unseeded practice.

### CA-006 · Brier Dojo
- **RT (exploit).** The black belt is passed by always answering 50%. With p* uniform on 45-55%, constant 50
  gives E = 0.05^2/3 ≈ 0.0008, which is under the 0.002 threshold. The hardest belt rewards having no view.
  Narrowing the spread shrinks the absolute error for everyone, so absolute thresholds measure the generator,
  not the player.
- **RT.** "Zero outcome luck ... a single session is a fair measurement" overclaims. Card-draw luck remains
  (which p* values you got), and 12 cards is too few to grade.
- **LG.** If the reveal shows a "true odds" tick on market-looking paths, it implies real charts have
  knowable odds. Copy must say the generator's rules are not market rules (F1 adjacency).
- **AX.** The reveal must announce "true odds 54 percent, you said 60" and not rely on tick position.

Verdict: **keep** as onboarding, with fixes. (1) Grade against the always-50 baseline: pass when E <= k x
E_baseline for that belt's cards. (2) "Generated paths follow game rules, not market rules" on every
reveal. (3) Absorb M-4052's tilt meter here.

### RG-036 · Narrow Path Bridge
- **RT (scoring).** "Each room the chasm widens the penalty for width." Raising the width weight changes the
  quantile level the interval score elicits. After room 1 it no longer asks for an 80% range, so the end
  screen's "coverage vs 80%" lesson contradicts the scoring.
- **RT.** "Three cracks ends the run" breaks properness. At two cracks the survival-optimal plank is very
  wide, so honest players get punished for staying honest.
- **RD.** The crack "with a soft sound" is a loss-salient near-miss cue.
- **AX.** Dragging the plank needs the shell's handles and presets (2.5.7). The crack must not be conveyed
  by sound alone.

Verdict: **fix**. (1) Hold a = 0.2 fixed and escalate difficulty through volatility and horizon. (2) Replace
death by cracks with a fixed 10 rooms, with cracks only as narration. (3) A neutral miss cue, not a failure
sound.

### RG-012 · Boss Gap Night
- **RT (scoring).** The HP death rule makes the score improper. Near 0 HP the rational move is 50% on
  everything (to survive) or a hail-mary, so the "bits saved" total stops reflecting belief. Healing 1 HP per
  room also rewards turtling at 50%.
- **LG.** Overnight-gap bosses on masked history, with codex entries for "earnings-style gaps", teach
  event-driven patterns as predictive. That is TA content with a signal-like character (F1). Real gaps on
  famous days can be re-identified by shape.
- **RD.** The losing-health framing plus memorable boss peaks puts the most drama on confident losses.
  "Codex unlocks by encountering situations" is a collection meta that rewards volume of play.
- **EN.** At 200 s it runs over the 3-minute brief.

Verdict: **fix** (borderline kill). (1) Synthetic gaps only, and no codex text that pairs a pattern with an
outcome. (2) Fixed 15 rooms. Health is display-only and never ends the run. (3) Cut to 12 rooms / 180 s.

### M-5616 · Interval Archer / Archive Shelf
- **LG.** "A masked asset ... in 10 trading days" is market framing. The codex page "about the pattern it
  taught" is reusable "learning content" that, on real history, reads as technical-analysis instruction
  (F1 signal risk).
- **RT.** The thesis concedes archive "answers could be looked up". On masked history they also reverse-match
  through shape search.
- **RD.** Completion shelves are a collection compulsion. Prefer one with no percentage-complete meter.
- **AX.** The "arrow lands" reveal needs reduced motion plus text. Ring tightening must not rely on colour.

Verdict: **fix**. (1) Synthetic shelf, or pin the codex to forecasting skills ("ranges too narrow on wild
paths") and never to chart patterns. (2) No completion percentage. (3) Use the words "steps", not "trading
days".

### M-1966 · Confidence Ladder
- **RT.** "Pooled BS > threshold over the last 40 forecasts" is below the 60 floor, and a rung with no band
  can still be cleared on luck about 1 time in 5 near threshold.
- **AX.** A 5-bin reliability diagram after 10 rounds has 2 dots per bin, which is noise drawn as a curve.
  The diagram needs a data-table alternative, plus dot shapes that don't rely on colour.
- **EN.** This is the cheapest design and the right base layer. That much of the thesis stands.

Verdict: **keep**. (1) Rungs on >= 60 forecasts with the lower band edge above threshold. (2) Hide bins with
fewer than 8 points ("not enough yet"). (3) A table view of the diagram.

### M-8485 · Run-End Report Card
- **RT.** "Best and worst chart family" and "too narrow on choppy charts 4 of 5 times" are judgements on n=5,
  which contradicts its own 12-forecast floor. "Overconfidence count" duplicates the IS miss term.
- **RD.** The weekly cadence and the closing document are the calmest stop cue in the set. Week-over-week
  comparison invites tilt only if it is shown as up or down arrows in red and green.
- **LG.** Grade words ("well calibrated") are fine for game forecasts. Keep them off anything shareable so
  they never sit near a trader's record (F3b label rule by analogy).

Verdict: **keep**. (1) Habit lines only when a family has >= 10 forecasts, shown with counts. (2) A neutral
week comparison with numbers and text. (3) The card is not shareable.

### M-2847 · Overconfidence Boss / Anchor Bias Bath
- **RT (sandbag).** The boss is built from "your worst bias" computed from past runs. A player can fake an easy
  bias (play wide on purpose) to get a soft boss, and the ascension then rewards the fake. "Mean IS beats your
  own history" is a moving target where regression to the mean makes wins luck.
- **LG/TS.** Decoy peaks must be synthetic. Editing real history to plant a decoy is data falsification on
  a records product.
- **RD.** "Three runs a day max" is a scarcity hook that makes people come back.
- **EN.** On-device bias models mean no cross-device continuity and an unverifiable boss. Fine for P3, but
  that is a deliberate trade-off, not a free one.

Verdict: **fix**. (1) Infer bias from pooled, mandatory warm-up rooms only, not optional history. (2) Win
condition against a fixed threshold with a band, not against self-history. (3) Synthetic decoys. Remove the
daily cap language.

### M-2703 · Ladder of Doubt / Prediction Pairs
- **RT (exploit).** The cap-lift test has no power. With about 25 forecasts at the 60% edge, the 90% binomial
  band is about 44-76%, so a coin-flipper who taps 60% at random passes. Failing to reject miscalibration is
  not proof of calibration, and it ignores resolution entirely.
- **LG.** In pairs mode, "probability the left ends higher" on real assets is a relative ranking of
  securities (F3b). The thesis's "kept synthetic" must be a hard rule, not a preference.
- **RD.** "Earn this range" with greyed-out zones turns ordinary judgement into a locked feature, which is
  mild unlock bait.
- **AX.** A slider whose range is clamped must announce its limits ("maximum 60 percent; unlocks later").

Verdict: **fix**. (1) Lift the cap on edge calibration and positive Brier skill with the lower band above
0, n >= 60. (2) Pairs synthetic only, never masked. (3) Copy: "range widens with evidence", no lock icon.

### M-4345 · Skill Over Luck Rating / Boss Rush Daily
- **RT.** A global table on synthetic charts is beaten by a script, because the Bayes posterior is computable.
  On masked charts it is beaten by shape lookup. Multi-accounting farms seeds. Lower-bound ranking does not
  stop any of this.
- **RD (veto-level).** A rolling 300-forecast window fed by a 5-chart daily seed takes 60 days to qualify, and
  then decays if you stop. That is a streak in statistical clothing, and it rewards play frequency.
- **LG.** "Skill" in a public label is exactly the word F3b bars from record labels. A public forecaster table
  on the same handles as Verified traders will be quoted in bios as a credential, which mixes records. "Opt-in
  handle, no link to verified records" is impossible if it is the same account.
- **TS.** A public table invites harassment of top and bottom names.

Verdict: **kill** the global table. Keep at most (1) a private rating with a band, (2) "calibration score",
never "skill", (3) friend-only comparison through WC-061 seeds.

### M-5593 · Cone Catcher + Anchor Bias Bath meta
- **RT (scoring).** Only the cone's end slice is scored, but the reveal sweeps the whole path through it. The
  drawn interior is unscored decoration that players will take as being graded.
- **RT.** "Decoy lean" from 2 decoy cards is n=2, so the bias reveal is noise presented as insight.
- **LG/TS.** "Feels like sniping" is a violent metaphor. Drop it from copy.
- **AX.** Drawing a cone is a path gesture. The shell's handles are fine, but the cone needs a 2-parameter
  keyboard model (centre and width) that is announced.

Verdict: **fix**. (1) Draw the end range only, and let the reveal draw the cone. (2) Bias claims pooled over
>= 12 decoy cards across runs. (3) 12 cards / 180 s.

### M-6027 · Boss Rush Daily / Cone Of Silence
- **RT.** Choosing among three preset ranges is a 3-option menu. IS is proper only over the menu, the skill
  ceiling is low, and 40 s per three-button choice is padding.
- **RD.** A daily same-seed puzzle with a shareable pip grid recreates a familiar daily-puzzle share ritual.
  Day numbers on the grid spawn external streak culture even without a counter.
- **TS/LG.** A pip grid posted beside a profile link may be read as a trading record. It must never use the
  share-card template and must state "Practice game".
- **RT.** Spoilers spread the same day. On masked data, pip patterns leak which bosses moved far.

Verdict: **fix**. (1) Five presets or a free range, at 25 s per boss. (2) No day number on shares; the grid
says "Practice game. Not a record." (3) Synthetic seed.

### M-2369 · Week Season Descent + Seed Hunter meta
- **RT (contradiction).** The week score is shown "only once five days exist", so it pressures exactly five
  visits in seven. "Missing a day is genuinely free" holds for two days only. The best-five median also rises
  with every extra day played (more draws, best kept), which is a reward for play frequency.
- **RT (scoring).** The confidence chips are 55/70/85/95. There is no 50, so on the zero-drift paths that teach
  the lesson the honest answer cannot be given, and Brier then punishes forced conviction.
- **RD.** Daily seeded runs plus a weekly season form a double-cadence habit loop.

Verdict: **fix**. (1) Week score over all forecasts made that week, pooled (no best-of), shown at any count with
a band. (2) Add a "50 / no view" chip. (3) Drop daily seeds; one weekly seed and free practice.

### M-7771 · Blind Drift + Cross-Season Heirloom meta
- **RT.** "One skip" as a heirloom is extra score: skipping a hard card raises the expected run. It
  contradicts "never extra score". With mostly zero drift, always-50 is near optimal, so once that is
  learned the game is solved and dull.
- **AX.** "No axis gridlines" as a reward modifier removes an accessibility affordance and turns impairment
  into a prize.
- **LG.** "Luck this run" as the outcome-minus-expected gap is a good lesson. Keep it phrased about the game.

Verdict: **keep**, with fixes. (1) Remove skip and gridline modifiers; keep look-back and horizon only.
(2) Score drift error relative to the always-50 baseline. (3) Merge with CA-006 as its advanced belt.

### HH-014 · Twin Timeline
- **RT.** "Lower IS wins the point" over 8 paths is mostly luck. A Bradley-Terry rating on 20 such duels is a
  noisy person ranking. The seed exploit (alt account plays first) applies as in WC-061.
- **RD.** The loser initiates rematches, and "the friend's choice" does not stop loss-chasing. Head-to-head
  win/loss records are the strongest tilt driver on the shortlist.
- **TS.** Duel results invite taunting, so it needs block, mute and decline without a notice to the sender.

Verdict: **fix**. (1) Show the total IS gap with a band. No per-path "points" and no win/loss rating.
(2) At most 1 rematch per pair per day, with no "rematch" button on a loss. (3) First-play-wins seed rule.

### M-5977 · Seasonal Mastery Trials + Head To Head Cone meta
- **RT/RD (veto).** "Retries within a week are unlimited but each trial uses a fresh seed" means you can retry
  until noise passes you, which is multiple testing. Pass-by-attrition is the classic loss-chasing loop the
  thesis claims to avoid ("no loss-chasing, since a fail just waits"; it does not wait).
- **LG.** "Mastery level held for the season" is a badge in all but name. Private by default is fine. Never
  allow it on a profile.
- **EN.** Three trial engines (slider, cone, decoy) cost the price of three designs.

Verdict: **fix**. (1) Pool all attempts in a week, so a pass needs pooled n >= 36 per criterion with the
band clearing the threshold. (2) Hard rule that it never goes on a profile. (3) Build it last, from the
pieces of CA-006/M-8485/M-2847.

### M-4802 · Number Line Guess
- **LG (records mixing).** "Trains reading exactly the statistics shown on trader profiles (return,
  drawdown)" is the overclaim. Profile drawdown is "per-trade, equal-weight", while a path's "worst dip from
  peak" is a different quantity. Sharing vocabulary blurs game numbers with record numbers (F3a, records
  mixing).
- **RT.** Five questions a day reach the 30-question rating floor in six days, but "volatility-normalised IS"
  needs a stated normaliser or wild paths dominate.
- **RD.** A 75 s daily puzzle is the stickiest daily habit in the set. That is fine only without a day
  counter.

Verdict: **keep**. (1) Use game words distinct from profile labels ("deepest dip in this path"). (2) Don't
claim it teaches profiles. (3) Daily set optional and expiring silently; unlimited unseeded practice.

### M-6575 · Echo Chamber Escape + Reason Tags meta
- **LG (F1).** On-screen "confident opinions about direction" are simulated tips. Labelling them fictional
  doesn't change that the screen shows directional calls next to a chart. A screenshot strips the label.
- **TS/T2.** Persona voices (names, avatars) imitate the feed's people. "Accuracy fixed near chance" reads as
  commentary that confident traders on the platform are wrong.
- **RD.** Deliberately manipulating the player to measure influence needs consent up front. As written it is
  a deception mechanic.
- **EN.** The pre-opinion tap on half the cards adds steps at 4 s each, and the session overruns at the stated
  12 s per card.

Verdict: **kill** in this form. A survivor would show only abstract labelled "Model A: 70% up" bots, with
no persona and no prose, on synthetic data, with a consent screen. Reason Tags can move to M-8485.

### M-4052 · Echo Chamber Break / Brier Dojo
- **RT.** This is CA-006 with a tilt meter. The name promises an echo chamber that isn't there. A tilt band from
  12 cards is roughly +/-15 pts, so "leaning up by 6 points" is noise stated as fact.
- **AX.** The meter must be text-first.

Verdict: **kill as a separate design; merge into CA-006** with tilt shown only after >= 60 forecasts, with a
band.

### M-5558 · Fog Of Candles
- **RT (scoring).** Confidence keys 1-5 map to 55-95 with no 50 (same flaw as M-2369). Swipe distance is
  imprecise, so stated p is noise from motor control, which pollutes Brier.
- **RD (veto-level).** 15 cards x 12 s with a 2 s reflex input is the fastest event frequency in the set.
  Rapid stake-and-reveal cycles are a known harm driver. "Capped at three rounds a day" is a come-back-tomorrow
  scarcity hook.
- **LG/TS.** "Uses the product's native thumb grammar" collides with the feed, the one place F-8 must never
  feel like. Candlestick visuals are the most trading-terminal look in the set.
- **AX.** The distance gesture needs a single-pointer alternative (buttons exist, good) and an announced live
  value. Candles are hard for screen readers; use a line.

Verdict: **kill**, or fix as follows. (1) Buttons for direction plus a 50-95 chip row, with no swipe-distance
mapping. (2) 10 cards, untimed. (3) Line chart, no daily cap wording.

---

### Cross-cutting

1. **Per-round timers break WCAG 2.2.1 and the calm brief.** The thesis times every input ("thumb sets the
   slider (8 s)"). If enforced, it fails Timing Adjustable and creates pressure. Make input untimed, with the
   seconds as design estimates only.
2. **Masked historical is not safe.** Shape plus a percent axis re-identifies famous windows despite random
   offsets, and the 24-month exclusion doesn't help. It also needs a market-data licence from a vendor that
   isn't integrated, which T1 forbids naming in docs anyway, and redistribution terms are unknown. Default
   every design to synthetic, and make masked data a counsel/committee item.
3. **Seeds are answer keys.** If generation runs client-side, the future is computable from the seed. The
   server must hold the post-cutoff path and reveal it only after Lock. Use first-play-only rules for any
   comparison.
4. **Death and termination rules break proper scoring** (RG-036, RG-012, and the WC-061 floor). Any rule
   that ends a run or truncates a score on performance gives a non-truthful optimum.
5. **Absolute thresholds reward "always 50"** on near-coinflip content (CA-006, M-7771, M-4052). Grade
   against the constant-forecast baseline.
6. **No-50 inputs** (M-2369, M-5558) force conviction. Every probability input must allow 50.
7. **Small-n claims.** Bins, habit lines, tilt and decoy lean on 2-12 forecasts break the shell's own floor of
   60. Apply the floor to every claim, not just ratings.
8. **Cadence creep.** "Three a day", daily seeds, daily caps, rolling windows and best-of-N all reward or
   schedule frequency. Prefer weekly sets plus free unseeded practice with no counters.
9. **Codex and pattern content drifts into F1.** Any text pairing a chart pattern with an outcome is TA
   instruction. Keep codex content about the player's forecasting habits only.
10. **Shares and labels.** No game artifact uses the record share-card template, the word "skill" or day
    numbers. Every share says "Practice game. Not a record." Block, mute and silent decline apply to every
    link-based social feature.
