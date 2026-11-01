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

### Round 2 (plan v2)

- The UX lead accepted every demand (§R2 maps each one). **Business lead: SIGN**, with two conditions on B4 (no-store
  checked on the production build; a proxy fallback covers only `/u/*` pages, never images). **Engineer: CHANGES**, one
  blocking: B3 changes `lib/auth/attempts.test.ts:158,162`; rewrite both to "no active hold, row still this account's"
  and add a re-hold step. Folded in verbatim as §R3 (v3); both signatures stand on v3.

## Decisions (2026-11-01, committee's recommended option; both reviewers voted it)

1. Q1: the integrated vendor's word stays in `RESERVED` under POLICY T1's integrated-vendor exception; a test pins it
   as the only vendor entry. The owner may read F-17's clause literally and remove it.
2. Q2: a hold row is `{handle, until, user_id}`; the account link is nulled on deletion, and the release date stays.
3. Q3: look-alike checks keep the existing superset (every account, plus reserved, demo and F-7 handles at runtime).
4. Q4: NFKC applies in matching only (stored names stay NFC, F-9 fix round 5); full-width forms are refused.
5. Q5: "a profile report has an empty `sell_id`" is enforced in code with a db test, not a schema constraint.
6. Q6: one report per reporter and profile, ever (the existing unique row).
7. Q7: the owner digest is a script (`scripts/trust-digest.ts`), not a page.
8. Q8: leaving the untouched provisional handle and renaming back to one's own held handle don't start the 30-day
   clock.
9. Q9: a hidden trader sees one private, neutral line on their own profile; it never says "reported" or "review".
10. Q10: "rename chain" covers the handle chain (held old handles) and the ticker chain; the predicate is keyed on the
    user id.
11. Q11: the "New handle" label becomes visible.
12. Q12: a hidden profile answers 404 with the neutral notice, `private, no-store`.
13. Q13: owner-only items: approve the anti-impersonation line and the takedown wording, set the role mailbox, choose
    an email sender, choose the K18 age-assurance method, authorize axe-core (MPL-2.0) or accept the hand-built
    checks, confirm Q1, accept the ≤300 s image / ≤60 s JSON cache window.
14. Share images send `public, max-age=300` (engineer E2): `ImageResponse` otherwise caches for a year.
15. No edit to `app/pane.tsx`: the line mounts beside `ProfilePane` at its two call sites.

## Build

- **Step 0** (lead engineer, `658dab8`, then a merge of main): schema block (`users.hidden_at`, `users.handle_renamed_at`,
  `thesis_reports` target/category/resolution columns, `trust_audit`), the hidden state in `lib/visible-users.ts`,
  report categories and the neutral hidden line in `lib/report-copy.ts`, hide reasons, `PRODUCT_NAME`, and the
  not-found spike: Next passes `params` to the segment's `generateMetadata`, and sends `private, no-store` on these
  404s itself (no proxy fallback needed). `e2e/f16-not-found.spec.ts` passes on the production build.
- **Fan-out** (four engineers, separate worktrees, disjoint files): A predicate sweep, B reports/hide/digest,
  C UI surfaces, D F-17 handles. Merge order B, A, D, C.
- **Orchestrator item (2026-11-01, after #82):** key thesis reports by the stable `trade_key` too, accepting both a
  64-hex key and a row id with the same rules as `lib/likes.ts#close`, plus a test with a rebuild between render and
  report. Taken after engineer B's `lib/reports.ts` merges (the note slot in `app/user-note.tsx` is F-26's: only
  `lib/reports.ts` and the action change).
- **Merged** (2026-11-01): B (`b008213`), main (#82 and F-15's share_action; `db/schema.sql` kept both blocks), the
  trade_key item, D (`f76368f`), A (`57dd103`), C (`5a81b37`). Lead fixes at merge: `lib/likes.ts#close` keeps #82's
  trade_key path with A's predicate; the read scanner accepts a typed tag (`sql<{ a; b }>`), with a self-test; its
  allowlist gains `lib/share-actions.ts` (the trader's own share, 3) and `lib/trust-digest.ts` (owner script, 1) and
  drops `lib/reports.ts` (now on the predicate); `e2e/f16-hide.spec.ts` hides through `scripts/hide.ts`;
  `lib/user-note.test.ts:98` follows the feed card's trade_key (orchestrator item, same strength).
- **Gates after the merge:** `npx tsc --noEmit` clean; `npm test` 2037 tests, 0 failures (26 skipped, 1 owner TODO);
  guard ok; compliance: only the `@img/sharp-wasm32` licence in `node_modules`, which origin/main shows too (no
  dependency change here).

## Verify

- **Full e2e on the merged branch** (production build, every spec): 298 passed, 6 skipped, 1 failed
  (`e2e/follow.spec.ts:23`, `CONNECTION_ENDED`). Cause found after a second failure on its own: `e2e/f17-handles.spec.ts`
  ended the shared `lib/db.ts` pool in `afterAll`, and the next spec in the same worker inherited it. Fixed with the
  file's own pool; f17 + follow: 7 passed.
- **Independent code review** (fresh context): 1 blocking, 7 non-blocking, all fixed in fix round 1 (`bc98717`):
  (1) unhide re-moderates the current text (an edit made while hidden is never auto-published); (2) a hidden trader's
  name and figures leave other viewers' likes, follows and Record tools lists ("Profile not available"); (3) a
  right-side compound of verified/official is refused ("VERIFIEDTRADER"), -ly/-dom/-ness endings pass; (4) the runbook
  exports holds and audit rows before a restore; (5) the reporter lock comes before the target lock (concurrent reports
  on two profiles); (6) the digest counts a hidden thesis once; (7) dead code removed, the hidden trader's line names
  the real download page. The trade_key change is listed in the hand-off (orchestrator item). After the fixes:
  `npm test` 2042 tests, 0 failures; the f16, f17, follow, likes, thesis-safety, signin and app specs pass.
