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

## Round 3

2026-10-23. Tested the existing `CI=1` build of `fc40342` (no app or lib file is newer than the build) on port 3101, with the vendor fake on 4181. Viewport 375 px, light and dark. I ran no tick. I created 15 test traders and deleted them afterwards. Other sessions share the database, so the sizes below include their traders.

### My demands

1. **Future-dated close: met.**
   - Through the import, a sell dated 2031 and one 36 h ahead are never published. The profile counts both on one line under the chart, and the feed answers 200.
   - I also wrote rows dated 2031 and tomorrow straight into the database (5%, beside a 5% close a minute old). `/` answers 200, and those rows rank 41st to 43rd, next to the fresh close. They score as now and never above it.
2. **Feed weight: met for record length, open past about 5 heavy traders.**
   - Chart fidelity holds. A 2,370-close trader's pane has 372 points against the profile's 2,371, with an identical bounding box (0, 30.3, 640, 179.4). The light and dark screenshots read the same, and the drawdown shape is intact.
   - Each trader's cost is now fixed whatever the record length: about 30 KB of page data plus about 2 KB per card.
   - With 6 distinct heavy traders filling 36 of the 50 cards, the page is **535–558 KB raw** (80 KB gzipped). That is over my 500 KB bound. The engineer's test passes because its 50 cards come from 2 traders.
   - On a phone (4× CPU, about 1.6 Mbps): first paint 2.3–3.4 s, against 2.0 s with no heavy traders. Main-thread long tasks 5.0 s, against 2.8–3.3 s.
   - Linear estimate, not measured: 50 distinct long records ≈ 1.8 MB raw.
   - This is not a blocker for F-1: the record-length cliff I asked about is gone. Recorded below.
3. **Import headline: met.**
   - 2 accounts × 2,500 activities, fake at 2.5 s per page. The headline climbs 0 → 1,000 → 2,000 → 2,500, and the first count shows 4.6 s after the profile loads.
   - From the first close it reads "2,373 closed trades so far", then "Import finished.".
   - A reload mid-import opens on the count (2,000), not on zero. "0 closed trades so far" is never visible.
4. **#7 in `docs/IMPLEMENTATION.md`: met.** It reads "cron every minute", with the overlap reasoning (245 against 500 traders an hour) and "never at :30" withdrawn. The owner's answer is blank, as it should be. The `LOAD=1` interim rule is recorded.

### The engineer's deviation (seen headline separate from the announced line)

It meets my intent. I asked that a sighted trader never stares at a zero. A screen-reader user already hears "N activities imported so far" every 5 s, and the closes line arrives at once. Keeping the announced status line unchanged protects two tested guarantees: changes at least 5 s apart, and closes shown immediately at the rebuild. A headline that is `aria-hidden` with a visually hidden live twin is the right split. I accept it.

### New, from walking it

- **Duplicate line while counting (blocking: a clean-UI defect on the first screen after connecting).**
  - During paging the owner sees "Importing your record · 1,000 activities read from your broker" and, directly below, "1,000 activities imported". That is the same number twice, with two different verbs.
  - The line below (`app/u/[handle]/import-banner.tsx:78`) earns its place only once the headline counts closes. Delete it while `counting(b)`.
- Non-blocking, recorded for follow-up:
  - The feed is about 30 KB per distinct heavy trader. Load a pane's chart data on its first swipe, as the engineer proposed.
  - The exclusion copy reads "2 imported trade(s) excluded". Pluralize it properly, here and in "position(s)".
  - The pane header reads "bl_h6@bl_h6" when the name equals the handle. Show the handle once.
  - One heavy import (and one I had abandoned) ended `failed: vendor` without my tick and with nothing in my server log. It did not recur in 9 further imports. Most likely another session's process advanced my import against its own vendor fake through the shared database. This is environmental, not a product defect.

### Definition of done

F-1 meets the owner's definition of done once the duplicate line is deleted, pending only the owner items:
- **The profile is clear and readable:** 4,700 closes, losses visible, future dates excluded and explained.
- **The UI is clean and intuitive:** the trader never waits on a zero, and the feed draws long records at screen resolution and stays fast.
- **The connector works** against the fake under heavy load, with the quarantine and per-step deadlines.

It is "working" against the real vendor only after one test-mode connection, which needs #4. #7 (cron every minute) and #13 (automatic load runs) are the owner's to set. Nothing else stands between F-1 and done.

### Demands

1. **Engineer:** while the headline counts activities, do not render the "N activities imported" line. *Verify:* an e2e at 375 px finds one visible count during paging, and the line returns once closes show.
2. **Owner:** #4, #7 (every minute), #13.

Demo sentence: "Connect your broker, watch ten thousand trades arrive, and your whole record, losses included, is live in a minute."

