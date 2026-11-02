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

(appended as each step completes)
