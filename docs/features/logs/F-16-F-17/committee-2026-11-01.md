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

### Round 1 (plan v1, `plan.md`)

- **UX lead** drafted plan v1 with three stops: no axe package (axe-core is MPL-2.0, not on the allowed list: hand-built
  checks plus a pre-authorization request), the integrated vendor's word in `RESERVED`, and no product-name constant.
- **Business lead: CHANGES.** Blocking: (1) don't edit `app/pane.tsx` (owned by F-11): mount the line at its call
  sites; (2) a hidden thesis's own-view line must not say "review"; (3) no `delete from` in `changeHandle` (end a
  taken-back hold with `until = now()`); (4) the hidden trader's private 404 is `private, no-store` for every viewer.
  Non-blocking: reword the 301 ponytail; a signed-out path to the report page; a shorter anti-impersonation line;
  "Send report" in view at 360×740; the axe criterion stays unchecked until the owner answers.
- **Engineer: CHANGES.** Blocking: (1) under not-found Next builds metadata from the `not-found` module only: export
  `generateMetadata` from `app/u/[handle]/not-found.tsx` (spike first); (2) `ImageResponse` defaults to a one-year
  immutable cache: set `public, max-age=300` on the four share images; (3) `app/pane.tsx` is off-limits; (4) the read
  sweep misses six `open_positions` reads and `lib/positions.ts`; the `thesis_reports` rule needs
  `lib/privacy-retention.ts`; scanner self-test on nested templates; (5) the feed's `elig` CTE treats a hide like a
  deletion as of `asOf` (gaps, never shifts); (6) unhide of a cleared thesis follows the audit row, not the hold rule.
  Non-blocking: brand words stay substrings; an uncorrelated `visibleId(id)` form; drop the two new indexes; lock after
  the target lookup; the trader's own export and account reads stay on the deletion-only rule; follows; filer handles
  answer 'none'; inject `now` in rename tests; merge static tests; keep `getByLabel('New handle')`.
- Votes on §12 Q1–Q13: both reviewers voted the UX lead's recommended option on every question.
