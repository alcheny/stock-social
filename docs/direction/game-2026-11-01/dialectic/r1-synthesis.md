# F-8 dialectic, round 1: synthesis (12 designs for round 2)

## Round 1 result

| In ids | Out id | Kept / merged / dropped | One-line reason |
|---|---|---|---|
| CA-006, M-4052, M-7771 | S1-01 | merged | Same known-p* drill: M-4052's tilt meter and M-7771's drift reveal + "luck this run" become Dojo belts; graded vs always-50 baseline. |
| M-1966, M-2703, M-4345 | S1-02 | merged | One slider loop; M-2703's widening cap becomes the ladder, M-4345 survives only as a private banded rating (global table killed). |
| WC-061, HH-014 | S1-03 | merged | Both are seeded async comparisons; one engine with a probability mode and a range mode, gap with band, no win/loss. |
| RG-036 | S1-04 | kept (fixed) | Fixed a and fixed 10 rooms; difficulty by volatility/horizon; cracks are narration only. |
| RG-012 | S1-05 | kept (fixed) | Synthetic jumps, health display-only, 12 rooms / 180 s, codex removed. |
| M-4802, M-5616 | S1-06 | merged | Number-line statistic puzzle gets the archive shelf (synthetic, unranked, no completion %); archer framing dropped. |
| M-8485, M-6575 (Reason Tags only) | S1-07 | merged | Report card absorbs Reason Tags; all claims on pooled n >= 60. |
| M-5593 | S1-08 | kept (mutated) | Cone interior now scored via two checkpoints; decoy meta moved to S1-09. |
| M-2847, M-5593 (decoy meta) | S1-09 | merged | One bias-boss engine; bias inferred from mandatory warm-ups, fixed thresholds, synthetic decoys. |
| M-6027 | S1-10 | kept (fixed) | Weekly synthetic seed, five presets or free range, pip share with no day number. |
| M-2369, M-5558 (chip row only) | S1-11 | merged | Week season pooled over all forecasts; Fog's button + chip input (with 50) replaces swipe distance; Seed Hunter moved to S1-03. |
| M-5977 | S1-12 | kept (fixed) | Pooled attempts, never on a profile, built last from S1-01/S1-07/S1-09 engines; cone duel moved to S1-03. |
| M-4345 global table | - | dropped | Killed: scriptable, frequency-rewarding rolling window, "skill" label, records mixing, harassment. |
| M-6575 Echo Chamber Escape | - | dropped | Killed: simulated directional tips next to charts, persona voices, deception without consent. |
| M-5558 Fog Of Candles (swipe, candles, daily cap) | - | dropped | Killed: feed gesture, motor-noise confidence, fastest stake-reveal cycle, scarcity cap. |
| M-4052 as separate design | - | dropped | Duplicate of CA-006 (merged into S1-01). |

## Shared shell v2 (every design inherits it; fixes all ten cross-cutting items)

- **Place and label.** Separate "Practice" area; never in the feed, on a profile or beside a Verified badge.
  Fixed strip on every screen: "Practice game. Generated charts that follow game rules, not market rules. Not
  investment advice." Numbers are "practice score" / "calibration score"; never "skill", "return", "P&L",
  "record".
- **Data: synthetic only.** Masked historical is out of scope and listed as a committee/counsel item
  (re-identification, licence). Generator parameters (drift, volatility, jump rate) are known, so p* and
  quantile spread s are known per card.
- **Server-held futures.** The client gets the path up to the cutoff only; the post-cutoff path is sent after
  Lock. Seeds are opaque ids, not generator inputs.
