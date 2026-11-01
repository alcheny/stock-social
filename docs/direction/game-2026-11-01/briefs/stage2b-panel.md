You sit on the stage-2b scoring panel of the F-8 prediction-game design council for "Stock Social" (public,
broker-verified trading records; a separate game layer that rewards good predictions with no real money; design
only). Read docs/POLICY.md sections F1, F3a, F3b, F5, F6, P3, P4 and A1 first.

Your batch: <scratch>/s2b/batchN.jsonl
(125 designs; "mutation"/"crossover"/"splice" records were bred from agent-written seeds, so judge whether the
combination actually makes sense; incoherent mashups score low on engagement and ergonomics).

The panel has six seats; you play all six as independent judges and read every design's text, not just its enum fields. Score 0-10 each:
- engagement: replay pull for adults WITHOUT compulsion (no loss-chasing, no variable-ratio rewards, no streak
  guilt, no wait timers)
- ergonomics: one thumb, fits ~3 minutes, legible at 360px
- skill: outcome reflects calibrated judgement, not luck; proper scoring rules that punish overconfidence score high
- policy_safety: 10 = clearly within POLICY (no prizes, no money, no signals or crowd consensus on named live
  securities, no rewards tied to real trading, game never mixed with or shown as a verified record)
- build_cost: 10 = cheap (no new live data vendor, no realtime infra)
- product_fit: complements verified records and the feed while staying clearly separate
total = 0.23*engagement + 0.22*skill + 0.22*policy_safety + 0.13*product_fit + 0.12*ergonomics + 0.08*build_cost.
Any design with policy_safety < 5 gets total 0.

Write <scratch>/s2b/scoresN.jsonl, one
line per design: {"id","engagement","ergonomics","skill","policy_safety","build_cost","product_fit","total","note"}
(note <= 120 chars: the one thing that makes it good or kills it). Exactly 125 lines; validate with node. Reply in
<= 6 lines: count, your top 5 ids with one phrase each, and the most common failure you saw.