COMPLIANCE: PASS · USABILITY: DEMANDS (1: delete the duplicate activities line while the headline counts; owner items #4, #7, #13)

## Round 4

2026-10-23. Tested the existing `CI=1` build of `9f1013c` (no app or lib file is newer than the build; the `pane-chart` route is in it) on port 3102, with the vendor fake on 4182. Phone viewport 375 px, light and dark. For the pane, I also throttled the network (1.6 Mbps, 150 ms) and the CPU (4×). I ran no tick. I created 28 test traders through the real connect flow and deleted all of them afterwards. Other sessions share the database.

### My demands

1. **Duplicate activities line: met.**
   - 2 accounts × 2,500 activities, fake at 2.5 s per page. A recorder logged every visible banner line on every DOM change.
   - While counting, exactly one count is seen: "Importing your record · 0 → 1,000 → 2,000 → 2,500 → 3,500 → 4,500 → 5,000 activities read from your broker". The first count shows at 4.6 s, and zero is never visible for 5 s.
   - From the first close, the banner reads "Importing your record · 2,358 closed trades so far", with "5,000 activities imported" below it. That is two different numbers, so it is not a duplicate. Then it reads "Import finished.", and the banner is gone at 36 s.
   - Screenshots: `import-counting-*` and `import-closes-*`.
2. **Feed weight with 10 or more distinct heavy traders: met.**
   - I imported 12 traders through the UI. Each had 2 × 2,500 activities (about 2,400 closes) plus 5 fresh closes.
   - `/` shows 50 cards, and 49 of them come from **11 distinct heavy traders**. The page is **329 KB raw, 24 KB gzipped**. Round 3 measured 535–558 KB with only 6 distinct heavy traders.
   - This matches the engineer's 322 KB. Before any pane opens, no chart is fetched.

### The pane: stand-in and swap

- **Instant: yes.**
  - On the throttled phone, the swipe settles in 240–340 ms, and the full chart replaces the stand-in 310–410 ms later. One request of about 28 KB per trader comes back in about 300 ms.
  - The header, the label ("2,425 trades, ≈-100% total…") and the line's bounding box are identical before and after. Only the line's grain sharpens, from 78 points to 372.
  - Tapping 1Y before the load shows the range's own numbers with "Loading the chart…", then the full line.
- **Honest: yes.**
  - The stand-in is the same record at a coarser grain, with the same low, high, ends, numbers, Verified badge and stats.
  - No figure changes at the swap, so nothing reads as a correction.
- **No JS: acceptable.**
  - The pane shows the stand-in line with 0% on the axis, the same header and label, Verified, win rate and average return, and the last 5 trades.
  - Two controls do nothing without JS: the range tabs, and the "Drag across the chart…" hint, which is boxed like an input. This is not new and not blocking.

### Copy fixes: met

- "40 earlier positions excluded" / "51 earlier positions excluded": no "(s)" anywhere in the feed or the profile.
- When the name equals the handle, the card and the pane show "@bl4_g3" once.

### Environmental, not product

- Two of my slow imports failed (`failed: vendor`, and one marked connected at a future clock time). Both happened while another session's e2e suite was running. Its tick tests call `POST /api/sync` unscoped (`e2e/connect.spec.ts:96`), which advanced my imports against its own fake.
- The same import, run in a quiet window, was clean.
- The owner still saw an honest state: "The import did not finish, so this record may be incomplete. Try again".
- This confirms the engineer's known limit: run e2e on its own database.

### Non-blocking, for follow-up (taste)

- In the pane, the "0%" axis label sits on the line when the record starts near 0. Give the label a background chip or offset it.
- Without JS, hide the scrub hint and the range tabs, or make the tabs links.
- At 50 distinct heavy traders, the projected weight is about 560 KB (not measured). This is the owner's call, as recorded.

### Definition of done

F-1 now meets the owner's definition of done, pending only the owner items.
- **The profile is clear and readable** at 2,400–4,700 closes. Losses are visible, future dates are excluded and explained, and the plurals are right.
- **The UI is clean and intuitive.** After connecting, the trader sees one climbing number and never a long zero. The feed carries 11 distinct heavy records in 329 KB. A swiped-open pane sharpens in about a third of a second, and none of its numbers change.
- **The connector works** against the fake under load, with honest failure states.
- Three owner items remain:
  - #4: one real test-mode connection. Until it happens, "works" means "works against the fake".
  - #7: the cron every minute.
  - #13: the automatic load runs.
- Nothing else is open on my side.

Demo sentence: "Connect your broker, watch ten thousand trades arrive, and your whole record, losses included, is live in a minute."

COMPLIANCE: PASS · USABILITY: PASS