- **Untimed input (WCAG 2.2.1).** All seconds below are design estimates for a typical player, never limits.
- **Inputs.** Probability slider 0-100 incl. 50 (arrows 1 pt, PageUp/Down 10, number field, read as "70
  percent up"); range = two handles (Tab, arrows; presets narrow/medium/wide; announced as "from minus 3 to plus
  5 percent"). Charts are lines with 0% on the axis, text summary on every reveal, reduced-motion fallback.
- **Small-n rule.** A run shows raw counts only ("3 of 12 outside"). Any claim about the player (bias,
  calibration, habit, rating, unlock) needs pooled n >= 60 and shows a 95% band.
- **Baselines.** Probability scores are reported relative to always-50; range scores normalised by s.
  No floors, no truncation, no run-ending rules on performance.
- **Calm.** No streaks, pushes, day numbers, daily caps, "play again" autostart or prizes. Cadence is weekly sets
  plus free unseeded practice. Every link feature has block, mute, silent decline and sender-hidden.

Notation: Brier B = (p - o)^2; BS = 1 - mean(B)/mean(B_50) where B_50 = 0.25. Interval score for a central 80%
range: IS = (u - l) + 10(l - y)[y < l] + 10(y - u)[y > u]; normalised NIS = IS / s. An honest 80% range on a
normal end-spread s expects NIS ≈ 3.5.

---

### S1-01 · Brier Dojo
**Lineage:** CA-006 (known-p* drill, belts), M-4052 (tilt meter), M-7771 (drift reveal, "luck this run",
look-back/horizon modifiers as advanced belts).
**Format and data.** 12 generated paths per session, each with known up-probability p*. Belts are path families:
trend, mean-reverting, pure noise, regime switch, then "blind drift" belts with shorter look-back or longer horizon.
**Session.** 0-8 s belt card. 8-152 s: 12 cards at ~12 s (read path 4 s, slider 5 s, Lock, reveal 3 s showing
"true odds 54 percent, you said 60", then outcome). 152-180 s summary: Dojo score, raw counts, Done.
**Input.** Shell slider; reveal announces both numbers in text, not tick position alone.
**Scoring.** E = (p - p*)^2, E_0 = (0.5 - p*)^2 on the same cards. Dojo score DS = 1 - mean(E)/mean(E_0).
Always-50 scores exactly 0; claiming 80 when p* = 60 costs four times claiming 70. Overconfidence is a quadratic
distance from the knowable odds, with no outcome luck. "Luck this run" = mean(B) - mean(E + p*(1 - p*)).
**Progression.** Belt passes when the lower 95% band of DS over >= 60 belt cards is >= 0.5. Tilt T = mean(p - p*)
with band appears after 60 cards ("leaning up 4 points, band 1 to 7").
**Sharing.** None. It is training.
**Engaging, not compulsive.** Visible error shrinking in points; each belt is a finite exam that ends.
**Risks.** p* on market-looking paths may imply real markets have knowable odds (copy mitigates). 60 cards per
belt is 5 sessions; could feel slow.

### S1-02 · Confidence Ladder
**Lineage:** M-1966 (one chart, one slider, reliability dots, cheapest base), M-2703 (cap that widens with
evidence), M-4345 (private rating with band only).
**Format and data.** 10 generated paths per run, "probability the next 20 steps end higher". Ladder tiers widen
the allowed range: 40-60, 25-75, 10-90, 2-98, and pair harder path families with each tier.
**Session.** 0-6 s tier card ("You can say 25 to 75 percent"). 6-156 s: 10 rounds at ~15 s (path 4 s, slider 6 s,
Lock, reveal 4 s; the dot lands on the reliability diagram). 156-180 s summary with BS and raw counts.
**Input.** Shell slider; limits announced ("maximum 75 percent; widens with evidence"); no lock icon or greyed
"earn this" zone. Diagram has a data-table view and shape-coded dots.
**Scoring.** BS per run (relative to always-50). Brier is proper and quadratic, so a 90% call that misses costs
0.81 against 0.25 for 50. The cap itself stops early overclaiming before evidence exists.
**Progression.** Tier lifts when, over >= 60 forecasts in the tier, BS lower band > 0 and >= 20 forecasts within 5
pts of the cap came true at a rate inside their band. Bins with < 8 points show "not enough yet". Private
calibration score with band, visible only to the player.
**Sharing.** None. No public table.
**Engaging, not compulsive.** "You may now say 90%" is a meaningful, honest unlock: earned boldness.
**Risks.** The edge-calibration test is still weak; the positive-skill requirement carries most of the weight.
Path-family difficulty must be tuned so tier 4 is reachable.

### S1-03 · Shared Seed Duel
**Lineage:** WC-061 (seeded gauntlet, reliability reveal), HH-014 (range mode, stacked reveal, rematch limits),
M-2369 Seed Hunter (any practice seed shareable), M-5977 (cone duel as range mode).
**Format and data.** A server-held seed of 10 generated paths. Probability mode (slider, Brier) or range mode
(80% range, IS). The sender plays, sends one link; the friend plays the same cards.
**Session.** 0-8 s seed card ("10 cards, range mode, from a friend"). 8-158 s: 10 cards at ~15 s. 158-180 s
stacked reveal: both answers and the outcome on one axis per card, then the gap.
**Input.** Shell slider or handles; the stacked reveal reads as text ("You: minus 2 to plus 6. Friend: 0 to plus 4.
Ended plus 5.").
**Scoring.** Paired gap per card d_i = B_you - B_friend (or NIS). Result = mean(d) with a paired bootstrap band,
pooled over all seeds this pair has shared. "Better calibrated across 4 shared sets" only when the band
excludes 0, else "too close to call". No floor, no per-card points, no win/loss tally. Confident misses cost
the same as in solo play, so bluffing big doesn't help.
**Progression.** None beyond the pair's pooled gap.
**Sharing.** Opt-in link, 5 per day, no contact import. Only first plays count: an account that has seen a seed
can't count it in a comparison. No rematch button on a loss; at most 1 new seed per pair per day. Block, mute,
silent decline, sender-hidden. Link preview says "Practice game. Not a record."
**Engaging, not compulsive.** Same cards, a fair craft comparison with a friend.
**Risks.** Alt accounts can still pre-play. Pooled bands need many shared sets before they say anything.

### S1-04 · Narrow Path Bridge
**Lineage:** RG-036 (plank = range, picture of sharpness vs coverage), M-5616 (volatility normaliser), shell.
**Format and data.** A fixed 10-room crossing on generated paths. Room difficulty rises by volatility and horizon,
never by changing the scoring weight.
**Session.** 0-6 s bridge intro. 6-156 s: 10 rooms at ~15 s (path 3 s, set plank 7 s, Lock, the future walks across
4 s: inside = plank holds; outside = the path steps past the plank edge, narrated "landed 2 points outside").
156-180 s summary: total, coverage "8 of 10 inside, target about 8".
**Input.** Two handles or presets; the reveal outcome is in text and shape, with no sound-only or colour-only cue.
**Scoring.** Room = 100 - 15 x NIS (honest expects ≈ 47). Run = sum. a = 0.2 throughout, so the score always asks
for a true 80% range: a narrow plank that misses pays 10x the miss distance, a wide plank pays its width.
**Progression.** Bridge "spans" (harder volatility/horizon mixes) open when pooled coverage over >= 60 rooms has a
band containing 80% and mean NIS is under a fixed threshold.
**Sharing.** None.
**Engaging, not compulsive.** Readable escalation and a craft you can see: laying exactly the plank you trust.
**Risks.** Cracks as narration may still read as failure; tone testing needed. A fixed 10 rooms loses some
roguelike tension.

### S1-05 · Jump Night
**Lineage:** RG-012 (boss rooms, log-score drama, calm ending), fixes from the antithesis.
**Format and data.** 12 rooms of generated paths. Rooms 4, 8, 12 are "jump" bosses: the generator's jump process
fires between two steps; you give the probability the jump is upward. No codex, no pattern text.
**Session.** 0-6 s intro. 6-126 s: 9 normal rooms at ~13 s. Bosses interleaved at ~18 s with a slower reveal.
126-180 s total incl. a summary: bits versus coin flip, health trace, Done (no instant retry).
**Input.** Shell slider clamped to 2-98 (announced). Health shown as a bar plus number.
**Scoring.** Room = 1 + log2(p_outcome); run = sum (bits saved vs always-50, which scores 0). Log score is proper and
punishes overconfidence hardest: a 98% miss costs 4.6 bits, while a 70% hit earns 0.49. Health = 10 + running
score, display only: it can show "below zero" but never ends the run, so there is no survival incentive to
turtle or gamble.
**Progression.** Harder jump families (rarer, more skewed) open when pooled bits per room over >= 60 rooms has a
lower band > 0.
**Sharing.** None.
**Engaging, not compulsive.** Boss peaks are memorable; watching one 95% call drain the bar teaches tail risk.
**Risks.** Drama centred on confident losses may still feel punishing; the health bar could be dropped for a
neutral bits trace. Jumps resemble real events in look.

### S1-06 · Number Line Shelf
**Lineage:** M-4802 (statistic estimate on a number line, smallest puzzle), M-5616 (archive shelf, calm
catch-up), antithesis fixes.
**Format and data.** 5 questions about a hidden statistic of a generated path ("where this path ends", "deepest
dip in this path"), each an 80% range. One weekly set plus unlimited unseeded practice. Past weekly sets sit on a
shelf, playable unranked, with no completion percentage.
**Session.** 0-5 s question card. 5-80 s: 5 questions at ~15 s (path 4 s, handles 8 s, reveal 3 s). 80-100 s pip
row (inside/outside) and score. Optional second set fills to 3 minutes.
**Input.** Two handles on a number line or presets; plain game words, distinct from profile labels.
**Scoring.** 100 - 15 x NIS, with s = the generator's 10-90 spread of that statistic (found by simulation).
Too-narrow misses pay 10x the distance, so stating false precision loses.
**Progression.** A calibration score with band appears at pooled n >= 60. New statistics (longest climb, number
of crossings) open at that point.
**Sharing.** Pip row only (inside/outside), seed code not a date, "Practice game. Not a record."
**Engaging, not compulsive.** A small, fair weekly puzzle; the shelf means missing a week loses nothing.
**Risks.** "Deepest dip" still sounds like drawdown, so copy must keep it distinct. The shelf can still feel like a
backlog.

### S1-07 · Run-End Report Card
**Lineage:** M-8485 (report card, weekly closure), M-6575 (Reason Tags only), antithesis fixes.
**Format and data.** 12 generated paths, 80% range input; each forecast gets an optional reason tag (trend,
reversal, gut, base rate). Ends on a private report card.
**Session.** 0-5 s intro. 5-155 s: 12 cards at ~12.5 s (path 3 s, range 6 s, tag 2 s, reveal 2 s). 155-180 s report
card, read at leisure, then Done.
**Input.** Handles or presets; tags are four buttons (keys 1-4), skippable.
**Scoring.** Run = mean(100 - 15 x NIS). Card shows: this run's raw counts ("3 of 12 outside, 2 by more than their
width"); pooled lines only at n >= 60 per family or tag, with band ("Ranges too narrow on choppy paths: coverage
68%, band 61-75, 64 forecasts"). The IS is proper, so the card's advice ("widen on choppy paths") never conflicts
with the score.
**Progression.** None. The card is the reward; it compares this week to last week in neutral numbers and text.
**Sharing.** Not shareable.
**Engaging, not compulsive.** A finished document about yourself: a reason to stop, not to replay.
**Risks.** Pooled lines take 5+ weeks to appear for rare tags. Habit text must stay about the player's forecasting,
never about markets.

### S1-08 · Cone Catcher
**Lineage:** M-5593 (cone, sweep reveal, presets), RG-036 (normaliser), antithesis fix (the interior must be scored).
**Format and data.** 12 generated paths. You set two 80% ranges: at the midpoint and at the end of the hidden
window; the cone is drawn between them, so everything drawn is graded.
**Session.** 0-5 s intro. 5-161 s: 12 cards at ~13 s (path 3 s, two ranges 7 s, Lock, path sweeps through 3 s).
161-180 s summary.
**Input.** Per checkpoint a centre + width model (arrows move centre, Shift+arrows width), announced; presets;
Tab between checkpoints.
**Scoring.** Card = 100 - 7.5 x (NIS_mid + NIS_end), each normalised by its own s. Both are proper, so honest
midpoint and end beliefs maximise the score; a cone too narrow at either checkpoint pays 10x the miss.
**Progression.** Longer windows and choppier families open at pooled n >= 60 when coverage band contains 80%.
**Sharing.** None. Copy avoids aiming or shooting metaphors.
**Engaging, not compulsive.** The sweep reveal is the best payoff moment in the set, and tight-but-right is a
visible craft.
**Risks.** Two ranges per card raise input load for keyboard and screen-reader users; there's an option to score
the end checkpoint only.

### S1-09 · Bias Boss
**Lineage:** M-2847 (personal bias boss, explained reveal, ascension), M-5593 (decoy meta), antithesis fixes.
**Format and data.** Each run: 6 mandatory warm-up rooms (standard mix) + a 6-card boss. Biases: too-narrow
ranges, up-tilt, anchoring on a synthetic decoy peak. Until 60 warm-ups exist the boss rotates through all three.
**Session.** 0-5 s. 5-77 s: 6 warm-ups at ~12 s. 77-167 s: 6 boss cards at ~15 s. 167-180 s reveal: "The decoy was on
cards 2 and 5; your ranges leaned toward it in raw counts 2 of 2", with pooled lean only at n >= 60.
**Input.** Shell handles/presets.
**Scoring.** Card = 100 - 15 x NIS. Bias is inferred from pooled warm-ups only, which are mandatory and not
sandbaggable without losing warm-up score. Decoy lean = mean signed distance of range centre toward the decoy
vs control cards, with band.
**Progression.** A bias is "met" when pooled boss cards of that type (>= 60) have coverage band containing 80% and
lean band containing 0, against fixed thresholds, not self-history. Then a subtler version opens.
**Sharing.** None. Bias data are computed server-side, private, deletable (P3).
**Engaging, not compulsive.** Adaptive difficulty aimed at what you need, and the trick is explained afterwards.
**Risks.** 60 boss cards is 10 runs per bias; slow. A planted decoy is a mild deception, so it needs a one-time
explainer up front.

### S1-10 · Weekly Five
**Lineage:** M-6027 (five bosses, same seed for all, spoiler-free pip grid), antithesis fixes.
**Format and data.** One synthetic seed per week, the same five bosses for everyone, server-held. Free unseeded
practice otherwise.
**Session.** 0-10 s seed card. 10-160 s: five bosses at ~30 s (longer path 6 s, pick one of five presets or set a
free range 12 s, slow reveal 10 s with text). 160-180 s pip grid and score.
**Input.** Five preset buttons (keys 1-5) or "set my own" handles: the simplest accessible path in the set.
**Scoring.** Sum of (100 - 15 x NIS). Free range is the proper option; presets are a coarse menu, and the summary
shows how much the free range would have saved.
**Progression.** None. It is a shared topic, not a ladder.
**Sharing.** Pip grid (inside/outside) with the seed code, no week number, own template, "Practice game. Not a
record." Never the record share card.
**Engaging, not compulsive.** A shared weekly conversation piece; a missed week just disappears.
**Risks.** Spoilers spread within the week, so the grid shares no values. Comparison culture may form off-platform.

### S1-11 · Week Season
**Lineage:** M-2369 (week season, forgiving cadence), M-5558 (direction buttons + confidence chips), M-7771
(weekly rule twist as variety, no power creep).
**Format and data.** A season is one week, with one published rule twist (shorter look-back, longer horizon).
12-card synthetic sessions, any number, any days.
**Session.** 0-6 s twist card. 6-162 s: 12 cards at ~13 s (path 4 s, two taps 4 s, reveal 5 s). 162-180 s: week so
far, with band.
**Input.** Up / Down buttons (Left/Right keys) then a chip row 50 / 60 / 70 / 80 / 90 / 95 (keys 0-5); 50 needs no
direction. Untimed.
**Scoring.** Week score = BS pooled over all forecasts that week, shown at any count with its band. The expected
value doesn't depend on how often you play (playing more only narrows the band), so frequency earns nothing.
Brier punishes 95% misses at 0.90 against 0.25 at 50.
**Progression.** None across weeks beyond a private history of week scores with bands.
**Sharing.** None.
**Engaging, not compulsive.** Closed, fresh weekly seasons with a new twist; one session is a complete week.
**Risks.** Chips coarsen p (rounding loss is small but real). Pooling all play may still nudge people to "fix" a
bad week.

### S1-12 · Mastery Trials
**Lineage:** M-5977 (three-skill curriculum, private levels), built from S1-01 (calibration), S1-07 (range
honesty) and S1-09 (bias) engines.
**Format and data.** A two-week trial window with three criteria. Every attempt in the window pools, so there's no
fresh-seed retry selection.
**Session.** One trial = 180 s: 12 cards at ~13 s, mixed criteria. 156-180 s panel: per criterion, pooled n and
band, "not yet decided" until n >= 60.
**Input.** Inherited from the source engines.
**Scoring.** Pass when, pooled over the window: DS lower band >= 0.5; range coverage band contains 80% and mean NIS
< threshold; decoy-lean band contains 0. A pass requires n >= 60 per criterion, so extra attempts tighten the
band but can't fish for a lucky pass. All three rules are proper or baseline-relative.
**Progression.** A private level held for the next window; never on a profile, never shareable, no badge art.
**Sharing.** None (hard rule).
**Engaging, not compulsive.** Clear finite goals; a fail rolls into the next window, with no ranking.
**Risks.** Highest build cost, so it ships last. 180 forecasts per window is about 15 sessions in two weeks, which
may itself feel like a schedule; consider a four-week window.
