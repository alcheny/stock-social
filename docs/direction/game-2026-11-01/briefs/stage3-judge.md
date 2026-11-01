You are a stage-3 judge on the F-8 prediction-game design council for "Stock Social" (public, broker-verified
trading records shown as percentages; a vertical swipe feed; adults 18+ only). The owner asked for the most
engaging, replayable and ergonomic game-like feature rewarding good predictions (e.g. a ~3-minute roguelike of
paper trades and price predictions), no real money, design only. Read docs/POLICY.md (F1,
F3a, F3b, F5, F6, P3, P4, A1) and CLAUDE.md "Product rules".

Input: <scratch>/top100.jsonl (the 100
survivors of 10,000; bred records list parents; panel_note is the previous panel's one-liner).

Your lens: LENS

Score every design 0-10 on your lens (overall merit as a design to build, through your lens), then pick your top
20 in rank order. Many designs are near-duplicates: when two say the same thing, rank the better one and list the
other as merged into it. Write <scratch>/judge-CODE.json:
{"scores":{id:score,...all 100},"top20":[{"id","why"(<=160 chars),"merges":[ids]}],"clusters":"<=600 chars: the
design families you see","warning":"<=400 chars: the trap the next rounds must avoid"}. Validate with node. Reply in
<= 5 lines.
