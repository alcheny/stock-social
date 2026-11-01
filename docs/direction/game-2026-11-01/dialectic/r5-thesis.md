# F-8 dialectic, round 5: thesis (final case before the committee vote)

The chair's four asks (owner's words, engagement case, acceptance criteria, answer to the dissent) push each
section past ~350 words, as the round-4 antithesis did; each block is kept to a few lines. Shell v5, reference
players and owner questions O1-O4 stand unchanged.

**The owner's "make trades and maximize returns", answered once for all five.** No design has a paper P&L. A
return-maximising paper trade rewards size and overconfidence (the Bold player wins in variance), and would put a
percent "return" in a stock app next to verified returns (POLICY: never shown beside or labelled like a record).
Instead every forecast **is** a paper trade in disguise: Points = 100 x log2(2q) is exactly the log growth of a
stake split between "higher" and "lower" in proportion to your forecast, at even odds. Maximising expected points
is maximising expected log return, and the honest forecast is the only way to do it. This sentence belongs on
"How Practice is scored" in plain words, never on a card (no stake, odds or return words in the UI).

**Maths corrections carried in.** Bold's expected over S4-01's three rooms is **-88** (-3.96 / -57.85 / -26.15,
rounded once), not -87.4: round 4's antithesis mis-stated room 1. S4-01's reveal frame reads "Expected: +14 (best
+14)", not +15 (q 0.70 at p* 0.72 expects +14.3; best +14.5). Range expectations use E[interval score] = 4 sigma
phi(z) / alpha for the honest central range, which reproduces 50.7.

---

### S4-01 · Forecast Run (the Dojo is its finish line)
**(a) Owner's words.** The literal roguelike: fixed run of 10 rooms; choices between rooms (doors after 3 and 6);
varied content (snap-back, trend, jump families); bosses at 4, 8, 10 with a second forecast; a run summary (luck
line, bucket line); personal opaque seeds; Exit ends the run with no retry (the permadeath analogue). "Predict price
movement" is the question on every card.
**Scoring, exact** (p* 0.72 / 0.55 / 0.35 higher). Expected: Honest **+22** (14.5 + 0.7 + 6.6), Bold **-88**, Fifty
**0**. Outcomes H, L, L: Honest +76, Bold -62, Fifty 0; had room 2 gone higher, Bold +255, Honest +105, and the
summary still says "Expected for your forecasts: -88. Best expected here: +22."
**Delight.** A boss's second forecast five steps later lands "off by 0" against the generator's revised chance.
**(b)** Players return because **each run asks a new question they can get better at, and the game says when they
have**, not because **a lucky run might come next**: after the finish cue the luck total is gone from summaries.
**Bold mutation: Lenses.** The room-6 door becomes a lens chosen for rooms 7-10, one of three named 44 px buttons:
"Longer history" (40 steps shown, not 20), "Weather label" (the family named), "Sister path" (one ended path from
the same settings). p* is the generator's chance given what that lens shows. The summary prices information in
expectation: "Weather label raised best expected by +3 a room; Longer history would have raised it by +5." Build
variety without unlocks or meta-currency; the skill is knowing which look is worth having.
**(c) Acceptance criteria.**
1. Points = round(100 x (1 + log2 q)); q = 50 scores 0 on either outcome (unit test).
2. Expected and Best expected match the formula to 0.1 for p* in 0.02..0.98 (property test).
3. Exit after room k: rooms 1..k appear in pooled numbers; no route restarts that seed.
4. Every reveal and summary contains the full disclaimer string once, unbroken (compliance scan).
5. Card fits 360 x 560 with Lock visible; Exit top-left, Lock bottom-right; all controls >= 44 x 44, 8 px gaps.
6. Finish cue shows once when n >= 60 and upper 95% band of mean shortfall <= 3; afterwards no "This run" line.
7. Practice entry exists only in the signed-in account menu; absent from feed, profiles, share cards (e2e).
8. Lens summary values are expectations from the server's generator, never another outcome (unit test).
**(d) Dissent.** Conceded: demand 2, no week-8 gate moves, so build after the gates. But the Run's one lesson ("one
good run is mostly luck") is the skepticism the verified feed wants viewers to bring to profiles; it is fenced
off every verified surface, so it costs the gates nothing while waiting.

