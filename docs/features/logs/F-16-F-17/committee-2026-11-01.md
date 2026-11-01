# Committee 2026-11-01: F-16 trust-and-safety slice and F-17 handle and name integrity

Branch `claude/f16-f17-trust-safety` (one build slot, one PR for both). Feature files:
`docs/features/F-16-trust-and-safety-slice.md`, `docs/features/F-17-handle-and-name-integrity.md` (both re-approved by
the approval council, cycle 3). Every role is a separate subagent with fresh context (team/ux-lead.md,
team/business-lead.md, team/engineer.md, team/tester.md); open questions are decided by the committee's recommended
option under the owner's instruction of 2026-11-01.

## Prerequisites (checked 2026-11-01 on origin/main)

- F-9 thesis safety merged as PR #65 (`ff25ad5`, "User text and identity safety: D-01, D-02, D-08 and F-9 thesis
  safety"). Present on main: `lib/reports.ts` (thesis reports, `thesis_reports`), `lib/text-safety.ts`
  (`sanitizeUserText`, `skeleton`), `lib/handles.ts` (`RESERVED`, `checkHandle`, `checkDisplayName`), the rename hold
  in `lib/auth/attempts.ts#changeHandle` (`handle_reservations`), moderation v3 and the off-by-default review flag
  (`REVIEW_QUEUE=1`, `app/review/theses`).
- Fix #4, the shared visible-user predicate, merged as PR #59 (`3f216ba`): `lib/visible-users.ts`.

Both start conditions hold, so the `Blocked:` lines lapse with this build.

## Process
