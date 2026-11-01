# F-13 committee, 2026-11-01

Members (fresh-context subagents): UX lead and accessibility specialist (plan: `plan-ux-a11y.md`), business lead and
engineer (reviews). Open questions are decided by the committee's recommended option; where the reviewers differed,
the ruling and reason are given.

## Open questions decided

| # | Question | Decision | Reason |
|---|---|---|---|
| 1 | Line lifetime | (a) Show on signed-out page-1 loads until dismissed | The acceptance text; (b)/(c) hide it before it is read (all three members) |
| 2 | Pre-paint script | (a) In `app/layout.tsx`, carrying the request nonce (`x-nonce`, for the CSP PR), `suppressHydrationWarning` on the script, client part starts "shown" (`useSyncExternalStore`) and re-applies the flag in `useLayoutEffect` | No layout shift for first or returning visitors; works without JS; the layout is already dynamic (it reads cookies) |
| 3 | Dismiss control | (a) Quiet × named "Dismiss", 44 × 44 px, with its own `.first-visit .quiet-x` rule (the existing one is scoped to `.signin-line`) | House pattern, least weight |
| 4 | Demo placement | (a) Badge plus the existing sentence beside the line while any card on the page is demo | Holds for a mixed feed; the D27 sentence is unchanged |
| 5 | Hint signed in | (a) Yes, a device first run for everyone | SW-1 wording |
| 6 | Hint lifetime | (a) Until the first swipe or → key | The acceptance text; no counter |
| 7 | Privacy page mention | (a) Owner note in the PR: two UI flags in device storage, no identifier, never sent to the server, no cookie | The cookie table and its test keep their shape |
| 8 | F-7 interface | Nothing to build; the PR repeats the condition | Decision of 2026-11-01 |

## Blocking demands accepted (business lead)

- F1. At 360×640 and 320×568, signed out, fresh context: the first card's symbol, its return and its Demo badge are in
  the first viewport (e2e). If not, tighten the line block (padding 64 → 56, or the badge inline with the line).
- F2. After one scroll to the first card, "Swipe ← for profile" is in the viewport (e2e).
- F3. Banned-word checks use word boundaries.
- F4. Scope: one JSX line in `app/page.tsx`, new files, and CSS only in the `F-13` block (`.first-visit`, `.swipe-hint`,
  `html[data-ss-seen]`, the nav reflow rules).

## Engineering conditions accepted

- The dismiss focus target is a `data-first-card-link` attribute set by `feedRowNodes`, not a structural selector.
- The hint listener removes itself after it fires; appended pages never carry the hint (`offset > 0`).
- The nav rename ("Trades by stock") needs the reflow rules so the nav does not overflow at 320–390 px and stays ≤ 56 px
  tall; the one e2e that uses the old name (`e2e/app.spec.ts:713`) changes its name.
- A test asserts the line is neither `position: fixed` nor `sticky`.
- Run the whole e2e suite at the end (the line adds a snap stop on signed-out page 1).

## Non-blocking, deferred

- "→ for profile" for a fine pointer (desktop): later, the acceptance text is verbatim now.