### S4-02 · Range Run (the bias bosses are its keystones)
**(a) Owner's words.** Full roguelike: 10 rooms, horizon doors (Long sight, Fog), weather families, a bias boss
at room 10, one Cone room, Name the weather as the run's last riddle, personal seeds, run summary. Predicting
movement as a range ("where does this line end?").
**Scoring, exact** (s = 5, truth normal, sigma 4.68). Expected per room: Honest -6..+6 **50.7**, Bold -2..+2
**25.9**, Wide -12..+12 **27.5**. Outcomes +2 / +7 / -4: Honest 64 / 34 / 64 = **162**, Bold 88 / -62 / 28 = **54**,
Wide **84**. A percent outside costs ten times a percent of width.
**Delight.** The plank walk stops one tick inside your top edge, then Name the weather turns the ten rooms into
one story ("it was Sudden jumps; card 7 was the tell").
**(b)** Players return because **the run teaches a shape (how wide uncertainty really is) they visibly get
better at, and each bias type retires**, not because **"inside" feels like a win to chase**.
**Bold mutation: Two rings door.** One door offers inner 50% and outer 90% rings on one chart; card = 100 - 15 x
mean of (w50 + 4 m50)/s and (w90 + 20 m90)/s (weighted interval score, proper). Expected: Honest **53**, Bold (a
third as wide, same centre) **21**, Wide ±12 **27**. The new lesson is tails: in jump weather the honest outer
ring is much more than twice the inner.
**(c) Acceptance criteria.**
1. Card = 100 - 15 x (width/s + 10 x miss/s); the three outcome sums above reproduce (unit test).
2. Honest generator 80% range has the highest expected card of any range (property test over grids).
3. Narrow, Medium, Wide are named 44 px presets; Low and High rows step 1 percent; keys 1-3 work.
4. Cone room: both ranges are locked before any reveal (server rejects a second lock after reveal).
5. Reveals show only "expected" counterfactuals ("Wide preset, expected: 28"), never another outcome.
6. Plank walk has a static frame under prefers-reduced-motion; reveal text names the end point.
7. A bias type retires when its lean band sits inside ±0.25 range-widths; copy uses "a full range-width".
8. No range appears on any share surface (share-card render test).
9. Card fits 360 x 560 with Lock visible at 200% text by scroll.
**(d) Dissent.** Agreed: second build, only if a forecast product holds players. Its case is the product's own:
TR-rules put confidence intervals on every performance number; this is the only design that teaches people to
read a band, which makes the verified profiles more legible, not less.

### S4-03 · This Week's Five (shared seed, week report)
**(a) Owner's words.** Honestly **the "other game-like feature" branch**, not a roguelike: one fixed set of five
(a short "run"), Pick the question (a choice), varied statistics (end point, dip, crossings), a week report as the
summary, a shared weekly seed; no boss, no rooms.
**Scoring, exact** (dip, s = 4, normal approximation sigma 2.73 for illustration; the build uses the generator's own
distribution). Expected: Honest -9..-2 **64**, Bold -7..-4 (a third as wide, whole-percent, same centre) **51**,
Wide -16..0 **40**. One outcome, truth -7.5: 74 / 70 / 40; truth -11: -1 / -61 / 40.
**Delight.** After close: "the dip was deeper than 69 percent of ranges" and yours held.
**(b)** Players return because **there is one shared puzzle a week, final at close, worth talking about**, not
because **a streak or a missed-week mark waits for them** (there are none).
**Bold mutation: The week's weather.** All five paths share one hidden regime; with the fifth Lock the player
forecasts the regime (four named options, log rule, each kept in 2..98). Close reveals it with the five paths side
by side. Talk before close shares theories, not answers: truth exists only after close.
**(c) Acceptance criteria.**
1. Truth and crowd view are unavailable from any endpoint before close (API test).
2. Close is shown as an absolute time in the viewer's zone; no relative time anywhere (copy scan).
3. Crowd density renders only at >= 20 players, else "Fewer than 20 played; your result alone".
4. Five named 44 px presets with 8 px gaps.
5. No streak, missed-week or reminder state; no push, email or badge (grep plus e2e).
6. Weather forecast scored by 100 x (1 + log2 q) over four options; summed q = 100.
7. Shelf hidden until weekly players exceed the O4 floor for four straight weeks; opening is not announced.
**(d) Dissent.** It agrees most: this is the post-supply answer, the game for when there is a crowd. Vote it as the
destination, not a first build; it is the only design whose social reason needs no social graph.

