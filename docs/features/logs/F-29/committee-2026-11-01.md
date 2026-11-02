# F-29 committee record (2026-11-01, resumed 2026-11-02)

Feature: docs/features/F-29-gated-options-wording.md. Plan: docs/features/logs/F-29/plan.md (UX lead).
Run under the owner's instruction of 2026-11-01. Open questions are decided by the committee's recommended option
after debate. Each member is a fresh-context subagent, and none grades work it wrote. Paused 2026-11-01 for the weekly
usage limit and resumed 2026-11-02 on main ca34767 (F-23 #97 merged). Owner context at resume: OD 2.63 is accepted, so
options stay gated until the owner approves an amended scope line as a new consent version, and the interim /how words
apply meanwhile.

## Planning debate

| Round | UX lead | Business lead | Engineer |
|---|---|---|---|
| 1 | Plan drafted (D1 to D9) | DEMANDS B1 (D6 rereads decision (b): give the card its count line as written; stop test at 360x740), B2 (the AC 7 test enforces the sign-off; D8 wording: the words are already signed), B3 (AC 9 share part "not applicable by design", unticked), B4 (D5 fallback as a named e2e) | DEMANDS E1 (`'use client'` files can't import options-gate.ts, which pulls node:crypto; new pure module), E2 (keep the `paneSrc` template pinned by pane-model.test.ts), E3 (filer `no-store` first, after both 404s), E4 (`ariaSnapshot`, not the removed accessibility API; define the figures block), E5 (scope the per-card count), E6 (CDN window in Risks; static /how source check), E7 (AC 9 share part covered by the URL key only) |
| 2 | Adopted all 11 (plan § Round 2 answers) | SIGN | DEMANDS: the card line shows gated text only (`!isOptionsLine`); its own class (not `.options-gated`); name the first-screen tests and check 360/320 in view |
| 3 | Adopted all 3 (plan § Round 3 answers) | (signed) | SIGN |

## Decisions (committee's recommended option)

- D1: the signed interim words go in a new additive copy block, verbatim. `OPTIONS.how` (the legal sentence) is kept for
  the open gate and stays pinned by its existing test.
- D2: /how picks its options paragraph from a pure component that takes `open = optionsPublic()`. /how stays static,
  because a gate flip is a code change and a deploy.
- D3: the cache key `g=o0|o1` comes from `lib/gate-key.ts` (no server-only imports) and is appended to the pane JSON,
  the story image and the opengraph-image URLs. The /pane and /story routes answer `no-store` when `g` is missing or
  stale. Filers stay `no-store`.
- D5: in the pane, the qualifier sits at the end of the headline figures block, before the count line, and is tied to
  the figures by reading order. `aria-describedby` was rejected because the feed reuses one pane element, so ids would
  repeat. The F-21 and F-34 lines go above it once built (ponytail). Fallback rule: the disclaimer must stay in view at
  360x740, as a named e2e.
- D6: the feed card shows one qualifier (in its strip) and one count line under the strip, as decision (b) says. The
  card line shows gated text only, with its own class. Stop rule: if the disclaimer, the qualifier or the count line
  leaves the first screen at 360x740 or 320x740, the build stops and the question goes to the owner or council.
- D8: the words were signed at approval council cycle 5. No placement here needs a re-sign
  (docs/features/logs/F-29/legal-signoff.md). The AC 7 test fails on an unmatched "Pending re-sign:" line.
- AC 9: the share part is "not applicable by design". Share images carry the qualifier in both gate states, so their
  bodies are rightly identical. It is covered by the URL key only, left unticked, and its wording goes back to the
  design session.

## Build, QA, user test and review

- Build (engineer, tests first): lib/f29-gated-wording.test.ts and e2e/f29-gated-wording.spec.ts were written first, then
  the implementation. Neither stop rule fired. At 320x740 the pane's disclaimer is below the fold both before and after
  the move; AC 10 asks only for reflow at 320.
- Code review (docs/features/logs/F-29/review.md): one Blocking finding. B1: once the gate opens, a short-only record's
  open line ("Short options not shown: ...") reached the feed card. Fixed: `cardOptionsLine` returns nothing while the
  view is open, with a unit test for that case. N1 (the share preview had no gate key) is fixed too. N2 to N4 are
  carried to the PR.
- Container restart mid-QA: the tester's full run was lost and re-run.
- User test at 360 px (business lead, UX lead), from docs/features/logs/F-29/qa/:
  - Both leads: the pane's "Excluding options" sat about 16 px under the figures but only about 4 px over the count line,
    so it read as the count line's heading (business lead Low 2, UX lead Medium 1). Fixed: the label now sits 6 px
    under the figures with 8 px below it. The e2e checks gap ≤ 8 px and that the gap below is larger.
  - Business lead (Blocking 1): the count line's "Option results aren't shown on this record." can read as this trader
    withholding; they propose "any record yet". Committee decision: not changed in this build. That sentence is the
    options committee's signed `OPTIONS.gated` copy. F-29's signed words cover only /how and the qualifier, the feature
    routes the count line's wording to the options and legal committees (Out of scope, C4-8), and the rule "any change
    needs the committee's re-sign" binds the builder. The sentence is literally true for every record and does not
    contradict /how. Routed as an open question to the legal committee and the owner (feature file, Open questions;
    PR, Owner items).
  - Low, recorded for later builders: on the pane the qualifier sits below the figures (D5), on the profile above them
    (D4), for F-34 to align; the pane's figures are below the fold at 360 (the agreed bar is met); the card count line
    has no "How options are counted" link, like the pane, for the next copy pass.
- QA (docs/features/logs/F-29/qa.md): full Playwright 358 passed, 6 skipped, 1 failed (fixes-labels.spec.ts:242,
  pre-existing on main; the 7 tests after it in that file pass when run alone). One Medium finding: M1, in the real
  pane at 360x740 the moved qualifier fell below the fold while the tiles showed. D5 fallback: the UX lead and the
  business lead both ADOPT. The label goes back directly before the headline stats, with a real-pane e2e at 360 and 320
  (the label is in view whenever a tile is) and a ponytail for the F-34 builder. This also resolves both leads' Low
  pane-versus-profile mismatch, and the spacing rule is dropped. The business lead accepts routing Blocking 1 on the
  condition that the open question states it unresolved, with the proposed wording; the feature file now does.
  Low findings carried to the PR: case-sensitive counts, /how built as dynamic (no-store) rather than static, the
  opengraph routes ignoring `g` (same image either way), and the profile description's double full stop (pre-existing).
