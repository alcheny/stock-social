# F-21 committee log, 2026-11-02

Build session for F-21 (`docs/features/F-21-exclusion-counts-beside-the-headline.md`), branch
`claude/f21-exclusion-counts`, under the owner's instruction of 2026-11-01 (develop autonomously; open questions decided by
the committee's recommended option). Blockers F-23 (#97, ca34767) and F-24 (#84, bdf3ea9) are on main.

## Round 1
- UX lead: `plan.md` (12 points, open questions Q1–Q8).
- Business lead: DEMANDS D1–D6. Engineer: DEMANDS E1–E9.

## Round 2 decisions (each appended to the feature file)
1. **Q1 → A.** The sum includes option exclusions in both gate states, as cycle 5 decided. The existing re-signed option
   count lines move, word for word, into the profile's `#excluded` section in both gate states. The AI legal committee's
   sign-off on showing the short and technical lines while the gate is closed is **blocking before the PR is called
   done** (E5 over D-Q1's "record it").
2. **Q2: the shared-account reason line reads "‹n› trades excluded: the account is part of another profile's record."**
   It merges the two demands: "trades", because the count includes option closes (E2), and "the account is part of", which
   puts no blame on the trader (BL).
3. **Q3:** "· reasons on the profile". **Q4:** no `PAYLOAD_V` bump; a missing `excluded` field reads as 0. **Q5:** the
   owner runs `scripts/rebuild-records.ts` once after deploy (an owner step in the build log). **Q6:** the disclaimer is
   never moved; the slot lines are compacted first, and the slot goes back to the council if that is not enough. **Q7:**
   stays open for the owner; F-21 changes no card or image. **Q8:** the `Blocked:` line was cleared at the start.
4. **`excluded_shared` is written once, in `rebuildRecord`** (`lib/options-sync.ts`), after its last step and in the same
   transaction (E1):
   - the share part counts SELL rows in marked accounts under the stream's paper, future, storedFirst and notDuplicate
     filters, leaving out OCC option pairs;
   - the option part runs `matchOptions` over the marked-account option rows (`trades.length + short + other`);
   - a test checks that an OCC row in a marked account is counted once.
5. **`excluded_future_sells`** comes from the same future-count query (`count(*) filter (where side = 'SELL')`), in the
   same transaction; it is disjoint from the shared count.
6. **The guard (E3):**
   - public reasons come from an exported `PUBLIC_REASONS` const with `count` typed `(k: PublicReason)`;
   - option causes come from the runtime `CAUSES` array;
   - `MatchResult` and the options result types use an anchored source scan that must also find the known keys, plus an
     explicit camelCase→column map;
   - schema columns come from the `columns()` parser in `lib/privacy-fields.test.ts`, plus an `information_schema` check
     when `DATABASE_URL` is set;
   - the mutation check runs in the test: a dummy key in each source makes it fail;
   - no TypeScript compiler API.
7. **Reason lines as data (E4):** `exclusionReasons()` returns `{ key, n, text }`, and a test checks that the summed `n`
   values equal `exclusionTotal`. Only closed shorts are counted. Exercise shares are named once (the existing either/or
   logic of `OPTIONS.technical`).
8. **Known double count (E6):** an OCC sell counted under corporate or held stays counted there and also under options.
   It gets a test that pins today's behaviour, a ponytail note at the place, and an owner flag in the PR.
9. **Feed cost (E7):** the counters ride a user query the feed page already makes, or exactly one new query per page,
   asserted in a test.
10. **Disclaimer (D1):** in the open-positions order the line sits between the stats and the disclaimer. The e2e checks
    that the disclaimer's bottom is ≤ 740 at 360×740 in both orders, with a fixture whose line wraps to two lines.
11. **Copy (D2, D3):**
    - tests assert held text only through `PROFILE.excludedHeld(n)`, never the literal, so the fixes-cycle5 wording lands
      unchanged;
    - a copy test forbids "hidden", "removed", blame words and `all|every|complete|any broker` in the F-21 copy;
    - new copy is limited to `EXCLUSIONS.line`, `EXCLUSIONS.title` and `excludedShared`.
12. **e2e (D4, E8):**
    - the section's reason lines sum to the heading's count in both option-gate states;
    - `model.excluded` is asserted through `GET /u/<h>/pane?v=2`, and the lazy pane is rendered only where reachable;
    - contrast: the computed colour equals `--muted`.
13. **Scope and size (D5, E9):**
    - **one PR with layered commits** (counters and guard first, then the surfaces), so the F-29 slot builder can rebase
      on the first layer;
    - the move out of `options-block.tsx` is its own commit, with no other edits to that file;
    - the diff size is reported in the PR.
    - Why not two PRs: the owner's instruction of 2026-11-02 is to finish the assigned work to one open, green PR and then
      pause, and the council's budget concern is met by reviewable layers.
14. **PR (D6):**
    - a full `## Compliance` section;
    - the four mutation failures pasted;
    - 360 px screenshots, light and dark, of the pane in the open-positions order.

## Sign-off
Business lead and engineer: their demands are adopted above (the business lead's Q2 wording merged with the engineer's
unit). Re-review at the build verdict.