### S4-04 · Practice: Forecast and Range on one card engine
**(a) Owner's words.** Both roguelikes above on one shell: same rooms, doors, bosses, summaries, seeds.
**Scoring.** Two proper rules, never summed: three forecast rooms Honest +22 / Bold -88 / Fifty 0; per range room
50.7 / 25.9 / 27.5. The Report shows both, each with Expected and Best expected.
**Delight.** The first Twin room shows your two habits disagreeing.
**(b)** Players return because **two different judgements (which side and how sure; how wide) each have an end**,
not because **a third row or currency keeps appearing** (none ever does).
**Bold mutation: Twin room.** Once both rows are open, one room per run asks both on one path: range first (Lock),
then side (Lock), same chart. Each scored by its own rule; an unscored line compares them: "Your range implied 58
percent higher; you said 80. Off by 22." Coherence as a craft, no new score.
**(c) Acceptance criteria.**
1. Day-one build equals S4-01 exactly: one Practice row plus Report (e2e menu snapshot).
2. Range run row appears after the first forecast finish cue or session 6, with no banner.
3. Forecast points and range cards are never added together anywhere (Report test).
4. Exit and Lock occupy the same positions in both card types (layout test).
5. Twin room: the range locks before the side slider is enabled.
6. Implied chance = Phi(centre / (half-width / 1.2816)) to 1 point; the line is not scored.
7. When both finish cues pass: "Both modes are done here. Your Report stays." and no further rows.
**(d) Dissent.** On day one it is S4-01 and costs the same; the Range run is gated on evidence the business lead
names. A vote for S4-04 is a vote for a staged plan, not for building twice now.

### S4-05 · The dated test (business lead's minimum)
**(a) Owner's words.** Roguelike-lite: fixed run of 10 rooms, varied content, announced jump boss at room 10, run
summary, personal seeds; **no choice between rooms** in the base design (the mutation adds one).
**Scoring.** As S4-01: Honest +22, Bold -88, Fifty 0 in expectation.
**Delight.** The room-10 boss reveal, then "Most of this run's points were luck." when they were.
**(b)** Players return because **a short run and an honest summary are worth a few minutes**, not because
**anything decays, resets or reminds them**; the test ends on a date written in advance.
**Bold mutation: One door.** One door after room 5 ("Snaps back" or "Keeps going") for every Practice-arm account.
It makes the test a real roguelike, so a pass is evidence for the owner's actual ask, not for a quiz; no split
arm (power is already the limit).
**(c) Acceptance criteria.**
1. A feature flag gates the entry; holdout is fixed by account and sees no Practice entry anywhere.
2. Start and decision dates are recorded before the flag turns on; the window is 28 days.
3. Primary metric: viewer D7 return to verified pages, Practice arm against holdout, with a 95% band.
4. Stop if the lift's lower band <= 0, verified profile views per viewer fall, or any compliance/T&S incident.
5. On stop: entry removed within one day; data exportable for 30 days, then deleted (P3 test).
6. Signed-out demo card, if O2 allows, counts page views apart from profile views.
7. No sharing, no route card, no push/email/badge.
**(d) Dissent.** It is the dissent's own fallback, and it replaces argument with a dated answer. Honest power:
detecting +5 points on a 15% D7 base at 80% power needs about **800 eligible accounts per arm** (7.84 x 0.255 /
0.0025); below that the stop rule will very likely fire, which is the business lead's intended default.

Not investment advice. Past performance does not guarantee future results.
