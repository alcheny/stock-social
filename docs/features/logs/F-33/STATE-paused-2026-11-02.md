# F-33 state when paused by the owner (2026-11-02)

Branch `claude/f33-ranking-evidence`. No PR is open. Feature file Status: building.

## Done
- Committee plan (round 2 agreed), build 1 + build 2 (review fixes) + build 3 (QA fixes `9f9e05d9`): one ranking weight
  (`lib/rank-weight.ts`, moderate tier, 1-point floor, near-edge on the simple-return pace interval), cache key with
  `RANK_FORMULA`, section order weight then id, zero width prints "Too early to tell" everywhere from one producer,
  /how text, F-15 readout counts-only line with an EXPLAIN rows-read test. Records: `plan.md`,
  `committee-2026-11-01.md`, `build.md`, `qa.md`, `qa/`.
- Last verified gates (before build 3): tsc clean; `npm test` 2,431 tests, 0 fail; guard ok; compliance ok (with the
  container-only `node_modules/@img/sharp-wasm32` set aside: not in the lockfile). Tester's full Playwright run on build
  2: 356 pass, 3 fail (F-33 caused); build 3 targets those 3.
- The WIP commit includes a merge of origin/main (F-16/F-17 among it), with conflicts resolved in
  `app/u/[handle]/page.tsx`, `lib/feed.ts`, `lib/record-tools.ts` and the feature file; tsc is clean on it.

## Next (on resume)
1. Re-run the gates on the merged tree: `npm test`, `BASE_REF=main node scripts/compliance.ts auto`,
   `node scripts/autopilot.ts guard origin/main`, `npm run build`, then `e2e/fixes-labels.spec.ts`,
   `e2e/fixes-cycle2-a11y.spec.ts`, `e2e/thesis-safety.spec.ts`, `e2e/section.spec.ts`, and the full `npx playwright test`.
2. If green: tick the ACs, set `Status: built` with a Build log line, open the PR (draft body ready in the orchestrator's
   notes: What changes, Decisions, Testing, Compliance, Known limits, Owner items) labelled `feature`.
3. Skipped by the owner's token pause: the leads' 360 px user test (the tester's 360 px screenshots stand in).
4. Owner items to put in the PR: identical-return records print "Too early to tell" yet weigh through the floor
   (30 × +5% = 1.39 vs the 200-bet record's 0.30; 40 × −100% = 29.9, the weight is linear and unbounded); the section's
   new-record slot (fewest closes) and id tie-break; the F-2 mixer tail when every weight is 0; OD 2.34.
5. Scheduled follow-ups: OD 2.32 card wording ("average per trade so far, likely between X and Y"); OD 2.32 range rule on
   the ticker baseline, recap, trade-share and tools surfaces.

Workspace note: e2e runs regenerated ~105 PNGs under `docs/features/logs/F-2/screenshots/`; they are not committed and
should be restored from git before resuming.
