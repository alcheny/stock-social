# F-4 PR-2 review (independent reviewer, 2026-10-25)

Scope: `git diff dab09f7 HEAD -- . ':!docs'` on `autopilot/feature-4-card-model` (HEAD `28c9488`). Product files:
`lib/record-card.ts` (new), `lib/card-glyphs.ts` (new), `lib/copy.ts` (+36), `lib/story-image.ts` (re-export). Tests:
`lib/record-card.test.ts`, `lib/record-card.test.ts.snapshot`, `lib/card-glyphs.test.ts` (all new). Checked against
the main-tree `docs/features/F-4-share-card.md` (with the 2026-10-24 negative rows), `plan.md` PR-2 with both sign-offs
and the O1 amendment, CLAUDE.md product rules, POLICY and COMPLIANCE §1. Database `stock_social_f4` only. Port 3000,
`stock_social` and the main checkout were not touched. The build ran in a scratch copy, which was then deleted. No
reviewer fixes: nothing in the worktree changed except this file.

## Findings

No blocker.

- non-blocking (carry to PR 3 or the owner): a frozen record (every connection disconnected) keeps
  `state = 'connected'` (`lib/sync.ts:318` sets only `disconnected_at`). With no closes, or with unverified closes, the
  badge reads "Broker connected" in up, even though `frozenEnd` is set. This is the existing `shareCardText` meaning,
  and the plan's §5 states table does not cover a frozen record. Verified records are unaffected: their badge reads
  "Verified from broker", which is correct (F3a: broker-sourced).
- non-blocking (style): the alt prefix is built as
  `profileCardAlt(handle, shareCardText({ state: 'none', … empty: true }))` (`lib/record-card.ts`, near the end of
  `recordCard`). It uses a fake record state only to get the prefix with no label. A plain prefix string would say the
  same thing more directly. The behaviour is correct, and U14 tests it.
- non-blocking (PR body, `pr2-body.md` Known limits): in the 1,000-bet row, "(the line ends at "≈−100.0%")" sits in
  the trust-line column. It describes the chart, not the trust line.
- non-blocking (snapshots): the snapshots pin chart geometry to one decimal and `end`, `min` and `max` at full float
  precision. PR 3 tunes the plot heights, so it will regenerate them. Its reviewer should read the snapshot diff, not
  just accept `--test-update-snapshots`.
- checked, OK:
  - **Owner decisions:**
    - one headline, the average return per trade, coloured by its printed sign; no win-rate field or string;
    - "likely between" from K ≥ 5, kept when too early by width; "95%" and "confidence" never appear;
    - all 10 trust cells match the owner's table word for word, including both 2026-10-24 negative rows;
    - direction is read from the printed range;
    - "consistent" appears only in the strong tier with the range on one side of 0, for losses as for gains;
    - the D/M/Y floors hold, and "0 years" can no longer print (M1);
    - the evidence pill shows the tier only;
    - period "Record since ‹Mon YYYY› · ‹N› months" in UTC, with "under a month" and "1 month"; a frozen record ends at
      its disconnect;
    - no per-trade data: the model's keys are fixed, and no symbol, time or holding period appears in any string or in
      the JSON.
  - **Budgets:** model build at 10,000 closes is under 200 ms (tested; about 12 to 27 ms measured); chart points stay
    ≤ 400, with the minimum and maximum drawn at the plot edges; product lines are +284 / −3 = 287, inside both the
    plan's 280–330 and the 800 cap.
  - **Tall count:** 47 px instead of the plan's 46, disclosed: 46 × 375 / 1080 = 15.97 misses the plan's own 16 px
    floor.
  - **Policy:**
    - **F3:** the disclaimer is a required model field in every state.
    - **F3a:** "Verified from broker" only for a connected, all-verified, non-demo record with closes. The alt can no
      longer say Verified when the badge doesn't (state `none` with closes is tested).
    - **F3b and F2:** the reader, banned and PROMO scans cover every cell at K = 1 and K = 12,345, every fixture's
      strings and the alt; the new copy is also in the `allCopy` walk.
    - **F4 and TR-9:** a mirrored losing record gives the same model apart from colour tokens, signs and the cell;
      U+2212 throughout.
    - **A1:** every token ≥ 4.5:1, computed; up and down are within 1.5 of each other; the alt carries every visible
      string plus the chart sentence.
    - **P3:** percentages only.
    - **T1:** no third-party marks. "Geist" appears only as the file name of the font Next.js bundles
      (`@vercel/og`), describing an integrated vendor's asset.
    - The caption "Return if every trade were the same size" already appears on main (`app/u/[handle]/chart.tsx:133`);
      it is a hypothetical, not a completeness claim.
  - **O2:** not ruled on. It is pinned and disclosed:
    - `record-card.test.ts` "tester fixtures" asserts the exact strings for the 200-bet fixture (+15.0%,
      "likely between −13.3% and +3.8%", "no clear pattern") and the 1,000-bet fixture (+2.5% in up beside
      "−4.8% and −0.8%" and "consistent losses", line in down);
    - `pr2-body.md` Known limits quotes them and correctly says the 10,000-trade row was reproduced, not tested. I
      reproduced that row too: "0.0%", "likely between −0.13% and −0.02%", "…A long record, with consistent losses.";
    - the headline method is unchanged (arithmetic, as on the profile).
  - **Snapshots are justified.** Criterion 10 and the plan require JSON model snapshots of winning, losing and empty.
    They add to the behavioural asserts and replace none of them: every state's badge, body, disclaimer and null
    fields are asserted directly in U10/U11; parity in criterion 7; geometry in criteria 1 and 10 and U-4. They are
    deterministic (fixed `NOW`).
  - **Glyphs:** `CARD_GLYPHS` (112 ranges, 726 code points, no duplicates) is identical to the charset FreeType
    reports for `node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf` (`fc-query --format=%{charset}`). This
    is independent of the test's own cmap reader, which agrees.
  - **My fuzz, 3,000 random records** (0 to 400 trades, every state, demo, frozen, spreads up to ±80%), 0 violations:
    - disclaimer and badge always present; Verified matches the F3a rule in the badge and the alt;
    - every string is covered by the font; no NaN, null, hyphen-minus or "0 days/months/years";
    - points ≤ 400; the baseline lies inside the plot;
    - the trust cell never contradicts the printed range's signs.
    All 10 cells, too early, failed, empty and importing were reached.
  - **Rules:** no test weakened or deleted (the diff only adds test files); count 641 → 666. No schema change. No
    protected path (CODEOWNERS). No route, dependency, vendor, font or network change. `lib/story-image.ts`
    re-exports `FORMATS`/`parseFormat`, as planned.

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` with `DATABASE_URL` from `.env` (`stock_social_f4`) | 666 tests: 654 pass, 12 skipped (LOAD), 0 fail |
| `npm test` at `dab09f7` (base count) | 641 tests |
| `node scripts/autopilot.ts guard main` | `guard: ok` |
| `node scripts/compliance.ts diff origin/main` | `compliance: ok` |
| `env -u CLAUDECODE -u AI_AGENT CI=1 npm run build` (scratch copy, stdin closed) | exit 0 |
| Product lines (`':!docs' ':!*.test.ts' ':!*.snapshot'`) | +284 / −3 |
| `CARD_GLYPHS` vs FreeType charset of the bundled font | identical, 726 code points |
| Committee round 2 | business lead PASS/PASS, ready to merge; UX lead PASS/PASS |

Not run: e2e. No route reads the model yet, so PR 3 covers the rendering checks: pixels, 375 px, U13, and the
O2 render.

## Verdict

APPROVE
