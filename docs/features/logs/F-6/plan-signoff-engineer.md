# F-6 plan sign-off: engineer

**SIGN.** All 13 of my round-1 demands are in plan.md, either accepted or resolved further: demand 5 now drops the combined
win rate entirely, which I prefer. Dropping the third grid for one combined line is simpler and still meets AC2, and
TR-4 prominence is carried by the unrealized grid at `.stat big`. I checked the built feed read (lib/feed.ts
`openPositions`/`openOf`, commit b424b01). It runs in the existing `Promise.all` on the `recordStates` id set and keeps
only `onPage` traders that are connected or failed. It is additive and reads no viewer table, which matches demand 6.

The build notes below change nothing in the plan. Each one is a check I will hold the build to:

1. **Pane combined line.** It is computed from `page.byUser.get(id)` (the full record that `paneSummary` already reads),
   never from `recent`. Test: the e2e pane's combined value and N equal the profile's for `f6_mixed`.
2. **The open list keeps today's rendering when the state is importing.** No sub-line and no tone change while
   `open` is null. That keeps the importing profile's HTML identical to today, apart from nothing. Test: an e2e
   check on `f6_importing`'s profile finds zero `[data-open]` and an open-list row class that is still `up`/`down`.
3. **Load timings.** The PR records `LOAD=1 node --test lib/feed.load.test.ts` before and after b424b01, run on the
   same machine, with no budget raised.
4. **Line budget.** If non-test lines go past 400, the split follows §9 exactly. PR-2 (/t, compare, /how) does not
   start until PR-1 is merged, so `OPEN` copy and `lib/open-split.ts` are not edited in two branches at once (the
   F-4 share-card session reads them too).
