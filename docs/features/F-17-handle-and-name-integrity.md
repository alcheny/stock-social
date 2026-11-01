# F-17 · Handle and name integrity: reserved handles, rename hold, display-name rules

Status: blocked
Blocked: waits for F-9 to merge (PR #65, `claude/fix-user-text-safety`) with F-9's acceptance criteria met on main (its normaliser and `checkDisplayName` in `lib/handles.ts`)
Start conditions: F-9 merges first (its normaliser in `lib/moderation.ts` is reused). Security hardening (#42, which
edits `lib/auth/attempts.ts` and `app/auth/actions.ts`) has merged (ea7cd52).

## Why
There is no reserved-handle list. A rename frees the old handle at once (`lib/auth/attempts.ts`), so a forwarded link
or card can land on a stranger. Display names can carry check glyphs, the word "Verified", direction-control
characters and look-alike letters. POLICY U2 lists reserved handles as a launch prerequisite. This feature builds
cycle 1's C9 (trimmed), the business council's BC-2 reserved handles and rename hold, and the design system's DS-31.
Approved by the approval council (`docs/ideas/approval-2026-11-01-cycle2.md`, K2: second-vote mean 3.80, final vote
15/15).

## Decisions
- 2026-11-01: A reserved-handle list holds only generic and own-product words: product, staff, generic and route
  words such as "support", "official", "admin", "help", "security" and "verified", and the product's own name. No
  third-party company, broker, platform or person name appears in the list, tests or fixtures. Why: approved by the
  approval council (cycle 2); POLICY T1, T2 (veto condition: DK, LG, CS).
- 2026-11-01: Look-alike checks run only against reserved, demo, connected and F-7 public-profile handles, exactly as
  cycle 1's C9. F-7 handles are checked at runtime, never listed in the repo. Why: approved by the approval council
  (cycle 2) (veto condition: DK, CS).
- 2026-11-01: Display names are normalised with F-9's normaliser (`lib/moderation.ts`): NFKC, direction controls
  stripped. They refuse check glyphs and seal glyphs and the whole words "Verified" and "Official". There is one
  normaliser, no second confusables map and no new dependency. Why: approved by the approval council (cycle 2); DS-31;
  POLICY F3a, C2 (veto condition: DK, LG).
- 2026-11-01: Display-name word rules match on word boundaries, so a name that merely contains those letters inside a
  longer word is accepted. Why: approved by the approval council (cycle 2); red team case on false rejections.
- 2026-11-01: A rename holds the old handle so it is not reissued. At most one rename per 30 days per account. At most
  one held handle per account: a new rename releases the older hold, and the holder can rename back. Why: approved by
  the approval council (cycle 2). The red team showed an uncapped hold lets one account squat hundreds of handles.
- 2026-11-01: A hold stores only the handle string and a release date. It lasts at most one year (DESIGN TR-5;
  `lib/delete.ts` already uses 365 days). It never blocks profile deletion and never resolves to a deleted person's
  data. Holds are released by the same path on account deletion. Nothing is retired forever. Why: approved by the
  approval council (cycle 2); POLICY P6; deletion decision 2026-11-01 (veto condition: DK, LG).
- 2026-11-01: The old path returns a neutral "This handle is no longer in use" page with a 404 status and its own
  title. It shows no profile content and no link to the new handle. There is no 301 rename machinery. Why: approved by
  the approval council (cycle 2); LG, RT, A11Y (no 301: veto condition: CS).
- 2026-11-01: Each rejection names its rule in plain words next to the field, tied with `aria-describedby` and
  `aria-invalid`, and is announced on submit. Sign-up and rename use the same message pattern. No personal data goes
  into rejection logs. Why: approved by the approval council (cycle 2); A11Y, UX, PD; POLICY P3 (rule named: veto
  condition: DK, CS; logs: veto condition: LG).
- 2026-11-01: The privacy groundwork's D22 block stays: while the product is closed, nobody may rename onto a listed
  handle. Why: approved by the approval council (cycle 2) (veto condition: DK).
- 2026-11-01: Nothing is deleted by this feature. Why: approved by the approval council (cycle 2); POLICY H (veto
  condition: DK).
- 2026-11-01: Sequencing: starts after #42 (merged as ea7cd52) and F-9 merge, because the display-name check reuses
  F-9's normaliser. If F-9 has not merged by the next approval council, this approval lapses to that council. Why:
  approved by the approval council (cycle 2); every member's condition (veto condition: DK, CS); the F-9 dependency
  was made explicit after the orchestrator's review.

- 2026-11-01: Lapsed at approval council cycle 3 (F-9 had not merged) and **re-approved by the approval council,
  cycle 3** (`docs/ideas/approval-2026-11-01-cycle3.md`: second-vote mean 3.93, final vote 15/15). Every decision above stands word for word, including the
  neutral 404 for an old handle with no 301 and no link to the new handle; the round-5 suggestions to redirect an old
  handle are not adopted because they contradict that decision. It is built as rework on top of
  `claude/fix-user-text-safety` once it merges with F-9's acceptance criteria met on main. If it has not merged by the
  next approval council (cycle 4), this approval lapses to that council. Why: approved by the approval council
  (cycle 3); lapse rule; DK, LG, CS, TS, PD.
- 2026-11-01: Exactly one normaliser: the one on that branch (`checkDisplayName` in `lib/handles.ts`, built on F-9's
  normaliser) is used by sign-up, rename, display name, search and reports, with a test that every caller imports it.
  A confusables test set covers mixed scripts, zero-width characters, bidi overrides and full-width or case folds.
  Why: approved by the approval council (cycle 3); red team (two normalisers are a bypass) (veto condition: CS).
- 2026-11-01: A rename changes every handle-keyed share image, card and cache key, so no card or image is served under
  a freed or held handle. Rejection messages name the field and the rule in visible text, use `role=alert` and move
  focus to the field. Why: approved by the approval council (cycle 3); RE, EN, A11Y, UX.

## Acceptance criteria
- [ ] The reserved list (new `lib/handles.ts`) contains only generic and own-product words; the compliance scanner and
      a test find no third-party or person name in it, its tests or fixtures (veto condition: DK, LG, CS).
- [ ] Sign-up and rename refuse every reserved handle and a look-alike of a reserved, demo, connected or F-7 handle
      (unit test per class).
- [ ] A db test renames one user 50 times in a loop: the second rename within 30 days is refused, and at most one hold
      row exists for that user.
- [ ] A new rename releases the older hold, and the holder can rename back to its held handle (db test).
- [ ] A hold row stores only the handle string and a release date, at most one year out. `deleteProfile` leaves no
      orphan hold linked to the person, and a hold never blocks deletion (db test) (veto condition: DK, LG).
- [ ] The old path returns 404 with a neutral "This handle is no longer in use" page, its own title, no profile content
      and no link to the new handle (e2e).
- [ ] Display names: NFKC applied, direction controls stripped, check and seal glyphs refused, whole words "Verified"
      and "Official" refused (unit tests, including a bidi name) (veto condition: LG).
- [ ] A name that contains "official" only inside a longer word is accepted (unit test).
- [ ] The display-name check calls F-9's normaliser; a test fails on a second confusables map (veto condition: DK).
- [ ] Each rejection names its rule beside the field, with `aria-describedby` and `aria-invalid`, and is announced on
      submit. An e2e checks one reserved-handle and one bidi rejection on sign-up and on rename.
- [ ] Rejection logs hold no handle attempt tied to a person, no email and no display name (log scanner test) (veto
      condition: LG).
- [ ] While the launch gate is closed, a rename onto a listed handle is refused (test).
- [ ] The PR answers COMPLIANCE §1 Q2 (fields, location, visibility, deletion).
- [ ] Any limit the build leaves is marked in code with a `ponytail:` comment naming the limit and its next step, and
      the PR's hand-off note lists it.
- [ ] A test fails if any of sign-up, rename, display name, search or reports normalises text without importing the
      one normaliser.
- [ ] The confusables set (mixed script, zero-width, bidi override, full-width, case fold) is refused or folded as the
      decisions above require (unit tests).
- [ ] After a rename, the old handle's share image, card and og:image URLs no longer serve the trader's content (test).
- [ ] A rejected handle or name shows its rule in visible text tied to the field, announced with `role=alert`, focus on
      the field (e2e at 360 px).

## Out of scope
- Retiring handles forever (O-9): owner.
- 301 redirects from old handles.
- Impersonation of named firms: handled by F-16's report and the owner's hide, not by a list.

## Open questions
- None from the council.

## Rework notes
