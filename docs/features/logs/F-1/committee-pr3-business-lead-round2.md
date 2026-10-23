COMPLIANCE: PASS · USABILITY: DEMANDS

# F-1 · PR-3 committee re-sit · Business lead

2026-10-23. `CI=1` build of `b95f281` (round-6 edits already in the tree), port 3101, fake at 2.5 s per page, 375 px, light and dark. Ticks scoped to my traders.

## My demands

1. **Feed underflow: met.** With a 2015 close, `/` returns 200 and the close ranks below the first 50.
2. **Paging: met in substance.** 4,753 closes show 50 rows. JS-off paging reaches the oldest close. First byte 0.2 s, 106 KB gzipped. The raw HTML is 396 KB, over my 300 KB bound, because the chart carries the whole record.
3. **Deadline: met.** Three calls synced each trader exactly once (unclaimed 1, then 0).
4. **Load: half.** There is no heavy feed render, and the interim `LOAD=1` rule is recorded nowhere.
5. **Import wait: half.** The headline reads "0 closed trades so far" for 57 of 63 s, under "Your trades appear here as they import."

## Are #7 and #13 the only open points? No

- **#7 is my mistake.** Calls every 5 minutes don't overlap, so they cover about 245 four-account traders an hour at 2.5 s per page, half the target. Set the cron to every minute: overlapping callers split the work safely (fleet test). Drop "never at :30".
- **#13** is correct.
- **Not recorded:**
  - The engineer's Medium (future-dated closes overflow the feed): round 6 is unverified. My closes dated 2029 took all 50 cards.
  - The feed weighs 3.5 MB (713 KB gzipped); 2.8 MB of it is chart paths.
  - #4: the connector has never touched the real vendor.

## Definition of done: not yet

The profile is done: clear, verified, losses visible at 4,753 closes. The connector works only against the fake until one real test-mode connection (#4). The UI has two gaps: the headline stuck at zero and the feed's weight.

## Demands

1. **Engineer:** clamp future closes. *Verify:* a 2031 close gives 200 and does not rank first.
2. **Engineer:** draw the feed charts at screen resolution. *Verify:* e2e with 50 heavy cards stays under 500 KB.
3. **UX/engineer:** before the first close, the headline counts activities read. *Verify:* it never shows "0" for more than 5 s.
4. **Owner:** set #7 to every minute; answer #4 and #13.

## Demo sentence

"Ten thousand trades, four accounts, one minute: the whole record, losses included."
